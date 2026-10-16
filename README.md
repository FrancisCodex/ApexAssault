# Apex Assault: Varga Island Conflict

<div align="center">
  <img src="/assets/Apex_Logo.png" alt="Apex Assault Logo" width="200" />
  <br/>
  <h3>Modern air combat over a contested island — in your browser</h3>
</div>

## Overview

**Apex Assault** is an Ace Combat–inspired flight combat game built with **Three.js**, React and TypeScript.
Fly strike missions deep into enemy territory or hold the line over your home base, against AI pilots that
fly the same physics model you do.

## Features

- **Realistic island theatre** — a 32 × 32 km procedurally generated island (Varga Island) with a coastline,
  the Greyspine mountain range and its low pass, an arid eastern plateau, forests, towns, two full air bases
  with runways and hangars, SAM sites, flak batteries and radar stations.
- **Two game modes**
  - **Attack — Operation Hammerfall:** breach the Greyspine Pass SAM belt, dismantle Kessel Ridge Air Base
    (air defenses, hangars that keep scrambling fighters) and destroy the command bunker. Watch out for the
    Crimson Wolf ace squadron.
  - **Defense — Operation Iron Bastion:** defend Port Ardent Air Base at dawn against five escalating raids of
    fighters, escorted bombers and ground-attack jets coming out of the sunrise. Keep the base above 35%
    integrity and Base Command alive.
- **Energy-based flight model** — thrust, drag, gravity, G-limited turn rates, corner speed, angle of attack,
  stalls, induced drag that bleeds speed in hard turns, afterburner, airbrake and a **high-G post-stall turn**
  (accelerate + brake + pull). The F-22 and Su-57 have thrust vectoring for the tightest maneuvers.
- **Helicopter flight model** for the AH-64 — collective, cyclic, pedals, hover and landing.
- **Ace Combat style controls** — *Standard* (bank-and-turn assist with auto-level), *Expert* (full manual roll)
  and *Mouse Aim* (point where you want to fly). Gamepad supported.
- **Cameras** — close chase, far chase, cockpit (with canopy and instrument panel) and HUD-only; free look,
  look-back and target-lock camera. Optional rear-view mirror.
- **Combat** — gun with lead pipper and optional aim assist, lock-on missiles with alternating rails,
  multi-lock special weapons (XLAA, Hellfire), high-agility QAAM, guided bombs, rocket salvos, flares that
  decoy incoming missiles, missile alerts and lock warnings, terrain masking against SAM radar.
- **AI pilots** — pursue with lead/lag pursuit, gun bursts, missile locks, break turns and flares against
  incoming missiles, terrain avoidance, bombers that compute release points, attackers that dive-bomb,
  escorts, and allied wingmen who fight alongside you.
- **HUD** — pitch ladder, flight path marker, speed / altitude / heading tapes, G meter, target brackets,
  lock diamonds, off-screen target arrows, rotating radar, weapon panel, damage readout, tactical map (M).
- **Procedural audio** — engine, wind, guns, missiles, explosions, lock tone and missile alert, all synthesized
  with the Web Audio API (no audio files).

## Aircraft

| Aircraft | Role | Special weapon |
| :--- | :--- | :--- |
| F-14D Super Tomcat | Multirole | XLAA — long-range, locks 4 air targets |
| F-22A Raptor | Air superiority | QAAM — extremely agile dogfight missile |
| A-10C Thunderbolt II | Attacker | GPB — guided bombs |
| Spitfire Mk IX (restomod) | Agile fighter | RKT — rocket salvos |
| AH-64E Apache Guardian | Attack helicopter | AGM-114 Hellfire — locks 4 ground targets |

## Controls

| Action | Keyboard / Mouse | Gamepad |
| :--- | :--- | :--- |
| Pitch (nose down / up) | `W` / `S` | Left stick ↕ |
| Roll / bank-turn | `A` / `D` | Left stick ↔ |
| Yaw (rudder) | `Q` / `E` | LB / RB |
| Accelerate / afterburner | `Shift` | RT |
| Brake / airbrake | `Space` | LT |
| High-G turn | `Shift` + `Space` + pull | RT + LT + pull |
| Gun | Left mouse / `J` | X |
| Fire missile / special | Right mouse / `K` | A |
| Switch MSL ⇄ special | `R` | Y |
| Switch target | `Tab` / `T` | B |
| Flares | `F` | D-pad ↓ |
| Look at target (hold) | `C` | R3 |
| Look back (hold) | `X` | L3 |
| Free look | Mouse / arrow keys | Right stick |
| Change camera | `V` | View |
| Tactical map | `M` | — |
| Pause | `Esc` / `P` | Menu |

Click the screen once in flight to capture the mouse. Pitch can be inverted in Settings.

## Running locally

**Prerequisites:** Node.js 18+

```bash
npm install
npm run dev
```

Then open the URL Vite prints (default `http://localhost:3000`).

```bash
npm run build      # production build
npm run typecheck  # TypeScript check
```

## Project structure

```
game/
  Engine.ts            renderer, loop, mission host, post-processing
  PlayerController.ts  input → stick commands, targeting, lock-on
  CameraRig.ts         chase / cockpit / HUD / cinematic cameras
  HUD.ts               canvas HUD
  Audio.ts             synthesized sound
  entities/            Aircraft (flight models, weapons), GroundTarget (SAM, AA, structures)
  ai/                  PilotAI and steering helpers
  systems/             bullets, missiles, flares, particles, effects
  world/               terrain, water, sky, clouds, map layout
  missions/            Attack and Defense missions
  models/              procedural aircraft, buildings and cockpit geometry
components/            React menus and mission overlay
```

## Technologies

- [Three.js](https://threejs.org/) — rendering, post-processing
- [React](https://react.dev/) + [Zustand](https://github.com/pmndrs/zustand) — menus and UI state
- [Tailwind CSS](https://tailwindcss.com/) — styling
- [Vite](https://vitejs.dev/) — build tool

---

*Made by [@FrancisCodex](https://github.com/FrancisCodex)*
