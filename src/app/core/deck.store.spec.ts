import { beforeEach, describe, expect, it } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import catalogJson from '../../../public/data/cards.json';
import { Catalog, Card, countZone } from './models';
import { DeckStore } from './deck.store';
import { CATALOG_URL } from './catalog-version';
import { deckText, parseDeckFile, validateDeck } from './deck-rules';

const catalog = catalogJson as Catalog;
describe('Deck builder state and Constructed checks', () => {
  it('preserves champion subtitles without treating region tags or signature owners as names', () => {
    expect(catalog.cards.find((card) => card.name === 'Jinx, Demolitionist')?.championUnit).toBe(
      true,
    );
    expect(catalog.cards.find((card) => card.name === 'Super Mega Death Rocket!')?.signature).toBe(
      true,
    );
    expect(catalog.cards.find((card) => card.name === 'Heart of the Tempest')?.champion).toBe(
      'Kennen',
    );
    expect(
      catalog.cards
        .filter((card) => card.type === 'legend')
        .every((card) => card.champion && card.champion !== 'Yordle'),
    ).toBe(true);
  });
  let store: DeckStore;
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    store = TestBed.inject(DeckStore);
    TestBed.inject(HttpTestingController).expectOne(CATALOG_URL).flush(catalog);
    TestBed.tick();
  });
  it('loads a complete practice deck using real catalog cards', () => {
    expect(store.total()).toBe(40);
    expect(store.count('runes')).toBe(12);
    expect(store.count('battlefields')).toBe(3);
    expect(store.issues()).toEqual([]);
  });
  it('counts the chosen champion in the main deck and enforces named copies across sideboard', () => {
    const legend = store.legend()!,
      champion = store.champion()!;
    store.newDeck();
    store.chooseLegend(legend.id);
    store.chooseChampion(champion.id);
    expect(store.total()).toBe(1);
    store.add(champion);
    store.add(champion);
    store.add(champion);
    expect(store.total()).toBe(3);
    expect(store.addReason(champion, 'sideboard')).toContain('3 copies');
  });
  it('does not silently remove cards when changing legends', () => {
    const next = catalog.cards.find(
      (c) => c.type === 'legend' && c.domains.every((d) => !store.legend()!.domains.includes(d)),
    )!;
    store.chooseLegend(next.id);
    expect(store.total()).toBe(40);
    expect(store.checks().find((c) => c.id === 'domains')?.pass).toBe(false);
  });
  it('undoes a removal and restores the exact prior list', () => {
    const before = structuredClone(store.draft());
    store.remove(store.rows('main')[0]!.card, 'main');
    expect(store.total()).toBe(39);
    store.undo();
    expect(store.draft()).toEqual(before);
    store.redo();
    expect(store.total()).toBe(39);
  });
  it('validates imports atomically and round-trips a JSON backup', () => {
    const file = { format: 'riftbound-deck-builder', version: 1, deck: store.draft() };
    const parsed = parseDeckFile(JSON.stringify(file), store.catalog.byId());
    expect(parsed.id).not.toBe(store.draft().id);
    expect(parsed.zones).toEqual(store.draft().zones);
    const broken = structuredClone(file);
    broken.deck.zones.main['missing-card'] = 3;
    expect(() => parseDeckFile(JSON.stringify(broken), store.catalog.byId())).toThrow(
      'Invalid card',
    );
    expect(store.total()).toBe(40);
    expect(() => parseDeckFile('{', store.catalog.byId())).toThrow();
  });
  it('flags banned cards and signature mismatches even in imported lists', () => {
    const deck = structuredClone(store.draft());
    const banned = catalog.cards.find((c) => c.banned && c.type === 'spell')!;
    const signature = catalog.cards.find(
      (c) => c.signature && c.champion !== store.legend()?.champion,
    )!;
    deck.zones.main[banned.id] = 1;
    deck.zones.sideboard[signature.id] = 1;
    const checks = validateDeck(deck, store.catalog.byId());
    expect(checks.find((c) => c.id === 'banned')?.pass).toBe(false);
    expect(checks.find((c) => c.id === 'signature')?.pass).toBe(false);
  });
  it('saves independent snapshots and exports the complete rune and field sections', () => {
    store.save();
    const saved = structuredClone(store.saved()[0]);
    store.remove(store.rows('main')[0]!.card, 'main');
    expect(store.saved()[0]).toEqual(saved);
    const text = deckText(store.draft(), store.catalog.byId());
    expect(text).toContain('Rune deck (12)');
    expect(text).toContain('Battlefields (3)');
  });
});
