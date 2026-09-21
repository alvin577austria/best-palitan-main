import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { App } from './app';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideHttpClient()],
    })
      .compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('renders the live reference source after it updates', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;

    app['referenceRateSource'].set('live');
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.reference-source')?.textContent).toContain('Live');
  });

  it('shows a loading overlay while provider quotes are loading', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;

    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.loading-overlay')).toBeTruthy();

    app['isLoadingQuotes'].set(false);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.loading-overlay')).toBeNull();
  });

  it('marks the provider with the highest rate as the best value', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;

    app['providers'].update((providers) =>
      providers.map((provider) =>
        provider.name === 'Wise' ? { ...provider, rate: 80 } : provider,
      ),
    );
    fixture.detectChanges();

    const bestValueCard = fixture.nativeElement.querySelector('.provider-card.featured');
    expect(bestValueCard?.textContent).toContain('Wise');
    expect(bestValueCard?.querySelector('.best-value')?.textContent).toContain('Best value');
  });
});
