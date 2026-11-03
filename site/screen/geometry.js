// All dimensions remain reported CSS pixels; DPR is recorded separately.
export function capture(host = globalThis) {
  const errors = {};
  function read(path, numeric = true) {
    try {
      const value = path.split('.').reduce((object, key) => object?.[key], host);
      if (value === undefined || value === null) return null;
      if (numeric && (typeof value !== 'number' || !Number.isFinite(value))) { errors[path] = 'Not a finite number'; return null; }
      return value;
    } catch (error) { errors[path] = error.name + ': ' + error.message; return null; }
  }
  const screen = Object.fromEntries(['width','height','availWidth','availHeight','availLeft','availTop','left','top','colorDepth','pixelDepth'].map(key => [key, read('screen.' + key)]));
  const window = Object.fromEntries(['screenX','screenY','outerWidth','outerHeight','innerWidth','innerHeight','devicePixelRatio','scrollX','scrollY'].map(key => [key, read(key)]));
  const document = Object.fromEntries(['clientWidth','clientHeight','scrollWidth','scrollHeight'].map(key => [key, read('document.documentElement.' + key)]));
  document.fullscreen = Boolean(read('document.fullscreenElement', false));
  const viewport = read('visualViewport', false);
  const visualViewport = viewport ? {status: 'available', ...Object.fromEntries(['width','height','offsetLeft','offsetTop','pageLeft','pageTop','scale'].map(key => [key, read('visualViewport.' + key)]))} : {status: 'unavailable'};
  return {screen, window, document, visualViewport, errors};
}
const numeric = value => typeof value === 'number' && Number.isFinite(value);
const positive = value => numeric(value) && value > 0;
export const same = (a, b) => numeric(a) && numeric(b) && Math.abs(a - b) <= 0.01;
export function analyze(readings) {
  const {screen: s, window: w, document: d, visualViewport: v} = readings;
  const differences = [];
  const add = (id, title, a, b, formula, meaning) => {
    if (numeric(a) && numeric(b) && !same(a, b)) differences.push({id, title, delta: a - b, formula, meaning});
  };
  add('screen-window-height','Screen to window · height',s.height,w.outerHeight,'screen.height − outerHeight','Space not covered by this window’s height. An unmaximized window, OS-reserved area or other geometry can contribute; this difference alone does not identify a taskbar.');
  add('screen-window-width','Screen to window · width',s.width,w.outerWidth,'screen.width − outerWidth','Screen width outside the reported window size. Position determines where the remaining space falls.');
  add('reserved-height','Screen to available area · height',s.height,s.availHeight,'screen.height − screen.availHeight','Reported height unavailable to ordinary windows. OS panels or a taskbar may contribute; their identity is unknown.');
  add('reserved-width','Screen to available area · width',s.width,s.availWidth,'screen.width − screen.availWidth','Reported width unavailable to ordinary windows. This is separate from an ordinary window margin.');
  add('ui-height','Window to page · height',w.outerHeight,w.innerHeight,'outerHeight − innerHeight','Combined non-page height: window borders, browser bars, docked tools or other UI may contribute. The API cannot separate individual bars or locate the page exactly.');
  add('ui-width','Window to page · width',w.outerWidth,w.innerWidth,'outerWidth − innerWidth','Combined non-page width. Borders, a sidebar or docked developer tools may contribute; the left/right split is unknown.');
  add('scrollbar-width','Layout to document · width',w.innerWidth,d.clientWidth,'innerWidth − documentElement.clientWidth','Root viewport width excluded from the document client area, typically a non-overlay vertical scrollbar or gutter. Overlay scrollbars can leave no gap.');
  add('scrollbar-height','Layout to document · height',w.innerHeight,d.clientHeight,'innerHeight − documentElement.clientHeight','Root viewport height excluded from the document client area, typically a non-overlay horizontal scrollbar or gutter.');
  if (v.status === 'available') {
    add('visual-width','Page to visual viewport · width',w.innerWidth,v.width,'innerWidth − visualViewport.width','The visible viewport width differs. Scrollbars, pinch zoom, mobile behavior or emulation can contribute. Use the client-area and scale readings for context.');
    add('visual-height','Page to visual viewport · height',w.innerHeight,v.height,'innerHeight − visualViewport.height','The visible viewport height differs. A mobile keyboard, browser UI, pinch zoom or other viewport behavior can contribute.');
  }
  const core = [s.width,s.height,w.outerWidth,w.outerHeight,w.innerWidth,w.innerHeight];
  const allEqual = core.every(positive) && same(s.width,w.outerWidth) && same(s.height,w.outerHeight) && same(w.outerWidth,w.innerWidth) && same(w.outerHeight,w.innerHeight);
  const visualDifferent = v.status === 'available' && [v.width,v.height,v.offsetLeft,v.offsetTop,v.scale].every(numeric) && (!same(w.innerWidth,v.width) || !same(w.innerHeight,v.height) || !same(v.offsetLeft,0) || !same(v.offsetTop,0) || !same(v.scale,1));
  const originKnown = numeric(s.left) && numeric(s.top);
  const origin = {x: originKnown ? s.left : 0, y: originKnown ? s.top : 0, assumed: !originKnown};
  const windowMargins = [w.screenX,w.screenY,w.outerWidth,w.outerHeight,s.width,s.height].every(numeric) ? {left:w.screenX-origin.x,top:w.screenY-origin.y,right:origin.x+s.width-w.screenX-w.outerWidth,bottom:origin.y+s.height-w.screenY-w.outerHeight} : null;
  const rects = [{id:'screen', x:origin.x,y:origin.y,width:s.width,height:s.height}];
  const availableDifferent = positive(s.availWidth) && positive(s.availHeight) && (!same(s.width,s.availWidth) || !same(s.height,s.availHeight) || (numeric(s.availLeft) && !same(s.availLeft,origin.x)) || (numeric(s.availTop) && !same(s.availTop,origin.y)));
  if (availableDifferent && numeric(s.availLeft) && numeric(s.availTop)) rects.push({id:'available',x:s.availLeft,y:s.availTop,width:s.availWidth,height:s.availHeight});
  rects.push({id:'window',x:w.screenX,y:w.screenY,width:w.outerWidth,height:w.outerHeight});
  const page = {id:'page',x:w.screenX + Math.max(0,w.outerWidth-w.innerWidth)/2,y:w.screenY + Math.max(0,w.outerHeight-w.innerHeight),width:w.innerWidth,height:w.innerHeight};
  rects.push(page);
  if (visualDifferent) rects.push({id:'visual',x:page.x+v.offsetLeft,y:page.y+v.offsetTop,width:v.width,height:v.height});
  const drawable = rects.every(r => [r.x,r.y,r.width,r.height].every(numeric) && positive(r.width) && positive(r.height) && [r.x,r.y,r.width,r.height].every(n => Math.abs(n) <= 1000000));
  const issues = [];
  if ([w.outerWidth-w.innerWidth,w.outerHeight-w.innerHeight].some(n => numeric(n) && n < -0.01)) issues.push('The page is larger than the outer window on at least one axis. The diagram preserves that overflow. Zoom, emulation or inconsistent reports may affect these readings.');
  if (v.status !== 'available') issues.push('VisualViewport is unavailable; its dimensions were not compared.');
  if (Object.keys(readings.errors).length) issues.push('Some properties could not be read. Errors are retained in the raw snapshot.');
  return {allEqual,visualDifferent,availableDifferent,origin,windowMargins,rects,drawable,differences,issues};
}
