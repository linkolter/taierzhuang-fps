export type PlanningPriority = 0 | 1 | 2; // invalid path, birth, tactical reevaluation
type Request = { key: string; priority: PlanningPriority; run: () => Generator<void, void, void>; work?: Generator<void, void, void>; queuedAt: number };

/** One active search, at most one completed request per frame. A* yields every 64 expansions. */
export class RoutePlanningScheduler {
  private requests = new Map<string, Request>();
  private active?: Request;
  completed = 0;
  maxCompletedPerFrame = 0;
  lastMs = 0;
  maxMs = 0;
  maxWaitMs = 0;
  constructor(public budgetMs = 2, private now = () => performance.now()) {}
  get pending() { return this.requests.size; }
  has(key: string) { return this.requests.has(key); }
  enqueue(key: string, priority: PlanningPriority, run: Request['run']) {
    const existing = this.requests.get(key);
    if (existing) { existing.priority = Math.min(existing.priority, priority) as PlanningPriority; return; }
    this.requests.set(key, { key, priority, run, queuedAt: this.now() });
  }
  cancel(key: string) {
    const request = this.requests.get(key);
    request?.work?.return();
    if (this.active === request) this.active = undefined;
    this.requests.delete(key);
  }
  clear() { for (const key of this.requests.keys()) this.cancel(key); }
  tick() {
    const start = this.now();
    if (!this.active) {
      for (const request of this.requests.values()) {
        if (!this.active || request.priority < this.active.priority) this.active = request;
      }
      if (this.active) {
        this.maxWaitMs = Math.max(this.maxWaitMs, start - this.active.queuedAt);
        this.active.work = this.active.run();
      }
    }
    const request = this.active;
    if (request) {
      // Step cap also bounds accelerated tests and clocks with coarse resolution.
      for (let steps = 0; steps < 32; steps++) {
        if (request.work!.next().done) {
          this.requests.delete(request.key); this.active = undefined;
          this.completed++; this.maxCompletedPerFrame = 1; break;
        }
        if (this.now() - start >= this.budgetMs) break;
      }
    }
    this.lastMs = this.now() - start; this.maxMs = Math.max(this.maxMs, this.lastMs);
  }
}
