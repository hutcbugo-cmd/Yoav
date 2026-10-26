// NomiExplainer: a full-frame product explainer in the style of the Yellow reference (docs/style-references.md,
// reference 3). One wide "world" holds every scene along a single glowing brand-colour line; the camera glides
// from scene to scene on each voice-over line (motion blur while it moves), text pulls focus in and out, every
// object rides on the line, and it ends on a brand-colour flood with the logo.
// params: cues [{id, t, t1, t2}] (t = VO line start, s), end (total s), logo, photos [{src,pos}], accent
import { seg, lerp, clamp, easeOutBack, easeInBack, easeOutCubic, easeInOutCubic, spring, sparkle, shade } from "./ease.js";
import { el, card, star, icon, nailTile, burst, canvasLayer } from "./ui.js";

let S;
const BG = "#120a10";

// ---------------------------------------------------------------- scene builders (local time lt, 0 = cue start)
function phoneShell(u, w, h, inner) {
  return el("div", `position:absolute;left:${-w / 2}px;top:${-h / 2}px;width:${w}px;height:${h}px;border-radius:${w * 0.16}px;
    background:linear-gradient(140deg,#2b2b31,#0c0c0e);box-shadow:0 0 0 ${0.35 * u}px ${S.A}, 0 0 ${2.4 * u}px ${S.A}aa, 0 0 ${7 * u}px ${S.A}55;
    padding:${w * 0.04}px;box-sizing:border-box`, `<div style="width:100%;height:100%;border-radius:${w * 0.12}px;overflow:hidden;
    background:#fff6f9;position:relative;direction:rtl">${inner}</div>`);
}
const glowBox = (u, extra = "") => `background:#fff;border-radius:${3 * u}px;box-shadow:0 0 0 ${0.3 * u}px ${S.A}, 0 0 ${2 * u}px ${S.A}99,
  0 0 ${6 * u}px ${S.A}44;${extra}`;

