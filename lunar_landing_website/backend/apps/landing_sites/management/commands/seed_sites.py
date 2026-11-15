"""Seed the initial candidate landing sites from ``scientific_engine.constants``."""

from __future__ import annotations

from django.core.management.base import BaseCommand

from apps.landing_sites.models import LandingSite
from scientific_engine.constants import CANDIDATE_SITES


class Command(BaseCommand):
    help = "Create/update the initial LunaNav candidate landing sites."

    def add_arguments(self, parser):
        parser.add_argument("--purge", action="store_true", help="Delete sites not in the seed list first.")

    def handle(self, *args, **options):
        slugs = {s["slug"] for s in CANDIDATE_SITES}
        if options["purge"]:
            removed, _ = LandingSite.objects.exclude(slug__in=slugs).delete()
            self.stdout.write(f"Purged {removed} non-seed records.")

        for spec in CANDIDATE_SITES:
            obj, created = LandingSite.objects.update_or_create(
                slug=spec["slug"],
                defaults={
                    "name": spec["name"],
                    "latitude": spec["latitude"],
                    "longitude": spec["longitude"],
                    "region": spec.get("region", ""),
                    "notes": spec.get("notes", ""),
                    "source": "Initial candidate coordinate input (not a surveyed site)",
                    "is_candidate": True,
                },
            )
            verb = "Created" if created else "Updated"
            self.stdout.write(f"{verb} {obj.slug}: {obj.latitude}, {obj.longitude}")
        self.stdout.write(self.style.SUCCESS(f"Seeded {len(CANDIDATE_SITES)} candidate sites."))
