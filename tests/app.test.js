// Regression tests for the scatterbudget single-page app.
//
// index.html loads math.js and Chart.js from jsdelivr. Rather than depend on
// live network access (flaky and slow in CI-less local runs), every test
// intercepts those two script requests and serves the vendored copies in
// tests/fixtures/ instead — same versions the page pins, so behavior matches
// production exactly. The one exception is the "CDN unreachable" test, which
// aborts those requests on purpose to exercise the page's own failure guard.
//
// Run with: npm test

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require('playwright');

const INDEX_URL = 'file://' + path.resolve(__dirname, '..', 'index.html');
const MATH_FIXTURE = path.resolve(__dirname, 'fixtures', 'math.js');
const CHART_FIXTURE = path.resolve(__dirname, 'fixtures', 'chart.umd.js');

let browser;

before(async () => {
  // PLAYWRIGHT_CHROMIUM_PATH lets a sandboxed/offline environment point at a
  // pre-provisioned browser binary instead of the one `npx playwright
  // install` would fetch; unset, this just uses Playwright's own default.
  const executablePath = process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined;
  browser = await chromium.launch({ executablePath });
});

after(async () => {
  await browser.close();
});

async function openPage(hash = '') {
  const page = await browser.newPage();
  const pageErrors = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));

  await page.route('**/cdn.jsdelivr.net/npm/mathjs@*/lib/browser/math.js', (route) =>
    route.fulfill({ path: MATH_FIXTURE, contentType: 'application/javascript' })
  );
  await page.route('**/cdn.jsdelivr.net/npm/chart.js@*/dist/chart.umd.js', (route) =>
    route.fulfill({ path: CHART_FIXTURE, contentType: 'application/javascript' })
  );

  await page.goto(INDEX_URL + hash);
  await page.waitForTimeout(300);
  page.pageErrors = pageErrors;
  return page;
}

async function setVar(page, name, value, sigma) {
  const rows = await page.locator('#var-table-body tr').all();
  for (const row of rows) {
    const rowName = await row.locator('td').first().innerText();
    if (rowName === name) {
      await row.locator('input[data-field=value]').fill(String(value));
      await row.locator('input[data-field=sigma]').fill(String(sigma));
      return;
    }
  }
  throw new Error(`variable "${name}" not found in var table`);
}

function parseHeadline(text) {
  // "1.688e+5±67734" or "363.83±77.374"
  const [nominal, sigma] = text.split('±').map(Number);
  return { nominal, sigma };
}

test('default preset (v = d/t) parses and computes with methods agreeing', async () => {
  const page = await openPage();
  assert.equal(await page.locator('#vars-section').isVisible(), true);

  await page.click('#compute-btn');
  await page.waitForTimeout(500);

  const linear = parseHeadline(await page.locator('#linear-headline').innerText());
  const mc = parseHeadline(await page.locator('#mc-headline').innerText());
  assert.equal(linear.nominal, 1);
  assert.ok(Math.abs(mc.nominal - 1) < 0.1, `MC nominal ${mc.nominal} should be close to 1`);

  const banner = await page.locator('#divergence-banner').innerText();
  assert.match(banner, /agree within/);
  assert.equal(page.pageErrors.length, 0);
  await page.close();
});

test('pendulum preset extracts both L and g and computes', async () => {
  const page = await openPage();
  await page.click('[data-preset="T = 2 * pi * sqrt(L / g)"]');
  await page.waitForTimeout(200);

  const rowNames = await page.locator('#var-table-body td:first-child').allInnerTexts();
  assert.deepEqual(rowNames.sort(), ['L', 'g']);

  await page.click('#compute-btn');
  await page.waitForTimeout(500);
  const linear = parseHeadline(await page.locator('#linear-headline').innerText());
  assert.ok(Math.abs(linear.nominal - 2 * Math.PI) < 0.01);
  await page.close();
});

test('malformed formula shows a parse error and throws no page errors', async () => {
  const page = await openPage();
  await page.fill('#formula-input', 'a +* b');
  await page.click('#parse-btn');
  await page.waitForTimeout(200);
  const error = await page.locator('#parse-error').innerText();
  assert.match(error, /Could not parse/);
  assert.equal(page.pageErrors.length, 0);
  await page.close();
});

test('a strongly nonlinear formula trips the divergence flag', async () => {
  const page = await openPage();
  await page.fill('#formula-input', 'y = x^5');
  await page.click('#parse-btn');
  await page.waitForTimeout(200);
  await setVar(page, 'x', 1, 0.5);
  await page.click('#compute-btn');
  await page.waitForTimeout(500);
  const banner = await page.locator('#divergence-banner').innerText();
  assert.match(banner, /Nonlinear regime/);
  await page.close();
});

test('chart axes and budget headers use the output variable name, not "y"', async () => {
  const page = await openPage();
  await page.fill('#formula-input', 'F = 0.5 * rho * v^2 * Cd * A');
  await page.click('#parse-btn');
  await page.waitForTimeout(200);

  const derivHeader = await page.locator('#budget-deriv-header').innerText();
  const contribHeader = await page.locator('#budget-contrib-header').innerText();
  assert.match(derivHeader, /F/);
  assert.match(contribHeader, /F/);

  await page.click('#compute-btn');
  await page.waitForTimeout(600);

  const scatterYTitle = await page.evaluate(() => {
    const canvas = document.querySelector('#scatter-grid canvas');
    return Chart.getChart(canvas).options.scales.y.title.text;
  });
  assert.equal(scatterYTitle, 'F');

  const histogramXTitle = await page.evaluate(() => {
    const canvas = document.getElementById('histogram-chart');
    return Chart.getChart(canvas).options.scales.x.title.text;
  });
  assert.equal(histogramXTitle, 'F');
  await page.close();
});

