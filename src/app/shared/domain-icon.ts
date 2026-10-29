import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { DOMAINS } from '../core/models';

@Component({
  selector: 'app-domain-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `@if (source(); as src) {
    <img [src]="src" alt="" aria-hidden="true" width="18" height="18" decoding="async" />
  }`,
  styles:
    ':host{display:inline-flex;width:18px;height:18px;flex-shrink:0;align-items:center;justify-content:center}img{width:100%;height:100%;object-fit:contain}',
})
export class DomainIcon {
  readonly name = input.required<string>();
  readonly source = computed(() =>
    DOMAINS.includes(this.name()) ? `domains/${this.name()}.png` : null,
  );
}
