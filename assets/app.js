/* ==========================================================================
   The Ananya Subramanian Show — site script
   --------------------------------------------------------------------------
   SETTINGS: everything you are likely to change lives in this block.
   ========================================================================== */

// Your podcast RSS feed (Spotify for Creators / Anchor). The page first tries
// /feed (the Cloudflare Pages Function), then this URL, then sample episodes.
const FEED_URL = 'https://anchor.fm/s/1060d0c44/podcast/rss';

// INTERVIEWS ONLY ----------------------------------------------------------
// 1) Hide any episode whose TITLE has a word starting with one of these
//    (case-insensitive). 'analy' catches analysis, analyst, analytics, etc.
const EXCLUDE_WORDS = ['analy'];

// 2) Hide any episode shorter than this many minutes. The old match-analysis
//    episodes in the feed run 2–7 minutes; every interview runs 11+.
//    Set to 0 to switch this rule off.
const MIN_MINUTES = 10;

// 3) Hide specific episodes by exact title (quotes/case don't matter) or by
//    the feed's own episode number (itunes:episode), e.g. 12.
const HIDE_EPISODES = [
  'Bay Area Women’s Open Final & Third-Place Match: Results, Standout Performances & Takeaways with Amal',
  'Bay Area Women’s Open Day 1 & 2: Results, Performances & What Stood Out',
  'MLC Preview with Amal: Teams, Storylines & What’s Ahead',
  "Women's T20 World Cup 2026 Preview: India's Chances, Key Players & Predictions with Dishaa",
];

// 4) Always show these episodes (exact titles), even if a rule above hides them.
//    Useful for an interview whose title happens to contain "analytics".
const SHOW_EPISODES = [
  // 'From IPL Analytics to Building American Cricket | Unni Krishnan',
];

// Number the remaining interviews 1, 2, 3… (oldest = 1) with no gaps.
const RENUMBER = true;

// Your links. Empty ones are TODO: until filled in, Spotify / Apple / YouTube
// point to a search for the show, and Instagram is hidden.
const LINKS = {
  linkedin: 'https://www.linkedin.com/in/ananya-subramanian-3b38621aa/',
  youtube: '',   // TODO: e.g. 'https://www.youtube.com/@yourchannel'
  instagram: '', // TODO: e.g. 'https://www.instagram.com/yourhandle/'
  spotify: '',   // TODO: e.g. 'https://open.spotify.com/show/XXXXXXXX'
  apple: '',     // TODO: e.g. 'https://podcasts.apple.com/us/podcast/…/idXXXXXXXX'
};

const PAGE_SIZE = 9;       // "All episodes" load-more step
const FILMSTRIP_COUNT = 8; // how many latest interviews fill the filmstrip

/* ========================================================================== */

