# QuinnDom

A solarpunk city-builder powered by daily puzzles, passport stamps and 52 world-map bosses. No server — runs entirely in the browser, each player keeps their own save.

Design docs live in the QuinnDom Claude project (GDD, PRD, colour palette, stamp atlas). This repo is the game itself.

## Structure

```
index.html            Release 1: daily passport prompt (playable today)
css/tokens.css         Palette v4, fonts, base styles
data/countries.js      194-country data table (population, area, flags, history…)
js/passport-engine.js  Deterministic daily prompt generator + answer checker
assets/                (empty — art and sound go here)
```

## Running locally

Any static file server works, e.g. `python3 -m http.server` from this folder, then open `http://localhost:8000`.

## Status

Release 1 (daily core) is in progress — the passport prompt is playable with a streak counter saved to `localStorage`. See the Build Itinerary doc for the full release plan.
