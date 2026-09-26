import { APP_CONFIG } from './config.js';
import { getArchive } from '../services/archive.js';
import { seedArchiveIfEmpty } from '../services/seed.js';
import { shellView, feedView, optionView, bridgeView } from './views.js';

class AllISayApp {
  constructor(root) {
    this.root = root;
    this.entries = [];
    this.route = 'home';
  }

  async init() {
    // Initialize IndexedDB and populate with seed data if empty
    await seedArchiveIfEmpty();
    this.entries = await this.loadEntries();
  }

  async loadEntries() {
    return getArchive().then(archive => archive.listUtterances({ status: 'kept', limit: Infinity }));
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
    const { createUtterance } = await import('../services/archive.js');
    const newUtterance = await createUtterance({
      text: input.value,
      metadata: { form: 'fragment', threads: ['Unplaced'], status: 'kept' },
      source: { type: 'typed' }
    });
    input.value = '';
    this.entries = await this.loadEntries();
    this.refreshDataViews();
    this.navigate('home');
  }

  refreshDataViews() {
    document.querySelector('#count').textContent = `${this.entries.length} positions`;
    document.querySelector('#feed').innerHTML = feedView(this.entries);
    const a = document.querySelector('#betweenA');
    const b = document.querySelector('#betweenB');
    a.innerHTML = optionView(this.entries, 0);
    b.innerHTML = optionView(this.entries, Math.max(0, this.entries.length - 1));
    this.renderBetween();
  }

  renderDrift() {
    if (!this.entries.length) return;
    const entry = this.entries[Math.floor(Math.random() * this.entries.length)];
    document.querySelector('#driftQuote').textContent = entry.text;
    document.querySelector('#driftMeta').textContent = `${entry.displayDate || entry.date || 'Undated'} · ${(entry.metadata?.threads || ['Unplaced']).join(' · ')}`;
  }

  renderBetween() {
    if (!this.entries.length) return;
    const ai = Number(document.querySelector('#betweenA')?.value || 0);
    const bi = Number(document.querySelector('#betweenB')?.value || 0);
    document.querySelector('#bridge').innerHTML = bridgeView(this.entries[ai], this.entries[bi]);
  }
}

// Initialize and mount when DOM is ready
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
