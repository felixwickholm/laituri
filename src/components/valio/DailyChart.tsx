"use client";

import { useState } from "react";
import { count, eur } from "@/lib/console/format/money";
import { day } from "@/lib/console/format/time";
import { eurShort, niceTicks, plural, weekday } from "@/lib/supplier-console/format";
import type { DailyPoint } from "@/lib/supplier-console/types";
import { useSize } from "./useSize";

const TOP = 8;
const AXIS_W = 28;
const LABEL_H = 22;
const VALUE_H = 18;
const MIN_PLOT = 150;

/**
 * Requests per day for the last seven days: grey columns for what agents asked, accent columns for the requests
 * of that day that led to an order (never taller than the grey). Confirmed value sits under each day as a label.
 */
export function DailyChart({ daily }: { daily: DailyPoint[] }) {
  const [ref, { width, height }] = useSize<HTMLDivElement>({ width: 640, height: 260 });
  const plotH = Math.max(MIN_PLOT, height - TOP - LABEL_H - VALUE_H);
  const chartH = TOP + plotH + LABEL_H + VALUE_H;
  const [hover, setHover] = useState<number | null>(null);
  const ticks = niceTicks(Math.max(0, ...daily.map((point) => point.requests)));
  const top = ticks[ticks.length - 1];
  const plotW = Math.max(120, width - AXIS_W);
  const slot = plotW / Math.max(1, daily.length);
  const bar = Math.max(6, Math.min(18, slot * 0.22));
  const y = (value: number) => TOP + plotH - (value / top) * plotH;
  const active = hover === null ? undefined : daily[hover];

  return (
    <div className="daily-chart" ref={ref} onMouseLeave={() => setHover(null)}>
      <svg width={width} height={chartH} role="img" aria-label="Requests per day and how many led to an order, last 7 days">
        {ticks.map((tick) => (
          <g key={tick}>
            <line className={tick === 0 ? "axis-base" : "grid"} x1={AXIS_W} x2={width} y1={y(tick)} y2={y(tick)} />
            <text className="tick" x={AXIS_W - 8} y={y(tick)} dy="0.32em" textAnchor="end">
              {tick}
            </text>
          </g>
        ))}
        {daily.map((point, index) => {
          const cx = AXIS_W + slot * index + slot / 2;
          const today = index === daily.length - 1;
          return (
            <g key={point.date} data-hover={hover === index} data-today={today}>
              <rect className="day-hover" x={cx - slot / 2 + 2} y={TOP} width={slot - 4} height={plotH} rx={6} />
              <rect className="col-requests" x={cx - bar - 1.5} y={y(point.requests)} width={bar} height={Math.max(0, TOP + plotH - y(point.requests))} />
              <rect className="col-orders" x={cx + 1.5} y={y(point.ordered)} width={bar} height={Math.max(0, TOP + plotH - y(point.ordered))} />
              <text className="day-label" x={cx} y={TOP + plotH + 16} textAnchor="middle">
                {today ? "Today" : weekday(point.date)}
              </text>
              <text className="day-value" x={cx} y={TOP + plotH + LABEL_H + 13} textAnchor="middle">
                {eurShort(point.confirmedNet)}
              </text>
              <rect
                className="day-hit"
                x={cx - slot / 2}
                y={0}
                width={slot}
                height={chartH}
                tabIndex={0}
                aria-label={`${day(point.date)}: ${plural(point.requests, "request")}, ${count(point.ordered)} led to an order, ${eur(point.confirmedNet)} confirmed`}
                onMouseEnter={() => setHover(index)}
                onFocus={() => setHover(index)}
                onBlur={() => setHover(null)}
              />
            </g>
          );
        })}
      </svg>
      {active && hover !== null ? (
        <div
          className="chart-tip"
          role="status"
          style={{ left: Math.min(Math.max(AXIS_W + slot * hover + slot / 2, 90), width - 90) }}
        >
          <strong>{day(active.date)}</strong>
          <span>
            <span className="swatch" data-series="requests" aria-hidden="true" />
            {count(active.requests)} requests
          </span>
          <span>
            <span className="swatch" data-series="orders" aria-hidden="true" />
            {count(active.ordered)} led to an order
          </span>
          <span>{eur(active.confirmedNet)} confirmed</span>
        </div>
      ) : null}
    </div>
  );
}
