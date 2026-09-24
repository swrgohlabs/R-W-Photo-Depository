/* Forgiving name search, shared by the photo pages and the people map.
   findPeople(people, query) -> { exact, close }
     exact: names containing what was typed (ignoring case, accents, spaces), or whose initials start with it
     close: names that are a typo or two away, best first - the "did you mean" list */
(function () {
  const norm = s => String(s).normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const squash = s => norm(s).replace(/[^a-z0-9]/g, "");

  // edit distance where swapping two neighbouring letters counts as one mistake
  function typos(a, b) {
    const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
    for (let j = 1; j <= b.length; j++) d[0][j] = j;
    for (let i = 1; i <= a.length; i++) {
      for (let j = 1; j <= b.length; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
        if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1])
          d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
    return d[a.length][b.length];
  }

  // how far the query is from the start of this word (so half-typed names still match)
  function prefixTypos(q, word) {
    let best = Infinity;
    for (let k = Math.max(1, q.length - 1); k <= Math.min(word.length, q.length + 1); k++)
      best = Math.min(best, typos(q, word.slice(0, k)));
    return best;
  }

  const allowed = n => n < 3 ? 0 : n < 5 ? 1 : n < 8 ? 2 : 3;

  window.findPeople = function (people, query) {
    const q = squash(query);
    if (!q) return { exact: people, close: [] };
    const exact = [], close = [];
    for (const p of people) {
      const words = norm(p.name).split(/[^a-z0-9]+/).filter(Boolean);
      const whole = words.join(""), initials = words.map(w => w[0]).join("");
      if (whole.includes(q) || (q.length >= 2 && words.length > 1 && initials.startsWith(q))) { exact.push(p); continue; }
      const d = Math.min(prefixTypos(q, whole), ...words.map(w => prefixTypos(q, w)));
      if (d <= allowed(q.length)) close.push({ p, d });
    }
    close.sort((a, b) => a.d - b.d || b.p.n - a.p.n);
    // with real matches on screen, only suggest names one letter off (Jolyn -> Joelynn), not loose ones
    const keep = exact.length ? close.filter(c => c.d <= 1 && q.length >= 5) : close;
    return { exact, close: keep.slice(0, 8).map(c => c.p) };
  };
})();