test('sigma renders as lowercase sigma, not uppercased to capital Sigma', async () => {
  const page = await openPage();
  await page.click('#compute-btn');
  await page.waitForTimeout(500);

  // th has text-transform: uppercase; the sigma character must sit inside a
  // .no-caps span so the CSS transform doesn't substitute it with the
  // visually-and-semantically-different capital Sigma (Σ).
  const varHeaderStyle = await page
    .locator('#vars-section thead th')
    .nth(2)
    .locator('.no-caps')
    .evaluate((el) => getComputedStyle(el).textTransform);
  assert.equal(varHeaderStyle, 'none');

  const budgetHeaderStyle = await page
    .locator('#budget-contrib-header .no-caps')
    .evaluate((el) => getComputedStyle(el).textTransform);
  assert.equal(budgetHeaderStyle, 'none');

  const budgetHeaderParentStyle = await page
    .locator('#budget-contrib-header')
    .evaluate((el) => getComputedStyle(el).textTransform);
  assert.equal(budgetHeaderParentStyle, 'uppercase');
  await page.close();
});

test('sharing a URL reproduces the exact formula, variables, N, and threshold', async () => {
  const page = await openPage();
  await page.fill('#formula-input', 'F = 0.5 * rho * v^2 * Cd * A');
  await page.click('#parse-btn');
  await page.waitForTimeout(200);
  await setVar(page, 'A', 2.2, 0.05);
  await setVar(page, 'Cd', 0.3, 0.02);
  await setVar(page, 'rho', 1.225, 0.02);
  await setVar(page, 'v', 30, 3);
  await page.locator('#n-slider').evaluate((el) => {
    el.value = '20000';
    el.dispatchEvent(new Event('input'));
  });
  await page.click('#compute-btn');
  await page.waitForTimeout(500);
  await page.fill('#threshold-input', '20');
  await page.click('#compute-btn');
  await page.waitForTimeout(500);

  const hash = await page.evaluate(() => location.hash);
  const originalLinear = await page.locator('#linear-headline').innerText();
  await page.close();

  const page2 = await openPage(hash);
  assert.equal(await page2.locator('#formula-input').inputValue(), 'F = 0.5 * rho * v^2 * Cd * A');
  assert.equal(await page2.locator('#linear-headline').innerText(), originalLinear);
  assert.equal(await page2.locator('#n-slider').inputValue(), '20000');
  assert.equal(await page2.locator('#threshold-input').inputValue(), '20');
  await page2.close();
});

test('reloading a shared URL keeps the loaded values instead of resetting them', async () => {
  const hash =
    '#f=F+%3D+0.5+*+rho+*+v%5E2+*+Cd+*+A&v=A%3A2.2%3A0.05%2CCd%3A0.3%3A0.02%2Crho%3A1.225%3A0.02%2Cv%3A30%3A3&n=10000&t=15';
  const page = await openPage(hash);

  // Regression: parseFormula() used to write defaults into the URL before
  // the v= overrides were applied, so the address bar silently reverted to
  // 1/0.1 even though the page displayed the real values. A reload then
  // reloaded from that stale, already-wrong address bar.
  const hashRightAfterLoad = await page.evaluate(() => location.hash);
  assert.match(hashRightAfterLoad, /rho%3A1\.225%3A0\.02/);

  await page.reload();
  await page.waitForTimeout(600);

  const values = { A: ['2.2', '0.05'], Cd: ['0.3', '0.02'], rho: ['1.225', '0.02'], v: ['30', '3'] };
  const rows = await page.locator('#var-table-body tr').all();
  for (const row of rows) {
    const name = await row.locator('td').first().innerText();
    const value = await row.locator('input[data-field=value]').inputValue();
    const sigma = await row.locator('input[data-field=sigma]').inputValue();
    assert.deepEqual([value, sigma], values[name], `variable ${name} should survive reload`);
  }
  await page.close();
});

test('a malformed or missing URL hash falls back to the default preset', async () => {
  const page = await openPage('#f=&garbage=1');
  assert.equal(await page.locator('#formula-input').inputValue(), 'v = d / t');
  assert.equal(page.pageErrors.length, 0);
  await page.close();
});

test('a non-numeric variable override in the URL is ignored safely', async () => {
  const page = await openPage('#f=' + encodeURIComponent('a = b + c') + '&v=b:notanumber:zz,c');
  const rows = await page.locator('#var-table-body tr').all();
  for (const row of rows) {
    const value = await row.locator('input[data-field=value]').inputValue();
    const sigma = await row.locator('input[data-field=sigma]').inputValue();
    assert.equal(value, '1');
    assert.equal(sigma, '0.1');
  }
  assert.equal(page.pageErrors.length, 0);
  await page.close();
});

test('footer link points at the actual repo', async () => {
  const page = await openPage();
  const href = await page.locator('footer a').first().getAttribute('href');
  assert.equal(href, 'https://github.com/jgarofoli/scatterbudget');
  await page.close();
});

test('shows a visible error if math.js or Chart.js fails to load', async () => {
  const page = await browser.newPage();
  const pageErrors = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));
  await page.route('**/cdn.jsdelivr.net/npm/mathjs@*/lib/browser/math.js', (route) => route.abort());
  await page.route('**/cdn.jsdelivr.net/npm/chart.js@*/dist/chart.umd.js', (route) => route.abort());
  await page.goto(INDEX_URL);
  await page.waitForTimeout(300);

  const banner = await page.locator('.wrap > .divergence-banner.flag').first().innerText();
  assert.match(banner, /Could not load math\.js and\/or Chart\.js/);
  assert.equal(pageErrors.length, 0);
  await page.close();
});
