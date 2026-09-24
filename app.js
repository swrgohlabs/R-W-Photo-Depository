/* R&W Photo Depository - browse by person, hop to the people you were photographed with. */
const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

let D = null, byId = {}, lb = null;   // data, people by id, lightbox state

const photoUrl = i => `photos/${D.photos[i].f}.jpg`;
const thumbUrl = i => `thumbs/${D.photos[i].f}.jpg`;

function avatar(p, cls = "") {
  const initials = p.name.split(/\s+/).slice(0, 2).map(w => w[0] || "").join("").toUpperCase();
  return p.face ? `<img class="avatar ${cls}" src="faces/${p.id}.jpg" alt="" loading="lazy">`
                : `<div class="avatar ${cls}">${esc(initials)}</div>`;
}

function toast(msg, ms = 3000) {
  const t = $("#toast");
  t.textContent = msg; t.style.display = "block";
  clearTimeout(toast.t); toast.t = setTimeout(() => t.style.display = "none", ms);
}

const driveBtn = () =>
  `<a href="${D.drive}" target="_blank" rel="noopener" title="Original film scans, full resolution"><button>Full quality on Google Drive ↗</button></a>`;

/* ---------- views ---------- */

function personCard(p) {
  return `<a class="person" href="#/p/${p.id}">${avatar(p)}
    <div class="nm">${esc(p.name)}</div>
    <div class="ct">${p.n} photo${p.n === 1 ? "" : "s"}</div></a>`;
}

function shotTile(i) {
  const names = D.photos[i].p.map(id => byId[id] ? byId[id].name : id);
  return `<div class="shot" data-i="${i}"><img src="${thumbUrl(i)}" alt="" loading="lazy">
    <div class="who">${esc(names.join(", "))}</div></div>`;
}

function renderHome() {
  const q = (renderHome.q || "").trim().toLowerCase();
  const list = q ? D.people.filter(p => p.name.toLowerCase().includes(q)) : D.people;
  $("#view").innerHTML = `
    <section class="hero">
      <div class="kicker">Film camera photos only</div>
      <h1>Find yourself in the film</h1>
      <p>These are the photos shot on film at Ryan &amp; Wanting's wedding, scanned and sorted by face.
         Other photos from the day aren't here.</p>
      <p>Pick your name to see the ones you are in - then hop across to the people you were photographed with.</p>
      <div class="searchbar"><input type="search" id="q" placeholder="Search your name…" value="${esc(renderHome.q || "")}" autocomplete="off"></div>
    </section>
    <h2 class="section-title">Everyone <small>${D.people.length} people · most photographed first</small></h2>
    <div class="people">${list.map(personCard).join("") || `<div class="empty">No one by that name.</div>`}</div>`;
  const box = $("#q");
  box.addEventListener("input", () => { renderHome.q = box.value; renderHome(); $("#q").focus(); });
}

function renderPerson(id) {
  const p = byId[id];
  if (!p) return renderHome();
  const friends = p.with.map(([fid, c]) => ({ p: byId[fid], c })).filter(f => f.p);
  $("#view").innerHTML = `
    <div class="profile">
      ${avatar(p)}
      <div>
        <h2>${esc(p.name)}</h2>
        <div class="meta">${p.n} photo${p.n === 1 ? "" : "s"} · photographed with ${friends.length} other${friends.length === 1 ? "" : "s"}</div>
        <div class="actions">
          <button class="gold" id="dlall">Download all ${p.n} photos (web size)</button>
          ${driveBtn()}
          <a href="map.html#${p.id}"><button>See on the people map</button></a>
          <a href="#/"><button>&larr; Back to everyone</button></a>
        </div>
      </div>
    </div>
    ${friends.length ? `<h2 class="section-title">Seen with <small>click to jump to their photos</small></h2>
      <div class="friends">${friends.map(f => `<a class="friend" href="#/p/${f.p.id}">${avatar(f.p)}
        <div class="nm">${esc(f.p.name)}</div><div class="ct">${f.c} together</div></a>`).join("")}</div>` : ""}
    <h2 class="section-title">${esc(p.name)}'s photos <small>click any photo to open it</small></h2>
    <div class="grid">${p.photos.map(shotTile).join("")}</div>`;
  $("#dlall").addEventListener("click", () => downloadAll(p));
}

function renderAll() {
  const all = D.photos.map((_, i) => i);
  $("#view").innerHTML = `
    <div class="profile"><div>
      <h2>Every film photo</h2>
      <div class="meta">${all.length} photos · ${D.photos.filter(p => p.p.length).length} with someone recognised</div>
      <div class="actions"><a href="#/"><button>&larr; Back to everyone</button></a></div>
    </div></div>
    <div class="grid">${all.map(shotTile).join("")}</div>`;
}

