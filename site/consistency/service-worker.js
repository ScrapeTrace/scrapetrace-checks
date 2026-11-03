importScripts('/consistency/collect.js');
self.addEventListener('message', event => {
  if (event.data?.type === 'navigator-snapshot' && event.ports[0]) {
    event.ports[0].postMessage(collectNavigator(event.data.mode));
  }
});
