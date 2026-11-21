import { describe, it, expect } from 'vitest';
import { readFile } from 'node:fs/promises';

const flush = async () => {
  for (let i = 0; i < 30; i++) await new Promise((r) => setTimeout(r, 0));
};

async function loadPage() {
  const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
  const start = html.lastIndexOf('<script>') + '<script>'.length;
  const end = html.indexOf('</script>', start);
  const script = html.slice(start, end);

  const elements = new Map();
  const el = (id) => {
    if (!elements.has(id)) {
      elements.set(id, {
        value: '', innerHTML: '', textContent: '', style: {}, dataset: {},
        classList: { add() {}, remove() {}, toggle() {} },
        setAttribute() {}, onclick: null, onchange: null, oninput: null,
      });
    }
    return elements.get(id);
  };

  const settlementButtons = [{ dataset: { from: 'esha', to: 'aditi', amt: '1200.00' }, onclick: null }];
  const document = {
    getElementById: el,
    querySelectorAll: (selector) => (selector === '#settlements button' ? settlementButtons : []),
  };

  const state = { posts: [], releases: [] };
  const json = (body) => Promise.resolve({ ok: true, status: 200, json: async () => body });
  const group = {
    id: 'goa',
    name: 'Goa trip',
    members: [{ id: 'esha', name: 'Esha' }, { id: 'aditi', name: 'Aditi' }],
    expenses: [],
    balances: { esha: -120000, aditi: 120000 },
    settlements: [{ from: 'esha', to: 'aditi', amountMinor: 120000 }],
  };

  const fetch = (url, options = {}) => {
    if ((options.method ?? 'GET') === 'POST') {
      state.posts.push({ url, body: JSON.parse(options.body) });
      return new Promise((resolve) =>
        state.releases.push(() => resolve({ ok: true, status: 201, json: async () => ({}) })));
    }
    if (url === '/api/groups') return json([{ id: 'goa', name: 'Goa trip', memberCount: 2 }]);
    if (url === '/api/groups/goa') return json(group);
    if (url.startsWith('/api/groups/goa/summary')) return json({ categories: [], members: [] });
    if (url.startsWith('/api/groups/goa/expenses')) return json({ items: [], total: 0, hasMore: false });
    return json({});
  };

  new Function('document', 'fetch', 'window', script)(document, fetch, {});
  await flush();

  return {
    el,
    markPaidButton: settlementButtons[0],
    state,
    flush,
    releaseAll: () => state.releases.splice(0).forEach((release) => release()),
    postsTo: (path) => state.posts.filter((p) => p.url === path),
  };
}

describe('QuikSplit page: double-click guards', () => {
  it('[QP-QUIKSPL-340-1] Second Mark paid click while the first request is in flight sends no second payment', async () => {
    const page = await loadPage();
    const markPaid = page.markPaidButton;
    markPaid.onclick();
    markPaid.onclick();
    await page.flush();
    const payments = page.postsTo('/api/groups/goa/payments');
    expect(payments).toHaveLength(1);
    expect(payments[0].body).toMatchObject({ from: 'esha', to: 'aditi' });
  });

  it('[QP-QUIKSPL-340-2] Second Add expense click while the first request is in flight sends no second expense', async () => {
    const page = await loadPage();
    page.el('desc').value = 'Dinner';
    page.el('amount').value = '1200';
    const add = page.el('add');
    add.onclick();
    add.onclick();
    await page.flush();
    expect(page.postsTo('/api/groups/goa/expenses')).toHaveLength(1);
  });

  it('[QP-QUIKSPL-340-3] Mark paid accepts a click again after the first payment request finishes', async () => {
    const page = await loadPage();
    const markPaid = page.markPaidButton;
    markPaid.onclick();
    await page.flush();
    page.releaseAll();
    await page.flush();
    markPaid.onclick();
    await page.flush();
    expect(page.postsTo('/api/groups/goa/payments')).toHaveLength(2);
  });
});
