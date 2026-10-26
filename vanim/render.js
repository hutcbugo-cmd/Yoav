#!/usr/bin/env node
// Render one vanim animation to a transparent PNG sequence.
//   node vanim/render.js <Name> --params '{"color":"#FF2E8B"}' --w 1080 --h 1080 --fps 30 --out dir
// Writes dir/f_00000.png ... and dir/info.json {w, h, fps, n, duration, sfx: [{t, name, gain}]}.
// Chromium is driven frame by frame (no real-time playback), so slow 3D frames never drop.
const http = require("http");
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const args = process.argv.slice(2);
const opt = { params: "{}", w: "1080", h: "1080", fps: "30", out: "out" };
const name = args[0];
for (let i = 1; i < args.length; i += 2) opt[args[i].replace(/^--/, "")] = args[i + 1];

const ROOT = path.resolve(__dirname, "..");  // serves vanim/ and assets/
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript",
                ".ttf": "font/ttf", ".png": "image/png", ".jpg": "image/jpeg", ".json": "application/json",
                ".svg": "image/svg+xml", ".webp": "image/webp" };

function serve() {
  const srv = http.createServer((req, res) => {
    const p = path.normalize(path.join(ROOT, decodeURIComponent(req.url.split("?")[0])));
    if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) {
      res.writeHead(404); res.end(); return;
    }
    res.writeHead(200, { "Content-Type": TYPES[path.extname(p)] || "application/octet-stream" });
    fs.createReadStream(p).pipe(res);
  });
  return new Promise((ok) => srv.listen(0, "127.0.0.1", () => ok(srv)));
}

(async () => {
  const W = +opt.w, H = +opt.h, fps = +opt.fps;
  fs.mkdirSync(opt.out, { recursive: true });
  const srv = await serve();
  // several browsers render interleaved frames in parallel (frames are pure functions of t).
  // One browser per worker: pages of one browser share its single (CPU) GPU process.
  const workers = Math.max(1, +(opt.workers || Math.min(4, require("os").cpus().length)));
  const browsers = [];
  const open = async () => {
    const browser = await chromium.launch({
      args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
    browsers.push(browser);
    const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
    page.on("console", (m) => { if (m.type() === "error") console.error("[page]", m.text()); });
    page.on("pageerror", (e) => { console.error("[page]", e.message); process.exitCode = 1; });
    await page.goto(`http://127.0.0.1:${srv.address().port}/vanim/stage.html?anim=${name}`);
    await page.waitForFunction(() => window.__ready === true, null, { timeout: 30000 });
    const info = await page.evaluate(([p, w, h]) => window.__setup(p, w, h), [JSON.parse(opt.params), W, H]);
    return { page, info, root: await page.$("#root") };
  };
  const t0 = Date.now();
  const pages = await Promise.all(Array.from({ length: workers }, open));
  const info = pages[0].info;
  const duration = info.duration;
  const n = Math.round(duration * fps);
  await Promise.all(pages.map(async ({ page, root }, w) => {
    for (let i = w; i < n; i += workers) {
      await page.evaluate((t) => window.__frame(t), i / fps);
      await root.screenshot({ path: path.join(opt.out, `f_${String(i).padStart(5, "0")}.png`), omitBackground: true });
    }
  }));
  fs.writeFileSync(path.join(opt.out, "info.json"),
                   JSON.stringify({ w: W, h: H, fps, n, duration, sfx: info.sfx || [] }, null, 1));
  console.log(`${name}: ${n} frames ${W}x${H} in ${((Date.now() - t0) / 1000).toFixed(1)} s (${workers} workers)`);
  await Promise.all(browsers.map((b) => b.close()));
  srv.close();
})();
