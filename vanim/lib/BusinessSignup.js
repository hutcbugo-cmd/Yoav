// BusinessSignup ("if you're a manicurist, register as a business owner"): a sign-up card pops in,
// the business name types itself, service chips drop in, the register button is tapped, and a
// "business owner" badge stamps on with confetti.
// params: accent, title, name, services [...], button, badge, type_at, chips_at, tap_at, badge_at, hold, exit
import { seg, lerp, clamp, easeOutBack, easeInBack, easeOutCubic, spring } from "./ease.js";
import { el, stage, card, pill, icon, burst, canvasLayer } from "./ui.js";

let S;

export default {
  async setup(root, params, W, H) {
    const p = Object.assign({ accent: "#FF2E8B", title: "הרשמה לעסקים", name: "הסטודיו שלי",
      services: ["ג'ל", "מניקור", "פדיקור"], button: "הרשמה כבעלת עסק", badge: "בעלת עסק",
      type_at: 0.35, chips_at: 0.95, tap_at: 1.35, badge_at: 1.6, hold: 0.35, exit: true }, params);
    const u = W / 100;
    const st = stage(root, W, H);
    const cw = 80 * u;
    const box = el("div", `position:absolute;left:${(W - cw) / 2}px;top:${H * 0.5 - 36 * u}px;width:${cw}px;padding:${4.5 * u}px;
      box-sizing:border-box;${card(u)}`);
    box.append(el("div", `display:flex;align-items:center;gap:${2.4 * u}px;font:800 ${6.6 * u}px Assistant;color:#2a1b22`,
      `${icon("briefcase", 7 * u, p.accent)}<span>${p.title}</span>`));
    const field = el("div", `margin-top:${3.4 * u}px;border-radius:${3.4 * u}px;background:#fff4f8;border:${0.5 * u}px solid #ffd3e4;
      padding:${2.2 * u}px ${3.4 * u}px;font:700 ${5.4 * u}px Assistant;color:#2a1b22;min-height:${7 * u}px;display:flex;align-items:center`);
    const typed = el("span", "");
    const caret = el("span", `display:inline-block;width:${0.5 * u}px;height:${5.6 * u}px;background:${p.accent};margin-right:${0.6 * u}px`);
    field.append(typed, caret);
    box.append(field);
    const chips = el("div", `display:flex;gap:${2 * u}px;margin-top:${3 * u}px`);
    const chipEls = p.services.map((sv) => { const c = el("div", `${pill(u, p.accent, `font-size:${4.6 * u}px;padding:${1.2 * u}px ${3.6 * u}px`)}`, sv); chips.append(c); return c; });
    box.append(chips);
    const btn = el("div", `margin-top:${4 * u}px;height:${11 * u}px;border-radius:${6 * u}px;display:flex;align-items:center;justify-content:center;
      font:800 ${5.4 * u}px Assistant;color:#fff;background:linear-gradient(90deg, #2a1b22, #4a2a3a)`, p.button);
    box.append(btn);
    const tap = el("div", `position:absolute;width:${12 * u}px;height:${12 * u}px;border-radius:50%;background:rgba(255,255,255,.6);
      border:${0.7 * u}px solid #fff;box-shadow:0 0 ${3 * u}px rgba(0,0,0,.3);opacity:0;z-index:5`);
    const badge = el("div", `position:absolute;left:50%;top:${H * 0.5 - 6 * u}px;display:flex;align-items:center;gap:${2.4 * u}px;
      white-space:nowrap;z-index:6;${pill(u, p.accent, `font-size:${9 * u}px;padding:${2.4 * u}px ${6 * u}px`)}`,
      `${icon("crown", 9 * u, "#FFD24D")}<span>${p.badge}</span>`);
    st.append(box, tap, badge);
    const fx = canvasLayer(st, W, H);
    const chars = [...p.name];
    const typeEnd = Math.min(p.chips_at - 0.05, p.type_at + chars.length * 0.06);
    const dur = p.badge_at + 0.45 + p.hold + (p.exit ? 0.3 : 0);
    S = { p, u, W, H, box, typed, caret, chipEls, btn, tap, badge, fx, chars, typeEnd, dur };
    return {
      duration: dur,
      sfx: [{ t: 0, name: "pop", gain: -6 },
            ...chars.filter((c) => c !== " ").map((_, i) => ({ t: p.type_at + i * (typeEnd - p.type_at) / chars.length, name: "click", gain: -18 })),
            ...chipEls.map((_, i) => ({ t: p.chips_at + i * 0.1, name: "pop2", gain: -12 })),
            { t: p.tap_at, name: "click", gain: -4 }, { t: p.badge_at + 0.08, name: "impact", gain: -10 },
            { t: p.badge_at + 0.12, name: "sparkle", gain: -4 },
            ...(p.exit ? [{ t: dur - 0.3, name: "whoosh2", gain: -14 }] : [])],
    };
  },

  async frame(t) {
    const s = S, u = s.u, p = s.p;
    const ex = p.exit ? easeInBack(seg(t, s.dur - 0.3, s.dur), 1.6) : 0;
    const k = seg(t, 0, 0.38);
    s.box.style.transform = `scale(${Math.max(0.001, (k <= 0 ? 0 : spring(k, 1.5, 5.5)) * (1 - ex) * (1 - 0.06 * seg(t, p.badge_at, p.badge_at + 0.2)))})
      rotateX(${lerp(30, 0, easeOutCubic(k))}deg)`;
    s.box.style.filter = `brightness(${1 - 0.15 * seg(t, p.badge_at, p.badge_at + 0.2)})`;
    const nt = Math.floor(s.chars.length * seg(t, p.type_at, s.typeEnd) + 1e-6);
    s.typed.textContent = s.chars.slice(0, nt).join("");
    s.caret.style.opacity = t < p.chips_at ? (Math.floor(t * 5) % 2 ? 0.2 : 1) : 0;
    s.chipEls.forEach((c, i) => {
      const ck = seg(t, p.chips_at + i * 0.1, p.chips_at + i * 0.1 + 0.25);
      c.style.opacity = ck > 0 ? 1 : 0;
      c.style.transform = `translateY(${(1 - easeOutBack(ck, 2)) * -6 * u}px) scale(${ck > 0 ? easeOutBack(ck, 2.2) : 0.001})`;
    });
    const press = Math.sin(Math.PI * seg(t, p.tap_at - 0.05, p.tap_at + 0.15));
    s.btn.style.transform = `scale(${1 - 0.06 * press})`;
    s.btn.style.background = t >= p.tap_at ? `linear-gradient(90deg, #ff6aa8, ${p.accent})` : "linear-gradient(90deg, #2a1b22, #4a2a3a)";
    const bt = s.btn.getBoundingClientRect(), rt = s.box.parentElement.getBoundingClientRect();
    const tk = seg(t, p.tap_at - 0.15, p.tap_at + 0.25);
    s.tap.style.left = `${bt.left - rt.left + bt.width / 2 - 6 * u}px`;
    s.tap.style.top = `${bt.top - rt.top + bt.height / 2 - 6 * u}px`;
    s.tap.style.opacity = tk > 0 && tk < 1 ? Math.sin(Math.PI * tk) : 0;
    const bk = seg(t, p.badge_at, p.badge_at + 0.16);
    s.badge.style.opacity = bk > 0 ? clamp(bk * 3) * (1 - ex) : 0;
    s.badge.style.transform = `translateX(-50%) rotate(-6deg) scale(${lerp(2.2, 1, easeOutCubic(bk)) *
      (1 + 0.07 * Math.sin(Math.PI * seg(t, p.badge_at + 0.16, p.badge_at + 0.34))) * (1 - ex) + 0.001})`;
    s.fx.clearRect(0, 0, s.W, s.H);
    burst(s.fx, s.W / 2, s.H * 0.48, s.W * 0.55, seg(t, p.badge_at + 0.08, p.badge_at + 1.1),
          [p.accent, "#FFD24D", "#ffffff", "#7DD3FC"], 44, 3, 0.7);
  },
};
