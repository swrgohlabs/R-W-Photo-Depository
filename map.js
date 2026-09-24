/* The spiderweb: a little force-directed layout, no libraries.
   Ryan & Wanting are pinned in the middle; everyone else settles around them. */
const D = window.DATA;
const cv = document.getElementById("cv"), ctx = cv.getContext("2d");
const stage = document.getElementById("stage");

const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const byId = {};
D.people.forEach(p => byId[p.id] = p);
const centre = new Set(D.centre);

const maxN = Math.max(...D.people.map(p => p.n));
const nodes = D.people.map((p, i) => {
  const angle = i * 2.39996, r = 40 + 26 * Math.sqrt(i);   // golden-angle start, spreads evenly
  return {
    p, id: p.id, name: p.name,
    x: centre.has(p.id) ? 0 : Math.cos(angle) * r,
    y: centre.has(p.id) ? 0 : Math.sin(angle) * r,
    vx: 0, vy: 0,
    r: 11 + 17 * Math.sqrt(p.n / maxN),
    pinned: centre.has(p.id),
    img: null,
  };
});
const nodeById = {};
nodes.forEach(n => nodeById[n.id] = n);
D.centre.forEach((id, k) => {                     // side by side in the middle
  const n = nodeById[id];
  if (n) { n.x = (k - (D.centre.length - 1) / 2) * 95; n.y = 0; n.r = Math.max(n.r, 30); }
});

const allEdges = [];
const seen = new Set();
for (const p of D.people) {
  for (const [other, w] of p.with) {
    const key = p.id < other ? p.id + "|" + other : other + "|" + p.id;
    if (seen.has(key) || !nodeById[other]) continue;
    seen.add(key);
    allEdges.push({ a: nodeById[p.id], b: nodeById[other], w });
  }
}
const maxW = Math.max(...allEdges.map(e => e.w), 1);

let minW = 2, edges = [], neighbours = new Map();
function applyFilter() {
  edges = allEdges.filter(e => e.w >= minW);
  neighbours = new Map(nodes.map(n => [n, new Set()]));
  for (const e of edges) { neighbours.get(e.a).add(e.b); neighbours.get(e.b).add(e.a); }
  alpha = 0.9;
}

/* ---------- avatars ---------- */
for (const n of nodes) {
  if (!n.p.face) continue;
  const img = new Image();
  img.onload = () => { n.img = img; draw(); };
  img.src = `faces/${n.id}.jpg`;
}

/* ---------- simulation ---------- */
let alpha = 1;
function tick() {
  const k = alpha;
  for (let i = 0; i < nodes.length; i++) {
    const a = nodes[i];
    for (let j = i + 1; j < nodes.length; j++) {
      const b = nodes[j];
      let dx = b.x - a.x, dy = b.y - a.y;
      let d2 = dx * dx + dy * dy;
      if (d2 < 1) { dx = Math.random() - .5; dy = Math.random() - .5; d2 = 1; }
      const min = (a.r + b.r + 22) ** 2;
      const f = (3200 + (d2 < min ? 14000 : 0)) / d2;       // push apart, harder when overlapping
      const d = Math.sqrt(d2), fx = dx / d * f, fy = dy / d * f;
      a.vx -= fx * k; a.vy -= fy * k; b.vx += fx * k; b.vy += fy * k;
    }
  }
  for (const e of edges) {
    const dx = e.b.x - e.a.x, dy = e.b.y - e.a.y;
    const d = Math.hypot(dx, dy) || 1;
    const rest = 120 + 220 / (1 + e.w);                     // more shared photos = closer
    const f = (d - rest) * 0.0016 * Math.min(e.w, 6) * k;
    const fx = dx / d * f, fy = dy / d * f;
    e.a.vx += fx; e.a.vy += fy; e.b.vx -= fx; e.b.vy -= fy;
  }
  for (const n of nodes) {
    if (n.pinned || n === dragging) { n.vx = n.vy = 0; continue; }
    // pull everyone toward the middle; people with no links get pulled harder so
    // they don't strand themselves on a far ring and shrink the whole map
    const g = neighbours.get(n).size ? 0.003 : 0.011;
    n.vx -= n.x * g * k; n.vy -= n.y * g * k;
    n.vx *= 0.82; n.vy *= 0.82;
    n.x += Math.max(-25, Math.min(25, n.vx));
    n.y += Math.max(-25, Math.min(25, n.vy));
  }
  alpha *= 0.992;
}

