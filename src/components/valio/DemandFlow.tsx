"use client";

import { useMemo, useState } from "react";
import {
  alternativeRequests,
  demandFlow,
  flowRows,
  flowSummary,
  layoutFlow,
  nodeFigure,
  nodeLines,
  spreadLabels,
  type FlowLayout,
  type FlowModel,
  type FlowNodeId,
  type PlacedNode,
} from "@/lib/supplier-console/flow";
import { unmetInWeek, weekFigures } from "@/lib/supplier-console/format";
import type { ControlOverview } from "@/lib/supplier-console/types";
import type { Activity } from "@/lib/store/types";
import { useSize } from "./useSize";

const NODE = 10;
const GAP = 10;
const HEIGHT = 288;
const HEAD = 28;
const LABEL_SPACE = 34;
const LABEL_ROOM = 172;
const SPANS: [number, number, number] = [0.22, 0.45, 0.33];
/** Below this width the diagram becomes three stacked bars. */
const STACK_BELOW = 560;
const MINI = { width: 240, height: 112 };
const CAPTIONS = ["Asked", "Answered", "Result", "Orders"];

/** The flow for the overview's seven days: the week's requests, unserved and orders, with the alternatives derived from activity. */
export function weekFlow(overview: ControlOverview, activity?: Activity[]): FlowModel {
  const week = weekFigures(overview.daily);
  return demandFlow({
    requests: week.requests,
    ordered: week.ordered,
    unmet: unmetInWeek(overview.unmet, overview.daily),
    orders: overview.orders.byOutcome,
    week: { orders: overview.daily.reduce((sum, day) => sum + day.orders, 0), confirmed: week.confirmed, confirmedNet: week.confirmedNet },
    ...(activity ? { alternatives: alternativeRequests(activity, overview.daily) } : {}),
  });
}

export interface DemandFlowProps {
  overview: ControlOverview;
  /** Every buyer's activity; with it, served requests split into "in full" and "alternative". */
  activity?: Activity[];
  /** "mini": a fixed small drawing with no labels, tooltips or table, for a miniature elsewhere. */
  variant?: "full" | "mini";
}

/** "Where demand went": requests, how Valio Aimo answered them, and what the answers turned into. */
export function DemandFlow({ overview, activity, variant = "full" }: DemandFlowProps) {
  const model = useMemo(() => weekFlow(overview, activity), [overview, activity]);
  return variant === "mini" ? <MiniFlow model={model} /> : <FullFlow model={model} />;
}

function MiniFlow({ model }: { model: FlowModel }) {
  const layout = useMemo(() => layoutFlow(model, { ...MINI, node: 6, gap: 6, labelRoom: 0 }), [model]);
  return (
    <svg className="flow flow-mini" viewBox={`0 0 ${MINI.width} ${MINI.height}`} role="img" aria-label={`Where demand went: ${flowSummary(model)}`}>
      <Marks layout={layout} node={6} />
    </svg>
  );
}

function FullFlow({ model }: { model: FlowModel }) {
  const [ref, { width }] = useSize<HTMLDivElement>({ width: 680, height: HEIGHT });
  const stacked = width < STACK_BELOW;
  if (model.requests === 0) {
    return <p className="flow-empty">No agent has asked for anything in the last 7 days.</p>;
  }
  return (
    <div className="flow-wrap" ref={ref}>
      {stacked ? <StackedFlow model={model} /> : <DrawnFlow model={model} width={width} />}
      <FlowTable model={model} />
    </div>
  );
}

function linkKey(source: string, target: string) {
  return `${source}>${target}`;
}

/** The links and bars, shared by the full and the mini drawing. */
function Marks({ layout, node, active }: { layout: FlowLayout; node: number; active?: FlowNodeId }) {
  const lit = (source: string, target: FlowNodeId) => (active === undefined ? undefined : active === target || active === source);
  const tone = (id: FlowNodeId) => layout.nodes.find((n) => n.id === id)?.tone;
  return (
    <>
      <g className="flow-links">
        {layout.links.map((link) => (
          <path
            key={linkKey(link.source, link.target)}
            className="flow-link"
            data-tone={tone(link.target)}
            data-lit={lit(link.source, link.target)}
            d={link.path}
            strokeWidth={link.width}
            pathLength={1}
          />
        ))}
      </g>
      <g className="flow-bars">
        {layout.nodes.map((item) => (
          <rect
            key={item.id}
            className="flow-bar"
            data-tone={item.tone}
            data-lit={active === undefined ? undefined : active === item.id}
            x={item.x}
            y={item.y + (item.id === "alternative" ? 1 : 0)}
            width={node}
            height={Math.max(1, item.h - (item.id === "in_full" || item.id === "alternative" ? 1 : 0))}
            rx={2}
          />
        ))}
      </g>
    </>
  );
}

