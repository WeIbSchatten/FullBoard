import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';

import { NodeScopeTabs } from './NodeScopeTabs';

const meta = {
  title: 'Nodes/NodeScopeTabs',
  component: NodeScopeTabs,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Tabs that split the clients and inbounds pages into this panel and each connected node, so a node’s rows and traffic never mix into the local totals. A dot shows whether the node is online.',
      },
    },
  },
  argTypes: {
    tabs: { description: 'One tab per connected node, after the fixed "local panel" tab.' },
    value: { description: '"local" or the id of the node whose tab is open.' },
    onChange: { description: 'Called with "local" or a node id when a tab is picked.' },
  },
  args: { onChange: fn() },
} satisfies Meta<typeof NodeScopeTabs>;

export default meta;

type Story = StoryObj<typeof meta>;

export const LocalOpen: Story = {
  args: {
    value: 'local',
    tabs: [
      { id: 1, name: 'Amsterdam', online: true },
      { id: 2, name: 'Frankfurt', online: false },
    ],
  },
};

export const NodeOpen: Story = {
  args: { ...LocalOpen.args, value: 1 },
};
