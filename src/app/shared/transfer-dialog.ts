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
  signal,
} from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { DeckStore } from '../core/deck.store';
import { deckText, parseDeckFile } from '../core/deck-rules';
import { Icon } from './icon';
@Component({
  selector: 'app-transfer-dialog',
  imports: [Icon, ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<dialog
    #dialog
    class="transfer-dialog"
    aria-labelledby="transfer-title"
    (cancel)="close.emit()"
    (click)="backdrop($event)"
  >
    <div class="dialog-heading">
      <h2 id="transfer-title">{{ mode() === 'import' ? 'Import deck' : 'Export deck' }}</h2>
      <button
        class="icon-button"
        type="button"
        aria-label="Close export or import"
        autofocus
        (click)="close.emit()"
      >
        <app-icon name="close" />
      </button>
    </div>
    <div class="transfer-body">
      @if (mode() === 'import') {
        <p class="muted">Paste a JSON backup or choose an exported file.</p>
        <label class="file-label"
          >Choose JSON file<input
            type="file"
            accept=".json,application/json"
            (change)="readFile($event)"
        /></label>
      } @else {
        <div class="segmented" aria-label="Export format">
          <button
            type="button"
            [class.selected]="format() === 'text'"
            [attr.aria-pressed]="format() === 'text'"
            (click)="setFormat('text')"
          >
            Text list</button
          ><button
            type="button"
            [class.selected]="format() === 'json'"
            [attr.aria-pressed]="format() === 'json'"
            (click)="setFormat('json')"
          >
            JSON backup
          </button>
        </div>
      }
      <label class="sr-only" for="transfer-content"
        >Deck {{ mode() === 'import' ? 'JSON' : 'export' }}</label
      ><textarea
        id="transfer-content"
        [formControl]="content"
        [readOnly]="mode() === 'export'"
        spellcheck="false"
        rows="14"
      ></textarea>
      <p class="helper error-text" role="status">{{ error() }}</p>
    </div>
    <div class="dialog-actions">
      @if (mode() === 'import') {
        <button
          class="button primary"
          type="button"
          [disabled]="!content.value.trim()"
          (click)="importDeck()"
        >
          Import into builder
        </button>
      } @else {
        <button class="button primary" type="button" (click)="download()">
          <app-icon name="download" />Download</button
        ><button class="button" type="button" (click)="copy()">
          <app-icon name="copy" />{{ copied() ? 'Copied' : 'Copy' }}
        </button>
      }
    </div>
  </dialog>`,
})
export class TransferDialog implements AfterViewInit, OnDestroy {
  private trigger: HTMLElement | null = null;
  readonly mode = input<'import' | 'export'>('export');
  readonly close = output();
  readonly imported = output();
  readonly store = inject(DeckStore);
  readonly content = new FormControl('', { nonNullable: true });
  readonly format = signal<'text' | 'json'>('text');
  readonly error = signal('');
  readonly copied = signal(false);
  @ViewChild('dialog', { static: true }) dialog!: ElementRef<HTMLDialogElement>;
  ngAfterViewInit(): void {
    this.trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (this.mode() === 'export') this.setFormat('text');
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
  setFormat(format: 'text' | 'json'): void {
    this.format.set(format);
    this.copied.set(false);
    this.content.setValue(
      format === 'text'
        ? deckText(this.store.draft(), this.store.catalog.byId())
        : JSON.stringify(
            { format: 'riftbound-deck-builder', version: 1, deck: this.store.draft() },
            null,
            2,
          ),
    );
  }
  async readFile(event: Event): Promise<void> {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    if (file.size > 200_000) {
      this.error.set('Choose a JSON file smaller than 200 KB.');
      return;
    }
    try {
      this.content.setValue(await file.text());
      this.error.set('');
    } catch {
      this.error.set('Could not read this file. Try pasting its contents.');
    }
  }
  importDeck(): void {
    try {
      this.store.replace(parseDeckFile(this.content.value, this.store.catalog.byId()));
      this.imported.emit();
    } catch (error) {
      this.error.set(
        error instanceof SyntaxError
          ? 'This is not valid JSON. Paste a JSON backup from this app.'
          : error instanceof Error
            ? error.message
            : 'Could not import this deck.',
      );
    }
  }
  async copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.content.value);
      this.copied.set(true);
    } catch {
      this.error.set(
        'Clipboard access is unavailable. Select the text above or download the file.',
      );
    }
  }
  download(): void {
    const format = this.format();
    const url = URL.createObjectURL(
      new Blob([this.content.value], {
        type: format === 'json' ? 'application/json' : 'text/plain',
      }),
    );
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${
      this.store
        .draft()
        .name.replace(/[^a-z0-9-]/gi, '-')
        .toLowerCase() || 'deck'
    }.${format === 'json' ? 'json' : 'txt'}`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
