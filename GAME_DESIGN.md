# GRAVITY WELL — Game Design

> *Everything you destroy becomes part of your defense.*

## One-line pitch
You are a small living planet adrift in deep space. Asteroids, alien raiders and cosmic horrors fly at you. **Whatever you destroy gets captured by your gravity and joins your orbit**, circling you and smashing the next wave. Every 3 waves you **draft a mutation** that twists the rules. Then you die, spend your stardust on permanent upgrades, and dive back in.

Genre: idle / roguelite defense · Platform: mobile, portrait, one-thumb · Session: 3–15 min runs

---

## Core loop
1. **Survive waves.** Enemies come in from every edge of the screen toward your planet.
2. **Your planet's core fires automatically** at the nearest threat (basic damage source early on).
3. **Captured debris becomes orbitals.** Destroyed enemies sometimes leave a fragment that gets pulled into orbit. Orbitals circle the planet and damage anything they hit.
4. **Spend Energy** (in-run currency) on upgrades: core damage, orbit capacity, capture chance, planet health…
5. **Every 3 waves, draft a Mutation.** Pick 1 of 3 random cards. These stack into wild builds.
6. **Planet collapses → run ends.** You earn **Stardust** (permanent currency).
7. **Observatory** (meta screen): spend Stardust on permanent upgrades, unlock new planets, moon types and mutation cards.

## Active skill: Gravity Pulse (tap the planet)
- **Tap:** shockwave that pushes enemies back and flings orbitals outward like a shotgun, then they snap back.
- Cooldown ~20 s, shown as a glowing ring filling up around the planet.
- Optional, so idle players can ignore it, but good players use it to clutch boss waves.

## Orbitals (the signature mechanic)
Orbit has **rings** (inner, middle, outer). Each ring has a capacity. Orbitals are what make every run visually unique.

| Orbital | Comes from | Behaviour | Look |
|---|---|---|---|
| **Rock Moon** | Asteroids | Rams enemies, basic damage | Grey-brown cratered pebble, faint cyan trail |
| **Ice Moon** | Comets | Slows what it hits | Pale blue crystal, frosty sparkle trail |
| **Lava Moon** | Molten rocks | Burns (damage over time) | Black rock with glowing orange cracks, ember trail |
| **Captured Drone** | Alien scouts | Shoots small lasers outward | Small alien ship turned **your** color (teal) |
| **Void Shard** | Rare / elite enemies | Pierces through multiple enemies | Dark purple crystal, inverted glow |
| **Golden Moon** | Very rare (~1%) | Extra Energy per hit | Polished gold, sparkle — the jackpot drop |

Orbitals have durability: they crack and eventually shatter, so you keep needing fresh captures.

## Mutation Draft (examples)
Cards come in rarities: **Common (white) · Rare (blue) · Epic (purple) · Legendary (gold)**.

- **Binary Star:** a second, smaller core orbits you and also fires.
- **Hungry Gravity:** enemies near you are slowly pulled inward faster, and orbitals deal +50% damage.
- **Shrapnel:** shattered orbitals explode into 3 mini-fragments.
- **Retrograde:** every other ring spins backwards.
- **Black Hole Heart (Legendary):** every 100 kills spawn a tiny black hole that eats enemies for 5 s.
- **Glass Cannon:** double damage, half health.
- **Tidal Lock:** orbitals stop spinning but hit 3× harder.
- **Second Gravity:** captured enemies keep their own small orbit.

## Enemies
| Enemy | Role | Look |
|---|---|---|
| **Drifter** (asteroid) | Basic, slow | Jagged grey-brown rock, dull red hot spots |
| **Comet** | Fast, low HP | Icy head with a long blue-white tail |
| **Alien Scout** | Ranged, shoots at you | Sleek magenta/hot-pink ship, glowing engines |
| **Molten Rock** | Tanky, splits on death | Big black boulder with orange lava veins |
| **Void Wraith** | Ignores orbitals partly, elite | Dark silhouette with glowing violet eyes, smoky edges |
| **Boss: World Eater** (every 10 waves) | Huge, slow, armoured | Giant serpent/worm made of rock and teeth, red glowing maw, it curls around the screen edge |
| **Boss: Mothership** | Spawns scouts | Huge magenta alien ship with rotating rings |

## Player planets (unlockable skins — also a monetization item)
1. **Terra Seed** (starter): small blue-green world, swirling white clouds, soft cyan atmosphere glow.
2. **Ember:** dark volcanic planet, glowing lava rivers, orange atmosphere.
3. **Glacier:** white-blue ice world with cracks, crystalline rings.
4. **Gas Giant Jr.:** chubby striped purple-pink gas planet with a little storm eye.
5. **Crystal Core:** faceted gem planet, refracts rainbow light.
6. **Nebula Heart** (premium/legendary): translucent planet with a galaxy swirling inside, golden halo.

