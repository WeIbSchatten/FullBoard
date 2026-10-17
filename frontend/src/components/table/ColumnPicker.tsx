import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Checkbox, Popover } from 'antd';
import { InsertRowRightOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';

import './ColumnPicker.css';

const STORAGE_PREFIX = 'fb-columns:';

function readHidden(storageKey: string): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_PREFIX + storageKey) ?? '[]');
    return Array.isArray(raw) ? raw.filter((k): k is string => typeof k === 'string') : [];
  } catch {
    return [];
  }
}

function columnKey<T>(col: ColumnsType<T>[number]): string {
  return String(col.key ?? '');
}

// Per-table column visibility, remembered per browser; `locked` keys always show.
export function useColumnVisibility<T>(
  storageKey: string,
  columns: ColumnsType<T>,
  locked: string[] = [],
): { columns: ColumnsType<T>; picker: ReactNode } {
  const { t } = useTranslation();
  const [hidden, setHidden] = useState<string[]>(() => readHidden(storageKey));

  const update = (next: string[]) => {
    setHidden(next);
    try {
      localStorage.setItem(STORAGE_PREFIX + storageKey, JSON.stringify(next));
    } catch {
      // Storage may be unavailable (private mode); the choice still applies for this visit.
    }
  };

  const choosable = columns.filter((c) => columnKey(c) && c.title && !c.hidden);
  const visibleColumns = useMemo(
    () =>
      columns.map((c) =>
        hidden.includes(columnKey(c)) && !locked.includes(columnKey(c))
          ? { ...c, hidden: true }
          : c,
      ),
    [columns, hidden, locked],
  );

  const content = (
    <div className="column-picker">
      {choosable.map((c) => {
        const key = columnKey(c);
        const isLocked = locked.includes(key);
        return (
          <Checkbox
            key={key}
            checked={isLocked || !hidden.includes(key)}
            disabled={isLocked}
            onChange={(e) =>
              update(e.target.checked ? hidden.filter((k) => k !== key) : [...hidden, key])
            }
          >
            {c.title as ReactNode}
          </Checkbox>
        );
      })}
      {hidden.length > 0 && (
        <Button size="small" type="link" className="column-picker-reset" onClick={() => update([])}>
          {t('tableColumnsShowAll')}
        </Button>
      )}
    </div>
  );

  const picker = (
    <Popover trigger="click" placement="bottomRight" content={content} arrow={false}>
      <Button icon={<InsertRowRightOutlined />} aria-label={t('tableColumns')}>
        {t('tableColumns')}
      </Button>
    </Popover>
  );

  return { columns: visibleColumns, picker };
}
