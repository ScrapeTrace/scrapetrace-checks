export function read(scope=globalThis){
 const result={status:'not-exposed',api:{synthesis:false,utterance:false},voices:[]};
 try{
  result.api.synthesis=!!scope.speechSynthesis;
  result.api.utterance=typeof scope.SpeechSynthesisUtterance==='function';
  if(!result.api.synthesis)return result;
  const synth=scope.speechSynthesis;
  result.state={pending:synth.pending,speaking:synth.speaking,paused:synth.paused};
  if(typeof synth.getVoices!=='function'){result.status='incomplete-interface';return result;}
  const voices=synth.getVoices();
  if(!Array.isArray(voices)||voices.length>1000)throw new Error('Unexpected voice list or more than 1,000 entries.');
  result.voices=voices.map(v=>{
   if(!v||['name','lang','voiceURI'].some(k=>typeof v[k]!=='string')||['default','localService'].some(k=>typeof v[k]!=='boolean'))throw new Error('Unexpected voice entry.');
   return {name:v.name,lang:v.lang,voiceURI:v.voiceURI,default:v.default,localService:v.localService};
  });result.status='readable';
 }catch(e){result.status='error';result.error={name:String(e?.name||'Error'),message:String(e?.message||e).slice(0,1000)};}
 return result;
}
export function compare(a,b){
 if(a?.status!=='readable'||b?.status!=='readable')return {status:'not-compared'};
 const encode=v=>JSON.stringify(v),left=a.voices.map(encode),right=b.voices.map(encode);
 const ordered=encode(left)===encode(right),same=encode([...left].sort())===encode([...right].sort());
 return {status:same?'match':'different',orderMatches:ordered,leftCount:left.length,rightCount:right.length};
}
export async function observe(scope=globalThis,{durationMs=3000,intervalMs=250}={}){
 const began=performance.now(),samples=[],events=[];
 const sample=()=>{const value=read(scope);samples.push({atMs:Math.round(performance.now()-began),...value});return value;};
 const changed=()=>{if(events.length<100)events.push({type:'voiceschanged',atMs:Math.round(performance.now()-began)});};
 let synth,attached=false;
 try{synth=scope.speechSynthesis;if(synth?.addEventListener){synth.addEventListener('voiceschanged',changed);attached=true;}}catch{}
 try{
  const initial=sample();
  if(initial.status==='readable'){
   const count=Math.max(1,Math.ceil(durationMs/intervalMs));
   for(let i=0;i<count;i++){await new Promise(r=>setTimeout(r,durationMs/count));sample();}
  }
  const repeated=[sample(),sample(),sample()];
  return {initial,final:repeated.at(-1),samples,events,elapsedMs:Math.round(performance.now()-began),repeated:{status:repeated.every(s=>s.status==='readable')?(repeated.slice(1).every(s=>compare(repeated[0],s).status==='match'&&compare(repeated[0],s).orderMatches)?'match':'different'):'not-compared'},changedDuringObservation:samples.slice(1).some(s=>compare(initial,s).status==='different'||compare(initial,s).orderMatches===false)};
 }finally{if(attached)synth.removeEventListener('voiceschanged',changed);}
}
