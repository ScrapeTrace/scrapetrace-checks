/* Passive navigator snapshot, shared by page, frame and all worker types. */
(function (scope) {
  function keys(value) {
    const names = new Set();
    for (let proto = value; proto && proto !== Object.prototype; proto = Object.getPrototypeOf(proto)) {
      for (const key of Object.getOwnPropertyNames(proto)) if (key !== 'constructor') names.add(key);
    }
    return [...names].sort();
  }
  function describe(value, depth = 0, seen = new Set()) {
    if (value === undefined) return {type: 'undefined'};
    if (value === null || ['string', 'boolean'].includes(typeof value)) return {type: 'value', value};
    if (typeof value === 'number') return {type: 'value', value: Number.isFinite(value) ? value : String(value)};
    if (typeof value === 'function') return {type: 'function', value: 'Function (not called)'};
    if (typeof value !== 'object') return {type: typeof value, value: String(value)};
    if (seen.has(value)) return {type: 'reference', value: 'Circular reference'};
    const brand = Object.prototype.toString.call(value).slice(8, -1);
    if (depth >= 3) return {type: 'object', brand, truncated: 'Depth limit'};
    const next = new Set(seen); next.add(value);
    if (Array.isArray(value)) return {type: 'array', value: value.slice(0, 100).map(v => describe(v, depth + 1, next)), truncated: value.length > 100};
    const names = keys(value);
    const properties = Object.create(null);
    for (const name of names.slice(0, 100)) {
      try { properties[name] = describe(value[name], depth + 1, next); }
      catch (error) { properties[name] = {type: 'error', value: error.name + ': ' + error.message}; }
    }
    return {type: 'object', brand, properties, ...(names.length > 100 ? {truncated: 'Property limit'} : {})};
  }
  scope.collectNavigator = function (mode) {
    const properties = Object.create(null);
    for (const name of mode === 'full' ? keys(navigator) : ['userAgent']) {
      try { properties[name] = describe(navigator[name]); }
      catch (error) { properties[name] = {type: 'error', value: error.name + ': ' + error.message}; }
    }
    return {status: 'ok', properties};
  };
})(globalThis);
