import type { World } from './World';
import { GROUND_PORTALS, rampAt, rampFloor } from './Topology';
import { laneZ, laneWidth } from './MapLayout';

export function buildTopology(w: World) {
  const wall = w.material('blockout-retaining-wall', '#85867f');
  const bank = w.material('blockout-field-bank', '#777b72');
  // Preserve the collision / graph contract: one opening per macro-lane boundary.
  for (const gate of GROUND_PORTALS) {
    for (const [a, b] of [[-90, gate.x - gate.width / 2], [gate.x + gate.width / 2, 90]]) {
      for (let x = a; x < b; x += 2) {
        const end = Math.min(b, x + 2), cx = (x + end) / 2;
        const base = Math.min(w.terrain.height(x, gate.z), w.terrain.height(end, gate.z)) - .1;
        const ramp = rampAt(cx, gate.z);
        const bottom = ramp ? Math.max(base, rampFloor(ramp, cx, gate.z, w.terrain.height) + 2.2) : base;
        const top = base + 3.4;
        w.box('macro-lane-retaining-wall', cx, (bottom + top) / 2, gate.z, end - x, top - bottom, .65, wall);
      }
    }
    for (let z = Math.min(gate.from, gate.to); z <= Math.max(gate.from, gate.to); z += 1) {
      w.box('stoneStep', gate.x, w.terrain.height(gate.x, z) + .025, z, gate.width, .05, .18, wall, false);
    }
  }
  // Filled field / berm masses replace the empty southern third. Their negative
  // space is one trench, with a single north connection at the southern gate.
  const southGate = GROUND_PORTALS.find(p => p.z < 0)!;
  for (let x = -90; x < 90; x += .75) {
    const cx = x + .375, z = laneZ('south', cx), half = laneWidth('south', cx) / 2;
    const spans = [[-44.4, z - half], [z + half, -14.4]];
    for (let side = 0; side < spans.length; side++) {
      if (side === 1 && Math.abs(cx - southGate.x) < southGate.width / 2 + .4) continue;
      const [a, b] = spans[side];
      if (b <= a) continue;
      const bottom = Math.min(w.terrain.height(cx, a), w.terrain.height(cx, b)) - .05;
      const top = .5;
      w.box('blockout-field-berm', cx, (bottom + top) / 2, (a + b) / 2, .75, top - bottom, b - a, bank);
    }
  }
  for (const x of [-89.7, 89.7]) w.box('boundary-earth-wall', x, 2, 0, .6, 10, 90, wall);
  for (const z of [-44.7, 44.7]) w.box('boundary-earth-wall', 0, 2, z, 180, 10, .6, wall);
}
