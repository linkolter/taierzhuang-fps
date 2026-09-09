import { CONFIG, enemyTeam, type Team } from '../config/gameConfig';
import type { CaptureSystem } from '../capture/CaptureSystem';
export class Match {
  tickets: Record<Team, number> = { cn: CONFIG.match.tickets, jp: CONFIG.match.tickets };
  elapsed = 0; bleedClock = 0; winner: Team | null = null; deaths = { cn: 0, jp: 0 }; reason = '';
  reset() { this.tickets = { cn: CONFIG.match.tickets, jp: CONFIG.match.tickets }; this.elapsed = 0; this.bleedClock = 0; this.winner = null; this.deaths = { cn: 0, jp: 0 }; this.reason = ''; }
  death(team: Team) { if (this.winner) return; this.deaths[team]++; this.tickets[team] = Math.max(0, this.tickets[team] - 1); this.check(); }
  update(dt: number, capture: CaptureSystem) {
    if (this.winner) return; this.elapsed += dt; this.bleedClock += dt;
    while (this.bleedClock >= CONFIG.match.bleedInterval) {
      this.bleedClock -= CONFIG.match.bleedInterval;
      for (const team of ['cn', 'jp'] as Team[]) { const count = capture.controlled(team); if (count >= 2) this.tickets[enemyTeam(team)] = Math.max(0, this.tickets[enemyTeam(team)] - (count === 3 ? CONFIG.match.tripleBleed : CONFIG.match.doubleBleed)); }
    }
    this.check();
    if (!this.winner && this.elapsed >= CONFIG.match.duration && this.tickets.cn !== this.tickets.jp) { this.winner = this.tickets.cn > this.tickets.jp ? 'cn' : 'jp'; this.reason = '作战时间结束 · 剩余兵力占优'; }
  }
  check() { if (this.winner) return; if (this.tickets.cn <= 0) this.winner = 'jp'; else if (this.tickets.jp <= 0) this.winner = 'cn'; if (this.winner) this.reason = '敌方兵力耗尽'; }
}
