# Vice Cover — GTA-style cover art studio

[![Make GTA 6 Cover Art](https://make.fun/badge/gta6-cover-art-01.svg)](https://make.fun/bounty/gta6-cover-art-01)
[![Rank](https://make.fun/badge/gta6-cover-art-01/Fliztone/makefun-gta6-cover-art-01-rec/rank.svg)](https://make.fun/bounty/gta6-cover-art-01)
[![Reward](https://make.fun/badge/gta6-cover-art-01/Fliztone/makefun-gta6-cover-art-01-rec/reward.svg)](https://make.fun/bounty/gta6-cover-art-01)

A make.fun entry for the **gta6-cover-art-01** bounty: an offline, private web app that turns
your photos and a caption into multi-panel cover art in the style of GTA VI's Vice City
posters, exported as a PNG in the common post sizes.

## What it makes

- **Multi-panel poster layouts** — Grid (2×2), Hero (big + three), Mosaic (tall + two) and
  Diagonal Duo (slanted split), all inside a white frame with white gutters.
- **Per-panel crop** — drag any panel to reposition it, scroll to zoom, or use the zoom
  slider. Fill every panel with one photo or give each its own.
- **Five color grades** — Vice Sunset, Neon Night, Golden, Ocean and Raw: deterministic
  pixel transforms (lift/gain LUTs, saturation, luminance-keyed tint).
- **Auto-fitted bold caption** in three lettering styles — Sunset Gradient, Neon and
  Chrome — set in Bungee, with a tracked-out Anton tagline.
- **Original VI badge** and palm silhouettes, seeded film grain and vignette.
- **Six original procedural Vice City sample scenes** (Sunset Strip, Neon Nights, Golden
  Marina, Causeway Dusk, Downtown Heat, Midnight Pier) painted on canvas from a seeded
  PRNG — no borrowed imagery, no Rockstar assets.
- **One-click PNG export** at 1080×1080, 1080×1350 and 1920×1080. The live preview is the
  export: both render through the same pipeline.

Photos are read on your own machine and never uploaded. The app is plain static files:
no build step, no library, no network request.

## Try it

```sh
node serve.ts            # serves app/ on http://localhost:8080
```

Open http://localhost:8080 in a desktop browser, add photos (or use the sample scenes),
pick a layout and grade, write a caption, export a PNG.

## Hand it in

`main.ts` (Node 22, standard library only) copies `app/` and `screenshots/` to
`$MAKEFUN_OUTPUT_DIR` (`/output` in the grader) and writes `dossier.json` with the
kit's `buildDossier`. It is deterministic: two runs write byte-identical output.

```sh
mkdir -p out
MAKEFUN_OUTPUT_DIR=out node main.ts
```

## Screenshots

`screenshots/` holds four real browser renders (headless Edge): the first by name is the
cover — a 1920×1080 export shown at 1280×720 — then the editor with a photo loaded, a
portrait Neon Night cover and a square Golden Coast cover.

## Layout

```
main.ts               entry point: copies app/ + screenshots/, writes dossier.json
serve.ts              tiny local static server for app/
vendor/makefun-app.ts the kit's dossier library, byte-identical
app/                  the studio: index.html, css/, js/ modules, fonts/
screenshots/          four renders of the app and its exported covers
```

## Fonts

Anton and Bungee are shipped under `app/fonts/` with their SIL Open Font License
(`OFL.txt`). All lettering, scenes, the badge and effects are original code.

## License

MIT — see [LICENSE](LICENSE).