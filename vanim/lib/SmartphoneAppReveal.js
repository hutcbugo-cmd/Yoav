// SmartphoneAppReveal: a phone swings into view in 3D and demonstrates booking a nail technician:
// splash logo -> search typed -> results -> tap a technician -> profile with portfolio and stars
// -> pick a date and time -> "book" -> confirmation tick with confetti. The screen is real HTML
// (Hebrew, RTL) rendered by Chromium, so text is crisp and every element can be animated.
// params: brand, accent, query, techs [{name, rating, km, colors}], date, time, exit,
//         logo (optional image path under the repo, replaces the text logo)
import { seg, lerp, clamp, easeOutBack, easeInBack, easeOutCubic, easeInOutCubic, spring, shade }
  from "./ease.js";

let S;

const el = (tag, css, html = "") => {
  const e = document.createElement(tag);
  if (css) e.style.cssText = css;
  e.innerHTML = html;
  return e;
};
const star = (fill) => `<svg viewBox="0 0 24 24" width="1em" height="1em" style="vertical-align:-0.12em">
  <path d="M12 2.6l2.9 6 6.5.9-4.7 4.6 1.1 6.5L12 17.5l-5.8 3.1 1.1-6.5-4.7-4.6 6.5-.9z" fill="${fill}"/></svg>`;
const pin = (c) => `<svg viewBox="0 0 24 24" width="1em" height="1em" style="vertical-align:-0.12em">
  <path d="M12 2a7 7 0 0 0-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z" fill="${c}"/></svg>`;

// polished-nail tile used for avatars' portfolio swatches and the profile gallery
function nailTile(color, r) {
  return `background:
    radial-gradient(ellipse 30% 18% at 35% 22%, rgba(255,255,255,.75), rgba(255,255,255,0) 70%),
    linear-gradient(160deg, ${shade(color, 0.25)}, ${color} 55%, ${shade(color, -0.25)});
    border-radius:${r}`;
}

