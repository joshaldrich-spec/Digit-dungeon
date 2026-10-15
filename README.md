# Digit Dungeon

A math roguelite for 2nd grade (Bridges in Mathematics, Grade 2, Unit 1). Plain HTML, CSS and JavaScript with no build step: GitHub Pages serves this folder as-is.

## What's where

| Path | What it holds |
|---|---|
| `index.html` | The page: screens and buttons, plus the list of scripts to load |
| `css/game.css` | Layout and base styles |
| `css/skin.css` | The Gemini art for buttons, panels, icons, room walls and backgrounds (on when all skin art loads) |
| `js/core.js` | Helpers, save data, sound effects, read-aloud voice |
| `js/curriculum.js` | The math: skills, fact pools, rules that build each room |
| `js/coaching.js` | Strategy coaching, mistake cards, remember cards |
| `js/art.js` | Sprite file list, fallback drawings, exact math pictures |
| `js/powers.js` | Math powers for fights: doubles, ten-friends, quick-look ten-frames, even/odd, skip-count hops, facts (each with its picture hint) |
| `js/dungeon.js` | Items, floor maps, run setup, lesson/comeback/normal rooms |
| `js/play.js` | Turns, monsters, squash fights, chomping, learning loop, shop, boss, end of run |
| `js/render.js` | Drawing the room, HUD, footprints, minimap |
| `js/ui.js` | Overlays, title, closet, grown-ups panel, input, start-up |
| `art/` | Sprites (`.webp`, backgrounds removed); `art/hero/` has one per Closet color; `art/tops/` and `art/shoes/` are layers that line up with the hero |
| `audio/voice.mp3`, `audio/voice.js` | The Gemini voice recording cut into 232 clips, and the index the game uses to string them into sentences |
| `audio/music.mp3` | Background music loop (composed by `tools/music.py`) |
| `audio/voice-lines.json` | Master list of voice clips (id, recording part, text) |
| `docs/` | Gemini voice scripts (`voice-script-2.txt` is the next short recording) and art prompts |
| `tests/check.py` | One command that checks the math (including kid-style play by real button presses), monsters, learning loop, input, voice, music, a full run and layouts |
| `tools/voice/` | How the recording was cut (alignment, clip list) |
| `tools/cut_ui.py`, `tools/cut_sheets.py` | Cut Gemini sprite sheets into game art |
| `tools/cut_powers.py` | Cut the math-power icons, squash splat, surprise burst and peek eyes (the ten-frame icons are built from the game's own board and counters) |
| `tools/cut_closet.py` | Cut the Closet sheets: hats, tops (fitted to the hero's belly) and shoes (front shoe split out and mirrored) |
| `tools/music.py` | Composes and renders the background music |
| `tools/process_art.py` | Turns a Gemini image into a game sprite (removes background, crops, recolors hero) |

Scripts are loaded in order by `index.html` and share globals; there are no imports.

## Releasing a change

1. Change only the files involved.
2. Run `python3 tests/check.py` (about 2 minutes; add `--shots` for screenshots).
3. Bump the version: `BUILD` in `js/core.js` and the `?vN` tags in `index.html`. That forces iPads to fetch the new files.
4. Commit. GitHub Pages redeploys in about a minute. The build number shows in the Grown-ups panel.
