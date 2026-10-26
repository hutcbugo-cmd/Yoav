// ChatWait ("it's on WhatsApp, I have to wait for her to answer"): a message is sent, its ticks stay
// grey, "typing…" appears and vanishes twice, the clock races through the day, and a
// "still waiting…" pill drops in.
// params: accent, title, message, waiting, times [...], hold, exit
import { seg, lerp, clamp, easeOutBack, easeInBack, easeOutCubic, spring } from "./ease.js";
import { el, stage, card, pill } from "./ui.js";

let S;

export default {
  async setup(root, params, W, H) {
    const p = Object.assign({ accent: "#FF2E8B", title: "המניקוריסטית", message: "היי! יש לך תור השבוע? 🙏".replace(" 🙏", ""),
      waiting: "עדיין מחכה…", times: ["10:02", "13:40", "17:15", "22:48"], hold: 0.5, exit: true }, params);
    const u = W / 100;
    const st = stage(root, W, H);
    const cw = 80 * u;
    const box = el("div", `position:absolute;left:${(W - cw) / 2}px;top:${H * 0.5 - 30 * u}px;width:${cw}px;overflow:hidden;
      ${card(u, "background:#f3efe9")}`);
    const head = el("div", `display:flex;align-items:center;gap:${2.4 * u}px;padding:${2.6 * u}px ${4 * u}px;background:#fff;
      font:800 ${5.4 * u}px Assistant;color:#2a1b22`, `<div style="width:${9 * u}px;height:${9 * u}px;border-radius:50%;
      background:linear-gradient(140deg,#ff8fbf,#e2337f)"></div><div><div>${p.title}</div>
      <div class="status" style="font:700 ${3.8 * u}px Assistant;color:#8a6b78">מחוברת לאחרונה אתמול</div></div>`);
    const body = el("div", `position:relative;height:${36 * u}px`);
    const msg = el("div", `position:absolute;left:${5 * u}px;top:${5 * u}px;max-width:${58 * u}px;background:#ffd9ea;
      border-radius:${4 * u}px ${4 * u}px ${4 * u}px ${1 * u}px;padding:${2.4 * u}px ${3.6 * u}px;font:700 ${5 * u}px Assistant;
      color:#2a1b22;box-shadow:0 ${0.4 * u}px ${1 * u}px rgba(0,0,0,.1)`,
      `${p.message}<span class="tk" style="font:800 ${3.8 * u}px Assistant;color:#9aa;margin-right:${1.6 * u}px;direction:ltr;display:inline-block">✓✓</span>`);
    const typing = el("div", `position:absolute;right:${5 * u}px;top:${19 * u}px;background:#fff;border-radius:${4 * u}px;
      padding:${2 * u}px ${3.6 * u}px;font:700 ${4.4 * u}px Assistant;color:#8a6b78;opacity:0`, "מקלידה…");
    const clock = el("div", `position:absolute;left:${6 * u}px;bottom:${2 * u}px;width:${14 * u}px;height:${14 * u}px;border-radius:50%;
      background:#fff;border:${0.8 * u}px solid ${p.accent};box-sizing:border-box`);
    const hand = (len, w, c) => { const h = el("div", `position:absolute;left:50%;bottom:50%;width:${w}px;height:${len}px;
      margin-left:${-w / 2}px;background:${c};border-radius:${w}px;transform-origin:50% 100%`); clock.append(h); return h; };
    const hh = hand(3.6 * u, 0.9 * u, "#2a1b22"), mh = hand(5.2 * u, 0.6 * u, p.accent);
    const timeEl = el("div", `position:absolute;left:${22 * u}px;bottom:${5 * u}px;font:800 ${6 * u}px Assistant;color:#2a1b22;direction:ltr`);
    body.append(msg, typing, clock, timeEl);
    box.append(head, body);
    const wait = el("div", `position:absolute;left:50%;top:${H * 0.5 + 24 * u}px;white-space:nowrap;
      ${pill(u, p.accent, `font-size:${7 * u}px;padding:${1.8 * u}px ${5 * u}px`)}`, p.waiting);
    st.append(box, wait);
    const dur = 2.6 + p.hold + (p.exit ? 0.3 : 0);
    S = { p, u, W, H, box, msg, typing, hh, mh, timeEl, wait, dur, tk: msg.querySelector(".tk") };
    return {
      duration: dur,
      sfx: [{ t: 0, name: "pop", gain: -8 }, { t: 0.3, name: "whoosh2", gain: -6 }, { t: 0.45, name: "click", gain: -10 },
            { t: 0.9, name: "pop2", gain: -16 }, { t: 1.6, name: "pop2", gain: -16 },
            ...[1.0, 1.25, 1.5, 1.75, 2.0, 2.2].map((t) => ({ t, name: "click", gain: -18 })),
            { t: 2.3, name: "pop", gain: -6 },
            ...(p.exit ? [{ t: dur - 0.3, name: "whoosh2", gain: -14 }] : [])],
    };
  },

  async frame(t) {
    const s = S, u = s.u, p = s.p;
    const ex = p.exit ? easeInBack(seg(t, s.dur - 0.3, s.dur), 1.6) : 0;
    const k = seg(t, 0, 0.35);
    s.box.style.transform = `scale(${Math.max(0.001, (k <= 0 ? 0 : spring(k, 1.5, 5.5)) * (1 - ex))})`;
    const mk = seg(t, 0.3, 0.55);
    s.msg.style.opacity = clamp(mk * 3);
    s.msg.style.transform = `translateY(${(1 - easeOutCubic(mk)) * 10 * u}px) scale(${lerp(0.7, 1, easeOutBack(mk, 2))})`;
    // typing appears and vanishes twice: hope, then nothing
    const ty = (t > 0.9 && t < 1.3) || (t > 1.6 && t < 1.95);
    s.typing.style.opacity = ty ? 1 : 0;
    // clock races through the day
    const ck = seg(t, 0.9, 2.3);
    const mins = ck * 12 * 60;
    s.mh.style.transform = `rotate(${mins * 6}deg)`;
    s.hh.style.transform = `rotate(${300 + mins * 0.5}deg)`;
    s.timeEl.textContent = t > 0.85 ? p.times[Math.min(p.times.length - 1, Math.floor(ck * p.times.length))] : "";
    s.tk.style.transform = `scale(${1 + 0.3 * Math.sin(Math.PI * seg(t, 0.45, 0.65))})`;
    const wk = seg(t, 2.3, 2.55);
    s.wait.style.transform = `translateX(-50%) scale(${wk > 0 ? easeOutBack(wk, 2.4) * (1 - ex) + 0.001 : 0.001}) rotate(${-3 * wk}deg)`;
  },
};
