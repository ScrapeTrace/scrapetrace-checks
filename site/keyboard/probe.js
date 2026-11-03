// Reference character data adapted from Chromium 152.0.7977.82.
// Copyright 2015, 2018 The Chromium Authors. BSD license: CHROMIUM-LICENSE.txt.
export const KEY_ROWS = [
 ['Backquote','Digit1','Digit2','Digit3','Digit4','Digit5','Digit6','Digit7','Digit8','Digit9','Digit0','Minus','Equal','IntlYen'],
 ['KeyQ','KeyW','KeyE','KeyR','KeyT','KeyY','KeyU','KeyI','KeyO','KeyP','BracketLeft','BracketRight','Backslash'],
 ['KeyA','KeyS','KeyD','KeyF','KeyG','KeyH','KeyJ','KeyK','KeyL','Semicolon','Quote'],
 ['IntlBackslash','KeyZ','KeyX','KeyC','KeyV','KeyB','KeyN','KeyM','Comma','Period','Slash','IntlRo']
];
export const WRITING_KEYS = KEY_ROWS.flat();
export const US_CORE = Object.freeze({
 ...Object.fromEntries([...'abcdefghijklmnopqrstuvwxyz'].map(c=>['Key'+c.toUpperCase(),c])),
 ...Object.fromEntries([...'0123456789'].map(c=>['Digit'+c,c])),
 Backquote:'`',Minus:'-',Equal:'=',BracketLeft:'[',BracketRight:']',Backslash:'\\',Semicolon:';',Quote:"'",Comma:',',Period:'.',Slash:'/'
});
export const FALLBACK = Object.freeze({...US_CORE,IntlBackslash:'<',IntlYen:'¥'});
export function familyFromClaim(text) {
 if(typeof text!=='string')return 'unknown';
 if(/Android/i.test(text))return 'android';
 if(/Windows|^Win/i.test(text))return 'windows';
 if(/iPhone|iPad|iPod|macOS|Mac OS|MacIntel|Macintosh/i.test(text))return 'apple';
 if(/Linux|X11|CrOS|Chrome OS|Chromium OS/i.test(text))return 'unix';
 return 'unknown';
}
export function analyze(result) {
 if(result.status!=='measured')return {headline:result.status==='empty'?'The API returned an empty map':'Keyboard layout is unavailable',fallbackMatch:false,layoutFamily:'Unknown',originHint:'unknown',compatibility:'Not assessed',reason:'No usable map was returned. Missing, empty, denied and timed-out results do not identify an operating system or execution mode.'};
 const map=Object.fromEntries(result.entries);
 const own=key=>Object.hasOwn(map,key);
 const standardUS=Object.entries(US_CORE).every(([key,v])=>own(key)&&map[key]===v);
 const fallbackMatch=result.entries.length===49&&Object.entries(FALLBACK).every(([key,v])=>own(key)&&map[key]===v)&&!own('IntlRo');
 const topCodes=['KeyQ','KeyW','KeyE','KeyR','KeyT','KeyY'];
 const topComplete=topCodes.every(own);
 const topRow=topCodes.map(key=>map[key]??'').join('');
 const families={qwerty:'QWERTY',qwertz:'QWERTZ',azerty:'AZERTY',"',.pyf":'Dvorak',qwfpgj:'Colemak'};
 const layoutFamily=topComplete?(families[topRow.toLowerCase()]||'Other top-row arrangement'):'Incomplete top row';
 const signatures={'<':'unix','\\':'windows','§':'apple'};
 const westernProfileShape=result.entries.length===48&&!own('IntlYen')&&!own('IntlRo');
 const originHint=!fallbackMatch&&standardUS&&westernProfileShape?(signatures[map.IntlBackslash]||'unknown'):'unknown';
 const claims={userAgent:familyFromClaim(result.environment.userAgent),platform:familyFromClaim(result.environment.platform),clientHints:familyFromClaim(result.environment.clientHintPlatform)};
 const known=Object.values(claims).filter(f=>f!=='unknown');
 const claimConflict=new Set(known).size>1 && !known.every(f=>['android','unix'].includes(f));
 let compatibility='Not assessed',reason;
 if(fallbackMatch)reason='Every returned entry matches the 49-entry Chromium US fallback reference. A custom layout or override can reproduce it; the map does not expose the native producer. Headless mode is not established.';
 else if(!standardUS)reason='The 47 regular positions do not all match the reference US arrangement. Locale-specific and custom layouts can share edge characters, so platform inference is withheld.';
 else if(originHint==='unknown')reason='The regular positions match US, but IntlBackslash has no supported platform profile. Native provenance remains unknown.';
 else if(!known.length)reason='The map resembles a documented US platform profile, but the browser supplied no recognized platform claim to compare.';
 else if(claimConflict){compatibility='Claims differ';reason='The browser’s own platform claims differ. No single claimed family is selected as ground truth.';}
 else if(known.every(f=>f===originHint)){compatibility='Compatible with profile';reason='The US edge-key profile is compatible with the reported platform claims. This is a layout-dependent comparison, not OS verification.';}
 else{compatibility='Profile / claim difference';reason='The US edge-key profile and at least one browser platform claim differ. User-configured layouts and overrides can cause this; it does not prove spoofing.';}
 return {westernProfileShape,headline:fallbackMatch?'Chromium US fallback map match':originHint!=='unknown'?'US layout with a platform-shaped edge key':'Keyboard layout captured',fallbackMatch,standardUS,layoutFamily,topRow,originHint,claims,claimConflict,compatibility,reason,writingKeys:result.entries.filter(([key])=>WRITING_KEYS.includes(key)).length,missingKeys:WRITING_KEYS.filter(key=>!own(key)),unexpectedKeys:result.entries.filter(([key])=>!WRITING_KEYS.includes(key)).map(([key])=>key),referenceDifference:WRITING_KEYS.filter(key=>Object.hasOwn(FALLBACK,key)?!own(key)||map[key]!==FALLBACK[key]:own(key))};
}
export async function measure(host=globalThis,timeoutMs=5000) {
 const result={status:'pending',environment:{},api:{},entries:[]};
 let timer;
 try{
  const nav=host.navigator;
  for(const key of ['userAgent','platform','language']){try{result.environment[key]=nav?.[key]??null;}catch(error){result.environment[key]=null;}}
  try{result.environment.clientHintPlatform=nav?.userAgentData?.platform??null;}catch{result.environment.clientHintPlatform=null;}
  result.environment.secureContext=host.isSecureContext??null;
  result.environment.topLevel=host===host.top;
  const keyboard=nav?.keyboard;
  result.api.keyboardExposed=keyboard!=null;
  if(!keyboard){result.status=host.isSecureContext===false?'insecure-context':'keyboard-unavailable';return result;}
  const method=keyboard.getLayoutMap;result.api.methodType=typeof method;
  if(typeof method!=='function'){result.status='method-unavailable';return result;}
  try{result.api.nativeCodeMarker=/\[native code\]/.test(Function.prototype.toString.call(method));}catch{result.api.nativeCodeMarker=null;}
  const timeout=new Promise(resolve=>{timer=setTimeout(()=>resolve({timedOut:true}),timeoutMs);});
  const response=await Promise.race([Promise.resolve().then(()=>method.call(keyboard)).then(map=>({map})),timeout]);
  if(response.timedOut){result.status='timeout';return result;}
  const map=response.map;
  result.api.returnTag=Object.prototype.toString.call(map);
  result.api.constructorName=map?.constructor?.name??null;
  if(!map||typeof map.entries!=='function'){result.status='invalid-result';result.error={name:'UnexpectedReturnType',message:'Expected a map-like object with entries().'};return result;}
  const seen=new Set();
  for(const pair of map.entries()){
   if(!Array.isArray(pair)||pair.length!==2||typeof pair[0]!=='string'||typeof pair[1]!=='string'||seen.has(pair[0]))throw new TypeError('Layout entries must be unique string-code/string-value pairs.');
   if(result.entries.length>=512){result.status='invalid-result';result.error={name:'CollectionLimit',message:'Map exceeded the 512-entry collection limit.'};return result;}
   result.entries.push(pair);seen.add(pair[0]);
  }
  result.entries.sort(([a],[b])=>a.localeCompare(b));result.status=result.entries.length?'measured':'empty';return result;
 }catch(error){result.status=error.name==='SecurityError'||error.name==='NotAllowedError'?'denied':'error';result.error={name:error.name||'Error',message:String(error.message||error)};return result;}
 finally{clearTimeout(timer);}
}
