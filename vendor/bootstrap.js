
(function(){
  globalThis.__SB_PLUGINS_MANIFEST__ = __MANIFEST__;

  function sbResolve(requestId, response) {
    if (typeof globalThis.__sb_resolve === 'function') {
      globalThis.__sb_resolve(requestId, response);
    }
  }

  function setupId() {
    const key = '__sb_setup_id';
    let id = null;
    try { id = localStorage.getItem(key); } catch {}
    if (!id) {
      id = Array.from(crypto.getRandomValues(new Uint8Array(16))).map(b => b.toString(16).padStart(2,'0')).join('');
      try { localStorage.setItem(key, id); } catch {}
    }
    return id;
  }

  function configKey(pluginId, name) {
    return '__sb_config_' + pluginId + '_' + name;
  }

  function configRead(pluginId, name) {
    try {
      const raw = localStorage.getItem(configKey(pluginId, name));
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed.v === 1 ? parsed.d : null;
    } catch { return null; }
  }

  function configWrite(pluginId, name, value) {
    localStorage.setItem(configKey(pluginId, name), JSON.stringify({ v: 1, d: value }));
  }

  globalThis.__sb_native_queue = [];
  globalThis.__sb_native = function(payload) {
    const envelope = JSON.parse(payload);
    const reqId = envelope.requestId;
    if (typeof reqId !== 'number') return;

    switch (envelope.op) {
      case 'get_setup_id':
        sbResolve(reqId, { ok: true, result: setupId() });
        return;
      case 'config_read':
        sbResolve(reqId, { ok: true, result: { data: configRead(envelope.pluginId, envelope.args.name) } });
        return;
      case 'config_write':
        configWrite(envelope.pluginId, envelope.args.name, envelope.args.value);
        sbResolve(reqId, { ok: true, result: null });
        return;
      case 'log':
        return;
      default:
        globalThis.__sb_native_queue.push(envelope);
        return;
    }
  };

  globalThis.__sb_resolve = function(requestId, response) {
    console.log('[sb-resolve]', requestId, JSON.stringify(response));
  };
})();
