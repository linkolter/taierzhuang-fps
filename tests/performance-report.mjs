import fs from 'node:fs';import assert from 'node:assert/strict';import crypto from 'node:crypto';
const dir='test-results/performance',read=n=>JSON.parse(fs.readFileSync(`${dir}/${n}.json`));
const before=read('before'),after=read('after-medium'),low=read('after-low'),high=read('after-high'),soak=read('soak-medium-15min'),audio=read('audio');
for(const r of [before,after,low,high,soak])assert.equal(r.running,false,'refuse to publish incomplete measurements');
assert.ok(soak.seconds>=900);assert.deepEqual(soak.errors,[]);
const manifest=read('source-manifest');for(const [path,hash] of Object.entries(manifest))assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path)).digest('hex'),hash,`source changed during soak: ${path}`);
const frames=r=>r.samples.reduce((n,s)=>n+s.frames,0),weighted=(r,get)=>r.samples.reduce((n,s)=>n+get(s)*s.frames,0)/frames(r),num=(x,n=3)=>x.toFixed(n),mb=x=>x/1048576;
const metric=(r,k,mode='selfMsPerFrame')=>weighted(r,s=>s.metrics[k]?.[mode]??0);
const peak=(r,get)=>Math.max(...r.samples.map(get));
const gpuMean=r=>r.samples.reduce((n,s)=>n+(s.gpu?.mean??0)*s.gpuSamples,0)/r.samples.reduce((n,s)=>n+s.gpuSamples,0);
const early=soak.samples.slice(2,7),late=soak.samples.slice(-5),mean=(a,get)=>a.reduce((n,s)=>n+get(s),0)/a.length;
const fpsChange=(mean(late,s=>s.fps)/mean(early,s=>s.fps)-1)*100;
const objectKeys=['meshes','materials','textures','lights','transformNodes','ai','effectPool','shellPool','smokePool'];
for(const k of objectKeys)assert.ok(soak.samples.every(s=>s.stats[k]===soak.initial.stats[k]));
assert.ok(soak.samples.every(s=>s.bursts.perception<=3&&s.bursts.decision<=2&&s.bursts.losActors<=5));
assert.ok(fpsChange>=-5);assert.ok(soak.gc.at(-1).heap-soak.gc[0].heap<8*1048576);assert.equal(soak.final.audio.active,9);
assert.ok(soak.gc.at(-1).heap-soak.gc.find(s=>s.elapsed>=480).heap<=2*1048576,'retained heap must plateau after cache warmup');
const names=Object.keys(before.samples[0].metrics).sort((a,b)=>metric(before,b)-metric(before,a));
const hitch=soak.samples.reduce((a,b)=>a.frame.max>b.frame.max?a:b),hitchMinute=(soak.samples.indexOf(hitch)+1)/2;
const lines=[
'## 实测结果（自动从已完成 JSON 生成）','',
`日期：2026-09-12。MEDIUM 长测 ${soak.seconds} 秒；含采样与结束清理的墙钟 ${num(soak.wallSeconds,1)} 秒，共 ${frames(soak)} 个统计帧，完成 ${soak.samples.at(-1).rounds.length} 局，自动玩家部署 ${soak.samples.at(-1).deploys} 次、尝试攻击 ${soak.samples.at(-1).shots} 次。`,'',
'### 当前热点排名与优化前后耗时','',
'下表按**优化前** exclusive ms/帧 排序，全部为同机 MEDIUM 120 秒短测。Inclusive 包含子调用，不能跨行相加；自耗时非常小的差异通常低于独立优化的可信阈值。','',
'| 模块 | 前 self ms/帧 | 后 self ms/帧 | 前 inclusive | 后 inclusive |',
'|---|---:|---:|---:|---:|',
...names.map(k=>`| ${k} | ${num(metric(before,k))} | ${num(metric(after,k))} | ${num(metric(before,k,'inclusiveMsPerFrame'))} | ${num(metric(after,k,'inclusiveMsPerFrame'))} |`),'',
`优化后热点前五：${[...names].sort((a,b)=>metric(after,b)-metric(after,a)).slice(0,5).map((k,i)=>`${i+1}. ${k} (${num(metric(after,k))} ms/帧)`).join('；')}。`,'',
`Engine 回调平均 ${num(weighted(before,s=>s.cpu.mean))} → ${num(weighted(after,s=>s.cpu.mean))} ms/帧；主线程任务平均 ${num(weighted(before,s=>s.mainThreadMsPerFrame))} → ${num(weighted(after,s=>s.mainThreadMsPerFrame))} ms/帧。调度改动的确定收益是同帧感知峰值 ${peak(before,s=>s.bursts.perception)} → ${peak(after,s=>s.bursts.perception)}、战术决定 ${peak(before,s=>s.bursts.decision)} → ${peak(after,s=>s.bursts.decision)}；没有为了降低平均耗时而减少 AI 或取消安全射线。`,'',
'音频独立对照（单次 rifle voice，无空间 Panner；每格 400 次有效样本）：','',
'| 混合值 | 前 mean ms | 后 mean ms | 前 P95 ms | 后 P95 ms | 节点/voice 前→后 |',
'|---|---:|---:|---:|---:|---:|',
...audio.timings.map(r=>`| ${r.mix} | ${num(r.before.meanMs)} | ${num(r.after.meanMs)} | ${num(r.before.p95Ms)} | ${num(r.after.p95Ms)} | ${r.before.nodesPerVoice} → ${r.after.nodesPerVoice} |`),'',
`波形最大逐样本误差 ${Math.max(...audio.equivalence.map(r=>r.maxError)).toExponential(3)}。过渡状态保留原节点，耗时未改善，不能宣称所有声音都少 3 个节点。`,'',
'### 三档实测','',
'| 档位 / 时长 | 内部分辨率 | FPS | Engine CPU mean ms | 主线程 mean ms/帧 | GPU mean ms | 最差窗口 GPU P95 ms |',
'|---|---|---:|---:|---:|---:|---:|',
...[low,soak,high].map(r=>`| ${r.quality} / ${r.seconds}s | ${r.initial.render.join('×')} | ${num(frames(r)/r.samples.reduce((n,s)=>n+s.seconds,0),2)} | ${num(weighted(r,s=>s.cpu.mean))} | ${num(weighted(r,s=>s.mainThreadMsPerFrame))} | ${num(gpuMean(r))} | ${num(peak(r,s=>s.gpu?.p95??0))} |`),'',
'三档运行时长及战斗状态不同，这张表验证档位生效及实测余量，不是固定相机像素吞吐率基准。LOW/HIGH 只做短测，15 分钟稳定性结论仅属于 MEDIUM。','',
'### 15 分钟 soak','',
`第 3–7 窗口与最后 5 窗口 FPS：${num(mean(early,s=>s.fps),3)} → ${num(mean(late,s=>s.fps),3)}，变化 ${num(fpsChange,3)}%。30 秒窗口 FPS 范围 ${num(Math.min(...soak.samples.map(s=>s.fps)),3)}–${num(peak(soak,s=>s.fps),3)}。最差窗口帧间隔 P95 ${num(peak(soak,s=>s.frame.p95))} ms、P99 ${num(peak(soak,s=>s.frame.p99))} ms；最大单帧间隔 ${num(peak(soak,s=>s.frame.max))} ms。`,'',
`保留的异常：最大帧间隔出现在第 ${hitchMinute} 分钟窗口，该窗 Engine 回调最大 ${num(hitch.cpu.max)} ms，尚无 trace 能确定这次间隔长峰的来源，不能把它直接归因于游戏 CPU 或 GC。GPU 后段窗口均值也高于前段，但仍低于预算。结论是未见持续帧率衰退，不是保证绝无瞬时卡顿；此次不凭猜测追加优化。`,'',
'| 分钟 | FPS | Engine CPU mean / P95 ms | 主线程 ms/帧 | GPU mean ms | 采样堆 MiB | 活动音频节点 |',
'|---|---:|---:|---:|---:|---:|---:|',
...soak.samples.map((s,i)=>`| ${(i+1)/2} | ${num(s.fps,2)} | ${num(s.cpu.mean)} / ${num(s.cpu.p95)} | ${num(s.mainThreadMsPerFrame)} | ${num(s.gpu?.mean??0)} | ${num(mb(s.heap),2)} | ${s.audio.active} |`),'',
'GC 后的存活堆与缓存：','',
'| 秒 | GC 后 MiB | 路径缓存条目 | 复用工作区 |',
'|---|---:|---:|---:|',
...soak.gc.map(s=>`| ${s.elapsed} | ${num(mb(s.heap),3)} | ${s.routeCache} | ${s.routeScratch} |`),'',
`120 秒到结束存活堆变化 ${num(mb(soak.gc.at(-1).heap-soak.gc[0].heap))} MiB；后半程首末变化 ${num(mb(soak.gc.at(-1).heap-soak.gc.find(s=>s.elapsed>=480).heap))} MiB。结束暂停、声音自然完成及 GC 后 ${num(mb(soak.final.heap))} MiB。缓存暖机增长有明确 512 条上限，表中可检查平台期；该结果排除本次时长内明显持续泄漏，不宣称无限时长证明。`,'',
'| 对象 | 实测 / 不变量 |',
'|---|---|',
...objectKeys.map(k=>`| ${k} | ${soak.initial.stats[k]}，所有采样及结束一致 |`),
`| 原生 ParticleSystem | ${soak.final.stats.particles}；白盒烟雾/闪光使用上表的固定网格池 |`,
`| 活动 FX / 弹壳采样峰值 | ${peak(soak,s=>s.stats.activeEffects)} / ${peak(soak,s=>s.stats.activeShells)}（上限 28 / 24） |`,
`| voice 采样峰值 | ${peak(soak,s=>s.stats.audioVoices)}；运行时硬上限 24；结束 0 |`,
`| AudioNode 全程峰值 / 结束 | ${soak.final.audio.peak} / ${soak.final.audio.active}；理论最坏 9 + 24×13 = 321 |`,
`| 全程新建 AudioNode | ${soak.final.audio.created}；累计创建数会增长，活动数受 voice 生命周期约束 |`,
`| AI 感知 / 战术 / LOS actor 同帧峰值 | ${peak(soak,s=>s.bursts.perception)} / ${peak(soak,s=>s.bursts.decision)} / ${peak(soak,s=>s.bursts.losActors)} |`,
`| 调度最久等待 | ${soak.final.scheduler.peak.waitFrames} 帧（本次实测）；合成全饱和 16 actor 测试保证无饥饿，服务间隔 ≤16 帧 |`,
`| 浏览器错误 | ${soak.errors.length} |`,'',
'### 后续可接受的性能预算','',
'以下作为同机、1080p MEDIUM 白盒的回归门槛；换硬件或增加资产必须重新测量，不能直接沿用 RTX 5080 的余量。','',
'| 项目 | 建议预算 / 硬约束 |',
'|---|---|',
'| 帧率 / 帧间隔 | 目标 60 FPS / 16.67 ms；末段平均 FPS 相对早段下降不超过 5%；30 秒窗口 P95 间隔 ≤18 ms |',
'| 主线程任务 | 平均 ≤4 ms/帧；Engine 回调 P95 ≤6 ms，P99 ≤8 ms（偶发主动 GC 单独标注） |',
'| 渲染 | CPU 提交平均 ≤2.5 ms/帧；GPU P95 ≤8 ms，留出后续系统余量 |',
'| AI | Bot.update inclusive 平均 ≤0.5 ms/帧；感知 3 / 战术 2 / 开火检查 3 / 共用 actor 5 的逐帧上限不得回退 |',
'| 路线 | 保留 2 ms 协作预算、64 扩展让出、1 活动请求；缓存 ≤512、复用工作区 ≤1；局部战术搜索仍最多 320 扩展 |',
'| 碰撞 / LOS | exclusive 平均分别 ≤0.2 / 0.1 ms/帧；保持全部碰撞与射击安全检查 |',
'| 音频 | 创建平均 ≤0.15 ms/帧；voice ≤24，活动节点理论上限 321，停止声音后回到 9 |',
'| 粒子 / 弹壳 | 池上限 28 / 8 / 24；更新 inclusive 合计平均 ≤0.1 ms/帧，不随回合增加 |',
'| 堆 / 对象 | 缓存饱和后的 GC 堆应进入平台，后 5 分钟净增长 ≤2 MiB；15 分钟相对首次周期 GC 净增长 <8 MiB；场景/AI/固定池数量严格不变 |','',
'本轮到此结束，不进入模型、美术、地图或 AI 架构重构。',
];
const text=lines.join('\n')+'\n',path='docs/PERFORMANCE_BASELINE.md',original=fs.readFileSync(path,'utf8').split('## 实测结果（自动从已完成 JSON 生成）')[0];fs.writeFileSync(path,original+'\n'+text);
const evidence='docs/performance-data/2026-09-12';fs.mkdirSync(evidence,{recursive:true});for(const label of ['before','after-medium','after-low','after-high','soak-medium-15min','audio','source-manifest'])fs.copyFileSync(`${dir}/${label}.json`,`${evidence}/${label}.json`);
const summary={fps:frames(soak)/soak.samples.reduce((n,s)=>n+s.seconds,0),fpsChange,cpuBefore:weighted(before,s=>s.mainThreadMsPerFrame),cpuAfter:weighted(after,s=>s.mainThreadMsPerFrame),soakCPU:weighted(soak,s=>s.mainThreadMsPerFrame),gpu:gpuMean(soak),gc:soak.gc.map(s=>({seconds:s.elapsed,heapMB:mb(s.heap),cache:s.routeCache})),finalAudioNodes:soak.final.audio.active,peakAudioNodes:soak.final.audio.peak,errors:soak.errors};fs.writeFileSync(`${dir}/summary.json`,JSON.stringify(summary,null,2));console.log(JSON.stringify(summary));