const SCENES = {
  hook(o, u) {  // a glossy nail with an alarm clock that rings
    const n = el("div", `position:absolute;left:${-9 * u}px;top:${-14 * u}px;width:${18 * u}px;height:${26 * u}px;
      ${nailTile(S.A, `${9 * u}px ${9 * u}px ${3 * u}px ${3 * u}px`)};box-shadow:0 0 0 ${0.35 * u}px #fff8, 0 0 ${4 * u}px ${S.A}aa`);
    const clk = el("div", `position:absolute;left:${9 * u}px;top:${-20 * u}px;width:${13 * u}px;height:${13 * u}px`,
      `<svg viewBox="0 0 24 24" width="${13 * u}" height="${13 * u}"><circle cx="12" cy="13" r="8" fill="#fff" stroke="${S.A}" stroke-width="1.6"/>
       <path d="M12 9v4l3 2" stroke="#2a1b22" stroke-width="1.6" fill="none" stroke-linecap="round"/>
       <path d="M4 6l3-3M20 6l-3-3" stroke="${S.A}" stroke-width="2" stroke-linecap="round"/></svg>`);
    o.append(n, clk);
    return (lt) => {
      const k = seg(lt, 0, 0.5);
      n.style.transform = `scale(${k <= 0 ? 0.001 : spring(k, 1.4, 5)}) rotate(${lerp(-25, -6, easeOutCubic(k))}deg)`;
      const ring = lt > 0.6 ? Math.sin(lt * 50) * 14 * Math.max(0, 1 - (lt - 0.6) / 1.4) : 0;
      clk.style.transform = `scale(${seg(lt, 0.3, 0.6) > 0 ? easeOutBack(seg(lt, 0.3, 0.6), 2.4) : 0.001}) rotate(${ring}deg)`;
    };
  },
  full(o, u) {  // calendar: every slot gets an X
    const c = el("div", `position:absolute;left:${-19 * u}px;top:${-17 * u}px;width:${38 * u}px;padding:${2 * u}px;box-sizing:border-box;${glowBox(u)}`);
    c.innerHTML = `<div style="font:800 ${3.4 * u}px Assistant;color:#2a1b22;text-align:right;margin-bottom:${1.2 * u}px">תורים פנויים</div>`;
    const g = el("div", `display:grid;grid-template-columns:repeat(3,1fr);gap:${1.2 * u}px`);
    const xs = ["09:00", "11:00", "13:00", "15:00", "17:00", "19:00"].map((tm) => {
      const s = el("div", `position:relative;border-radius:${1.4 * u}px;background:#fff4f8;font:800 ${3 * u}px Assistant;color:#3a2230;
        text-align:center;padding:${1.4 * u}px 0;direction:ltr`, `${tm}<svg viewBox="0 0 40 40" style="position:absolute;inset:0;width:100%;height:100%">
        <path d="M10 8L30 32M30 8L10 32" stroke="#E5243B" stroke-width="5" stroke-linecap="round" fill="none" stroke-dasharray="60" stroke-dashoffset="60"/></svg>`);
      g.append(s); return s.querySelector("path");
    });
    c.append(g); o.append(c);
    return (lt) => {
      const k = seg(lt, 0, 0.4);
      c.style.transform = `scale(${k <= 0 ? 0.001 : spring(k, 1.5, 5.5)})`;
      xs.forEach((p, i) => p.setAttribute("stroke-dashoffset", 60 * (1 - easeOutCubic(seg(lt, 0.35 + i * 0.13, 0.5 + i * 0.13)))));
    };
  },
  home(o, u) {  // cosy house, door shuts, window glows, Zzz
    const h = el("div", `position:absolute;left:${-16 * u}px;top:${-18 * u}px;width:${32 * u}px;height:${32 * u}px;filter:drop-shadow(0 0 ${1.6 * u}px ${S.A}aa)`,
      `<svg viewBox="0 0 100 100" width="${32 * u}" height="${32 * u}"><path d="M18 48L50 20L82 48Z" fill="${S.A}"/>
       <rect x="26" y="46" width="48" height="38" rx="3" fill="#fff"/><rect class="w" x="33" y="56" width="13" height="11" rx="2" fill="#5b3d4c"/>
       <rect x="55" y="60" width="12" height="24" rx="1.6" fill="#3a2230"/><rect class="d" x="55" y="60" width="12" height="24" rx="1.6" fill="#ff8fbf"/></svg>`);
    const z = el("div", `position:absolute;left:${12 * u}px;top:${-22 * u}px;font:800 ${7 * u}px Assistant;color:#fff;opacity:0`, "Zzz");
    o.append(h, z);
    const d = h.querySelector(".d"), w = h.querySelector(".w");
    return (lt) => {
      const k = seg(lt, 0, 0.4);
      h.style.transform = `scale(${k <= 0 ? 0.001 : spring(k, 1.5, 5)})`;
      const dk = seg(lt, 0.5, 0.7);
      d.setAttribute("transform", `translate(55 0) scale(${lerp(0.12, 1, easeOutBack(dk, 2.5))} 1) translate(-55 0)`);
      w.setAttribute("fill", lt > 0.8 ? "#FFD66E" : "#5b3d4c");
      const zk = seg(lt, 0.8, 2.2);
      z.style.opacity = zk > 0 && zk < 1 ? Math.sin(Math.PI * zk) : 0;
      z.style.transform = `translateY(${-zk * 8 * u}px)`;
    };
  },
  logo(o, u) {  // app icon pulls focus in, ring + burst, wordmark
    const s = 30 * u;
    const ic = el("div", `position:absolute;left:${-s / 2}px;top:${-s / 2 - 4 * u}px;width:${s}px;height:${s}px;border-radius:${s * 0.22}px;overflow:hidden;
      box-shadow:0 0 0 ${0.4 * u}px ${S.A}, 0 0 ${4 * u}px ${S.A}aa, 0 0 ${12 * u}px ${S.A}55`,
      S.logo ? `<img src="/${S.logo}" style="width:100%;height:100%;display:block">` : "");
    const wm = el("div", `position:absolute;left:${-30 * u}px;width:${60 * u}px;top:${s / 2 - 1 * u}px;text-align:center;direction:ltr;
      font:800 ${11 * u}px Assistant;color:#fff;text-shadow:0 0 ${2 * u}px ${S.A}`, "Nomi");
    const ring = el("div", `position:absolute;left:${-s / 2}px;top:${-s / 2 - 4 * u}px;width:${s}px;height:${s}px;border-radius:50%;
      border:${0.6 * u}px solid ${S.A};opacity:0`);
    o.append(ring, ic, wm);
    return (lt) => {
      const k = seg(lt, 0, 0.45);
      ic.style.filter = `blur(${(1 - easeOutCubic(k)) * 2.5 * u}px)`;
      ic.style.opacity = clamp(k * 2);
      ic.style.transform = `scale(${lerp(1.35, 1, easeOutCubic(k))}) rotateY(${lerp(40, 0, easeOutCubic(k))}deg)`;
      const rk = seg(lt, 0.3, 1.0);
      ring.style.opacity = rk > 0 && rk < 1 ? 1 - rk : 0;
      ring.style.transform = `scale(${1 + 1.4 * easeOutCubic(rk)})`;
      const wk = seg(lt, 0.4, 0.75);
      wm.style.opacity = wk; wm.style.filter = `blur(${(1 - wk) * 1.2 * u}px)`;
      wm.style.transform = `translateY(${(1 - easeOutCubic(wk)) * 3 * u}px)`;
    };
  },
  find(o, u) {  // phone with technicians (rating, distance), a distance badge pops
    const techs = [["נועה", "4.9", "1.2"], ["מאיה", "4.8", "2.0"], ["שירה", "4.9", "2.6"]];
    const inner = `<div style="padding:${3 * u}px ${2 * u}px;font-family:Assistant">
      <div style="font:800 ${2.6 * u}px Assistant;color:#2a1b22;margin-bottom:${1.4 * u}px">מניקוריסטיות לידך</div>
      ${techs.map(([n, r, km], i) => `<div class="tc" style="display:flex;align-items:center;gap:${1 * u}px;background:#fff;border-radius:${1.6 * u}px;
        padding:${1 * u}px;margin-bottom:${1 * u}px;box-shadow:0 ${0.3 * u}px ${1 * u}px rgba(160,40,90,.15);opacity:0">
        <div style="width:${4.4 * u}px;height:${4.4 * u}px;border-radius:50%;background:linear-gradient(140deg,#ff8fbf,${S.A});color:#fff;
          font:800 ${2 * u}px Assistant;display:flex;align-items:center;justify-content:center">${n[0]}</div>
        <div><div style="font:800 ${2.1 * u}px Assistant;color:#2a1b22">${n}</div>
        <div style="font:700 ${1.6 * u}px Assistant;color:#8a6b78"><span style="color:#f5a623">${star("#f5a623")}</span> ${r} · ${km} ק"מ</div></div></div>`).join("")}</div>`;
    const ph = phoneShell(u, 22 * u, 44 * u, inner);
    const badge = el("div", `position:absolute;left:${10 * u}px;top:${-8 * u}px;white-space:nowrap;${glowBox(u, `padding:${1 * u}px ${2.2 * u}px;
      font:800 ${3 * u}px Assistant;color:#2a1b22;display:flex;gap:${0.8 * u}px;align-items:center;opacity:0`)}`,
      `${icon("pin", 3.2 * u, S.A)}<span>1.2 ק"מ</span>`);
    o.append(ph, badge);
    const cards = [...ph.querySelectorAll(".tc")];
    return (lt) => {
      const k = seg(lt, 0, 0.45);
      ph.style.transform = `scale(${k <= 0 ? 0.001 : spring(k, 1.4, 6)}) rotateY(${lerp(-35, -8, easeOutCubic(k)) + 3 * Math.sin(lt * 1.3)}deg)`;
      cards.forEach((c, i) => { const ck = seg(lt, 0.35 + i * 0.12, 0.6 + i * 0.12); c.style.opacity = ck;
        c.style.transform = `translateY(${(1 - easeOutCubic(ck)) * 3 * u}px)`; });
      const bk = seg(lt, 0.9, 1.15);
      badge.style.opacity = bk > 0 ? 1 : 0;
      badge.style.transform = `scale(${bk > 0 ? easeOutBack(bk, 2.6) : 0.001})`;
    };
  },
  folio(o, u) {  // real work photos fan out
    const ps = S.photos.length ? S.photos : [{ src: "" }, { src: "" }, { src: "" }];
    const cards = ps.slice(0, 3).map((p, i) => {
      const c = el("div", `position:absolute;left:${-9 * u}px;top:${-12 * u}px;width:${18 * u}px;height:${24 * u}px;padding:${0.8 * u}px;
        box-sizing:border-box;transform-origin:50% 120%;${glowBox(u, `border-radius:${2 * u}px`)}`,
        p.src ? `<img src="/${p.src}" style="width:100%;height:100%;object-fit:cover;object-position:${p.pos || "50% 50%"};border-radius:${1.4 * u}px;display:block">`
              : `<div style="width:100%;height:100%;${nailTile(S.A, `${1.4 * u}px`)}"></div>`);
      o.append(c); return c;
    });
    return (lt) => {
      cards.forEach((c, i) => {
        const mid = i - 1, ak = seg(lt, 0.05 + i * 0.06, 0.4 + i * 0.06), f = easeOutBack(seg(lt, 0.25 + i * 0.08, 0.7 + i * 0.08), 1.6);
        const fav = i === 1 ? easeOutBack(seg(lt, 1.0, 1.3), 2) : 0;
        c.style.zIndex = i === 1 ? 5 : 2;
        c.style.transform = `translate(${mid * 15 * u * f}px, ${Math.abs(mid) * 1.6 * u * f - fav * 2 * u}px) rotate(${mid * 10 * f}deg)
          scale(${(ak <= 0 ? 0.001 : spring(ak, 1.5, 6)) * (1 + 0.12 * fav)})`;
      });
    };
  },
  chat(o, u) {  // photo message sent, read, reply
    const box = el("div", `position:absolute;left:${-20 * u}px;top:${-17 * u}px;width:${40 * u}px;height:${34 * u}px;overflow:hidden;
      ${glowBox(u, "background:#f3efe9")}`);
    const ph = S.photos[0];
    const out = el("div", `position:absolute;left:${2 * u}px;top:${2.4 * u}px;width:${20 * u}px;padding:${0.8 * u}px;background:#ffd9ea;
      border-radius:${2.4 * u}px ${2.4 * u}px ${2.4 * u}px ${0.6 * u}px;opacity:0`,
      `<div style="height:${13 * u}px;border-radius:${1.6 * u}px;overflow:hidden">${ph ? `<img src="/${ph.src}" style="width:100%;height:100%;object-fit:cover;object-position:${ph.pos}">`
        : `<div style="width:100%;height:100%;${nailTile(S.A, "0")}"></div>`}</div>
       <div style="display:flex;justify-content:space-between;font:800 ${2.4 * u}px Assistant;color:#2a1b22;padding:${0.6 * u}px ${0.4 * u}px 0">
       <span>בדיוק כזה!</span><span class="tk" style="color:#9aa;direction:ltr">✓✓</span></div>`);
    const rep = el("div", `position:absolute;right:${2 * u}px;top:${22 * u}px;background:#fff;border-radius:${2.4 * u}px ${2.4 * u}px ${0.6 * u}px ${2.4 * u}px;
      padding:${1.2 * u}px ${2.4 * u}px;font:800 ${2.6 * u}px Assistant;color:#2a1b22;opacity:0;white-space:nowrap`, "סגור, מושלם!");
    box.append(out, rep); o.append(box);
    const tk = out.querySelector(".tk");
    return (lt) => {
      const k = seg(lt, 0, 0.4);
      box.style.transform = `scale(${k <= 0 ? 0.001 : spring(k, 1.5, 5.5)})`;
      const mk = seg(lt, 0.3, 0.6);
      out.style.opacity = clamp(mk * 3); out.style.transform = `translateY(${(1 - easeOutCubic(mk)) * 6 * u}px)`;
      tk.style.color = lt > 0.9 ? S.A : "#9aa";
      const rk = seg(lt, 1.2, 1.45);
      rep.style.opacity = rk > 0 ? 1 : 0; rep.style.transform = `scale(${rk > 0 ? easeOutBack(rk, 2.2) : 0.001})`;
    };
  },
  book(o, u) {  // week strip, a day and an hour are picked, confirmation chip
    const box = el("div", `position:absolute;left:${-21 * u}px;top:${-14 * u}px;width:${42 * u}px;padding:${2.2 * u}px;box-sizing:border-box;${glowBox(u)}`);
    box.innerHTML = `<div style="font:800 ${3 * u}px Assistant;color:#2a1b22;text-align:right;margin-bottom:${1.2 * u}px">בחרי מועד</div>`;
    const days = el("div", `display:flex;gap:${0.8 * u}px;direction:rtl`);
    const dEls = ["א", "ב", "ג", "ד", "ה"].map((d, i) => { const e = el("div", `flex:1;border-radius:${1.4 * u}px;background:#fff4f8;text-align:center;
      padding:${0.8 * u}px 0;font:800 ${2.6 * u}px Assistant;color:#2a1b22`, `<div style="font-size:${1.8 * u}px;opacity:.6">${d}</div>${14 + i}`);
      days.append(e); return e; });
    const slots = el("div", `display:flex;gap:${1 * u}px;margin-top:${1.4 * u}px;direction:ltr;justify-content:flex-end`);
    const sEls = ["10:00", "14:30", "18:30"].map((tm) => { const e = el("div", `padding:${0.6 * u}px ${1.8 * u}px;border-radius:${3 * u}px;
      border:${0.25 * u}px solid #ffc6dc;font:800 ${2.4 * u}px Assistant;color:#2a1b22;opacity:0`, tm); slots.append(e); return e; });
    box.append(days, slots);
    const ok = el("div", `position:absolute;left:${-12 * u}px;top:${12 * u}px;white-space:nowrap;background:#22c55e;color:#fff;border-radius:${4 * u}px;
      padding:${1 * u}px ${3 * u}px;font:800 ${3.2 * u}px Assistant;box-shadow:0 0 ${3 * u}px #22c55e88;opacity:0`, "התור נקבע ✓");
    o.append(box, ok);
    return (lt) => {
      const k = seg(lt, 0, 0.4);
      box.style.transform = `scale(${k <= 0 ? 0.001 : spring(k, 1.5, 5.5)})`;
      dEls.forEach((d, i) => { const on = i === 3 && lt > 0.55; d.style.background = on ? S.A : "#fff4f8"; d.style.color = on ? "#fff" : "#2a1b22";
        d.style.transform = `scale(${on ? 1 + 0.12 * Math.sin(Math.PI * seg(lt, 0.55, 0.8)) : 1})`; });
      sEls.forEach((s, i) => { const sk = seg(lt, 0.7 + i * 0.08, 0.95 + i * 0.08); const on = i === 2 && lt > 1.1;
        s.style.opacity = sk; s.style.background = on ? S.A : "#fff"; s.style.color = on ? "#fff" : "#2a1b22"; });
      const okk = seg(lt, 1.35, 1.6);
      ok.style.opacity = okk > 0 ? 1 : 0; ok.style.transform = `scale(${okk > 0 ? easeOutBack(okk, 2.6) : 0.001})`;
    };
  },
  arrive(o, u) {  // a car drives along a route to the house
    const m = el("div", `position:absolute;left:${-22 * u}px;top:${-15 * u}px;width:${44 * u}px;height:${30 * u}px;overflow:hidden;${glowBox(u, "background:#fdf2f6")}`,
      `<svg viewBox="0 0 100 68" width="${44 * u}" height="${30 * u}" preserveAspectRatio="none">
       <g stroke="#fff" stroke-width="3"><path d="M0 22H100M0 48H100M30 0V68M70 0V68"/></g>
       <path class="rt" d="M14 56 C 30 56, 30 22, 50 22 S 72 48, 86 40" stroke="${S.A}" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-dasharray="4 3"/></svg>`);
    const house = el("div", `position:absolute;left:${15 * u}px;top:${-6 * u}px;width:${8 * u}px;height:${8 * u}px`,
      `<svg viewBox="0 0 24 24" width="${8 * u}" height="${8 * u}"><path d="M3 11L12 4l9 7v9H3z" fill="${S.A}"/><rect x="10" y="14" width="4" height="6" fill="#fff"/></svg>`);
    const car = el("div", `position:absolute;width:${7 * u}px;height:${4 * u}px;margin:${-2 * u}px 0 0 ${-3.5 * u}px`,
      `<svg viewBox="0 0 48 28" width="${7 * u}" height="${4 * u}"><path d="M4 18 L8 9 Q10 5 15 5 H31 Q36 5 39 9 L44 16 Q46 18 46 21 V23 H2 V21 Q2 19 4 18z" fill="${S.A}"/>
       <circle cx="13" cy="23" r="4.5" fill="#2a1b22"/><circle cx="35" cy="23" r="4.5" fill="#2a1b22"/></svg>`);
    m.append(house, car); o.append(m);
    const rt = m.querySelector(".rt"), L = rt.getTotalLength();
    return (lt) => {
      const k = seg(lt, 0, 0.4);
      m.style.transform = `scale(${k <= 0 ? 0.001 : spring(k, 1.4, 6)}) perspective(${200 * u}px) rotateX(${lerp(45, 14, easeOutCubic(k))}deg)`;
      const dk = easeInOutCubic(seg(lt, 0.35, 1.6));
      const p = rt.getPointAtLength(L * dk);
      car.style.left = `${p.x / 100 * 44 * u}px`; car.style.top = `${p.y / 68 * 30 * u}px`;
      house.style.transform = `scale(${1 + 0.25 * Math.sin(Math.PI * seg(lt, 1.6, 1.9))})`;
    };
  },
  trust(o, u) {  // shield with tick, stars fill, score counts up
    const sh = el("div", `position:absolute;left:${-11 * u}px;top:${-18 * u}px;width:${22 * u}px;height:${22 * u}px;filter:drop-shadow(0 0 ${2 * u}px ${S.A}aa)`,
      `<svg viewBox="0 0 24 24" width="${22 * u}" height="${22 * u}"><path d="M12 1.5l8.5 3.2v6.3c0 5.5-3.6 9.9-8.5 11.6C7.1 20.9 3.5 16.5 3.5 11V4.7z" fill="${S.A}"/>
       <path class="tp" d="M7.6 12.2l3 3 5.9-6.3" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="14" stroke-dashoffset="14"/></svg>`);
    const row = el("div", `position:absolute;left:${-18 * u}px;top:${6 * u}px;width:${36 * u}px;display:flex;justify-content:center;gap:${0.8 * u}px;
      direction:ltr;align-items:center`);
    const stars = [0, 1, 2, 3, 4].map(() => { const s = el("div", "opacity:.25", star("#f5a623", `${5 * u}px`)); row.append(s); return s; });
    const sc = el("div", `font:800 ${4.4 * u}px Assistant;color:#fff;margin-left:${1.4 * u}px`); row.append(sc);
    o.append(sh, row);
    const tp = sh.querySelector(".tp");
    return (lt) => {
      const k = seg(lt, 0, 0.4);
      sh.style.transform = `scale(${k <= 0 ? 0.001 : spring(k, 1.5, 5)}) rotateY(${lerp(180, 0, easeOutCubic(k))}deg)`;
      tp.setAttribute("stroke-dashoffset", 14 * (1 - easeOutCubic(seg(lt, 0.45, 0.7))));
      stars.forEach((s, i) => { const sk = seg(lt, 1.2 + i * 0.1, 1.4 + i * 0.1); s.style.opacity = 0.25 + 0.75 * sk;
        s.style.transform = `scale(${sk > 0 ? easeOutBack(sk, 3) : 0.8})`; });
      sc.textContent = lt > 1.2 ? (4.9 * easeOutCubic(seg(lt, 1.2, 1.8))).toFixed(1) : "";
    };
  },
};

