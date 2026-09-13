// SPDX-License-Identifier: GPL-3.0-only

export const simulationConfig = {
  pace: {
    activeTickIntervalSeconds: 1 / 30,
    idleTickIntervalSeconds: 1 / 2,
    liveWhileEmpty: false,
  },
  occupancy: {
    emptyGraceMs: 15 * 60 * 1_000,
  },
  idleMovement: {
    metersPerSecond: 2.6,
    maxStepMeters: 12,
  },
}
