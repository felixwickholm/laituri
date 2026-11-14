import { count, eur } from "@/lib/console/format/money";
import { day } from "@/lib/console/format/time";
import { plural, weekday } from "@/lib/supplier-console/format";
import type { DailyPoint } from "@/lib/supplier-console/types";

/** The seven days as plain columns: one bar per day for its requests, the number on top, no legend. */
export function DayStrip({ daily }: { daily: DailyPoint[] }) {
  const top = Math.max(1, ...daily.map((point) => point.requests));
  return (
    <div className="day-strip">
      <p className="day-strip-head">
        <span>Requests per day</span>
      </p>
      <ol className="day-cols">
        {daily.map((point, index) => {
          const today = index === daily.length - 1;
          const text = `${day(point.date)}: ${plural(point.requests, "request")}, ${count(point.ordered)} led to an order, ${eur(point.confirmedNet)} confirmed`;
          return (
            <li key={point.date} className="day-col" data-today={today} title={text} aria-label={text}>
              <span className="day-count num" aria-hidden="true">
                {count(point.requests)}
              </span>
              <span className="day-bar" aria-hidden="true">
                <span className="day-asked" style={{ height: `${(point.requests / top) * 100}%` }} />
              </span>
              <span className="day-name" aria-hidden="true">
                {today ? "Today" : weekday(point.date)}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
