import { afterEach, describe, expect, it } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { Table } from 'antd';
import type { ColumnsType } from 'antd/es/table';

import { useColumnVisibility, type ColumnFit } from '@/components/table/ColumnPicker';
import { renderWithProviders } from './test-utils';

interface Row {
  id: number;
  name: string;
  port: number;
}

const COLUMNS: ColumnsType<Row> = [
  { key: 'name', title: 'Name', dataIndex: 'name', width: 200 },
  { key: 'port', title: 'Port', dataIndex: 'port', width: 120 },
];

function Harness({ fit }: { fit?: ColumnFit }) {
  const { columns, picker } = useColumnVisibility('test-table', COLUMNS, ['name'], fit);
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

  // A column dropped for lack of room must not read as shown, or as hidden by the user.
  it('shows a column that does not fit as unchecked and locked until there is room', async () => {
    const fit = { width: 250, collapseOrder: ['port'] };
    const view = renderWithProviders(<Harness fit={fit} />);
    expect(screen.queryByRole('columnheader', { name: 'Port' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Columns' }));
    const port = (await screen.findByRole('checkbox', { name: 'Port' })) as HTMLInputElement;
    expect(port.checked).toBe(false);
    expect(port.disabled).toBe(true);

    view.rerender(<Harness fit={{ ...fit, width: 400 }} />);
    expect(screen.getByRole('columnheader', { name: 'Port' })).toBeTruthy();
  });
});
