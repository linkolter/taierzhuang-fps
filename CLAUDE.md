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
- Gameplay pass was completed at `0633cb7` and fast-forwarded into local `main`.
- Performance Baseline Pass additions: `docs/PERFORMANCE_BASELINE.md`; current branch `performance-baseline-pass`.
- MEDIUM is the standard profile; quality changes render resolution only. Preserve all gameplay constants and pool/voice limits across tiers.
- Heavy AI work goes through `AIWorkScheduler` (3 perceptions / 2 decisions / 3 firing checks, at most 5 actors per frame); objective paths retain `RoutePlanningScheduler`. Never throttle movement or bypass fresh fire safety checks.
- Performance harness: `tests/performance-baseline.mjs` (`PERF_SECONDS=900`, `PERF_QUALITY=MEDIUM`, `PERF_GPU=1`); actual wall time, no accelerated simulation. Compare GC-retained heap and bounded object counts, not raw allocation peaks alone.
- Measure before optimizing; distinguish frame interval, main-thread CPU, render submission, and GPU query time. Stop this pass before art, models, or AI architecture changes.
