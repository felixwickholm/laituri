import { useMemo } from "react";
import { encodeQr, qrPath } from "@/lib/connect/qr";

const QUIET = 4;

/** A QR code of `value` as one SVG path, dark on white with the standard quiet zone, so a phone camera reads it in either theme. */
export function QrCode({ value, label, size = 128 }: { value: string; label: string; size?: number }) {
  const { path, extent } = useMemo(() => {
    const modules = encodeQr(value);
    return { path: qrPath(modules, QUIET), extent: modules.length + QUIET * 2 };
  }, [value]);
  return (
    <svg className="qr" width={size} height={size} viewBox={`0 0 ${extent} ${extent}`} role="img" aria-label={label} shapeRendering="crispEdges">
      <rect width={extent} height={extent} fill="#ffffff" />
      <path d={path} fill="#0b1220" />
    </svg>
  );
}
