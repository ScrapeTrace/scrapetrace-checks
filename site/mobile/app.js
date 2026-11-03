import {collect,analyze} from '/mobile/probe.js';
const $=id=>document.getElementById(id);
const value=v=>v===null||v===undefined?'Unavailable':typeof v==='object'?JSON.stringify(v):String(v);
const dimensions=(w,h)=>`${value(w)} × ${value(h)}`;
function node(tag,text,className){const el=document.createElement(tag);if(text!==undefined)el.textContent=text;if(className)el.className=className;return el;}
function svgNode(tag,attrs={},text){const el=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const[key,v]of Object.entries(attrs))el.setAttribute(key,v);if(text!==undefined)el.textContent=text;return el;}
let latest;
const request=JSON.parse($('request-data').textContent);
function draw(data,analysis){
 const target=$('device');target.replaceChildren();const{width,height}=data.screen;
 if(![width,height].every(v=>typeof v==='number'&&Number.isFinite(v)&&v>0&&v<=1000000)){target.append(node('p','A valid screen size was not reported. The raw readings are retained below.'));return;}
 const portrait=height>width,canvasWidth=portrait?400:640,canvasHeight=portrait?540:400;
 const scale=Math.min((canvasWidth-100)/width,(canvasHeight-100)/height),sw=width*scale,sh=height*scale;
 const x=(canvasWidth-sw)/2,y=(canvasHeight-sh)/2;
 const svg=svgNode('svg',{viewBox:`0 0 ${canvasWidth} ${canvasHeight}`,role:'img','aria-labelledby':'device-title device-desc'});
 svg.append(svgNode('title',{id:'device-title'},'Reported screen size '+dimensions(width,height)),svgNode('desc',{id:'device-desc'},'Illustrative frame showing the reported screen aspect ratio, touch points and JavaScript mobile hint. No physical device is identified.'));
 svg.append(svgNode('rect',{x:x-8,y:y-8,width:sw+16,height:sh+16,rx:portrait?20:8,fill:'#211e2a',stroke:'#82788f','stroke-width':1.5}));
 svg.append(svgNode('rect',{x,y,width:sw,height:sh,rx:portrait?13:3,fill:'#332b47',stroke:'#b7a4f0','stroke-width':1.5}));
 const tx=canvasWidth/2,cy=canvasHeight/2;
 const text=(label,dy,size,color='#f7f5fb')=>svg.append(svgNode('text',{x:tx,y:cy+dy,'text-anchor':'middle','font-family':'monospace','font-size':size,fill:color},label));
 // Very thin or extreme aspect ratios retain their shape without overflowing labels.
 if(sw>150&&sh>170){
  text('REPORTED SCREEN',-70,12,'#bbb5c8');text(dimensions(width,height),-37,20);
  text('TOUCH POINTS  '+value(data.navigator.maxTouchPoints),16,12);
  text('UA-CH MOBILE  '+value(analysis.mobileHint),44,12);
  text(analysis.identity.os||'UA PLATFORM UNKNOWN',85,16,'#d3bb92');
 }
 target.append(svg);
}
function render(data,a){
 $('headline').textContent=a.headline;
 const count=a.findings.filter(f=>f.kind==='difference').length;
 $('summary').textContent=`${count} cross-signal ${count===1?'difference':'differences'} highlighted. A mobile option’s effect must be assessed across geometry, input and identity; these readings do not verify a physical phone.`;
 draw(data,a);
 $('device-signals').replaceChildren();
 for(const[label,v]of [['Screen',dimensions(data.screen.width,data.screen.height)],['Page / layout viewport',dimensions(data.window.innerWidth,data.window.innerHeight)],['Outer window',dimensions(data.window.outerWidth,data.window.outerHeight)],['Device pixel ratio',value(data.window.devicePixelRatio)]]){
  const row=node('div',undefined,'device-metric');row.append(node('span',label),node('strong',v));$('device-signals').append(row);
 }
 const groups=[
  ['GEOMETRY',a.compact===true?'Compact screen reported':a.compact===false?'Larger screen reported':'Screen size unavailable',`Screen ${dimensions(data.screen.width,data.screen.height)} · page ${dimensions(data.window.innerWidth,data.window.innerHeight)}. Compact = shorter screen edge ≤ 600 CSS px.`],
  ['INPUT',a.touch===true?'Touch capability reported':a.touch===false?'No touch points reported':'Touch capability unavailable',`${value(data.navigator.maxTouchPoints)} maximum touch points · primary coarse pointer ${value(data.media['(pointer: coarse)'])} · primary hover ${value(data.media['(hover: hover)'])}.`],
  ['IDENTITY',`${a.identity.style==='unknown'?'Unclassified':a.identity.style==='mobile'?'Mobile-style':'Desktop-style'} User-Agent`,`${a.identity.os||'UA platform unknown'} · UA-CH mobile ${value(a.mobileHint)} · UA-CH platform ${value(data.userAgentData?.platform)} · navigator.platform ${value(data.navigator.platform)}.`]
 ];
 $('signal-groups').replaceChildren();
 for(const[label,title,detail]of groups){const group=node('section',undefined,'signal-group');group.append(node('h3',label),node('strong',title),node('p',detail));$('signal-groups').append(group);}
 $('findings').replaceChildren();
 for(const finding of a.findings){const card=node('article',undefined,'finding');card.dataset.kind=finding.kind;card.dataset.finding=finding.id;card.append(node('span',finding.kind==='difference'?'Cross-signal difference':finding.kind==='context'?'Context':'Unavailable signal','finding-label'),node('h3',finding.title),node('p',finding.detail));$('findings').append(card);}
 if(a.headless){const card=node('article',undefined,'finding');card.dataset.finding='headless';card.append(node('h3','Headless User-Agent reported'),node('p','The JavaScript User-Agent contains a headless marker. This reports the string, not a separate execution-mode test.'));$('findings').append(card);}
 if(!a.findings.length)$('findings').append(node('p','No cross-signal differences were highlighted by these rules. This is not a verification of mobile hardware.'));
 const rows=[
  ['screen.width × screen.height',dimensions(data.screen.width,data.screen.height),'Reported CSS screen size'],
  ['innerWidth × innerHeight',dimensions(data.window.innerWidth,data.window.innerHeight),'Layout viewport'],
  ['outerWidth × outerHeight',dimensions(data.window.outerWidth,data.window.outerHeight),'Outer browser window'],
  ['visualViewport',data.visualViewport,'Visible area, scale and offsets'],
  ['devicePixelRatio',data.window.devicePixelRatio,'Reported ratio, not physical resolution'],
  ...Object.entries(data.navigator).map(([key,v])=>['navigator.'+key,v,key==='maxTouchPoints'?'Maximum reported simultaneous touch contacts':'JavaScript navigator reading']),
  ['navigator.userAgentData.mobile',data.userAgentData?.mobile,'JavaScript low-entropy mobile hint'],
  ['navigator.userAgentData.platform',data.userAgentData?.platform,'JavaScript low-entropy platform hint'],
  ['navigator.userAgentData.brands',data.userAgentData?.brands,'Reported browser brands'],
  ...Object.entries(data.media).map(([query,v])=>['matchMedia '+query,v,'Reported CSS media capability']),
  ['TouchEvent exposed',data.touchEventExposed,'API availability, not proof of touch hardware'],
  ['HTTP User-Agent',request.userAgent,'Received for this document request'],
  ['HTTP Sec-CH-UA-Mobile',request.secChUaMobile,'Received for this document request'],
  ['HTTP Sec-CH-UA-Platform',request.secChUaPlatform,'Received for this document request'],
  ['HTTP Sec-CH-UA',request.secChUa,'Received for this document request']
 ];
 $('rows').replaceChildren();
 for(const[key,v,meaning]of rows){const row=node('tr'),label=node('th',key);label.scope='row';row.append(label,node('td',value(v)),node('td',meaning));$('rows').append(row);}
}
function run(){
 document.getElementById('probe-complete')?.remove();window.__PROBE_READY__=false;window.__PROBE_RESULT__=null;
 document.documentElement.removeAttribute('data-probe-ready');
 try{
  const data=collect(),analysis=analyze(data,request);render(data,analysis);
  latest={version:1,tool:'mobile-configuration',capturedAt:new Date().toISOString(),request,readings:data,analysis,complete:true,ready:true};
  $('report-json').textContent=JSON.stringify(latest,null,2);window.__PROBE_RESULT__=latest;window.__PROBE_READY__=true;
  const marker=node('p','Mobile configuration snapshot complete');marker.id='probe-complete';marker.dataset.status='complete';$('status').textContent='Snapshot captured · '+new Date(latest.capturedAt).toLocaleTimeString();$('status').after(marker);
  document.documentElement.dataset.probeReady='true';document.dispatchEvent(new CustomEvent('probe:ready',{detail:latest}));$('download').disabled=false;
 }catch(error){$('headline').textContent='Could not complete mobile configuration check';$('summary').textContent=error.name+': '+error.message;$('download').disabled=true;}
}
$('refresh').addEventListener('click',run);
$('download').addEventListener('click',()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(latest,null,2)],{type:'application/json'}));const link=node('a');link.href=url;link.download='scrapetrace-mobile-configuration.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
run();
