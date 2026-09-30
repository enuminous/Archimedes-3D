'use strict';
// Deterministic ZIP writer using Node standard libraries only (ZIP32 / raw DEFLATE).
const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');require('./build.js');
const roots=['.github','world3d','docs','examples','results','scripts','tests','index.html','engine.js','app.js','styles.css','icon.svg','Archimedes-Engine.html','Archimedes-World3D.html','README.md','RIGHTS.md','CHANGELOG.md','CITATION.cff','MANIFEST.json','package.json','.gitignore','.nojekyll'];
const files=[];
function walk(relative){const p=path.join(root,relative);if(!fs.existsSync(p))return;if(fs.statSync(p).isDirectory())for(const f of fs.readdirSync(p).sort())walk(relative+'/'+f);else files.push(relative);}
roots.forEach(walk);files.sort();
const hashes=files.map(name=>crypto.createHash('sha256').update(fs.readFileSync(path.join(root,name))).digest('hex')+'  '+name).join('\n')+'\n';
fs.writeFileSync(path.join(root,'SHA256SUMS.txt'),hashes);files.push('SHA256SUMS.txt');files.sort();
const table=Array.from({length:256},(_,n)=>{for(let i=0;i<8;i++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
function crc(b){let c=0xffffffff;for(const v of b)c=table[(c^v)&255]^(c>>>8);return(c^0xffffffff)>>>0;}
const local=[],central=[];let offset=0;const dosDate=(2026-1980)<<9|9<<5|30;
for(const file of files){
  const name=Buffer.from('Archimedes-Engine-v0.2.0/'+file),raw=fs.readFileSync(path.join(root,file)),data=zlib.deflateRawSync(raw,{level:9}),sum=crc(raw);
  const h=Buffer.alloc(30);h.writeUInt32LE(0x04034b50);h.writeUInt16LE(20,4);h.writeUInt16LE(8,8);h.writeUInt16LE(dosDate,12);h.writeUInt32LE(sum,14);h.writeUInt32LE(data.length,18);h.writeUInt32LE(raw.length,22);h.writeUInt16LE(name.length,26);
  local.push(h,name,data);
  const c=Buffer.alloc(46);c.writeUInt32LE(0x02014b50);c.writeUInt16LE(20,4);c.writeUInt16LE(20,6);c.writeUInt16LE(8,10);c.writeUInt16LE(dosDate,14);c.writeUInt32LE(sum,16);c.writeUInt32LE(data.length,20);c.writeUInt32LE(raw.length,24);c.writeUInt16LE(name.length,28);c.writeUInt32LE(offset,42);central.push(c,name);offset+=h.length+name.length+data.length;
}
const cd=Buffer.concat(central),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(files.length,8);end.writeUInt16LE(files.length,10);end.writeUInt32LE(cd.length,12);end.writeUInt32LE(offset,16);
const dest=path.resolve(root,'../Archimedes-Engine-3D-v0.2.0-GitHub.zip');fs.writeFileSync(dest,Buffer.concat([...local,cd,end]));console.log(`${files.length} files packaged: ${dest}`);
