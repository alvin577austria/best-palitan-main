import puppeteer from '@cloudflare/puppeteer';

interface Env {
  ASSETS: Fetcher;
  BROWSER: Fetcher;
}

interface Quote {
  name: string;
  rate: number;
  fee: number;
  source: 'live' | 'fallback';
  fetchedAt?: string;
  error?: string;
}

interface ProviderConfig {
  name: string;
  url: string;
  fallback: Pick<Quote, 'rate' | 'fee'>;
}

const providers: ProviderConfig[] = [
  {
    name: 'BC Remit',
    url: 'https://bcremit.com/?country=ES',
    fallback: { rate: 63.42, fee: 2.99 },
  },
  {
    name: 'Nala',
    url: 'https://www.nala.com/country/philippines',
    fallback: { rate: 63.85, fee: 1.49 },
  },
  {
    name: 'LemFi',
    url: 'https://lemfi.com/en-es/',
    fallback: { rate: 63.68, fee: 1.99 },
  },
  {
    name: 'ACE',
    url: 'https://acemoneytransfer.com/Philippines/Send-Money-to-Philippines',
    fallback: { rate: 62.95, fee: 3.99 },
  },
  {
    name: 'Zolt',
    url: 'https://zoltmoney.com/fil/',
    fallback: { rate: 63.21, fee: 3.49 },
  },
  {
    name: 'Paysend',
    url: 'https://paysend.com/en-gb/send-money/from-spain-to-philippines',
    fallback: { rate: 63.55, fee: 2.49 },
  },
];
const sheetUrl =
  'https://docs.google.com/spreadsheets/d/1E7KJUMSfxYhH6Owwvj1zGia7vDhgjoOEzpnd6fQCRdA/export?format=csv&gid=813993135';
const referenceRateFallback = { rate: 69.4, source: 'fallback' as const };
const cacheDurationMs = 5 * 60 * 1000;

let cachedQuotes: Quote[] | undefined;
let cachedQuotesAt = 0;
let cachedReferenceRate: { rate: number; source: 'live' | 'fallback'; fetchedAt?: string } | undefined;
let cachedReferenceRateAt = 0;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url);

    if (pathname === '/api/provider-quotes') {
      return Response.json(await getProviderQuotes(env));
    }

    if (pathname === '/api/reference-rate') {
      return Response.json(await getReferenceRate());
    }

    return env.ASSETS.fetch(request);
  },
};

async function getProviderQuotes(env: Env): Promise<Quote[]> {
  //if (cachedQuotes && Date.now() - cachedQuotesAt < cacheDurationMs) {
  //  return cachedQuotes;
  //}

  const browser = await puppeteer.launch(env.BROWSER);

  try {
    cachedQuotes = [];
    for (const provider of providers) {
      cachedQuotes.push(await getProviderQuote(browser, provider));
    }
    cachedQuotesAt = Date.now();
    return cachedQuotes;
  } catch (error) {
    console.error('Provider quote collection failed:', error);
    return providers.map((provider) => fallbackQuote(provider));
  } finally {
    await browser.close();
  }
}

async function getProviderQuote(
  browser: Awaited<ReturnType<typeof puppeteer.launch>>,
  provider: ProviderConfig,
): Promise<Quote> {
  const page = await browser.newPage();

  try {
    await page.goto(provider.url, { waitUntil: 'networkidle2', timeout: 30_000 });
    await page.waitForFunction(() => document.body && document.body.innerText.length > 200, {
      timeout: 15_000,
    });

    const parsedQuote = parseQuote(await page.evaluate(() => document.body.innerText), provider);
    return {
      name: provider.name,
      ...parsedQuote,
      source: 'live',
      fetchedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error(`${provider.name} quote failed:`, error);
    return fallbackQuote(provider);
  } finally {
    await page.close();
  }
}

function fallbackQuote(provider: ProviderConfig): Quote {
  return {
    name: provider.name,
    ...provider.fallback,
    source: 'fallback',
    error: `Live ${provider.name} data is temporarily unavailable.`,
  };
}

async function getReferenceRate() {
  if (cachedReferenceRate && Date.now() - cachedReferenceRateAt < cacheDurationMs) {
    return cachedReferenceRate;
  }

  try {
    const response = await fetch(sheetUrl);
    if (!response.ok) {
      throw new Error(`Google Sheets returned HTTP ${response.status}.`);
    }

    const rate = Number(parseCsvRow(await response.text())[5]);
    if (!Number.isFinite(rate)) {
      throw new Error('Cell F1 does not contain a numeric exchange rate.');
    }

    cachedReferenceRate = { rate, source: 'live', fetchedAt: new Date().toISOString() };
    cachedReferenceRateAt = Date.now();
    return cachedReferenceRate;
  } catch (error) {
    console.error('Google Sheet reference rate failed:', error);
    return {
      ...referenceRateFallback,
      error: 'Google Sheet data is temporarily unavailable.',
    };
  }
}

function parseCsvRow(csv: string): string[] {
  return csv
    .split(/\r?\n/, 1)[0]
    .split(',')
    .map((cell) => cell.trim().replace(/^"|"$/g, ''));
}

function parseQuote(bodyText: string, provider: ProviderConfig): Pick<Quote, 'rate' | 'fee'> {
  const normalized = bodyText.replace(/\u00a0/g, ' ').replace(/\s+/g, ' ');
  const rateMatch =
    normalized.match(
      /(?:1\s*(?:EUR|€)|(?:EUR|€)\s*1|€\s*1(?:[.,]00)?)\s*[:=]\s*(?:₱|PHP)?\s*([0-9]+(?:[.,][0-9]+)?)/i,
    ) ??
    normalized.match(
      /1\s*(?:EUR|€)\s*(?:[≈~]|approx(?:imately)?)\s*(?:₱|PHP)?\s*([0-9]+(?:[.,][0-9]+)?)/i,
    ) ??
    normalized.match(/([0-9]+(?:[.,][0-9]+)?)\s*(?:₱|PHP)\s*(?:per|for)\s*1\s*(?:EUR|€)/i);
  const feeMatch = normalized.match(
    /(?:fee|fees|service fee)[^€\d]{0,40}(?:€\s*)?([0-9]+(?:[.,][0-9]+)?)/i,
  );

  if (!rateMatch) {
    throw new Error(`Could not find an EUR exchange rate on the ${provider.name} page.`);
  }

  return {
    rate: Number(rateMatch[1].replace(',', '.')),
    fee: feeMatch ? Number(feeMatch[1].replace(',', '.')) : provider.fallback.fee,
  };
}
