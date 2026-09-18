import express from 'express';
import puppeteer from 'puppeteer';

const app = express();
const port = Number(process.env.PORT ?? 4301);
const bcremitQuoteUrl = 'https://bcremit.com/?country=ES';
const nalaQuoteUrl = 'https://www.nala.com/country/philippines';
const lemfiQuoteUrl = 'https://lemfi.com/en-es/';
const aceQuoteUrl = 'https://acemoneytransfer.com/Philippines/Send-Money-to-Philippines';
const paysendQuoteUrl = 'https://paysend.com/en-gb/send-money/from-spain-to-philippines';
const zoltQuoteUrl = 'https://zoltmoney.com/fil/';

const sheetUrl =
  'https://docs.google.com/spreadsheets/d/1E7KJUMSfxYhH6Owwvj1zGia7vDhgjoOEzpnd6fQCRdA/export?format=csv&gid=813993135';
const fallback = {
  rate: 63.42,
  fee: 2.99,
  source: 'fallback',
};
const sheetRateFallback = {
  rate: 69.4,
  source: 'fallback',
};
const providerQuoteConfigs = [
  { name: 'BC Remit', url: bcremitQuoteUrl, fallback },
  { name: 'Nala', url: nalaQuoteUrl, fallback: { rate: 63.85, fee: 1.49 } },
  { name: 'LemFi', url: lemfiQuoteUrl, fallback: { rate: 63.68, fee: 1.99 } },
  { name: 'ACE', url: aceQuoteUrl, fallback: { rate: 62.95, fee: 3.99 } },
  { name: 'Zolt', url: zoltQuoteUrl, fallback: { rate: 63.21, fee: 3.49 } },
  { name: 'Paysend', url: paysendQuoteUrl, fallback: { rate: 63.55, fee: 2.49 } },
];

let cachedQuote = null;
let cachedAt = 0;
let cachedSheetRate = null;
let cachedSheetRateAt = 0;
let browserPromise;

app.get('/api/provider-quotes', async (_request, response) => {
  const quotes = await Promise.all(
    providerQuoteConfigs.map(async (provider) => {
      try {
        return await getProviderQuote(provider);
      } catch (error) {
        console.error(`${provider.name} quote failed:`, error);
        return {
          name: provider.name,
          ...provider.fallback,
          source: 'fallback',
          error: `Live ${provider.name} data is temporarily unavailable.`,
        };
      }
    }),
  );
  response.json(quotes);
});

app.get('/api/bcremit-quote', async (_request, response) => {
  try {
    const quote = await getQuote();
    response.json(quote);
  } catch (error) {
    console.error('BC Remit quote failed:', error);
    response.json({
      ...fallback,
      source: 'fallback',
      error: 'Live BC Remit data is temporarily unavailable.',
    });
  }
});

app.get('/api/nala-quote', async (_request, response) => {
  try {
    const quote = await getProviderQuote({
      name: 'Nala',
      url: nalaQuoteUrl,
      fallback: { rate: 63.85, fee: 1.49 },
    });
    response.json(quote);
  } catch (error) {
    console.error('Nala quote failed:', error);
    response.json({
      rate: 63.85,
      fee: 1.49,
      source: 'fallback',
      error: 'Live Nala data is temporarily unavailable.',
    });
  }
});

app.get('/api/lemfi-quote', async (_request, response) => {
  try {
    const quote = await getProviderQuote({
      name: 'LemFi',
      url: lemfiQuoteUrl,
      fallback: { rate: 63.68, fee: 1.99 },
    });
    response.json(quote);
  } catch (error) {
    console.error('LemFi quote failed:', error);
    response.json({
      rate: 63.68,
      fee: 1.99,
      source: 'fallback',
      error: 'Live LemFi data is temporarily unavailable.',
    });
  }
});

app.get('/api/ace-quote', async (_request, response) => {
  try {
    const quote = await getProviderQuote({
      name: 'ACE',
      url: aceQuoteUrl,
      fallback: { rate: 62.95, fee: 3.99 },
    });
    response.json(quote);
  } catch (error) {
    console.error('ACE quote failed:', error);
    response.json({
      rate: 62.95,
      fee: 3.99,
      source: 'fallback',
      error: 'Live ACE data is temporarily unavailable.',
    });
  }
});

app.get('/api/paysend-quote', async (_request, response) => {
  try {
    const quote = await getProviderQuote({
      name: 'Paysend',
      url: paysendQuoteUrl,
      fallback: { rate: 63.55, fee: 2.49 },
    });
    response.json(quote);
  } catch (error) {
    console.error('Paysend quote failed:', error);
    response.json({
      rate: 63.55,
      fee: 2.49,
      source: 'fallback',
      error: 'Live Paysend data is temporarily unavailable.',
    });
  }
});

