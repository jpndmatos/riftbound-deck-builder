import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { CatalogService } from './catalog.service';
import { Card, Deck, DeckRow, Zone, ZONES, countZone, emptyDeck, fitsLegend } from './models';
import { validateDeck } from './deck-rules';

const STORAGE = 'riftbound-workbench-v1';
@Injectable({ providedIn: 'root' })
export class DeckStore {
  readonly catalog = inject(CatalogService);
  readonly draft = signal<Deck>(emptyDeck());
  readonly saved = signal<Deck[]>([]);
  readonly notice = signal('');
  readonly storageError = signal('');
  private readonly past = signal<Deck[]>([]);
  private readonly future = signal<Deck[]>([]);
  private initialized = false;
  readonly canUndo = computed(() => this.past().length > 0);
  readonly canRedo = computed(() => this.future().length > 0);
  readonly legend = computed(() => this.catalog.byId().get(this.draft().legend ?? ''));
  readonly champion = computed(() => this.catalog.byId().get(this.draft().champion ?? ''));
  readonly champions = computed(() => this.catalog.cards().filter((c) => c.championUnit && c.champion === this.legend()?.champion));
  readonly checks = computed(() => validateDeck(this.draft(), this.catalog.byId()));
  readonly issues = computed(() => this.checks().filter((check) => !check.pass));
  readonly total = computed(() => countZone(this.draft(), 'main'));
  readonly curve = computed(() => {
    const bins = Array.from({ length: 8 }, () => 0);
    for (const row of this.rows('main')) bins[Math.min(row.card.energy ?? 0, 7)]! += row.quantity;
    return bins;
  });
  readonly average = computed(() => this.total() ? this.rows('main').reduce((n, row) => n+(row.card.energy ?? 0)*row.quantity, 0)/this.total() : 0);
  readonly dirty = computed(() => {
    const current = this.draft(), stored = this.saved().find((deck) => deck.id === current.id);
    return !stored || JSON.stringify(stored) !== JSON.stringify(current);
  });
  constructor() {
    effect(() => {
      if (this.catalog.state() !== 'ready' || this.initialized) return;
      this.initialized = true;
      try {
        const raw = localStorage.getItem(STORAGE);
        if (raw) {
          const parsed = JSON.parse(raw) as { draft?: Deck; saved?: Deck[] };
          if (this.restorable(parsed.draft)) this.draft.set(parsed.draft!);
          this.saved.set((parsed.saved ?? []).filter((deck) => this.restorable(deck)).slice(0, 60));
          if (this.restorable(parsed.draft)) return;
        }
      } catch { this.storageError.set('Browser storage is unavailable. Export a JSON backup before leaving.'); }
      this.draft.set(this.example());
    });
    effect((cleanup) => {
      const draft = this.draft(), saved = this.saved();
      if (!this.initialized) return;
      const timer = setTimeout(() => {
        try { localStorage.setItem(STORAGE, JSON.stringify({ draft, saved })); }
        catch { this.storageError.set('Could not save in this browser. Export a JSON backup.'); }
      }, 250);
      cleanup(() => clearTimeout(timer));
    });
  }
  private restorable(deck: Deck | undefined): deck is Deck {
    return !!deck && typeof deck.id === 'string' && typeof deck.name === 'string' && typeof deck.notes === 'string' &&
      ZONES.every((zone) => deck.zones?.[zone] && typeof deck.zones[zone] === 'object' &&
        Object.entries(deck.zones[zone]).every(([id, n]) => this.catalog.byId().has(id) && Number.isInteger(n) && n > 0 && n <= 40));
  }
  rows(zone: Zone): DeckRow[] {
    const byId = this.catalog.byId();
    return Object.entries(this.draft().zones[zone]).flatMap(([id, quantity]) => {
      const card = byId.get(id); return card ? [{ card, quantity }] : [];
    }).sort((a, b) => (a.card.energy ?? 0)-(b.card.energy ?? 0) || a.card.name.localeCompare(b.card.name));
  }
  count(zone: Zone): number { return countZone(this.draft(), zone); }
  quantity(card: Card, zone: Zone): number { return this.draft().zones[zone][card.id] ?? 0; }
  private commit(next: Deck): void {
    this.past.update((history) => [...history.slice(-39), this.draft()]);
    this.future.set([]); this.draft.set({ ...next, updatedAt: new Date().toISOString() }); this.notice.set('');
  }
  undo(): void { const previous = this.past().at(-1); if (!previous) return;
    this.future.update((history) => [...history, this.draft()]); this.past.update((history) => history.slice(0, -1)); this.draft.set(previous); }
  redo(): void { const next = this.future().at(-1); if (!next) return;
    this.past.update((history) => [...history, this.draft()]); this.future.update((history) => history.slice(0, -1)); this.draft.set(next); }
  rename(name: string): void { if (name.trim() && name !== this.draft().name) this.commit({ ...this.draft(), name: name.trim().slice(0, 80) }); }
  notes(notes: string): void { if (notes !== this.draft().notes) this.commit({ ...this.draft(), notes: notes.slice(0, 4000) }); }
  chooseLegend(id: string): void {
    const card = this.catalog.byId().get(id); if (id && card?.type !== 'legend') return;
    const champion = this.champion();
    this.commit({ ...this.draft(), legend: id || null, champion: champion?.champion === card?.champion ? champion?.id ?? null : null });
  }
  chooseChampion(id: string): void {
    const card = this.catalog.byId().get(id);
    if (!id) { this.commit({ ...this.draft(), champion: null }); return; }
    if (!card?.championUnit || card.champion !== this.legend()?.champion) return;
    const draft = structuredClone(this.draft());
    if (!draft.zones.main[id] && countZone(draft, 'main') >= 40) { this.notice.set('Remove a main-deck card before choosing this champion.'); return; }
    draft.champion = id; draft.zones.main[id] = Math.max(1, draft.zones.main[id] ?? 0); this.commit(draft);
  }
  addReason(card: Card, zone: Zone): string {
    if (card.type === 'legend') return '';
    const actual = card.type === 'rune' ? 'runes' : card.type === 'battlefield' ? 'battlefields' : zone === 'sideboard' ? 'sideboard' : 'main';
    if (card.banned) return 'Banned in Constructed.';
    if (!fitsLegend(card, this.legend())) return 'This card is outside your legend’s domains.';
    if (card.signature && card.champion !== this.legend()?.champion) return 'Signature cards must match your legend.';
    const cap = { main: 40, runes: 12, battlefields: 3, sideboard: 10 }[actual];
    if (this.count(actual) >= cap) return `${actual === 'main' ? 'Main deck' : actual} is full.`;
    if (actual === 'battlefields' && this.quantity(card, actual)) return 'Battlefields must have different names.';
    if (actual === 'main' || actual === 'sideboard') {
      const named = [...this.rows('main'), ...this.rows('sideboard')].filter((row) => row.card.name === card.name).reduce((n, row) => n+row.quantity, 0);
      if (named >= 3) return 'Maximum 3 copies across main deck and sideboard.';
      if (card.signature && [...this.rows('main'), ...this.rows('sideboard')].filter((row) => row.card.signature).reduce((n, row) => n+row.quantity, 0) >= 3) return 'Maximum 3 signature cards.';
    }
    return '';
  }
  add(card: Card, zone: Zone = 'main'): void {
    if (card.type === 'legend') { this.chooseLegend(card.id); return; }
    const reason = this.addReason(card, zone); if (reason) { this.notice.set(reason); return; }
    const actual: Zone = card.type === 'rune' ? 'runes' : card.type === 'battlefield' ? 'battlefields' : zone === 'sideboard' ? zone : 'main';
    const draft = structuredClone(this.draft()); draft.zones[actual][card.id] = (draft.zones[actual][card.id] ?? 0)+1; this.commit(draft);
  }
  remove(card: Card, zone: Zone): void {
    const draft = structuredClone(this.draft()), quantity = draft.zones[zone][card.id] ?? 0;
    if (!quantity) return;
    if (quantity === 1) { delete draft.zones[zone][card.id]; if (zone === 'main' && draft.champion === card.id) draft.champion = null; }
    else draft.zones[zone][card.id] = quantity-1;
    this.commit(draft);
  }
  replace(deck: Deck): void { this.commit(structuredClone(deck)); }
  newDeck(): void { this.commit(emptyDeck()); }
  save(): void {
    const draft = structuredClone(this.draft());
    this.saved.update((decks) => [draft, ...decks.filter((deck) => deck.id !== draft.id)].slice(0, 60));
  }
  duplicate(deck = this.draft()): void { this.commit({ ...structuredClone(deck), id: crypto.randomUUID(), name: `${deck.name.slice(0, 70)} copy` }); }
  delete(id: string): void { this.saved.update((decks) => decks.filter((deck) => deck.id !== id)); }
  example(): Deck {
    const cards = this.catalog.cards(), legend = cards.find((c) => c.type === 'legend' && c.name === 'Loose Cannon');
    const champion = cards.find((c) => c.name === 'Jinx, Demolitionist' && c.championUnit);
    const draft = emptyDeck('Jinx practice');
    if (!legend || !champion) return draft;
    draft.legend = legend.id; draft.champion = champion.id; draft.zones.main[champion.id] = 3;
    const candidates = cards.filter((c) => ['unit', 'spell', 'gear'].includes(c.type) && fitsLegend(c, legend) && !c.banned && !c.signature && c.id !== champion.id && (c.energy ?? 0) <= 5);
    candidates.sort((a, b) => a.name.localeCompare(b.name));
    for (const card of candidates) { const remaining = 40-countZone(draft, 'main'); if (!remaining) break; draft.zones.main[card.id] = Math.min(3, remaining); }
    for (const domain of legend.domains) {
      const rune = cards.find((c) => c.type === 'rune' && c.domains.length === 1 && c.domains[0] === domain);
      if (rune) draft.zones.runes[rune.id] = 6;
    }
    for (const card of cards.filter((c) => c.type === 'battlefield' && fitsLegend(c, legend) && !c.banned).slice(0, 3)) draft.zones.battlefields[card.id] = 1;
    draft.notes = 'Practice list for trying the builder. Adjust the cards and rune split before playing.';
    return draft;
  }
}
