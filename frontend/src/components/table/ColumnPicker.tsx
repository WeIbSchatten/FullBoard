import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Checkbox, Popover, Tooltip } from 'antd';
import { InsertRowRightOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';

import { fitColumns } from './fitColumns';
import './ColumnPicker.css';

export interface ColumnFit {
  width: number;
  collapseOrder: string[];
  reserved?: number;
}

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
// With `fit`, columns in its collapse order also drop out while the table is wider than its card.
export function useColumnVisibility<T>(
  storageKey: string,
  columns: ColumnsType<T>,
  locked: string[] = [],
  fit?: ColumnFit,
): { columns: ColumnsType<T>; picker: ReactNode; scrollX: number } {
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
  const fitted = useMemo(
    () => fitColumns(visibleColumns, fit?.width ?? 0, fit?.collapseOrder ?? [], fit?.reserved),
    [visibleColumns, fit?.width, fit?.collapseOrder, fit?.reserved],
  );

  const content = (
    <div className="column-picker">
      {choosable.map((c) => {
        const key = columnKey(c);
        const isLocked = locked.includes(key);
        const noRoom = fitted.collapsed.includes(key);
        const box = (
          <Checkbox
            key={key}
            checked={isLocked || (!hidden.includes(key) && !noRoom)}
            disabled={isLocked || noRoom}
            onChange={(e) =>
              update(e.target.checked ? hidden.filter((k) => k !== key) : [...hidden, key])
            }
          >
            {c.title as ReactNode}
          </Checkbox>
        );
        return noRoom ? (
          <Tooltip key={key} title={t('tableColumnsNoRoom')} placement="left">
            {box}
          </Tooltip>
        ) : (
          box
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

  return { columns: fitted.columns, picker, scrollX: fitted.scrollX };
}
