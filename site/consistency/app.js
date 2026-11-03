const mode = document.body.dataset.mode;
const ids = ['page', 'frame', 'dedicated', 'shared', 'service'];
const labels = {page: 'Page', frame: 'Frame', dedicated: 'Dedicated worker', shared: 'Shared worker', service: 'Service worker'};
const $ = id => document.getElementById(id);
let latest;
const unavailable = reason => ({status: 'unavailable', reason});
const messageOf = error => error?.name ? `${error.name}: ${error.message}` : String(error);
const activeCleanup = new Set();
addEventListener('pagehide', () => { for (const cleanup of activeCleanup) cleanup(); });

function task(start) {
  return new Promise(resolve => {
    let ended = false;
    const cleanups = [];
    const cleanup = () => { for (const fn of cleanups.splice(0)) { try { fn(); } catch {} } };
    activeCleanup.add(cleanup);
    const finish = result => {
      if (ended) return;
      ended = true; clearTimeout(timer); cleanup(); activeCleanup.delete(cleanup); resolve(result);
    };
    const timer = setTimeout(() => finish(unavailable('Timed out after 10 seconds')), 10000);
    try { start(finish, fn => cleanups.push(fn)); }
    catch (error) { finish(unavailable(messageOf(error))); }
  });
}
function frameSnapshot() {
  return task((finish, clean) => {
    const frame = document.createElement('iframe');
    frame.hidden = true; frame.title = 'Temporary navigator comparison context';
    const receive = event => {
      if (event.origin === location.origin && event.source === frame.contentWindow && event.data?.type === 'navigator-snapshot') finish(event.data.result);
    };
    addEventListener('message', receive);
    clean(() => { removeEventListener('message', receive); frame.remove(); });
    frame.onerror = () => finish(unavailable('Frame failed to load'));
    frame.src = '/consistency/frame?mode=' + mode;
    document.body.append(frame);
  });
}
function workerSnapshot(shared) {
  return task((finish, clean) => {
    const Constructor = shared ? globalThis.SharedWorker : globalThis.Worker;
    if (!Constructor) return finish(unavailable('API not supported'));
    const worker = shared ? new Constructor('/consistency/shared-worker.js', {name: 'checks-' + crypto.randomUUID()}) : new Constructor('/consistency/worker.js');
    const port = shared ? worker.port : worker;
    clean(() => shared ? port.close() : worker.terminate());
    worker.onerror = event => { event.preventDefault(); finish(unavailable('Worker failed to load or execute')); };
    port.onmessageerror = () => finish(unavailable('Worker response could not be read'));
    port.onmessage = event => finish(event.data);
    if (shared) port.start();
    port.postMessage({mode});
  });
}
async function serviceSnapshot() {
  if (!navigator.serviceWorker) return unavailable('API not supported or secure context unavailable');
  let registration, pending, cleanupPromise, expired = false;
  let cleanupStatus = 'not registered';
  const result = await task((finish, clean) => {
    clean(() => {
      expired = true;
      if (registration) cleanupPromise = registration.unregister().then(ok => ok ? 'unregistered' : 'already unregistered').catch(error => 'cleanup failed: ' + messageOf(error));
    });
    const channel = new MessageChannel();
    clean(() => { channel.port1.close(); channel.port2.close(); });
    channel.port1.onmessage = event => finish(event.data);
    channel.port1.onmessageerror = () => finish(unavailable('Service worker response could not be read'));
    // A unique child scope avoids updating or unregistering a preexisting worker.
    pending = navigator.serviceWorker.register('/consistency/service-worker.js', {scope: '/consistency/scopes/' + crypto.randomUUID() + '/'});
    pending.then(async reg => {
      registration = reg;
      if (expired) { await reg.unregister(); return; }
      const worker = reg.active || reg.waiting || reg.installing;
      if (!worker) return finish(unavailable('No service worker instance'));
      const send = () => {
        if (expired) return;
        if (worker.state === 'activated') worker.postMessage({type: 'navigator-snapshot', mode}, [channel.port2]);
        else if (worker.state === 'redundant') finish(unavailable('Service worker became redundant'));
      };
      worker.addEventListener('statechange', send);
      clean(() => worker.removeEventListener('statechange', send));
      send();
    }).catch(error => finish(unavailable(messageOf(error))));
  });
  if (registration) {
    try { cleanupStatus = await cleanupPromise; }
    catch (error) { cleanupStatus = 'cleanup failed: ' + messageOf(error); }
  } else if (pending) cleanupStatus = 'pending registration will be unregistered if it resolves';
  return {...result, cleanup: cleanupStatus};
}
function ua(context) {
  const value = context?.properties?.userAgent;
  return context?.status === 'ok' && value?.type === 'value' && typeof value.value === 'string' ? value.value : null;
}
function el(tag, text, className) {
  const node = document.createElement(tag); if (text !== undefined) node.textContent = text;
  if (className) node.className = className; return node;
}
function format(value) {
  if (!value) return 'Not exposed';
  if (value.type === 'value') return typeof value.value === 'string' ? JSON.stringify(value.value) : String(value.value);
  if (value.type === 'undefined') return 'undefined';
  if (value.type === 'function' || value.type === 'error' || value.type === 'reference') return value.value;
  return JSON.stringify(value, null, 2);
}
function comparison(values) {
  if (values.some(v => v?.type === 'error')) return 'Unreadable';
  const exposed = values.filter(Boolean);
  if (exposed.length < values.length) return 'Availability differs';
  if (exposed.length < 2) return 'Insufficient coverage';
  if (new Set(exposed.map(v => JSON.stringify(v))).size === 1) return 'Matches';
  if (exposed.some(v => ['object', 'function', 'reference'].includes(v.type))) return 'API snapshot differs';
  return 'Values differ';
}
function render(result) {
  const available = ids.filter(id => ua(result.contexts[id]) !== null);
  const distinct = new Set(available.map(id => ua(result.contexts[id])));
  const mismatch = distinct.size > 1;
  const complete = available.length === ids.length;
  result.uaComparison = {status: mismatch ? 'different' : complete ? 'matching' : 'incomplete', readable: available.length, total: ids.length};
  $('status').textContent = mismatch ? 'User-Agent differences found' : complete ? 'User-Agents match across all contexts' : 'Comparison incomplete';
  $('coverage').textContent = `${available.length} of ${ids.length} contexts returned readable User-Agents.${!complete && !mismatch && available.length > 1 ? ' Available readings match.' : ''}`;
  const headless = available.filter(id => /headless/i.test(ua(result.contexts[id])));
  $('headless').hidden = !headless.length;
  $('headless').textContent = headless.length ? 'Headless User-Agent reported in: ' + headless.map(id => labels[id]).join(', ') + '.' : '';
  $('contexts').replaceChildren();
  for (const group of [['page'], ['frame'], ['dedicated', 'shared', 'service']]) {
    const card = el('article', undefined, 'context');
    card.append(el('h2', group.length === 1 ? labels[group[0]] : 'Workers'));
    if (group.length === 1) appendReading(card, group[0]);
    else {
      const workerValues = group.map(id => ua(result.contexts[id]));
      const allSame = workerValues.every(v => v !== null && v === workerValues[0]);
      card.append(el('span', allSame ? '3 worker types agree' : 'Worker readings need review', 'badge'));
      if (allSame) card.append(el('p', workerValues[0], 'reading'));
      const detail = el('details'); detail.open = mismatch || !allSame;
      detail.append(el('summary', 'Three worker types'));
      for (const id of group) { detail.append(el('h3', labels[id])); appendReading(detail, id); }
      card.append(detail);
    }
    $('contexts').append(card);
  }
  function appendReading(parent, id) {
    const context = result.contexts[id];
    const value = ua(context);
    parent.append(el('p', value === null ? (context.reason || 'User-Agent unreadable') : value, 'reading'));
    if (context.cleanup && context.cleanup !== 'unregistered') parent.append(el('p', 'Service worker: ' + context.cleanup, 'unavailable'));
  }
  if (mode === 'full') {
    $('full-results').hidden = false;
    const names = [...new Set(ids.flatMap(id => Object.keys(result.contexts[id].properties || {})))].sort();
    const usable = ids.filter(id => result.contexts[id].status === 'ok');
    result.propertyComparison = names.map(name => ({property: name, comparison: comparison(usable.map(id => result.contexts[id].properties[name]))}));
    const counts = result.propertyComparison.reduce((all, row) => { all[row.comparison] = (all[row.comparison] || 0) + 1; return all; }, {});
    $('status').textContent = usable.length === ids.length ? 'Navigator comparison complete' : 'Navigator comparison incomplete';
    $('coverage').textContent = `${usable.length} of ${ids.length} contexts available. ${counts['Values differ'] || 0} value differences, ${counts['Availability differs'] || 0} availability differences, ${counts['API snapshot differs'] || 0} API snapshot differences and ${counts['Unreadable'] || 0} unreadable properties. User-Agent: ${result.uaComparison.status}.`;
    $('rows').replaceChildren();
    for (const row of result.propertyComparison) {
      const tr = el('tr'); tr.dataset.comparison = row.comparison;
      const th = el('th', row.property); th.scope = 'row'; th.append(el('span', row.comparison, 'comparison')); tr.append(th);
      for (const id of ids) {
        const cell = el('td'); const context = result.contexts[id];
        const value = context.properties?.[row.property];
        const reading = el('pre', context.status === 'ok' ? format(value) : 'Context unavailable');
        if (context.status === 'ok' && value?.type === 'object') {
          const detail = el('details'); detail.append(el('summary', value.brand + ' · inspect'), reading); cell.append(detail);
        } else cell.append(reading);
        tr.append(cell);
      }
      $('rows').append(tr);
    }
    filterRows();
  }
  $('raw').textContent = JSON.stringify(result, null, 2);
}
function filterRows() {
  for (const row of $('rows').children) row.hidden = $('differences').checked && row.dataset.comparison === 'Matches';
}
$('differences').addEventListener('change', filterRows);
async function run() {
  $('run').disabled = true; $('download').disabled = true;
  document.getElementById('probe-complete')?.remove();
  document.documentElement.removeAttribute('data-probe-ready');
  window.__PROBE_RESULT__ = null; window.__PROBE_READY__ = false;
  $('status').textContent = 'Comparing browser contexts…';
  $('headless').hidden = true; $('contexts').replaceChildren(); $('full-results').hidden = true;
  try {
    const results = await Promise.all([Promise.resolve().then(() => collectNavigator(mode)), frameSnapshot(), workerSnapshot(false), workerSnapshot(true), serviceSnapshot()]);
    latest = {version: 1, mode, capturedAt: new Date().toISOString(), contexts: Object.fromEntries(ids.map((id, i) => [id, results[i]]))};
    render(latest);
    latest.complete = true;
    latest.ready = true;
    window.__PROBE_RESULT__ = latest; window.__PROBE_READY__ = true;
    $('raw').textContent = JSON.stringify(latest, null, 2);
    const marker = el('p', 'Comparison complete', 'eyebrow'); marker.id = 'probe-complete'; marker.dataset.status = 'complete';
    $('coverage').after(marker); document.documentElement.dataset.probeReady = 'true';
    document.dispatchEvent(new CustomEvent('probe:ready', {detail: latest}));
    $('download').disabled = false;
  } catch (error) { $('status').textContent = 'Could not complete comparison'; $('coverage').textContent = messageOf(error); }
  finally { $('run').disabled = false; }
}
$('run').addEventListener('click', run);
$('download').addEventListener('click', () => {
  const url = URL.createObjectURL(new Blob([JSON.stringify(latest, null, 2)], {type: 'application/json'}));
  const link = el('a'); link.href = url; link.download = 'scrapetrace-' + (mode === 'full' ? 'navigator' : 'user-agent') + '.json'; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
run();