**As built:** every planet is a *sidegrade* (a perk plus a drawback), so choosing one changes how you play:

| Planet | Perk | Drawback | Unlock |
|---|---|---|---|
| Terra Seed | Balanced | — | Starter |
| Ember | Core shots set enemies on fire | −10% max health | ✦60 |
| Glacier | Core shots chill and slow enemies | −10% core damage | ✦120 |
| Gas Giant Jr. | +3 orbit slots, rings 10% wider | −15% core damage | ✦200 + reach wave 15 |
| Crystal Core | +10% crit chance, +50% crit damage | −10% max health | ✦350 + reach wave 20 |
| Void Heart | 25% of captures become Void Shards | −10% energy | ✦600 + reach wave 30 |

Locked planets appear as dark silhouettes to create curiosity. The equipped planet tints the health bar and atmosphere glow.

Each planet has a subtle **face-less personality** through animation: breathing glow, little wobble when hit, clouds speeding up when angry. No cartoon eyes, it stays elegant.

---

## Visual style guide
**Overall style:** clean stylized 2D, *"neon cosmic minimalism"*. Smooth vector-like shapes, soft glows, no realistic textures, no photo-realism. Should look good at tiny phone size. Think of the clarity of mobile hits like *Alto's Odyssey* mood + the glow of *Geometry Wars*.

**Background:** deep space, nearly black navy, never pure black. Subtle parallax star layers, faint nebula clouds drifting slowly. The background is calm and dark so gameplay pops.

**Lighting:** everything important *emits* light. Orbitals leave short glowing trails. Hits flash white. Kills burst into small particles that get **sucked toward the planet** (reinforces the gravity theme).

### Color palette
| Role | Color | Hex |
|---|---|---|
| Background deep | Midnight navy | `#070A18` |
| Background nebula | Dusty indigo / violet | `#1B1540`, `#2E1A5C` |
| **Player / friendly** | Teal-cyan glow | `#3FF2E0` |
| Player secondary | Soft aqua | `#A8FFF4` |
| **Enemies** | Hot magenta / coral red | `#FF3D7F`, `#FF5A4E` |
| Energy (in-run currency) | Electric green | `#7DFF8A` |
| **Stardust** (premium-ish currency) | Warm gold | `#FFD34A` |
| Rare / void | Ultraviolet | `#9B5CFF` |
| Fire / lava | Ember orange | `#FF8A2A` |
| Ice | Frost blue | `#8FD8FF` |
| UI panels | Dark glass | `#12162E` @ 85% opacity |
| UI text | Off-white | `#E9ECFF` |

**Rule:** cyan/teal = yours, magenta/red = theirs. A player should read the battlefield instantly.

### UI
- Dark glass panels with rounded corners (16 px), thin 1 px light border, soft blur behind.
- Font: rounded geometric sans (e.g. *Fredoka*, *Baloo 2*, or *Nunito* Bold) for a friendly-but-clean feel.
- Mutation cards: tall portrait cards, rarity-colored glowing border, big icon in the middle, name + one-line effect. Draft screen = 3 cards fanning in with a little shimmer.
- Currency icons: **Energy** = green lightning spark, **Stardust** = small golden 4-point star.

### Feel / juice
- Screen shakes very lightly on boss hits only.
- Orbitals hum. Captures make a satisfying "thwump-ting" as debris locks into orbit.
- Music: dreamy ambient synth that gets more intense as waves rise.

---

## Galaxies & Constellations (long-term progression, as built)
**Supernova (prestige):** from wave 25 in the current galaxy the planet can go supernova. Stardust and Observatory reset; planets, achievements, missions and Constellations stay. Rewards **Dark Matter (◆)** = (best wave − 15)^1.6 / 4 × 1.3^(galaxy − 1).
- Every ◆ ever earned gives +2% damage and health permanently ("dark power"), so each supernova is an instant power spike.
- Each galaxy is +12% enemy health, has its own background color, a twist, and introduces a **new enemy**:
  Frozen Reach (comets ×2, Sentinel: shielded vs core shots) · Ember Expanse (early Molten, Blinker: teleports) · Void Rift (early Wraiths, Hive: bursts into Swarmers) · Deep Space I, II… (all twists).

**Constellations** (spent with ◆): endless power nodes (×1.25 damage, ×1.25 health, +25% Stardust), Warp Drive (skip early waves, max half your best in the galaxy), and one-time unlocks that add *new mechanics*: Auto-Buy, Auto-Pulse, Head Start, Wave Shield, Fourth Card, Star moons, and three new draftable mutations (Dark Harvest, Echo Pulse, Twin Core).

