# Scope decisions

Decision date: 27 September 2026.

These decisions follow the war plan's cut rules and keep the submission aligned with what the repository actually ships.

## Live Rain Forecast: cut for the Imaginathon, added back as a weather card (25 October 2026)

The Open-Meteo forecast strip was not part of the Imaginathon submission. The core experience replays recorded, sourced storms and works without a forecast network request.

For the Zindigi demo a small weather card shows Islamabad's current weather and the highest hourly rain chance over the next 24 hours, credited "Data: Open-Meteo". It is context only: no RAIN//GRID calculation uses it, and it is hidden on any error or timeout, so it adds no failure path to the core loop. Open-Meteo's free API is for non-commercial use; a commercial launch needs their paid plan or another source (see `docs/zindigi-demo.md`).

## Standalone Flood Relief meter: cut

The named Flood Relief meter is not part of the submitted scope. A defensible peak-flood reduction estimate would require rainfall intensity or a storm hydrograph, drainage capacity, timing and site conditions that the current event sources do not provide. Showing a peak-relief number from storm totals alone would create false precision.

RAIN//GRID continues to show the measured scenario quantities it can support: water stored in tanks, routed toward potential recharge, lost through runoff processes and still sent to the drain. Street totals are labelled as scenarios and are not presented as measured flood-peak reduction.
