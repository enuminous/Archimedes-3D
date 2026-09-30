(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./engine3d.js'):root.Archimedes3D);if(typeof module==='object'&&module.exports)module.exports=api;else root.ArchimedesController=api;})(typeof globalThis!=='undefined'?globalThis:this,function(A){
  'use strict';
  class Controller {
    constructor(seed){this.session=A.createSession(seed);this.running=false;this.forecast=null;this.counter=null;this.candidate=0;}
    get world(){return this.session.world;}
    clearFuture(){this.forecast=null;this.counter=null;this.candidate=0;}
    advance(n=1){this.session.world=A.step(this.world,n);if(n)this.clearFuture();}
    save(label='Checkpoint'){this.session=A.checkpoint(this.session,label);}
    change(fn,label){const before=A.checkpoint(this.session,'Before '+label);const world=fn(before.world);before.world=world;this.session=A.checkpoint(before,label);this.clearFuture();}
    intervention(kind){this.change(w=>A.intervene(w,kind),kind);}
    action(value){this.change(w=>A.setAction(w,value),value);}
    goal(value){this.change(w=>A.setGoal(w,value),'objective: '+value);}
    coupling(value){this.change(w=>A.setParameters(w,{coupling:value}),'coupling '+value.toFixed(2));}
    restore(id){
      this.running=false;const target=this.session.history.find(n=>n.id===id);if(!target)throw new Error('Checkpoint not found.');
      // Preserve unsaved current work; restore the requested state even if pruning removes its old node.
      if(A.checksum(this.world)!==A.checksum(this.session.history.find(n=>n.id===this.session.cursor).world))this.save('Before rewind');
      if(this.session.history.some(n=>n.id===id))this.session=A.restore(this.session,id);
      else{this.session.world=A.clone(target.world);this.save('Restored '+target.label);}
      this.clearFuture();
    }
    explore(options){this.running=false;this.forecast=A.plan(this.world,options);this.counter=null;this.candidate=0;return this.forecast;}
    selectCandidate(i){if(!this.forecast||!Number.isInteger(i)||i<0||i>=this.forecast.candidates.length)throw new Error('Unknown candidate.');this.candidate=i;}
    applyCandidate(){
      if(!this.forecast||this.forecast.origin!==A.checksum(this.world))throw new Error('This forecast is stale. Explore futures again.');
      const action=this.forecast.candidates[this.candidate].sequence[0];this.action(action);return action;
    }
    compare(){this.running=false;this.counter=A.counterfactual(this.world);this.forecast=null;return this.counter;}
    reset(seed){const next=A.createSession(seed);this.session=next;this.running=false;this.clearFuture();}
    export(){return A.exportSession(this.session);}
    import(text){const next=A.importSession(text);this.session=next;this.running=false;this.clearFuture();}
  }
  return {Controller};
});
