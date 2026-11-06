import {observe,compare} from './probe.js';
const $=id=>document.getElementById(id);let report,active=false,currentUtterance;
const put=(id,text)=>{$(id).textContent=text;};
function save(){window.__PROBE_RESULT__=report;put('report-json',JSON.stringify(report,null,2));put('events',JSON.stringify({pageSamples:report.page?.samples?.map(s=>({atMs:s.atMs,count:s.voices.length,status:s.status})),pageEvents:report.page?.events,frameEvents:report.frame?.events,playback:report.playback},null,2));}
function inventory(){
 const voices=report?.page?.final.voices||[],query=$('filter').value.toLowerCase();$('voices').replaceChildren();let shown=0;
 for(const v of voices){if(!`${v.name} ${v.lang} ${v.voiceURI}`.toLowerCase().includes(query))continue;shown++;const tr=document.createElement('tr');for(const value of [v.name,v.lang,v.localService?'Local':'Remote',v.default?'Yes':'—',v.voiceURI]){const td=document.createElement('td');td.textContent=value;tr.append(td);}$('voices').append(tr);}
 put('shown',`${shown} of ${voices.length} voices shown`);
}
function frameObservation(){
 const frame=document.createElement('iframe');frame.hidden=true;frame.title='Speech voice comparison';frame.src='/speech/frame';
 return new Promise(resolve=>{
  let finished=false;const finish=value=>{if(finished)return;finished=true;clearTimeout(timer);frame.remove();resolve(value);};
  const timer=setTimeout(()=>finish({status:'timeout'}),6500);
  frame.onload=()=>{try{const pending=frame.contentWindow.__SPEECH_FRAME__;if(!pending){finish({status:'error',error:'Frame collector did not start.'});return;}Promise.resolve(pending).then(value=>finish(value),e=>finish({status:'error',error:String(e)}));}catch(e){finish({status:'error',error:String(e)});}};
  frame.onerror=()=>finish({status:'error',error:'Frame failed to load.'});document.body.append(frame);
 });
}
async function run(){
 $('run').disabled=true;$('download').disabled=true;$('speak').disabled=true;$('voice').disabled=true;window.__PROBE_READY__=false;window.__PROBE_RESULT__=null;document.documentElement.dataset.probeReady='false';$('probe-complete')?.remove();put('status','Collecting voices for three seconds…');put('playback','Not run. No speech has been requested.');
 try{
  const [page,frame]=await Promise.all([observe(),frameObservation()]);
  const cross=compare(page.final,frame.final),voices=page.final.voices;
  report={schemaVersion:1,check:'speech',complete:true,measuredAt:new Date().toISOString(),userAgent:navigator.userAgent,page,frame,comparison:cross,playback:{status:'not-run'}};
  put('interfaces',`${Number(page.final.api.synthesis)+Number(page.final.api.utterance)} / 2`);put('count',page.final.status==='readable'?voices.length:'—');put('languages',new Set(voices.map(v=>v.lang)).size);put('services',`${voices.filter(v=>v.localService).length} / ${voices.filter(v=>!v.localService).length}`);
  put('headline',page.final.status==='readable'?(voices.length?'Speech voices returned':'No voices returned during observation'):page.final.status==='not-exposed'?'Speech synthesis is not exposed':'Voice collection could not complete');
  put('loading',`Initial: ${page.initial.voices.length} voices · Final: ${voices.length} · voiceschanged events: ${page.events.length} · List changed: ${page.changedDuringObservation?'yes':'no'}`);
  $('comparison').replaceChildren();
  for(const [label,value] of [['speechSynthesis',page.final.api.synthesis?'Exposed':'Not exposed'],['SpeechSynthesisUtterance',page.final.api.utterance?'Exposed':'Not exposed'],['Repeated page calls',page.repeated.status],['Repeated frame calls',frame.repeated?.status||frame.status],['Page ↔ frame values',cross.status],['Page ↔ frame order',cross.status==='not-compared'?'Not compared':cross.orderMatches?'Match':'Different']]){const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=label;dd.textContent=value;$('comparison').append(dt,dd);}
  $('voice').replaceChildren();voices.forEach((v,i)=>{const option=document.createElement('option');option.value=i;option.textContent=`${v.name} · ${v.lang}${v.default?' · default':''}`;$('voice').append(option);});if(!voices.length){const option=document.createElement('option');option.textContent='No voices returned';$('voice').append(option);}
  $('voice').disabled=!voices.length;$('speak').disabled=!voices.length||!page.final.api.utterance;
  inventory();save();$('download').disabled=false;window.__PROBE_READY__=true;document.documentElement.dataset.probeReady='true';const marker=document.createElement('p');marker.id='probe-complete';marker.dataset.status='complete';marker.textContent='Checks complete';$('status').after(marker);put('status','Silent collection complete');document.dispatchEvent(new CustomEvent('probe:ready',{detail:report,bubbles:true}));
 }catch(e){put('status',`Collection failed: ${e.message}`);}finally{$('run').disabled=false;}
}
$('filter').addEventListener('input',inventory);$('run').addEventListener('click',run);
$('download').addEventListener('click',()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='scrapetrace-speech.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
$('speak').addEventListener('click',()=>{
 if(active||!report)return;
 const events=[],began=performance.now();let timer,utterance,done=false;
 const finish=(status,error)=>{if(done)return;done=true;clearTimeout(timer);currentUtterance=null;active=false;$('run').disabled=false;$('speak').disabled=false;report.playback.status=status;if(error)report.playback.error=String(error);report.playback.elapsedMs=Math.round(performance.now()-began);put('playback',status==='completed'?'Utterance completed.':status==='timeout'?'No terminal event within 15 seconds. The request may still be pending.':`Speech test: ${status}${error?' · '+error:''}`);save();};
 try{
  const synth=window.speechSynthesis;if(synth.speaking||synth.pending||synth.paused){put('playback','Speech queue busy. Try again when it is idle.');report.playback={status:'busy'};save();return;}
  const chosen=report.page.final.voices[Number($('voice').value)],current=synth.getVoices().find(v=>['name','lang','voiceURI','default','localService'].every(k=>v[k]===chosen?.[k]));
  if(!current)throw new Error('Selected voice is no longer returned. Read again.');
  const text=$('text').value.trim();if(!text)throw new Error('Enter sample text first.');
  utterance=new SpeechSynthesisUtterance(text);currentUtterance=utterance;utterance.voice=current;utterance.lang=current.lang;utterance.rate=1;utterance.pitch=1;utterance.volume=1;
  report.playback={status:'requested',text,voice:chosen,rate:1,pitch:1,volume:1,events};
  for(const type of ['start','end','error','boundary','pause','resume'])utterance.addEventListener(type,e=>{if(done)return;if(events.length<200)events.push({type,atMs:Math.round(performance.now()-began),elapsedTime:e.elapsedTime,charIndex:e.charIndex,...(type==='error'?{error:e.error}:{})});if(type==='end')finish('completed');else if(type==='error')finish('error',e.error);else{put('playback',type==='start'?'Speech started…':`Speech event: ${type}`);save();}});
  active=true;$('run').disabled=true;$('speak').disabled=true;put('playback','Speech requested…');timer=setTimeout(()=>finish('timeout'),15000);synth.speak(utterance);save();
 }catch(e){report.playback={status:'error',events};finish('error',e.message);}
});
void run();
