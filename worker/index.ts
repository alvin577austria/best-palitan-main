import puppeteer from '@cloudflare/puppeteer';

interface Env {
  ASSETS: Fetcher;
  BROWSER: Fetcher;
}

interface Quote {
  rate: number;
  fee: number;
  source: 'live' | 'fallback';
  fetchedAt?: string;
  error?: string;
}

const quoteUrl = 'https://bcremit.com/?country=ES';
const sheetUrl =
  'https://docs.google.com/spreadsheets/d/1E7KJUMSfxYhH6Owwvj1zGia7vDhgjoOEzpnd6fQCRdA/export?format=csv&gid=813993135';
const quoteFallback: Quote = {
  rate: 63.42,
  fee: 2.99,
  source: 'fallback',
};
const referenceRateFallback = {
  rate: 69.4,
  source: 'fallback',
};

let cachedQuote: Quote | undefined;
let cachedQuoteAt = 0;
let cachedReferenceRate: { rate: number; source: 'live' | 'fallback'; fetchedAt?: string } | undefined;
let cachedReferenceRateAt = 0;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url);

    if (pathname === '/api/bcremit-quote') {
      return Response.json(await getQuote(env));
    }

    if (pathname === '/api/reference-rate') {
      return Response.json(await getReferenceRate());
    }

    return env.ASSETS.fetch(request);
  },
};

async function getQuote(env: Env): Promise<Quote> {
  if (cachedQuote && Date.now() - cachedQuoteAt < 5 * 60 * 1000) {
    return cachedQuote;
  }

  try {
    const browser = await puppeteer.launch(env.BROWSER);
    const page = await browser.newPage();

    try {
      await page.goto(quoteUrl, { waitUntil: 'networkidle2', timeout: 30_000 });
      await page.waitForFunction(() => document.body && document.body.innerText.length > 200, {
        timeout: 15_000,
      });

      const quote = parseQuote(await page.evaluate(() => document.body.innerText));
      cachedQuote = { ...quote, source: 'live', fetchedAt: new Date().toISOString() };
      cachedQuoteAt = Date.now();
      return cachedQuote;
    } finally {
      await browser.close();
    }
  } catch (error) {
    console.error('BC Remit quote failed:', error);
    return {
      ...quoteFallback,
      error: 'Live BC Remit data is temporarily unavailable.',
    };
  }
}

async function getReferenceRate() {
  if (cachedReferenceRate && Date.now() - cachedReferenceRateAt < 5 * 60 * 1000) {
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

    cachedReferenceRate = {
      rate,
      source: 'live',
      fetchedAt: new Date().toISOString(),
    };
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

function parseQuote(bodyText: string): Omit<Quote, 'source' | 'fetchedAt'> {
  const normalized = bodyText.replace(/\u00a0/g, ' ').replace(/\s+/g, ' ');
  const rateMatch = normalized.match(
    /(?:1\s*(?:EUR|€)|(?:EUR|€)\s*1|€\s*1(?:[.,]00)?)\s*[:=]\s*(?:₱|PHP)?\s*([0-9]+(?:[.,][0-9]+)?)/i,
  );
  const feeMatch = normalized.match(
    /(?:fee|fees|service fee)[^€\d]{0,40}(?:€\s*)?([0-9]+(?:[.,][0-9]+)?)/i,
  );

  if (!rateMatch) {
    throw new Error('Could not find an EUR exchange rate on the BC Remit page.');
  }

  return {
    rate: Number(rateMatch[1].replace(',', '.')),
    fee: feeMatch ? Number(feeMatch[1].replace(',', '.')) : quoteFallback.fee,
  };
}
