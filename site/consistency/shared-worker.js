importScripts('/consistency/collect.js');
self.onconnect = event => {
  const port = event.ports[0];
  port.onmessage = message => { port.postMessage(collectNavigator(message.data.mode)); port.close(); };
  port.start();
};
