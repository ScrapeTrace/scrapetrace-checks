importScripts('/consistency/collect.js');
self.onmessage = event => self.postMessage(collectNavigator(event.data.mode));
