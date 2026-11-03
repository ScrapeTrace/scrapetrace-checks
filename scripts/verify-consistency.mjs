import assert from 'node:assert/strict';
import {mkdir, mkdtemp, rm, writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import worker from '../dist/_worker.js';
import {serve} from './local-server.mjs';
const p = process.env.PUPPETEER_MODULE ? (await import(pathToFileURL(process.env.PUPPETEER_MODULE))).default : (await import('puppeteer-core')).default;
const server = await serve(worker);
const profile = await mkdtemp('/tmp/checks-consistency-profile-');
const output = process.env.CONSISTENCY_OUTPUT || await mkdtemp('/tmp/checks-consistency-review-');
await mkdir(output, {recursive: true});
let browser;
const checks = [];
try {
  for (const path of ['/consistency', '/consistency/full', '/consistency/frame', '/consistency/worker.js', '/consistency/shared-worker.js', '/consistency/service-worker.js']) {
    assert.equal((await worker.fetch(new Request(server.url + path))).status, 200);
    assert.equal((await worker.fetch(new Request(server.url + path, {method: 'POST'}))).status, 405);
  }
  const frameHeaders = (await worker.fetch(new Request(server.url + '/consistency/frame'))).headers;
  assert(frameHeaders.get('content-security-policy').includes("frame-ancestors 'self'"));
  checks.push('new routes, method restrictions and frame CSP');
  browser = await p.launch({executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', headless: true, userDataDir: profile, args: process.env.ST005_NO_SANDBOX === '1' ? ['--no-sandbox'] : []});
  const page = await browser.newPage(); const errors = [];
  page.on('pageerror', error => errors.push(String(error)));
  async function load(path, target = page) {
    await target.goto(server.url + path);
    await target.waitForSelector('#probe-complete', {timeout: 20000});
    return target.evaluate(() => window.__PROBE_RESULT__);
  }
  let result = await load('/consistency');
  assert.equal(result.complete, true);
  assert.equal(result.uaComparison.status, 'matching');
  assert.equal(Object.values(result.contexts).filter(c => c.status === 'ok').length, 5);
  assert.equal(result.contexts.service.cleanup, 'unregistered');
  assert.equal(await page.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).length), 0);
  assert.equal(await page.$('iframe'), null);
  assert.equal(await page.$eval('#headless', el => el.hidden), false);
  assert.equal(await page.$eval('.context details', el => el.open), false);
  checks.push('five real contexts agree; headless UA shown; worker details collapsed; temporary resources cleaned');
  await page.setViewport({width: 1360, height: 900});
  await page.screenshot({path: output + '/simple-desktop.png', fullPage: true});
  result = await load('/consistency/full');
  assert(result.propertyComparison.length > 30);
  assert(result.propertyComparison.some(r => r.property === 'hardwareConcurrency'));
  assert(result.propertyComparison.some(r => r.property === 'webdriver' && r.comparison === 'Availability differs'));
  assert(result.contexts.page.properties.plugins.type === 'object');
  assert.equal(result.contexts.service.cleanup, 'unregistered');
  await page.click('#differences');
  assert.equal(await page.$$eval('#rows tr', rows => rows.filter(r => r.dataset.comparison === 'Matches').every(r => r.hidden)), true);
  await page.screenshot({path: output + '/full-desktop.png', fullPage: true});
  await page.setViewport({width: 390, height: 844});
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await page.screenshot({path: output + '/full-mobile.png', fullPage: true});
  await load('/consistency');
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await page.screenshot({path: output + '/simple-mobile.png', fullPage: true});
  checks.push('full property inventory, expected worker API gaps, difference filter and desktop/mobile layouts');
  const changed = await browser.newPage();
  await changed.evaluateOnNewDocument(() => {
    if (self === top) {
      Object.defineProperty(navigator, 'userAgent', {get: () => '<img src=x onerror=alert(1)> Controlled UA'});
      Object.defineProperty(navigator, 'hardwareConcurrency', {get() { throw new Error('Controlled getter failure'); }});
      Object.defineProperty(navigator, 'languages', {value: ['controlled-test-language']});
      Object.defineProperty(navigator, 'sharedWorkerTestValue', {value: 'own property'});
      Object.defineProperty(window, 'SharedWorker', {value: undefined});
    }
  });
  result = await load('/consistency/full', changed);
  assert.equal(result.uaComparison.status, 'different');
  assert.equal(result.contexts.shared.status, 'unavailable');
  assert.equal(result.contexts.page.properties.hardwareConcurrency.type, 'error');
  assert(result.propertyComparison.some(r => r.property === 'languages' && r.comparison === 'Values differ'));
  assert(result.propertyComparison.some(r => r.property === 'hardwareConcurrency' && r.comparison === 'Unreadable'));
  assert(result.propertyComparison.some(r => r.property === 'sharedWorkerTestValue'));
  assert.equal(await changed.$eval('.context details', el => el.open), true);
  assert.equal(await changed.$('#contexts img'), null);
  checks.push('controlled UA and language mismatches, unavailable worker, throwing getter, own navigator property and safe rendering');
  await changed.close();
  const blocked = await browser.newPage();
  await blocked.evaluateOnNewDocument(() => {
    Object.defineProperty(window, 'SharedWorker', {value: undefined});
    Object.defineProperty(navigator, 'serviceWorker', {value: undefined});
    Object.defineProperty(window, 'Worker', {value: class {postMessage() {} terminate() {}}});
  });
  result = await load('/consistency', blocked);
  assert.equal(result.uaComparison.status, 'incomplete');
  assert.match(result.contexts.dedicated.reason, /Timed out/);
  assert.equal(result.contexts.service.status, 'unavailable');
  checks.push('worker timeout and unavailable APIs complete with incomplete comparison');
  await blocked.close();
  // CDP applies a non-headless UA to all targets in a fresh browser process.
  await browser.close(); browser = null;
  browser = await p.launch({executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', headless: true, userDataDir: profile, args: ['--user-agent=Controlled Browser/1.0', ...(process.env.ST005_NO_SANDBOX === '1' ? ['--no-sandbox'] : [])]});
  const normal = await browser.newPage();
  result = await load('/consistency', normal);
  assert.equal(result.uaComparison.status, 'matching');
  assert.equal(await normal.$eval('#headless', el => el.hidden), true);
  assert.equal(await normal.$eval('#headless', el => el.textContent), '');
  await normal.click('#run'); await normal.waitForSelector('#probe-complete');
  assert.equal(await normal.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).length), 0);
  checks.push('no headless notice when absent from UA; rerun cleans temporary registration');
  assert.deepEqual(errors, []);
  await writeFile(output + '/verification.json', JSON.stringify({browser: await browser.version(), checks, purpose: 'UI and functional verification, not research measurements'}, null, 2));
  console.log(checks.join('\n') + '\nReview files: ' + output);
} finally {
  await browser?.close(); await rm(profile, {recursive: true, force: true}); await server.close();
}
