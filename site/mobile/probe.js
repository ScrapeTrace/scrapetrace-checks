export function collect(host = globalThis) {
  const errors = {};
  const read = path => {
    try { const value=path.split('.').reduce((o,key)=>o?.[key],host); return value===undefined?null:value; }
    catch(error){errors[path]=error.name+': '+error.message;return null;}
  };
  const media={};
  for(const query of ['(pointer: coarse)','(pointer: fine)','(pointer: none)','(any-pointer: coarse)','(any-pointer: fine)','(hover: hover)','(hover: none)','(any-hover: hover)','(orientation: portrait)']){
    try{media[query]=typeof host.matchMedia==='function'?host.matchMedia(query).matches:null;}catch(error){media[query]=null;errors[query]=error.message;}
  }
  const keys=['userAgent','platform','vendor','maxTouchPoints','hardwareConcurrency','deviceMemory','webdriver','language','languages'];
  const navigator=Object.fromEntries(keys.map(key=>[key,read('navigator.'+key)]));
  const uaData=read('navigator.userAgentData');
  const userAgentData=uaData?Object.fromEntries(['mobile','platform','brands'].map(key=>[key,read('navigator.userAgentData.'+key)])):null;
  const screen=Object.fromEntries(['width','height','availWidth','availHeight','colorDepth'].map(key=>[key,read('screen.'+key)]));
  const window=Object.fromEntries(['innerWidth','innerHeight','outerWidth','outerHeight','devicePixelRatio'].map(key=>[key,read(key)]));
  const visual=read('visualViewport');
  const visualViewport=visual?Object.fromEntries(['width','height','scale','offsetLeft','offsetTop'].map(key=>[key,read('visualViewport.'+key)])):null;
  return {navigator,userAgentData,screen,window,visualViewport,media,touchEventExposed:typeof host.TouchEvent==='function',errors};
}
export function uaIdentity(value) {
  if(typeof value!=='string'||!value)return {style:'unknown',os:null};
  if(/Windows Phone|IEMobile/i.test(value))return {style:'mobile',os:'Windows Phone'};
  if(/Android/i.test(value))return {style:'mobile',os:'Android'};
  if(/iPhone|iPad|iPod/i.test(value))return {style:'mobile',os:'iOS'};
  if(/Windows NT/i.test(value))return {style:'desktop',os:'Windows'};
  if(/CrOS/i.test(value))return {style:'desktop',os:'Chrome OS'};
  if(/Macintosh|Mac OS X/i.test(value))return {style:'desktop',os:'macOS'};
  if(/Linux|X11/i.test(value))return {style:'desktop',os:'Linux'};
  return {style:/Mobile/i.test(value)?'mobile':'unknown',os:null};
}
export function analyze(data, request={}) {
  const {navigator:n,userAgentData:ch,screen:s,window:w,media:m}=data;
  const identity=uaIdentity(n.userAgent);
  const valid=n=>typeof n==='number'&&Number.isFinite(n)&&n>0;
  const compact=valid(s.width)&&valid(s.height)?Math.min(s.width,s.height)<=600:null;
  const narrow=valid(w.innerWidth)?w.innerWidth<=600:null;
  const mobileHint=typeof ch?.mobile==='boolean'?ch.mobile:null;
  const touch=typeof n.maxTouchPoints==='number'&&Number.isFinite(n.maxTouchPoints)?n.maxTouchPoints>0:null;
  const desktopPlatform=typeof ch?.platform==='string'&&['Linux','Windows','macOS','Chrome OS'].includes(ch.platform);
  const desktopIdentity=identity.style==='desktop'||desktopPlatform||mobileHint===false;
  const findings=[];
  const add=(id,title,detail,kind='difference')=>findings.push({id,title,detail,kind});
  if(compact&&desktopIdentity)add('compact-desktop','Compact screen, desktop identity',`The screen’s shorter edge is at most 600 CSS px, but ${[identity.style==='desktop'?'the JavaScript UA is desktop-style':null,mobileHint===false?'UA-CH mobile is false':null,desktopPlatform?'UA-CH platform is '+ch.platform:null].filter(Boolean).join('; ')}. Geometry alone does not establish mobile emulation.`);
  else if(narrow&&compact===false&&desktopIdentity)add('narrow-desktop','Narrow page on a larger screen','The page is at most 600 CSS px wide, while the reported screen is larger on both axes. This may simply be a resized desktop window.','context');
  if(identity.style==='mobile'&&mobileHint===false)add('ua-ch-mobile','UA and client hints disagree about mobile','The UA contains a mobile-platform marker, while navigator.userAgentData.mobile reports false.');
  if(identity.style==='desktop'&&mobileHint===true)add('ch-ua-desktop','Mobile client hint, desktop-style UA','navigator.userAgentData.mobile is true, while the UA contains desktop-platform markers. Desktop browsing modes and emulation can affect this combination.');
  if(identity.os&&typeof ch?.platform==='string'&&ch.platform&&identity.os!==ch.platform)add('ua-ch-platform','UA and client-hint platforms differ',`The UA suggests ${identity.os}; navigator.userAgentData.platform reports ${ch.platform}. These are reported identities, not verified operating systems.`);
  const navPlatform=typeof n.platform==='string'?n.platform:'';
  const navOS=/^Win/i.test(navPlatform)?'Windows':/^Mac/i.test(navPlatform)?'macOS':/^Linux/i.test(navPlatform)?'Linux':/iPhone|iPad|iPod/i.test(navPlatform)?'iOS':null;
  const compatible=navOS===identity.os||(identity.os==='Android'&&navOS==='Linux')||(identity.os==='Chrome OS'&&navOS==='Linux')||(identity.os==='Windows Phone'&&navOS==='Windows')||(['iOS','macOS'].includes(identity.os)&&['iOS','macOS'].includes(navOS));
  if(identity.os&&navOS&&!compatible)add('ua-navigator-platform','UA and navigator platform differ',`The UA suggests ${identity.os}; navigator.platform reports ${navPlatform}. Android/Linux and iPad desktop-mode combinations are not flagged by this rule.`);
  if(identity.style==='mobile'&&touch===false)add('mobile-no-touch','Mobile identity, no touch points reported','The UA has a mobile-platform marker, but navigator.maxTouchPoints is 0. This is an observation, not proof of a physical device or a failed request.');
  if(touch&&(m['(pointer: fine)']===true||m['(hover: hover)']===true))add('mixed-input','Touch and mouse-style input coexist','Touch points are reported alongside a fine primary pointer or primary hover capability. Touchscreen computers, attached input devices and partial emulation can all produce this.','context');
  if(touch===false&&m['(pointer: coarse)']===true)add('coarse-no-touch','Coarse pointer without touch points','The primary pointer is coarse, but navigator.maxTouchPoints is 0. A coarse pointer is not necessarily a touchscreen.','context');
  const requestMobile=request.secChUaMobile==='?1'?true:request.secChUaMobile==='?0'?false:null;
  if(requestMobile!==null&&mobileHint!==null&&requestMobile!==mobileHint)add('http-js-mobile','Request and JavaScript mobile hints disagree',`The document request sent Sec-CH-UA-Mobile: ${request.secChUaMobile}; JavaScript reports ${mobileHint}.`);
  if(typeof request.userAgent==='string'&&request.userAgent&&typeof n.userAgent==='string'&&request.userAgent!==n.userAgent)add('http-js-ua','Request and JavaScript User-Agents differ','The User-Agent received for this document differs from navigator.userAgent. See both full values below.');
  let requestPlatform=null;
  if(typeof request.secChUaPlatform==='string'){try{requestPlatform=JSON.parse(request.secChUaPlatform);}catch{requestPlatform=request.secChUaPlatform;}}
  if(typeof requestPlatform==='string'&&requestPlatform&&typeof ch?.platform==='string'&&ch.platform&&requestPlatform!==ch.platform)add('http-js-platform','Request and JavaScript platforms differ',`The document request reports ${requestPlatform}; JavaScript UA-CH reports ${ch.platform}.`);
  const ipadPossibility=/Macintosh/i.test(n.userAgent||'')&&typeof n.maxTouchPoints==='number'&&n.maxTouchPoints>1;
  if(ipadPossibility)add('ipad-mode','Desktop-style Mac identity with multiple touch points','This combination can occur on iPadOS in desktop browsing mode. A desktop-style UA does not by itself establish a desktop device.','context');
  if(!ch)add('ua-ch-unavailable','JavaScript client hints unavailable','UA Client Hints are not exposed here. Missing mobile/platform hints are unknown, not false. Safari and Firefox commonly do not expose this API.','unavailable');
  if(Object.keys(data.errors).length)add('read-errors','Some properties could not be read','Read errors are retained in the raw result. Unavailable readings are not treated as matching.','unavailable');
  const headline=compact&&desktopIdentity?'Phone-sized geometry, desktop-oriented identity':findings.some(f=>f.kind==='difference')?'Mobile-related readings differ':identity.style==='mobile'||mobileHint===true?'Mobile-oriented identity reported':identity.style==='desktop'?'Desktop-oriented identity reported':'Mobile identity is inconclusive';
  return {compact,narrow,touch,mobileHint,identity,requestMobile,requestPlatform,findings,headline,headless:typeof n.userAgent==='string'&&/Headless/i.test(n.userAgent)};
}