/* ---------- view ---------- */
let scale = 1, ox = 0, oy = 0, dpr = 1;
let hover = null, picked = null, dragging = null, panning = null;

function resize() {
  document.documentElement.style.setProperty("--hdr", document.querySelector("header.top").offsetHeight + "px");
  dpr = Math.min(2, window.devicePixelRatio || 1);
  cv.width = stage.clientWidth * dpr;
  cv.height = stage.clientHeight * dpr;
  draw();
}
const toWorld = (px, py) => ({ x: (px - cv.width / dpr / 2) / scale - ox, y: (py - cv.height / dpr / 2) / scale - oy });

function draw() {
  const w = cv.width / dpr, h = cv.height / dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  ctx.save();
  ctx.translate(w / 2, h / 2); ctx.scale(scale, scale); ctx.translate(ox, oy);

  const lit = hover || picked;
  const near = lit ? neighbours.get(lit) : null;

  for (const e of edges) {
    const on = lit && (e.a === lit || e.b === lit);
    ctx.strokeStyle = on ? "rgba(216,166,87,.75)" : `rgba(150,140,128,${lit ? .05 : .13})`;
    ctx.lineWidth = (on ? 1.6 : 0.8) + 1.7 * (e.w / maxW);
    ctx.beginPath(); ctx.moveTo(e.a.x, e.a.y); ctx.lineTo(e.b.x, e.b.y); ctx.stroke();
  }

  for (const n of nodes) {
    const on = !lit || n === lit || (near && near.has(n));
    ctx.globalAlpha = on ? 1 : .22;
    ctx.save();
    ctx.beginPath(); ctx.arc(n.x, n.y, n.r, 0, 7); ctx.closePath();
    if (n.img) { ctx.save(); ctx.clip(); ctx.drawImage(n.img, n.x - n.r, n.y - n.r, n.r * 2, n.r * 2); ctx.restore(); }
    else {
      ctx.fillStyle = "#2b2825"; ctx.fill();
      ctx.fillStyle = "#a49c90"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.font = `${Math.round(n.r)}px Georgia, serif`;
      ctx.fillText(n.name.slice(0, 1).toUpperCase(), n.x, n.y + 1);
    }
    ctx.lineWidth = n.pinned ? 3.5 : 2;
    ctx.strokeStyle = n.pinned ? "#d8a657" : n === lit ? "#f2ece3" : n.p.n >= 8 ? "#c97a6d" : "#7f8c8d";
    ctx.stroke();
    ctx.restore();

    // when zoomed out, only label the people with the most photos, so names don't collide
    const label = n.pinned || n === lit || (near && near.has(n)) ||
                  scale > 0.9 || (scale > 0.6 && n.p.n >= 5) || n.p.n >= 12;
    if (label) {
      ctx.fillStyle = n === lit ? "#f2ece3" : "rgba(242,236,227,.8)";
      ctx.textAlign = "center"; ctx.textBaseline = "top";
      ctx.font = `${n.pinned ? 600 : 400} ${Math.max(11, 12 / Math.sqrt(scale))}px system-ui, sans-serif`;
      ctx.fillText(n.name, n.x, n.y + n.r + 4);
    }
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

function frame() {
  if (alpha > 0.004) { tick(); draw(); }
  requestAnimationFrame(frame);
}

function nodeAt(px, py) {
  const w = toWorld(px, py);
  let best = null, bd = Infinity;
  for (const n of nodes) {
    const d = Math.hypot(n.x - w.x, n.y - w.y);
    if (d < n.r + 16 / scale && d < bd) { best = n; bd = d; }
  }
  return best;
}

function showInfo(n) {
  picked = n;
  const info = document.getElementById("info");
  if (!n) { info.classList.remove("on"); draw(); return; }
  const top = n.p.with.slice(0, 8).map(([id, c]) =>
    `<li><span>${esc(byId[id] ? byId[id].name : id)}</span><span>${c}</span></li>`).join("");
  document.getElementById("infobody").innerHTML =
    (n.p.face ? `<img class="avatar" src="faces/${n.id}.jpg" alt="">`
              : `<div class="avatar">${esc(n.name.slice(0, 1).toUpperCase())}</div>`) +
    `<h4>${esc(n.name)}</h4><div class="muted">${n.p.n} photo${n.p.n === 1 ? "" : "s"} · ` +
    `${n.p.with.length} connection${n.p.with.length === 1 ? "" : "s"}</div>` +
    (top ? `<ul>${top}</ul>` : "");
  document.getElementById("infolink").href = `index.html#/p/${n.id}`;
  info.classList.add("on");
  draw();
}

/* ---------- interaction ---------- */
const MIN_SCALE = 0.15, MAX_SCALE = 3.5;
const small = () => window.matchMedia("(max-width: 720px)").matches;

// zoom so the world point under screen point (px, py) stays put
function zoomAt(px, py, s) {
  const w = toWorld(px, py);
  scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, s));
  ox = (px - cv.width / dpr / 2) / scale - w.x;
  oy = (py - cv.height / dpr / 2) / scale - w.y;
  draw();
}
function centreOn(n, s = scale) { scale = s; ox = -n.x; oy = -n.y; draw(); }

