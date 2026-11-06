import assert from 'node:assert/strict';
import {read,observe,compare} from '../site/speech/probe.js';
import worker from '../dist/_worker.js';
const voice={name:'Fixture',lang:'en-US',voiceURI:'fixture:test',localService:true,default:true};
const scope=list=>({SpeechSynthesisUtterance:class {},speechSynthesis:Object.assign(new EventTarget(),{getVoices:()=>list,pending:false,speaking:false,paused:false})});
assert.equal(read({}).status,'not-exposed');assert.equal(read({speechSynthesis:{}}).status,'incomplete-interface');
assert.equal(read(scope([{}])).status,'error');assert.equal(read(scope(Array(1001).fill(voice))).status,'error');
const broken=scope([]);broken.speechSynthesis.getVoices=()=>{throw new Error('fixture');};assert.equal(read(broken).status,'error');
const empty=await observe(scope([]),{durationMs:10,intervalMs:5});assert.equal(empty.final.status,'readable');assert.equal(empty.final.voices.length,0);
const ready=read(scope([voice]));assert.equal(compare(ready,ready).status,'match');assert.equal(compare(read({}),read({})).status,'not-compared');assert.equal(compare(ready,empty.final).status,'different');
const other={...voice,name:'Second'};const reversed=compare(read(scope([voice,other])),read(scope([other,voice])));assert.equal(reversed.status,'match');assert.equal(reversed.orderMatches,false);
const changing=scope([]);setTimeout(()=>{changing.speechSynthesis.getVoices=()=>[voice];changing.speechSynthesis.dispatchEvent(new Event('voiceschanged'));},5);
const delayed=await observe(changing,{durationMs:25,intervalMs:5});assert.equal(delayed.initial.voices.length,0);assert.equal(delayed.final.voices.length,1);assert.equal(delayed.events.length,1);assert.equal(delayed.changedDuringObservation,true);assert.equal(delayed.repeated.status,'match');
let n=0;const unstable=scope([]);unstable.speechSynthesis.getVoices=()=>++n%2?[voice]:[];assert.equal((await observe(unstable,{durationMs:1})).repeated.status,'different');
for(const path of ['/speech','/speech/','/speech/frame','/speech/app.js','/speech/frame.js','/speech/probe.js','/speech/style.css']){
 const response=await worker.fetch(new Request('https://test.local'+path));assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');assert.equal(await (await worker.fetch(new Request('https://test.local'+path,{method:'HEAD'}))).text(),'');assert.equal((await worker.fetch(new Request('https://test.local'+path,{method:'POST'}))).status,405);
}
const response=await worker.fetch(new Request('https://test.local/speech'));assert(response.headers.get('content-security-policy').includes("frame-src 'self'"));assert(response.headers.get('content-security-policy').includes("frame-ancestors 'none'"));assert((await worker.fetch(new Request('https://test.local/speech/frame'))).headers.get('content-security-policy').includes("frame-ancestors 'self'"));
const html=await response.text();assert(!html.includes('%%'));assert(!html.includes('id="probe-complete"'));assert(html.includes('Not measured yet'));
const hub=await (await worker.fetch(new Request('https://test.local/'))).text();assert(hub.includes('11 tools / ready to run'));assert(hub.includes('href="/speech"'));
console.log('Speech collector and Worker checks passed: missing/incomplete/error/empty/delayed/unstable voices, order, comparison, routes and frame CSP.');
