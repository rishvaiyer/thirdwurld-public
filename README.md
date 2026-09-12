# Thirdwurld

Thirdwurld is an experiment in building a persistent 3D world where autonomous residents can move, remember events, form evidence-backed relationships, and continue along safe routines.

This repository is a curated public implementation of selected Thirdwurld systems. It is intentionally small. It does not contain private resident data, production integrations, deployment configuration, generated assets, internal planning documents, or the private repository's history.

## Current public scope

The repository currently contains engine-independent modules for:

- Configurable world destinations and safe navigation outcomes
- A synchronized world clock based on one shared epoch
- Occupancy-aware simulation pacing and unattended cost control
- Bounded route progress after long idle periods
- Strict parsing of structured resident actions
- Evidence-backed relationship state
- Privacy-safe world event validation and public projection
- An in-memory runtime that composes the public systems

These modules are tested in isolation and have no runtime package dependencies. This is not yet a runnable 3D world. Hyperfy engine integration will be added later through explicit adapters after the original Thirdwurld systems are established.

## Design approach

Configuration contains values that should be easy to change, such as destination labels, coordinates, timing, and allowed action types. Behavior and safety rules remain in focused modules.

```text
editable configuration
        |
        v
Thirdwurld domain modules
        |
        v
future Hyperfy adapters
```

The modules return structured outcomes instead of hiding failures. External systems can adapt those outcomes to a renderer, server, database, or user interface without changing the underlying rules.

## Run the checks

Requirements:

- Node.js 22.11 or newer
- npm 10 or newer

```bash
npm test
npm run check
```

`npm test` runs the behavior suite with Node's built-in test runner. `npm run check` also validates JavaScript syntax and scans public source files for common repository-safety mistakes.

## Repository map

```text
src/config/          editable public configuration
src/actions/         bounded structured-action parsing
src/events/          privacy-safe event evidence
src/navigation/      destination travel and breadcrumbs
src/relationships/   evidence-backed relationship updates
src/runtime/         engine-independent system composition
src/simulation/      occupancy pacing and idle route progress
src/time/            synchronized world time
test/                behavior-focused tests
```

## Provenance and license

Thirdwurld was originally developed on top of Hyperfy. The public repository is a curated implementation, not a mirror or history export of the private project. The current modules are engine-independent; future Hyperfy-derived code will preserve clear upstream attribution and compatible licensing.

This repository is licensed under GPL-3.0-only. See [LICENSE](LICENSE).
