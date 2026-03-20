# Synthengine

**Translate text into navigable 3D worlds with spatial audio.**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Built with Vite](https://img.shields.io/badge/Built%20with-Vite-646CFF.svg)](https://vitejs.dev)
[![Three.js](https://img.shields.io/badge/Three.js-000000.svg)](https://threejs.org)

<!-- TODO: Add live demo link once Vercel is set up -->

<!-- Add screenshot or GIF here: ![Synthengine screenshot](screenshot.png) -->

---

## What is this?

Synthengine analyzes input text — its phonetics, rhythm, sentiment, and vocabulary — and procedurally generates a 3D world you can walk through. Each world has unique architecture, materials, lighting, and spatial audio derived entirely from the text.

**Pipeline:** Text analysis → World graph → Geometry → Materials → Spatial audio

## Features

- **Text analysis** — Phonetic mapping, rhythmic patterns, sentiment detection, lexical categorization
- **Procedural geometry** — Vaults, domes, corridors, crystal formations, all shaped by language
- **Spatial audio** — Web Audio API with reverb, harmonic generation, and positional sound
- **Cinematic flythrough** — Automated camera paths with recording support
- **Minimap** — Real-time overhead view of the generated world
- **URL sharing** — Share worlds via LZ-String compressed URLs
- **Gallery** — Save and revisit worlds with IndexedDB persistence

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

## Controls

| Key | Action |
|-----|--------|
| **Click** | Enter world (pointer lock) |
| **WASD / Arrows** | Move |
| **Mouse** | Look around |
| **Shift** | Run |
| **Space** | Float up (in void sections) |
| **C** | Toggle cinematic flythrough |
| **R** | Record flythrough |
| **Tab** | Toggle minimap |
| **ESC** | Release pointer lock |

## Architecture

```
src/
├── analysis/       Text → phonetic, rhythmic, sentiment, lexical features
├── world/          Feature vectors → world graph (rooms, connections)
├── geometry/       World graph → Three.js meshes (vaults, domes, corridors, crystals)
├── materials/      Procedural shaders and material generation
├── audio/          Spatial audio engine (Web Audio API)
├── navigation/     First-person controller and cinematic camera
├── ui/             HUD, minimap, gallery, input handling
├── sharing/        URL encoding/decoding, IndexedDB persistence
└── utils/          Color mapping, hash functions, helpers
```

## Tech Stack

- [Three.js](https://threejs.org) — 3D rendering
- [Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API) — Spatial audio
- [Vite](https://vitejs.dev) — Build tooling
- [LZ-String](https://pieroxy.net/blog/pages/lz-string/index.html) — URL compression

## License

[MIT](LICENSE) — Aadi Dash
