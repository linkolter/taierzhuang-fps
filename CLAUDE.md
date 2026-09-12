# taierzhuang-fps

- TypeScript strict mode, Babylon.js 8, Vite; browser-only offline game.
- Entry: `src/main.ts` → `src/game/Game.ts`; Game connects independent rules, player, AI, audio and DOM HUD.
- Build: `npm run build`. Tests: `npm test` (`tsx --test tests/*.test.ts`).
- Integration tests: `tests/battlefield-browser.mjs`, `tests/battlefield-soak.mjs`; set `PLAYWRIGHT_MODULE` to installed Playwright and optionally `GAME_URL` to a running dev server.
- Preserve original tests and the existing bounded route planning / static collision indexes.
- Reuse scene objects and finite audio/effect pools on round reset; release event listeners on dispose.
- Map layout and collision ownership: `MapLayout.ts`, `Terrain.ts`, `TopologyGeometry.ts`, `TunnelGeometry.ts`, `BlockoutSurface.ts`. Gameplay rules must not silently change authored geometry.
- Latest gameplay handoff and deferred collision list: `docs/BATTLEFIELD_GAMEPLAY_PASS.md`.
- Combat Map V3 blockout handoff: `docs/COMBAT_MAP_V3_BLOCKOUT.md`.
- Working branch: `battlefield-gameplay-pass`. V3 whitebox edits were already uncommitted at the start of this pass; preserve them.