function buildScreen(p, sw, sh) {
  const u = sw / 84;  // layout unit: sized for reading on a phone-sized social video
  const A = p.accent;
  const scr = el("div", `position:absolute;inset:0;overflow:hidden;background:#fff6f9;direction:rtl;
    border-radius:${11 * u}px;color:#2a1b22`);
  // status bar
  scr.append(el("div", `position:absolute;top:${2.6 * u}px;left:${7 * u}px;right:${7 * u}px;display:flex;
    justify-content:space-between;font:700 ${3.6 * u}px Assistant;z-index:5;direction:ltr`,
    `<span>9:41</span><span style="letter-spacing:${0.6 * u}px">▮▮▮ ▰</span>`));

  // --- page 1: home + search + results
  const home = el("div", `position:absolute;inset:0;padding:${15 * u}px ${6 * u}px 0`);
  home.append(el("div", `font:800 ${7.2 * u}px Assistant;line-height:1.1`, "היי, מה מתחשק<br>לך היום?"));
  const search = el("div", `margin-top:${5 * u}px;height:${12 * u}px;border-radius:${6 * u}px;background:#fff;
    box-shadow:0 ${0.8 * u}px ${3 * u}px rgba(160,40,90,.14);display:flex;align-items:center;
    padding:0 ${4.5 * u}px;font:700 ${4.6 * u}px Assistant;gap:${2.5 * u}px`);
  search.innerHTML = `<svg viewBox="0 0 24 24" width="${5.5 * u}" height="${5.5 * u}"><circle cx="10.5" cy="10.5" r="6.5"
    stroke="${A}" stroke-width="2.6" fill="none"/><path d="M15.5 15.5L21 21" stroke="${A}" stroke-width="2.6"
    stroke-linecap="round"/></svg><span class="q"></span><span class="caret" style="width:${0.6 * u}px;
    height:${6 * u}px;background:${A};border-radius:2px"></span>`;
  home.append(search);
  const cards = [];
  p.techs.forEach((tc, i) => {
    const c = el("div", `margin-top:${i ? 3.2 * u : 6 * u}px;background:#fff;border-radius:${5 * u}px;
      padding:${3.4 * u}px;display:flex;gap:${3.4 * u}px;align-items:center;
      box-shadow:0 ${1 * u}px ${4 * u}px rgba(160,40,90,.12);transform-origin:50% 50%`);
    const av = el("div", `width:${15 * u}px;height:${15 * u}px;border-radius:50%;flex:none;display:flex;
      align-items:center;justify-content:center;color:#fff;font:800 ${6.5 * u}px Assistant;
      background:linear-gradient(140deg, ${shade(tc.colors[0], 0.2)}, ${tc.colors[0]})`, tc.name[0]);
    const info = el("div", "flex:1;min-width:0");
    info.innerHTML = `<div style="font:800 ${4.9 * u}px Assistant">${tc.name}</div>
      <div style="font:700 ${3.5 * u}px Assistant;color:#8a6b78;margin-top:${0.6 * u}px">
      <span style="color:#f5a623">${star("#f5a623")}</span> ${tc.rating} &nbsp; ${pin("#b48a9b")} ${tc.km} ק"מ</div>`;
    const sw3 = el("div", `display:flex;gap:${1.2 * u}px;margin-top:${1.6 * u}px`);
    tc.colors.forEach((col) => sw3.append(el("div", `width:${5.4 * u}px;height:${7 * u}px;${nailTile(col, `${2.7 * u}px ${2.7 * u}px ${1.4 * u}px ${1.4 * u}px`)}`)));
    info.append(sw3);
    c.append(av, info);
    home.append(c);
    cards.push(c);
  });

  // --- page 2: profile, gallery, date + time, book button
  const t0 = p.techs[0];
  const prof = el("div", `position:absolute;inset:0;background:#fff6f9`);
  const cover = el("div", `height:${44 * u}px;position:relative;
    background:linear-gradient(150deg, ${shade(A, 0.35)}, ${A})`);
  const gal = el("div", `position:absolute;bottom:${-9 * u}px;left:${6 * u}px;right:${6 * u}px;display:flex;
    gap:${2.4 * u}px;justify-content:center`);
  const tiles = [];
  t0.colors.slice(0, 3).forEach((col) => {
    const tl = el("div", `width:${21 * u}px;height:${27 * u}px;${nailTile(col, `${10.5 * u}px ${10.5 * u}px ${3 * u}px ${3 * u}px`)};
      box-shadow:0 ${1.2 * u}px ${3 * u}px rgba(0,0,0,.18);border:${0.9 * u}px solid #fff`);
    gal.append(tl); tiles.push(tl);
  });
  cover.append(gal);
  prof.append(cover);
  const body = el("div", `padding:${13 * u}px ${6 * u}px 0`);
  const stars = [];
  body.innerHTML = `<div style="font:800 ${6.6 * u}px Assistant">${t0.name}</div>
    <div style="font:700 ${3.6 * u}px Assistant;color:#8a6b78">מניקור ג'ל · ${t0.km} ק"מ ממך</div>`;
  const sr = el("div", `margin-top:${1.5 * u}px;font-size:${5.6 * u}px;display:flex;gap:${0.8 * u}px;direction:ltr;
    justify-content:flex-end`);
  for (let i = 0; i < 5; i++) {
    const s = el("span", "display:inline-block", star("#f5a623"));
    sr.append(s); stars.push(s);
  }
  body.append(sr);
  body.append(el("div", `margin-top:${4 * u}px;font:800 ${4.6 * u}px Assistant`, "בחרי תאריך"));
  const days = el("div", `display:flex;gap:${1.8 * u}px;margin-top:${2.4 * u}px`);
  const dayEls = [];
  ["א", "ב", "ג", "ד", "ה"].forEach((d, i) => {
    const de = el("div", `flex:1;border-radius:${3.4 * u}px;background:#fff;text-align:center;
      padding:${2 * u}px 0;box-shadow:0 ${0.6 * u}px ${2 * u}px rgba(160,40,90,.1)`,
      `<div style="font:700 ${3.3 * u}px Assistant;opacity:.65">${d}</div>
       <div style="font:800 ${5.2 * u}px Assistant">${13 + i}</div>`);
    days.append(de); dayEls.push(de);
  });
  body.append(days);
  const slots = el("div", `display:flex;flex-wrap:wrap;gap:${2 * u}px;margin-top:${4 * u}px`);
  const slotEls = [];
  ["10:00", "12:30", p.time].forEach((tm) => {
    const s = el("div", `padding:${1.8 * u}px ${4.2 * u}px;border-radius:${10 * u}px;background:#fff;
      font:800 ${4.2 * u}px Assistant;border:${0.5 * u}px solid ${shade(A, 0.6)}`, tm);
    slots.append(s); slotEls.push(s);
  });
  body.append(slots);
  const btn = el("div", `position:absolute;left:${6 * u}px;right:${6 * u}px;bottom:${7 * u}px;height:${13.5 * u}px;
    border-radius:${7 * u}px;background:linear-gradient(90deg, ${shade(A, 0.15)}, ${A});color:#fff;display:flex;
    align-items:center;justify-content:center;font:800 ${5.4 * u}px Assistant;
    box-shadow:0 ${1.6 * u}px ${4 * u}px ${A}66`, "קביעת תור");
  prof.append(body, btn);

  // --- splash
  const splash = el("div", `position:absolute;inset:0;display:flex;align-items:center;justify-content:center;
    background:radial-gradient(circle at 50% 40%, ${shade(A, 0.3)}, ${A} 70%);z-index:3`);
  const logo = p.logo
    ? el("img", `width:${50 * u}px`)
    : el("div", `font:800 ${20 * u}px Assistant;color:#fff;letter-spacing:${-0.5 * u}px;
        text-shadow:0 ${1 * u}px ${4 * u}px rgba(0,0,0,.18);direction:ltr`, p.brand);
  if (p.logo) logo.src = "/" + p.logo;
  splash.append(logo);

  // --- confirmation sheet
  const done = el("div", `position:absolute;inset:0;z-index:4;display:flex;flex-direction:column;
    align-items:center;justify-content:center;background:rgba(255,246,249,0)`);
  const circ = el("div", `width:${34 * u}px;height:${34 * u}px;border-radius:50%;background:${A};display:flex;
    align-items:center;justify-content:center;box-shadow:0 ${2 * u}px ${8 * u}px ${A}88`);
  circ.innerHTML = `<svg viewBox="0 0 52 52" width="${20 * u}" height="${20 * u}"><path class="tick" d="M14 27l8 8 16-17"
    fill="none" stroke="#fff" stroke-width="5.5" stroke-linecap="round" stroke-linejoin="round"
    stroke-dasharray="40" stroke-dashoffset="40"/></svg>`;
  const dt = el("div", `margin-top:${6 * u}px;font:800 ${8 * u}px Assistant;text-align:center;line-height:1.15`,
    `התור נקבע!<div style="font:700 ${4.4 * u}px Assistant;color:#8a6b78;margin-top:${1.5 * u}px">
     ${t0.name} · יום ה' ${p.date} · ${p.time}</div>`);
  done.append(circ, dt);
  const conf = el("canvas", "position:absolute;inset:0;z-index:6;pointer-events:none");
  conf.width = sw; conf.height = sh;

  // tap indicator
  const tap = el("div", `position:absolute;z-index:7;width:${13 * u}px;height:${13 * u}px;margin:${-6.5 * u}px 0 0 ${-6.5 * u}px;
    border-radius:50%;background:rgba(255,255,255,.55);border:${0.7 * u}px solid rgba(255,255,255,.95);
    box-shadow:0 0 ${3 * u}px rgba(0,0,0,.25);opacity:0`);
  scr.append(home, prof, splash, done, conf, tap);
  return { scr, home, prof, splash, logo, search, cards, tiles, stars, dayEls, slotEls, btn, done, circ, dt,
           conf, tap, u };
}

