import { AfterViewInit, ChangeDetectionStrategy, Component, ElementRef, ViewChild, inject, input, output } from '@angular/core';
import { Card, imageUrl } from '../core/models';
import { DeckStore } from '../core/deck.store';
import { Icon } from './icon';
@Component({ selector: 'app-card-preview', imports: [Icon], changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<dialog #dialog class="card-dialog" aria-labelledby="preview-title" (cancel)="close.emit()" (click)="backdrop($event)">
    <button class="icon-button dialog-close" type="button" aria-label="Close card details" (click)="close.emit()"><app-icon name="close" /></button>
    <div class="preview-layout"><img [src]="imageUrl(card(), 600)" [alt]="card().name" width="430" height="600" />
      <div class="preview-copy"><h2 id="preview-title">{{ card().name }}</h2><p class="muted">{{ card().code }} / {{ card().type }}</p>
      <div class="domain-labels">@for (domain of card().domains; track domain) { <span class="domain-tag" [attr.data-domain]="domain">{{ domain }}</span> }</div>
      <p class="rules-text">{{ card().text }}</p>
      <dl class="card-facts"><div><dt>Energy</dt><dd>{{ card().energy ?? '—' }}</dd></div><div><dt>Might</dt><dd>{{ card().might ?? '—' }}</dd></div><div><dt>Set</dt><dd>{{ card().set }}</dd></div><div><dt>Rarity</dt><dd>{{ card().rarity }}</dd></div></dl>
      @if (card().banned) { <p class="error-text">Banned in Constructed in the recorded rules snapshot.</p> }
      <button class="button primary" type="button" [disabled]="!!store.addReason(card(), 'main')" (click)="store.add(card())">{{ card().type === 'legend' ? 'Use this legend' : 'Add to deck' }}</button>
      @if (card().championUnit && card().champion === store.legend()?.champion) { <button class="button" type="button" (click)="store.chooseChampion(card().id)">Set chosen champion</button> }
      @if (store.addReason(card(), 'main')) { <p class="helper">{{ store.addReason(card(), 'main') }}</p> }
    </div></div>
  </dialog>`,
})
export class CardPreview implements AfterViewInit {
  readonly card = input.required<Card>(); readonly close = output(); readonly store = inject(DeckStore); readonly imageUrl = imageUrl;
  @ViewChild('dialog', { static: true }) dialog!: ElementRef<HTMLDialogElement>;
  ngAfterViewInit(): void { this.dialog.nativeElement.showModal(); }
  backdrop(event: MouseEvent): void { if (event.target === this.dialog.nativeElement) this.close.emit(); }
}
