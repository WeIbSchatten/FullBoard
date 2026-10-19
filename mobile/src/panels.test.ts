import { addPanel, parseStored, removePanel, type PanelsState } from './panels';

const empty: PanelsState = { panels: [], activeId: null };

describe('panels state', () => {
  it('adds a panel, makes it active and names it after its host by default', () => {
    const s = addPanel(empty, { baseUrl: 'https://p1.example.com:2053/abc', token: 't1', name: '' }, 'id1');
    expect(s).toEqual({
      panels: [{ id: 'id1', name: 'p1.example.com', baseUrl: 'https://p1.example.com:2053/abc', token: 't1' }],
      activeId: 'id1',
    });
  });

  it('re-adding the same address replaces its token instead of duplicating it', () => {
    let s = addPanel(empty, { baseUrl: 'https://p1.example.com/abc', token: 'old', name: 'EU' }, 'id1');
    s = addPanel(s, { baseUrl: 'https://p1.example.com/abc', token: 'new', name: '' }, 'id2');
    expect(s.panels).toEqual([{ id: 'id1', name: 'EU', baseUrl: 'https://p1.example.com/abc', token: 'new' }]);
    expect(s.activeId).toBe('id1');
  });

  it('removing the active panel switches to the next one, or to none', () => {
    let s = addPanel(empty, { baseUrl: 'https://a.example.com', token: 'a', name: '' }, 'a');
    s = addPanel(s, { baseUrl: 'https://b.example.com', token: 'b', name: '' }, 'b');
    s = removePanel(s, 'b');
    expect(s.activeId).toBe('a');
    s = removePanel(s, 'a');
    expect(s).toEqual(empty);
  });

  it('migrates the single session stored by the first app version', () => {
    const legacy = JSON.stringify({ baseUrl: 'https://old.example.com/x', token: 'tok' });
    const s = parseStored(null, legacy);
    expect(s.panels).toHaveLength(1);
    expect(s.panels[0]).toMatchObject({ baseUrl: 'https://old.example.com/x', token: 'tok', name: 'old.example.com' });
    expect(s.activeId).toBe(s.panels[0].id);
  });
});
