import { CONFIG, type Team } from '../config/gameConfig';
import type { Actor, Objective } from '../game/types';
import { OBJECTIVES } from '../map/MapLayout';
import { clamp } from '../core/math';
export interface CapturePoint extends Objective { name: string; contested: boolean; present: { cn: number; jp: number } }
export class CaptureSystem {
  points: CapturePoint[] = OBJECTIVES.map(p=>({...p,owner:null,progress:0,contested:false,present:{cn:0,jp:0}}));
  onCapture = (_point: CapturePoint, _owner: Team | null) => {};
  reset() { for (const p of this.points) { p.owner = null; p.progress = 0; p.contested = false; p.present = { cn: 0, jp: 0 }; } }
  update(dt: number, actors: Actor[]) {
    for (const p of this.points) {
      p.present.cn=0;p.present.jp=0;
      for (const a of actors) if (a.alive && Math.abs(a.position.y-(p.y??0)) < 1.1 && Math.hypot(a.position.x - p.x, a.position.z - p.z) <= CONFIG.match.captureRadius) p.present[a.team]++;
      p.contested = p.present.cn > 0 && p.present.jp > 0; if (p.contested || (!p.present.cn && !p.present.jp)) continue;
      const team: Team = p.present.cn ? 'cn' : 'jp', sign = team === 'cn' ? 1 : -1;
      const old = p.owner; const before = p.progress;
      p.progress = clamp(p.progress + sign * dt / CONFIG.match.captureSeconds * (1 + Math.min(2, p.present[team] - 1) * .25), -1, 1);
      if (p.owner && before * p.progress <= 0) p.owner = null;
      if (p.progress >= 1) p.owner = 'cn'; if (p.progress <= -1) p.owner = 'jp';
      if (old !== p.owner) this.onCapture(p, p.owner);
    }
  }
  controlled(team: Team) { return this.points.filter(p => p.owner === team).length; }
}
