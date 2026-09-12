// SPDX-License-Identifier: GPL-3.0-only

export const locomotionConfig = {
  turning: {
    radiansPerSecond: (200 * Math.PI) / 180,
    moveAlignmentRadians: (18 * Math.PI) / 180,
  },
  movement: {
    minimumSpeedScale: 0.9,
    maximumSpeedScale: 1.05,
  },
  avoidance: {
    separationRadius: 1.65,
    yieldRadius: 0.9,
    stopRadius: 0.55,
  },
  running: {
    startRemainingMeters: 9,
    stopRemainingMeters: 4,
    startSegmentMeters: 4.5,
    stopSegmentMeters: 2,
  },
}
