import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { DeckStore } from '../core/deck.store';
import { Card, Zone, imageUrl } from '../core/models';
import { Icon } from '../shared/icon';
@Component({ selector: 'app-deck-panel', imports: [Icon, DecimalPipe], templateUrl: './deck-panel.html', changeDetection: ChangeDetectionStrategy.OnPush })
export class DeckPanel {
  readonly store = inject(DeckStore); readonly zone = input<Zone>('main');
  readonly zoneChange = output<Zone>(); readonly preview = output<Card>(); readonly export = output();
  readonly rows = computed(() => this.store.rows(this.zone()));
  readonly maxCurve = computed(() => Math.max(1, ...this.store.curve())); readonly imageUrl = imageUrl;
  readonly zones: { id: Zone; label: string; max: number }[] = [
    { id: 'main', label: 'Main', max: 40 }, { id: 'runes', label: 'Runes', max: 12 },
    { id: 'battlefields', label: 'Fields', max: 3 }, { id: 'sideboard', label: 'Side', max: 10 },
  ];
  chooseLegend(event: Event): void { this.store.chooseLegend((event.target as HTMLSelectElement).value); }
  chooseChampion(event: Event): void { this.store.chooseChampion((event.target as HTMLSelectElement).value); }
  rename(event: Event): void { this.store.rename((event.target as HTMLInputElement).value); }
  notes(event: Event): void { this.store.notes((event.target as HTMLTextAreaElement).value); }
}