// ---------------------------------------------------------------- composition
export default {
  async setup(root, params, W, H) {
    const p = Object.assign({ accent: "#FF2E8B", cues: [], end: 30, logo: "", photos: [], tagline: "מניקור עד הבית", cta: "הורידי עכשיו" }, params);
    const portrait = H > W;                                       // 9:16 Reels layout: object centre-top, text below
    const u = Math.min(W, H) / 100;
    S = { p, u, W, H, A: p.accent, logo: p.logo, photos: p.photos, portrait };
    root.style.background = BG;
    const view = el("div", `position:absolute;inset:0;overflow:hidden;background:radial-gradient(ellipse ${portrait ? "80% 45% at 50% 38%" : "55% 60% at 36% 52%"}, #3a1428 0%, ${BG} 70%)`);
    root.append(view);
    const scenes = p.cues.filter((c) => SCENES[c.id]);
    const SP = portrait ? W * 1.2 : W * 0.95;                     // world distance between scenes
    const world = el("div", `position:absolute;left:0;top:0;width:${(scenes.length + 1) * SP}px;height:${H}px;transform-style:preserve-3d;perspective:${200 * u}px`);
    view.append(world);
    const OX = portrait ? W * 0.5 : W * 0.34, OY = portrait ? H * 0.47 : H * 0.47, OS = portrait ? 1.6 : 1.35;  // anchor, scale
    // the line: from the bottom-left edge into each object's base, dipping between scenes
    let d = `M ${-W * 0.3} ${portrait ? OY + 36 * u * OS : H * 0.95} C ${OX - W * 0.25} ${portrait ? OY + 36 * u * OS : H * 0.95}, ${OX - W * 0.08} ${portrait ? OY + 30 * u * OS : H * 0.8}, ${OX} ${OY + 17 * u * OS}`;
    scenes.forEach((c, i) => {
      const x0 = OX + i * SP, x1 = OX + (i + 1) * SP;
      d += ` C ${x0 + W * 0.08} ${OY + 30 * u * OS}, ${x0 + SP * 0.4} ${portrait ? OY + 36 * u * OS : H * 0.86}, ${(x0 + x1) / 2} ${portrait ? OY + 34 * u * OS : H * 0.84}`
         + ` S ${x1 - W * 0.06} ${OY + 30 * u * OS}, ${x1} ${OY + 17 * u * OS}`;
    });
    const svg = el("div", "position:absolute;left:0;top:0", `<svg width="${(scenes.length + 1) * SP}" height="${H}" style="overflow:visible">
      <path class="ln" d="${d}" fill="none" stroke="${S.A}" stroke-width="${0.55 * u}" stroke-linecap="round"
        style="filter:drop-shadow(0 0 ${0.6 * u}px ${S.A}) drop-shadow(0 0 ${2 * u}px ${S.A})"/></svg>`);
    world.append(svg);
    const ln = svg.querySelector(".ln");
    const L = ln.getTotalLength();
    // arc-length lookup: world x -> length (the line is drawn up to the camera's leading edge)
    const look = [];
    for (let s = 0; s <= L; s += L / 1500) look.push([ln.getPointAtLength(s).x, s]);
    const lenAt = (x) => { let best = 0; for (const [px, s] of look) { if (px <= x) best = Math.max(best, s); } return best; };
    ln.setAttribute("stroke-dasharray", `${L} ${L}`);
    const head = el("div", `position:absolute;width:${3 * u}px;height:${3 * u}px;margin:${-1.5 * u}px 0 0 ${-1.5 * u}px;border-radius:50%;
      background:radial-gradient(circle,#fff 0%,${S.A} 45%,${S.A}00 70%);filter:blur(${0.2 * u}px)`);
    world.append(head);
    // objects + their animation functions
    S.items = scenes.map((c, i) => {
      const o = el("div", `position:absolute;left:${OX + i * SP}px;top:${OY}px;width:0;height:0;transform-style:preserve-3d;
        transform:scale(${OS})`);  // objects are drawn at 1x and shown at OS (they read small next to the 2-line type)
      world.append(o);
      return { c, i, frame: SCENES[c.id](o, u), x: OX + i * SP };
    });
    // text block (screen space, right side), one per cue, pulls focus in and out
    S.texts = p.cues.map((c) => {
      if (!c.t1 && !c.t2) return null;
      const t = el("div", portrait
        ? `position:absolute;right:${W * 0.07}px;top:${H * 0.13}px;width:${W * 0.86}px;text-align:center;direction:rtl;opacity:0`
        : `position:absolute;right:${W * 0.08}px;top:${H * 0.34}px;width:${W * 0.4}px;text-align:right;direction:rtl;opacity:0`,
        `<div style="font:800 ${10 * u}px Assistant;color:#FFF3F8;line-height:1.0">${c.t1}</div>
         <div style="font:800 ${10 * u}px Assistant;color:${S.A};line-height:1.05;text-shadow:0 0 ${2 * u}px ${S.A}66">${c.t2}</div>`);
      view.append(t); return t;
    });
    // end card: brand flood + logo
    const flood = el("div", `position:absolute;inset:0;background:radial-gradient(circle at 50% 45%, ${shade(S.A, 0.25)}, ${S.A} 60%, ${shade(S.A, -0.25)});
      opacity:0;clip-path:circle(0% at 50% 50%)`);
    const lg = 26 * u;
    const endLogo = el("div", `position:absolute;left:${W / 2 - lg / 2}px;top:${H * 0.3 - lg / 2}px;width:${lg}px;height:${lg}px;border-radius:${lg * 0.22}px;
      overflow:hidden;box-shadow:0 ${1.5 * u}px ${5 * u}px rgba(0,0,0,.3);opacity:0`, p.logo ? `<img src="/${p.logo}" style="width:100%;height:100%;display:block">` : "");
    const endWord = el("div", `position:absolute;left:0;right:0;top:${H * 0.47}px;text-align:center;direction:ltr;font:800 ${14 * u}px Assistant;color:#fff;
      text-shadow:0 ${0.8 * u}px ${3 * u}px rgba(0,0,0,.25);opacity:0`, "Nomi");
    const endTag = el("div", `position:absolute;left:0;right:0;top:${H * 0.66}px;text-align:center;font:800 ${7.5 * u}px Assistant;color:#fff;opacity:0`, p.tagline);
    const endCta = el("div", `position:absolute;left:50%;top:${H * 0.8}px;transform:translateX(-50%);white-space:nowrap;background:#fff;color:${S.A};
      border-radius:${5 * u}px;padding:${1.2 * u}px ${4 * u}px;font:800 ${4 * u}px Assistant;opacity:0`, p.cta);
    view.append(flood, endLogo, endWord, endTag, endCta);
    const fx = canvasLayer(view, W, H);
    Object.assign(S, { view, world, ln, L, lenAt, head, flood, endLogo, endWord, endTag, endCta, fx, SP, OX, OY, scenes,
                       endCue: p.cues.find((c) => c.id === "end") });
    // camera keyframes: one stop per scene, moves take 0.55 s starting 0.12 s before the line
    S.stops = S.items.map((it) => ({ t: it.c.t - 0.12, x: it.x - OX }));
    const sfx = [];
    S.items.forEach((it, i) => {
      if (i) sfx.push({ t: it.c.t - 0.12, name: "whoosh2", gain: -10 });
      sfx.push({ t: it.c.t + 0.05, name: it.c.id === "logo" ? "impact" : "pop", gain: it.c.id === "logo" ? -6 : -10 });
    });
    const add = (id, dt, name, gain) => { const c = p.cues.find((q) => q.id === id); if (c) sfx.push({ t: c.t + dt, name, gain }); };
    add("hook", 0.65, "click", -12); add("full", 0.5, "click", -14); add("full", 0.9, "click", -14); add("home", 0.55, "click", -8);
    add("logo", 0.3, "sparkle", -4); add("find", 0.95, "pop2", -10); add("chat", 0.35, "whoosh2", -12); add("chat", 1.25, "pop2", -8);
    add("book", 0.55, "click", -8); add("book", 1.1, "click", -8); add("book", 1.4, "sparkle", -6); add("arrive", 0.4, "whoosh", -12);
    add("arrive", 1.65, "pop", -8); add("trust", 0.5, "sparkle", -6); add("trust", 1.5, "coin", -10);
    if (S.endCue) { sfx.push({ t: S.endCue.t - 0.15, name: "whoosh", gain: -4 }, { t: S.endCue.t + 0.2, name: "impact", gain: -6 },
                               { t: S.endCue.t + 0.35, name: "sparkle", gain: -4 }); }
    return { duration: p.end, sfx };
  },

  async frame(t) {
    const s = S, u = s.u, W = s.W, H = s.H;
    // camera: hold on the active scene, glide (ease in-out) to the next; motion blur while moving
    let cx = s.stops.length ? s.stops[0].x : 0, speed = 0;
    for (let i = 0; i < s.stops.length; i++) {
      const a = s.stops[i];
      if (t >= a.t) {
        const prev = i ? s.stops[i - 1].x : a.x - W * 0.6;
        const k = seg(t, a.t, a.t + 0.55);
        cx = lerp(prev, a.x, easeInOutCubic(k));
        speed = k > 0 && k < 1 ? Math.sin(Math.PI * k) : 0;
      }
    }
    const drift = Math.sin(t * 0.7) * 0.6 * u;
    s.world.style.transform = `translate(${-cx}px, ${drift}px) scale(${1 + 0.01 * Math.sin(t * 0.5)})`;
    s.world.style.filter = speed > 0.02 ? `blur(${speed * 0.9 * u}px)` : "none";
    // the line is drawn up to just ahead of the camera
    const lead = cx + W * (t < (s.items[0] ? s.items[0].c.t : 0) + 0.6 ? 0.34 * seg(t, 0, 0.9) + 0.0 : 0.62);
    const len = s.lenAt(lead);
    s.ln.setAttribute("stroke-dashoffset", s.L - len);
    const hp = s.ln.getPointAtLength(len);
    s.head.style.left = `${hp.x}px`; s.head.style.top = `${hp.y}px`;
    // scene objects (each animates on its own local clock; visible ones only)
    s.items.forEach((it, i) => {
      const lt = t - it.c.t;
      const near = Math.abs(it.x - (cx + s.OX)) < W * 1.2;
      if (near) it.frame(Math.max(-1, lt));
    });
    // text pulls focus in on its line and out on the next
    s.texts.forEach((tx, i) => {
      if (!tx) return;
      const c = s.p.cues[i], nx = s.p.cues[i + 1];
      const kin = seg(t, c.t, c.t + 0.35), kout = nx ? seg(t, nx.t - 0.2, nx.t + 0.05) : 0;
      const v = kin * (1 - kout);
      tx.style.opacity = v;
      tx.style.filter = `blur(${(1 - kin + kout) * 1.6 * u}px)`;
      tx.style.transform = `translateX(${(1 - easeOutCubic(kin)) * -2 * u + kout * 3 * u}px)`;
    });
    // end card: circular brand-colour flood from the centre, then logo, wordmark, tagline, CTA
    s.fx.clearRect(0, 0, W, H);
    if (s.endCue) {
      const e0 = s.endCue.t - 0.15;
      const fk = easeInOutCubic(seg(t, e0, e0 + 0.45));
      s.flood.style.opacity = fk > 0 ? 1 : 0;
      s.flood.style.clipPath = `circle(${fk * 120}% at 50% 50%)`;
      const lk = seg(t, e0 + 0.35, e0 + 0.75);
      s.endLogo.style.opacity = lk > 0 ? 1 : 0;
      s.endLogo.style.transform = `scale(${lk > 0 ? spring(lk, 1.4, 5) : 0.001}) rotate(${Math.sin(Math.max(0, t - e0 - 1.2) * 3) * 3 * seg(t, e0 + 1.2, e0 + 1.5)}deg)`;
      const wk = seg(t, e0 + 0.55, e0 + 0.9);
      s.endWord.style.opacity = wk; s.endWord.style.transform = `translateY(${(1 - easeOutCubic(wk)) * 4 * u}px)`;
      const tk = seg(t, e0 + 0.9, e0 + 1.2);
      s.endTag.style.opacity = tk; s.endTag.style.filter = `blur(${(1 - tk) * 1.2 * u}px)`;
      const ck = seg(t, e0 + 1.3, e0 + 1.6);
      s.endCta.style.opacity = ck; s.endCta.style.transform = `translateX(-50%) scale(${ck > 0 ? easeOutBack(ck, 2.4) : 0.001})`;
      [[0.36, 0.22, e0 + 0.6], [0.64, 0.28, e0 + 0.75], [0.6, 0.55, e0 + 0.9]].forEach(([x, y, t0]) =>
        sparkle(s.fx, x * W, y * H, H * 0.06, seg(t, t0, t0 + 0.5)));
    }
  },
};
