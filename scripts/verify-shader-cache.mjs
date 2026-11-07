import assert from 'node:assert/strict';
import {validate,checksum,decode,runMarker,PROTOCOL} from '../site/shader-cache/probe.js';
import worker from '../dist/_worker.js';
const ns='controlled_namespace';
for(const input of [{mode:'track',namespace:ns},{mode:'read',namespace:'bad'},{mode:'read',namespace:ns,bank:-1},{mode:'read',namespace:ns,bank:64},{mode:'read',namespace:ns,bank:NaN},{mode:'read',namespace:ns,marker:'12345678'},{mode:'plant',namespace:ns,marker:'not_hex!'}])assert.throws(()=>validate(input));
assert.deepEqual(validate({mode:'plant',namespace:ns,marker:'abcdef01'}),{mode:'plant',namespace:ns,bank:0,marker:'ABCDEF01'});
for(const marker of ['00000000','FFFFFFFF','89ABCDEF']){
 const payload=parseInt(marker,16)>>>0,tag=await checksum(ns,0,marker);
 const rows=Array.from({length:64},(_,bit)=>({bit,guess:bit<32?(payload>>>bit)&1:(tag>>>(bit-32))&1}));
 const decoded=decode(rows);assert.equal(decoded.candidate,marker);assert.equal(decoded.tag,tag);assert.deepEqual(decoded.ties,[]);
 const corrupted=structuredClone(rows);corrupted[3].guess^=1;assert.notEqual(await checksum(ns,0,decode(corrupted).candidate),decode(corrupted).tag);
 const tied=structuredClone(rows);tied[40].guess=null;assert.deepEqual(decode(tied).ties,[40]);
 assert.notEqual(await checksum(ns,1,marker),tag);assert.notEqual(await checksum(ns+'_other',0,marker),tag);
}
assert.throws(()=>decode([]));assert.equal((await runMarker({mode:'read',namespace:ns,marker:'12345678'})).status,'invalid-input');
const noGL={...globalThis,performance,crypto,document:{createElement:()=>({getContext:()=>null})}};
const unsupported=await runMarker({mode:'read',namespace:ns},noGL);assert.equal(unsupported.status,'unsupported');assert(unsupported.complete);
let time=0,lost=false,deletes=0;
const gl={VERTEX_SHADER:1,FRAGMENT_SHADER:2,LINK_STATUS:3,ARRAY_BUFFER:4,STATIC_DRAW:5,FLOAT:6,TRIANGLES:7,COLOR_BUFFER_BIT:8,RGBA:9,UNSIGNED_BYTE:10,NO_ERROR:0,
 createShader:()=>({}),createProgram:()=>({}),createBuffer:()=>({}),shaderSource(){},compileShader(){},attachShader(){},linkProgram(){},getProgramParameter:()=>true,getAttribLocation:()=>0,
 getExtension:name=>name==='WEBGL_lose_context'?{loseContext(){lost=true}}:null,isContextLost:()=>false,isProgram:()=>false,isShader:()=>false,
 bindBuffer(){},bufferData(){},viewport(){},clearColor(){},clear(){},useProgram(){},enableVertexAttribArray(){},vertexAttribPointer(){},drawArrays(){},readPixels(x,y,w,h,f,t,p){p.set([0,0,0,255])},getError:()=>0,deleteBuffer(){deletes++},deleteProgram(){deletes++},deleteShader(){deletes++}};
const uniform={performance:{now:()=>++time},crypto,document:{createElement:()=>({getContext:()=>gl,visibilityState:'visible'})},navigator:{userAgent:'controlled'},location:{origin:'https://test.local'},isSecureContext:true,setTimeout};
const weak=await runMarker({mode:'plant',namespace:ns,marker:'12345678'},uniform);assert.equal(weak.status,'inconclusive');assert.equal(weak.calibration.usable,false);assert(!weak.record);assert(weak.complete&&lost&&deletes>0);
const cancelled=await runMarker({mode:'read',namespace:ns},uniform,()=>{},AbortSignal.abort());assert.equal(cancelled.status,'cancelled');assert(cancelled.complete);
for(const route of ['/shader-cache','/shader-cache/','/shader-cache/app.js','/shader-cache/probe.js','/shader-cache/style.css']){
 const response=await worker.fetch(new Request('https://test.local'+route));assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');assert.equal(await(await worker.fetch(new Request('https://test.local'+route,{method:'HEAD'}))).text(),'');assert.equal((await worker.fetch(new Request('https://test.local'+route,{method:'POST'}))).status,405);
 assert(response.headers.get('content-security-policy').includes("connect-src 'none'"));
}
const html=await(await worker.fetch(new Request('https://test.local/shader-cache'))).text();assert(html.includes('Reader URL'));assert(!html.includes('%%'));assert(!html.includes('id="probe-complete"'));
const home=await(await worker.fetch(new Request('https://test.local/'))).text();assert(home.includes('12 tools / ready to run'));assert(home.includes('href="/shader-cache"'));
console.log(PROTOCOL+': passed input boundaries, blind-reader requirement, payload/tag corruption, ties, bank/namespace binding, unsupported/weak/cancelled cleanup, built routes and CSP.');
