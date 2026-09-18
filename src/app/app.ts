import { DecimalPipe } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

interface Provider {
  name: string;
  shortName: string;
  tagline: string;
  rate: number;
  fee: number;
  timeline: string;
  color: string;
  featured?: boolean;
  quoteSource?: 'live' | 'fallback';
}

interface Quote {
  rate: number;
  fee: number;
  source: 'live' | 'fallback';
}

interface ReferenceRate {
  rate: number;
  source: 'live' | 'fallback';
}

@Component({
  standalone: true,
  imports: [DecimalPipe, FormsModule],
  selector: 'app-root',
  styleUrl: './app.css',
  templateUrl: './app.html',
})
export class App implements OnInit {
  protected amount = 500;
  protected readonly referenceRate = signal(69.4);
  protected readonly referenceRateSource = signal<'live' | 'fallback'>('fallback');
  private readonly http: HttpClient;

  protected readonly providers = signal<Provider[]>([
    {
      name: 'BC Remit',
      shortName: 'BC',
      tagline: 'Reliable and simple',
      rate: 63.42,
      fee: 2.99,
      timeline: 'Minutes',
      color: '#f4b942',
    },
    {
      name: 'Nala',
      shortName: 'N',
      tagline: 'Fast digital transfers',
      rate: 63.85,
      fee: 1.49,
      timeline: 'Instant',
      color: '#f06a8d',
      featured: true,
    },
    {
      name: 'LemFi',
      shortName: 'L',
      tagline: 'Built for global families',
      rate: 63.68,
      fee: 1.99,
      timeline: 'Same day',
      color: '#6e63dd',
    },
    {
      name: 'ACE',
      shortName: 'A',
      tagline: 'A familiar high-street choice',
      rate: 62.95,
      fee: 3.99,
      timeline: '1–2 days',
      color: '#3a9d8f',
    },
    {
      name: 'Zolt',
      shortName: 'Z',
      tagline: 'Send with confidence',
      rate: 63.21,
      fee: 3.49,
      timeline: 'Minutes',
      color: '#ef7652',
    },
    {
      name: 'Paysend',
      shortName: 'P',
      tagline: 'Cards to cards, made easy',
      rate: 63.55,
      fee: 2.49,
      timeline: 'Same day',
      color: '#3979d8',
    },
  ]);

  constructor(http: HttpClient) {
    this.http = http;
  }

  async ngOnInit() {
    try {
      const [bcremit, nala, referenceRate] = await Promise.all([
        firstValueFrom(
          this.http.get<Quote>('/api/bcremit-quote'),
        ),
        firstValueFrom(
          this.http.get<Quote>('/api/nala-quote'),
        ),
        firstValueFrom(
          this.http.get<ReferenceRate>('/api/reference-rate'),
        ),
      ]);

      this.providers.update((providers) =>
        providers.map((provider) => {
          if (provider.name === 'BC Remit') {
            return {
              ...provider,
              rate: bcremit.rate,
              fee: bcremit.fee,
              quoteSource: bcremit.source,
            };
          }

          if (provider.name === 'Nala') {
            return {
              ...provider,
              rate: nala.rate,
              fee: nala.fee,
              quoteSource: nala.source,
            };
          }

          return provider;
        }),
      );
      this.referenceRate.set(referenceRate.rate);
      this.referenceRateSource.set(referenceRate.source);
    } catch (error) {
      console.error('Unable to load live remittance quotes.', error);
    }
  }

  protected referenceConvertedAmount(): number {
    const value = Number.isFinite(this.amount) && this.amount > 0 ? this.amount : 0;
    return value * this.referenceRate();
  }

  protected convertedAmount(provider: Provider): number {
    return this.safeAmount() * provider.rate;
  }

  protected finalAmount(provider: Provider): number {
    return Math.max(0, (this.safeAmount() - provider.fee) * provider.rate);
  }

  private safeAmount(): number {
    return Number.isFinite(this.amount) && this.amount > 0 ? this.amount : 0;
  }
}