const pts = new Map();          // active pointers, for pinch
let pinch = null, down = null;  // down: where a press started, to tell a tap from a drag
let unlit = null;               // face just un-picked by a click; don't hover-light it until the mouse leaves

stage.addEventListener("pointerdown", e => {
  stage.setPointerCapture(e.pointerId);
  pts.set(e.pointerId, { x: e.offsetX, y: e.offsetY });
  if (pts.size === 2) {         // second finger: stop dragging, start pinching
    const [a, b] = [...pts.values()];
    pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, scale };
    dragging = panning = down = null;
    stage.classList.remove("drag");
    return;
  }
  if (pts.size > 2) return;
  down = { x: e.offsetX, y: e.offsetY, moved: false };
  const n = nodeAt(e.offsetX, e.offsetY);
  down.again = n && n === picked;        // tapping the picked face again un-picks it (on release)
  if (n) { dragging = n; if (!down.again) showInfo(n); }
  else { panning = { x: e.offsetX, y: e.offsetY, ox, oy }; stage.classList.add("drag"); }
});
stage.addEventListener("pointermove", e => {
  if (pts.has(e.pointerId)) pts.set(e.pointerId, { x: e.offsetX, y: e.offsetY });
  if (down && Math.hypot(e.offsetX - down.x, e.offsetY - down.y) > 6) down.moved = true;
  if (pinch && pts.size === 2) {
    const [a, b] = [...pts.values()];
    zoomAt((a.x + b.x) / 2, (a.y + b.y) / 2, pinch.scale * Math.hypot(a.x - b.x, a.y - b.y) / pinch.d);
  } else if (dragging) {
    if (!down || !down.moved) return;     // a tap on a face shouldn't nudge it
    const w = toWorld(e.offsetX, e.offsetY);
    dragging.x = w.x; dragging.y = w.y; alpha = Math.max(alpha, .35); draw();
  } else if (panning) {
    ox = panning.ox + (e.offsetX - panning.x) / scale;
    oy = panning.oy + (e.offsetY - panning.y) / scale;
    draw();
  } else if (e.pointerType === "mouse") {
    let n = nodeAt(e.offsetX, e.offsetY);
    if (n !== unlit) unlit = null; else n = null;
    if (n !== hover) { hover = n; stage.style.cursor = n ? "pointer" : "grab"; draw(); }
  }
});
function release(e) {
  pts.delete(e.pointerId);
  if (down && !down.moved && (panning || down.again)) {  // tap on empty space, or on the picked face, closes the card
    if (down.again) { unlit = picked; hover = null; }
    showInfo(null);
  }
  if (pts.size < 2) pinch = null;
  dragging = panning = down = null;
  stage.classList.remove("drag");
}
stage.addEventListener("pointerup", release);
stage.addEventListener("pointercancel", release);
stage.addEventListener("wheel", e => {
  e.preventDefault();
  zoomAt(e.offsetX, e.offsetY, scale * Math.exp(-e.deltaY * 0.0014));
}, { passive: false });

