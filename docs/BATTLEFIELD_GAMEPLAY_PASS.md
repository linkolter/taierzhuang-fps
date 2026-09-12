# Combat Map V3 · Battlefield-style Gameplay Pass

## Scope and ECC onboarding

This pass uses ECC `codebase-onboarding`. The starting checkout was `main` at `d9c6e6e`, with uncommitted V3 whitebox changes. They were carried to `battlefield-gameplay-pass`; no main commit, map layout, building, character model, collision mesh, or route graph was changed by this gameplay pass.

Baseline: production build and all 33 existing unit tests passed. On this Windows host `tsx` initially failed inside the restricted process environment (`uv_os_get_passwd ENOMEM`); the same tests passed outside that restriction without changing dependencies. Read handoffs: `COMBAT_MAP_V3_BLOCKOUT.md`, `COMBAT_FEEDBACK.md`, `COMBAT_FEEDBACK_VALIDATION.md`, `IRONHOLD_REFERENCE.md`.

### Architecture / dependencies

`main → Game → World / Player / Weapon / Bot / Combat / CaptureSystem / Match / HUD / AudioSystem`

- `World → MapLayout + Terrain + static indexes + TacticalRouteGraph + RoutePlanningScheduler`; existing layout and movement infrastructure remains authoritative.
- `Combat → damage → ScoreSystem + Match.death + death presentation`; charge a ticket exactly at death, never again at deployment.
- `CaptureSystem → owner/progress/presence → Match bleed, SpawnSystem, StrategicDirector, HUD`; explicit derived states are NEUTRAL / CHINESE / JAPANESE / CONTESTED.
- `SpawnSystem → World standability/LOS + capture ownership + live actor positions → death selection → Game.deploy → Player.respawn + Weapon.reset`.
- `StrategicDirector → Bot strategic objective and ATTACK/DEFEND/FLANK → existing scheduler and local combat`; PlayerPressureDirector continues to cap precise pressure against the player.
- `TunnelEnvironment → local surface depth + ramp/tunnel volume → Game lighting/fog/exposure + AudioSystem blend`.
- `Weapon + Bot → shared bolt/reload event timeline → finite audio voices`; `FootstepTracker → moved distance → surface sound`.
- `PlayerStuckRecovery → validated grounded safe position → small displacement, then safe-position restore`.

### Implementation sequence and risks

Independent rules first, then Game wiring and HUD, then regression and full rounds. Main risks were death pointer-unlock pausing combat, invalid whitebox spawn/AI capture positions, runaway concentration at one objective, and old surface tags removed by V3. Each was addressed in rule logic or point selection; no wall, tunnel wall, ramp seam or stair was adjusted.

## Gameplay and numeric rules

### Death and deployment

- Death releases pointer capture and keeps the battle running. The screen shows killer/weapon/headshot cause, both ticket totals, player K/D and score, and a north-up BASE/A/B/C schematic.
- Five-second readiness countdown. No automatic player respawn. Choose a point and click **部署**; if pointer capture fails, the regular resume menu is available.
- BASE remains a rule-protected rear court. Forward deployment requires friendly ownership, full progress and no contest. All unsafe anchors show **出生点受压制**. UI reevaluates every 0.4 s; actual deployment performs a fresh synchronous check.
- Each A/B/C has five WEST/EAST/REAR/SIDE/FLANK anchors, all verified standing positions off the capture center. No added geometry. Offsets in metres from each existing objective:

| Point | WEST | EAST | REAR | SIDE | FLANK |
|---|---|---|---|---|---|
| A | -8,0 | 8,0 | 0,6 | -6,-4 | 6,4 |
| B | -8,-2 | 8,0 | 0,6 | -6,-6 | 8,6 |
| C | -8,0 | 8,0 | 0,6 | -6,-4 | 6,4 |

