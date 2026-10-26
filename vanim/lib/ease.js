// Shared timing helpers for vanim animations. Every animation is a pure function of t.
export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, k) => a + (b - a) * k;
// progress of t through [a, b], clamped to 0..1
export const seg = (t, a, b) => clamp((t - a) / (b - a));
export const easeOutCubic = (k) => 1 - Math.pow(1 - k, 3);
export const easeInCubic = (k) => k * k * k;
export const easeInOutCubic = (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
export const easeInOutSine = (k) => -(Math.cos(Math.PI * k) - 1) / 2;
export const easeOutBack = (k, s = 1.70158) => 1 + (s + 1) * Math.pow(k - 1, 3) + s * Math.pow(k - 1, 2);
export const easeInBack = (k, s = 1.70158) => (s + 1) * k * k * k - s * k * k;
// damped spring settling from 0 to 1: overshoots like a real bounce
export const spring = (k, freq = 3.2, damp = 5.5) =>
  k <= 0 ? 0 : 1 - Math.exp(-damp * k) * Math.cos(freq * Math.PI * 2 * k * 0.5);

// hex "#RRGGBB" -> [r, g, b] 0..255
export const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
export const shade = (hex, f) => {  // f > 0 lightens, f < 0 darkens
  const c = rgb(hex).map((v) => Math.round(f >= 0 ? v + (255 - v) * f : v * (1 + f)));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
};

// 4-point star sparkle on a 2D canvas: grows, spins, fades over life 0..1
export function sparkle(ctx, x, y, size, life, color = "#ffffff") {
  if (life <= 0 || life >= 1) return;
  const s = size * Math.sin(Math.PI * life);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(life * 1.2);
  ctx.globalAlpha = Math.min(1, 2.2 * Math.sin(Math.PI * life));
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, s * 0.9);
  g.addColorStop(0, "rgba(255,255,255,0.9)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(0, 0, s * 0.9, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2;
    ctx.lineTo(Math.cos(a) * s, Math.sin(a) * s);
    ctx.lineTo(Math.cos(a + Math.PI / 4) * s * 0.16, Math.sin(a + Math.PI / 4) * s * 0.16);
  }
  ctx.closePath(); ctx.fill();
  ctx.restore();
}
