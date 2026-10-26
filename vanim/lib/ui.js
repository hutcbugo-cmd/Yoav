// Shared building blocks for HTML/SVG vanim modules: elements, brand card, icons, particles.
import { shade } from "./ease.js";

export const el = (tag, css, html = "") => {
  const e = document.createElement(tag);
  if (css) e.style.cssText = css;
  e.innerHTML = html;
  return e;
};

// a centred stage of size W x H that modules build into
export function stage(root, W, H) {
  const s = el("div", `position:absolute;left:0;top:0;width:${W}px;height:${H}px;direction:rtl;
    font-family:Assistant;perspective:${W * 2.4}px`);
  root.append(s);
  return s;
}

// white rounded card with a soft brand-tinted shadow (the look of the phone UI)
export const card = (u, extra = "") => `background:#fff;border-radius:${6 * u}px;
  box-shadow:0 ${1.6 * u}px ${5 * u}px rgba(120,20,70,.22), 0 ${0.3 * u}px ${0.8 * u}px rgba(0,0,0,.08);${extra}`;

// pill label in the brand colour
export const pill = (u, A, extra = "") => `background:linear-gradient(90deg, ${shade(A, 0.15)}, ${A});color:#fff;
  border-radius:${20 * u}px;font:800 ${6 * u}px Assistant;padding:${1.6 * u}px ${5 * u}px;
  box-shadow:0 ${1.2 * u}px ${3.5 * u}px ${A}66;${extra}`;

export const nailTile = (color, r) => `background:
    radial-gradient(ellipse 30% 18% at 35% 22%, rgba(255,255,255,.75), rgba(255,255,255,0) 70%),
    linear-gradient(160deg, ${shade(color, 0.25)}, ${color} 55%, ${shade(color, -0.25)});
    border-radius:${r}`;

export const star = (fill, size = "1em") => `<svg viewBox="0 0 24 24" width="${size}" height="${size}"
  style="vertical-align:-0.12em"><path d="M12 2.6l2.9 6 6.5.9-4.7 4.6 1.1 6.5L12 17.5l-5.8 3.1 1.1-6.5-4.7-4.6 6.5-.9z"
  fill="${fill}"/></svg>`;

// simple filled icons (24x24 viewBox) drawn for these animations
export const ICONS = {
  megaphone: `<path d="M3 10v4a1 1 0 0 0 1 1h2l1 5h3l-1-5h1l8 4V5l-8 4H4a1 1 0 0 0-1 1z"/><path d="M20.5 9.5a3 3 0 0 1 0 5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>`,
  store: `<path d="M3 9l1.5-5h15L21 9a3 3 0 0 1-6 0 3 3 0 0 1-6 0 3 3 0 0 1-6 0z"/><path d="M4.5 12.5V20h15v-7.5"/><rect x="9.5" y="14.5" width="5" height="5.5" rx=".5" fill="#fff"/>`,
  moon: `<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>`,
  party: `<path d="M3 21l5-14 9 9z"/><circle cx="15" cy="4" r="1.4"/><circle cx="20" cy="9" r="1.4"/><path d="M12 7c1-2 3-3 5-2M17 12c2-1 3.5-.5 4.5 1" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>`,
  note: `<path d="M9 18V5l11-2v13" fill="none" stroke="currentColor" stroke-width="2.2"/><circle cx="6.5" cy="18" r="3"/><circle cx="17.5" cy="16" r="3"/>`,
  person: `<circle cx="12" cy="8" r="4.2"/><path d="M3.5 21a8.5 8 0 0 1 17 0z"/>`,
  pin: `<path d="M12 2a7 7 0 0 0-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 0 0-7-7z"/><circle cx="12" cy="9" r="2.6" fill="#fff"/>`,
  shield: `<path d="M12 2l8 3v6c0 5.2-3.4 9.4-8 11-4.6-1.6-8-5.8-8-11V5z"/>`,
  briefcase: `<path d="M9 4h6a2 2 0 0 1 2 2v1h3a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h3V6a2 2 0 0 1 2-2zm0 2v1h6V6z"/>`,
  crown: `<path d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5z"/>`,
  heart: `<path d="M12 21s-8-5.2-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 5.8-8 11-8 11z"/>`,
};
export const icon = (name, size, color) => `<svg viewBox="0 0 24 24" width="${size}" height="${size}"
  style="color:${color};fill:${color};display:block">${ICONS[name]}</svg>`;

// deterministic particles (pure function of k in 0..1): confetti / sparkle burst
export function burst(ctx, cx, cy, radius, k, colors, count = 40, seed0 = 7, gravity = 0.9) {
  if (k <= 0 || k >= 1) return;
  let seed = seed0;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < count; i++) {
    const a = rnd() * Math.PI * 2, v = (0.4 + rnd() * 0.6) * radius, spin = (rnd() - 0.5) * 12;
    const e = 1 - Math.pow(1 - k, 2.2);
    const x = cx + Math.cos(a) * v * e, y = cy + Math.sin(a) * v * e + gravity * radius * k * k;
    ctx.save();
    ctx.globalAlpha = 1 - Math.pow(k, 2.5);
    ctx.translate(x, y); ctx.rotate(spin * k);
    ctx.fillStyle = colors[i % colors.length];
    const s = radius * 0.05 * (0.6 + rnd());
    if (i % 3 === 0) { ctx.beginPath(); ctx.arc(0, 0, s * 0.45, 0, Math.PI * 2); ctx.fill(); }
    else ctx.fillRect(-s * 0.5, -s * 0.25, s, s * 0.5);
    ctx.restore();
  }
}

export function canvasLayer(parent, W, H) {
  const c = el("canvas", "position:absolute;left:0;top:0;pointer-events:none");
  c.width = W; c.height = H;
  parent.append(c);
  return c.getContext("2d");
}
