import type { PeriodCalendarRow } from "./types";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function generatePeriodCalendar(
  year: number,
  periodCount: number,
): PeriodCalendarRow[] {
  const startOfYear = new Date(Date.UTC(year, 0, 1));
  const startOfNextYear = new Date(Date.UTC(year + 1, 0, 1));
  const totalDays = Math.round(
    (startOfNextYear.getTime() - startOfYear.getTime()) / MS_PER_DAY,
  );

  return Array.from({ length: periodCount }, (_, index) => {
    const startOffset = Math.floor((index * totalDays) / periodCount);
    const endOffset = Math.floor(((index + 1) * totalDays) / periodCount) - 1;
    const startDate = new Date(startOfYear.getTime() + startOffset * MS_PER_DAY);
    const endDate = new Date(startOfYear.getTime() + endOffset * MS_PER_DAY);

    return {
      period_id: `P${String(index + 1).padStart(2, "0")}`,
      year,
      period_index: index + 1,
      label: `Period ${index + 1}`,
      start_date: startDate.toISOString().slice(0, 10),
      end_date: endDate.toISOString().slice(0, 10),
      month_label: startDate.toLocaleString("en-US", {
        month: "short",
        timeZone: "UTC",
      }),
    };
  });
}
