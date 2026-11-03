import {capture, analyze} from '/screen/geometry.js';
const $ = id => document.getElementById(id);
const number = value => typeof value === 'number' && Number.isFinite(value) ? Number(value.toFixed(2)).toLocaleString('en-US', {maximumFractionDigits:2}) : 'Unavailable';
const size = (width,height) => `${number(width)} × ${number(height)}`;
let frozen = false, latest, signature, scheduled = false;
function node(tag, text, className) {
  const element = document.createElement(tag); if (text !== undefined) element.textContent = text;
  if (className) element.className = className; return element;
}
function svgNode(tag, attrs = {}, text) {
  const element = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [key,value] of Object.entries(attrs)) element.setAttribute(key, value);
  if (text !== undefined) element.textContent = text; return element;
}
function diagram(model) {
  const container = $('drawing'); container.replaceChildren();
  if (!model.drawable) {
    container.append(node('p','A proportional diagram needs positive screen, window and page dimensions, readable positions, and values within the drawing limit (1,000,000 CSS px). The reported values remain available below.','svg-message'));
    return;
  }
  const rects = model.rects;
  const minX = Math.min(...rects.map(r => r.x)), minY = Math.min(...rects.map(r => r.y));
  const width = Math.max(...rects.map(r => r.x+r.width)) - minX;
  const height = Math.max(...rects.map(r => r.y+r.height)) - minY;
  const portrait = width/height < 0.85;
  const canvasWidth = portrait ? 420 : 800, canvasHeight = portrait ? 660 : 520;
  const scale = Math.min((canvasWidth-100)/width,(canvasHeight-120)/height);
  const x0 = (canvasWidth-width*scale)/2, y0 = (canvasHeight-height*scale)/2+10;
  const x = value => x0+(value-minX)*scale, y = value => y0+(value-minY)*scale;
  const svg = svgNode('svg',{viewBox:`0 0 ${canvasWidth} ${canvasHeight}`,role:'img','aria-labelledby':'geometry-title geometry-description'});
  svg.append(svgNode('title',{id:'geometry-title'},'Reported screen, browser window and page geometry'));
  svg.append(svgNode('desc',{id:'geometry-description'},'Scaled nested rectangles. The page is positioned schematically inside the window. ' + (model.allEqual ? 'Screen, outer window and page sizes coincide.' : 'Separate dimensions and gaps are listed next to and below this diagram.')));
  const defs = svgNode('defs');
  const grid = svgNode('pattern',{id:'screen-grid',width:28,height:28,patternUnits:'userSpaceOnUse'});
  grid.append(svgNode('path',{d:'M 28 0 L 0 0 0 28',fill:'none',stroke:'#302c3a','stroke-width':0.6})); defs.append(grid);
  const hatch = svgNode('pattern',{id:'ui-hatch',width:8,height:8,patternUnits:'userSpaceOnUse'});
  hatch.append(svgNode('rect',{width:8,height:8,fill:'#3b332b'}),svgNode('path',{d:'M-2 2L2 -2M0 8L8 0M6 10L10 6',stroke:'#665744','stroke-width':0.8})); defs.append(hatch); svg.append(defs);
  const colors = {screen:'#bbb5c8',available:'#82788f',window:'#d3bb92',page:'#b7a4f0',visual:'#b3ccc2'};
  const fills = {screen:'url(#screen-grid)',available:'#211e2a',window:'url(#ui-hatch)',page:'#332b47',visual:'#42685c'};
  for (const rect of rects) {
    const attrs = {x:x(rect.x),y:y(rect.y),width:rect.width*scale,height:rect.height*scale,fill:fills[rect.id],stroke:colors[rect.id],'stroke-width':rect.id==='screen'?3:1.5,'vector-effect':'non-scaling-stroke','data-layer':rect.id,'data-x':rect.x,'data-y':rect.y};
    if (['available','visual'].includes(rect.id)) { attrs['stroke-dasharray']='7 5'; attrs['fill-opacity']=rect.id==='visual' ? 0.25 : 0.5; }
    svg.append(svgNode('rect',attrs));
  }
  // Re-outline the screen so coincident reported rectangles remain visible.
  const screen = rects[0];
  svg.append(svgNode('rect',{x:x(screen.x),y:y(screen.y),width:screen.width*scale,height:screen.height*scale,fill:'none',stroke:colors.screen,'stroke-width':1,'stroke-dasharray':'3 6','vector-effect':'non-scaling-stroke'}));
  svg.append(svgNode('text',{x:x(screen.x),y:y(screen.y)-15,fill:colors.screen,'font-family':'monospace','font-size':19},'SCREEN ' + size(screen.width,screen.height)));
  const page = rects.find(r=>r.id==='page');
  const win = rects.find(r=>r.id==='window');
  const band = (page.y-win.y)*scale;
  if (band > 24 && win.width*scale > 180) svg.append(svgNode('text',{x:x(win.x)+12,y:y(win.y)+band/2+6,fill:'#ead9bd','font-family':'monospace','font-size':17},'COMBINED WINDOW UI'));
  if (page.width*scale > 180 && page.height*scale > 60) {
    svg.append(svgNode('text',{x:x(page.x+page.width/2),y:y(page.y+page.height/2)-7,'text-anchor':'middle',fill:'#f7f5fb','font-family':'monospace','font-size':25},'PAGE VIEWPORT'));
    svg.append(svgNode('text',{x:x(page.x+page.width/2),y:y(page.y+page.height/2)+24,'text-anchor':'middle',fill:'#d8cdee','font-family':'monospace','font-size':20},size(page.width,page.height)));
  }
  container.append(svg);
}
function render(readings, model) {
  const {screen:s,window:w,document:d,visualViewport:v} = readings;
  $('headline').textContent = model.allEqual ? 'Screen, window and page report the same size' : !model.drawable ? 'Some geometry cannot be drawn' : 'The reported layers have different dimensions';
  const verticalGap = typeof w.outerHeight === 'number' && typeof w.innerHeight === 'number' ? w.outerHeight-w.innerHeight : null;
  $('summary').textContent = model.allEqual ? 'No outer-to-inner size gap is reported. These APIs expose no separate browser-UI band in this snapshot. Equal dimensions alone do not identify automation.' : `Window position: (${number(w.screenX)}, ${number(w.screenY)}). Combined outer-to-inner height difference: ${number(verticalGap)} CSS px. This is the total gap, not a count of browser bars.`;
  diagram(model);
  $('diagram-caption').textContent = `Scaled to fit; dimensions are not stretched independently. ${model.origin.assumed ? 'Screen origin assumed at (0, 0); multi-monitor placement may differ.' : 'Screen origin reported at ('+number(model.origin.x)+', '+number(model.origin.y)+').'}`;
  $('margins').replaceChildren();
  for (const side of ['left','top','right','bottom']) {
    const item=node('div'); item.append(node('dt',side),node('dd',number(model.windowMargins?.[side])+' px')); $('margins').append(item);
  }
  const layers = [
    ['screen','Screen',size(s.width,s.height),'screen.width × screen.height'],
    ...(model.availableDifferent ? [['available','Available screen',size(s.availWidth,s.availHeight),`Origin (${number(s.availLeft)}, ${number(s.availTop)})`]] : []),
    ['window','Outer window',size(w.outerWidth,w.outerHeight),`Position (${number(w.screenX)}, ${number(w.screenY)})`],
    ['page','Page / layout viewport',size(w.innerWidth,w.innerHeight),'innerWidth × innerHeight'],
    ...(model.visualDifferent ? [['visual','Visual viewport',size(v.width,v.height),`Offset (${number(v.offsetLeft)}, ${number(v.offsetTop)}) · scale ${number(v.scale)}`]] : [])
  ];
  $('layers').replaceChildren();
  for (const [id,title,value,detail] of layers) {
    const layer = node('div',undefined,'layer'); const heading=node('h3'); heading.append(node('span',undefined,'swatch swatch-'+id),node('span',title));
    layer.append(heading,node('strong',value),node('small',detail)); $('layers').append(layer);
  }
  $('visual-section').hidden = !model.visualDifferent;
  if (model.visualDifferent) {
    $('visual-size').textContent = size(v.width,v.height) + ' CSS px visible';
    $('visual-note').textContent = `Compared with ${size(w.innerWidth,w.innerHeight)} for the page. Offset (${number(v.offsetLeft)}, ${number(v.offsetTop)}), pinch scale ${number(v.scale)}. Document client area: ${size(d.clientWidth,d.clientHeight)}. A visual-viewport gap alone does not identify a scrollbar or keyboard.`;
  }
  $('differences').replaceChildren();
  for (const gap of model.differences) {
    const card = node('article',undefined,'difference'); card.dataset.gap = gap.id;
    card.append(node('h3',gap.title),node('strong',(gap.delta>0?'+':'')+number(gap.delta)+' px','delta'),node('code',gap.formula),node('p',gap.meaning+(gap.delta<0?' Negative means the second reported dimension is larger; do not interpret it as a physical gap.':'')));
    $('differences').append(card);
  }
  $('no-gaps').hidden = model.differences.length>0;
  $('issues').replaceChildren(...model.issues.map(text => node('p',text,'issue')));
  const measurements = [
    ...Object.entries(s).map(([key,value])=>['screen.'+key,value]),
    ...Object.entries(w).map(([key,value])=>['window.'+key,value]),
    ...Object.entries(d).map(([key,value])=>[key==='fullscreen'?'document.fullscreenElement (present)':'document.documentElement.'+key,value]),
    ...Object.entries(v).map(([key,value])=>['visualViewport.'+key,value])
  ];
  $('measurements').replaceChildren();
  for (const [key,value] of measurements) {
    const row=node('tr'),label=node('th',key); label.scope='row';
    row.append(label,node('td',typeof value==='boolean'||typeof value==='string'?String(value):number(value))); $('measurements').append(row);
  }
}
function refresh(force = false) {
  scheduled=false;
  if (frozen && !force) return;
  try {
    const readings=capture(); const nextSignature=JSON.stringify(readings);
    if (!force && nextSignature===signature) return;
    signature=nextSignature; const model=analyze(readings);
    render(readings,model);
    latest={version:1,tool:'screen-geometry',capturedAt:new Date().toISOString(),readings,analysis:model,complete:true,ready:true};
    window.__PROBE_RESULT__=latest; window.__PROBE_READY__=true;
    $('raw').textContent=JSON.stringify(latest,null,2); $('download').disabled=false;
    $('live-state').textContent=(frozen?'Frozen':'Live')+' · '+new Date(latest.capturedAt).toLocaleTimeString();
    const marker=$('probe-complete'); marker.dataset.status='complete'; marker.textContent='Geometry snapshot complete';
    document.documentElement.dataset.probeReady='true'; document.dispatchEvent(new CustomEvent('probe:ready',{detail:latest}));
  } catch (error) { $('headline').textContent='Could not complete geometry snapshot'; $('summary').textContent=error.name+': '+error.message; }
}
function schedule() { if (!scheduled && !frozen) { scheduled=true; requestAnimationFrame(()=>refresh()); } }
$('refresh').addEventListener('click',()=>refresh(true));
$('freeze').addEventListener('click',()=>{
  frozen=!frozen; $('freeze').setAttribute('aria-pressed',String(frozen)); $('freeze').textContent=frozen?'Resume live readings':'Freeze readings';
  if (frozen) $('live-state').textContent='Frozen · snapshot retained'; else refresh(true);
});
$('download').addEventListener('click',()=>{
  const url=URL.createObjectURL(new Blob([JSON.stringify(latest,null,2)],{type:'application/json'}));
  const link=node('a'); link.href=url; link.download='scrapetrace-screen-geometry.json'; link.click(); setTimeout(()=>URL.revokeObjectURL(url),1000);
});
addEventListener('resize',schedule); addEventListener('orientationchange',schedule);
globalThis.visualViewport?.addEventListener('resize',schedule); globalThis.visualViewport?.addEventListener('scroll',schedule);
let timer;
function startPolling(){clearInterval(timer);timer=setInterval(()=>{if(!document.hidden)schedule();},1000);}
startPolling();
addEventListener('pagehide',()=>clearInterval(timer));
addEventListener('pageshow',event=>{if(event.persisted){startPolling();schedule();}});
requestAnimationFrame(()=>{refresh(true);requestAnimationFrame(()=>refresh());});
