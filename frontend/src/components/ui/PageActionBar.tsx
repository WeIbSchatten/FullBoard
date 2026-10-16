import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

interface PageActionBarProps {
  dirty: boolean;
  children: ReactNode;
}

// Sticky save bar for pages that edit a draft and persist it explicitly.
export default function PageActionBar({ dirty, children }: PageActionBarProps) {
  const { t } = useTranslation();
  return (
    <div className="fb-actionbar" role="region" aria-live="polite">
      <div className={`fb-actionbar-status${dirty ? ' is-dirty' : ''}`}>
        <span className="fb-dot" />
        <span>{dirty ? t('pages.settings.unsavedChanges') : t('pages.settings.allSaved')}</span>
      </div>
      <div className="fb-actionbar-actions">{children}</div>
    </div>
  );
}
