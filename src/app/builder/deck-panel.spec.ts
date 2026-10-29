import { describe, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import catalog from '../../../public/data/cards.json';
import { DeckPanel } from './deck-panel';
import { DeckStore } from '../core/deck.store';
import { CATALOG_URL } from '../core/catalog-version';
describe('Deck setup controls', () => {
  it('shows selected identities when options arrive after the controls are mounted', () => {
    localStorage.clear();
    TestBed.configureTestingModule({
      imports: [DeckPanel],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    const fixture = TestBed.createComponent(DeckPanel);
    fixture.detectChanges();
    TestBed.inject(HttpTestingController).expectOne(CATALOG_URL).flush(catalog);
    TestBed.tick();
    fixture.detectChanges();
    const store = TestBed.inject(DeckStore);
    const legend = fixture.nativeElement.querySelector('#legend-select') as HTMLSelectElement;
    const champion = fixture.nativeElement.querySelector('#champion-select') as HTMLSelectElement;
    expect(legend.value).toBe(store.draft().legend);
    expect(champion.value).toBe(store.draft().champion);
    store.newDeck();
    TestBed.tick();
    fixture.detectChanges();
    expect(legend.value).toBe('');
    expect(champion.disabled).toBe(true);
  });
});
