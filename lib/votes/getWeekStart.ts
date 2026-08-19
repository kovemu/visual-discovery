export function getWeekStart(date = new Date()) {
  const utcYear = date.getUTCFullYear();
  const utcMonth = date.getUTCMonth();
  const utcDate = date.getUTCDate();
  const utcDay = date.getUTCDay();

  const diffToMonday =
    utcDay === 0 ? -6 : 1 - utcDay;

  const monday = new Date(
    Date.UTC(
      utcYear,
      utcMonth,
      utcDate + diffToMonday,
    ),
  );

  return monday
    .toISOString()
    .slice(0, 10);
}