app.get('/api/zolt-quote', async (_request, response) => {
  try {
    const quote = await getProviderQuote({
      name: 'Zolt',
      url: zoltQuoteUrl,
      fallback: { rate: 63.21, fee: 3.49 },
    });
    response.json(quote);
  } catch (error) {
    console.error('Zolt quote failed:', error);
    response.json({
      rate: 63.21,
      fee: 3.49,
      source: 'fallback',
      error: 'Live Zolt data is temporarily unavailable.',
    });
  }
});

app.get('/api/reference-rate', async (_request, response) => {
  try {
    const rate = await getSheetRate();
    response.json(rate);
  } catch (error) {
    console.error('Google Sheet reference rate failed:', error);
    response.json({
      ...sheetRateFallback,
      error: 'Google Sheet data is temporarily unavailable.',
    });
  }
});

app.listen(port, () => {
  console.log(`Best Palitan local API listening at http://localhost:${port}`);
});

async function getQuote() {
  if (cachedQuote && Date.now() - cachedAt < 5 * 60 * 1000) {
    return cachedQuote;
  }

  return getProviderQuote({
    name: 'BC Remit',
    url: bcremitQuoteUrl,
    fallback,
  });
}

async function getProviderQuote({ name, url, fallback: fallbackQuote }) {
  const browser = await getBrowser();
  const page = await browser.newPage();

  try {
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30_000 });
    await page.waitForFunction(
      () => document.body && document.body.innerText.length > 200,
      { timeout: 15_000 },
    );

    const bodyText = await page.evaluate(() => document.body.innerText);
    const quote = parseProviderQuote(bodyText, name, fallbackQuote);
    const result = { name, ...quote, source: 'live', fetchedAt: new Date().toISOString() };

    if (name === 'BC Remit') {
      cachedQuote = result;
      cachedAt = Date.now();
    }

    return result;
  } finally {
    await page.close();
  }
}

async function getSheetRate() {
  //if (cachedSheetRate && Date.now() - cachedSheetRateAt < 5 * 60 * 1000) {
  //  return cachedSheetRate;
  //}

  const response = await fetch(sheetUrl);
  if (!response.ok) {
    throw new Error(`Google Sheets returned HTTP ${response.status}.`);
  }

  const csv = await response.text();
  const firstRow = parseCsvRow(csv);
  const rate = Number(firstRow[5]);
  if (!Number.isFinite(rate)) {
    throw new Error('Cell F1 does not contain a numeric exchange rate.');
  }

  cachedSheetRate = {
    rate,
    source: 'live',
    fetchedAt: new Date().toISOString(),
  };
  cachedSheetRateAt = Date.now();
  return cachedSheetRate;
}

function parseCsvRow(csv) {
  const row = csv.split(/\r?\n/, 1)[0];
  return row.split(',').map((cell) => cell.trim().replace(/^"|"$/g, ''));
}

async function getBrowser() {
  browserPromise ??= puppeteer.launch({
    headless: true,
    executablePath:
      process.env.CHROME_BIN ||
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  });
  return browserPromise;
}

function parseProviderQuote(bodyText, providerName, fallbackQuote) {
  const normalized = bodyText.replace(/\u00a0/g, ' ').replace(/\s+/g, ' ');
  const rateMatch =
    normalized.match(
      /(?:1\s*(?:EUR|€)|(?:EUR|€)\s*1|€\s*1(?:[.,]00)?)\s*[:=]\s*(?:₱|PHP)?\s*([0-9]+(?:[.,][0-9]+)?)/i,
    ) ??
    normalized.match(/1\s*(?:EUR|€)\s*(?:[≈~]|approx(?:imately)?)\s*(?:₱|PHP)?\s*([0-9]+(?:[.,][0-9]+)?)/i) ??
    normalized.match(/<[^>]*>\s*1\s*(?:EUR|€)\s*(?:[≈~]|approx(?:imately)?)\s*(?:₱|PHP)?\s*([0-9]+(?:[.,][0-9]+)?)/i) ??
    normalized.match(/([0-9]+(?:[.,][0-9]+)?)\s*(?:₱|PHP)\s*(?:per|for)\s*(?:1\s*)?(?:EUR|€)/i) ??
    normalized.match(/(?:EUR|€)\s*1\s*(?:to|=|:)?\s*(?:₱|PHP)?\s*([0-9]+(?:[.,][0-9]+)?)/i) ??
    normalized.match(/([0-9]+(?:[.,][0-9]+)?)\s*PHP\s*(?:per|for)?\s*(?:1\s*)?(?:EUR|€)/i);
  const feeMatch = 0;

  if (!rateMatch) {
    throw new Error(`Could not find an EUR exchange rate on the ${providerName} page.`);
  }

  return {
    rate: Number((rateMatch[1] || rateMatch[0]).replace(',', '.')),
    fee: feeMatch ? Number(feeMatch[1].replace(',', '.')) : fallbackQuote.fee,
  };
}
