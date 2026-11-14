import { count, eur } from "@/lib/console/format/money";
import { day } from "@/lib/console/format/time";
import { plural, weekday } from "@/lib/supplier-console/format";
import type { DailyPoint } from "@/lib/supplier-console/types";

/** The seven days as small columns: requests in grey, the part that led to an order in the accent. */
export function DayStrip({ daily }: { daily: DailyPoint[] }) {
  const top = Math.max(1, ...daily.map((point) => point.requests));
  return (
    <div className="day-strip">
      <p className="day-strip-head">
        <span>Requests per day</span>
        <span className="day-strip-key">
          <span className="swatch" data-series="requests" aria-hidden="true" />
          Asked
          <span className="swatch" data-series="orders" aria-hidden="true" />
          Led to an order
        </span>
      </p>
      <ol className="day-cols">
        {daily.map((point, index) => {
          const today = index === daily.length - 1;
          const text = `${day(point.date)}: ${plural(point.requests, "request")}, ${count(point.ordered)} led to an order, ${eur(point.confirmedNet)} confirmed`;
          return (
            <li key={point.date} className="day-col" data-today={today} title={text} aria-label={text}>
              <span className="day-bar" aria-hidden="true">
                <span className="day-asked" style={{ height: `${(point.requests / top) * 100}%` }} />
                <span className="day-ordered" style={{ height: `${(point.ordered / top) * 100}%` }} />
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
