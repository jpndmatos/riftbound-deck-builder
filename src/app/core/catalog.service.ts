import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Catalog } from './models';
import { CATALOG_URL } from './catalog-version';

@Injectable({ providedIn: 'root' })
export class CatalogService {
  private readonly http = inject(HttpClient);
  readonly data = signal<Catalog | null>(null);
  readonly state = signal<'loading' | 'ready' | 'error'>('loading');
  readonly cards = computed(() => this.data()?.cards ?? []);
  readonly byId = computed(() => new Map(this.cards().map((card) => [card.id, card])));
  readonly legends = computed(() => this.cards().filter((card) => card.type === 'legend'));
  constructor() {
    this.load();
  }
  load(): void {
    this.state.set('loading');
    this.http.get<Catalog>(CATALOG_URL).subscribe({
      next: (data) => {
        this.data.set(data);
        this.state.set('ready');
      },
      error: () => this.state.set('error'),
    });
  }
}