function route() {
  const h = location.hash.slice(1);
  const m = h.match(/^\/p\/(.+)$/);
  window.scrollTo(0, 0);
  const cur = m ? "" : h === "/all" ? "all" : "home";
  document.querySelectorAll("header nav [data-nav]").forEach(a => {
    a.querySelector("button").classList.toggle("on", a.dataset.nav === cur);
    if (a.dataset.nav === cur) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
  });
  if (m) renderPerson(decodeURIComponent(m[1]));
  else if (h === "/all") renderAll();
  else renderHome();
}

/* ---------- lightbox ---------- */

function openBox(list, pos) {
  lb = { list, pos };
  $("#box").classList.add("on");
  showBox();
}
function showBox() {
  const i = lb.list[lb.pos];
  $("#boximg").src = photoUrl(i);
  $("#bnames").innerHTML = D.photos[i].p.map(id =>
    `<a href="#/p/${id}" class="pill">${esc(byId[id] ? byId[id].name : id)}</a>`).join("") ||
    `<span class="pill">nobody tagged</span>`;
}
function stepBox(d) {
  if (!lb) return;
  lb.pos = (lb.pos + d + lb.list.length) % lb.list.length;
  showBox();
}
function closeBox() { lb = null; $("#box").classList.remove("on"); }

/* ---------- downloads ---------- */

function saveBlob(blob, name) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

async function downloadOne(i) {
  const name = `${D.photos[i].f}.jpg`;
  try {
    const r = await fetch(photoUrl(i));
    saveBlob(await r.blob(), name);
  } catch {
    window.open(photoUrl(i), "_blank");   // file:// pages can't fetch; just open it
  }
}

async function downloadAll(p) {
  const btn = $("#dlall");
  if (typeof JSZip === "undefined") { toast("Zip tool missing - open photos individually."); return; }
  btn.disabled = true;
  try {
    const zip = new JSZip();
    for (let k = 0; k < p.photos.length; k++) {
      btn.textContent = `Packing ${k + 1} of ${p.photos.length}…`;
      const i = p.photos[k];
      const r = await fetch(photoUrl(i));
      if (!r.ok) throw new Error("fetch failed");
      zip.file(`${D.photos[i].f}.jpg`, await r.blob());
    }
    btn.textContent = "Zipping…";
    const blob = await zip.generateAsync({ type: "blob" });   // JPEGs are already compressed
    saveBlob(blob, `${p.name.replace(/[^\w\- ]+/g, "")} - R&W wedding.zip`);
    toast(`Saved ${p.photos.length} photos.`);
  } catch (e) {
    toast("Couldn't build the zip here - try the online version, or save photos one by one.", 5000);
  } finally {
    btn.disabled = false;
    btn.textContent = `Download all ${p.n} photos (web size)`;
  }
}

/* ---------- wiring ---------- */

document.addEventListener("click", e => {
  const shot = e.target.closest(".shot");
  if (shot) {
    const tiles = [...shot.parentElement.querySelectorAll(".shot")].map(t => +t.dataset.i);
    openBox(tiles, tiles.indexOf(+shot.dataset.i));
    return;
  }
  if (e.target.closest("#bprev")) return stepBox(-1);
  if (e.target.closest("#bnext")) return stepBox(1);
  if (e.target.closest("#bclose")) return closeBox();
  if (e.target.closest("#bdl")) return downloadOne(lb.list[lb.pos]);
  if (e.target.id === "box" || e.target.classList.contains("stage")) closeBox();
  if (e.target.closest("#box .names a")) closeBox();
});

document.addEventListener("keydown", e => {
  if (!lb) return;
  if (e.key === "Escape") closeBox();
  else if (e.key === "ArrowLeft") stepBox(-1);
  else if (e.key === "ArrowRight") stepBox(1);
});

window.addEventListener("hashchange", route);

// data.js sets window.DATA - a plain script so the site also works from a downloaded
// folder, where browsers refuse to fetch() local files.
if (window.DATA) {
  D = window.DATA;
  D.people.forEach(p => byId[p.id] = p);
  $("#bdrive").href = D.drive;
  $("#footstats").innerHTML =
    `${D.people.length} people · ${D.photos.length} photos · ` +
    `<a href="${D.drive}" target="_blank" rel="noopener">full-quality originals on Google Drive</a>`;
  route();
} else {
  $("#view").innerHTML = `<div class="empty">Couldn't load the photo list (data.js is missing).</div>`;
}