- Reject occupied positions (<1 m), invalid standing spaces, open shafts, enemy-owned capture zones, enemies <13 m away, or unobstructed enemy chest-to-spawn sight within 55 m. Rank remaining anchors by nearest enemy distance. No explosives exist, so no projectile danger model was added.
- New deployment protection: **1.8 s**, canceled by an actual rifle shot or melee attack. The base court (8 m either side of team spawn X, ±5 m Z, within 2 m vertical) rejects damage both into and out of that team's court; no invulnerable firing out of base. HUD says to leave the court before fighting.
- Optional squad deployment was deferred: safe buddy spawning needs reliable recent-combat/damage and narrow-portal filtering. Point spawning takes priority.

### Capture and tickets

- A/B/C keep their V3 positions and heights. Radius **7 m**, vertical tolerance **1.1 m**; underground soldiers cannot capture through the surface.
- Neutral to full control: **13 s** for one soldier. Two soldiers: **1.25×** speed. Three or more: **1.5×** cap. Both teams present means CONTESTED and zero progress change.
- Enemy ownership must be neutralized before taking the point; signed progress traverses the neutral midpoint.
- **100 tickets per side**. Each soldier death costs **1**; respawn costs zero additional tickets.
- Every **14 s**, holding two points drains **1** opposing ticket; holding all three drains **2**. One point produces no bleed. Ownership remains with the defender until neutralization.
- Original 12-minute time limit remains: unequal tickets resolve the round; tied tickets enter overtime until a ticket advantage appears. Zero tickets ends immediately. Explicit **再来一局** resets scores, feed, objectives, tickets, cooldowns, sounds and strategic assignments.
- The original seven-second bleed produced 5–6 minute accelerated rounds. Fourteen seconds plus ordinary aim/re-aim timing reached the intended range in subsequent pilot rounds. There is no artificial minimum-round timer or invulnerability added to force a duration.

### HUD and score

- Muted blue China, muted red Japan, grey neutral, yellow/flashing contested. World labels show objective distance and ownership.
- Kill feed holds at most **5** entries, remains for **7 s**, fades over its final 2 s, and highlights player kills.
- Kill **+100**, recent damage assist **+50** (last 10 s), primary capture contributor **+200**, other participating contributors **+100**, defensive kill in a friendly point **+50 extra**.
- Capture participation time determines the primary contributor. Team rows keep Kills/Deaths/Score; holding Tab shows all 16 soldiers and highlights the player.
- Round end shows winner, final tickets, K/D, score, captures, defenses, assists and elapsed time. No upgrades, unlocks, currency, ping or classes. No preexisting accuracy statistic was present, so the result screen does not claim an accuracy percentage.

### Strategic AI

- Every **1.5 s**, allocate live soldiers across A/B/C. Attacked friendly points receive priority, then enemy/neutral points; occupancy penalties and assignment hysteresis retain distribution without per-frame replanning.
- Assignment cap is `ceil(live team bots / 3) + 1`, normally at most 4 per point. Brief changes between allocation ticks can occur after deaths/respawns.
- ATTACK / DEFEND / FLANK are behavior labels, not classes. FLANK discourages the main route; all existing main/north/south/tunnel routes remain available.
- Strategic point overrides the old nearest-score choice. Capture destinations are selected from valid standing positions, avoiding B's portal. No topology or collision tuning.
- Distant enemies outside the assigned objective area are ignored until locally relevant (within 18 m or within 16 m of the objective). Existing local combat and reaction delays remain. The original pressure director permits at most 3 precise enemy attackers against the player.

### Audio and environment

