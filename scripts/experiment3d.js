'use strict';
const A=require('../world3d/engine3d'),fs=require('node:fs'),path=require('node:path');
const runs=[];
for(const seed of['3D-CHECK-001','3D-CHECK-002','3D-CHECK-003','3D-CHECK-004'])for(const coupling of[0,.8])for(const action of['survey','recharge']){
  let w=A.setAction(A.createWorld(seed,{coupling}),action);const start=performance.now();
  w=A.step(w,100);w=A.intervene(w,'pulse');w=A.step(w,60);w=A.intervene(w,'blackout');w=A.step(w,240);A.validateWorld(w);
  runs.push({seed,coupling,action,ticks:w.tick,metrics:A.metrics(w),collisions:w.collisions,checksum:A.checksum(w),elapsedMs:performance.now()-start});
}
const root=path.resolve(__dirname,'..'),result={version:A.VERSION,node:process.version,kind:'developmental synthetic comparison; not a confirmatory study',schedule:'400 ticks; pulse at 100; sensor blackout at 160',runs};
fs.writeFileSync(path.join(root,'results/world3d-experiment.json'),JSON.stringify(result,null,2)+'\n');
let md='# 3D developmental comparison\n\nSixteen declared synthetic runs; four seeds × two coupling settings × two fixed intentions. Pulse at tick 100; blackout at tick 160; stop at tick 400. These are model diagnostics, not external evidence or a claim that one policy is best. Timing is a single-run local measurement, not a controlled hardware benchmark.\n\n| Seed | Coupling | Intention | Final energy | Coherence | Coverage | Checksum |\n| --- | ---: | --- | ---: | ---: | ---: | --- |\n';
for(const r of runs)md+=`| ${r.seed} | ${r.coupling} | ${r.action} | ${r.metrics.energy.toFixed(6)} | ${r.metrics.C.toFixed(6)} | ${r.metrics.coverage.toFixed(6)} | ${r.checksum} |\n`;
fs.writeFileSync(path.join(root,'results/WORLD3D-EXPERIMENT.md'),md);
let s=A.createSession('ARCHIMEDES-3D-EXAMPLE');s.world=A.step(s.world,60);s=A.checkpoint(s,'Before pulse');s.world=A.intervene(s.world,'pulse');s.world=A.step(s.world,20);s=A.checkpoint(s,'After pulse');s.world=A.intervene(s.world,'probe');s=A.checkpoint(s,'Probe released');
fs.writeFileSync(path.join(root,'examples/world3d-pulse-and-probe.json'),A.exportSession(s));
console.log(`${runs.length} synthetic runs completed; all resulting worlds validated.`);
