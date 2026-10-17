import { afterEach, describe, expect, it } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { Table } from 'antd';
import type { ColumnsType } from 'antd/es/table';

import { useColumnVisibility } from '@/components/table/ColumnPicker';
import { renderWithProviders } from './test-utils';

interface Row {
  id: number;
  name: string;
  port: number;
}

const COLUMNS: ColumnsType<Row> = [
  { key: 'name', title: 'Name', dataIndex: 'name' },
  { key: 'port', title: 'Port', dataIndex: 'port' },
];

function Harness() {
  const { columns, picker } = useColumnVisibility('test-table', COLUMNS, ['name']);
  return (
    <>
      {picker}
      <Table<Row>
        rowKey="id"
        columns={columns}
        dataSource={[{ id: 1, name: 'alpha', port: 443 }]}
      />
    </>
  );
}

afterEach(() => localStorage.clear());

describe('useColumnVisibility', () => {
  // Wide tables overflowed sideways with no way to drop columns an operator never reads.
  it('hides a column, remembers it, and keeps locked columns', async () => {
    const view = renderWithProviders(<Harness />);
    expect(screen.getByRole('columnheader', { name: 'Port' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Columns' }));
    fireEvent.click(await screen.findByRole('checkbox', { name: 'Port' }));

    expect(screen.queryByRole('columnheader', { name: 'Port' })).toBeNull();
    expect((screen.getByRole('checkbox', { name: 'Name' }) as HTMLInputElement).disabled).toBe(
      true,
    );
    view.unmount();

    renderWithProviders(<Harness />);
    expect(screen.queryByRole('columnheader', { name: 'Port' })).toBeNull();
    expect(screen.getByRole('columnheader', { name: 'Name' })).toBeTruthy();
  });
});