- Existing synthesized rifle, bolt, shell, impact and melee sounds are retained. Player and AI reload now share six normalized events: open .08, clip .26, press .43/.62, feed .78, close .92 across the existing **3.2 s** reload. Player bolt pose opens/closes at the corresponding event boundaries.
- Steps use actual horizontal distance; walk stride **1.65 m**, sprint **1.9 m**, crouch **1.25 m**. No resting or airborne step-distance accumulation. Existing material tags have priority; temporary V3 regions provide stone near A/B and wood near C, with earth elsewhere and tunnel underground.
- Environment states: **SURFACE / PORTAL / TUNNEL**. `depth = local surfaceY - actorY`; <=.15 m is always surface. Beyond that, ramp/tunnel volume membership and floor/ceiling bounds are required. Smoothstep over the following 2.2 m, followed by a time smoothing factor, creates `tunnelBlend`.
- Ambient/hemispheric light, sun, nearest existing lamp, fog range/color, exposure and sound buses blend continuously. Tunnel bus has short **280 ms** reverb and low-pass filtering. Each finite voice crossfades surface/tunnel buses; ambience attenuation follows listener blend. Maximum **24** voices, all disconnected at completion.
- Passing above an entrance or tunnel stays surface. This is gameplay environment logic, not a change to the whitebox geometry.

## Temporary recovery and Deferred Collision Issues

Safe-position updates require at least **0.3 s** stable grounding, standing clearance and actual proximity to the floor. Crouching/airborne/embedded locations cannot overwrite the safe position. With movement input and <.05 m/s horizontal movement for **1 s**, recovery additionally requires confirmed penetration using a slightly smaller body radius (.28 m). A normal collision-free position pressed against a wall never triggers it.

Try radial offsets of **.15 / .30 / .50 m** with valid standing clearance and <.4 m floor difference. If those fail, restore the last safe position only if it is still valid. Without a valid safe location, no arbitrary teleport is attempted. This is a fallback, not precise collision repair.

The following remain deferred to **正式地图模型 + Collision Proxy**:

| Deferred Collision Issues | Later work |
|---|---|
| Low-wall embedding / edge snagging | Replace proxy shapes for final walls and verify capsule contact |
| Tunnel side-wall seams / narrow entrance contacts | Author final tunnel collision proxies and transitions |
| Ramp joints and floor-height seams | Reconcile final ramp/floor proxy boundaries |
| Stair collision | Use final stair/ramp movement proxies and head clearance |

Do not use this pass's tests as a reason to repair individual whitebox faces. AI can still spend time replanning around existing problematic contacts; allocation is not a guarantee of physical arrival.

## Validation

- `npm run build`: passed; existing Babylon bundle-size warning remains.
- Unit/regression suite: **48 / 48 passed**, including all 33 baseline tests and 15 gameplay tests.
- `tests/battlefield-gameplay.test.ts`: selection, fresh spawn safety, all anchors, four capture states, capped speed, death/bleed accounting, score/feed/reset, protection, all seven portals, recovery false positives and fallback, shared reload timeline, step surfaces/distance, strategic cadence/distribution.
- `tests/battlefield-browser.mjs`: real pointer unlock on death, live simulation while dead, no auto-respawn, A deployment via click, Tab 16-row board, fresh contested rejection, ordered actual reload sound callbacks, round-end/restart. Local screenshots and JSON in `test-results/battlefield-*`.
- `tests/tunnel-environment-browser.mjs`: all **7 / 7** entrances passed through the actual Game update. Surface samples retain ambient .8 and blend 0; every ramp passes PORTAL and reaches TUNNEL, exposure approximately .82 and fog end approximately 45 m. Largest adjacent sampled blend change was .050; no page errors.
- Existing production smoke: passed, pointer capture works and no `window.__game` in production.
- Existing 100-reset lifecycle audit: passed, same route graph and soldier model identities; meshes/materials/textures/effect pools/transform nodes stable.
- Existing `feedback-browser.mjs`: firearm cadence, 25 bolt events for five shots, reload, ADS projection, shell recycling and audio cleanup passed. Its old fixed **8 procedural material types** assertion fails because the inherited V3 whitebox has only **2** active types. The old test is preserved; no materials were added to satisfy it.
- `tests/battlefield-soak.mjs`: original 1 player + 7 Chinese AI vs 8 Japanese AI; scripted movement and aiming, .8 s acquisition and >=2.8 s player re-aim interval. Uses real damage, respawn selection, capture and tickets, never forced kills or point ownership. `ACCELERATED=1` is a separate pilot, not a real-time performance result. The real-time run uses a frozen source copy on local port 5180 to avoid HMR during verification.

