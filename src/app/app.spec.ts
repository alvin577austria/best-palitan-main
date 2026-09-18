import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { App } from './app';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideHttpClient(), provideHttpClientTesting()],
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

  it('uses the BC Remit quote to update the provider card', async () => {
    const fixture = TestBed.createComponent(App);
    const http = TestBed.inject(HttpTestingController);

    fixture.detectChanges();

    http.expectOne('/api/bcremit-quote').flush({
      rate: 71.85,
      fee: 0.99,
      source: 'live',
    });
    http.expectOne('/api/reference-rate').flush({
      rate: 69.4,
      source: 'live',
    });
    await Promise.resolve();
    await Promise.resolve();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('€1 = 71.85 PHP');
    expect(compiled.textContent).toContain('0.99 EUR');
    http.verify();
  });
});
