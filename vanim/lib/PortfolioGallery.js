// PortfolioGallery ("see her portfolio"): a stack of photo cards of finished manicures fans out like
// a hand of cards, the gallery is browsed card by card, and the favourite lifts forward with a heart.
// Each card shows three fingers with a different design (french, ombre, glitter, classic red, dots).
// params: accent, title, designs [...], focus (index), hold, exit
import { seg, lerp, clamp, easeOutBack, easeInBack, easeOutCubic, easeInOutCubic, spring, sparkle } from "./ease.js";
import { el, stage, pill, icon, canvasLayer } from "./ui.js";

let S;

const DESIGNS = {
  french: "linear-gradient(to bottom, #fffaf6 0 30%, #f3cfc4 33%, #efc2b6)",
  ombre: "linear-gradient(to bottom, #b14fc5, #f06aa8 55%, #fbd0e2)",
  glitter: "radial-gradient(rgba(255,255,255,.95) 18%, transparent 20%) 0 0/7px 7px, radial-gradient(rgba(255,240,200,.8) 14%, transparent 16%) 3px 4px/9px 9px, linear-gradient(160deg, #f7a8c4, #c2457a)",
  red: "linear-gradient(160deg, #ff4d6d, #c1121f 60%, #8a0b16)",
  dots: "radial-gradient(circle, #FF2E8B 0 22%, transparent 25%) 0 0/9px 9px, linear-gradient(#fbe7dd, #f3d3c6)",
};

function hand(design, u) {
  // three fingers, nails on top, with a glossy highlight per nail
  const f = (h, dx) => `<div style="position:relative;width:${7 * u}px;height:${h * u}px;margin-top:${(30 - h) * u}px;
    border-radius:${3.5 * u}px ${3.5 * u}px ${1 * u}px ${1 * u}px;background:linear-gradient(90deg, #e3a688, #f2c3a8 45%, #dca084);
    transform:translateX(${dx}px)">
    <div style="position:absolute;left:${0.9 * u}px;right:${0.9 * u}px;top:${0.7 * u}px;height:${8.6 * u}px;
      border-radius:${2.6 * u}px ${2.6 * u}px ${1.4 * u}px ${1.4 * u}px;background:${DESIGNS[design]};overflow:hidden;
      box-shadow:inset 0 0 0 ${0.25 * u}px rgba(0,0,0,.08)">
      <div style="position:absolute;left:18%;top:10%;width:26%;height:45%;border-radius:50%;
        background:radial-gradient(rgba(255,255,255,.85), rgba(255,255,255,0) 70%)"></div></div></div>`;
  return `<div style="display:flex;justify-content:center;gap:${0.8 * u}px;height:100%;
    background:linear-gradient(160deg, #fff5f8, #fde3ec)">${f(24, 0)}${f(28, 0)}${f(25, 0)}</div>`;
}

