'use strict';
const $=s=>document.querySelector(s);let reports=[],stop=false,running=false;
$('#browser').textContent='Browser identity (self-reported): '+navigator.userAgent;
const med=xs=>[...xs].sort((a,b)=>a-b)[xs.length>>1];
const fmt=n=>Number.isFinite(n)?n.toFixed(3):'—';
function render(){
 $('#results').hidden=false;
 $('#rows').replaceChildren(...reports.map((r,i)=>{const row=document.createElement('tr');
 for(const text of [i+1,fmt(r.medianStrictMs)+' ms',fmt(r.medianRelaxedMs)+' ms',fmt(r.medianRatio),r.status==='measured'?r.inferredMode:'inconclusive',r.cleanup.status]){const td=document.createElement('td');td.textContent=text;row.append(td);}return row;}));
 const valid=reports.filter(r=>r.status==='measured'&&Number.isFinite(r.medianRatio));
 const low=valid.filter(r=>r.medianRatio<1.30).length;
 $('#ratio').textContent=valid.length?fmt(med(valid.map(r=>r.medianRatio))):'—';
 $('#classification').textContent=!valid.length?'Inconclusive':low===valid.length?'Private-like timing':low===0?'Normal-like timing':'Mixed timing signals';
 $('#spread').textContent=`${valid.length} measured runs; ${low} below 1.30; ${valid.length-low} at or above 1.30; ${reports.length-valid.length} inconclusive. Actual window mode and storage medium are unverified.`;
 $('#raw').textContent=JSON.stringify({schema:'scrapetrace/st005-series/v1',reports},null,2);
 window.__ST005_RESULT__={schema:'scrapetrace/st005-series/v1',complete:!running,reports};
}
$('#start').onclick=async()=>{
 if(running)return;running=true;stop=false;reports=[];window.__ST005_RESULT__={schema:'scrapetrace/st005-series/v1',complete:false,reports:[]};$('#results').hidden=true;$('#start').disabled=true;$('#stop').disabled=false;$('#runs').disabled=$('#order').disabled=true;
 const count=Number($('#runs').value);
 try{for(let i=0;i<count&&!stop;i++){
 $('#status').textContent=`Measuring run ${i+1} of ${count}… keep this tab visible.`;
 reports.push(await ST005.measure({order:$('#order').value}));render();
 }}catch(e){$('#status').textContent='Experiment failed: '+String(e);}
 finally{running=false;$('#start').disabled=false;$('#stop').disabled=true;$('#runs').disabled=$('#order').disabled=false;if(reports.length)render();$('#status').textContent=`Finished ${reports.length} run(s)${stop?' · stopped by you':''}. Read the uncertainty and cleanup columns.`;document.dispatchEvent(new CustomEvent('st005:complete',{detail:window.__ST005_RESULT__}));}
};
$('#stop').onclick=()=>{stop=true;$('#stop').disabled=true;$('#status').textContent='Stopping after the current bounded run and database cleanup…';};
$('#download').onclick=()=>{const blob=new Blob([$('#raw').textContent],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='scrapetrace-st005-'+new Date().toISOString().replace(/[:.]/g,'-')+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
