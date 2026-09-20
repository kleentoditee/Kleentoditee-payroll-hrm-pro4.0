export function calculatedShiftHours(startTime: string, endTime: string, breakMinutes: number): number | null {
  const timePattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
  if (!timePattern.test(startTime) || !timePattern.test(endTime)) return null;
  if (!Number.isInteger(breakMinutes) || breakMinutes < 0) return null;

  const [startHour, startMinute] = startTime.split(":").map(Number);
  const [endHour, endMinute] = endTime.split(":").map(Number);
  const start = startHour * 60 + startMinute;
  let end = endHour * 60 + endMinute;
  if (end < start) end += 24 * 60;

  const workedMinutes = end - start - breakMinutes;
  if (workedMinutes < 0 || workedMinutes > 24 * 60) return null;
  return Math.round((workedMinutes / 60 + Number.EPSILON) * 100) / 100;
}
