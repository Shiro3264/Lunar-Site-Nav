import requests

API_URL = "https://ssd.jpl.nasa.gov/api/horizons.api"

sites = {
    "Mons Mouton": {
        "latitude": -85.4,
        "longitude": 31.7
    },

    "Malapert Massif": {
        "latitude": -86.0,
        "longitude": -0.2
    },

    "Nobile Rim 1": {
        "latitude": -85.4,
        "longitude": 37.3
    },

    "Haworth": {
        "latitude": -86.8,
        "longitude": -22.8
    }
}

def parse_horizons_data(raw_data):

    measurements = []

    # Find where the actual data starts and ends
    start = raw_data.index("$$SOE") + len("$$SOE")
    end = raw_data.index("$$EOE")

    # Extract only the rows between those markers
    data_section = raw_data[start:end]

    # Process each row separately
    for line in data_section.strip().split("\n"):

        # Split the row into individual pieces
        parts = line.split()

        # Ignore empty or incomplete rows
        if len(parts) < 4:
            continue

        # Date and time
        timestamp = parts[0] + " " + parts[1]

        # Last two columns are always azimuth and elevation
        azimuth = float(parts[-2])
        elevation = float(parts[-1])

        # Anything between the time and numbers is a visibility marker
        markers = parts[2:-2]

        measurement = {
            "time": timestamp,
            "azimuth": azimuth,
            "elevation": elevation,
            "sun_visible": "*" in markers,
            "interferer_visible": "i" in markers
        }

        measurements.append(measurement)

    return measurements

def get_ephemeris(target_id, longitude, latitude, altitude,
                  start_date, stop_date):

    params = {
        "format": "json",
        "COMMAND": str(target_id),
        "EPHEM_TYPE": "OBSERVER",
        "CENTER": "coord@301",

        "SITE_COORD": f"{longitude},{latitude},{altitude}",

        "START_TIME": start_date,
        "STOP_TIME": stop_date,
        "STEP_SIZE": "1 h",
        "TIME_TYPE": "UT",

        "QUANTITIES": "4",
        "OBJ_DATA": "NO"
    }

    response = requests.get(
        API_URL,
        params=params,
        timeout=60
    )

    response.raise_for_status()

    data = response.json()

    if "error" in data:
        raise Exception(data["error"])

    if "result" not in data:
        raise Exception("No ephemeris result returned")

    return data["result"]


# Apollo 11
longitude = sites.get("Mons Mouton")["longitude"]
latitude = sites.get("Mons Mouton")["latitude"]
altitude = 0

# Get Sun data
sun_data = get_ephemeris(
    10, longitude, latitude, altitude,
    "2026-11-15", "2026-11-16"
)

# Get Earth data
earth_data = get_ephemeris(
    399, longitude, latitude, altitude,
    "2026-11-15", "2026-11-16"
)

sun_measurements = parse_horizons_data(sun_data)

earth_measurements = parse_horizons_data(earth_data)

print("SUN:")
print(sun_measurements[0])

print("\nEARTH:")
print(earth_measurements[0])


combined_data = []

for sun, earth in zip(sun_measurements, earth_measurements):

    combined_data.append({

        "time": sun["time"],

        "sun": {
            "azimuth": sun["azimuth"],
            "elevation": sun["elevation"],
            "visible": sun["sun_visible"]
        },

        "earth": {
            "azimuth": earth["azimuth"],
            "elevation": earth["elevation"],
            "visible": earth["interferer_visible"]
        }

    })


print("\nCombined data:")
print(combined_data[0])