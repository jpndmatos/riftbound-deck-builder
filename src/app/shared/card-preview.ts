import {
  AfterViewInit,
  OnDestroy,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  ViewChild,
  inject,
  input,
  output,
} from '@angular/core';
import { Card, Zone, imageUrl } from '../core/models';
import { DeckStore } from '../core/deck.store';
import { Icon } from './icon';
@Component({
  selector: 'app-card-preview',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<dialog
    #dialog
    class="card-dialog"
    aria-labelledby="preview-title"
    (cancel)="close.emit()"
    (click)="backdrop($event)"
  >
    <header class="dialog-heading">
      <div>
        <h2 id="preview-title">{{ card().name }}</h2>
        <p class="muted">{{ card().code }} / {{ card().type }}</p>
      </div>
      <button
        class="icon-button"
        type="button"
        aria-label="Close card details"
        autofocus
        (click)="close.emit()"
      >
        <app-icon name="close" />
      </button>
    </header>
    <div class="preview-layout">
      <img [src]="imageUrl(card(), 600)" [alt]="card().name" width="430" height="600" />
      <div class="preview-copy">
        <div class="domain-labels">
          @for (domain of card().domains; track domain) {
            <span class="domain-tag" [attr.data-domain]="domain">{{ domain }}</span>
          }
        </div>
        <p class="rules-text">{{ card().text }}</p>
        <dl class="card-facts">
          <div>
            <dt>Energy</dt>
            <dd>{{ card().energy ?? 'n/a' }}</dd>
          </div>
          <div>
            <dt>Might</dt>
            <dd>{{ card().might ?? 'n/a' }}</dd>
          </div>
          <div>
            <dt>Set</dt>
            <dd>{{ card().set }}</dd>
          </div>
          <div>
            <dt>Rarity</dt>
            <dd>{{ card().rarity }}</dd>
          </div>
        </dl>
        @if (card().banned) {
          <p class="error-text">Banned in Constructed in the recorded rules snapshot.</p>
        }
      </div>
    </div>
    <footer class="preview-actions">
      <button
        class="button primary"
        type="button"
        [disabled]="!!store.addReason(card(), zone())"
        (click)="store.add(card(), zone())"
      >
        {{
          card().type === 'legend'
            ? 'Use this legend'
            : zone() === 'sideboard'
              ? 'Add to sideboard'
              : 'Add to deck'
        }}
      </button>
      @if (card().championUnit && card().champion === store.legend()?.champion) {
        <button class="button" type="button" (click)="store.chooseChampion(card().id)">
          Set chosen champion
        </button>
      }
      @if (store.addReason(card(), zone())) {
        <p class="helper">{{ store.addReason(card(), zone()) }}</p>
      }
    </footer>
  </dialog>`,
})
export class CardPreview implements AfterViewInit, OnDestroy {
  private trigger: HTMLElement | null = null;
  readonly card = input.required<Card>();
  readonly zone = input<Zone>('main');
  readonly close = output();
  readonly store = inject(DeckStore);
  readonly imageUrl = imageUrl;
  @ViewChild('dialog', { static: true }) dialog!: ElementRef<HTMLDialogElement>;
  ngAfterViewInit(): void {
    this.trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    this.dialog.nativeElement.showModal();
  }
  ngOnDestroy(): void {
    this.dialog.nativeElement.close();
    if (this.trigger?.isConnected) this.trigger.focus();
  }
  backdrop(event: MouseEvent): void {
    const rect = this.dialog.nativeElement.getBoundingClientRect();
    if (
      event.target === this.dialog.nativeElement &&
      (event.clientX < rect.left ||
        event.clientX > rect.right ||
        event.clientY < rect.top ||
        event.clientY > rect.bottom)
    )
      this.close.emit();
  }
}
