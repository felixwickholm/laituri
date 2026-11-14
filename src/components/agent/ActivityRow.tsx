import { Bot, FileSignature, PackageCheck, Plug, Search, Tag, UserCheck, type LucideIcon } from "lucide-react";
import { activityView } from "@/lib/console/format/activity";
import { clock } from "@/lib/console/format/time";
import type { Activity } from "@/lib/console/types";

const TOOL_ICONS: Record<string, LucideIcon> = {
  search_catalog: Search,
  get_product: Tag,
  request_quote: FileSignature,
  place_order: PackageCheck,
  get_order: PackageCheck,
};

function iconFor(activity: Activity): LucideIcon {
  if (activity.tool && TOOL_ICONS[activity.tool]) return TOOL_ICONS[activity.tool];
  if (/connected/i.test(activity.title)) return Plug;
  if (/approved|rejected/i.test(activity.title)) return UserCheck;
  return Bot;
}

function Glyph({ activity }: { activity: Activity }) {
  const icon = iconFor(activity);
  return <span className="glyph" aria-hidden="true">{renderIcon(icon)}</span>;
}

function renderIcon(Icon: LucideIcon) {
  return <Icon />;
}

interface ActivityRowProps {
  activity: Activity;
  onOpen?: (orderId: string) => void;
}

/** Time, verb sentence, detail, and the result on the right. Only waiting and failure states take colour. */
export function ActivityRow({ activity, onOpen }: ActivityRowProps) {
  const view = activityView(activity);
  const orderId = activity.refs?.orderId;
  const clickable = Boolean(orderId && onOpen);
  const resultClass = view.tone === "waiting" ? "tone-waiting" : view.tone === "danger" ? "tone-danger" : "";
  return (
    <li className="act" data-note={activity.kind === "note"} data-clickable={clickable}>
      <time className="mono" dateTime={activity.at}>
        {clock(activity.at).slice(0, 5)}
        <span className="sec">{clock(activity.at).slice(5)}</span>
      </time>
      <Glyph activity={activity} />
      <span className="text">
        {clickable && orderId ? (
          <button type="button" className="open title" onClick={() => onOpen?.(orderId)}>
            {view.title}
          </button>
        ) : (
          <span className="title">{view.title}</span>
        )}
        {view.detail ? <span className="detail">{view.detail}</span> : null}
      </span>
      <span className={`result mono ${resultClass}`}>{view.result}</span>
    </li>
  );
}
