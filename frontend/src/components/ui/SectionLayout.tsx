import type { ReactNode } from 'react';

import SectionNav, { type SectionNavItem } from './SectionNav';

interface SectionLayoutProps {
  items: SectionNavItem[];
  active: string;
  onChange: (key: string) => void;
  ariaLabel?: string;
  children: ReactNode;
}

// Section switcher as a sticky left column on desktop, a scrollable strip on
// narrow screens, so a page never stacks two horizontal tab rows.
export default function SectionLayout({
  items,
  active,
  onChange,
  ariaLabel,
  children,
}: SectionLayoutProps) {
  return (
    <div className="fb-section-layout">
      <SectionNav items={items} active={active} onChange={onChange} ariaLabel={ariaLabel} />
      <div className="fb-section-body">{children}</div>
    </div>
  );
}
