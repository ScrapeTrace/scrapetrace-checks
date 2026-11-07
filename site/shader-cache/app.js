import {runOperation} from './workflow.js';
const $=id=>document.getElementById(id),params=new URLSearchParams(location.search);
let busy=false,controller,result;
const randomMarker=()=>crypto?.getRandomValues?crypto.getRandomValues(new Uint32Array(1))[0].toString(16).padStart(8,'0').toUpperCase():'00000000';
const newNamespace=()=>crypto?.getRandomValues?Array.from(crypto.getRandomValues(new Uint8Array(16)),x=>x.toString(16).padStart(2,'0')).join(''):'unsupported_crypto';
function syncLinks(){
 const url=mode=>{const u=new URL('/shader-cache',location.origin);u.searchParams.set('mode',mode);u.searchParams.set('namespace',$('namespace').value);u.searchParams.set('bank',$('bank').value);if(mode==='plant')u.searchParams.set('marker',$('marker').value);u.searchParams.set('autorun','1');return u.href};
 $('plant-url').value=url('plant');$('read-url').value=url('read');$('renew-url').value=url('read-renew');
}
function finish(value){
 if(value.renewal?.status==='planted')$('bank').value=String(value.renewal.nextBank);
 if(value.status==='planted'||value.status==='recovered'){$('marker').value=value.marker;syncLinks()}
 result=value;window.__PROBE_RESULT__=value;window.__PROBE_READY__=true;document.documentElement.dataset.probeReady='true';
 let marker=$('probe-complete');if(!marker){marker=document.createElement('p');marker.id='probe-complete';$('config').append(marker)}marker.dataset.status='complete';marker.textContent='Checks complete · '+value.status;
 $('headline').textContent=({planted:'Marker planted',recovered:'Valid marker recovered','no-valid-record':'No valid marker',inconclusive:'Timing signal inconclusive',unsupported:'Required API unavailable','invalid-input':'Check the test configuration',cancelled:'Run stopped',error:'Run failed'})[value.status]||value.status;
 if(value.operation==='read-renew'&&value.status==='recovered')$('headline').textContent=value.renewal.status==='planted'?'Marker recovered and renewed':'Marker recovered · renewal incomplete';
 $('renewal-result').textContent=value.operation==='read-renew'?(value.renewal.status==='planted'?`Planted in bank ${value.renewal.nextBank}`:value.renewal.status==='skipped'?'Not attempted':value.renewal.status):'Not requested';
 $('message').textContent=value.message;$('marker-result').textContent=value.marker||'—';$('integrity').textContent=value.status==='planted'?'Tag written':value.record?.valid?'Tag matched':value.status==='no-valid-record'?'No match':'Not evaluated';
 const c=value.calibration;$('separation').textContent=c?`${c.coldMedianMs.toFixed(2)} / ${c.warmMedianMs.toFixed(2)} ms`:'—';$('programs').textContent=String(value.totalProgramsMeasured??value.programsMeasured??0);$('renderer').textContent=value.environment?.renderer||'Not returned';
 $('report-json').textContent=JSON.stringify(value,null,2);$('progress').textContent='Finished · '+((value.totalElapsedMs??value.elapsedMs)/1000).toFixed(2)+' seconds';$('timings').replaceChildren();
 for(const row of value.record?.rows||[]){const tr=document.createElement('tr');const values=[row.bit<32?'Payload '+row.bit:'Tag '+(row.bit-32),row.timings?.[0]?.totalMs?.toFixed(3)??(row.value===0?row.timing.totalMs.toFixed(3):'—'),row.timings?.[1]?.totalMs?.toFixed(3)??(row.value===1?row.timing.totalMs.toFixed(3):'—'),row.guess===null?'Tie':row.guess??row.value];for(const value of values){const td=document.createElement('td');td.textContent=String(value);tr.append(td)}$('timings').append(tr)}
 $('download').disabled=false;document.dispatchEvent(new CustomEvent('probe:ready',{detail:value}));
}
async function run(mode,explicit){
 if(busy)return;busy=true;controller=new AbortController();window.__PROBE_READY__=false;window.__PROBE_RESULT__=null;document.documentElement.dataset.probeReady='false';$('probe-complete')?.remove();
 for(const id of ['plant','read','renew','fresh','namespace','bank','marker','download'])$(id).disabled=true;$('stop').disabled=false;$('headline').textContent=mode==='plant'?'Planting marker…':'Reading marker…';
 const options=explicit||{mode,namespace:$('namespace').value,bank:$('bank').value.trim()===''?NaN:Number($('bank').value),...(mode==='plant'?{marker:$('marker').value}:{} )};
 try{const value=await runOperation(options,window,p=>{$('progress').textContent=`${p.phase} · ${p.current} / ${p.total}`},controller.signal);finish(value)}
 finally{busy=false;for(const id of ['plant','read','renew','fresh','namespace','bank','marker'])$(id).disabled=false;$('stop').disabled=true}
}
$('namespace').value=params.get('namespace')??newNamespace();$('bank').value=params.get('bank')??'0';$('marker').value=params.get('marker')??randomMarker();syncLinks();
for(const id of ['namespace','bank','marker'])$(id).addEventListener('input',syncLinks);
$('config').addEventListener('submit',event=>event.preventDefault());$('plant').addEventListener('click',()=>run('plant'));$('read').addEventListener('click',()=>run('read'));$('renew').addEventListener('click',()=>run('read-renew'));$('fresh').addEventListener('click',()=>{$('namespace').value=newNamespace();$('marker').value=randomMarker();$('bank').value='0';syncLinks();$('progress').textContent='New namespace prepared. Ready for an independent test.'});
$('stop').addEventListener('click',()=>controller?.abort());$('download').addEventListener('click',()=>{if(!result)return;const url=URL.createObjectURL(new Blob([JSON.stringify(result,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='scrapetrace-shader-marker-'+Date.now()+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)});
if(params.get('autorun')==='1'){
 const mode=params.get('mode'),bank=params.has('bank')&&params.get('bank')!==''?Number(params.get('bank')):0;
 const explicit={mode,namespace:params.get('namespace'),bank,...(params.has('marker')?{marker:params.get('marker')}:{} )};
 run(mode,explicit);
}
