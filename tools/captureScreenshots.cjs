#!/usr/bin/env node
/**
 * captureScreenshots.cjs — Capture landing-page gallery screenshots with Playwright.
 *
 * Usage:
 *   node tools/captureScreenshots.cjs          # starts its own server
 *   NO_WEBSERVER=1 node tools/captureScreenshots.cjs   # use an already-running server
 *
 * Outputs:
 *   pages/assets/screenshots/editor-split.png
 *   pages/assets/screenshots/editor-headless.png
 *   pages/assets/screenshots/quikchat-integration.png
 */

const { chromium } = require('playwright');
const { execSync, spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'pages', 'assets', 'screenshots');
const PORT = 8787;
const BASE = `http://localhost:${PORT}`;

// How long to wait for fence plugins (mermaid, mathjax, hljs) to render
const FENCE_WAIT = 3000;

async function ensureServer() {
  if (process.env.NO_WEBSERVER === '1') return null;
  // Start a static file server in the background
  const srv = spawn('npx', ['serve', ROOT, '-l', String(PORT)], {
    stdio: 'ignore',
    detached: true,
  });
  // Give it a moment to start
  await new Promise(r => setTimeout(r, 2000));
  return srv;
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });

  const server = await ensureServer();
  const browser = await chromium.launch({ headless: true });

  try {
    // ── 1. Split-view editor (dark theme for product-shot contrast) ──
    {
      const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
      await page.goto(`${BASE}/pages/edit/`, { waitUntil: 'networkidle' });

      // Switch to dark theme
      await page.evaluate(() => {
        document.body.classList.remove('qd-theme-light', 'qd-theme-auto');
        document.body.classList.add('qd-theme-dark');
        if (window.editor) window.editor.setTheme('dark');
      });

      // Wait for fence plugins to render
      await page.waitForTimeout(FENCE_WAIT);

      // Screenshot just the editor area
      const editor = page.locator('.edit-page-editor');
      await editor.screenshot({ path: path.join(OUT, 'editor-split.png') });
      console.log('  ✓ editor-split.png');
      await page.close();
    }

    // ── 2. Headless mode ──
    {
      const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
      await page.goto(`${BASE}/pages/examples/demo-headless.html`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(1500);

      // Click "Load Sample" to populate with interesting content
      await page.click('#btn-load-sample');
      await page.waitForTimeout(1000);

      // Screenshot the headless section: custom toolbar + editor
      const headlessWrap = page.locator('.qde-headless-wrap').first();
      const toolbar = page.locator('.qde-custom-toolbar').first();

      // Get bounding boxes and combine
      const tbBox = await toolbar.boundingBox();
      const edBox = await headlessWrap.boundingBox();
      if (tbBox && edBox) {
        const clip = {
          x: Math.min(tbBox.x, edBox.x) - 8,
          y: tbBox.y - 8,
          width: Math.max(tbBox.x + tbBox.width, edBox.x + edBox.width) - Math.min(tbBox.x, edBox.x) + 16,
          height: (edBox.y + edBox.height) - tbBox.y + 16,
        };
        await page.screenshot({ path: path.join(OUT, 'editor-headless.png'), clip });
      } else {
        const card = page.locator('.qde-card').first();
        await card.screenshot({ path: path.join(OUT, 'editor-headless.png') });
      }
      console.log('  ✓ editor-headless.png');
      await page.close();
    }

    // ── 3. quikchat integration ──
    {
      const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
      await page.goto(`${BASE}/pages/examples/integration-quikchat.html`, { waitUntil: 'networkidle' });

      // Wait for mermaid + mathjax to render in the chat
      await page.waitForTimeout(FENCE_WAIT);

      // Scroll chat to top so we see the interesting opening bubbles
      await page.evaluate(() => {
        const chat = document.querySelector('.chat-demo');
        if (chat) chat.scrollTop = 0;
      });
      await page.waitForTimeout(500);

      // Screenshot the chat demo area
      const chatDemo = page.locator('.chat-demo').first();
      await chatDemo.screenshot({ path: path.join(OUT, 'quikchat-integration.png') });
      console.log('  ✓ quikchat-integration.png');
      await page.close();
    }

    console.log(`\n  Screenshots saved to ${path.relative(ROOT, OUT)}/`);

  } finally {
    await browser.close();
    if (server) {
      // Kill the server process group
      try { process.kill(-server.pid, 'SIGTERM'); } catch (_e) {}
      server.unref();
    }
  }
}

main().catch(err => {
  console.error('Screenshot capture failed:', err);
  process.exit(1);
});
