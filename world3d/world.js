(function(){
  'use strict';
  const A=window.Archimedes3D,V=window.ArchimedesView,$=id=>document.getElementById(id);
  const ctl=new window.ArchimedesController.Controller('ARCHIMEDES-3D-001');
  const STORAGE='archimedes-world3d-0.2',colors=['#c5f776','#57d1f0','#ffa363'];
  let selected=0,renderer=null,busy=false,revision=0,accumulator=0,last=performance.now(),lastDraw=0,lastUI=0,lastSaveTick=0;
  let options={field:true,fieldMode:'volume',slice:2,trails:true,beliefs:true,targets:false,selected:0,ghosts:null};
  function status(text,error=false){$('status').textContent=text;$('status').classList.toggle('error',error);}
  function persist(){try{localStorage.setItem(STORAGE,ctl.export());return true;}catch{return false;}}
  try{const saved=localStorage.getItem(STORAGE);if(saved){ctl.import(saved);status('Previous 3D session restored. The world is paused.');}}catch{status('The previous browser save could not be loaded. A fresh world is ready; you can import an exported session.',true);}
  function invalidate(){revision++;options.ghosts=null;accumulator=0;lastSaveTick=ctl.world.tick;}
  function guarded(fn,message){try{fn();invalidate();refresh(true);persist();if(message)status(message);}catch(e){status(e.message,true);}}
  function button(id,fn,message){$(id).addEventListener('click',()=>guarded(fn,message));}
  function select(id){selected=id;options.selected=id;refresh(false);}
  try{renderer=new V.Renderer($('world'),A,select,(message)=>{ctl.running=false;status(message);refresh(false);});}
  catch(e){$('graphics-error').hidden=false;$('graphics-error').textContent=e.message;status('The simulation controls remain available. The 3D view needs WebGL.',true);}
  const agentLabels=['Surveying the volume','Holding at a station','Exchanging stations','Returning to source'];
  function updateSpark(){
    const canvas=$('spark'),ctx=canvas.getContext('2d');if(!ctx)return;
    const width=Math.max(120,canvas.getBoundingClientRect().width),height=64,dpr=Math.min(window.devicePixelRatio||1,2);
    if(canvas.width!==Math.round(width*dpr)||canvas.height!==height*dpr){canvas.width=Math.round(width*dpr);canvas.height=height*dpr;}
    ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,width,height);
    ctx.strokeStyle='#233c45';ctx.lineWidth=1;for(const y of[7,31,56]){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(width,y);ctx.stroke();}
    const traces=ctl.world.traces;
    for(const [key,color]of[['C',colors[0]],['energy',colors[1]]]){ctx.strokeStyle=color;ctx.lineWidth=1.3;ctx.beginPath();traces.forEach((m,i)=>{const x=i/Math.max(1,traces.length-1)*width,y=58-m[key]*51;if(i)ctx.lineTo(x,y);else ctx.moveTo(x,y);});ctx.stroke();}
  }
  function refresh(history=false){
    const w=ctl.world,m=A.metrics(w),a=w.agents[selected];
    $('run').textContent=ctl.running?'Ⅱ  Pause world':'▶  Run world';$('run-state').textContent=ctl.running?'RUNNING':'PAUSED';$('run-state').classList.toggle('running',ctl.running);
    $('sim-time').textContent='T + '+m.time.toFixed(1).padStart(6,'0')+' s';$('regime').textContent=m.regime.toUpperCase();
    $('action').value=w.action;$('goal').value=w.goal;
    if(document.activeElement!==$('coupling')){$('coupling').value=w.params.coupling;$('coupling-value').textContent=w.params.coupling.toFixed(2);}
    $('source').replaceChildren();const icon=document.createElement('span');icon.className='button-glyph';icon.textContent='ϟ';$('source').append(icon,document.createTextNode(w.sourceOn?'Source off':'Source on'));
    $('metric-c').textContent=m.C.toFixed(3);$('metric-energy').textContent=(m.energy*100).toFixed(1)+'%';$('metric-coverage').textContent=(m.coverage*100).toFixed(2)+'%';$('metric-d').textContent=m.D.toFixed(4);$('metric-phi').textContent=m.phi.toFixed(3);
    $('agent-name').textContent=a.name;$('agent-number').textContent=String(a.id+1).padStart(2,'0');$('agent-orb').style.background=colors[selected];
    $('agent-intent').textContent=a.energy<.22?'Low reserve · returning to source':agentLabels[A.ACTIONS.indexOf(w.action)];
    ['x','y','z'].forEach((key,i)=>{$('actual-'+key).textContent=a.p[i].toFixed(2);$('model-'+key).textContent=(a.m[i]*A.SIZE[i]).toFixed(2);});
    $('agent-speed').textContent=Math.hypot(...a.v).toFixed(2)+' u/s';$('agent-sensor').textContent=((w.tick-a.lastSeen)*A.DT).toFixed(1)+' s'+(w.blackout?' · BLIND':'');
    $('agent-energy').textContent=(a.energy*100).toFixed(1)+'%';$('agent-energy-bar').style.width=a.energy*100+'%';$('agent-energy-bar').style.background=colors[selected];
    for(let i=0;i<3;i++){$('agent-'+i).classList.toggle('active',i===selected);$('agent-'+i).setAttribute('aria-pressed',String(i===selected));}
    $('probe-count').textContent=w.probes.length+' PROBES';$('plan').disabled=busy;$('counterfactual').disabled=busy;
    $('ghost-label').hidden=!options.ghosts;updateSpark();
    if(history){
      $('history-count').textContent=ctl.session.history.length+' checkpoints';$('timeline').replaceChildren();
      for(const n of ctl.session.history){const b=document.createElement('button');b.className='checkpoint'+(n.id===ctl.session.cursor?' active':'');b.title='Restore '+n.label+' at '+(n.world.tick*A.DT).toFixed(1)+' seconds';
        const title=document.createElement('strong');title.textContent=n.label;const small=document.createElement('small');small.textContent='#'+n.id+' · '+(n.world.tick*A.DT).toFixed(1)+'s · parent '+(n.parent??'—');b.append(title,small);b.addEventListener('click',()=>guarded(()=>ctl.restore(n.id),'Checkpoint restored. Your next intervention can create a new branch.'));$('timeline').append(b);}
      $('events').replaceChildren();for(const event of w.events.slice(-5).reverse()){const li=document.createElement('li'),time=document.createElement('time'),text=document.createElement('span');time.textContent='T + '+(event.tick*A.DT).toFixed(1)+' s';text.textContent=event.text;li.append(time,text);$('events').append(li);}
      refreshForecast();
    }
  }
  function refreshForecast(){
    const host=$('experiment-output');host.replaceChildren();
    const heading=document.createElement('strong'),p=document.createElement('p');
    if(ctl.forecast){
      const f=ctl.forecast;heading.textContent='Possible futures · '+f.evaluated+' branches evaluated';p.textContent='Preview only. Scores reflect the selected objective and the model’s assumptions.';host.append(heading,p);
      const cards=document.createElement('div');cards.className='future-cards';
      f.candidates.forEach((c,i)=>{const b=document.createElement('button');b.className='future-card'+(i===ctl.candidate?' active':'');b.setAttribute('aria-pressed',String(i===ctl.candidate));const title=document.createElement('strong'),detail=document.createElement('small');title.textContent=c.sequence.join(' → ');detail.textContent='Score '+c.score.toFixed(3)+' · energy '+(c.metrics.energy*100).toFixed(1)+'%';b.append(title,detail);b.addEventListener('click',()=>{ctl.selectCandidate(i);options.ghosts=c.trails;refreshForecast();refresh(false);});cards.append(b);});host.append(cards);
      const actions=document.createElement('div');actions.className='future-actions';const apply=document.createElement('button');apply.className='primary';apply.textContent='Apply first intention';apply.addEventListener('click',()=>guarded(()=>{const action=ctl.applyCandidate();status('Applied '+action+'. Run the world to observe it.');}));const info=document.createElement('span');info.textContent=(f.depth*f.horizon*A.DT).toFixed(1)+'s lookahead · '+f.simulatedTicks+' simulated ticks';actions.append(apply,info);host.append(actions);
      options.ghosts=f.candidates[ctl.candidate].trails;
    }else if(ctl.counter){
      const c=ctl.counter;heading.textContent='Paired counterfactual · source '+(c.sourceOn?'ON':'OFF')+' in the alternative';p.textContent='At +'+(c.ticks*A.DT).toFixed(1)+'s: current-source mean energy '+(c.factual.energy*100).toFixed(2)+'%; alternative '+(c.alternate.energy*100).toFixed(2)+'%. Coherence '+c.factual.C.toFixed(4)+' / '+c.alternate.C.toFixed(4)+'.';
      host.append(heading,p);const note=document.createElement('p');note.textContent='Same starting snapshot. Dashed paths show the alternative. This comparison does not alter the live world.';host.append(note);options.ghosts=c.trails;
    }else{heading.textContent='One present. Several possible futures.';p.textContent='Explore futures to preview bounded action sequences. Dashed paths are simulated alternatives.';host.append(heading,p);options.ghosts=null;}
    $('ghost-label').hidden=!options.ghosts;
  }
  button('run',()=>{ctl.running=!ctl.running;if(ctl.running){ctl.clearFuture();options.ghosts=null;}},'');
  button('step',()=>{ctl.running=false;ctl.advance(1);},'Advanced one tick: 0.1 simulation seconds.');
  for(const kind of['pulse','blackout','source','probe','reset-model','clear-probes'])button(kind,()=>ctl.intervention(kind),'Intervention applied and checkpointed.');
  $('action').addEventListener('change',()=>guarded(()=>ctl.action($('action').value),'Agent intention changed.'));
  $('goal').addEventListener('change',()=>guarded(()=>ctl.goal($('goal').value),'Planner objective changed. Explore futures to compare actions.'));
  $('coupling').addEventListener('input',()=>{$('coupling-value').textContent=Number($('coupling').value).toFixed(2);});
  $('coupling').addEventListener('change',()=>guarded(()=>ctl.coupling(Number($('coupling').value)),'Memory coupling changed.'));
  button('snapshot',()=>ctl.save('Checkpoint '+ctl.session.nextId),'Checkpoint saved.');
  button('reset',()=>{ctl.reset($('seed').value.trim());lastSaveTick=0;if(renderer)renderer.setMode('orbit');$('camera').value='orbit';},'New seeded world initialized.');
  async function explore(counter=false){
    if(busy)return;ctl.running=false;const token=revision;busy=true;status(counter?'Computing paired source intervention…':'Exploring bounded 3D futures…');refresh(false);
    await new Promise(resolve=>setTimeout(resolve,30));
    try{if(revision!==token){status('World changed. Request a fresh comparison.');return;}if(counter)ctl.compare();else ctl.explore({depth:Number($('depth').value),width:3,horizon:Number($('horizon').value)});refreshForecast();status('Comparison ready. The live world is unchanged.');}
    catch(e){status(e.message,true);}finally{busy=false;refresh(false);}
  }
  $('plan').addEventListener('click',()=>explore());$('counterfactual').addEventListener('click',()=>explore(true));
  for(let i=0;i<3;i++)$('agent-'+i).addEventListener('click',()=>select(i));
  for(const id of['field','trails','beliefs','targets'])$(id).addEventListener('change',()=>{options[id]=$(id).checked;});
  $('field-mode').addEventListener('change',()=>{options.fieldMode=$('field-mode').value;$('slice').hidden=options.fieldMode!=='slice';});
  $('slice').addEventListener('input',()=>{options.slice=Number($('slice').value);});
  function cameraMode(){if(renderer)renderer.setMode($('camera').value);$('camera-hint').textContent=$('camera').value==='explore'?'Drag to look · W/A/S/D move · Q/E up/down · Focus world first':'Drag to orbit · Scroll to zoom · Click an agent';}
  $('camera').addEventListener('change',cameraMode);$('home-view').addEventListener('click',()=>{$('camera').value='orbit';cameraMode();});
  $('help').addEventListener('click',()=>$('guide').showModal());
  function download(name,text){const blob=new Blob([text],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  button('export',()=>download('Archimedes-World3D-'+ctl.world.tick+'.json',ctl.export()),'Session exported with exact state and branch history.');
  $('import').addEventListener('click',()=>$('file').click());
  $('file').addEventListener('change',async()=>{const file=$('file').files[0];if(!file)return;
    const token=++revision;ctl.running=false;refresh(false);
    try{if(file.size>12_000_000)throw new Error('Session file exceeds 12 MB.');const text=await file.text();if(revision!==token)throw new Error('World changed while reading the file. Import again.');ctl.import(text);invalidate();$('seed').value=ctl.world.seed;lastSaveTick=ctl.world.tick;refresh(true);persist();status('3D session imported. Ready to resume.');}
    catch(e){status('Import rejected: '+e.message,true);}finally{$('file').value='';}
  });
  document.addEventListener('keydown',e=>{if(e.code==='Space'&&(e.target===$('world')||e.target===document.body)&&!$('guide').open){e.preventDefault();$('run').click();}});
  document.addEventListener('visibilitychange',()=>{if(document.hidden){ctl.running=false;accumulator=0;persist();refresh(false);}});
  window.addEventListener('pagehide',persist);
  $('seed').value=ctl.world.seed;refresh(true);
  function frame(now){
    const elapsed=Math.min(.25,Math.max(0,(now-last)/1000));last=now;
    if(ctl.running&&!busy){accumulator+=elapsed*Number($('speed').value);const ticks=Math.min(10,Math.floor(accumulator/A.DT));if(ticks){accumulator-=ticks*A.DT;ctl.advance(ticks);options.ghosts=null;}}
    if(now-lastDraw>=32){if(renderer)renderer.draw(ctl.world,options,Math.min(.1,(now-lastDraw)/1000));lastDraw=now;
      for(let i=0;i<3;i++){const p=renderer&&renderer.project(ctl.world.agents[i].p),label=$('label-'+i);label.hidden=!p||!p.visible;if(p){label.style.left=p.x+'px';label.style.top=(p.y-19)+'px';}}
    }
    if(now-lastUI>200){refresh(false);lastUI=now;}
    if(ctl.world.tick-lastSaveTick>=100){persist();lastSaveTick=ctl.world.tick;}
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  // Read-only diagnostics for integration tests and reproducible bug reports.
  window.ArchimedesWorldDebug={snapshot:()=>A.clone(ctl.session),metrics:()=>A.metrics(ctl.world),graphics:()=>({available:!!renderer,lost:renderer?.lost??false}),version:A.VERSION};
})();
