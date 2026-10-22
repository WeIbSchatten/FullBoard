import type { ColumnsType } from 'antd/es/table';

export interface FittedColumns<T> {
  columns: ColumnsType<T>;
  collapsed: string[];
  scrollX: number;
}

function widthOf<T>(col: ColumnsType<T>[number]): number {
  return !col.hidden && typeof col.width === 'number' ? col.width : 0;
}

// Hides columns in `collapseOrder` until the rest fit `available` px; `reserved` covers
// columns antd adds itself (row selection). An unknown width (0) collapses nothing.
export function fitColumns<T>(
  columns: ColumnsType<T>,
  available: number,
  collapseOrder: string[],
  reserved = 0,
): FittedColumns<T> {
  let total = reserved + columns.reduce((sum, c) => sum + widthOf(c), 0);
  const collapsed: string[] = [];
  if (available > 0) {
    for (const key of collapseOrder) {
      if (total <= available) break;
      const col = columns.find((c) => String(c.key) === key);
      if (!col || col.hidden) continue;
      collapsed.push(key);
      total -= widthOf(col);
    }
  }
  return {
    columns: collapsed.length
      ? columns.map((c) => (collapsed.includes(String(c.key)) ? { ...c, hidden: true } : c))
      : columns,
    collapsed,
    scrollX: total,
  };
}
