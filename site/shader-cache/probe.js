// ScrapeTrace marker protocol v1. Source generation continues our ST—008 harness.
// Timings are browser-observed compile/link intervals. Draw/readback is outside them.
export const PROTOCOL='scrapetrace-shader-marker-v1';
export function validate(options){
 const {mode,namespace,bank=0,marker}=options;
 if(!['plant','read'].includes(mode))throw new Error('Choose plant or read mode.');
 if(typeof namespace!=='string'||!/^[A-Za-z0-9_-]{8,64}$/.test(namespace))throw new Error('Namespace must be 8–64 letters, numbers, underscores or hyphens.');
 if(!Number.isInteger(bank)||bank<0||bank>63)throw new Error('Bank must be an integer from 0 to 63.');
 if(mode==='read'&&marker!==undefined)throw new Error('Reader must not receive an expected marker.');
 if(mode==='plant'&&marker!==undefined&&!/^[0-9a-fA-F]{8}$/.test(marker))throw new Error('Marker must contain exactly eight hexadecimal characters.');
 return{mode,namespace,bank,...(marker===undefined?{}:{marker:marker.toUpperCase()})};
}
const hex=value=>(value>>>0).toString(16).padStart(8,'0').toUpperCase();
export async function checksum(namespace,bank,marker,scope=globalThis){
 const bytes=new TextEncoder().encode(`${PROTOCOL}/${namespace}/${bank}/${marker.toUpperCase()}`);
 const digest=await scope.crypto.subtle.digest('SHA-256',bytes);
 return new DataView(digest).getUint32(0,false);
}
export function decode(rows){
 let payload=0,tag=0;const ties=[];
 for(let i=0;i<64;i++){
  const row=rows[i];if(!row||row.bit!==i||![0,1,null].includes(row.guess))throw new Error('Incomplete or invalid candidate measurements.');
  if(row.guess===null)ties.push(i);
  else if(row.guess===1){if(i<32)payload|=1<<i;else tag|=1<<(i-32)}
 }
 return{candidate:hex(payload),tag:tag>>>0,ties};
}
function seedFor(namespace,bank,slot,value){let h=2166136261;for(const c of `${PROTOCOL}/${namespace}/${bank}/${slot}/${value}`)h=Math.imul(h^c.charCodeAt(0),16777619);return h>>>0}
function fragment(seed){let s=seed>>>0,body='';for(let i=0;i<128;i++){s=(Math.imul(s,1664525)+1013904223)>>>0;body+=`x=sin(x*${(1+s/4294967296).toFixed(8)}+${(s/4294967296).toFixed(8)});\n`}
 return '#version 300 es\nprecision highp float;out vec4 color;void main(){float x=gl_FragCoord.x*0.001+gl_FragCoord.y*0.002;'+body+'color=vec4(x,x*x,abs(x),1.0);}';}
