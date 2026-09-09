import { Ray, Vector3 } from '@babylonjs/core';
import { CONFIG } from '../config/gameConfig';
import type { Actor } from './types';
import type { Bot } from '../ai/Bot';
import { World } from '../map/World';
export class Combat {
  private sightOrigin=new Vector3();private sightEnd=new Vector3();
  onDeath = (_victim: Actor, _attacker: Actor, _head: boolean) => {};
  onHit = (_victim: Actor, _attacker: Actor, _head: boolean) => {};
  onShot = (_origin: Vector3, _end: Vector3, _team: string, _melee: boolean) => {};
  constructor(public world: World, public actors: Actor[]) {}
  visible(a: Actor, b: Actor) {this.sightOrigin.copyFrom(a.position);this.sightOrigin.y+=a.crouching?.9:1.4;this.sightEnd.copyFrom(b.position);this.sightEnd.y+=b.crouching?.85:1.2;return !this.world.blocked(this.sightOrigin,this.sightEnd);}
  damage(victim: Actor, attacker: Actor, amount: number, head = false) { if (!victim.alive || victim.team === attacker.team || victim.protection > 0) return; victim.health = Math.max(0, victim.health - amount); this.onHit(victim, attacker, head); if (victim.health === 0) { victim.alive = false; this.onDeath(victim, attacker, head); } }
  shoot(attacker: Actor, origin: Vector3, direction: Vector3, melee: boolean) {
    const range = melee ? CONFIG.melee[attacker.team].range : CONFIG.rifle.range;
    const ray = new Ray(origin, direction, range); let distance: number = range, victim: Actor | null = null, head = false;
    const wall = this.world.scene.pickWithRay(ray, m => !!m.metadata?.solid); if (wall?.hit) distance = wall.distance;
    for (const a of this.actors) {
      if (!a.alive || a.id === attacker.id) continue;
      const height = a.crouching ? 1.15 : 1.7;
      const bodyMin = a.position.add(new Vector3(-.32, .08, -.32)), bodyMax = a.position.add(new Vector3(.32, height - .25, .32));
      const body = this.rayBox(origin, direction, bodyMin, bodyMax);
      const center = a.position.add(new Vector3(0, height - .13, 0)); const headDistance = this.raySphere(origin, direction, center, .19);
      const hitDistance = Math.min(body, headDistance);
      if (hitDistance >= 0 && hitDistance < distance) { victim = a; distance = hitDistance; head = headDistance <= body; }
      if (melee) { const d = center.subtract(origin); const len = d.length(); if (len < distance && len < range && Vector3.Dot(d.normalize(), direction) > .65 && !this.world.blocked(origin, center)) { victim = a; distance = len; head = false; } }
    }
    const end = origin.add(direction.scale(distance)); this.onShot(origin, end, attacker.team, melee);
    if (victim && victim.team !== attacker.team) this.damage(victim, attacker, melee ? CONFIG.melee[attacker.team].damage : head ? CONFIG.rifle.headDamage : CONFIG.rifle.bodyDamage, head);
    return { victim: victim?.id ?? null, head, end };
  }
  botShoot(bot: Bot, target: Actor, melee: boolean) {
    const o = bot.position.add(new Vector3(0, 1.35, 0)), end = target.position.add(new Vector3(0, target.crouching ? .8 : 1.12, 0));
    if (!melee) { const d = Vector3.Distance(o, end); const probability = CONFIG.ai.accuracyNear + (CONFIG.ai.accuracyFar - CONFIG.ai.accuracyNear) * Math.min(1, d / CONFIG.ai.sight); if (Math.random() > probability) { const miss = .75 + d * .025; end.x += (Math.random() < .5 ? -1 : 1) * miss; end.y += (Math.random() - .3) * miss; end.z += (Math.random() - .5) * miss; } }
    this.shoot(bot, o, end.subtract(o).normalize(), melee);
  }
  raySphere(o: Vector3, d: Vector3, c: Vector3, radius: number) { const oc = o.subtract(c), b = Vector3.Dot(oc, d), disc = b * b - oc.lengthSquared() + radius * radius; return disc >= 0 && -b - Math.sqrt(disc) >= 0 ? -b - Math.sqrt(disc) : Infinity; }
  rayBox(o: Vector3, d: Vector3, min: Vector3, max: Vector3) { let near = 0, far = Infinity; for (const k of ['x', 'y', 'z'] as const) { if (Math.abs(d[k]) < .000001) { if (o[k] < min[k] || o[k] > max[k]) return Infinity; } else { let a = (min[k] - o[k]) / d[k], b = (max[k] - o[k]) / d[k]; if (a > b) [a,b] = [b,a]; near = Math.max(near, a); far = Math.min(far,b); if (near > far) return Infinity; } } return near; }
}