export default {
  async setup(root, params, W, H) {
    const p = Object.assign({ accent: "#FF2E8B", title: "תיק העבודות", designs: ["french", "ombre", "glitter", "red", "dots"],
      likes: ["214", "387", "512", "268", "190"], focus: 2, hold: 0.4, exit: true }, params);
    const u = W / 100;
    const st = stage(root, W, H);
    const head = el("div", `position:absolute;left:50%;top:${4 * u}px;white-space:nowrap;display:flex;align-items:center;
      gap:${2 * u}px;${pill(u, p.accent)}`, `${icon("heart", 5.5 * u, "#fff")}<span>${p.title}</span>`);
    const cw = 30 * u, ch = 40 * u;
    const cards = p.designs.map((d, i) => {
      const c = el("div", `position:absolute;left:${(W - cw) / 2}px;top:${H * 0.52 - ch / 2}px;width:${cw}px;height:${ch}px;
        background:#fff;border-radius:${3 * u}px;padding:${1.6 * u}px;box-sizing:border-box;transform-origin:50% 120%;
        box-shadow:0 ${1.4 * u}px ${4 * u}px rgba(90,15,51,.3)`);
      const ph = el("div", `height:${31 * u}px;border-radius:${2 * u}px;overflow:hidden`, hand(d, u));
      const meta = el("div", `display:flex;align-items:center;gap:${1 * u}px;font:800 ${3.6 * u}px Assistant;color:#8a6b78;
        padding:${1 * u}px ${0.6 * u}px 0;direction:ltr`, `${icon("heart", 3.6 * u, p.accent)}<span>${p.likes[i % p.likes.length]}</span>`);
      c.append(ph, meta);
      st.append(c);
      return c;
    });
    st.append(head);
    const fx = canvasLayer(st, W, H);
    const dur = 1.75 + p.hold + (p.exit ? 0.3 : 0);
    S = { p, u, W, H, head, cards, fx, dur };
    return {
      duration: dur,
      sfx: [{ t: 0, name: "pop", gain: -6 }, { t: 0.22, name: "whoosh2", gain: -8 },
            ...cards.map((_, i) => ({ t: 0.3 + i * 0.09, name: "pop2", gain: -16 })),
            { t: 1.25, name: "click", gain: -10 }, { t: 1.4, name: "sparkle", gain: -6 }, { t: 1.5, name: "pop", gain: -8 },
            ...(p.exit ? [{ t: dur - 0.3, name: "whoosh2", gain: -14 }] : [])],
    };
  },

  async frame(t) {
    const s = S, u = s.u, p = s.p, n = s.cards.length;
    const ex = p.exit ? easeInBack(seg(t, s.dur - 0.3, s.dur), 1.6) : 0;
    const hk = seg(t, 0, 0.3);
    s.head.style.transform = `translateX(-50%) scale(${hk <= 0 ? 0.001 : easeOutBack(hk, 2.4) * (1 - ex) + 0.001})`;
    s.cards.forEach((c, i) => {
      const mid = i - (n - 1) / 2;
      const ak = seg(t, 0.05 + i * 0.05, 0.35 + i * 0.05);   // stack appears
      const fk = seg(t, 0.28 + i * 0.09, 0.7 + i * 0.09);    // fans out
      const f = easeOutBack(fk, 1.6);
      // browse: each card lifts in turn (right to left), then the favourite comes forward
      const bk = Math.sin(Math.PI * seg(t, 0.85 + (n - 1 - i) * 0.08, 1.15 + (n - 1 - i) * 0.08));
      const fav = i === p.focus ? easeOutBack(seg(t, 1.25, 1.55), 2) : 0;
      const x = mid * 15 * u * f, y = Math.abs(mid) * 2.2 * u * f - bk * 4 * u - fav * 3 * u;
      const r = mid * 9 * f * (1 - fav);
      const sc = (ak <= 0 ? 0.001 : spring(ak, 1.5, 6)) * (1 + 0.06 * bk + 0.22 * fav) * (1 - ex);
      c.style.zIndex = i === p.focus && fav > 0 ? 20 : 10 - Math.abs(Math.round(mid));
      c.style.opacity = clamp(ak * 4);
      c.style.transform = `translate(${x}px, ${y}px) rotate(${r}deg) scale(${Math.max(0.001, sc)})`;
    });
    s.fx.clearRect(0, 0, s.W, s.H);
    sparkle(s.fx, s.W * 0.62, s.H * 0.3, s.W * 0.08, seg(t, 1.4, 1.9));
    sparkle(s.fx, s.W * 0.36, s.H * 0.72, s.W * 0.06, seg(t, 1.5, 2.0));
    // a heart floats up from the favourite
    const hk2 = seg(t, 1.45, 2.1);
    if (hk2 > 0 && hk2 < 1) {
      const ctx = s.fx, x = s.W / 2 + 8 * u, y = s.H * 0.4 - hk2 * 12 * u;
      ctx.save(); ctx.globalAlpha = Math.sin(Math.PI * hk2); ctx.translate(x, y); ctx.scale(u * 0.4, u * 0.4);
      ctx.fillStyle = p.accent;
      ctx.fill(new Path2D("M12 21s-8-5.2-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 5.8-8 11-8 11z"));
      ctx.restore();
    }
  },
};
