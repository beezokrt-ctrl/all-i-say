import { shellView, feedView, optionView, bridgeView } from './views.js';
import { getArchive, createUtterance, on } from './archive.js';
import { createLegacyUtteranceEntry } from './legacy.js';

class AllISayApp {
  constructor(root) {
    this.root = root;
    this.entries = [];
    this.route = 'home';
  }

  async init() {
    const archive = await getArchive();
    const seed = await archive.listUtterances({ status: 'kept', limit: Infinity });
    this.entries = seed.length ? seed : await this.seed();
    on('utterance:created', () => this.refreshFromArchive());
  }

  async seed() {
    const archive = await getArchive();
    const fallback = [
      { id: 'seed-1', text: 'The true weight of water is that it is there.', date: 'Earlier', threads: ['Is', 'Jala Yāna'], kind: 'statement' },
      { id: 'seed-2', text: 'No cause cares what it causes and no effect cares what caused it.', date: 'Earlier', threads: ['Undir Sólu', 'causality'], kind: 'statement' },
      { id: 'seed-3', text: 'I am caused, yet I cause.', date: 'Earlier', threads: ['sovereignty', 'causality'], kind: 'statement' }
    ];

    for (const item of fallback) {
      await createLegacyUtteranceEntry(item);
    }
    return archive.listUtterances({ status: 'kept', limit: Infinity });
  }

  async refreshFromArchive() {
    const archive = await getArchive();
    this.entries = await archive.listUtterances({ status: 'kept', limit: Infinity });
    this.refreshDataViews();
  }

  mount() {
    this.root.innerHTML = shellView(this.entries);
    this.bind();
    this.refreshDataViews();
  }

  bind() {
    this.root.addEventListener('click', event => {
      const route = event.target.closest('[data-route]')?.dataset.route;
      if (route) this.navigate(route);
      if (event.target.id === 'saveEntry') this.saveEntry();
      if (event.target.id === 'newDrift') this.renderDrift();
    });
    this.root.addEventListener('change', event => {
      if (event.target.matches('#betweenA,#betweenB')) this.renderBetween();
    });
  }

  navigate(route) {
    this.route = route;
    document.querySelectorAll('.panel').forEach(el => el.classList.toggle('is-active', el.id === route));
    document.querySelectorAll('.nav-button').forEach(el => el.classList.toggle('is-active', el.dataset.route === route));
    window.scrollTo({ top: 0, behavior: 'instant' });
    if (route === 'drift') this.renderDrift();
    if (route === 'between') this.renderBetween();
  }

  async saveEntry() {
    const input = document.querySelector('#entryText');
    if (!input?.value.trim()) return;

    await createLegacyUtteranceEntry({
      text: input.value,
      date: new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }),
      threads: ['Unplaced'],
      kind: 'statement',
      source: { type: 'typed' }
    });

    input.value = '';
    await this.refreshFromArchive();
    this.navigate('home');
  }

  refreshDataViews() {
    if (!this.entries.length) {
      document.querySelector('#count').textContent = '0 positions';
      document.querySelector('#feed').innerHTML = feedView(this.entries);
      return;
    }
    document.querySelector('#count').textContent = `${this.entries.length} positions`;
    document.querySelector('#feed').innerHTML = feedView(this.entries);
    const a = document.querySelector('#betweenA');
    const b = document.querySelector('#betweenB');
    if (a && b) {
      a.innerHTML = optionView(this.entries, 0);
      b.innerHTML = optionView(this.entries, Math.max(0, this.entries.length - 1));
      this.renderBetween();
    }
  }

  renderDrift() {
    if (!this.entries.length) return;
    const entry = this.entries[Math.floor(Math.random() * this.entries.length)];
    document.querySelector('#driftQuote').textContent = entry.text;
    document.querySelector('#driftMeta').textContent = `${entry.displayDate || 'Undated'} · ${(entry.metadata?.threads || ['Unplaced']).join(' · ')}`;
  }

  renderBetween() {
    if (!this.entries.length) return;
    const ai = Number(document.querySelector('#betweenA')?.value || 0);
    const bi = Number(document.querySelector('#betweenB')?.value || 0);
    document.querySelector('#bridge').innerHTML = bridgeView(this.entries[ai], this.entries[bi]);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', async () => {
    const app = new AllISayApp(document.querySelector('#app'));
    await app.init();
    app.mount();
  });
} else {
  const app = new AllISayApp(document.querySelector('#app'));
  app.init().then(() => app.mount());
}
