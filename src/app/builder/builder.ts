import { DomainIcon } from '../shared/domain-icon';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterRenderEffect,
  viewChild,
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
  imports: [DomainIcon, ReactiveFormsModule, Icon, CardPreview, TransferDialog, DeckPanel],
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
  readonly limit = signal(36);
  readonly results = viewChild<ElementRef<HTMLElement>>('results');
  readonly loadMarker = viewChild<ElementRef<HTMLElement>>('loadMarker');
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
  readonly visible = computed(() => this.filtered().slice(0, this.limit()));
  readonly hasMore = computed(() => this.visible().length < this.filtered().length);
  loadMore(): void {
    this.limit.update((limit) => Math.min(limit + 36, this.filtered().length));
  }
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
    });
    effect(() => {
      const filter = this.filter(),
        view = this.view();
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
          page: null,
        },
      });
    });
    effect(() => {
      if (this.catalog.state() !== 'ready') return;
      const key = JSON.stringify(this.filter()) + (this.store.legend()?.id ?? '');
      if (this.filterKey && key !== this.filterKey) this.limit.set(36);
      this.filterKey = key;
    });
    afterRenderEffect(() => {
      this.filter();
      this.view();
      this.store.legend();
      const root = this.results()?.nativeElement;
      if (root) root.scrollTop = 0;
    });
    afterRenderEffect((onCleanup) => {
      const root = this.results()?.nativeElement;
      const marker = this.loadMarker()?.nativeElement;
      this.visible().length;
      this.mobileView();
      if (
        !root ||
        !marker ||
        !this.hasMore() ||
        !root.clientHeight ||
        typeof IntersectionObserver === 'undefined'
      )
        return;
      const observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((entry) => entry.isIntersecting)) this.loadMore();
        },
        { root, rootMargin: '500px 0px' },
      );
      observer.observe(marker);
      onCleanup(() => observer.disconnect());
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
