"""NASA LOLA (Lunar Orbiter Laser Altimeter) DEM integration.

Real terrain is used **only** when a LOLA DEM tile is present in
``LUNAV["LOLA_DEM_DIR"]`` *and* ``rasterio`` is importable.  When neither is
true, this module reports ``available=False`` and the caller must fall back to
a clearly labelled lower-confidence estimate (see
:mod:`scientific_engine.terrain`).  Elevation is never fabricated here.

Supported products
------------------
Any GDAL-readable raster is accepted (``.tif``/``.tiff``/``.jp2``/``.img``).
The NASA PDS polar LOLA products (``LDEM_60S_240M.JP2`` …) are distributed in a
**south-polar stereographic** projection (``Moon2000_spole``) whose pixel
coordinates are not longitude/latitude.  This module therefore builds a PyProj
transformer from the tile's own geodetic CRS into the tile CRS so that
selenographic ``(lat, lon)`` queries hit the correct pixel.
"""

from __future__ import annotations

import logging
import math
import threading
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import numpy as np
from django.conf import settings

logger = logging.getLogger("lunanav.lola")

# LOLA DEM products use a spherical datum of R = 1737400 m for the global grid;
# tile metadata is read from the file when available.
DEFAULT_DATUM_RADIUS_M = 1_737_400.0

# LOLA fill / no-data sentinels seen in PDS products.
_NODATA_THRESHOLD = -1.0e30

# Case-insensitive: NASA products mix cases (e.g. ``LDEM_60S_240M.JP2``).
_RASTER_SUFFIXES = (".tif", ".tiff", ".jp2", ".img")

# Lazily-opened raster handles, keyed by absolute tile path.  Raster handles are
# not safe to share across threads, so access is serialised with a lock.  The
# number of tiles is tiny (typically one), so this is effectively free.
_TILE_CACHE: Dict[str, Tuple[object, object, Optional[str]]] = {}
_CACHE_LOCK = threading.Lock()

# Results of directory scans, memoised so that thousands of elevation lookups
# inside a single horizon profile do not re-glob the filesystem each time.
_DISCOVERY_CACHE: Dict[str, List[Path]] = {}


@dataclass
class ElevationSample:
    elevation_m: Optional[float]
    source: str
    resolution_m: Optional[float]
    dataset_version: Optional[str]
    available: bool
    note: str = ""


def dem_dir() -> Path:
    return Path(settings.LUNAV.get("LOLA_DEM_DIR", ""))


def discover_tiles(*, refresh: bool = False) -> List[Path]:
    """Return raster tiles in the DEM directory (case-insensitive, memoised)."""
    d = dem_dir()
    key = str(d)
    if not refresh and key in _DISCOVERY_CACHE:
        return _DISCOVERY_CACHE[key]
    if not d.exists():
        _DISCOVERY_CACHE[key] = []
        return []
    found: List[Path] = [
        p
        for p in d.iterdir()
        if p.is_file() and p.suffix.lower() in _RASTER_SUFFIXES
    ]
    found.sort()
    _DISCOVERY_CACHE[key] = found
    return found


def dataset_info() -> dict:
    """Summarise the locally available LOLA DEM coverage."""
    tiles = discover_tiles()
    rasterio_ok = True
    try:  # pragma: no cover - optional dependency
        import rasterio  # noqa: F401
    except Exception:
        rasterio_ok = False

    return {
        "available": bool(tiles) and rasterio_ok,
        "directory": str(dem_dir()),
        "tile_count": len(tiles),
        "tiles": [t.name for t in tiles],
        "rasterio_installed": rasterio_ok,
        "datum_radius_m": DEFAULT_DATUM_RADIUS_M,
        "product": "NASA LRO LOLA DEM",
        "note": (
            "Place a LOLA DEM tile (GeoTIFF/JP2) in the DEM directory and install "
            "rasterio to enable measured terrain. Until then terrain-dependent "
            "analyses use a labelled lower-confidence estimate."
        ),
    }


def _open_tile(tile: Path):
    """Open (and cache) a raster plus a lat/lon → tile-CRS transformer."""
    import rasterio
    from pyproj import CRS, Transformer

    key = str(tile.resolve())
    with _CACHE_LOCK:
        cached = _TILE_CACHE.get(key)
        if cached is not None:
            return cached

        ds = rasterio.open(tile)
        projected = CRS.from_wkt(ds.crs.to_wkt())
        # The raster CRS may already be geographic (e.g. a simple global grid);
        # in that case no reprojection is required.
        if projected.is_geographic:
            transformer = None
            crs_name = projected.name
        else:
            transformer = Transformer.from_crs(
                projected.geodetic_crs, projected, always_xy=True
            )
            crs_name = projected.name
        entry = (ds, transformer, crs_name)
        _TILE_CACHE[key] = entry
        return entry


def _tile_lookup(ds, transformer, lat_deg: float, lon_deg: float) -> Optional[Tuple[int, int]]:
    """Return the (row, col) covering (lat, lon) or None if outside the tile."""
    if transformer is None:
        x, y = lon_deg, lat_deg
    else:
        x, y = transformer.transform(lon_deg, lat_deg)
    if x is None or y is None:
        return None
    # Reject the polar stereographic "far side" singularity: pyproj returns
    # non-finite values there, caught above; also guard the tile extent.
    try:
        from rasterio.transform import rowcol

        row, col = rowcol(ds.transform, x, y)
    except Exception:  # pragma: no cover - defensive
        return None
    if 0 <= row < ds.height and 0 <= col < ds.width:
        return int(row), int(col)
    return None


