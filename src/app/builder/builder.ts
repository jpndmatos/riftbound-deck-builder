import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { debounceTime, startWith } from 'rxjs';
import { DeckStore } from '../core/deck.store';
import { Card, DOMAINS, Zone, fitsLegend, imageUrl } from '../core/models';
import { Icon } from '../shared/icon';
import { CardPreview } from '../shared/card-preview';
import { TransferDialog } from '../shared/transfer-dialog';
import { DeckPanel } from './deck-panel';

@Component({
  selector: 'app-builder',
  imports: [ReactiveFormsModule, Icon, CardPreview, TransferDialog, DeckPanel],
  templateUrl: './builder.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Builder {
  readonly store = inject(DeckStore);
  readonly catalog = this.store.catalog;
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  readonly form = new FormGroup({
    q: new FormControl(this.route.snapshot.queryParamMap.get('q') ?? '', { nonNullable: true }),
    type: new FormControl(this.route.snapshot.queryParamMap.get('type') ?? 'all', {
      nonNullable: true,
    }),
    domain: new FormControl(this.route.snapshot.queryParamMap.get('domain') ?? 'all', {
      nonNullable: true,
    }),
    set: new FormControl(this.route.snapshot.queryParamMap.get('set') ?? 'all', {
      nonNullable: true,
    }),
    sort: new FormControl(this.route.snapshot.queryParamMap.get('sort') ?? 'name', {
      nonNullable: true,
    }),
    compatible: new FormControl(this.route.snapshot.queryParamMap.get('compatible') !== 'false', {
      nonNullable: true,
    }),
  });
  readonly filter = toSignal(
    this.form.valueChanges.pipe(startWith(this.form.getRawValue()), debounceTime(90)),
    { initialValue: this.form.getRawValue() },
  );
  readonly zone = signal<Zone>('main');
  readonly view = signal<'grid' | 'list'>(
    this.route.snapshot.queryParamMap.get('view') === 'list' ? 'list' : 'grid',
  );
  readonly mobileView = signal<'cards' | 'deck'>('cards');
  readonly filtersOpen = signal(false);
  readonly preview = signal<Card | null>(null);
  readonly transfer = signal<'import' | 'export' | null>(null);
  readonly page = signal(Math.max(1, Number(this.route.snapshot.queryParamMap.get('page')) || 1));
  readonly pageSize = 24;
  readonly domains = DOMAINS;
  readonly imageUrl = imageUrl;
  private filterKey = '';
  readonly types = ['all', 'unit', 'spell', 'gear', 'legend', 'rune', 'battlefield'];
  readonly indexed = computed(() =>
    this.catalog.cards().map((card) => ({
      card,
      search: `${card.name} ${card.text} ${card.code} ${card.champion ?? ''}`.toLowerCase(),
    })),
  );
  readonly filtered = computed(() => {
    const filter = this.filter(),
      words = (filter.q ?? '').toLowerCase().trim().split(/\s+/).filter(Boolean);
    const legend = this.store.legend();
    const cards = this.indexed()
      .filter(
        ({ card, search }) =>
          words.every((word) => search.includes(word)) &&
          (filter.type === 'all' || card.type === filter.type) &&
          (filter.domain === 'all' || card.domains.includes(filter.domain ?? '')) &&
          (filter.set === 'all' || card.set === filter.set) &&
          (!filter.compatible || card.type === 'legend' || fitsLegend(card, legend)),
      )
      .map(({ card }) => card);
    return cards.sort((a, b) =>
      filter.sort === 'energy'
        ? (a.energy ?? 0) - (b.energy ?? 0) || a.name.localeCompare(b.name)
        : a.name.localeCompare(b.name),
    );
  });
  readonly pageCount = computed(() =>
    Math.max(1, Math.ceil(this.filtered().length / this.pageSize)),
  );
  readonly visible = computed(() =>
    this.filtered().slice((this.page() - 1) * this.pageSize, this.page() * this.pageSize),
  );
  constructor() {
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const values = {
        q: params.get('q') ?? '',
        type: params.get('type') ?? 'all',
        domain: params.get('domain') ?? 'all',
        set: params.get('set') ?? 'all',
        sort: params.get('sort') ?? 'name',
        compatible: params.get('compatible') !== 'false',
      };
      if (JSON.stringify(values) !== JSON.stringify(this.form.getRawValue()))
        this.form.patchValue(values);
      this.view.set(params.get('view') === 'list' ? 'list' : 'grid');
      this.page.set(Math.max(1, Number(params.get('page')) || 1));
    });
    effect(() => {
      const filter = this.filter(),
        view = this.view(),
        page = this.page();
      void this.router.navigate([], {
        relativeTo: this.route,
        replaceUrl: true,
        queryParams: {
          q: filter.q || null,
          type: filter.type === 'all' ? null : filter.type,
          domain: filter.domain === 'all' ? null : filter.domain,
          set: filter.set === 'all' ? null : filter.set,
          sort: filter.sort === 'name' ? null : filter.sort,
          compatible: filter.compatible ? null : 'false',
          view: view === 'grid' ? null : view,
          page: page === 1 ? null : page,
        },
      });
    });
    effect(() => {
      if (this.catalog.state() !== 'ready') return;
      const key = JSON.stringify(this.filter()) + (this.store.legend()?.id ?? '');
      if (this.filterKey && key !== this.filterKey) this.page.set(1);
      this.filterKey = key;
      if (this.page() > this.pageCount()) this.page.set(this.pageCount());
    });
  }
  reset(): void {
    this.form.setValue({
      q: '',
      type: 'all',
      domain: 'all',
      set: 'all',
      sort: 'name',
      compatible: true,
    });
  }
  selectZone(zone: Zone): void {
    this.zone.set(zone);
    this.form.controls.type.setValue(
      zone === 'runes' ? 'rune' : zone === 'battlefields' ? 'battlefield' : 'all',
    );
  }
  quantity(card: Card): number {
    return this.store.quantity(
      card,
      card.type === 'rune'
        ? 'runes'
        : card.type === 'battlefield'
          ? 'battlefields'
          : this.zone() === 'sideboard'
            ? 'sideboard'
            : 'main',
    );
  }
  remove(card: Card): void {
    this.store.remove(
      card,
      card.type === 'rune'
        ? 'runes'
        : card.type === 'battlefield'
          ? 'battlefields'
          : this.zone() === 'sideboard'
            ? 'sideboard'
            : 'main',
    );
  }
  importDeck(): void {
    this.transfer.set('import');
  }
  newDeck(): void {
    this.store.newDeck();
    this.reset();
    this.mobileView.set('deck');
  }
  imageError(event: Event): void {
    const image = event.target as HTMLImageElement;
    image.hidden = true;
    image.parentElement?.classList.add('image-unavailable');
  }
}