**Bot simulation (8 h, 3 runs, after the 2026-10-14 pulse rebalance):** best wave per galaxy ≈ 30 → 32 → 39 → 44 → 48, galaxy 6 reached in about 1 of 3 runs; supernova rewards ◆17-19 → 30-39 → 43-82 → 120 → 182. Same curve as before the rebalance (old build with the same bot: 29 → 34 → 39 → 42 → 47 → 50), about half a galaxy slower over 8 h. No wall: every galaxy goes further and pays more. Re-run with `tools/balance.js` → `progression()`.

## Monetization (fair, player-friendly)
- **Rewarded ads:** double Stardust after a run, one free revive per run, free extra mutation reroll.
- **Remove ads + 2× speed:** one-time purchase.
- **Planet skins & orbital trail colors:** cosmetic.
- **Cosmic Pass (season):** free + premium track with skins, Stardust, exclusive mutation cards (sidegrades, not pure power).
- No energy timers, no pay-to-win walls.

---

## Art brief for image generation (paste into ChatGPT)

### Master style (add to every prompt)
> Stylized 2D mobile game art, "neon cosmic minimalism": clean smooth vector-like shapes, soft glowing light, deep midnight-navy space background (#070A18) with faint indigo/violet nebula and tiny stars. Friendly elements are teal-cyan (#3FF2E0), enemies are hot magenta and coral red (#FF3D7F, #FF5A4E), rewards are gold (#FFD34A). No text, no realism, no clutter, high readability at small phone size.

### 1. Key art / store banner
> [Master style] A small glowing blue-green planet with swirling white clouds sits at the center of deep space. Around it, three glowing orbital rings of captured debris: cratered grey rock moons with cyan trails, pale-blue ice crystals, black lava rocks with glowing orange cracks, and one tiny shining golden moon. From the edges, a swarm of magenta alien ships, icy comets and jagged asteroids attack. One asteroid is shattering and its fragments are being pulled into orbit by visible gravity lines. Dynamic, epic but clean. Portrait 9:16.

### 2. App icon
> [Master style] App icon, square with rounded corners. A small blue-green planet with a bright teal atmospheric glow, one orbital ring with 3 small moons leaving glowing cyan trails, dark navy background. Bold, simple, readable at 64px. No text.

### 3. Gameplay screenshot mockup
> [Master style] Vertical mobile game screenshot, portrait 9:16. Top: thin dark-glass HUD bar showing wave number, green lightning energy counter and gold star currency. Center: small glowing planet with 2 orbital rings full of rock, ice and lava moons. Magenta enemy ships and asteroids approach from all sides, white hit flashes and small particle bursts. A glowing cooldown ring around the planet. Bottom 35%: dark glass panel with tabs and a 2-column grid of rounded upgrade cards with icons. Clean, polished, top-grossing mobile game quality.

### 4. Mutation draft screen
> [Master style] Mobile game UI: three tall portrait cards fanned out in the center of a dimmed space background. Left card: white border (common) with a shard icon. Middle card: purple glowing border (epic) with a spiralling orbit icon. Right card: gold glowing border (legendary) with a tiny black hole icon. Cards are dark glass with soft inner glow. Portrait 9:16.

### 5. Planet sprite sheet
> [Master style] Sprite sheet of 6 stylized planets on a plain dark background, evenly spaced, same size, front view: (1) blue-green earth-like planet with white swirling clouds and cyan glow, (2) dark volcanic planet with glowing orange lava rivers, (3) white-blue ice planet with cracks and crystal rings, (4) chubby pink-purple striped gas giant with a small storm eye, (5) faceted crystal gem planet refracting rainbow light, (6) translucent planet with a galaxy swirling inside and a golden halo.

### 6. Orbital sprite sheet
> [Master style] Sprite sheet of 6 small orbiting moon objects, top-down, plain dark background, each with a short glowing motion trail: grey cratered rock (cyan trail), pale-blue ice crystal (frost sparkle trail), black rock with orange lava cracks (ember trail), small sleek drone ship in teal, dark violet crystal shard with inverted glow, polished golden moon with sparkles.

### 7. Enemy sprite sheet
> [Master style] Sprite sheet of enemies, top-down, plain dark background: jagged grey-brown asteroid with red hot spots, icy comet with long blue-white tail, sleek hot-pink alien scout ship with glowing engines, big black boulder with orange lava veins, dark smoky wraith silhouette with glowing violet eyes. Plus one large boss: a giant space serpent made of rock and teeth with a glowing red maw, curled in a C-shape.

**Tips for generating:**
- Generate sprites on a **plain dark or transparent background** so we can cut them out.
- Keep the **master style line in every prompt** so all images match.
- If one image comes out great, upload it back to ChatGPT and say *"same style as this"* for the next ones.
