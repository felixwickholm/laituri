import type { DayCount } from "@/lib/console/format/log";
import { count } from "@/lib/console/format/money";

/** Entries per day for the last seven days. Each bar carries its own count, so no axis is needed. */
export function DayHistogram({ days }: { days: DayCount[] }) {
  const max = Math.max(1, ...days.map((day) => day.count));
  const total = days.reduce((sum, day) => sum + day.count, 0);
  return (
    <figure className="histogram">
      <figcaption>
        Entries per day · last 7 days · <span className="num">{count(total)}</span>
      </figcaption>
      <ol className="histogram-bars">
        {days.map((day) => (
          <li key={day.date} data-today={day.today} aria-label={`${day.label}: ${day.count} ${day.count === 1 ? "entry" : "entries"}`}>
            <span className="bar-value num">{day.count}</span>
            <span className="bar-track">
              <span className="bar" style={{ transform: `scaleY(${day.count / max})` }} />
            </span>
            <span className="bar-label">{day.today ? "Today" : day.label}</span>
          </li>
        ))}
      </ol>
    </figure>
  );
}
