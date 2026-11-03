import {KEY_ROWS,WRITING_KEYS,FALLBACK,analyze,measure} from './probe.js';
const $=id=>document.getElementById(id);
const text=value=>value===null||value===undefined?'Unavailable':String(value);
const shown=value=>value===''?'Empty string':value===' '?'Space':value;
function el(tag,value,className){const n=document.createElement(tag);if(value!==undefined)n.textContent=value;if(className)n.className=className;return n;}
let latest,generation=0,loaded=false;
const gates=[];
window.__NETWORK_GATE__={started:0,released:false};
for(let slot=0;slot<3;slot++){
 const controller=new AbortController();gates.push(controller);window.__NETWORK_GATE__.started++;
 void fetch('/api/network-gate?ms=15000&slot='+slot,{signal:controller.signal,cache:'no-store'}).then(r=>r.text()).catch(error=>{if(error.name!=='AbortError')window.__NETWORK_GATE__.error=String(error);});
}
function release(){if(loaded&&window.__PROBE_READY__){for(const gate of gates)gate.abort();window.__NETWORK_GATE__.released=true;}}
function render(result,a){
 const usable=['measured','empty'].includes(result.status),map=Object.fromEntries(result.entries),has=key=>Object.hasOwn(map,key);
 $('headline').textContent=a.headline;$('reason').textContent=a.reason;
 const count=usable?result.entries.filter(([key])=>WRITING_KEYS.includes(key)).length:null;
 $('key-count').textContent=usable?`${count} / 50 positions · ${result.entries.length} total entries`:'No usable map';
 $('keyboard').replaceChildren();
 for(const keys of KEY_ROWS){const row=el('div',undefined,'key-row');for(const key of keys){
  const present=usable&&has(key),keycap=el('div',undefined,'key'+(key.startsWith('Intl')?' edge':'')+(!present?' absent':''));
  const character=usable?(present?shown(map[key]):'—'):'?';
  keycap.tabIndex=0;keycap.title=`${key}: ${usable?(present?JSON.stringify(map[key]):'absent'):'not read'}`;keycap.setAttribute('aria-label',keycap.title);
  keycap.append(el('span',character,'character'),el('small',key));row.append(keycap);
 }$('keyboard').append(row);}
 $('edge-keys').replaceChildren();
 for(const key of ['IntlBackslash','IntlYen','IntlRo']){const card=el('div',undefined,'edge-card');card.append(el('h3',key),el('strong',usable?(has(key)?shown(map[key]):'Absent'):'Not read'));$('edge-keys').append(card);}
 const facts=[
  ['API outcome',result.status],
  ['Keys returned',usable?`${result.entries.length} total; ${count} of 50 writing-system positions`:'No usable result'],
  ['Layout family',result.status==='measured'?`${a.layoutFamily} · top row ${JSON.stringify(a.topRow)}`:'Unknown'],
  ['Backquote',usable?(has('Backquote')?JSON.stringify(map.Backquote):'Absent'):'Not read'],
  ['Complete fallback-table match',result.status==='measured'?(a.fallbackMatch?'Yes · all 49 entries and exact values':'No'):'Not assessed'],
  ['Platform-shaped US profile',a.fallbackMatch?'Unknown · fallback-compatible values':a.originHint==='unix'?'Resembles Linux / ChromeOS US profile':a.originHint==='windows'?'Resembles Windows US profile':a.originHint==='apple'?'Resembles macOS US profile':'Unknown / not assessed'],
  ['Native producer', 'Not directly observable from this API'],
  ['Platform compatibility',a.compatibility],
  ['UA family / platform family / client-hint family',a.claims?`${a.claims.userAgent} / ${a.claims.platform} / ${a.claims.clientHints}`:'Not assessed'],
  ['User-Agent',result.environment.userAgent],
  ['navigator.platform',result.environment.platform],
  ['UA-CH platform',result.environment.clientHintPlatform],
  ['Return-object tag',result.api.returnTag],
  ['Method native-code marker',result.api.nativeCodeMarker===null||result.api.nativeCodeMarker===undefined?'Unavailable':`${result.api.nativeCodeMarker} · diagnostic only`],
  ...(result.error?[['Error',`${result.error.name}: ${result.error.message}`]]:[])
 ];
 $('facts').replaceChildren();for(const[label,v]of facts){const item=el('div',undefined,'fact');item.append(el('dt',label),el('dd',text(v)));$('facts').append(item);}
 $('rows').replaceChildren();
 for(const key of [...WRITING_KEYS,...(a.unexpectedKeys||[])]){
  const row=el('tr'),label=el('th',key);label.scope='row';const ref=Object.hasOwn(FALLBACK,key);
  const comparison=!usable?'Not assessed':has(key)===ref&&(!ref||map[key]===FALLBACK[key])?'Matches reference':'Differs from reference';
  const cell=el('td',comparison,comparison.startsWith('Differs')?'different':'');
  row.append(label,el('td',!usable?'Not read':has(key)?JSON.stringify(map[key]):'Absent'),el('td',ref?JSON.stringify(FALLBACK[key]):'Absent'),cell);$('rows').append(row);
 }
}
function publish(result){
 const analysis=analyze(result);render(result,analysis);
 latest={version:1,tool:'keyboard-layout',reference:'Chromium 152.0.7977.82',capturedAt:new Date().toISOString(),...result,analysis,complete:true,ready:true};
 window.__PROBE_RESULT__=latest;window.__PROBE_READY__=true;
 $('report-json').textContent=JSON.stringify(latest,null,2);$('status').textContent='Snapshot complete · '+result.status;
 const old=$('probe-complete');old?.remove();const marker=el('p','Keyboard layout collection complete');marker.id='probe-complete';marker.dataset.status='complete';$('status').after(marker);
 document.documentElement.dataset.probeReady='true';document.dispatchEvent(new CustomEvent('probe:ready',{detail:latest}));
 $('run').disabled=false;$('download').disabled=false;release();
}
async function run(){
 const runId=++generation;$('run').disabled=true;$('download').disabled=true;$('probe-complete')?.remove();
 window.__PROBE_READY__=false;window.__PROBE_RESULT__=null;document.documentElement.removeAttribute('data-probe-ready');
 $('status').textContent='Reading keyboard layout…';$('headline').textContent='Waiting for the layout map';$('reason').textContent='The API has a five-second collection deadline.';
 const result=await measure();if(runId===generation)publish(result);
}
window.__KEYBOARD_GATE__=()=>{
 if(!window.__PROBE_READY__){generation++;publish({status:'timeout',environment:{secureContext:globalThis.isSecureContext},api:{},entries:[],error:{name:'NavigationDeadline',message:'No completed API result was available at the navigation gate.'}});}
};
addEventListener('load',()=>{loaded=true;window.__KEYBOARD_GATE__();release();},{once:true});
addEventListener('pagehide',()=>{for(const gate of gates)gate.abort();},{once:true});
$('run').addEventListener('click',run);
$('download').addEventListener('click',()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(latest,null,2)],{type:'application/json'}));const link=el('a');link.href=url;link.download='scrapetrace-keyboard-layout.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
void run();
