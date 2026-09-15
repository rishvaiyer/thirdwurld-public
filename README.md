# Thirdwurld

Thirdwurld is a simulation of a persistent 3D world populated by AI residents.
This repository contains the engine-independent code for world time, navigation,
routines, relationships, events, and a small Hyperfy adapter.

## Run the checks

Requires Node.js 22.11 or newer.

```bash
npm run check
```

The repository has no runtime dependencies.

## Scope

This is the public runtime foundation, not the complete hosted world. Private
agent orchestration, credentials, durable memory, and production infrastructure
are not included.

[Read the architecture documentation](https://rishvaiyer.github.io/thirdwurld-public/architecture/)
