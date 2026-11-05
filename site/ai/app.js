import {FEATURES,inspect,measure,summarize,errorInfo} from './probe.js';
const $=id=>document.getElementById(id);
const make=(tag,text,className)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=text;if(className)node.className=className;return node;};
const availabilityNames={'pending':'Checking…','not-exposed':'Not exposed','incomplete-interface':'Interface incomplete','available':'Available','downloadable':'Download needed','downloading':'Downloading','unavailable':'Unavailable','unknown':'Unknown response','error':'Call failed','timeout':'Timed out','stopped':'Stopped'};
const functionalNames={'pending':'Waiting','running':'Running…','not-run':'Not run','passed':'Functional check passed','needs-click':'Click to retry','unexpected-result':'Unexpected response','error':'Call failed','timeout':'Timed out','stopped':'Stopped'};
let rows=FEATURES.map(spec=>inspect(spec)),latest=null,controller=null,running=false;
const expanded=new Set();
function signal(list,label,value,tone='tone-muted'){const div=make('div',undefined,'signal');div.append(make('dt',label),make('dd',value,tone));list.append(div);}
function detail(details,title,value){details.append(make('h3',title),make('pre',typeof value==='string'?value:JSON.stringify(value,null,2)));}
function render(){
 const count=summarize(rows);
 $('exposed').textContent=`${count.exposed} / ${count.total}`;$('available').textContent=`${count.available} / ${count.total}`;$('functional').textContent=`${count.functional} / ${count.total}`;
 $('headline').textContent=running?'Checking built-in AI features':count.functional?`${count.functional} ${count.functional===1?'feature returned a response':'features returned responses'}`:count.exposed?'AI interfaces reported':'No built-in AI APIs exposed';
 $('reason').textContent=running?'Reading availability and trying ready models.':count.functional?'Session creation and sample responses completed. Expand a feature for its results.':count.exposed?'See each feature for model availability and the result of any attempted call.':'None of the seven checked interfaces is exposed on this page.';
 const fragment=document.createDocumentFragment();
 for(const row of rows){
  const spec=FEATURES.find(s=>s.id===row.id),card=make('section',undefined,'feature');card.dataset.feature=row.id;
  const heading=make('div',undefined,'feature-heading'),title=make('div');title.append(make('h2',row.name),make('p',row.id+' · '+row.description,'api-name'));const link=make('a','API docs ↗','docs');link.href='https://developer.chrome.com/docs/ai/'+spec.docs;heading.append(title,link);card.append(heading);
  const signals=make('dl',undefined,'signals');signal(signals,'API interface',row.api.exposed?'Exposed':'Not exposed',row.api.exposed?'tone-good':'tone-muted');
  signal(signals,'Model availability',availabilityNames[row.availability.status]||row.availability.status,row.availability.status==='available'?'tone-good':'tone-muted');
  signal(signals,'Execution',functionalNames[row.functional.status]||row.functional.status,row.functional.status==='passed'?'tone-good':['error','timeout','unexpected-result'].includes(row.functional.status)?'tone-wait':'tone-muted');card.append(signals);
  const note=row.functional.status==='passed'?`create() → ${row.method}() returned a valid response${row.functional.responseMs!==undefined?' · '+row.functional.responseMs+' ms':''}.`:row.functional.error?.message||row.availability.error?.message||({downloadable:'No session started. This API reports a model download is needed.',downloading:'No session started while model files are downloading.',unavailable:'No session started for the tested options.', 'incomplete-interface':'The availability() or create() method is missing.'}[row.availability.status])||(row.api.exposed?'':'The interface is absent from this page.');
  if(note)card.append(make('p',note,'functional-note'));
  if(row.availability.status==='available'&&row.functional.status!=='passed'){
   const retry=make('button','Retry this API with a click','secondary retry');retry.disabled=running;retry.addEventListener('click',()=>void run(row.id));card.append(retry);
  }
  const details=make('details');details.open=expanded.has(row.id);details.addEventListener('toggle',()=>{if(details.isConnected){if(details.open)expanded.add(row.id);else expanded.delete(row.id);}});details.append(make('summary','Input, output and session checks'));
  detail(details,'Test options',row.options);detail(details,'Sample input',row.input);
  if(row.functional.output)detail(details,'Returned output',row.functional.output);
  if(row.checks.length){const list=make('ul',undefined,'check-list');for(const check of row.checks)list.append(make('li',`${check.label}: ${check.status}${check.error?.name?' ('+check.error.name+')':''}`));details.append(make('h3','Session behavior'),list);}
  if(row.functional.error)detail(details,'Execution error',row.functional.error);
  if(row.availability.error)detail(details,'Availability error',row.availability.error);
  detail(details,'Cleanup',row.cleanup);card.append(details);fragment.append(card);
 }
 $('features').replaceChildren(fragment);
}
function publish(complete){
 latest={schema:'scrapetrace/built-in-ai/v1',capturedAt:new Date().toISOString(),complete,ready:complete,environment:{secureContext:isSecureContext,visibility:document.visibilityState,userAgent:navigator.userAgent,language:navigator.language,userActivation:navigator.userActivation?.isActive??null},policy:{automaticDownloads:false,availabilityTimeoutMs:3000,functionalTimeoutMs:20000,overallTimeoutMs:65000,maxConcurrentSessions:2},summary:summarize(rows),features:structuredClone(rows)};
 window.__PROBE_RESULT__=latest;window.__PROBE_READY__=complete;document.documentElement.dataset.probeReady=String(complete);$('report-json').textContent=JSON.stringify(latest,null,2);$('download').disabled=!complete;
 if(complete){let marker=$('probe-complete');if(!marker){marker=make('p');marker.id='probe-complete';$('status').after(marker);}marker.dataset.status='complete';marker.textContent='Checks complete';document.dispatchEvent(new CustomEvent('probe:ready',{detail:latest}));}
 else $('probe-complete')?.remove();
}
async function run(only){
 if(running)return;
 running=true;controller=new AbortController();$('run').disabled=true;$('stop').disabled=false;$('status').textContent='Checking APIs and ready models…';
 const specs=only?FEATURES.filter(s=>s.id===only):FEATURES;
 if(!only)rows=specs.map(spec=>inspect(spec));
 publish(false);render();
 try{
  await measure({specs,signal:controller.signal,onUpdate:update=>{for(const row of update){const i=rows.findIndex(r=>r.id===row.id);rows[i]=row;}publish(false);render();}});
 }catch(error){for(const row of rows)if(['running','pending'].includes(row.functional.status))row.functional={status:'error',error:errorInfo(error)};}
 finally{running=false;controller=null;$('run').disabled=false;$('stop').disabled=true;$('status').textContent='Snapshot ready · '+new Date().toLocaleTimeString();render();publish(true);}
}
$('run').addEventListener('click',()=>void run());$('stop').addEventListener('click',()=>controller?.abort(new DOMException('Stopped by user','AbortError')));
$('download').addEventListener('click',()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(latest,null,2)],{type:'application/json'})),link=make('a');link.href=url;link.download='scrapetrace-built-in-ai.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
addEventListener('pagehide',()=>controller?.abort(new DOMException('Page closed','AbortError')),{once:true});
void run();
