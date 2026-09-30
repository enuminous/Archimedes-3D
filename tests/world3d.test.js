const test=require('node:test'),assert=require('node:assert/strict');
const A=require('../world3d/engine3d'),V=require('../world3d/renderer'),{Controller}=require('../world3d/controller');
test('3D seeds replay identically; all spatial coordinates evolve',()=>{
  const a=A.createWorld('repeat'),b=A.createWorld('repeat');assert.deepEqual(a,b);assert.notDeepEqual(a,A.createWorld('other'));
  const w=A.step(a,80);assert.deepEqual(w,A.step(A.step(b,35),45));
  for(let i=0;i<3;i++)assert(w.agents.some((x,j)=>Math.abs(x.p[i]-a.agents[j].p[i])>.1));assert(A.validateWorld(w));
});
test('six-neighbor volumetric diffusion transfers an impulse in every spatial direction',()=>{
  const w=A.createWorld();w.sourceOn=false;w.field.fill(0);const c=[8,3,6];w.field[A.index(...c)]=.5;
  const next=A.step(w),values=next.field.filter(v=>v>0);assert.equal(values.length,7);
  for(let axis=0;axis<3;axis++)for(const direction of[-1,1]){const q=c.slice();q[axis]+=direction;assert(next.field[A.index(...q)]>0);}
  assert(Math.abs(next.field.reduce((a,b)=>a+b)-.5*(1-.055*A.DT))<1e-12);
});
test('reflecting boundary conserves diffusion mass apart from declared decay',()=>{
  const w=A.createWorld();w.sourceOn=false;w.field.fill(0);w.field[0]=.8;const n=A.step(w);
  assert(Math.abs(n.field.reduce((a,b)=>a+b)-.8*(1-.055*A.DT))<1e-12);
});
test('uniform field follows exact one-step decay with source disabled',()=>{
  const w=A.createWorld();w.field.fill(.4);w.sourceOn=false;const n=A.step(w);assert(n.field.every(v=>Math.abs(v-.4*(1-.0055))<1e-12));
});
test('declared parameter extremes remain bounded through interventions',()=>{
  for(const coupling of[0,2]){let w=A.createWorld('stress',{coupling,learning:5,diffusion:1,noise:.15,sensorEvery:20});for(let i=0;i<4;i++){w=A.step(A.intervene(A.intervene(w,'pulse'),'blackout'),125);assert(A.validateWorld(w));}}
});
test('blind field observations are held while actual state continues to change',()=>{
  let w=A.step(A.createWorld(),5);const prior=w.agents.map(a=>a.sensed);w=A.step(A.intervene(A.intervene(w,'pulse'),'blackout'),40);
  assert.deepEqual(w.agents.map(a=>a.sensed),prior);assert.equal(w.blackout,40);assert(w.agents.some(a=>Math.abs(A.sample(w,a.p)-a.sensed)>.01));
});
test('three-dimensional sphere-box collisions eject an interior body',()=>{
  let w=A.createWorld();w.agents[0].p=[8.5,1.6,4.5];w=A.step(w);assert(A.validateWorld(w));assert(w.collisions>0);
});
test('gravity probes fall, rebound and remain outside solids',()=>{
  let w=A.intervene(A.createWorld(),'probe');const y=w.probes[0].p[1];w=A.step(w);assert(w.probes[0].p[1]<y);let rebound=false;
  for(let i=0;i<80;i++){w=A.step(w);if(w.probes[0].v[1]>1)rebound=true;assert(A.validateWorld(w));}assert(rebound);assert(w.collisions>0);
});
test('memory-coupling ablation changes the trajectory',()=>{
  const a=A.createWorld('ablate');const b=A.setParameters(a,{coupling:0});assert.notDeepEqual(A.step(a,180).agents.map(a=>a.p),A.step(b,180).agents.map(a=>a.p));
});
test('bounded planner isolates hypothetical state and returns actual 3D paths',()=>{
  const w=A.step(A.createWorld(),20),before=A.checksum(w),p=A.plan(w);assert.equal(A.checksum(w),before);assert.equal(p.evaluated,28);assert.equal(p.simulatedTicks,560);assert.equal(p.candidates.length,3);
  for(const c of p.candidates){assert.equal(c.sequence.length,3);assert.equal(c.trails.length,3);assert(c.trails.every(t=>t.length===61&&t.every(p=>p.length===3)));}
});
test('paired source intervention leaves original unchanged and has measurable effects',()=>{
  const w=A.setAction(A.createWorld(),'recharge'),before=A.checksum(w),r=A.counterfactual(w);assert.equal(A.checksum(w),before);assert.notEqual(r.factual.energy,r.alternate.energy);
});
test('restore and JSON round-trip replay full future including random sensors and probes',()=>{
  let s=A.createSession('roundtrip');s.world=A.step(A.intervene(s.world,'probe'),20);s=A.checkpoint(s,'Probe');const saved=A.exportSession(s);s.world=A.step(s.world,10);s=A.restore(s,1);
  const t=A.importSession(saved);assert.deepEqual(A.step(s.world,80),A.step(t.world,80));
});
test('restored checkpoints form distinct children and pruning retains a valid DAG',()=>{
  let s=A.createSession();s.world=A.step(s.world,5);s=A.checkpoint(s,'A');s=A.restore(s,0);s.world=A.intervene(s.world,'pulse');s=A.checkpoint(s,'B');assert.equal(s.history[1].parent,0);assert.equal(s.history[2].parent,0);
  for(let i=0;i<38;i++)s=A.checkpoint(s,'Extra');assert.equal(s.history.length,32);assert.deepEqual(A.importSession(A.exportSession(s)),s);
});
test('imports reject legacy formats, invalid geometry and malformed histories',()=>{
  const s=A.createSession(),bad=[()=>'{"format":"archimedes-session"}',()=>{const q=A.clone(s);q.world.agents[0].p[1]=20;return A.exportSession(q);},()=>{const q=A.clone(s);q.history[0].parent=0;return A.exportSession(q);},()=>{const q=A.clone(s);q.world.field[0]=null;return A.exportSession(q);},()=>'{"__proto__":{},"format":"archimedes-world3d"}'];for(const f of bad)assert.throws(()=>A.importSession(f()));
});
test('failed controller mutations and imports leave current session intact',()=>{
  const c=new Controller();for(let i=0;i<24;i++)c.intervention('probe');const before=c.export();assert.throws(()=>c.intervention('probe'));assert.equal(c.export(),before);assert.throws(()=>c.import('{}'));assert.equal(c.export(),before);
});
test('controller invalidates stale future and preserves live work before rewind',()=>{
  const c=new Controller();c.explore({depth:1});const action=c.forecast.candidates[0].sequence[0];assert.equal(c.applyCandidate(),action);c.explore({depth:1});c.advance();assert.throws(()=>c.applyCandidate());c.restore(0);assert.equal(c.world.tick,0);assert(c.session.history.some(n=>n.label==='Before rewind'&&n.world.tick===1));
});
test('camera projection is finite, centered and rejects points behind it',()=>{
  const m=V.multiply(V.perspective(Math.PI/3,1,.1,100),V.lookAt([0,0,10],[0,0,0]));const p=V.project([0,0,0],m,800,800);assert(Math.abs(p.x-400)<1e-6);assert(Math.abs(p.y-400)<1e-6);assert.equal(V.project([0,0,12],m,800,800),null);
});
test('render geometry is finite and creation cannot mutate simulation state',()=>{
  const w=A.step(A.createWorld(),30),before=A.checksum(w);for(const g of[V.staticScene(A),V.dynamicScene(A,w,{field:true,beliefs:true,targets:true})]){assert.equal(g.tri.length%27,0);assert.equal(g.lines.length%18,0);assert(g.tri.every(Number.isFinite));assert(g.lines.every(Number.isFinite));}assert.equal(A.checksum(w),before);
});