const vertex='#version 300 es\nin vec2 p;void main(){gl_Position=vec4(p,0.0,1.0);}';
export async function runMarker(input,scope=globalThis,onProgress=()=>{},signal){
 const started=scope.performance.now(),result={protocol:PROTOCOL,collectedAt:new Date().toISOString(),status:'error',complete:false};let gl,buffer;const objects=new Set();let count=0;
 const now=()=>scope.performance.now();
 const check=()=>{if(signal?.aborted)throw new Error('Run cancelled.');if(now()-started>20000)throw new Error('Run exceeded the 20-second workload deadline.');if(gl?.isContextLost())throw new Error('WebGL context lost.')};
 const pause=()=>new Promise(r=>scope.setTimeout(r,0));
 const notify=(phase,current,total)=>onProgress({phase,current,total});
 function compile(source){
  check();const before=now();const vs=gl.createShader(gl.VERTEX_SHADER),fs=gl.createShader(gl.FRAGMENT_SHADER),program=gl.createProgram();
  if(!vs||!fs||!program)throw new Error('WebGL resource allocation failed.');objects.add(vs);objects.add(fs);objects.add(program);
  try{
   gl.shaderSource(vs,vertex);gl.shaderSource(fs,source);gl.compileShader(vs);gl.compileShader(fs);gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program);
   const linked=gl.getProgramParameter(program,gl.LINK_STATUS),totalMs=now()-before;
   if(!linked)throw new Error(gl.getProgramInfoLog(program)||'Shader linking failed.');
   const drawStart=now();gl.viewport(0,0,1,1);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);gl.useProgram(program);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
   const location=gl.getAttribLocation(program,'p');if(location<0)throw new Error('Vertex input unavailable.');gl.enableVertexAttribArray(location);gl.vertexAttribPointer(location,2,gl.FLOAT,false,0,0);gl.drawArrays(gl.TRIANGLES,0,3);
   const pixel=new Uint8Array(4);gl.readPixels(0,0,1,1,gl.RGBA,gl.UNSIGNED_BYTE,pixel);const draw={pixel:Array.from(pixel),error:gl.getError(),elapsedMs:now()-drawStart};
   if(draw.error!==gl.NO_ERROR||draw.pixel[3]!==255)throw new Error('Draw/readback failed.');count++;return{totalMs,draw};
  }finally{gl.deleteProgram(program);gl.deleteShader(vs);gl.deleteShader(fs);objects.delete(program);objects.delete(vs);objects.delete(fs)}
 }
 try{
  const options=validate(input);result.request={mode:options.mode,namespace:options.namespace,bank:options.bank};
  if(!scope.crypto?.subtle||!scope.crypto?.getRandomValues){result.status='unsupported';result.message='Secure-context crypto APIs are unavailable.';return result}
  const canvas=scope.document.createElement('canvas');canvas.width=canvas.height=1;gl=canvas.getContext('webgl2');
  if(!gl){result.status='unsupported';result.message='WebGL2 is unavailable.';return result}
  const ext=gl.getExtension('WEBGL_debug_renderer_info');
  result.environment={userAgent:scope.navigator.userAgent,origin:scope.location.origin,secureContext:scope.isSecureContext,visibility:scope.document.visibilityState,renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):null,vendor:ext?gl.getParameter(ext.UNMASKED_VENDOR_WEBGL):null};
  buffer=gl.createBuffer();if(!buffer)throw new Error('Vertex buffer unavailable.');gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);
  const calibrationNS='calibration_'+scope.crypto.randomUUID();notify('calibrating',0,6);compile(fragment(seedFor(calibrationNS,0,99,0)));const cold=[],warm=[];
  for(let i=0;i<6;i++){cold.push(compile(fragment(seedFor(calibrationNS,0,i,0))));await pause()}
  for(let i=0;i<6;i++){warm.push(compile(fragment(seedFor(calibrationNS,0,i,0))));notify('calibrating',i+1,6);await pause()}
  const median=a=>{const s=[...a].sort((a,b)=>a-b);return(s[2]+s[3])/2};
  const coldMedianMs=median(cold.map(r=>r.totalMs)),warmMedianMs=median(warm.map(r=>r.totalMs));
  result.calibration={cold,warm,coldMedianMs,warmMedianMs,gapMs:coldMedianMs-warmMedianMs,ratio:warmMedianMs===0?null:coldMedianMs/warmMedianMs,rule:'cold median ≥ 2 × warm median and gap ≥ 2 ms',usable:coldMedianMs>=2*warmMedianMs&&coldMedianMs-warmMedianMs>=2};
  if(!result.calibration.usable){result.status='inconclusive';result.message='Cold and warm compilation timings did not separate enough for this run.';return result}
  const rows=[];
  if(options.mode==='plant'){
   const marker=options.marker??hex(scope.crypto.getRandomValues(new Uint32Array(1))[0]);const payload=parseInt(marker,16)>>>0,tag=await checksum(options.namespace,options.bank,marker,scope);
   for(let bit=0;bit<64;bit++){
    const value=bit<32?(payload>>>bit)&1:(tag>>>(bit-32))&1;
    rows.push({bit,value,timing:compile(fragment(seedFor(options.namespace,options.bank,bit,value)))});notify('planting',bit+1,64);await pause();
   }
   result.status='planted';result.marker=marker;result.integrityTag=hex(tag);result.record={payloadBits:32,tagBits:32,rows};result.message='Marker planted. Open the reader URL in a fresh context.';
  }else{
   for(let bit=0;bit<64;bit++){
    const order=scope.crypto.getRandomValues(new Uint8Array(1))[0]&1?[1,0]:[0,1],timings={};
    for(const value of order)timings[value]=compile(fragment(seedFor(options.namespace,options.bank,bit,value)));
    const a=timings[0].totalMs,b=timings[1].totalMs;
    rows.push({bit,order,timings,guess:a===b?null:a<b?0:1,marginMs:Math.abs(a-b)});notify('reading',bit+1,64);await pause();
   }
   const recovered=decode(rows),expectedTag=await checksum(options.namespace,options.bank,recovered.candidate,scope);
   const valid=recovered.ties.length===0&&recovered.tag===expectedTag;
   result.record={payloadBits:32,tagBits:32,rows,candidateMarker:recovered.candidate,observedTag:hex(recovered.tag),recomputedTag:hex(expectedTag),ties:recovered.ties,valid};
   result.status=valid?'recovered':'no-valid-record';result.marker=valid?recovered.candidate:null;result.message=valid?'Marker recovered with a matching integrity tag.':'No valid marker recovered from this bank.';
  }
 }catch(error){result.status=signal?.aborted?'cancelled':result.request?'error':'invalid-input';result.message=String(error?.message||error)}
 finally{
  if(gl){for(const object of objects){if(gl.isProgram(object))gl.deleteProgram(object);else if(gl.isShader(object))gl.deleteShader(object)}if(buffer)gl.deleteBuffer(buffer);gl.getExtension('WEBGL_lose_context')?.loseContext()}
  result.programsMeasured=count;result.elapsedMs=now()-started;result.complete=true;result.readIsDestructive=input.mode==='read';
 }
 return result;
}