function DrawnFlow({ model, width }: { model: FlowModel; width: number }) {
  const [active, setActive] = useState<FlowNodeId | undefined>();
  const layout = useMemo(
    () => layoutFlow(model, { width, height: HEIGHT, node: NODE, gap: GAP, labelRoom: LABEL_ROOM, spans: SPANS }),
    [model, width],
  );
  const labels = useMemo(() => placeLabels(layout.nodes), [layout]);
  const shown = active ? layout.nodes.find((item) => item.id === active) : undefined;
  const total = HEAD + HEIGHT + 8;

  return (
    <div className="flow-draw" onMouseLeave={() => setActive(undefined)}>
      <svg width={width} height={total} className="flow" role="group" aria-label={`Where demand went. ${flowSummary(model)}`}>
        <g aria-hidden="true">
          {layout.columns.map((x, index) => (
            <text key={CAPTIONS[index]} className="flow-caption" x={x} y={12}>
              {CAPTIONS[index]}
            </text>
          ))}
        </g>
        <g transform={`translate(0 ${HEAD})`}>
          <Marks layout={layout} node={NODE} active={active} />
          {layout.nodes.map((item) => {
            const y = labels.get(item.id) ?? item.y + item.h / 2;
            return (
              <g
                key={item.id}
                className="flow-node"
                tabIndex={0}
                role="img"
                aria-label={`${item.label}: ${nodeLines(item, model).join(", ")}`}
                data-lit={active === undefined ? undefined : active === item.id}
                onMouseEnter={() => setActive(item.id)}
                onFocus={() => setActive(item.id)}
                onBlur={() => setActive(undefined)}
              >
                <rect className="flow-hit" x={item.x - 4} y={Math.min(item.y, y - 16) - 2} width={NODE + 8 + labelWidth(item)} height={Math.max(item.h, 36)} rx={6} />
                <text className="flow-label" x={item.x + NODE + 8} y={y - 3}>
                  {item.label}
                </text>
                <text className="flow-figure" x={item.x + NODE + 8} y={y + 13}>
                  {nodeFigure(item)}
                </text>
              </g>
            );
          })}
        </g>
      </svg>
      {shown ? <FlowTip node={shown} model={model} y={HEAD + (labels.get(shown.id) ?? shown.y)} width={width} /> : null}
    </div>
  );
}

/** A rough label width for the hit area; the exact width does not matter, only that it covers the words. */
function labelWidth(item: PlacedNode) {
  return Math.max(item.label.length, nodeFigure(item).length) * 7.2;
}

/** Each column's labels, pushed apart so two lines of text never overlap. */
function placeLabels(nodes: PlacedNode[]): Map<FlowNodeId, number> {
  const out = new Map<FlowNodeId, number>();
  for (const stage of [0, 1, 2, 3]) {
    const column = nodes.filter((item) => item.stage === stage);
    const centres = spreadLabels(
      column.map((item) => item.y + item.h / 2),
      LABEL_SPACE,
      -4,
      HEIGHT + 8,
    );
    column.forEach((item, index) => out.set(item.id, centres[index]));
  }
  return out;
}

function FlowTip({ node, model, y, width }: { node: PlacedNode; model: FlowModel; y: number; width: number }) {
  const left = Math.min(node.x + NODE + 8, width - 236);
  // Labels in the lower half open their tip above the label, so it never runs past the card.
  const above = y > HEAD + HEIGHT / 2;
  return (
    <div className="chart-tip flow-tip" role="status" data-above={above} style={{ left, top: above ? y - 20 : y + 24 }}>
      <strong>{node.label}</strong>
      {nodeLines(node, model).map((line) => (
        <span key={line}>{line}</span>
      ))}
    </div>
  );
}

/** On a phone: the same three steps as stacked bars, each part named under its bar. */
function StackedFlow({ model }: { model: FlowModel }) {
  return (
    <ol className="flow-rows" aria-hidden="true">
      {flowRows(model).map((row) => (
        <li key={row.key} className="flow-row">
          <p className="flow-row-head">
            <span>{row.label}</span>
            <span className="num">{row.total}</span>
          </p>
          <span className="flow-stack">
            {row.parts.map((part) => (
              <span key={part.id} className="flow-seg" data-tone={part.tone} style={{ flexGrow: part.weight }} />
            ))}
          </span>
          <ul className="flow-parts">
            {row.parts.map((part) => (
              <li key={part.id}>
                <span className="swatch flow-swatch" data-tone={part.tone} aria-hidden="true" />
                <span>{part.label}</span>
                <span className="num">{nodeFigure(part)}</span>
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ol>
  );
}

/** The flow as a table, for screen readers. */
function FlowTable({ model }: { model: FlowModel }) {
  return (
    <table className="sr-only">
      <caption>Where demand went, last 7 days</caption>
      <thead>
        <tr>
          <th scope="col">Step</th>
          <th scope="col">Count</th>
          <th scope="col">Detail</th>
        </tr>
      </thead>
      <tbody>
        {model.nodes.map((item) => (
          <tr key={item.id}>
            <th scope="row">{item.label}</th>
            <td>{nodeFigure(item)}</td>
            <td>{nodeLines(item, model).join(", ")}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
