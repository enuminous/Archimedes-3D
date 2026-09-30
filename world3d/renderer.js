/* Original WebGL renderer. No network, packages or external assets. */
(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ArchimedesView = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  'use strict';
  const COLORS = [[0.77, 0.97, 0.46], [0.34, 0.82, 0.94], [1, 0.64, 0.38]];
  const add = (a,b) => a.map((v,i)=>v+b[i]), sub=(a,b)=>a.map((v,i)=>v-b[i]);
  const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  const unit=a=>{const n=Math.hypot(...a)||1;return a.map(v=>v/n);};
  const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
  function multiply(a,b) { const o=Array(16).fill(0); for(let c=0;c<4;c++)for(let r=0;r<4;r++)for(let k=0;k<4;k++)o[c*4+r]+=a[k*4+r]*b[c*4+k]; return o; }
  function perspective(fov,aspect,near,far) { const f=1/Math.tan(fov/2);return [f/aspect,0,0,0,0,f,0,0,0,0,(far+near)/(near-far),-1,0,0,2*far*near/(near-far),0]; }
  function lookAt(eye,target) {
    const z=unit(sub(eye,target)), x=unit(cross([0,1,0],z)), y=cross(z,x), dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
    return [x[0],y[0],z[0],0,x[1],y[1],z[1],0,x[2],y[2],z[2],0,-dot(x,eye),-dot(y,eye),-dot(z,eye),1];
  }
  function project(p,m,width,height) {
    const v=[...p,1], q=[0,0,0,0];for(let r=0;r<4;r++)for(let k=0;k<4;k++)q[r]+=m[k*4+r]*v[k];
    if(q[3]<=0)return null;const n=q.slice(0,3).map(v=>v/q[3]);
    if(n[2]<-1||n[2]>1)return null;return {x:(n[0]+1)*width/2,y:(1-n[1])*height/2,visible:Math.abs(n[0])<=1&&Math.abs(n[1])<=1};
  }
  class Geometry {
    constructor(){this.tri=[];this.lines=[];}
    triangle(a,b,c,color){const n=unit(cross(sub(b,a),sub(c,a)));for(const p of[a,b,c])this.tri.push(...p,...n,...color);}
    quad(a,b,c,d,color){this.triangle(a,b,c,color);this.triangle(a,c,d,color);}
    line(a,b,color){for(const p of[a,b])this.lines.push(...p,0,1,0,...color);}
    box(p,size,color){
      const v=[];for(let i=0;i<8;i++)v.push(p.map((n,j)=>n+size[j]/2*((i>>j)&1?1:-1)));
      for(const q of [[0,4,6,2],[1,3,7,5],[0,1,5,4],[2,6,7,3],[0,2,3,1],[4,5,7,6]])this.quad(...q.map(i=>v[i]),color);
    }
    octa(p,r,color,stretch=1){const v=[[r,0,0],[-r,0,0],[0,r*stretch,0],[0,-r*stretch,0],[0,0,r],[0,0,-r]].map(v=>add(v,p));for(const f of[[0,2,4],[4,2,1],[1,2,5],[5,2,0],[0,4,3],[4,1,3],[1,5,3],[5,0,3]])this.triangle(...f.map(i=>v[i]),color);}
    cylinder(p,r,height,color,segments=16){
      const lo=[p[0],p[1]-height/2,p[2]],hi=[p[0],p[1]+height/2,p[2]];
      for(let i=0;i<segments;i++){const a=i/segments*Math.PI*2,b=(i+1)/segments*Math.PI*2;
        const al=add(lo,[r*Math.cos(a),0,r*Math.sin(a)]),bl=add(lo,[r*Math.cos(b),0,r*Math.sin(b)]),ah=add(al,[0,height,0]),bh=add(bl,[0,height,0]);
        this.quad(al,ah,bh,bl,color);this.triangle(hi,bh,ah,color);this.triangle(lo,al,bl,color);}
    }
    ring(p,r,color,segments=48){for(let i=0;i<segments;i++){const a=i/segments*Math.PI*2,b=(i+1)/segments*Math.PI*2;this.line(add(p,[r*Math.cos(a),0,r*Math.sin(a)]),add(p,[r*Math.cos(b),0,r*Math.sin(b)]),color);}}
  }
  function staticScene(A){
    const g=new Geometry();
    g.box([12,-0.48,9],[25,0.9,19],[0.085,0.125,0.165]);
    g.box([12,-0.96,9],[22.5,0.15,16.5],[0.045,0.075,0.105]);
    for(let x=0;x<=24;x++)g.line([x,0.005,0],[x,0.005,18],x%4===0?[0.17,0.24,0.29]:[0.105,0.155,0.20]);
    for(let z=0;z<=18;z++)g.line([0,0.005,z],[24,0.005,z],z%3===0?[0.17,0.24,0.29]:[0.105,0.155,0.20]);
    for(const z of[0,18])g.box([12,0.03,z],[24,0.05,0.04],[0.31,0.45,0.49]);
    for(const x of[0,24])g.box([x,0.03,9],[0.04,0.05,18],[0.31,0.45,0.49]);
    for(const box of A.OBSTACLES){const size=sub(box.max,box.min),p=box.min.map((n,i)=>n+size[i]/2);
      g.box(p,size,[0.20,0.28,0.34]);g.box([p[0],box.max[1]-0.04,p[2]],[size[0]-0.18,0.08,size[2]-0.18],[0.35,0.44,0.48]);
      for(let i=0;i<3;i++)g.box([p[0]-0.8+i*0.8,p[1]+0.5,box.max[2]+0.005],[0.42,0.2,0.015],[0.56,0.77,0.77]);
      for(let k=1;k<5;k++)g.line([box.min[0]+0.2,box.max[1]+0.015,box.min[2]+k*0.5],[box.max[0]-0.2,box.max[1]+0.015,box.min[2]+k*0.5],[0.18,0.29,0.36]);
    }
    A.STATIONS.forEach((s,i)=>{
      const c=COLORS[i],h=s.p[1];
      g.cylinder([s.p[0],0.16,s.p[2]],1.25,0.3,[0.13,0.20,0.25],24);
      g.ring([s.p[0],0.32,s.p[2]],1.10,c);g.ring([s.p[0],0.33,s.p[2]],0.85,c.map(v=>v*0.55));
      for(let j=0;j<3;j++){const t=j*2*Math.PI/3;const x=s.p[0]+0.55*Math.cos(t),z=s.p[2]+0.55*Math.sin(t);
        g.line([x,0.4,z],[x,h-0.35,z],c.map(v=>v*0.35));}
      g.ring(s.p,0.78,c);g.ring(add(s.p,[0,0.12,0]),0.7,c.map(v=>v*0.4));
      for(let y=1;y<h;y++)g.line([s.p[0]+1.5,y,s.p[2]],[s.p[0]+1.68,y,s.p[2]],[0.31,0.46,0.53]);
    });
    for(const x of[0,24])for(const z of[0,18]){g.box([x,0.5,z],[0.18,1,0.18],[0.32,0.39,0.41]);g.octa([x,1.1,z],0.13,[0.65,0.91,0.71]);}
    return g;
  }
  function dynamicScene(A,w,options={}){
    const g=new Geometry(), selected=options.selected??0;
    if(options.field!==false){
      for(let y=0;y<A.GRID[1];y++)for(let z=0;z<A.GRID[2];z++)for(let x=0;x<A.GRID[0];x++){
        if(options.fieldMode==='slice'&&y!==options.slice)continue;
        const j=A.index(x,y,z),u=w.field[j];if(u<0.03)continue;
        const p=A.cellPosition(x,y,z),c=[0.10+u*0.20,0.23+u*0.68,0.29+u*0.50];
        g.octa(p,0.014+u*0.095,c);
      }
    }
    w.agents.forEach((a,i)=>{
      const c=COLORS[i];
      g.octa(a.p,0.39,c,0.72);g.box(add(a.p,[0,-0.15,0]),[0.21,0.18,0.21],[0.07,0.13,0.16]);
      for(const d of[[0.5,0,0],[-0.5,0,0],[0,0,0.5],[0,0,-0.5]]){g.line(a.p,add(a.p,d),c);g.ring(add(a.p,d),0.15,c,12);}
      if(options.trails!==false)for(let j=1;j<a.trail.length;j++)g.line(a.trail[j-1],a.trail[j],c.map(v=>v*(0.2+0.65*j/a.trail.length)));
      g.line([a.p[0],0.02,a.p[2]],a.p,c.map(v=>v*0.2));g.ring([a.p[0],0.02,a.p[2]],0.38,c.map(v=>v*0.4),20);
      if(i===selected){g.ring(a.p,0.88,c);const m=a.m.slice(0,3).map((n,j)=>n*A.SIZE[j]);
        if(options.beliefs){g.line(a.p,m,[1,0.48,0.5]);g.ring(m,0.5,[1,0.48,0.5]);}
        if(options.targets){const t=A.target(w,a);g.line(a.p,t,c.map(v=>v*0.35));g.ring(t,0.6,c,24);g.line(add(t,[-0.2,0,0]),add(t,[0.2,0,0]),c);}
      }
    });
    for(const b of w.probes)g.octa(b.p,0.25,[0.98,0.67,0.85]);
    if(options.ghosts)options.ghosts.forEach((tr,i)=>{for(let j=1;j<tr.length;j++)if(j%3!==0)g.line(tr[j-1],tr[j],COLORS[i].map(v=>0.3+v*0.55));});
    A.STATIONS.forEach((s,i)=>g.octa(s.p,0.16,i===0&&!w.sourceOn?[0.26,0.3,0.32]:COLORS[i]));
    return g;
  }
  const VERTEX='attribute vec3 aPosition;attribute vec3 aNormal;attribute vec3 aColor;uniform mat4 uMatrix;uniform vec3 uEye;varying vec3 vColor;varying float vDistance;void main(){float light=.48+.52*max(dot(normalize(aNormal),normalize(vec3(-.4,1.,.6))),0.);vColor=aColor*light;vDistance=distance(aPosition,uEye);gl_Position=uMatrix*vec4(aPosition,1.);}';
  const FRAGMENT='precision mediump float;varying vec3 vColor;varying float vDistance;void main(){float fog=smoothstep(36.,90.,vDistance);gl_FragColor=vec4(mix(vColor,vec3(.035,.064,.090),fog),1.);}';
  class Renderer {
    constructor(canvas,A,onSelect,onStatus){
      this.canvas=canvas;this.A=A;this.onSelect=onSelect;this.onStatus=onStatus;this.camera={mode:'orbit',yaw:0.70,pitch:0.65,distance:34,target:[12,2.5,9],eye:[12,4,17]};
      this.keys=new Set();this.pointers=new Map();this.matrix=null;this.world=null;this.selected=0;this.lost=false;
      this.gl=canvas.getContext('webgl',{alpha:false,antialias:true,preserveDrawingBuffer:false});
      if(!this.gl)throw new Error('WebGL is unavailable. Enable hardware acceleration or open this file in another WebGL-capable browser.');
      this.initialize();this.controls();
      canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();this.lost=true;onStatus('Graphics paused: WebGL context lost. Export your session to keep it.');});
      canvas.addEventListener('webglcontextrestored',()=>{this.lost=false;this.initialize();onStatus('Graphics restored.');});
    }
    initialize(){
      const gl=this.gl;const shader=(kind,src)=>{const s=gl.createShader(kind);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s));return s;};
      const p=gl.createProgram();gl.attachShader(p,shader(gl.VERTEX_SHADER,VERTEX));gl.attachShader(p,shader(gl.FRAGMENT_SHADER,FRAGMENT));gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(p));
      this.program=p;this.attrs=['aPosition','aNormal','aColor'].map(n=>gl.getAttribLocation(p,n));this.uniform=gl.getUniformLocation(p,'uMatrix');this.eyeUniform=gl.getUniformLocation(p,'uEye');
      this.buffers=[gl.createBuffer(),gl.createBuffer(),gl.createBuffer(),gl.createBuffer()];
      this.static=staticScene(this.A);[this.static.tri,this.static.lines].forEach((a,i)=>{gl.bindBuffer(gl.ARRAY_BUFFER,this.buffers[i]);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(a),gl.STATIC_DRAW);});
      gl.enable(gl.DEPTH_TEST);gl.disable(gl.CULL_FACE);gl.clearColor(.035,.064,.090,1);
    }
    setMode(mode){this.camera.mode=mode;this.keys.clear();if(mode==='explore'){this.camera.eye=[12,4,17];this.camera.yaw=Math.PI;this.camera.pitch=-0.08;}else{this.camera.yaw=.7;this.camera.pitch=mode==='top'?1.53:.65;this.camera.distance=mode==='follow'?13:34;this.camera.target=[12,2.5,9];}}
    controls(){
      const c=this.canvas;
      c.addEventListener('contextmenu',e=>e.preventDefault());
      c.addEventListener('pointerdown',e=>{c.focus();c.setPointerCapture(e.pointerId);this.pointers.set(e.pointerId,{x:e.clientX,y:e.clientY,startX:e.clientX,startY:e.clientY,moved:0});this.pinch=null;});
      c.addEventListener('pointermove',e=>{
        const p=this.pointers.get(e.pointerId);if(!p)return;const dx=e.clientX-p.x,dy=e.clientY-p.y;p.moved+=Math.hypot(dx,dy);p.x=e.clientX;p.y=e.clientY;
        if(this.pointers.size===2){const v=[...this.pointers.values()],d=Math.hypot(v[0].x-v[1].x,v[0].y-v[1].y);if(this.pinch)this.camera.distance=clamp(this.camera.distance*this.pinch/d,5,65);this.pinch=d;return;}
        if(e.shiftKey||e.buttons===2){this.camera.target[0]-=dx*.025;this.camera.target[2]-=dy*.025;}
        else{this.camera.yaw-=dx*.006;this.camera.pitch=clamp(this.camera.pitch+(this.camera.mode==='explore'?-1:1)*dy*.006,this.camera.mode==='explore'?-1.3:.08,1.53);}
      });
      const end=e=>{const p=this.pointers.get(e.pointerId);if(p&&p.moved<5&&this.pointers.size===1&&this.world){const rect=c.getBoundingClientRect();let best=null,d=32;for(const a of this.world.agents){const v=this.project(a.p);if(v){const n=Math.hypot(v.x-(e.clientX-rect.left),v.y-(e.clientY-rect.top));if(n<d){d=n;best=a.id;}}}if(best!==null)this.onSelect(best);}this.pointers.delete(e.pointerId);this.pinch=null;};
      c.addEventListener('pointerup',end);c.addEventListener('pointercancel',e=>{this.pointers.delete(e.pointerId);this.pinch=null;});
      c.addEventListener('wheel',e=>{e.preventDefault();this.camera.distance=clamp(this.camera.distance*Math.exp(e.deltaY*.001),5,65);},{passive:false});
      c.addEventListener('keydown',e=>{if(['w','a','s','d','q','e','ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){this.keys.add(e.key);e.preventDefault();}});
      c.addEventListener('keyup',e=>this.keys.delete(e.key));c.addEventListener('blur',()=>this.keys.clear());
    }
    project(p){return this.matrix?project(p,this.matrix,this.width,this.height):null;}
    draw(w,options,dt=0.016){
      if(this.lost)return;this.world=w;this.selected=options.selected??0;const gl=this.gl,c=this.canvas,cam=this.camera;
      const rect=c.getBoundingClientRect();this.width=Math.max(1,rect.width);this.height=Math.max(1,rect.height);
      const dpr=Math.min(globalThis.devicePixelRatio||1,2),width=Math.round(this.width*dpr),height=Math.round(this.height*dpr);
      if(c.width!==width||c.height!==height){c.width=width;c.height=height;gl.viewport(0,0,width,height);}
      let eye,target;
      if(cam.mode==='explore'){
        const dir=[Math.sin(cam.yaw)*Math.cos(cam.pitch),Math.sin(cam.pitch),Math.cos(cam.yaw)*Math.cos(cam.pitch)],right=[-Math.cos(cam.yaw),0,Math.sin(cam.yaw)];
        const f=Number(this.keys.has('w')||this.keys.has('ArrowUp'))-Number(this.keys.has('s')||this.keys.has('ArrowDown')),r=Number(this.keys.has('d')||this.keys.has('ArrowRight'))-Number(this.keys.has('a')||this.keys.has('ArrowLeft'));
        cam.eye=cam.eye.map((v,i)=>clamp(v+dt*5*(dir[i]*f+right[i]*r+(i===1?Number(this.keys.has('e'))-Number(this.keys.has('q')):0)),.4,this.A.SIZE[i]-.4));
        for(const box of this.A.OBSTACLES){const hit=this.A.contact(cam.eye,box,.3);if(hit)cam.eye=cam.eye.map((v,i)=>v+hit.normal[i]*(hit.penetration+1e-6));}
        eye=cam.eye;target=add(eye,dir);
      }else{
        if(cam.mode==='follow')cam.target=cam.target.map((v,i)=>v+(w.agents[this.selected].p[i]-v)*Math.min(1,dt*5));
        target=cam.target;eye=add(target,[Math.sin(cam.yaw)*Math.cos(cam.pitch)*cam.distance,Math.sin(cam.pitch)*cam.distance,Math.cos(cam.yaw)*Math.cos(cam.pitch)*cam.distance]);
      }
      this.matrix=multiply(perspective(Math.PI/3.4,this.width/this.height,.1,160),lookAt(eye,target));
      gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.useProgram(this.program);gl.uniformMatrix4fv(this.uniform,false,new Float32Array(this.matrix));gl.uniform3fv(this.eyeUniform,new Float32Array(eye));
      const dyn=dynamicScene(this.A,w,options),arrays=[this.static.tri,this.static.lines,dyn.tri,dyn.lines];
      arrays.forEach((array,i)=>{gl.bindBuffer(gl.ARRAY_BUFFER,this.buffers[i]);if(i>1)gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(array),gl.DYNAMIC_DRAW);this.attrs.forEach((a,j)=>{gl.enableVertexAttribArray(a);gl.vertexAttribPointer(a,3,gl.FLOAT,false,36,j*12);});gl.drawArrays(i%2?gl.LINES:gl.TRIANGLES,0,array.length/9);});
    }
  }
  return {Renderer,Geometry,COLORS,multiply,perspective,lookAt,project,staticScene,dynamicScene,VERTEX,FRAGMENT};
});
