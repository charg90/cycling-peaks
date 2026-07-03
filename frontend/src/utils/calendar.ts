export function getMonthDays(year: number, month: number): { daysInMonth: number; startWeekday: number } {
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const daysInMonth = lastDay.getDate()
  let startWeekday = (firstDay.getDay() + 6) % 7
  return { daysInMonth, startWeekday }
}