@dataclass
class RasterRegion:
    """An in-memory window of a DEM tile plus a fast coordinate sampler.

    Individual point lookups against a JP2 cost ~15 ms each because GDAL
    decompresses a whole 1024×1024 code block; a horizon profile needs tens of
    thousands of them.  Reading the whole neighbourhood once and sampling the
    NumPy array reduces that to microseconds.
    """

    array: np.ndarray
    row0: int
    col0: int
    transform: object
    transformer: object  # lat/lon -> projected, or None for geographic tiles
    resolution_m: float
    tile_name: str
    dataset_version: str

    def elevation(self, lat_deg: float, lon_deg: float) -> Optional[float]:
        from rasterio.transform import rowcol

        if self.transformer is None:
            x, y = lon_deg, lat_deg
        else:
            x, y = self.transformer.transform(lon_deg, lat_deg)
        if x is None or y is None or not (math.isfinite(x) and math.isfinite(y)):
            return None
        row, col = rowcol(self.transform, x, y)
        rr, cc = row - self.row0, col - self.col0
        if 0 <= rr < self.array.shape[0] and 0 <= cc < self.array.shape[1]:
            value = float(self.array[rr, cc])
            if value > _NODATA_THRESHOLD:
                return value
        return None


# Cached windows, keyed by (tile path, row0, col0, height, width).
_REGION_CACHE: Dict[Tuple[str, int, int, int, int], RasterRegion] = {}


def load_region(
    lat_deg: float, lon_deg: float, *, half_extent_km: float = 40.0
) -> Optional[RasterRegion]:
    """Load (and cache) a DEM window covering ``half_extent_km`` around a point."""
    tiles = discover_tiles()
    for tile in tiles:
        try:
            ds, transformer, _crs = _open_tile(tile)
            if transformer is None:
                x, y = lon_deg, lat_deg
            else:
                x, y = transformer.transform(lon_deg, lat_deg)
            if x is None or y is None or not (math.isfinite(x) and math.isfinite(y)):
                continue
            from rasterio.transform import rowcol

            row, col = rowcol(ds.transform, x, y)
            res = abs(ds.transform.a) or abs(ds.transform.e) or 1.0
            half_px = int(math.ceil(half_extent_km * 1000.0 / res)) + 2
            # Reject a centre that is far outside this tile.
            if not (-half_px <= row <= ds.height + half_px and -half_px <= col <= ds.width + half_px):
                continue
            r0 = max(0, row - half_px)
            c0 = max(0, col - half_px)
            r1 = min(ds.height, row + half_px)
            c1 = min(ds.width, col + half_px)
            if r1 <= r0 or c1 <= c0:
                continue
            key = (str(tile.resolve()), r0, c0, r1 - r0, c1 - c0)
            cached = _REGION_CACHE.get(key)
            if cached is not None:
                return cached
            with _CACHE_LOCK:
                arr = ds.read(1, window=((r0, r1), (c0, c1)))
            region = RasterRegion(
                array=arr,
                row0=r0,
                col0=c0,
                transform=ds.transform,
                transformer=transformer,
                resolution_m=res,
                tile_name=tile.name,
                dataset_version=tile.stem,
            )
            _REGION_CACHE[key] = region
            return region
        except Exception as exc:  # pragma: no cover - defensive
            logger.warning("LOLA region load failed for %s: %s", tile.name, exc)
            continue
    return None


def make_sampler(lat_deg: float, lon_deg: float, *, half_extent_km: float = 40.0):
    """Return ``(sampler, region)`` where ``sampler(lat, lon) -> float|None``.

    Returns ``(None, None)`` when no DEM covers the point.
    """
    region = load_region(lat_deg, lon_deg, half_extent_km=half_extent_km)
    if region is None:
        return None, None

    def _sample(la: float, lo: float) -> Optional[float]:
        return region.elevation(la, lo)

    return _sample, region


def sample_elevation(lat_deg: float, lon_deg: float) -> ElevationSample:
    """Return a measured elevation if a DEM tile covers this coordinate."""
    info = dataset_info()
    if not info["available"]:
        return ElevationSample(
            elevation_m=None,
            source="none",
            resolution_m=None,
            dataset_version=None,
            available=False,
            note=info["note"],
        )

    try:  # pragma: no cover - requires rasterio + real tiles
        for tile in discover_tiles():
            ds, transformer, _crs = _open_tile(tile)
            rc = _tile_lookup(ds, transformer, lat_deg, lon_deg)
            if rc is None:
                continue
            row, col = rc
            with _CACHE_LOCK:
                value = float(ds.read(1, window=((row, row + 1), (col, col + 1)))[0, 0])
            if value <= _NODATA_THRESHOLD:
                continue
            res = abs(ds.transform.a) or abs(ds.transform.e)
            return ElevationSample(
                elevation_m=value,
                source=f"LOLA DEM tile {tile.name}",
                resolution_m=res,
                dataset_version=tile.stem,
                available=True,
            )
    except Exception as exc:  # pragma: no cover
        logger.warning("LOLA DEM sampling failed: %s", exc)
        return ElevationSample(
            elevation_m=None,
            source="none",
            resolution_m=None,
            dataset_version=None,
            available=False,
            note=f"DEM read error: {exc}",
        )

    return ElevationSample(
        elevation_m=None,
        source="none",
        resolution_m=None,
        dataset_version=None,
        available=False,
        note="No LOLA DEM tile covers this coordinate.",
    )
