import { DomainIcon } from '../shared/domain-icon';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
} from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DecimalPipe } from '@angular/common';
import { DeckStore } from '../core/deck.store';
import { Card, Zone, imageUrl } from '../core/models';
import { Icon } from '../shared/icon';
@Component({
  selector: 'app-deck-panel',
  imports: [DomainIcon, Icon, DecimalPipe, ReactiveFormsModule],
  templateUrl: './deck-panel.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DeckPanel {
  readonly store = inject(DeckStore);
  readonly zone = input<Zone>('main');
  readonly zoneChange = output<Zone>();
  readonly preview = output<Card>();
  readonly export = output();
  readonly rows = computed(() => this.store.rows(this.zone()));
  readonly legendControl = new FormControl('', { nonNullable: true });
  readonly championControl = new FormControl('', { nonNullable: true });
  constructor() {
    effect(() => {
      this.legendControl.setValue(this.store.draft().legend ?? '', { emitEvent: false });
      this.championControl.setValue(this.store.draft().champion ?? '', { emitEvent: false });
      if (this.store.legend()) this.championControl.enable({ emitEvent: false });
      else this.championControl.disable({ emitEvent: false });
    });
    this.legendControl.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((id) => this.store.chooseLegend(id));
    this.championControl.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((id) => this.store.chooseChampion(id));
  }
  readonly maxCurve = computed(() => Math.max(1, ...this.store.curve()));
  readonly imageUrl = imageUrl;
  readonly zones: { id: Zone; label: string; max: number }[] = [
    { id: 'main', label: 'Main', max: 40 },
    { id: 'runes', label: 'Runes', max: 12 },
    { id: 'battlefields', label: 'Fields', max: 3 },
    { id: 'sideboard', label: 'Side', max: 10 },
  ];
  rename(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.store.rename(input.value);
    input.value = this.store.draft().name;
  }
  notes(event: Event): void {
    this.store.notes((event.target as HTMLTextAreaElement).value);
  }
}