(() => {
  'use strict';

  const ITUNES = 'http://www.itunes.com/dtds/podcast-1.0.dtd';
  const CONTENT = 'http://purl.org/rss/1.0/modules/content/';
  const LOGO = 'assets/logo.png';
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const SPORTS = [
    ['Cricket', /\b(cricket\w*|ipl|bbl|the hundred|mlc|milc|wpl|t20\w*|odi|test match)\b/i],
    ['Football', /\b(football|soccer|premier league|nwsl|mls)\b/i],
    ['Basketball', /\b(basketball|nba|wnba)\b/i],
    ['Tennis', /\btennis\b/i],
    ['Baseball', /\b(baseball|mlb)\b/i],
    ['Athletics', /\b(track|athletics|marathon|olympic\w*)\b/i],
  ];
  const OTHER = 'Other';

  /* ---------- helpers ---------- */
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const norm = (s) => String(s ?? '').replace(/[’‘`]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, ' ').trim().toLowerCase();
  const pad = (n, l = 2) => String(n).padStart(l, '0');
  const htmlToText = (html) => {
    if (!html) return '';
    const text = new DOMParser().parseFromString(html, 'text/html').body.textContent || '';
    return text
      .replace(/https?:\/\/\S+|www\.\S+/gi, '')
      .replace(/\s+([.,;:!?])/g, '$1')
      .replace(/\s+/g, ' ')
      .trim();
  };
  const fmtTime = (s) => {
    if (!isFinite(s) || s < 0) s = 0;
    s = Math.floor(s);
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    return h ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
  };
  const durationToSeconds = (d) => {
    if (!d) return 0;
    d = d.trim();
    if (/^\d+$/.test(d)) return +d;
    return d.split(':').map(Number).reduce((acc, n) => acc * 60 + (n || 0), 0);
  };
  const child = (el, local, ns) => Array.from(el.children).find((n) => n.localName === local && (!ns || n.namespaceURI === ns));
  const text = (el, local, ns) => { const n = el && child(el, local, ns); return n ? n.textContent.trim() : ''; };

  /* ---------- guest name from the title ---------- */
  const NAME_WORD = "[A-Z][\\p{L}.'’\\-]*";
  const NAME = `${NAME_WORD}(?:\\s(?:van|de|da|von|der|del)\\s${NAME_WORD}|\\s${NAME_WORD}){0,2}`;
  const STOP = new Set(['usa', 'us', 'ipl', 'mlc', 'cricket', 'world', 'team', 'the', 'american', 'college', 'journey', 'cup',
    'from', 'building', 'beyond', 'inside', 'leading', "women's", 'breaking', 'making', 'understanding', 'talking', 'reading',
    'how', 'why', 'what', 'when', 'where', 'who', 'women', 'men', 'across', 'more', 'six', 'sixes', 'over', 'india', "india's", 'test', 'league', 'academy', 'show', 'podcast', 'episode']);
  const isName = (s) => {
    const words = s.trim().split(/\s+/);
    if (words.length < 2 || words.length > 4 || s.length > 32) return false;
    return words.every((w) => /^(van|de|da|von|der|del)$/.test(w) || (new RegExp(`^${NAME_WORD}$`, 'u').test(w) && !STOP.has(norm(w))));
  };
  const PREFIX = /^(?:(?:USA|US|India|Team)\s+)?(?:U-?19\s+)?(?:Star|Captain|Bowler|Batter|Coach|Owner|Founder)\s+/;
  function guestFromTitle(title) {
    const t = title.replace(/\s+/g, ' ').trim();
    let m;
    if ((m = t.match(/\b(?:ft\.?|feat\.?|featuring)\s+([^|:–—]+)$/i))) return m[1].trim();
    if ((m = t.match(new RegExp(`\\bwith\\s+(${NAME})\\s*(?:\\([^)]*\\))?$`, 'u')))) return m[1];
    const parts = t.split(/\s*(?:\||:|—|–)\s*/);
    for (const p of parts) {
      const seg = p.replace(PREFIX, '');
      if ((m = seg.match(new RegExp(`^(${NAME})\\s+on\\b`, 'u'))) && !STOP.has(norm(m[1].split(' ')[0]))) return m[1];
    }
    if ((m = t.match(new RegExp(`(${NAME})[’']s\\s+(?:Journey|Untold|Full|Incredible|Cricket|Breakout|Story|Road|Path|Rise|\\d)`, 'u')))) {
      const words = m[1].split(' ');
      while (words.length && STOP.has(norm(words[0]))) words.shift();
      const full = words.join(' ');
      if (/^Coach\s\S/.test(full)) return full;
      const name = full.replace(PREFIX, '');
      if (isName(name)) return name;
    }
    for (const p of parts) if (isName(p.replace(PREFIX, ''))) return p.replace(PREFIX, '');
    return '';
  }

  function sportOf(title, desc) {
    for (const [name, re] of SPORTS) if (re.test(title)) return name;
    for (const [name, re] of SPORTS) if (re.test(desc)) return name;
    return OTHER;
  }

  function blurbOf(desc) {
    if (!desc) return '';
    const sentences = desc.match(/[^.!?]+[.!?]+/g) || [desc];
    let out = '';
    for (const s of sentences) {
      if ((out + s).length > 240 && out) break;
      out += s;
    }
    return out.trim().slice(0, 260);
  }

  /* ---------- feed parsing ---------- */
  function parseFeed(xml) {
    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    if (doc.querySelector('parsererror')) throw new Error('Feed is not valid XML');
    const channel = doc.querySelector('channel');
    if (!channel) throw new Error('No channel in feed');
    const chImgEl = child(channel, 'image', ITUNES);
    const chImg = (chImgEl && chImgEl.getAttribute('href')) || text(child(channel, 'image') || null, 'url') || LOGO;

    return Array.from(channel.getElementsByTagName('item')).map((item, i) => {
      const title = text(item, 'title').replace(/\s+/g, ' ').trim();
      const rawHtml = text(item, 'encoded', CONTENT) || text(item, 'description') || text(item, 'summary', ITUNES);
      const desc = htmlToText(rawHtml);
      const enclosure = child(item, 'enclosure');
      const imgEl = child(item, 'image', ITUNES);
      const yt = (rawHtml.match(/https?:\/\/(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?v=|live\/|shorts\/|embed\/)|youtu\.be\/)[\w\-?=&;.%]+/i) || [])[0];
      const seconds = durationToSeconds(text(item, 'duration', ITUNES));
      const epNum = parseInt(text(item, 'episode', ITUNES), 10);
      const pub = new Date(text(item, 'pubDate'));
      return {
        id: 'ep' + i,
        title,
        guest: guestFromTitle(title),
        blurb: blurbOf(desc),
        searchText: norm(title + ' ' + desc),
        audio: enclosure ? enclosure.getAttribute('url') : '',
        image: (imgEl && imgEl.getAttribute('href')) || chImg || LOGO,
        feedNum: isNaN(epNum) ? null : epNum,
        seconds,
        minutes: seconds ? Math.round(seconds / 60) : null,
        date: isNaN(pub) ? null : pub,
        link: text(item, 'link'),
        youtube: yt ? yt.replace(/&amp;/g, '&') : '',
        sport: sportOf(title, desc),
      };
    });
  }

  /* ---------- interviews-only filter (runs before anything renders) ---------- */
  function interviewsOnly(episodes) {
    const wordRes = EXCLUDE_WORDS.filter(Boolean).map((w) => new RegExp(`(^|[^\\p{L}\\p{N}])${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'iu'));
    const hideTitles = new Set(HIDE_EPISODES.filter((h) => typeof h === 'string').map(norm));
    const hideNums = new Set(HIDE_EPISODES.filter((h) => typeof h === 'number' || /^\d+$/.test(h)).map(Number));
    const showTitles = new Set(SHOW_EPISODES.map(norm));

    const kept = episodes.filter((ep) => {
      if (showTitles.has(norm(ep.title))) return true;
      if (wordRes.some((re) => re.test(ep.title))) return false;
      if (hideTitles.has(norm(ep.title))) return false;
      if (ep.feedNum != null && hideNums.has(ep.feedNum)) return false;
      if (MIN_MINUTES > 0 && ep.minutes != null && ep.minutes < MIN_MINUTES) return false;
      return true;
    });

    kept.sort((a, b) => (b.date || 0) - (a.date || 0));
    kept.forEach((ep, i) => { ep.num = RENUMBER ? kept.length - i : ep.feedNum; });
    return kept;
  }

  /* ---------- sample episodes (offline preview only) ---------- */
  const SAMPLE = [
    ['Sample: From the academy nets to the national team', 'Cricket', 41],
    ['Sample: Building a club from the ground up', 'Football', 38],
    ['Sample: Life on the WNBA bench', 'Basketball', 44],
    ['Sample: The long road through the qualifying rounds', 'Tennis', 39],
    ['Sample: Ninety miles an hour and a second chance', 'Baseball', 42],
    ['Sample: What the marathon teaches you', 'Athletics', 37],
    ['Sample: Captaincy at twenty-one', 'Cricket', 40],
    ['Sample: Telling sport stories online', 'Football', 36],
  ].map(([title, sport, minutes], i) => ({
    id: 'sample' + i, title, guest: 'Sample Guest', sport, minutes, seconds: minutes * 60,
    blurb: 'Sample episode shown because the live feed could not be reached. Real interviews load automatically from the RSS feed.',
    searchText: norm(title + ' ' + sport), audio: '', image: LOGO, feedNum: null, link: '', youtube: '',
    date: new Date(Date.now() - i * 864e6),
  }));

  async function loadEpisodes() {
    const sources = [];
    if (/^https?:$/.test(location.protocol)) sources.push('/feed');
    sources.push(FEED_URL);
    for (const src of sources) {
      try {
        const res = await fetch(src, { cache: 'no-cache' });
        if (!res.ok) continue;
        const all = parseFeed(await res.text());
        if (!all.length) continue;
        return { episodes: interviewsOnly(all), sample: false };
      } catch (err) { /* try the next source */ }
    }
    return { episodes: interviewsOnly(SAMPLE), sample: true };
  }

  /* ---------- rendering ---------- */
  const sportLabel = (s) => (s === OTHER ? 'Interview' : s);
  const playIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.5v15l13-7.5z" fill="currentColor"/></svg>';

  function card(ep, featured = false) {
    const ep_ = ep.num != null ? `EP. ${ep.num} · ` : '';
    const title = ep.link
      ? `<a href="${esc(ep.link)}" target="_blank" rel="noopener">${esc(ep.title)}</a>`
      : `<a href="#episodes" data-play="${ep.id}">${esc(ep.title)}</a>`;
    const playBtn = ep.audio
      ? `<button class="play" type="button" data-play="${ep.id}" aria-label="Play episode${ep.num != null ? ' ' + ep.num : ''}: ${esc(ep.title)}">${playIcon}</button>`
      : '';
    const meta = `<div class="card__meta"><span><b>${ep_}${esc(sportLabel(ep.sport))}</b></span><span>${ep.minutes ? `${ep.minutes} min` : ''}</span></div>`;
    const yt = ep.youtube ? `<a class="card__yt" href="${esc(ep.youtube)}" target="_blank" rel="noopener">Watch on YouTube ↗</a>` : '';
    return `
      <article class="card${featured ? ' card--featured' : ''} reveal">
        <div class="card__media frame">
          <img src="${esc(ep.image)}" alt="Episode artwork: ${esc(ep.title)}" loading="lazy" decoding="async" width="600" height="600">
          ${playBtn}
        </div>
        <div class="card__body">
          ${featured ? '<span class="card__tag">Newest interview</span>' : ''}
          ${meta}
          <h3 class="card__title">${title}</h3>
          <p class="card__guest">${ep.guest ? 'with ' + esc(ep.guest) : ''}</p>
          <p class="card__blurb">${esc(ep.blurb)}</p>
          ${yt}
        </div>
      </article>`;
  }

  function renderFilmstrip(eps) {
    const track = $('#filmstrip');
    const latest = eps.slice(0, FILMSTRIP_COUNT);
    const frames = (aria) => latest.map((ep, i) => `
      <div class="film-frame frame"${aria ? ' aria-hidden="true"' : ''}>
        <img src="${esc(ep.image)}" alt="${aria ? '' : 'Artwork: ' + esc(ep.title)}" loading="lazy" decoding="async" width="300" height="400">
        <span class="film-frame__num">${pad(i + 1)}</span>
        <span class="film-frame__sport">${esc(sportLabel(ep.sport))}</span>
      </div>`).join('');
    track.innerHTML = latest.length ? frames(false) + frames(true) : '';
  }

  function renderPlaceholders() {
    const blank = Array.from({ length: 8 }, (_, i) => `
      <div class="film-frame frame film-frame--empty" aria-hidden="true"><span class="film-frame__num">${pad((i % 8) + 1)}</span></div>`).join('');
    $('#filmstrip').innerHTML = blank + blank;
  }

  const state = { all: [], filter: 'All', query: '', shown: PAGE_SIZE };

  function renderAll() {
    const q = norm(state.query);
    const list = state.all.filter((ep) =>
      (state.filter === 'All' || ep.sport === state.filter) && (!q || ep.searchText.includes(q) || norm(ep.guest).includes(q)));
    const grid = $('#all-grid');
    grid.innerHTML = list.length
      ? list.slice(0, state.shown).map((ep) => card(ep)).join('')
      : '<p class="empty">No interviews match that yet. Try another sport or search.</p>';
    $('#all-count').textContent = list.length
      ? `Showing ${Math.min(state.shown, list.length)} of ${list.length} interview${list.length === 1 ? '' : 's'}`
      : '';
    $('#load-more').hidden = state.shown >= list.length;
    observe(grid);
  }

  function renderFilters() {
    const present = new Set(state.all.map((e) => e.sport));
    const order = [...SPORTS.map(([n]) => n), OTHER].filter((s) => present.has(s));
    const pills = ['All', ...order];
    $('#filters').innerHTML = pills.map((s) =>
      `<button class="filter" type="button" data-sport="${esc(s)}" aria-pressed="${s === state.filter}">${esc(s === OTHER ? 'Other' : s)}</button>`).join('');
  }

  function render(eps, isSample) {
    state.all = eps;
    const status = $('#feed-status');
    status.textContent = isSample ? 'Showing sample episodes: the live feed could not be reached.' : '';
    if (!eps.length) {
      $('#featured').innerHTML = '<p class="empty">New interviews are on the way.</p>';
      $('#filmstrip').innerHTML = '';
      return;
    }
    $('#featured').innerHTML = card(eps[0], true);
    $('#next-grid').innerHTML = eps.slice(1, 4).map((ep) => card(ep)).join('');
    renderFilmstrip(eps);
    renderFilters();
    renderAll();
    observe($('#episodes'));
  }

  /* ---------- audio player ---------- */
  const player = $('#player');
  const audio = $('#audio');
  const seek = $('#player-seek');
  let seeking = false;

  function openPlayer(ep) {
    if (!ep || !ep.audio) { $('#episodes').scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' }); return; }
    if (audio.dataset.id !== ep.id) {
      audio.src = ep.audio;
      audio.dataset.id = ep.id;
      $('#player-title').textContent = (ep.num != null ? `Ep. ${ep.num} · ` : '') + ep.title;
      $('#player-art').src = ep.image;
      seek.value = 0;
      $('#player-time').textContent = `0:00 / ${fmtTime(ep.seconds)}`;
    }
    player.hidden = false;
    document.body.classList.add('player-open');
    void player.offsetWidth; // commit the hidden position so the slide-up transition runs
    player.classList.add('open');
    audio.play().catch(() => {});
  }
  function closePlayer() {
    audio.pause();
    player.classList.remove('open');
    document.body.classList.remove('player-open');
    setTimeout(() => { if (!player.classList.contains('open')) player.hidden = true; }, reduceMotion ? 0 : 700);
  }
  audio.addEventListener('play', () => { player.classList.add('playing'); $('#player-toggle').setAttribute('aria-label', 'Pause'); });
  audio.addEventListener('pause', () => { player.classList.remove('playing'); $('#player-toggle').setAttribute('aria-label', 'Play'); });
  audio.addEventListener('timeupdate', () => {
    if (!seeking && audio.duration) seek.value = (audio.currentTime / audio.duration) * 100;
    $('#player-time').textContent = `${fmtTime(audio.currentTime)} / ${fmtTime(audio.duration)}`;
  });
  seek.addEventListener('input', () => { seeking = true; if (audio.duration) $('#player-time').textContent = `${fmtTime((seek.value / 100) * audio.duration)} / ${fmtTime(audio.duration)}`; });
  seek.addEventListener('change', () => { if (audio.duration) audio.currentTime = (seek.value / 100) * audio.duration; seeking = false; });
  $('#player-toggle').addEventListener('click', () => (audio.paused ? audio.play().catch(() => {}) : audio.pause()));
  $('#player-close').addEventListener('click', closePlayer);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !player.hidden) closePlayer(); });

  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-play]');
    if (!t) return;
    e.preventDefault();
    openPlayer(state.all.find((ep) => ep.id === t.dataset.play));
  });
  $('#watch-latest').addEventListener('click', () => openPlayer(state.all[0]));

  /* ---------- filters, search, load more ---------- */
  $('#filters').addEventListener('click', (e) => {
    const b = e.target.closest('[data-sport]');
    if (!b) return;
    state.filter = b.dataset.sport;
    state.shown = PAGE_SIZE;
    $$('.filter').forEach((f) => f.setAttribute('aria-pressed', String(f === b)));
    renderAll();
  });
  let searchTimer;
  $('#search').addEventListener('input', (e) => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => { state.query = e.target.value; state.shown = PAGE_SIZE; renderAll(); }, 150);
  });
  $('#load-more').addEventListener('click', () => { state.shown += PAGE_SIZE; renderAll(); });

  /* ---------- links ---------- */
  const showQ = encodeURIComponent('The Ananya Subramanian Show');
  const linkFor = {
    linkedin: LINKS.linkedin,
    youtube: LINKS.youtube || `https://www.youtube.com/results?search_query=${showQ}`,
    spotify: LINKS.spotify || `https://open.spotify.com/search/${showQ}/podcasts`,
    apple: LINKS.apple || `https://podcasts.apple.com/us/search?term=${showQ}`,
    instagram: LINKS.instagram,
    rss: FEED_URL,
  };
  $$('[data-link]').forEach((a) => {
    const href = linkFor[a.dataset.link];
    if (href) a.href = href; else a.remove();
  });
  $('#year').textContent = new Date().getFullYear();

  /* ---------- HUD: timecode, clock, scramble ---------- */
  const t0 = performance.now();
  const tc = $('#timecode');
  const tickTimecode = () => {
    const ms = performance.now() - t0;
    const s = Math.floor(ms / 1000);
    tc.textContent = `${pad(Math.floor(s / 3600))}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}:${pad(Math.floor((ms % 1000) / (1000 / 24)))}`;
  };
  setInterval(tickTimecode, reduceMotion ? 1000 : 1000 / 24);
  tickTimecode();

  const clockFmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Chicago', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
  const clock = $('#clock');
  const tickClock = () => { clock.textContent = clockFmt.format(new Date()); };
  setInterval(tickClock, 1000);
  tickClock();

  (function scramble() {
    const el = $('#scramble');
    const final = el.textContent;
    if (reduceMotion) return;
    const glyphs = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#/*';
    const start = performance.now();
    const total = 1500;
    const frame = (now) => {
      const p = Math.min(1, (now - start) / total);
      const resolved = Math.floor(p * final.length);
      el.textContent = final.split('').map((c, i) =>
        (c === ' ' || i < resolved) ? c : glyphs[Math.floor(Math.random() * glyphs.length)]).join('');
      if (p < 1) requestAnimationFrame(frame); else el.textContent = final;
    };
    requestAnimationFrame(frame);
  })();

  /* ---------- hero headline: split into masked letters ---------- */
  const heroTitle = $('.hero__title');
  if (!reduceMotion) {
    let i = 0;
    const splitNode = (node) => {
      Array.from(node.childNodes).forEach((n) => {
        if (n.nodeType === Node.TEXT_NODE) {
          const frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach((word) => {
            if (!word) return;
            if (/^\s+$/.test(word)) { frag.appendChild(document.createTextNode(' ')); return; }
            const w = document.createElement('span');
            w.className = 'word';
            for (const ch of word) {
              const outer = document.createElement('span');
              outer.className = 'char';
              const inner = document.createElement('span');
              inner.textContent = ch;
              inner.style.setProperty('--i', i++);
              outer.appendChild(inner);
              w.appendChild(outer);
            }
            frag.appendChild(w);
          });
          n.replaceWith(frag);
        } else if (n.nodeType === Node.ELEMENT_NODE) {
          splitNode(n);
        }
      });
    };
    $$('[data-split]', heroTitle).forEach((line) => { line.setAttribute('aria-hidden', 'true'); splitNode(line); });
  }

  /* ---------- statement: words blur in one by one ---------- */
  const statement = $('#statement');
  if (!reduceMotion) {
    let wi = 0;
    const wrapWords = (node) => {
      Array.from(node.childNodes).forEach((n) => {
        if (n.nodeType === Node.TEXT_NODE) {
          const frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach((part) => {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
            const s = document.createElement('span');
            s.className = 'w';
            s.textContent = part;
            s.style.setProperty('--i', wi++);
            frag.appendChild(s);
          });
          n.replaceWith(frag);
        } else if (n.nodeType === Node.ELEMENT_NODE) wrapWords(n);
      });
    };
    wrapWords(statement);
  }

  /* ---------- rotating word ---------- */
  (function rotator() {
    const list = $('#rotator');
    if (reduceMotion) return;
    const items = list.children.length;
    list.appendChild(list.children[0].cloneNode(true));
    let idx = 0;
    setInterval(() => {
      idx++;
      list.style.transition = '';
      list.style.transform = `translateY(${-idx * 1.15}em)`;
      if (idx === items) {
        setTimeout(() => {
          list.style.transition = 'none';
          list.style.transform = 'translateY(0)';
          idx = 0;
        }, 850);
      }
    }, 2400);
  })();

  /* ---------- scroll reveals ---------- */
  const io = !reduceMotion && 'IntersectionObserver' in window
    ? new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' })
    : null;
  function observe(root = document) {
    const targets = $$('.reveal:not(.in), .hero__title:not(.in), .statement__text:not(.in)', root);
    if (root !== document && root.matches && root.matches('.reveal:not(.in)')) targets.push(root);
    targets.forEach((el) => (io ? io.observe(el) : el.classList.add('in')));
  }
  observe();

  /* ---------- go ---------- */
  renderPlaceholders();
  loadEpisodes().then(({ episodes, sample }) => render(episodes, sample));
})();
