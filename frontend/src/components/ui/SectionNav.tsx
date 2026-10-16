import type { ReactNode } from 'react';

export interface SectionNavItem {
  key: string;
  label: ReactNode;
  icon?: ReactNode;
}

interface SectionNavProps {
  items: SectionNavItem[];
  active: string;
  onChange: (key: string) => void;
  ariaLabel?: string;
}

// In-page switcher for hash-addressed sections, so they no longer hide in the sidebar.
export default function SectionNav({ items, active, onChange, ariaLabel }: SectionNavProps) {
  return (
    <nav className="fb-section-nav" aria-label={ariaLabel}>
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          className={`fb-section-nav-item${item.key === active ? ' is-active' : ''}`}
          aria-current={item.key === active ? 'page' : undefined}
          onClick={() => onChange(item.key)}
        >
          {item.icon}
          <span>{item.label}</span>
        </button>
      ))}
    </nav>
  );
}
