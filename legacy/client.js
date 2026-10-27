(() => {
'use strict';
const config = JSON.parse(document.getElementById('config').textContent);
const start = performance.now(), rows = [], samples = [], events = [], listeners = [];
let workload=null;
let battery, frame, ticker, done = false, acquisition = 'pending', realm = null, identity = null, integrity = null, error = null;
const $ = id => document.getElementById(id);
// Fetches do not block load, so they can remain pending until load actually fires.
// Three active requests also prevent a networkidle2 observer from returning early.
const networkGateControllers=[];
window.__NETWORK_GATE__={started:0,released:false,reason:null};
for(let slot=0;slot<3;slot++) {
 const controller=new AbortController();networkGateControllers.push(controller);
 window.__NETWORK_GATE__.started++;
 void fetch(`/api/network-gate?run=${encodeURIComponent(config.runId)}&slot=${slot}&ms=${config.gateMs+15000}`,{signal:controller.signal,cache:'no-store'})
  .then(response=>{if(!response.ok)throw new Error('Network gate unavailable');return response.text();})
  .catch(error=>{if(error.name!=='AbortError'){window.__NETWORK_GATE__.error=String(error);}});
}
function releaseNetworkGate() {
 if(window.__NETWORK_GATE__.released)return;
 window.__NETWORK_GATE__.released=true;window.__NETWORK_GATE__.reason='page-loaded-and-test-complete';
 for(const controller of networkGateControllers)controller.abort();
}

const elapsed = () => Math.round(performance.now() - start);
const safe = v => v === Infinity ? 'Infinity' : Number.isNaN(v) ? 'NaN' : v === -Infinity ? '-Infinity' : v;
const snapshot = b => ({level:safe(b.level),charging:b.charging,chargingTime:safe(b.chargingTime),dischargingTime:safe(b.dischargingTime)});
const add = (name,status,detail) => rows.push({name,status,detail});
const env = {userAgent:navigator.userAgent,platform:navigator.platform,languages:[...navigator.languages],webdriver:navigator.webdriver,hardwareConcurrency:navigator.hardwareConcurrency,deviceMemory:navigator.deviceMemory ?? null,secureContext:isSecureContext,visibility:document.visibilityState,screen:{width:screen.width,height:screen.height,pixelRatio:devicePixelRatio},timezone:Intl.DateTimeFormat().resolvedOptions().timeZone};
function sample(reason) { if(!battery || done)return; try {samples.push({ms:elapsed(),reason,...(config.workload?{phase:workload?.phase()||'baseline'}:{}),visibility:document.visibilityState,...snapshot(battery)});}catch(e){error=String(e);}}
function cell(row,value) {const td=document.createElement('td');td.textContent=value;row.append(td);}
function time(v) {return v === 'Infinity' ? 'Unknown / unlimited' : typeof v === 'number' ? `${Math.round(v)} s` : String(v ?? 'Unavailable');}
function assess() {
 if(config.kind === 'environment') {
  add('Secure context',env.secureContext?'consistent':'review',String(env.secureContext));
  add('Automation disclosure',env.webdriver?'observed':'inconclusive',env.webdriver?'navigator.webdriver is true. Automation is disclosed; this is not proof of an emulator.':'No automation disclosure. This does not rule out automation.');
  add('Battery API exposure',typeof navigator.getBattery === 'function'?'observed':'unsupported','API exposure depends on browser, policy and secure context.');
  add('Display and touch','observed',`${screen.width} × ${screen.height}, ${navigator.maxTouchPoints} touch points. These values can be emulated.`);
  return 'Environment recorded';
 }
 add('Battery API access',acquisition==='available'?'consistent':acquisition, error || (acquisition==='available'?'BatteryManager resolved.':'No battery readings available. Unsupported or blocked access is not evidence of spoofing.'));
 if(!samples.length) return acquisition==='available'?'Inconclusive':'Battery unavailable';
 const a=samples[0], z=samples.at(-1);
 const malformed=samples.some(s=>typeof s.level!=='number'||!Number.isFinite(s.level)||s.level<0||s.level>1||typeof s.charging!=='boolean'||![s.chargingTime,s.dischargingTime].every(t=>t==='Infinity'||(typeof t==='number'&&Number.isFinite(t)&&t>=0)));
 add('Value ranges',malformed?'suspicious':'consistent',malformed?'At least one reading violates the BatteryManager value contract.':'Level, state and time estimates have valid types and ranges.');
 const contradiction=samples.some(s=>(s.charging&&s.dischargingTime!=='Infinity')||(!s.charging&&s.chargingTime!=='Infinity')||(s.level===1&&s.chargingTime!==0));
 add('State consistency',contradiction?'suspicious':'consistent',contradiction?'Charging state and time estimates contradict the published API contract. Browser bugs or overrides are possible.':'Charging state and time estimates agree with the API contract.');
 const defaults=samples.every(s=>s.level===1&&s.charging&&s.chargingTime===0&&s.dischargingTime==='Infinity');
 add('Default battery signature',defaults?'inconclusive':'observed',defaults?'Fully charged / plugged in is also the specified fallback for unavailable battery information or no battery.':'Readings differ from the API fallback signature. This does not prove physical hardware.');
 add('Repeated access',identity===true?'consistent':identity===false?'review':'inconclusive',identity===true?'Repeated calls returned the same promise and BatteryManager.':identity===false?'Repeated calls did not preserve expected identity. Review overrides or browser differences.':'Identity check could not complete.');
 add('API surface',integrity?.nativeLike?'consistent':'review',integrity?JSON.stringify(integrity):'API inspection did not complete. Native-looking functions can still be spoofed.');
 if(realm?.snapshot){const r=realm.snapshot; const mismatch=typeof r.level!=='number'||Math.abs(r.level-z.level)>.02||r.charging!==z.charging;
 add('Fresh iframe comparison',mismatch?'review':'consistent',mismatch?'Fresh iframe and main document differ; a genuine state transition during capture is also possible.':'Fresh iframe agrees within 2 percentage points. Both realms may still be overridden.');}
 else add('Fresh iframe comparison','inconclusive',realm?.error||'Fresh iframe did not return battery evidence within the acquisition budget.');
 const delta=z.level-a.level, uninterrupted=samples.every(s=>s.charging===false)&&!events.some(e=>e.type==='chargingchange');
 const down=typeof delta==='number'&&delta<0&&uninterrupted;
 add('Observed discharge',down?'observed':'inconclusive',down?`Reported level fell by ${(-delta*100).toFixed(3)} percentage points across ${(z.ms-a.ms)/1000} s while all samples reported discharging. This is behavioral evidence, not hardware attestation.`:delta===0?'No level drop observed. Rounding, short duration, AC power or a static override can all explain this.':delta<0?'Level fell, but charging transitions prevent a clean discharge comparison.':'No uninterrupted discharge observed. Charging or estimation changes may explain a rise.');
 add('Battery events',events.some(e=>e.trusted===false)?'review':events.length?'observed':'inconclusive',`${events.length} events; ${events.filter(e=>e.trusted).length} trusted. Missing events during an unchanged interval are normal. Trusted events are not hardware attestation.`);
 const estimate=typeof a.dischargingTime==='number'&&a.dischargingTime>0?(a.level*(z.ms-a.ms)/1000/a.dischargingTime*100):null;
 add('Estimate comparison','inconclusive',estimate===null?'No finite runtime estimate for comparison.':`A constant-rate estimate suggests ~${estimate.toFixed(4)} percentage points over this window. Runtime predictions and rounded levels need not track linearly.`);
 add('Observation conditions','observed',`${samples.length} samples; ${((z.ms-a.ms)/1000).toFixed(1)} seconds; ${samples.filter(s=>s.visibility!=='visible').length} hidden samples. Background throttling can reduce coverage.`);
 add('Automation disclosure',env.webdriver?'observed':'inconclusive',`navigator.webdriver = ${String(env.webdriver)}. This is separate from battery authenticity.`);
 return rows.some(r=>r.status==='suspicious')?'Suspicious battery readings':down?'Discharge behavior observed':'Battery authenticity inconclusive';
}
function render(reason) {
 if(done)return;
 sample('final');done=true;clearInterval(ticker);
 for(const [target,type,fn] of listeners)target.removeEventListener(type,fn);
 frame?.remove();
 workload?.finish();
 let verdict=assess();
 if(workload){
  const w=workload.stats;
  for(const phase of ['baseline','workload','recovery']){
   const values=samples.filter(s=>s.phase===phase),first=values[0],last=values.at(-1);
   const summary={sampleCount:values.length,levelDelta:first&&last?last.level-first.level:null,runtimeEstimateChanges:values.filter((v,i)=>i&&v.dischargingTime!==values[i-1].dischargingTime).length,hiddenSamples:values.filter(v=>v.visibility!=='visible').length};
   (w.summaries??={})[phase]=summary;
   add(phase+' battery response',values.length?'observed':'inconclusive',JSON.stringify(summary));
  }
  add('CPU workload execution',w.cpu.iterations>0?'observed':'inconclusive',JSON.stringify(w.cpu));
  add('GPU workload execution',w.gpu.drawCalls>0&&w.gpu.readback?'observed':'inconclusive',JSON.stringify(w.gpu));
  add('Workload interpretation','inconclusive','Temporal changes are not proof of a causal response or physical hardware. No change does not establish spoofing. Software rendering is possible.');
  verdict=w.stopped?'Workload interrupted — comparison incomplete':'Workload observation complete — authenticity inconclusive';
 }
 const report={schema:'browser-checks/v1',ready:true,kind:config.kind,verdict,physicalBatteryVerified:false,completion:reason,requestedObservationSeconds:config.seconds,durationMs:elapsed(),acquisition,environment:env,...(workload?{workload:workload.stats}:{}),integrity,identity,realm,samples,events,checks:rows,limitations:['A webpage cannot attest a physical battery.','Spoofed values can change over time and across realms.','No percentage change is not evidence of spoofing.','Browser rounding, privacy protections and defaults may hide battery state.']};
 window.__PROBE_RESULT__=report;
 $('report-json').textContent=JSON.stringify(report,null,2);
 $('verdict').textContent=verdict;
 $('sample-count').textContent=String(samples.length);
 $('duration').textContent=(report.durationMs/1000).toFixed(1)+'s';
 $('findings-count').textContent=String(rows.filter(r=>['review','suspicious'].includes(r.status)).length);
 const z=samples.at(-1);
 $('battery-level').textContent=z&&typeof z.level==='number'?(z.level*100).toFixed(1)+'%':'—';
 $('battery-state').textContent=z?(z.charging?'Reported charging':'Reported discharging'):'No battery evidence';
 $('battery-fill').style.width=z&&typeof z.level==='number'?`${Math.max(0,Math.min(100,z.level*100))}%`:'0%';
 $('charge-time').textContent=z?time(z.chargingTime):'Unavailable';
 $('discharge-time').textContent=z?time(z.dischargingTime):'Unavailable';
 $('verdict').dataset.tone=rows.some(r=>r.status==='suspicious')?'warn':'neutral';
 for(const row of rows){const tr=document.createElement('tr');cell(tr,row.name);cell(tr,row.status);cell(tr,row.detail);$('checks').append(tr);}
 const valid=samples.filter(s=>typeof s.level==='number'&&Number.isFinite(s.level));
 if(valid.length){const lo=Math.min(...valid.map(s=>s.level)),hi=Math.max(...valid.map(s=>s.level)),span=Math.max(.01,hi-lo),base=(lo+hi-span)/2;
 $('trace').setAttribute('points',valid.map(s=>`${16+((s.ms-valid[0].ms)/Math.max(1,valid.at(-1).ms-valid[0].ms))*668},${112-((s.level-base)/span)*86}`).join(' '));
 $('trace-caption').textContent=`${(valid[0].level*100).toFixed(2)}% → ${(valid.at(-1).level*100).toFixed(2)}% · scale expanded to at least 1 percentage point`;
 }
 $('environment').textContent=JSON.stringify(env,null,2);
 $('pending').hidden=true;$('results').hidden=false;
 document.documentElement.dataset.probeReady='true';
 document.dispatchEvent(new CustomEvent('probe:ready',{detail:report}));
 $('export').disabled=false;
 $('export').onclick=()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=`${config.kind}-report.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
}
// Insert a visible selector only once both navigation and the observation finish.
function completionMarker() {
 const report=window.__PROBE_RESULT__;
 if(document.readyState!=='complete'||!report?.ready||report.completion!=='observation-complete'||$('probe-complete'))return;
 const marker=document.createElement('div');
 marker.id='probe-complete';marker.className='pill';marker.setAttribute('role','status');
 marker.dataset.status='complete';marker.textContent='Page loaded · test complete';
 $('results').append(marker);
 releaseNetworkGate();
}
window.addEventListener('load',completionMarker,{once:true});
document.addEventListener('probe:ready',completionMarker);
window.__finishProbe=render;
window.__PROBE_READY__=new Promise(resolve=>document.addEventListener('probe:ready',e=>resolve(e.detail),{once:true}));
async function acquire() {
 if(config.kind==='environment'){acquisition='not-requested';return;}
 if(typeof navigator.getBattery!=='function'){acquisition='unsupported';return;}
 try {
  const p=navigator.getBattery();
  battery=await Promise.race([p,new Promise((_,reject)=>setTimeout(()=>reject(new Error('Battery API timed out after 3000 ms')),3000))]);
  if(done)return;
  acquisition='available';sample('initial');
  for(const type of ['chargingchange','levelchange','chargingtimechange','dischargingtimechange']) {const fn=e=>{if(done)return;events.push({ms:elapsed(),type,trusted:e.isTrusted});sample(type);};battery.addEventListener(type,fn);listeners.push([battery,type,fn]);}
  Promise.resolve(navigator.getBattery()).then(b=>{if(!done)identity=(p===navigator.getBattery()&&b===battery);}).catch(()=>{});
  const desc=Object.getOwnPropertyDescriptor(Navigator.prototype,'getBattery');
  integrity={nativeLike:/\[native code\]/.test(Function.prototype.toString.call(navigator.getBattery)),ownNavigatorProperty:Object.hasOwn(navigator,'getBattery'),prototypeMethod:!!desc,managerTag:Object.prototype.toString.call(battery)};
  frame=document.createElement('iframe');frame.hidden=true;frame.title='Fresh battery comparison';
  frame.onload=async()=>{try{const w=frame.contentWindow;const peer=await Promise.race([w.navigator.getBattery(),new Promise((_,reject)=>setTimeout(()=>reject(new Error('Iframe API timeout')),2000))]);if(!done)realm={ms:elapsed(),snapshot:snapshot(peer)};}catch(e){if(!done)realm={error:String(e)};}};
  frame.src='/realm';document.body.append(frame);
 } catch(e) {acquisition=/timed out/.test(String(e))?'timeout':e?.name==='NotAllowedError'?'blocked':'error';error=String(e);}
}
ticker=setInterval(()=>{sample('poll');$('progress').value=Math.min(100,elapsed()/(config.seconds*1000+3000)*100);$('remaining').textContent=Math.max(0,Math.ceil(config.seconds+3-elapsed()/1000))+'s remaining';},1000);
if(config.workload)workload=window.createBatteryWorkload(config,sample);
void acquire();
})();
