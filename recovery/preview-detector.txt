/*
IndexedDB timing mechanism adapted from detectIncognito.js
https://github.com/Joe12387/detectIncognito
MIT License

Copyright (c) 2021 - 2026 Joe Rutkowski

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/
/* ST—005 research instrumentation. A timing signal is not proof of mode or medium. */
(function (root) {
  'use strict';
  const median = xs => [...xs].sort((a,b)=>a-b)[xs.length >> 1]; // upstream upper median
  async function measure(options = {}) {
    const config = {payloadBytes:16384, writes:15, maxRounds:15, minRounds:7,
      softCapMs:1000, threshold:1.30, order:'relaxed-first', timeoutMs:15000, ...options};
    if (!['relaxed-first','alternating'].includes(config.order) ||
        !Number.isInteger(config.maxRounds) || config.maxRounds < 7 || config.maxRounds > 100 ||
        config.minRounds !== 7 || config.payloadBytes !== 16384 || config.writes !== 15 ||
        !Number.isFinite(config.softCapMs) || config.softCapMs < 0 || config.softCapMs > 60000 ||
        config.threshold !== 1.30 || config.timeoutMs < 1000 || config.timeoutMs > 120000)
      throw new Error('Invalid bounded experiment configuration');
    const result = {schema:'scrapetrace/st005/v1', startedAt:new Date().toISOString(), config,
      environment:{userAgent:navigator.userAgent, platform:navigator.platform,
        secureContext:isSecureContext, visibility:document.visibilityState,
        hardwareConcurrency:navigator.hardwareConcurrency, webdriver:navigator.webdriver},
      status:'inconclusive', signal:null, inferredMode:'unknown', actualPrivateModeVerified:false,
      storageMediumVerified:false, warmups:[], rounds:[], cleanup:{status:'not-created'},
      caveats:[
        'Ratio measures transaction completion latency, not physical fsync or RAM residency.',
        'Below 1.30 matches the detectIncognito private-context heuristic; it does not prove private mode.',
        'Browser backend, filesystem, CPU load, timer precision and scheduling can alter the ratio.',
        'Durability property recognition does not prove the underlying device honored a hardware flush.',
        'No bot conclusion follows from this signal. Browser identity is self-reported.'
      ]};
    let db, active, opening, abandoned=false;
    const name='__st005_'+crypto.randomUUID();
    result.databaseName=name;
    const deadline=performance.now()+config.timeoutMs;
    let visibilityChanged=false;
    const changed=()=>{visibilityChanged=true;};
    document.addEventListener('visibilitychange',changed);
    const bounded=(start,ms,label)=>new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>{abandoned=true;try{active?.abort();}catch{};reject(new Error(label+' timeout'));},ms);
      start(v=>{clearTimeout(timer);resolve(v);},e=>{clearTimeout(timer);reject(e);});
    });
    const remove=()=>bounded((ok,fail)=>{
      const request=indexedDB.deleteDatabase(name);
      request.onsuccess=()=>ok('deleted');
      request.onerror=()=>fail(request.error || new Error('delete failed'));
      request.onblocked=()=>{ result.cleanup.blocked=true; };
    },5000,'cleanup');
    try {
      if (!root.indexedDB) throw new Error('IndexedDB unavailable');
      if (!/Chrome\//.test(navigator.userAgent)) throw new Error('Chromium technique: browser not validated');
      db=await bounded((ok,fail)=>{
        opening=indexedDB.open(name,1);
        opening.onupgradeneeded=()=>opening.result.createObjectStore('s');
        opening.onerror=()=>fail(opening.error);
        opening.onblocked=()=>fail(new Error('database open blocked'));
        opening.onsuccess=()=>{
          if(abandoned){opening.result.close(); void remove().catch(()=>{});return;}
          ok(opening.result);
        };
      },5000,'open');
      db.onversionchange=()=>db.close();
      result.cleanup.status='pending';
      // Abort and await each probe transaction so it cannot leak into timing samples.
      for(const durability of ['strict','relaxed']) {
        await bounded((ok,fail)=>{
          const tx=db.transaction('s','readwrite',{durability});
          const recognized=tx.durability===durability;
          tx.onabort=()=>recognized?ok():fail(new Error(durability+' durability unsupported'));
          tx.onerror=()=>fail(tx.error);
          tx.abort();
        },3000,'durability probe');
      }
      result.durabilityRecognized=true;
      const payload=new Uint8Array(config.payloadBytes);
      const block=durability=>bounded((ok,fail)=>{
        const t0=performance.now();let i=0; const commits=[];
        const step=()=>{
          if (i===config.writes) {active=null;ok({durability,elapsedMs:performance.now()-t0,commitsMs:commits});return;}
          if(abandoned || performance.now()>deadline){fail(new Error('measurement deadline exceeded'));return;}
          try {
            const begin=performance.now();
            const tx=active=db.transaction('s','readwrite',{durability});
            tx.oncomplete=()=>{commits.push(performance.now()-begin);step();};
            tx.onabort=tx.onerror=()=>fail(tx.error || new Error('transaction aborted'));
            tx.objectStore('s').put(payload,i++);
          } catch(e) {fail(e);}
        }; step();
      },Math.max(1,deadline-performance.now()),'block');
      const start=performance.now();
      result.warmups.push(await block('relaxed'),await block('strict'));
      for(let i=0;i<config.maxRounds;i++) {
        const order=config.order==='alternating' && i%2?['strict','relaxed']:['relaxed','strict'];
        const values={};for(const d of order)values[d]=await block(d);
        const rel=values.relaxed.elapsedMs,str=values.strict.elapsedMs;
        const ratio=rel>0?str/rel:null;
        result.rounds.push({round:i+1,order,relaxed:values.relaxed,strict:values.strict,ratio});
        if(result.rounds.length>=config.minRounds && performance.now()-start>=config.softCapMs)break;
      }
      result.elapsedMs=performance.now()-start;
      const ratios=result.rounds.map(x=>x.ratio);
      if(ratios.some(x=>x===null || !Number.isFinite(x)))throw new Error('Insufficient timer resolution');
      result.medianRatio=median(ratios);
      result.medianRelaxedMs=median(result.rounds.map(x=>x.relaxed.elapsedMs));
      result.medianStrictMs=median(result.rounds.map(x=>x.strict.elapsedMs));
      result.signal=result.medianRatio<config.threshold?'low-durability-separation':'higher-durability-separation';
      result.inferredMode=result.medianRatio<config.threshold?'private-like heuristic':'normal-like heuristic';
      result.status=visibilityChanged || document.visibilityState!=='visible'?'inconclusive':'measured';
      if(result.status==='inconclusive')result.caveats.push('Page visibility changed or was hidden during this measurement.');
    } catch(e) {
      result.error=String(e?.message || e);
      result.status='inconclusive';result.inferredMode='unknown';
    } finally {
      abandoned=true;
      document.removeEventListener('visibilitychange',changed);
      try{active?.abort();}catch{}
      try{db?.close();}catch{}
      if(root.indexedDB) {
        try {result.cleanup.status=await remove();}
        catch(e){result.cleanup.status='failed';result.cleanup.error=String(e?.message || e);}
      }
      result.environment.visibilityChanged=visibilityChanged;
      result.finishedAt=new Date().toISOString();
    }
    return result;
  }
  root.ST005={measure};
})(globalThis);
