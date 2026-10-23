// Renders the delivery flight (dev page ?capture=desktop|mobile) into PNG frames with a fixed
// 30 fps clock while the scroll progress moves at constant speed, then the frames become the
// scroll-scrubbed video (see encode.sh).
// Usage: npx vite --port 5180  (in another terminal), then
//   node tools/delivery-video/capture.cjs desktop|mobile <outDir> [playwright-core path]
const fs = require('fs'), path = require('path'), os = require('os');
const [layout, outDir, pwPath] = process.argv.slice(2);
const { chromium } = require(pwPath || 'playwright-core');
const SIZE = { desktop: [1280, 720], mobile: [720, 1280] }[layout];
const MOVE = 150; // frames while the section scrolls 0 → 1
const SETTLE = 24; // extra frames at the end so the landing settles
const WARM = 20; // unrecorded frames at the start
const DT = 1 / 30;

function chromiumPath() {
  const base = path.join(os.homedir(), 'Library/Caches/ms-playwright');
  return fs.readdirSync(base).filter((d) => /^chromium-\d+$/.test(d)).sort().reverse()
    .flatMap((d) => ['chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing', 'chrome-mac/Chromium.app/Contents/MacOS/Chromium'].map((p) => path.join(base, d, p)))
    .find(fs.existsSync);
}

(async () => {
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch({ headless: true, executablePath: chromiumPath(), args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: SIZE[0], height: SIZE[1] }, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => console.error('pageerror', e.message));
  await page.goto(`http://localhost:5180/?capture=${layout}`);
  await page.waitForFunction(() => window.__capReady === true, null, { timeout: 60000 });
  let time = 0.1;
  for (let i = 0; i < WARM; i++) await page.evaluate(([t]) => { window.__capStep(0, t); }, [(time += DT)]);
  const total = MOVE + SETTLE;
  for (let i = 0; i < total; i++) {
    const p = Math.min(1, i / (MOVE - 1));
    const url = await page.evaluate(([pp, t]) => window.__capStep(pp, t), [p, (time += DT)]);
    fs.writeFileSync(path.join(outDir, `f${String(i).padStart(4, '0')}.png`), Buffer.from(url.split(',')[1], 'base64'));
  }
  console.log(`${layout}: ${total} frames → ${outDir}`);
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