### Full two-round real-time report

2026-09-12，Chrome 153.0.8010.36，i5-12600KF，1440×900。连续真实墙钟运行 **1022.69 s**，不是加速模拟。源码逐文件 SHA-256 与冻结测试副本一致，记录在 `test-results/battlefield-source-hashes.json`。

| 项目 | 第一局 | 第二局 |
|---|---|---|
| 实际对局时长 | **7:56.01** | **8:40.23** |
| 胜方 / 最终票数（中:日） | 中国 / **60:0** | 中国 / **66:0** |
| 双方阵亡（中:日） | 40 / 58 | 34 / 60 |
| 日军优势掉票 / 阵亡掉票 | 42 / 58 | 40 / 60 |
| 玩家 K/D / Score | 20/5 / 3250 | 32/5 / 4400 |
| 玩家占领 / 防守 / 助攻 | 5 / 2 / 7 | 5 / 1 / 5 |
| 前线部署 | A 点 4 次 | A 点 1 次、B 点 4 次 |
| 同队单点战略分配采样峰值 | 4 | 4 |
| 同队单点周围 14m 实际人数采样峰值 | 4 | 4 |

- 第一局 A 中→日→中，C 多次易手，B 中立化后夺回。第二局 A 中→日，B 中→日→中，C 多次易手。两局合计 A/B/C 均发生实际双方控制权转换。
- 共 **9 次前线部署**；部署评估记录了 **5 个受压制候选**，由安全规则禁用。第一局最后一次玩家死亡发生在结算前，因此 5 次死亡对应 4 次部署。
- 票数正常降为零；第一局结束后完整重置并进入第二局。没有强制占点、强制击杀或强制时间结算。
- 平均 **60 FPS**；每帧 CPU 均值 **1.24 ms**，30 秒窗口 P95/P99 的均值 **1.91 / 2.49 ms**。热身后前段均值 **1.26 ms**，末段 **1.21 ms**，未见持续 CPU 增长。
- 全程固定 **290 meshes / 32 materials / 7 textures / 4 lights / 139 transform nodes / 15 AI**；世界 FX 28、弹壳 24、烟雾 8 的池容量不变。结束等待后活跃音频 voice 为 **0**。GC 后堆较开场增加 **11.29 MiB**，包含已热身的路线缓存和测试记录；这是有限两局观察，不是长期无泄漏证明。
- 四类脚步均被真实对局触发：earth 14568、stone 2750、wood 593、tunnel 3172；reload-open/clip/press/feed/close、弹壳、命中和两种近战事件均出现。部分序列会被死亡/结算正常中断。
- 页面错误 **0**。玩家压力分配的每 10 秒采样峰值 **2**；规则测试验证硬上限仍为 3。

**时长验收例外：** 第一局比严格 480 秒下限短 **3.99 秒**。因此 `battlefield-soak.mjs` 的严格时长断言返回非零；完整两局、功能、对象数量、音频回收结果均已保存，不能把该长测宣称为全绿。没有调宽测试阈值或人为延长回合来隐藏该结果；后续如需保证更保守的平均时长，应在更多对局样本上继续调票数节奏。

原始结果：`test-results/battlefield-soak.json`；汇总：`test-results/battlefield-summary.json`，由 `node scripts/report-battlefield.mjs` 生成。测试报告和截图按项目既有规则由 git 忽略。

## Known limits

- Whitebox spawn and footstep regions will need remapping when the final map assets arrive.
- AI keeps the old movement/collision system; this pass improves allocation and valid destination selection, not navigation fidelity.
- Audio remains procedural synthesis rather than recorded historical Foley.
- Match duration and win balance depend on player behavior; two automated rounds do not establish competitive balance.
- No buddy spawns, characters, new weapons, vehicles, grenades, multiplayer, destruction or map-art follow-up were added.