const zoomBy = f => zoomAt(cv.width / dpr / 2, cv.height / dpr / 2, scale * f);
document.getElementById("zin").addEventListener("click", () => zoomBy(1.4));
document.getElementById("zout").addEventListener("click", () => zoomBy(1 / 1.4));
document.getElementById("infoclose").addEventListener("click", () => showInfo(null));

const panel = document.getElementById("panel"), ptoggle = document.getElementById("ptoggle");
ptoggle.addEventListener("click", () => {
  const open = panel.classList.toggle("open");
  ptoggle.setAttribute("aria-expanded", open);
  ptoggle.textContent = open ? "Done" : "Options";
});

document.getElementById("minw").addEventListener("input", e => {
  minW = +e.target.value;
  document.getElementById("minwv").textContent = minW;
  applyFilter(); draw();
});
document.getElementById("fit").addEventListener("click", () => {
  fitToScreen();
  if (small()) { panel.classList.remove("open"); ptoggle.textContent = "Options"; ptoggle.setAttribute("aria-expanded", false); }
});
document.getElementById("find").addEventListener("input", e => {
  const q = e.target.value.trim().toLowerCase();
  if (!q) return showInfo(null);
  const n = nodes.find(x => x.name.toLowerCase().startsWith(q)) || nodes.find(x => x.name.toLowerCase().includes(q));
  if (n) { centreOn(n, Math.max(scale, 0.9)); showInfo(n); }
});
document.getElementById("find").addEventListener("keydown", e => { if (e.key === "Enter") e.target.blur(); });

function fitToScreen() {
  const w = cv.width / dpr, h = cv.height / dpr, pad = small() ? 30 : 70;
  const xs = nodes.map(n => n.x), ys = nodes.map(n => n.y);
  const bw = Math.max(...xs) - Math.min(...xs), bh = Math.max(...ys) - Math.min(...ys);
  scale = Math.max(MIN_SCALE, Math.min(1.1, Math.min((w - pad * 2) / bw, (h - pad * 2) / bh)));
  ox = -(Math.min(...xs) + bw / 2);
  oy = -(Math.min(...ys) + bh / 2);
  draw();
}

window.addEventListener("resize", resize);
applyFilter();
for (let i = 0; i < 260; i++) tick();     // settle before the first paint
resize();
fitToScreen();
// on a phone, fitting everyone makes faces too small to tap - start on the couple instead
if (small()) {
  const mid = D.centre.map(id => nodeById[id]).filter(Boolean);
  if (mid.length) { scale = 0.6; ox = -mid.reduce((t, n) => t + n.x, 0) / mid.length; oy = 0; draw(); }
}
frame();

const start = decodeURIComponent(location.hash.slice(1));
if (start && nodeById[start]) { centreOn(nodeById[start], Math.max(scale, 0.8)); showInfo(nodeById[start]); }
