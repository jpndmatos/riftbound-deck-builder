import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { DOMAINS } from '../core/models';

@Component({
  selector: 'app-domain-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `@if (source(); as src) {
    <img [src]="src" alt="" aria-hidden="true" width="16" height="16" decoding="async" />
  }`,
  styles:
    ':host{display:inline-flex;width:var(--icon-size);height:var(--icon-size);flex-shrink:0;align-items:center;justify-content:center}img{width:100%;height:100%;object-fit:contain}',
})
export class DomainIcon {
  readonly name = input.required<string>();
  readonly source = computed(() =>
    DOMAINS.includes(this.name()) ? `domains/${this.name()}.png` : null,
  );
}
