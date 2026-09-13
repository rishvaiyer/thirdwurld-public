
export const routineConfig = {
  dayLengthMs: 24 * 60 * 60 * 1_000,
  periods: [
    { startHour: 0, activityId: 'rest' },
    { startHour: 7, activityId: 'socialize' },
    { startHour: 9, activityId: 'explore' },
    { startHour: 17, activityId: 'socialize' },
    { startHour: 21, activityId: 'rest' },
  ],
}
