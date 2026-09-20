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
    expect(compiled.querySelector('.reference-source')?.textContent).toContain('Live reference');
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
});
