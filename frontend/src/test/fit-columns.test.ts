import { describe, expect, it } from 'vitest';
import type { ColumnsType } from 'antd/es/table';

import { fitColumns } from '@/components/table/fitColumns';

interface Row {
  id: number;
}

const COLUMNS: ColumnsType<Row> = [
  { key: 'drag', width: 40 },
  { key: 'email', title: 'Client', width: 200 },
  { key: 'group', title: 'Group', width: 120 },
  { key: 'traffic', title: 'Traffic', width: 240 },
  { key: 'speed', title: 'Speed', width: 120 },
  { key: 'remaining', title: 'Remaining', width: 100 },
];
const ORDER = ['drag', 'remaining', 'group'];

function hiddenKeys(columns: ColumnsType<Row>): string[] {
  return columns.filter((c) => c.hidden).map((c) => String(c.key));
}

describe('fitColumns', () => {
  // The clients table overflowed its card sideways and clipped the speed column on narrow windows.
  it('keeps every column and sizes the scroll to them when the card is wide enough', () => {
    const fit = fitColumns(COLUMNS, 900, ORDER, 32);
    expect(fit.collapsed).toEqual([]);
    expect(hiddenKeys(fit.columns)).toEqual([]);
    expect(fit.scrollX).toBe(852);
  });

  it('drops columns in collapse order until the rest fit the card', () => {
    const fit = fitColumns(COLUMNS, 720, ORDER, 32);
    expect(fit.collapsed).toEqual(['drag', 'remaining']);
    expect(hiddenKeys(fit.columns)).toEqual(['drag', 'remaining']);
    expect(fit.scrollX).toBe(712);
  });

  it('skips columns the user already hid and stops when the order runs out', () => {
    const userHidden = COLUMNS.map((c) => (c.key === 'remaining' ? { ...c, hidden: true } : c));
    const fit = fitColumns(userHidden, 300, ORDER, 32);
    expect(fit.collapsed).toEqual(['drag', 'group']);
    expect(hiddenKeys(fit.columns)).toEqual(['drag', 'group', 'remaining']);
    expect(fit.scrollX).toBe(592);
  });

  it('does not collapse anything before the card width is known', () => {
    const fit = fitColumns(COLUMNS, 0, ORDER, 32);
    expect(fit.collapsed).toEqual([]);
    expect(fit.scrollX).toBe(852);
  });
});
