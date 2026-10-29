import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import { DeckStore } from '../core/deck.store';
import { Deck, countZone, imageUrl } from '../core/models';
import { Icon } from '../shared/icon';
import { TransferDialog } from '../shared/transfer-dialog';
@Component({
  selector: 'app-decks',
  imports: [Icon, DatePipe, TransferDialog],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<section class="saved-page">
      <div class="saved-heading">
        <div>
          <h1>Saved decks</h1>
          <p class="muted">Your lists stay in this browser. Export a JSON backup to keep a copy.</p>
        </div>
      </div>
      <div class="saved-list">
        @for (deck of store.saved(); track deck.id) {
          <article class="saved-row">
            @if (store.catalog.byId().get(deck.legend ?? ''); as legend) {
              <img
                [src]="imageUrl(legend, 160)"
                [alt]="legend.name"
                width="55"
                height="76"
                loading="lazy"
              />
            } @else {
              <span class="saved-no-art"><app-icon name="cards" /></span>
            }
            <div class="saved-row-main">
              <button class="saved-deck-name" type="button" (click)="open(deck)">
                {{ deck.name }}</button
              ><span class="muted">{{
                store.catalog.byId().get(deck.legend ?? '')?.name ?? 'No legend selected'
              }}</span
              ><span class="saved-meta"
                >{{ countZone(deck, 'main') }} main / {{ countZone(deck, 'runes') }} runes /
                {{ countZone(deck, 'battlefields') }} fields</span
              >
            </div>
            <time [attr.datetime]="deck.updatedAt">{{ deck.updatedAt | date: 'd MMM y' }}</time>
            <div class="saved-row-actions">
              @if (confirmDelete() === deck.id) {
                <button class="button danger" type="button" (click)="remove(deck)">Delete</button
                ><button class="button" type="button" (click)="confirmDelete.set(null)">
                  Cancel
                </button>
              } @else {
                <button
                  class="icon-button"
                  type="button"
                  [attr.aria-label]="'Duplicate ' + deck.name"
                  (click)="duplicate(deck)"
                >
                  <app-icon name="copy" /></button
                ><button
                  class="icon-button"
                  type="button"
                  [attr.aria-label]="'Delete ' + deck.name"
                  (click)="confirmDelete.set(deck.id)"
                >
                  <app-icon name="trash" /></button
                ><button class="button" type="button" (click)="open(deck)">Open</button>
              }
            </div>
          </article>
        } @empty {
          <div class="full-state">
            <app-icon name="cards" />
            <h2>No saved decks yet</h2>
            <p>Save your working deck in the builder, or start a new list.</p>
            <button class="button primary" type="button" (click)="back()">Open builder</button
            ><button class="text-button" type="button" (click)="practice()">
              Try the Jinx practice deck
            </button>
          </div>
        }
      </div>
      @if (deleted(); as deck) {
        <div class="delete-notice" role="status">
          <span>{{ deck.name }} removed.</span
          ><button class="text-button" type="button" (click)="restore()">Undo deletion</button>
        </div>
      }
    </section>
    @if (importing()) {
      <app-transfer-dialog
        mode="import"
        (close)="importing.set(false)"
        (imported)="afterImport()"
      />
    }`,
})
export class Decks {
  readonly store = inject(DeckStore);
  private readonly router = inject(Router);
  readonly importing = signal(false);
  readonly confirmDelete = signal<string | null>(null);
  readonly deleted = signal<Deck | null>(null);
  readonly imageUrl = imageUrl;
  readonly countZone = countZone;
  open(deck: Deck): void {
    this.store.replace(deck);
    this.back();
  }
  duplicate(deck: Deck): void {
    this.store.duplicate(deck);
    this.back();
  }
  importDeck(): void {
    this.importing.set(true);
  }
  newDeck(): void {
    this.store.newDeck();
    this.back();
  }
  practice(): void {
    this.store.replace(this.store.example());
    this.back();
  }
  back(): void {
    void this.router.navigate(['/builder']);
  }
  afterImport(): void {
    this.importing.set(false);
    this.back();
  }
  remove(deck: Deck): void {
    this.deleted.set(deck);
    this.store.delete(deck.id);
    this.confirmDelete.set(null);
  }
  restore(): void {
    const deck = this.deleted();
    if (deck) this.store.saved.update((decks) => [deck, ...decks]);
    this.deleted.set(null);
  }
}
