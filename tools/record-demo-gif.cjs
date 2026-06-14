/**
 * Record an animated GIF demo of the QuikdownEditor.
 *
 * Usage:
 *   node tools/record-demo-gif.cjs
 *
 * Requires: Playwright, ffmpeg
 * Outputs:  pages/assets/editor-demo.gif
 */

const { chromium } = require('playwright');
const http = require('http');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

const FRAME_DIR = path.join(__dirname, '..', '.gif-frames');
const OUTPUT = path.join(__dirname, '..', 'pages', 'assets', 'editor-demo.gif');
const WIDTH = 1100;
const HEIGHT = 570;

// Each stage sets content and captures a frame
const STAGES = [
  {
    md: '## Quikdown Demo\n\nA **lightweight** markdown parser and _editor_ for browsers and Node.js.\n',
    pause: 1500,
    label: 'basic-markdown',
  },
  {
    md: '## Quikdown Demo\n\nA **lightweight** markdown parser and _editor_ for browsers and Node.js.\n\n### Diagram\n\n```mermaid\ngraph LR;\n  A[Markdown] --> B[Parser];\n  B --> C[HTML];\n  C --> D[Editor];\n  D -->|round-trip| A;\n```\n',
    pause: 4000,
    label: 'mermaid',
  },
  {
    md: '## Quikdown Demo\n\nA **lightweight** markdown parser and _editor_ for browsers and Node.js.\n\n### Diagram\n\n```mermaid\ngraph LR;\n  A[Markdown] --> B[Parser];\n  B --> C[HTML];\n  C --> D[Editor];\n  D -->|round-trip| A;\n```\n\n### Math\n\n```math\nx = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}\n```\n',
    pause: 3000,
    label: 'math',
  },
  {
    md: '## Quikdown Demo\n\nA **lightweight** markdown parser and _editor_ for browsers and Node.js.\n\n### Diagram\n\n```mermaid\ngraph LR;\n  A[Markdown] --> B[Parser];\n  B --> C[HTML];\n  C --> D[Editor];\n  D -->|round-trip| A;\n```\n\n### Math\n\n```math\nx = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}\n```\n\n### Code\n\n```javascript\nimport QuikdownEditor from \'quikdown/edit\';\n\nconst editor = new QuikdownEditor(\'#app\', {\n  mode: \'split\',\n  theme: \'auto\',\n  showUndoRedo: true\n});\n```\n',
    pause: 2500,
    label: 'code',
  },
];

async function main() {
  // Clean up / create frame directory
  if (fs.existsSync(FRAME_DIR)) {
    fs.rmSync(FRAME_DIR, { recursive: true });
  }
  fs.mkdirSync(FRAME_DIR, { recursive: true });

  // Start a simple static file server for ESM imports
  const ROOT = path.join(__dirname, '..');
  const MIME = {
    '.html': 'text/html', '.js': 'application/javascript', '.mjs': 'application/javascript',
    '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml',
  };
  const server = http.createServer((req, res) => {
    const filePath = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      res.writeHead(404); res.end(); return;
    }
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    fs.createReadStream(filePath).pipe(res);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const PORT = server.address().port;

  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: WIDTH, height: HEIGHT },
    deviceScaleFactor: 1,  // 1x — GIF doesn't benefit from retina
  });
  const page = await context.newPage();

  await page.goto(`http://127.0.0.1:${PORT}/tools/record-demo-page.html`);
  await page.waitForFunction(() => window.__editorReady === true, { timeout: 15000 });
  await page.waitForTimeout(1000);

  let frameIndex = 0;

  const captureFrame = async (label) => {
    const framePath = path.join(FRAME_DIR, `frame-${String(frameIndex).padStart(4, '0')}-${label}.png`);
    const editorEl = await page.$('#editor');
    await editorEl.screenshot({ path: framePath });
    frameIndex++;
    console.log(`  captured frame ${frameIndex}: ${label}`);
  };

  console.log('Recording demo frames...');

  for (const stage of STAGES) {
    await page.evaluate((md) => window.editor.setMarkdown(md), stage.md);
    await page.waitForTimeout(stage.pause);
    await captureFrame(stage.label);
  }

  // Hold on final frame
  await captureFrame('final-hold');

  await browser.close();
  server.close();

  console.log(`\nStitching ${frameIndex} frames into GIF...`);

  const frames = fs.readdirSync(FRAME_DIR)
    .filter(f => f.endsWith('.png'))
    .sort()
    .map(f => path.join(FRAME_DIR, f));

  // Create concat file for ffmpeg with per-frame durations
  const fileList = frames
    .map((f, i) => {
      const duration = i >= frames.length - 1 ? 3.0 : 2.0;
      return `file '${f}'\nduration ${duration}`;
    })
    .join('\n');
  const concatFile = path.join(FRAME_DIR, 'frames.txt');
  fs.writeFileSync(concatFile, fileList + `\nfile '${frames[frames.length - 1]}'`);

  // Two-pass GIF: palette then render
  const palettePath = path.join(FRAME_DIR, 'palette.png');
  execSync(
    `ffmpeg -y -f concat -safe 0 -i "${concatFile}" -vf "palettegen=stats_mode=diff:max_colors=256" -update 1 "${palettePath}"`,
    { stdio: 'pipe' }
  );

  execSync(
    `ffmpeg -y -f concat -safe 0 -i "${concatFile}" -i "${palettePath}" -lavfi "[0:v] [1:v] paletteuse=dither=bayer:bayer_scale=3" -loop 0 "${OUTPUT}"`,
    { stdio: 'pipe' }
  );

  // Clean up frames
  fs.rmSync(FRAME_DIR, { recursive: true });

  const stats = fs.statSync(OUTPUT);
  console.log(`Done! GIF saved to: ${OUTPUT}`);
  console.log(`Size: ${(stats.size / 1024 / 1024).toFixed(1)} MB`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
