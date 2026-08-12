import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const manifestText = await readFile(new URL('../public/manifest.webmanifest', import.meta.url), 'utf8');
const manifest = JSON.parse(manifestText);
const serviceWorkerSource = await readFile(new URL('../public/sw.js', import.meta.url), 'utf8');
const registerSource = await readFile(new URL('../app/pwa-register.js', import.meta.url), 'utf8');
const layoutSource = await readFile(new URL('../app/layout.js', import.meta.url), 'utf8');

test('manifest exposes Project Ledger as a standalone installable application', () => {
  assert.equal(manifest.name, 'Project Ledger');
  assert.equal(manifest.short_name, 'Ledger');
  assert.equal(manifest.start_url, '/');
  assert.equal(manifest.scope, '/');
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.theme_color, '#080909');
  assert.equal(manifest.background_color, '#080909');
  assert.ok(manifest.icons.some((icon) => icon.sizes === '192x192'));
  assert.ok(manifest.icons.some((icon) => icon.sizes === '512x512'));
  assert.ok(manifest.icons.some((icon) => String(icon.purpose).includes('maskable')));
});

test('root layout publishes manifest, mobile viewport, and service worker registration', () => {
  assert.match(layoutSource, /manifest: '\/manifest\.webmanifest'/);
  assert.match(layoutSource, /themeColor: '#080909'/);
  assert.match(layoutSource, /<PwaRegister \/>/);
  assert.match(registerSource, /navigator\.serviceWorker\.register\('\/sw\.js'/);
});

test('service worker never caches financial data or deployed application assets', () => {
  assert.match(serviceWorkerSource, /request\.mode === 'navigate'/);
  assert.match(serviceWorkerSource, /url\.pathname\.startsWith\('\/api\/'\)/);
  assert.match(serviceWorkerSource, /event\.respondWith\(fetch\(request\)\)/);
  assert.doesNotMatch(serviceWorkerSource, /cache\.put\(/);
  assert.doesNotMatch(serviceWorkerSource, /caches\.match\(/);
});
