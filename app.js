import { EntryStore } from './store.js';
import { shellView, feedView, optionView, bridgeView } from './views.js';

class AllISayApp {
  constructor(root) {
    this.root = root;
    this.store = new EntryStore();
    this.entries = this.store.load();
    this.route = 'home';
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
    document.querySelectorAll('.panel').forEach(el=>el.classList.toggle('is-active',el.id===route));
    document.querySelectorAll('.nav-button').forEach(el=>el.classList.toggle('is-active',el.dataset.route===route));
    window.scrollTo({top:0,behavior:'instant'});
    if (route==='drift') this.renderDrift();
    if (route==='between') this.renderBetween();
  }

  saveEntry() {
    const input = document.querySelector('#entryText');
    if (!input?.value.trim()) return;
    this.entries = this.store.add(this.entries,{text:input.value});
    input.value = '';
    this.refreshDataViews();
    this.navigate('home');
  }

  refreshDataViews() {
    document.querySelector('#count').textContent = `${this.entries.length} positions`;
    document.querySelector('#feed').innerHTML = feedView(this.entries);
    const a = document.querySelector('#betweenA');
    const b = document.querySelector('#betweenB');
    a.innerHTML = optionView(this.entries,0);
    b.innerHTML = optionView(this.entries,Math.max(0,this.entries.length-1));
    this.renderBetween();
  }

  renderDrift() {
    if (!this.entries.length) return;
    const entry = this.entries[Math.floor(Math.random()*this.entries.length)];
    document.querySelector('#driftQuote').textContent = entry.text;
    document.querySelector('#driftMeta').textContent = `${entry.date||'Undated'} · ${(entry.threads||['Unplaced']).join(' · ')}`;
  }

  renderBetween() {
    if (!this.entries.length) return;
    const ai = Number(document.querySelector('#betweenA')?.value || 0);
    const bi = Number(document.querySelector('#betweenB')?.value || 0);
    document.querySelector('#bridge').innerHTML = bridgeView(this.entries[ai],this.entries[bi]);
  }
}

new AllISayApp(document.querySelector('#app')).mount();
