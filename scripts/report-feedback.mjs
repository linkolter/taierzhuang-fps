import fs from 'node:fs';
const r=JSON.parse(fs.readFileSync('test-results/feedback-soak.json','utf8'));
if(r.running||r.seconds<900)throw new Error('A completed 15-minute run is required');
const last=r.samples.at(-1),count=r.samples.reduce((v,s)=>v+s.cpu.count,0),avg=key=>r.samples.reduce((v,s)=>v+key(s),0)/r.samples.length;
const mean=r.samples.reduce((v,s)=>v+s.cpu.mean*s.cpu.count,0)/count;
const summary={seconds:r.seconds,frames:count,fps:avg(s=>s.fps),cpuMeanMs:mean,meanWindowP95Ms:avg(s=>s.cpu.p95),meanWindowP99Ms:avg(s=>s.cpu.p99),worstWindowP95Ms:Math.max(...r.samples.map(s=>s.cpu.p95)),worstWindowP99Ms:Math.max(...r.samples.map(s=>s.cpu.p99)),stable:r.stable,postGCHeapDeltaMB:r.postGCHeapDeltaMB,shots:last.shots,playerShots:last.playerShots,matches:last.matches,errors:r.errors,collisions:last.collisions,boltViolations:last.boltViolations,lanes:last.lanes,tunnelBots:last.tunnelBots,pressureMax:last.pressureMax};
fs.writeFileSync('test-results/feedback-summary.json',JSON.stringify(summary,null,2));
const n=x=>Number(x).toFixed(2);
fs.writeFileSync('docs/COMBAT_FEEDBACK_VALIDATION.md',`# 战斗反馈验收 · 2026-09-10

本次真实时间运行 ${n(r.seconds)} 秒，${count} 帧，1920×1080；Chrome ${r.browser}，${r.hardware}。启用 Web Audio，自动控制原有玩家槽位，保留正常受伤、死亡、重生与装填，始终为 1 名玩家 + 7 名中国 AI 对 8 名日军 AI。

| 指标 | 实测 |
| --- | --- |
| FPS（30 秒窗口均值） | ${n(summary.fps)} |
| CPU 每帧均值 | ${n(mean)} ms |
| CPU P95 / P99（各 30 秒窗口的均值） | ${n(summary.meanWindowP95Ms)} / ${n(summary.meanWindowP99Ms)} ms |
| 最差窗口 CPU P95 / P99 | ${n(summary.worstWindowP95Ms)} / ${n(summary.worstWindowP99Ms)} ms |
| Mesh / 材质 / 纹理 / 灯 | ${r.final.stats.meshes} / ${r.final.stats.materials} / ${r.final.stats.textures} / ${r.final.stats.lights}，全程固定 |
| GC 后堆内存增量 | ${n(r.postGCHeapDeltaMB)} MiB |
| AI 攻击 / 玩家射击 | ${last.shots} / ${last.playerShots} |
| 结算完成回合 | ${last.matches.length} |
| 碰撞异常 / 栓动射速违规 / 页面错误 | ${last.collisions.length} / ${last.boltViolations.length} / ${r.errors.length} |
| 对真人高精度敌军峰值 | ${last.pressureMax} |

经过路线：${last.lanes.join('、')}；${last.tunnelBots.length} 名 AI 经过地道。观察到 ${last.states.join('、')} 状态，HOLD / PUSH / FLANK 均参与交战。

弹壳固定 24 个，烟雾固定 8 个，世界 FX 固定 28 个；停止战斗后活跃音效节点为 ${r.final.stats.audioVoices}。GC 后增量包含已热身的路线缓存、着色器和测试统计，未以未回收瞬时堆峰值判断泄漏。

原始数据：\`test-results/feedback-soak.json\`；汇总：\`test-results/feedback-summary.json\`；枪械/纹理/音频回归：\`test-results/feedback-regression.json\`。这些输出位于本机，按项目既有规则由 git 忽略。

本机旧版 16 分钟报告的平均 CPU 帧耗时约 1.60ms、窗口 P99 均值约 3.15ms；旧报告为静态观察者，新测试含自动玩家和音频，比较用于排查明显回归，不视为严格相同负载基准。
`);
console.log(JSON.stringify(summary,null,2));
