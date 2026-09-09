export const CONFIG = {
  map: { width: 180, depth: 90, tunnelY: -4, tunnelZ: -29, tunnelWidth: 2.4, entrances: [-68, 0, 68] },
  player: { health: 100, radius: 0.33, height: 1.7, eye: 1.56, crouchEye: 1.03, walk: 4.2, sprint: 6.5, crouch: 2.2, jump: 5.2, gravity: 16, sensitivity: 0.002, spawnX: -80 },
  rifle: { capacity: 5, bodyDamage: 75, headDamage: 150, cycle: 1.5, reload: 3.2, range: 160, hipSpread: 0.014, adsSpread: 0.0015 },
  melee: { cn: { damage: 100, range: 2.1, cycle: 1.1 }, jp: { damage: 95, range: 2.2, cycle: 0.95 } },
  ai: { cnCount: 7, jpCount: 8, speed: 3.5, tunnelSpeed: 3.0, sight: 52, thinkInterval: 0.28, aimDelay: 0.65, fireInterval: 2.8, respawn: 5, meleeDistance: 2.3, accuracyNear: 0.66, accuracyFar: 0.15, coverRadius:13, lostSightWait:1.5, holdCover:1.1, peekSeconds:1.7, advanceAfter:7, sprint:4.5, routeCrowding:20 },
  match: { tickets: 100, respawn: 5, spawnProtection: 2.5, captureRadius: 7, captureSeconds: 13, bleedInterval: 7, doubleBleed: 1, tripleBleed: 2, duration: 720 },
  graphics: { maxFPS: 60, maxPixelRatio: 1.5, fogStart: 70, fogEnd: 195, shadows: 1024 },
  stability: { audioVoices: 24, diagnosticInterval: 30 },
  terrain: { high: 2.4, centre: 1.2, lowDepth: 1.2, maxSlope: 35 },
  tactics: { northAnchorX: 40, northAnchorZ: 22, southAnchorX: 30, southAnchorZ: -38, anchorRadius: 3 },
  colors: { cn: '#8babb7', jp: '#ad6958', neutral: '#aaa793' },
} as const;
export type Team = 'cn' | 'jp';
export const enemyTeam = (team: Team): Team => team === 'cn' ? 'jp' : 'cn';
