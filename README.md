# THE LIST

Een statische website in de stijl van "THE LIST" met dagelijks ververste **Top 5 Music** en **Top 5 Movies**.

## Hoe het werkt

- **`index.html`** – statische pagina, laadt `data.json` en rendert de twee kaarten.
- **`data.json`** – wordt elke dag automatisch ververst door een GitHub Action.
- **`scripts/fetch.mjs`** – haalt data op uit:
  - Music: [Apple Marketing Tools RSS](https://rss.marketingtools.apple.com/) (geen key nodig)
  - Movies: [TMDB API](https://www.themoviedb.org/) (gratis API key nodig)
- **`.github/workflows/refresh.yml`** – cron-job (08:00 UTC dagelijks), pusht een nieuwe `data.json` naar de repo.

## Eenmalige setup

### 1. Repo aanmaken en pushen

```bash
cd "the-list"
git init
git add .
git commit -m "initial commit"
git branch -M main
git remote add origin https://github.com/<jouw-username>/the-list.git
git push -u origin main
```

### 2. GitHub Pages activeren

1. **Settings** → **Pages**
2. Source: **Deploy from a branch**
3. Branch: `main` / `/ (root)` → **Save**
4. Na 1 minuut staat de site live op `https://<jouw-username>.github.io/the-list/`

### 3. Eerste handmatige refresh testen

1. **Actions** tab → **Refresh data** → **Run workflow** → **Run workflow**
2. Wacht ~30s; bij succes is `data.json` bijgewerkt en zie je een nieuwe commit van `thelist-bot`

## Aanpassingen

- **Tijdstip refresh**: pas de cron in `.github/workflows/refresh.yml` aan (UTC). `0 8 * * *` = 08:00 UTC.
- **Aantal items**: in `scripts/fetch.mjs` staat `.slice(0, 5)` — verhogen kan, maar pas dan ook de CSS-grid in `index.html` aan (`repeat(5, 1fr)`).
- **Regio movies**: `&region=US` in de TMDB-URL → `&region=NL` voor Nederlandse box-office sortering.
- **Regio music**: in de Apple-URL `/us/` → `/nl/` voor Nederlandse charts.

## Lokaal testen

Open `index.html` direct in een browser werkt **niet** door CORS — de fetch van `data.json` faalt op `file://`. Gebruik:

```bash
# Python
python -m http.server 8000

# of Node
npx serve .
```

En open `http://localhost:8000`.

## TMDB key

De TMDB v3 key staat hardcoded in `scripts/fetch.mjs`. Wil je 'm wisselen, pas die regel aan en commit. Bij verdacht gebruik kun je de key altijd regenereren op TMDB → Settings → API.
