window.createBatteryWorkload = function(config, onBoundary) {
 const now=()=>performance.now(), began=now(), phaseMs=config.phaseSeconds*1000;
 const stats={phase:'baseline',phaseSeconds:config.phaseSeconds,stopped:false,stopReason:null,phases:[{phase:'baseline',startedMs:0}],cpu:{status:'not-started',workers:1,targetDutyCycle:.4,batches:0,iterations:0,busyMs:0,checksum:0},gpu:{status:'not-started',api:'WebGL',width:256,height:256,drawCalls:0,readback:null,renderer:null},visibilityChanges:[]};
 let worker,gl,program,buffer,canvas,raf,timers=[],lastFrame=0,disposed=false;
 const label=document.getElementById('workload-phase'), detail=document.getElementById('workload-live'), stop=document.getElementById('stop-workload');
 const update=()=>{label.textContent=stats.phase.toUpperCase();detail.textContent=`CPU: ${stats.cpu.status}, ${stats.cpu.batches} batches · GPU: ${stats.gpu.status}, ${stats.gpu.drawCalls} draws`;};
 const setPhase=phase=>{const ms=Math.round(now()-began);stats.phases.at(-1).endedMs=ms;stats.phase=phase;stats.phases.push({phase,startedMs:ms});onBoundary('phase-'+phase);update();};
 function stopLoad() {
  if(worker){worker.terminate();worker=null;if(stats.cpu.status==='running')stats.cpu.status='completed';}
  cancelAnimationFrame(raf);
  if(gl){try{const pixel=new Uint8Array(4);gl.readPixels(0,0,1,1,gl.RGBA,gl.UNSIGNED_BYTE,pixel);stats.gpu.readback=[...pixel];if(stats.gpu.status==='running')stats.gpu.status='completed';}catch(e){stats.gpu.error=String(e);stats.gpu.status='error';}try{gl.deleteProgram(program);gl.deleteBuffer(buffer);gl.getExtension('WEBGL_lose_context')?.loseContext();}catch{}gl=null;}
  canvas?.remove();
 }
 function stopAll(reason){if(disposed)return;disposed=true;stats.stopped=true;stats.stopReason=reason;timers.forEach(clearTimeout);stopLoad();setPhase('stopped');stop.disabled=true;stop.textContent='Workload stopped';detail.textContent+=' · Passive observation continues to the scheduled end.';}
 function startCPU(){try{worker=new Worker('/cpu-workload.js');stats.cpu.status='starting';worker.onmessage=e=>{Object.assign(stats.cpu,e.data);update();};worker.onerror=e=>{stats.cpu.status='error';stats.cpu.error=e.message;worker?.terminate();worker=null;update();};worker.postMessage({durationMs:phaseMs});}catch(e){stats.cpu.status='unavailable';stats.cpu.error=String(e);}}
 function startGPU(){try{
  canvas=document.createElement('canvas');canvas.width=256;canvas.height=256;canvas.setAttribute('aria-label','GPU workload surface');canvas.style.cssText='width:96px;height:96px;border-radius:6px;margin-top:12px';document.getElementById('workload-panel').append(canvas);
  gl=canvas.getContext('webgl',{antialias:false,preserveDrawingBuffer:true});if(!gl)throw new Error('WebGL context unavailable');
  canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();if(stats.gpu.status==='running'){stats.gpu.status='context-lost';stats.gpu.error='WebGL context lost during workload';cancelAnimationFrame(raf);update();}});
  stats.gpu.renderer=gl.getParameter(gl.RENDERER);const dbg=gl.getExtension('WEBGL_debug_renderer_info');stats.gpu.unmaskedRenderer=dbg?gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL):null;
  function shader(type,src){const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s));return s;}
  const vs=shader(gl.VERTEX_SHADER,'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}');
  const fs=shader(gl.FRAGMENT_SHADER,'precision mediump float;uniform float t;void main(){vec2 p=gl_FragCoord.xy/256.;float v=p.x+p.y+t;for(int i=0;i<48;i++){v=sin(v*1.07+float(i)*.13)+cos(v*.71+p.y);}gl_FragColor=vec4(.4+.3*sin(v),.6,.4+.3*cos(v),1.);}');
  program=gl.createProgram();gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(program));gl.deleteShader(vs);gl.deleteShader(fs);gl.useProgram(program);
  buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);const p=gl.getAttribLocation(program,'p');gl.enableVertexAttribArray(p);gl.vertexAttribPointer(p,2,gl.FLOAT,false,0,0);const t=gl.getUniformLocation(program,'t');gl.viewport(0,0,256,256);stats.gpu.status='running';
  function draw(ms){if(stats.phase!=='workload'||stats.stopped||!gl||stats.gpu.status!=='running')return;if(ms-lastFrame>=33){lastFrame=ms;gl.uniform1f(t,(ms%10000)/1000);gl.drawArrays(gl.TRIANGLES,0,3);stats.gpu.drawCalls++;if(stats.gpu.drawCalls%30===0)update();}raf=requestAnimationFrame(draw);}raf=requestAnimationFrame(draw);
 }catch(e){stats.gpu.status='unavailable';stats.gpu.error=String(e);}}
 const visibility=()=>{stats.visibilityChanges.push({ms:Math.round(now()-began),state:document.visibilityState});if(document.hidden&&stats.phase==='workload')stopAll('page-hidden');};
 document.addEventListener('visibilitychange',visibility);
 const leave=()=>stopAll('pagehide');window.addEventListener('pagehide',leave,{once:true});
 stop.onclick=()=>stopAll('user-stopped');
 timers.push(setTimeout(()=>{if(stats.stopped)return;setPhase('workload');if(document.hidden){stopAll('page-hidden');return;}startCPU();startGPU();update();},phaseMs));
 timers.push(setTimeout(()=>{if(stats.stopped)return;stopLoad();setPhase('recovery');},2*phaseMs));
 timers.push(setTimeout(()=>{if(stats.stopped)return;stopLoad();setPhase('complete');stop.disabled=true;stop.textContent='Workload finished';},3*phaseMs));
 update();
 return {stats,phase:()=>stats.phase,finish(){timers.forEach(clearTimeout);stopLoad();document.removeEventListener('visibilitychange',visibility);window.removeEventListener('pagehide',leave);if(stats.phases.length&&!stats.phases.at(-1).endedMs)stats.phases.at(-1).endedMs=Math.round(now()-began);if(stats.phase!=='complete'&&!stats.stopped){stats.stopped=true;stats.stopReason='finalizer-before-phase-complete';stats.phase='incomplete';}stop.disabled=true;update();}};
};
