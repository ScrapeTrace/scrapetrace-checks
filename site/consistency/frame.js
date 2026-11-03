const mode = new URL(location.href).searchParams.get('mode');
parent.postMessage({type: 'navigator-snapshot', result: collectNavigator(mode)}, location.origin);
