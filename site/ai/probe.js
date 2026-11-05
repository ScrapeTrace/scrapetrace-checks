// Public browser APIs only. Availability is separate from successful execution.
const ENGLISH = {expectedInputLanguages:['en'],expectedContextLanguages:['en'],outputLanguage:'en'};
export const FEATURES = [
 {id:'LanguageModel',name:'Language model',description:'Prompt API',method:'prompt',options:{expectedInputs:[{type:'text',languages:['en']}],expectedOutputs:[{type:'text',languages:['en']}]},input:'In one short sentence, describe a blue bicycle.',docs:'prompt-api'},
 {id:'Summarizer',name:'Summarizer',description:'Condense text',method:'summarize',options:{...ENGLISH,type:'tldr',format:'plain-text',length:'short'},input:'The local library opens at nine in the morning. It offers books, study rooms and free workshops. On Saturdays it closes at four in the afternoon.',docs:'summarizer-api'},
 {id:'Writer',name:'Writer',description:'Generate text',method:'write',options:{...ENGLISH,tone:'neutral',format:'plain-text',length:'short'},input:'Write one short sentence inviting a friend to a library workshop.',docs:'writer-api'},
 {id:'Rewriter',name:'Rewriter',description:'Revise text',method:'rewrite',options:{...ENGLISH,tone:'more-formal',format:'plain-text',length:'as-is'},input:'Hey, come to our library workshop on Saturday.',docs:'rewriter-api'},
 {id:'Proofreader',name:'Proofreader',description:'Correct text',method:'proofread',options:{expectedInputLanguages:['en']},input:'She go to the library every Saturday.',docs:'proofreader-api'},
 {id:'LanguageDetector',name:'Language detector',description:'Identify text language',method:'detect',options:{},input:'The library has books and quiet rooms for reading.',docs:'language-detection'},
 {id:'Translator',name:'Translator',description:'English → French',method:'translate',options:{sourceLanguage:'en',targetLanguage:'fr'},input:'The library is open today.',docs:'translator-api'}
];
const STATES = new Set(['available','downloadable','downloading','unavailable']);
function problem(name,message){return Object.assign(new Error(message),{name});}
export function errorInfo(error){
 const read=key=>{try{return typeof error?.[key]==='string'?error[key].slice(0,1200):null;}catch{return null;}};
 return {name:read('name')||'Error',message:read('message')||String(typeof error)};
}
function stopped(signal){if(signal?.aborted)throw signal.reason||problem('AbortError','Check stopped.');}
// Attach handlers even to late promises, so timeouts cannot cause unhandled rejections.
function bounded(task,ms,signal){
 return new Promise((resolve,reject)=>{
  let done=false;
  const finish=(fn,value)=>{if(done)return;done=true;clearTimeout(timer);signal?.removeEventListener('abort',abort);fn(value);};
  const abort=()=>finish(reject,signal.reason||problem('AbortError','Check stopped.'));
  const timer=setTimeout(()=>finish(reject,problem('TimeoutError','The call exceeded its deadline.')),ms);
  signal?.addEventListener('abort',abort,{once:true});
  if(signal?.aborted){abort();return;}
  try{Promise.resolve(task()).then(value=>finish(resolve,value),error=>finish(reject,error));}catch(error){finish(reject,error);}
 });
}
function asyncCall(receiver,method,args){
 const value=receiver[method](...args);
 if(!value||typeof value.then!=='function')throw problem('UnexpectedResult','The API call did not return a promise.');
 return value;
}
export function inspect(spec,scope=globalThis){
 const row={id:spec.id,name:spec.name,description:spec.description,method:spec.method,options:structuredClone(spec.options),input:spec.input,api:{exposed:false},availability:{status:'pending'},functional:{status:'pending'},checks:[],cleanup:{status:'not-created'}};
 try{
  row.api.exposed=spec.id in scope;
  if(!row.api.exposed){row.availability.status='not-exposed';row.functional.status='not-run';return row;}
  const api=scope[spec.id];row.api.type=typeof api;
  row.api.availability=typeof api?.availability==='function';row.api.create=typeof api?.create==='function';
  if(!row.api.availability||!row.api.create){row.availability.status='incomplete-interface';row.functional.status='not-run';}
 }catch(error){row.availability={status:'error',error:errorInfo(error)};row.functional.status='not-run';}
 return row;
}
export async function availability(spec,row,scope=globalThis,{signal,timeoutMs=3000}={}){
 if(row.availability.status!=='pending')return row;
 try{
  const value=await bounded(()=>asyncCall(scope[spec.id],'availability',[structuredClone(spec.options)]),timeoutMs,signal);
  row.availability={status:STATES.has(value)?value:'unknown',reported:typeof value==='string'?value.slice(0,200):null};
  row.functional.status=value==='available'?'pending':'not-run';
 }catch(error){row.availability={status:error?.name==='TimeoutError'?'timeout':signal?.aborted?'stopped':'error',error:errorInfo(error)};row.functional.status='not-run';}
 return row;
}
export function validOutput(id,value){
 if(id==='LanguageDetector')return Array.isArray(value)&&value.length>0&&value.length<=1000&&value.every(item=>typeof item?.detectedLanguage==='string'&&item.detectedLanguage.length>0&&typeof item.confidence==='number'&&Number.isFinite(item.confidence)&&item.confidence>=0&&item.confidence<=1);
 if(id==='Proofreader')return value!==null&&typeof value==='object'&&typeof value.correctedInput==='string'&&value.correctedInput.trim().length>0&&Array.isArray(value.corrections);
 return typeof value==='string'&&value.trim().length>0;
}
function snapshotOutput(id,value){
 if(typeof value==='string')return {text:value.slice(0,4000),characters:value.length,truncated:value.length>4000};
 if(id==='LanguageDetector')return {candidates:value.slice(0,100).map(item=>({detectedLanguage:item.detectedLanguage,confidence:item.confidence})),count:value.length,truncated:value.length>100};
 return {correctedInput:value.correctedInput.slice(0,4000),correctionCount:value.corrections.length,truncated:value.correctedInput.length>4000};
}
function dispose(session){if(typeof session?.destroy!=='function')throw problem('UnexpectedResult','No session destroy method.');session.destroy();}
export async function exercise(spec,row,scope=globalThis,{signal,timeoutMs=20000,checkTimeoutMs=1000}={}){
 if(row.availability.status!=='available')return row;
 const controller=new AbortController(),relay=()=>controller.abort(signal.reason||problem('AbortError','Check stopped.'));
 signal?.addEventListener('abort',relay,{once:true});if(signal?.aborted)relay();
 const timer=setTimeout(()=>controller.abort(problem('TimeoutError','The functional check exceeded its deadline.')),timeoutMs);
 let session,phase='create',destroyed=false,creating;
 const began=performance.now();row.functional={status:'running',phase};
 try{
  stopped(controller.signal);
  // A ready-only create can still reject for user activation, policy or resource reasons.
  creating=asyncCall(scope[spec.id],'create',[{...structuredClone(spec.options),signal:controller.signal}]);
  void Promise.resolve(creating).then(late=>{if(controller.signal.aborted){try{dispose(late);}catch{}}},()=>{});
  session=await bounded(()=>creating,timeoutMs,controller.signal);
  row.cleanup.status='pending';
  if(!session||typeof session[spec.method]!=='function'||typeof session.destroy!=='function')throw problem('UnexpectedResult','The session is missing its operation or destroy method.');
  phase='response';
  const output=await bounded(()=>asyncCall(session,spec.method,[spec.input,{signal:controller.signal}]),timeoutMs,controller.signal);
  if(!validOutput(spec.id,output))throw problem('UnexpectedResult','The operation returned an empty or unexpected response shape.');
  row.functional={status:'passed',output:snapshotOutput(spec.id,output),responseMs:Math.round(performance.now()-began)};
  // Record small API behavior checks without relying on version-specific error messages.
  async function expectRejection(id,label,call){
   try{await bounded(call,checkTimeoutMs,controller.signal);row.checks.push({id,label,status:'different',outcome:'fulfilled'});}
   catch(error){if(controller.signal.aborted)throw error;row.checks.push({id,label,status:error?.name==='TimeoutError'?'timeout':id==='receiver'&&error?.name!=='TypeError'?'different':'passed',outcome:'rejected',error:errorInfo(error)});}
  }
  phase='session-checks';
  const prototype=Object.getPrototypeOf(session),method=prototype?.[spec.method];
  if(typeof method==='function')await expectRejection('receiver','Invalid receiver rejected',()=>method.call(Object.create(prototype),spec.input));
  else row.checks.push({id:'receiver',label:'Invalid receiver rejected',status:'not-run',reason:'Operation not present on the session prototype.'});
  const reason=new DOMException('ScrapeTrace cancellation check','AbortError');
  await expectRejection('abort','Aborted operation rejected',()=>session[spec.method](spec.input,{signal:AbortSignal.abort(reason)}));
  phase='destroy';session.destroy();destroyed=true;row.cleanup.status='destroyed';
  await expectRejection('destroy','Destroyed session rejected',()=>session[spec.method](spec.input));
 }catch(error){
  const status=controller.signal.aborted?(controller.signal.reason?.name==='TimeoutError'?'timeout':'stopped'):error?.name==='NotAllowedError'?'needs-click':error?.name==='UnexpectedResult'?'unexpected-result':'error';
  // A received response remains visible if a later lifecycle check times out.
  if(row.functional.status==='passed')row.checks.push({id:'session-checks',label:'Remaining session checks',status,error:errorInfo(error)});
  else row.functional={status,phase,error:errorInfo(error)};
 }finally{
  clearTimeout(timer);signal?.removeEventListener('abort',relay);
  if(session&&!destroyed){try{dispose(session);row.cleanup.status='destroyed';}catch(error){row.cleanup={status:'error',error:errorInfo(error)};}}
  else if(!session&&creating)row.cleanup.status='late-session-disposal-requested';
  // Stops outstanding work, including a create() that resolves after its deadline.
  if(!controller.signal.aborted)controller.abort();
  row.functional.elapsedMs=Math.round(performance.now()-began);
 }
 return row;
}
export async function measure({scope=globalThis,specs=FEATURES,signal,onUpdate=()=>{},availabilityTimeoutMs=3000,functionalTimeoutMs=20000,runTimeoutMs=65000}={}){
 const controller=new AbortController(),relay=()=>controller.abort(signal.reason||problem('AbortError','Check stopped.'));
 signal?.addEventListener('abort',relay,{once:true});if(signal?.aborted)relay();
 const timer=setTimeout(()=>controller.abort(problem('TimeoutError','The overall check deadline was reached.')),runTimeoutMs);
 const rows=specs.map(spec=>inspect(spec,scope));
 const notify=()=>onUpdate(rows);
 try{
  notify();
  await Promise.all(rows.map(async(row,index)=>{await availability(specs[index],row,scope,{signal:controller.signal,timeoutMs:availabilityTimeoutMs});notify();}));
  let next=0;
  const work=async()=>{
   while(next<rows.length){
    const index=next++,row=rows[index];
    if(row.availability.status!=='available')continue;
    if(controller.signal.aborted){row.functional={status:controller.signal.reason?.name==='TimeoutError'?'timeout':'stopped',phase:'queue'};continue;}
    const pending=exercise(specs[index],row,scope,{signal:controller.signal,timeoutMs:functionalTimeoutMs});notify();await pending;notify();
   }
  };
  await Promise.all([work(),work()]);
 }finally{clearTimeout(timer);signal?.removeEventListener('abort',relay);}
 return rows;
}
export function summarize(rows){return {total:rows.length,exposed:rows.filter(r=>r.api.exposed).length,available:rows.filter(r=>r.availability.status==='available').length,functional:rows.filter(r=>r.functional.status==='passed').length};}
