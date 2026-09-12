import type { World } from './World';
import { COVERS, HOUSES, STREET_BLOCKS } from './MapLayout';

/** Gameplay massing only: no roof tiles, windows, textures or decorative props. */
export function buildBlockoutSurface(w: World) {
  const mass = w.material('blockout-building', '#939591');
  const wall = w.material('blockout-wall', '#7c7e78');
  const cover = w.material('blockout-cover', '#74766f');
  for (const h of HOUSES) {
    const bottom = Math.min(...[-1, 1].flatMap(sx => [-1, 1].map(sz => w.terrain.height(h.x + sx * h.w / 2, h.z + sz * h.d / 2)))) - .1;
    const top = Math.max(...[-1, 1].flatMap(sx => [-1, 1].map(sz => w.terrain.height(h.x + sx * h.w / 2, h.z + sz * h.d / 2)))) + h.h;
    w.box(h.name, h.x, (bottom + top) / 2, h.z, h.w, top - bottom, h.d, mass);
  }
  const walls = [
    { x: -49, z: 21, w: 15, d: .7, h: 2.6 },
    { x: -62, z: 34, w: .7, d: 8, h: 2.4 },
    { x: -34, z: 38, w: .7, d: 9, h: 2.6 },
    { x: 56, z: 24, w: 5, d: .7, h: 1.2 },
    { x: 31, z: 20, w: .7, d: 6, h: 2.5 },
    { x: 68, z: 32, w: .7, d: 7, h: 2.5 },
    { x: -56, z: -1, w: .7, d: 5, h: 2.7 },
    { x: -38, z: 10, w: 5, d: .7, h: 1.2 },
    { x: -9, z: -11.5, w: 6, d: .7, h: 1.2 },
    { x: 7, z: -12, w: 5, d: .7, h: 2 },
    { x: 55, z: 3, w: .7, d: 5, h: 2.6 },
  ];
  for (const p of walls) w.box('blockout-broken-court-wall', p.x, w.terrain.height(p.x, p.z) + p.h / 2, p.z, p.w, p.h, p.d, wall);
  for (const c of COVERS) w.box('blockout-cover', c.x, w.terrain.height(c.x, c.z) + c.h / 2, c.z, c.w, c.h, c.d, cover);
  for (const p of STREET_BLOCKS) w.box('blockout-alley-screen', p.x, w.terrain.height(p.x, p.z) + 1.5, p.z, .7, 3, p.d, wall);
  for (const x of [-77, 77]) w.box('spawn-screen', x, 1.6, .8, .6, 3.2, 3.4, wall);
  // Hollow well mass offset from the capture center so the objective remains walkable.
  for (const side of [-1, 1]) {
    w.box('blockout-well', 3 + side, .5, -9, .3, 1, 2.3, cover);
    w.box('blockout-well', 3, .5, -9 + side, 1.7, 1, .3, cover);
  }
}