// deterministic confetti: particles are a pure function of t
function confetti(ctx, w, h, k, colors) {
  ctx.clearRect(0, 0, w, h);
  if (k <= 0 || k >= 1) return;
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 70; i++) {
    const a = rnd() * Math.PI * 2, v = (0.35 + rnd() * 0.65) * w * 0.9, spin = (rnd() - 0.5) * 14;
    const x = w / 2 + Math.cos(a) * v * k, y = h * 0.42 + Math.sin(a) * v * k * 0.8 + 1.4 * w * k * k;
    ctx.save();
    ctx.globalAlpha = 1 - Math.pow(k, 3);
    ctx.translate(x, y); ctx.rotate(spin * k);
    ctx.fillStyle = colors[i % colors.length];
    ctx.fillRect(-w * 0.014, -w * 0.007, w * 0.028, w * 0.014 * (0.6 + rnd()));
    ctx.restore();
  }
}

export default {
  async setup(root, params, W, H) {
    const p = Object.assign({
      brand: "Nomi", accent: "#FF2E8B", query: "מניקור ג'ל", date: "17", time: "18:30", exit: true,
      techs: [
        { name: "נועה", rating: "4.9", km: "1.2", colors: ["#FF2E8B", "#C21E6A", "#F7B2CC"] },
        { name: "מאיה", rating: "4.8", km: "2.0", colors: ["#B71C3C", "#E9A1A1", "#7A1030"] },
        { name: "שירה", rating: "4.9", km: "2.6", colors: ["#F4C7D4", "#D86A9E", "#FFFFFF"] },
      ],
    }, params);
    root.style.perspective = `${W * 2.6}px`;
    const pw = Math.round(W * 0.6), ph = Math.round(pw * 2.05), bez = Math.round(pw * 0.035);
    const sw = pw - 2 * bez, sh = ph - 2 * bez;
    const shadow = el("div", `position:absolute;left:${(W - pw) / 2}px;top:${(H + ph) / 2 - ph * 0.02}px;width:${pw}px;
      height:${pw * 0.16}px;border-radius:50%;background:radial-gradient(closest-side, rgba(60,0,30,.35), rgba(60,0,30,0))`);
    const phone = el("div", `position:absolute;left:${(W - pw) / 2}px;top:${(H - ph) / 2}px;width:${pw}px;height:${ph}px;
      border-radius:${pw * 0.15}px;transform-style:preserve-3d;
      background:linear-gradient(135deg, #3a3a40, #0d0d10 40%, #26262b 70%, #0a0a0c);
      box-shadow:inset 0 0 0 ${pw * 0.006}px #77777f, inset 0 0 0 ${pw * 0.012}px #121214`);
    const holder = el("div", `position:absolute;left:${bez}px;top:${bez}px;width:${sw}px;height:${sh}px`);
    const ui = buildScreen(p, sw, sh);
    holder.append(ui.scr);
    const island = el("div", `position:absolute;left:50%;top:${sh * 0.018 + bez}px;width:${pw * 0.28}px;
      height:${pw * 0.075}px;margin-left:${-pw * 0.14}px;border-radius:${pw}px;background:#050506;z-index:9`);
    const glare = el("div", `position:absolute;inset:0;border-radius:${pw * 0.15}px;pointer-events:none;z-index:10;
      background:linear-gradient(115deg, rgba(255,255,255,0) 30%, rgba(255,255,255,.28) 45%, rgba(255,255,255,0) 60%);
      background-size:300% 100%`);
    phone.append(holder, island, glare);
    root.append(shadow, phone);
    S = { p, W, H, pw, ph, sw, sh, phone, shadow, glare, ...ui };
    // tap targets in screen coordinates (layout is final now; the phone has no transform yet)
    const sr = ui.scr.getBoundingClientRect();
    const centre = (e) => { const r = e.getBoundingClientRect();
      return [r.left - sr.left + r.width / 2, r.top - sr.top + r.height / 2]; };
    ui.prof.style.transform = "none";
    S.targets = { card: centre(ui.cards[0]), day: centre(ui.dayEls[4]), slot: centre(ui.slotEls[2]),
                  btn: centre(ui.btn) };
    // typing schedule: one character every 0.07 s from 1.25 s
    S.typeAt = (i) => 1.25 + i * 0.075;
    const sfx = [
      { t: 0.0, name: "whoosh", gain: -4 }, { t: 0.42, name: "pop", gain: -3 },
      ...[...p.query].map((_, i) => ({ t: S.typeAt(i), name: "click", gain: -17 })),
      { t: 2.05, name: "pop2", gain: -12 }, { t: 2.17, name: "pop2", gain: -13 }, { t: 2.29, name: "pop2", gain: -14 },
      { t: 2.78, name: "click", gain: -6 }, { t: 2.95, name: "whoosh2", gain: -9 },
      { t: 3.45, name: "sparkle", gain: -10 },
      { t: 4.05, name: "click", gain: -6 }, { t: 4.55, name: "click", gain: -6 },
      { t: 5.05, name: "click", gain: -4 }, { t: 5.3, name: "pop", gain: -3 }, { t: 5.42, name: "sparkle", gain: -2 },
      ...(p.exit ? [{ t: 6.75, name: "whoosh", gain: -8 }] : []),
    ];
    return { duration: p.exit ? 7.2 : 6.8, sfx };
  },

  async frame(t) {
    const s = S, u = s.u, A = s.p.accent;
    // phone entrance: swings in from below-left with a spring; idle float; exit flip away
    const kin = seg(t, 0, 0.85), sp = spring(kin, 1.6, 6);
    let ry = lerp(-78, 0, sp), rx = lerp(24, 0, sp), rz = lerp(-10, 0, sp), ty = lerp(0.55, 0, easeOutCubic(kin));
    let sc = lerp(0.6, 1, easeOutBack(kin, 1.4));
    ry += 5 * Math.sin(t * 1.1) * seg(t, 0.8, 1.6); rx += 2.5 * Math.sin(t * 0.8 + 1) * seg(t, 0.8, 1.6);
    if (s.p.exit) {
      const ke = easeInBack(seg(t, 6.75, 7.2), 1.5);
      ry += 70 * ke; ty -= 0.25 * ke; sc *= 1 - 0.5 * ke;
    }
    const op = clamp(kin * 4) * (s.p.exit ? 1 - seg(t, 7.05, 7.2) : 1);
    s.phone.style.transform = `translateY(${ty * s.H}px) scale(${sc}) rotateX(${rx}deg) rotateY(${ry}deg) rotateZ(${rz}deg)`;
    s.phone.style.opacity = op;
    s.shadow.style.opacity = op * clamp(1 - Math.abs(ry) / 60);
    s.shadow.style.transform = `scaleX(${sc})`;
    s.glare.style.backgroundPosition = `${lerp(110, -10, easeInOutCubic(seg(t, 0.2, 1.3)))}% 0`;

    // splash: logo pops, then the splash slides up to reveal the app
    const lk = seg(t, 0.35, 0.8);
    s.logo.style.transform = `scale(${lk <= 0 ? 0 : easeOutBack(lk, 2.4)})`;
    s.splash.style.transform = `translateY(${-100 * easeInOutCubic(seg(t, 1.0, 1.3))}%)`;

    // typing the query
    const q = [...s.p.query];
    const nType = q.filter((_, i) => t >= s.typeAt(i)).length;
    s.search.querySelector(".q").textContent = q.slice(0, nType).join("");
    s.search.querySelector(".caret").style.opacity = t < 2.0 ? (Math.floor(t * 4) % 2 ? 0.2 : 1) : 0;
    // results stagger in
    s.cards.forEach((c, i) => {
      const k = seg(t, 2.05 + i * 0.12, 2.45 + i * 0.12);
      c.style.opacity = clamp(k * 2);
      c.style.transform = `translateY(${(1 - easeOutBack(k, 1.6)) * 18 * u}px)`;
    });
    // tap card -> profile slides in
    const press = Math.sin(Math.PI * seg(t, 2.72, 2.92));
    s.cards[0].style.transform += ` scale(${1 - 0.04 * press})`;
    const pk = easeInOutCubic(seg(t, 2.95, 3.3));
    s.home.style.transform = `translateX(${-30 * pk}%)`;
    s.prof.style.transform = `translateX(${100 * (1 - pk)}%)`;
    s.tiles.forEach((tl, i) => {
      const k = seg(t, 3.15 + i * 0.08, 3.55 + i * 0.08);
      tl.style.transform = `translateY(${(1 - easeOutBack(k, 2)) * 10 * u}px) rotate(${(i - 1) * 5 * (1 - k)}deg)`;
      tl.style.opacity = clamp(k * 3);
    });
    s.stars.forEach((st, i) => {
      const k = seg(t, 3.45 + i * 0.06, 3.7 + i * 0.06);
      st.style.transform = `scale(${k <= 0 ? 0 : easeOutBack(k, 3)})`;
    });
    // pick a date, then a time
    s.dayEls.forEach((d, i) => {
      const on = i === 4 && t >= 4.05;
      const b = on ? 1 + 0.12 * Math.sin(Math.PI * seg(t, 4.05, 4.3)) : 1;
      d.style.background = on ? A : "#fff";
      d.style.color = on ? "#fff" : "#2a1b22";
      d.style.transform = `scale(${b})`;
    });
    s.slotEls.forEach((el2, i) => {
      const k = seg(t, 4.15 + i * 0.06, 4.4 + i * 0.06);
      const on = i === 2 && t >= 4.55;
      el2.style.opacity = clamp(k * 2);
      el2.style.transform = `scale(${(k <= 0 ? 0.5 : lerp(0.5, 1, easeOutBack(k, 2))) *
        (on ? 1 + 0.12 * Math.sin(Math.PI * seg(t, 4.55, 4.8)) : 1)})`;
      el2.style.background = on ? A : "#fff";
      el2.style.color = on ? "#fff" : "#2a1b22";
    });
    // book button: attention pulse, press
    const pulse = 1 + 0.04 * Math.sin(Math.PI * 2 * seg(t, 4.6, 5.0)) - 0.06 * Math.sin(Math.PI * seg(t, 5.0, 5.2));
    s.btn.style.transform = `scale(${pulse})`;
    // confirmation: backdrop, circle springs, tick draws, confetti
    const ck = seg(t, 5.2, 5.5);
    s.done.style.background = `rgba(255,246,249,${0.96 * clamp(ck * 2)})`;
    s.circ.style.transform = `scale(${ck <= 0 ? 0 : easeOutBack(ck, 2.6)})`;
    s.done.querySelector(".tick").setAttribute("stroke-dashoffset", 40 * (1 - easeOutCubic(seg(t, 5.38, 5.65))));
    const dk = seg(t, 5.5, 5.85);
    s.dt.style.opacity = dk; s.dt.style.transform = `translateY(${(1 - easeOutCubic(dk)) * 6 * u}px)`;
    confetti(s.conf.getContext("2d"), s.sw, s.sh, seg(t, 5.3, 6.6),
             [A, "#FFD24D", "#7DD3FC", "#FFFFFF", shade(A, -0.3)]);

    // finger taps (where and when)
    const taps = [[2.72, s.targets.card], [4.02, s.targets.day], [4.52, s.targets.slot], [5.0, s.targets.btn]];
    let shown = false;
    for (const [t0, [x, y]] of taps) {
      const k = seg(t, t0 - 0.12, t0 + 0.3);
      if (k > 0 && k < 1) {
        s.tap.style.left = x + "px"; s.tap.style.top = y + "px";
        s.tap.style.opacity = Math.sin(Math.PI * k);
        s.tap.style.transform = `scale(${lerp(1.4, 0.8, easeOutCubic(clamp(k * 2)))})`;
        shown = true;
      }
    }
    if (!shown) s.tap.style.opacity = 0;
  },
};
