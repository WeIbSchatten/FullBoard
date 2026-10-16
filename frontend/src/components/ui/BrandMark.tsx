interface BrandMarkProps {
  size?: number;
  className?: string;
}

// Monochrome tile: the accent square with three "board" rails in the on-accent colour.
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
      <rect x="8" y="8.5" width="16" height="3.4" rx="1.7" fill="var(--fb-on-accent)" />
      <rect x="8" y="14.3" width="11.5" height="3.4" rx="1.7" fill="var(--fb-on-accent)" />
      <rect x="8" y="20.1" width="7" height="3.4" rx="1.7" fill="var(--fb-on-accent)" />
      <circle cx="22" cy="21.8" r="2.3" fill="var(--fb-on-accent)" />
    </svg>
  );
}
