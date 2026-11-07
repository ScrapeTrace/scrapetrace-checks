import {runMarker,validate,PROTOCOL} from './probe.js';

// Renewal preserves the recovered value in a new bank; it cannot restore a consumed bank.
export async function runOperation(input,scope=globalThis,onProgress=()=>{},signal,collect=runMarker){
 if(input.mode!=='read-renew')return collect(input,scope,onProgress,signal);
 const started=scope.performance.now();
 let options;
 try{
  options=validate({...input,mode:'read'});
  if(options.bank===63)throw Error('Read and renew requires bank 0–62. Bank 63 can only be read once.');
 }catch(error){return{protocol:PROTOCOL,operation:'read-renew',collectedAt:new Date().toISOString(),status:'invalid-input',complete:true,message:error.message,programsMeasured:0,elapsedMs:scope.performance.now()-started,renewal:{status:'skipped'}}}
 const recovered=await collect(options,scope,p=>onProgress({...p,phase:'read · '+p.phase}),signal);
 const result={...recovered,operation:'read-renew',renewal:{status:'skipped'}};
 if(recovered.status==='recovered'){
  const nextBank=options.bank+1;
  if(signal?.aborted){result.renewal={status:'cancelled',nextBank};result.message='Marker recovered, but renewal was cancelled. The current bank has been consumed.'}
  else{
   const planted=await collect({mode:'plant',namespace:options.namespace,bank:nextBank,marker:recovered.marker},scope,p=>onProgress({...p,phase:'renew · '+p.phase}),signal);
   result.renewal={status:planted.status,nextBank,result:planted};
   result.message=planted.status==='planted'?`Marker recovered and replanted in bank ${nextBank}. Use the next reader link. Renewal confirms planting, not a subsequent recovery.`:`Marker recovered, but renewal did not complete (${planted.status}). The current bank has been consumed.`;
  }
 }
 result.totalProgramsMeasured=(recovered.programsMeasured||0)+(result.renewal.result?.programsMeasured||0);
 result.totalElapsedMs=scope.performance.now()-started;
 return result;
}
