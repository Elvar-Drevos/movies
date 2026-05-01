import { writeFileSync, readFileSync, existsSync } from 'node:fs';

const TMDB_KEY = 'dd4127a72eb02e8b19384eafee676ea5';

const APPLE_MUSIC = 'https://rss.marketingtools.apple.com/api/v2/us/music/most-played/10/songs.json';
const TMDB_NOW = `https://api.themoviedb.org/3/movie/now_playing?api_key=${TMDB_KEY}&language=en-US&page=1&region=US`;
const TMDB_DETAIL = (id) => `https://api.themoviedb.org/3/movie/${id}?api_key=${TMDB_KEY}&language=en-US`;
const POSTER = (path) => `https://image.tmdb.org/t/p/w500${path}`;

async function getJson(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url} -> HTTP ${r.status}`);
  return r.json();
}

const fmtDate = (d) =>
  d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

let prev = { music: { items: [] }, movies: { items: [] } };
if (existsSync('data.json')) {
  try { prev = JSON.parse(readFileSync('data.json', 'utf8')); } catch {}
}
const findPrevRank = (list, id) => {
  const found = list?.find(it => String(it.id) === String(id));
  return found ? found.rank : null;
};

const music = await getJson(APPLE_MUSIC);
const musicItems = music.feed.results.slice(0, 5).map((s, i) => ({
  rank: i + 1,
  id: s.id,
  title: s.name,
  subtitle: s.artistName,
  lastWeek: findPrevRank(prev.music?.items, s.id),
  artwork: s.artworkUrl100.replace('100x100bb', '500x500bb'),
}));

const nowPlaying = await getJson(TMDB_NOW);
const top5 = nowPlaying.results.slice(0, 5);
const details = await Promise.all(top5.map(m => getJson(TMDB_DETAIL(m.id))));
const movieItems = top5.map((m, i) => {
  const d = details[i];
  const studio = d.production_companies?.[0]?.name || '';
  const release = m.release_date
    ? `Released ${fmtDate(new Date(m.release_date))}`
    : '';
  return {
    rank: i + 1,
    id: m.id,
    title: m.title,
    subtitle: studio,
    extra: release,
    lastWeek: findPrevRank(prev.movies?.items, m.id),
    artwork: m.poster_path ? POSTER(m.poster_path) : '',
  };
});

const today = new Date();
const data = {
  updated: today.toISOString(),
  music:  { weekLabel: fmtDate(today), items: musicItems },
  movies: { weekLabel: fmtDate(today), items: movieItems },
};

writeFileSync('data.json', JSON.stringify(data, null, 2));
console.log(`Wrote data.json (${musicItems.length} songs, ${movieItems.length} movies)`);
