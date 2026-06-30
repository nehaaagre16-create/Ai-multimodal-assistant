const { test, expect } = require('@playwright/test');
const path = require('path');

const BASE_URL = process.env.BASE_URL || 'http://localhost:5173';
const API_URL = process.env.API_URL || 'http://localhost:4001';
const SCREENSHOT_DIR = path.join(__dirname, 'screenshots');

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const results = [];

function record(check, passed, detail = '') {
  results.push({ check, passed, detail });
  console.log(`[${passed ? 'PASS' : 'FAIL'}] ${check}${detail ? ' - ' + detail : ''}`);
}

test('smoke test dashboard', async ({ page, browserName }) => {
  test.setTimeout(120000);
  // 1. Page loads
  try {
    await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 15000 });
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '01-landing.png') });
    const title = await page.title();
    record('Page loads', title.includes('AI Multimodal Assistant'), `title: ${title}`);
  } catch (e) {
    record('Page loads', false, e.message);
    throw e;
  }

  // 2. Three-column layout visible
  try {
    const startBtn = page.locator('button').filter({ hasText: /Start Chat/i }).first();
    await startBtn.waitFor({ timeout: 5000 });
    await startBtn.click();
    await page.waitForURL('**/chat', { timeout: 5000 });
    await page.waitForSelector('text=You', { timeout: 5000 });
    await page.waitForSelector('text=Assistant Status', { timeout: 5000 });
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '02-three-column.png') });
    const left = await page.locator('text=Nexus AI').first().isVisible();
    const center = await page.locator('text=You').first().isVisible();
    const right = await page.locator('text=Assistant Status').first().isVisible();
    record('Three-column layout visible', left && center && right, `left=${left} center=${center} right=${right}`);
  } catch (e) {
    record('Three-column layout visible', false, e.message);
  }

  // 3. Navigation works
  const navChecks = [
    { label: 'Home', path: '/', selector: 'text=Nexus AI' },
    { label: 'Chat', path: '/chat', selector: 'text=You' },
    { label: 'Settings', path: '/settings', selector: 'text=Settings' },
    { label: 'Profile', path: '/profile', selector: 'text=Profile' },
    { label: 'History', path: '/history', selector: 'text=History' },
    { label: 'Memory', path: '/memory', selector: 'text=Memory' },
    { label: 'Files', path: '/files', selector: 'text=Files' },
  ];
  for (const nav of navChecks) {
    try {
      await page.click(`nav button:has-text("${nav.label}")`);
      await page.waitForURL(`**${nav.path}`, { timeout: 5000 });
      await page.waitForSelector(nav.selector, { timeout: 5000 });
      record(`Navigation: ${nav.label}`, true);
    } catch (e) {
      record(`Navigation: ${nav.label}`, false, e.message);
    }
  }
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '03-navigation.png') });

  // 4. Chat sends message and gets AI reply
  try {
    await page.click('nav button:has-text("Chat")');
    await page.waitForURL('**/chat', { timeout: 5000 });
    const input = page.locator('input[placeholder*="message"], textarea[placeholder*="message"], input[type="text"]').first();
    await input.waitFor({ timeout: 5000 });
    await input.fill('Hello, what is 2+2?');
    await input.press('Enter');
    await page.waitForSelector('text=Hello, what is 2+2?', { timeout: 5000 });
    // Wait for AI reply to appear (up to 30s)
    await page.waitForFunction(() => {
      const bubbles = document.querySelectorAll('div');
      return Array.from(bubbles).some(el => el.textContent?.includes('4') || el.textContent?.includes('four'));
    }, { timeout: 30000 });
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '04-chat-reply.png') });
    const aiText = await page.locator('text=4').first().isVisible().catch(() => false);
    record('Chat sends message and gets AI reply', aiText, 'AI replied with 4/four');
  } catch (e) {
    record('Chat sends message and gets AI reply', false, e.message);
  }

  // 5. Webcam preview can be toggled
  try {
    await page.click('nav button:has-text("Chat")');
    await page.waitForURL('**/chat', { timeout: 5000 });
    const camBtn = page.locator('button').filter({ has: page.locator('svg[data-lucide="camera-off"], svg[data-lucide="camera"]') }).first();
    await camBtn.waitFor({ timeout: 5000 });
    await camBtn.click();
    await sleep(2000);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '05-webcam-on.png') });
    // Check video element exists and is visible
    const video = page.locator('video').first();
    const hasVideo = await video.isVisible().catch(() => false);
    record('Webcam preview can be toggled', hasVideo, 'video element visible after toggle');
    await camBtn.click();
    await sleep(500);
  } catch (e) {
    record('Webcam preview can be toggled', false, e.message);
  }

  // 6. Status bar shows connected
  try {
    await page.click('nav button:has-text("Chat")');
    await page.waitForURL('**/chat', { timeout: 5000 });
    const connected = await page.locator('text=Connected').first().isVisible({ timeout: 5000 });
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '06-status-connected.png') });
    record('Status bar shows connected', connected);
  } catch (e) {
    record('Status bar shows connected', false, e.message);
  }

  // Print summary
  console.log('\n=== SMOKE TEST SUMMARY ===');
  const passed = results.filter(r => r.passed).length;
  const total = results.length;
  console.log(`${passed}/${total} checks passed`);
  results.filter(r => !r.passed).forEach(r => console.log(`- FAIL: ${r.check} (${r.detail})`));
  console.log('==========================\n');

  expect(passed).toBe(total);
});
