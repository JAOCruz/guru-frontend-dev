// Renders the delivery flight (dev page ?capture=desktop|mobile) into PNG frames with a fixed
// 60 fps clock while the scroll progress moves at constant speed, then the frames become the
// scroll-scrubbed video (see encode.sh).
// Usage (frames are ~1.5× the final size): npx vite --port 5180  (in another terminal), then
//   node tools/delivery-video/capture.cjs desktop|mobile <outDir> [playwright-core path]
const fs = require('fs'), path = require('path'), os = require('os');
const [layout, outDir, pwPath] = process.argv.slice(2);
const { chromium } = require(pwPath || 'playwright-core');
const SIZE = { desktop: [1920, 1080], mobile: [1080, 1920] }[layout];
// rendered 1.5× and scaled down by encode.sh (supersampling = clean edges)
const SCALE = 1.5;
// where the subject moves so the page's text panel never covers it (take-off: a little right of the title, which sits on the left; landing: right of the card on desktop);
// [x, y] at take-off → at the landing
const SHIFT = { desktop: [[0.27, 0.02], [0.02, 0]], mobile: [[0, 0.2], [0, 0.04]] }[layout];
// 60 fps so that playing slower than 1× (slow scrolling) still shows a new frame on most screen refreshes
const FPS = 60;
const MOVE = 300; // frames while the section scrolls 0 → 1
const SETTLE = 48; // extra frames at the end so the landing settles
const WARM = 40; // unrecorded frames at the start
const DT = 1 / FPS;

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
  await page.goto(`http://localhost:5180/?capture=${layout}&scale=${SCALE}&sx=${SHIFT[0][0]}&sy=${SHIFT[0][1]}&ex=${SHIFT[1][0]}&ey=${SHIFT[1][1]}`);
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
