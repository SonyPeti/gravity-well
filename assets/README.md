# Sprites

Drop PNG files here with these exact names and the game uses them automatically
instead of the built-in drawings. Missing files are fine; they fall back to code-drawn art.

Use transparent backgrounds and square images (e.g. 256×256), with the object centered and filling the frame.

| File | What |
|---|---|
| `background.jpg` | Full-screen space background (portrait, e.g. 1080×1920; JPG to keep it small) |
| `mut_<id>.png` | Mutation card icons (20, ids as in `MUTATIONS` in game.js) |
| `upg_<id>.png` | Upgrade button icons (14, ids as in `UPGRADES` in game.js) |
| `icon_energy.png`, `icon_stardust.png` | Currency icons |
| `planet.png` | The player planet (round, centered) |
| `orb_rock.png` | Rock moon |
| `orb_ice.png` | Ice moon |
| `orb_lava.png` | Lava moon |
| `orb_drone.png` | Captured drone (pointing **up**) |
| `orb_void.png` | Void shard |
| `orb_gold.png` | Golden moon |
| `enemy_drifter.png` | Asteroid |
| `enemy_comet.png` | Comet (head pointing **up**) |
| `enemy_scout.png` | Alien scout ship (nose pointing **up**) |
| `enemy_molten.png` | Lava boulder |
| `enemy_wraith.png` | Void wraith (facing **up**) |
| `boss_worm.png` | World Eater head (facing **up**) |
| `boss_mothership.png` | Mothership |
| `skin_ember.png` … `skin_void.png` | Unlockable planet skins (ember, glacier, gasgiant, crystal, void) |
| `ui_logo.png` | Title logo on the main menu (transparent) |
| `ui_menu_bg.png` | Main menu backdrop |
| `ui_observatory.png` | Observatory header art |
| `ui_runcomplete.png` | Game-over header art |
| `ui_pulse.png` | Gravity Pulse illustration (How to play) |

Source art lives in `art/source/`. To re-cut it: `node tools/sprite-server.js`, then open
http://localhost:8081/tools/cutter.html and run `run({ save: true })` in the console
(or open `cutter.html#batch2` and run `runBatch2({ save: true })` for the icon sheets).
