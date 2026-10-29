import { afterEach, describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';
import catalog from '../../../public/data/cards.json';
import { CATALOG_URL } from '../core/catalog-version';
import { Builder } from './builder';

// Exercise the observer boundary without relying on jsdom layout calculations.
describe('Continuous card browsing', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('appends without replacing earlier cards, resets on filtering and disconnects on destruction', async () => {
    const observers: {
      callback: IntersectionObserverCallback;
      root: unknown;
      disconnect: ReturnType<typeof vi.fn>;
    }[] = [];
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        disconnect = vi.fn();
        observe = vi.fn();
        constructor(callback: IntersectionObserverCallback, options: IntersectionObserverInit) {
          observers.push({ callback, root: options.root, disconnect: this.disconnect });
        }
      },
    );
    localStorage.clear();
    const params = convertToParamMap({ page: '4' });
    TestBed.configureTestingModule({
      imports: [Builder],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: Router, useValue: { navigate: vi.fn().mockResolvedValue(true) } },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: params }, queryParamMap: of(params) },
        },
      ],
    });
    const fixture = TestBed.createComponent(Builder);
    fixture.detectChanges();
    TestBed.inject(HttpTestingController).expectOne(CATALOG_URL).flush(catalog);
    TestBed.tick();
    fixture.detectChanges();
    const component = fixture.componentInstance;
    const root = fixture.nativeElement.querySelector('.catalog-scroll') as HTMLElement;
    Object.defineProperty(root, 'clientHeight', { value: 600 });
    component.mobileView.set('deck');
    TestBed.tick();
    const first = component.visible().map((card) => card.id);
    expect(first).toHaveLength(36);
    expect(fixture.nativeElement.querySelector('.pagination')).toBeNull();
    const observer = observers.at(-1)!;
    expect(observer.root).toBe(root);
    observer.callback(
      [{ isIntersecting: true } as IntersectionObserverEntry],
      {} as IntersectionObserver,
    );
    TestBed.tick();
    expect(component.visible()).toHaveLength(72);
    expect(
      component
        .visible()
        .slice(0, 36)
        .map((card) => card.id),
    ).toEqual(first);
    expect(component.store.total()).toBe(40);
    root.scrollTop = 900;
    component.form.controls.type.setValue('unit');
    await new Promise((resolve) => setTimeout(resolve, 110));
    TestBed.tick();
    expect(component.limit()).toBe(36);
    expect(root.scrollTop).toBe(0);
    expect(component.visible().every((card) => card.type === 'unit')).toBe(true);
    component.availableWidth.set(720);
    const originalColumns = component.columns();
    component.resizeCards(1);
    expect(component.columns()).toBe(originalColumns - 1);
    component.resizeCards(-1);
    expect(component.columns()).toBe(originalColumns);
    for (let i = 0; i < 32; i++) component.resizeCards(-1);
    expect(component.columns()).toBe(component.maxColumns());
    component.availableWidth.set(280);
    expect(component.columns()).toBeLessThanOrEqual(component.maxColumns());
    component.resizeCards(1);
    expect(component.columns()).toBe(1);
    for (let i = 0; i < 32; i++) component.resizeCards(1);
    expect(component.columns()).toBe(1);
    TestBed.tick();
    expect(fixture.nativeElement.querySelector('.card-list')).toBeNull();
    expect(fixture.nativeElement.querySelector('[aria-label="Zoom in cards"]').disabled).toBe(true);
    const active = observers.at(-1)!;
    fixture.destroy();
    expect(active.disconnect).toHaveBeenCalled();
  });
});
