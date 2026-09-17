import express from 'express';
import puppeteer from 'puppeteer';

const app = express();
const port = 4301;
const quoteUrl = 'https://bcremit.com/?country=ES';
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

let cachedQuote = null;
let cachedAt = 0;
let cachedSheetRate = null;
let cachedSheetRateAt = 0;
let browserPromise;

/*app.get('/api/bcremit-quote', async (_request, response) => {
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
});*/

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

  const browser = await getBrowser();
  const page = await browser.newPage();

  try {
    await page.goto(quoteUrl, { waitUntil: 'networkidle2', timeout: 30_000 });
    await page.waitForFunction(
      () => document.body && document.body.innerText.length > 200,
      { timeout: 15_000 },
    );

    const bodyText = await page.evaluate(() => document.body.innerText);
    const quote = parseQuote(bodyText);
    cachedQuote = { ...quote, source: 'live', fetchedAt: new Date().toISOString() };
    cachedAt = Date.now();
    return cachedQuote;
  } finally {
    await page.close();
  }
}

async function getSheetRate() {
  if (cachedSheetRate && Date.now() - cachedSheetRateAt < 5 * 60 * 1000) {
    return cachedSheetRate;
  }

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

function parseQuote(bodyText) {
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
    fee: feeMatch ? Number(feeMatch[1].replace(',', '.')) : fallback.fee,
  };
}
