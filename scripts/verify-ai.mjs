import assert from 'node:assert/strict';
import {FEATURES,inspect,availability,exercise,measure,validOutput,summarize} from '../site/ai/probe.js';
import worker from '../dist/_worker.js';
const checks=[];
const spec=FEATURES.find(s=>s.id==='LanguageDetector');
const output=[{detectedLanguage:'en',confidence:.99},{detectedLanguage:'und',confidence:.01}];
function fixture(state='available'){
 let created=0,destroyed=0;
 class API {
  static async availability(){return state;}
  static async create(options){created++;return new API(options.signal);}
  constructor(signal){this.alive=true;this.signal=signal;}
  async detect(input,{signal}={}){if(!(this instanceof API)||!Object.hasOwn(this,'alive'))throw new TypeError('Illegal invocation');if(!this.alive)throw new DOMException('Destroyed','AbortError');if(signal?.aborted)throw signal.reason;return output;}
  destroy(){if(this.alive)destroyed++;this.alive=false;}
 }
 return {scope:{LanguageDetector:API},get created(){return created;},get destroyed(){return destroyed;}};
}
let row=inspect(spec,{});assert.equal(row.api.exposed,false);assert.equal(row.availability.status,'not-exposed');
row=inspect(spec,{LanguageDetector:{}});assert.equal(row.api.exposed,true);assert.equal(row.availability.status,'incomplete-interface');
const throws={};Object.defineProperty(throws,'LanguageDetector',{get(){throw new Error('controlled getter');}});assert.equal(inspect(spec,throws).availability.status,'error');
checks.push('missing, incomplete and throwing API interfaces remain distinct');
for(const state of ['unavailable','downloadable','downloading','not-a-state']){
 const f=fixture(state),rows=await measure({scope:f.scope,specs:[spec]});assert.equal(rows[0].availability.status,state==='not-a-state'?'unknown':state);assert.equal(rows[0].functional.status,'not-run');assert.equal(f.created,0);
}
checks.push('non-ready and unknown availability never call create or request downloads');
let f=fixture();row=(await measure({scope:f.scope,specs:[spec]}))[0];
assert.equal(row.functional.status,'passed');assert.equal(row.checks.length,3);assert(row.checks.every(c=>c.status==='passed'));assert.equal(row.cleanup.status,'destroyed');assert.equal(f.created,f.destroyed);
checks.push('session creation, response shape, receiver rejection, cancellation, destruction and cleanup');
for(const feature of FEATURES){
 const value=feature.id==='LanguageDetector'?output:feature.id==='Proofreader'?{correctedInput:'She goes to the library.',corrections:[]}:'A valid sample response.';
 assert(validOutput(feature.id,value));assert(!validOutput(feature.id,null));assert(!validOutput(feature.id,''));
}
assert(!validOutput('LanguageDetector',[{detectedLanguage:'en',confidence:NaN}]));assert(!validOutput('LanguageDetector',[{detectedLanguage:'en',confidence:2}]));
checks.push('all seven feature response shapes; empty and malformed results rejected');
f=fixture();f.scope.LanguageDetector.availability=()=> 'available';row=await availability(spec,inspect(spec,f.scope),f.scope);assert.equal(row.availability.status,'error');
f=fixture();f.scope.LanguageDetector.availability=()=>Promise.reject(new Error('controlled availability error'));row=await availability(spec,inspect(spec,f.scope),f.scope);assert.equal(row.availability.status,'error');
f=fixture();f.scope.LanguageDetector.availability=()=>new Promise(()=>{});row=await availability(spec,inspect(spec,f.scope),f.scope,{timeoutMs:5});assert.equal(row.availability.status,'timeout');
f=fixture();f.scope.LanguageDetector.create=async()=>{throw new DOMException('User activation needed','NotAllowedError');};row=inspect(spec,f.scope);await availability(spec,row,f.scope);await exercise(spec,row,f.scope);assert.equal(row.functional.status,'needs-click');
checks.push('non-promise availability, call rejection, availability timeout and user-activation error');
f=fixture();f.scope.LanguageDetector.prototype.detect=async()=>[];row=(await measure({scope:f.scope,specs:[spec]}))[0];assert.equal(row.functional.status,'unexpected-result');assert.equal(f.created,f.destroyed);
f=fixture();f.scope.LanguageDetector.create=async()=>({detect:async()=>output});row=(await measure({scope:f.scope,specs:[spec]}))[0];assert.equal(row.functional.status,'unexpected-result');assert.equal(row.cleanup.status,'error');
checks.push('empty output and incomplete sessions cannot pass; cleanup errors retained');
let lateDestroyed=0;
const late={LanguageDetector:{availability:async()=> 'available',create:()=>new Promise(resolve=>setTimeout(()=>resolve({destroy(){lateDestroyed++;}}),30))}};
row=(await measure({scope:late,specs:[spec],functionalTimeoutMs:5}))[0];assert.equal(row.functional.status,'timeout');await new Promise(resolve=>setTimeout(resolve,45));assert.equal(lateDestroyed,1);
f=fixture();f.scope.LanguageDetector.prototype.detect=()=>new Promise(()=>{});row=(await measure({scope:f.scope,specs:[spec],functionalTimeoutMs:5}))[0];assert.equal(row.functional.status,'timeout');assert.equal(f.created,f.destroyed);
checks.push('create and operation deadlines dispose of sessions, including late creation');
let active=0,peak=0;
const scope=Object.fromEntries(FEATURES.map(feature=>[feature.id,{
 availability:async()=> 'available',create:async()=>{active++;peak=Math.max(peak,active);await new Promise(r=>setTimeout(r,5));return {async [feature.method](){return feature.id==='LanguageDetector'?output:feature.id==='Proofreader'?{correctedInput:'Correct.',corrections:[]}:'Response';},destroy(){active--;}};}
}]));
const all=await measure({scope});assert.equal(summarize(all).functional,7);assert.equal(peak,2);assert.equal(active,0);assert(all.every(r=>r.checks.some(c=>c.status==='different')));
checks.push('at most two simultaneous sessions; simple returning wrappers show session behavior differences');
const stop=new AbortController();stop.abort();const stopped=await measure({scope:fixture().scope,specs:[spec],signal:stop.signal});assert.equal(stopped[0].availability.status,'stopped');
f=fixture();f.scope.LanguageDetector.prototype.detect=()=>new Promise(()=>{});row=(await measure({scope:f.scope,specs:[spec],runTimeoutMs:5}))[0];assert.equal(row.functional.status,'timeout');
checks.push('manual cancellation and overall run budget finish explicitly');
for(const path of ['/ai','/ai/','/ai/app.js','/ai/probe.js','/ai/style.css']){
 const response=await worker.fetch(new Request('https://test.local'+path));assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');
 const head=await worker.fetch(new Request('https://test.local'+path,{method:'HEAD'}));assert.equal(await head.text(),'');
 assert.equal((await worker.fetch(new Request('https://test.local'+path,{method:'POST'}))).status,405);
}
const html=await (await worker.fetch(new Request('https://test.local/ai'))).text();assert(!html.includes('%%'));assert(html.includes('Not measured yet'));assert(!html.includes('id="probe-complete"'));assert(html.includes('/ai/app.js'));
const hub=await (await worker.fetch(new Request('https://test.local/'))).text();assert(hub.includes('12 tools / ready to run'));assert(hub.includes('href="/ai"'));
checks.push('new route, assets, HEAD/POST behavior, no initial measurement and hub/navigation integration');
console.log(checks.join('\n')+'\nPassed '+checks.length+' groups. Browser/UI verification is separate.');
