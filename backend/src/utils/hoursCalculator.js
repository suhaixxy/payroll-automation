// UC-001: Turns a "clock in" / "clock out" time into a number of hours.
// Times are simple 24-hour strings like "08:00" or "17:30".

function timeStringToMinutes(timeString) {
  if (typeof timeString !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(timeString)) {
    return Number.NaN;
  }

  const [hours, minutes] = timeString.split(":").map(Number);
  return hours * 60 + minutes;
}

function calculateHours(clockIn, clockOut) {
  let minutesWorked = timeStringToMinutes(clockOut) - timeStringToMinutes(clockIn);

  // Negative means the shift crossed midnight (e.g. 22:00 -> 06:00) — add a day.
  if (minutesWorked < 0) {
    minutesWorked += 24 * 60;
  }

  const hoursWorked = minutesWorked / 60;

  // Round to 2 decimal places so totals look clean (e.g. 8.5, not 8.500000001).
  return Math.round(hoursWorked * 100) / 100;
}

module.exports = { calculateHours };
