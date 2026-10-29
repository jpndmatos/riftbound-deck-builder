import { ChangeDetectionStrategy, Component, input } from '@angular/core';
const paths: Record<string, string> = {
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  close: 'm6 6 12 12M6 18 18 6',
  'zoom-in': 'M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0M6 10h8M10 6v8',
  'zoom-out': 'M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0M6 10h8',
  search: 'M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',
  sun: 'M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
  moon: 'M20.8 13A9 9 0 0 1 11 3.2 9 9 0 1 0 20.8 13Z',
  undo: 'M3 10h10a6 6 0 0 1 0 12M3 10l5-5M3 10l5 5',
  redo: 'M21 10H11a6 6 0 0 0 0 12M21 10l-5-5M21 10l-5 5',
  check: 'm5 12 4 4L19 6',
  down: 'm6 9 6 6 6-6',
  left: 'm15 6-6 6 6 6',
  right: 'm9 6 6 6-6 6',
  download: 'M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5',
  upload: 'M12 16V4m-5 5 5-5 5 5M4 16v5h16v-5',
  copy: 'M9 9h12v12H9ZM15 9V3H3v12h6',
  save: 'M4 3h13l4 4v14H3V3ZM7 3v6h10V3M7 21v-8h10v8',
  cards: 'M4 2h12v17H4ZM16 5h4v17H8v-3',
  filter: 'M4 6h16M7 12h10M10 18h4',
  grid: 'M3 3h7v7H3ZM14 3h7v7h-7ZM3 14h7v7H3ZM14 14h7v7h-7Z',
  list: 'M9 6h12M9 12h12M9 18h12M3 6h1M3 12h1M3 18h1',
  trash: 'M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7',
  info: 'M12 11v6m0-10v.01M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',
};
@Component({
  selector: 'app-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path [attr.d]="path()" /></svg>',
  styles:
    ':host{display:inline-flex;width:var(--icon-size);height:var(--icon-size);flex-shrink:0;align-items:center;justify-content:center;line-height:0;vertical-align:middle}svg{display:block;width:100%;height:100%;stroke-width:var(--icon-stroke)}',
})
export class Icon {
  readonly name = input('cards');
  path(): string {
    return paths[this.name()] ?? paths['cards']!;
  }
}
