import { writeFileSync, readFileSync, existsSync } from 'node:fs';

const TMDB_KEY = 'dd4127a72eb02e8b19384eafee676ea5';

const DEEZER_CHART = 'https://api.deezer.com/chart/0/tracks?limit=5';
const BOM_URL = 'https://www.boxofficemojo.com/weekend/chart/';
const TMDB_SEARCH = (q, year) => `https://api.themoviedb.org/3/search/movie?api_key=${TMDB_KEY}&query=${encodeURIComponent(q)}&year=${year}`;
const TMDB_DETAIL = (id) => `https://api.themoviedb.org/3/movie/${id}?api_key=${TMDB_KEY}&language=en-US`;
const POSTER = (path) => `https://image.tmdb.org/t/p/w500${path}`;
const UA_HEADERS = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' };

async function getJson(url) {
  const r = await fetch(url, { headers: UA_HEADERS });
  if (!r.ok) throw new Error(`${url} -> HTTP ${r.status}`);
  return r.json();
}

async function getText(url) {
  const r = await fetch(url, { headers: UA_HEADERS });
  if (!r.ok) throw new Error(`${url} -> HTTP ${r.status}`);
  return r.text();
}

const fmtDate = (d) =>
  d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

function decodeHtml(s) {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ');
}

let prev = { music: { items: [] }, movies: { items: [] } };
if (existsSync('data.json')) {
  try { prev = JSON.parse(readFileSync('data.json', 'utf8')); } catch {}
}
const findPrevRank = (list, id) => {
  const found = list?.find(it => String(it.id) === String(id));
  return found ? found.rank : null;
};

async function fetchMusic() {
  const chart = await getJson(DEEZER_CHART);
  return chart.data.slice(0, 5).map((t, i) => ({
    rank: i + 1,
    id: t.id,
    title: t.title,
    subtitle: t.artist?.name || '',
    lastWeek: findPrevRank(prev.music?.items, t.id),
    artwork: t.album?.cover_xl || t.album?.cover_big || '',
  }));
}

async function fetchMovies() {
  // 1. Scrape Box Office Mojo weekend chart
  const html = await getText(BOM_URL);
  const tableMatch = html.match(/<table[^>]*class="[^"]*mojo-body-table[^"]*"[^>]*>([\s\S]*?)<\/table>/);
  if (!tableMatch) throw new Error('BOM: table not found');

  const rowMatches = [...tableMatch[1].matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)];
  const bomRows = rowMatches.map(rm => {
    return [...rm[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)]
      .map(cm => decodeHtml(cm[1].replace(/<[^>]+>/g, '').trim()));
  }).filter(c => c.length >= 4 && /^\d+$/.test(c[0]));

  const top5 = bomRows.slice(0, 5).map(c => ({
    rank: parseInt(c[0]),
    lastWeek: c[1] === '-' ? null : (/^\d+$/.test(c[1]) ? parseInt(c[1]) : null),
    title: c[2],
    weekendGross: c[3],
  }));

  // 2. For each, search TMDB to get poster + studio
  const year = new Date().getFullYear();
  const enriched = await Promise.all(top5.map(async (m) => {
    let poster = '';
    let studio = '';
    try {
      const search = await getJson(TMDB_SEARCH(m.title, year));
      const hit = search.results?.[0] || (await getJson(TMDB_SEARCH(m.title, year - 1))).results?.[0];
      if (hit) {
        if (hit.poster_path) poster = POSTER(hit.poster_path);
        try {
          const detail = await getJson(TMDB_DETAIL(hit.id));
          studio = detail.production_companies?.[0]?.name || '';
        } catch {}
      }
    } catch {}
    return {
      rank: m.rank,
      id: m.title,                                  // BOM doesn't expose stable IDs
      title: m.title,
      weekendGross: `Weekend Gross: ${m.weekendGross}`,
      studio: studio || 'Studio unknown',
      lastWeek: m.lastWeek,
      artwork: poster,
    };
  }));

  return enriched;
}

const [musicItems, movieItems] = await Promise.all([fetchMusic(), fetchMovies()]);

const today = new Date();
const data = {
  updated: today.toISOString(),
  music:  { weekLabel: fmtDate(today), items: musicItems },
  movies: { weekLabel: fmtDate(today), items: movieItems },
};

writeFileSync('data.json', JSON.stringify(data, null, 2));
console.log(`Wrote data.json (${musicItems.length} songs, ${movieItems.length} movies)`);
