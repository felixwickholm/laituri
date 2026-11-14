/** A brand mark drawn from one 24 by 24 path, in the brand's own colour. Black marks follow the text colour, so they stay visible in dark mode. */
export function BrandMark({ path, color = "currentColor" }: { path: string; color?: string }) {
  return (
    <svg width={20} height={20} viewBox="0 0 24 24" fill={color} aria-hidden="true">
      <path d={path} />
    </svg>
  );
}
