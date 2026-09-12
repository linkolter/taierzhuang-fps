import fs from 'node:fs';
const source=JSON.parse(fs.readFileSync('test-results/battlefield-soak.json','utf8'));
const last=source.samples.at(-1),mean=a=>a.reduce((s,x)=>s+x,0)/(a.length||1);
const summary={complete:!source.running&&!source.accelerated&&last.matches.length===2,wallSeconds:source.wallSeconds,browser:source.browser,cpu:source.cpu,
  rounds:last.matches.map(m=>({seconds:m.seconds,winner:m.winner,tickets:m.tickets,deaths:m.deaths,bleed:{cn:100-m.tickets.cn-m.deaths.cn,jp:100-m.tickets.jp-m.deaths.jp},player:m.player,deployments:m.deploys,
    ownership:Object.fromEntries(['A','B','C'].map(id=>[id,m.changes.filter(c=>c.id===id)])),maxAssignedPerPoint:Math.max(...m.assignments.flatMap(a=>a.teams.flatMap(t=>t.points.map(p=>p.count)))),maxPhysicalPerTeamAtPoint:Math.max(...m.assignments.flatMap(a=>a.teams.flatMap(t=>t.points.map(p=>p.near))))})),
  frontlineDeploys:last.frontline,suppressedCandidatesAtDeployment:last.suppressed,pressureMax:last.pressureMax,
  cpuMean:mean(source.samples.map(s=>s.cpu.mean)),cpuP95WindowMean:mean(source.samples.map(s=>s.cpu.p95)),cpuP99WindowMean:mean(source.samples.map(s=>s.cpu.p99)),
  cpuEarly:mean(source.samples.slice(2,7).map(s=>s.cpu.mean)),cpuLate:mean(source.samples.slice(-6,-1).map(s=>s.cpu.mean)),
  averageFPS:mean(source.samples.map(s=>s.stats.fps)),stablePools:source.stablePools,postGCHeapDeltaMB:source.postGCHeapDeltaMB,
  final:source.final?.stats,errors:source.errors,sounds:last.sounds,
  timingStrict: last.matches.every(m=>m.seconds>=480&&m.seconds<=900)};
fs.writeFileSync('test-results/battlefield-summary.json',JSON.stringify(summary,null,2));
console.log(JSON.stringify(summary,null,2));
