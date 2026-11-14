/** The Laituri mark: a pier deck on three pilings standing in the water line. */
export function PierMark({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="2" y="7" width="20" height="3" rx="1.5" fill="#F7F8F8" />
      <path d="M6 10v8M12 10v8M18 10v8" stroke="#F7F8F8" strokeWidth="2" strokeLinecap="round" />
      <path d="M2 16.5h2.2M7.8 16.5h2.4M13.8 16.5h2.4M19.8 16.5H22" stroke="#0A84FF" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function Wordmark() {
  return (
    <span className="brand">
      <PierMark />
      <span className="product">Laituri</span>
    </span>
  );
}
