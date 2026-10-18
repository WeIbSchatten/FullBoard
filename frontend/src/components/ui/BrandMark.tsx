interface BrandMarkProps {
  size?: number;
  className?: string;
}

const W_POINTS = '8.6,10 12.3,22 16,13.4 19.7,22 23.4,10';

// The "white shadow" mark: an on-accent W over its own faded offset copy.
export default function BrandMark({ size = 32, className }: BrandMarkProps) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 32 32"
      aria-hidden="true"
      focusable="false"
    >
      <rect width="32" height="32" rx="9" fill="var(--fb-accent)" />
      <g
        fill="none"
        stroke="var(--fb-on-accent)"
        strokeWidth="3.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polyline points={W_POINTS} transform="translate(1.7 1.7)" strokeOpacity="0.35" />
        <polyline points={W_POINTS} />
      </g>
    </svg>
  );
}
