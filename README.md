# Digit Dungeon

A math roguelite for 2nd grade (Bridges in Mathematics, Grade 2, Unit 1). Plain HTML, CSS and JavaScript with no build step: GitHub Pages serves this folder as-is.

## What's where

| Path | What it holds |
|---|---|
| `index.html` | The page: screens and buttons, plus the list of scripts to load |
| `css/game.css` | All styles |
| `js/core.js` | Helpers, save data, sound effects, read-aloud voice |
| `js/curriculum.js` | The math: skills, fact pools, rules that build each room |
| `js/coaching.js` | Strategy coaching, mistake cards, remember cards |
| `js/art.js` | Sprite file list, fallback drawings, exact math pictures |
| `js/dungeon.js` | Items, floor maps, run setup, lesson/comeback/normal rooms |
| `js/play.js` | Turns, monsters, chomping, learning loop, shop, boss, end of run |
| `js/render.js` | Drawing the room, HUD, footprints, minimap |
| `js/ui.js` | Overlays, title, closet, grown-ups panel, input, start-up |
| `art/` | Sprites (`.webp`, backgrounds removed); `art/hero/` has one per Closet color |
| `audio/voice-lines.json` | Master list of voice clips (id, recording part, text) |
| `docs/` | Gemini voice script and art prompts |
| `tests/check.py` | One command that checks the math, monsters, learning loop, a full run and layouts |
| `tools/process_art.py` | Turns a Gemini image into a game sprite (removes background, crops, recolors hero) |

Scripts are loaded in order by `index.html` and share globals; there are no imports.

## Releasing a change

1. Change only the files involved.
2. Run `python3 tests/check.py` (about 30 seconds; add `--shots` for screenshots).
3. Bump the version: `BUILD` in `js/core.js` and the `?vN` tags in `index.html`. That forces iPads to fetch the new files.
4. Commit. GitHub Pages redeploys in about a minute. The build number shows in the Grown-ups panel.
