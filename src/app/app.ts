import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { DeckStore } from './core/deck.store';
import { Icon } from './shared/icon';
@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, Icon],
  templateUrl: './app.html',
  styleUrl: './app.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  focusWorkspace(event: Event): void {
    event.preventDefault();
    document.getElementById('workspace')?.focus();
  }
  readonly store = inject(DeckStore);
  readonly workspace = signal<{ importDeck(): void; newDeck(): void } | null>(null);
}
