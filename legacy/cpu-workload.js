self.onmessage = event => {
 const durationMs=Math.min(30000,Math.max(0,Number(event.data.durationMs)||0));
 const started=performance.now();let batches=0,iterations=0,busyMs=0,checksum=.1;
 function batch(){
  if(performance.now()-started>=durationMs){self.postMessage({status:'completed',batches,iterations,busyMs,checksum});return;}
  const begin=performance.now();
  while(performance.now()-begin<20){for(let i=0;i<1000;i++){checksum=Math.sin(checksum+i*.001)+Math.sqrt(Math.abs(checksum)+1);iterations++;}}
  busyMs+=performance.now()-begin;batches++;
  if(batches%5===0)self.postMessage({status:'running',batches,iterations,busyMs,checksum});
  setTimeout(batch,30);
 }
 self.postMessage({status:'running',batches,iterations,busyMs,checksum});batch();
};
