/**
 * Week boundary utilities — respects the user-configurable week_start_day.
 * week_start_day: 0 = Sunday, 1 = Monday, …, 6 = Saturday
 */

function fmtDate(d: Date): string {
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-')
}

/**
 * Returns the ISO date string (YYYY-MM-DD) for the start of the week that
 * contains `date`, given `weekStartDay` (0=Sun … 6=Sat, default 0).
 */
export function getWeekStart(date: Date = new Date(), weekStartDay = 0): string {
  const d = new Date(date)
  const jsDay = d.getDay() // 0=Sun … 6=Sat
  // How many days back do we need to go to reach weekStartDay?
  const diff = (jsDay - weekStartDay + 7) % 7
  d.setDate(d.getDate() - diff)
  return fmtDate(d)
}

/**
 * Returns the ISO date string (YYYY-MM-DD) for the *end* of the week
 * (6 days after the week start).
 */
export function getWeekEnd(weekStart: string): string {
  const d = new Date(weekStart + 'T12:00:00')
  d.setDate(d.getDate() + 6)
  return fmtDate(d)
}

/** Build an array of 7 YYYY-MM-DD strings starting from weekStart. */
export function getWeekDays(weekStart: string): string[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart + 'T12:00:00')
    d.setDate(d.getDate() + i)
    return fmtDate(d)
  })
}

/** Ordered 3-letter day labels starting from weekStartDay. */
export const ALL_DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function getOrderedDayNames(weekStartDay = 0): string[] {
  return Array.from({ length: 7 }, (_, i) => ALL_DAY_NAMES[(weekStartDay + i) % 7])
}
