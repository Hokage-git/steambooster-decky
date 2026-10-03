(function installWebsiteBridge(binding, resolver) {
    const w = globalThis;
    if (w.location.origin !== 'https://steambalance.cc' || typeof w[binding] !== 'function')
        return;
    if (w.SteamBooster?.__linuxBinding === binding)
        return;
    w.SteamBooster?.__dispose?.();
    const pending = new Map();
    let sequence = 0;
    const dispose = () => {
        for (const p of pending.values()) {
            clearTimeout(p.timer);
            p.reject(new Error('Steam context changed'));
        }
        pending.clear();
    };
    const call = (method, args) => new Promise((resolve, reject) => {
        if (pending.size >= 32) {
            reject(new Error('too many requests'));
            return;
        }
        const id = ++sequence;
        const timer = setTimeout(() => {
            pending.delete(id);
            reject(new Error(method === 'activateKey'
                ? 'activation timeout — status unknown, do not retry'
                : 'timeout'));
        }, 45000);
        pending.set(id, { resolve, reject, timer });
        try {
            w[binding](JSON.stringify({ id, method, args }));
        }
        catch (e) {
            clearTimeout(timer);
            pending.delete(id);
            reject(e);
        }
    });
    w[resolver] = (reply) => {
        const p = pending.get(reply.id);
        if (!p)
            return;
        pending.delete(reply.id);
        clearTimeout(p.timer);
        if (reply.ok)
            p.resolve(reply.result);
        else
            p.reject(new Error(reply.error || 'host error'));
    };
    const api = {
        isSteamBooster: true,
        getSteamId: () => call('getSteamId', []),
        activateKey: (key) => call('activateKey', [key]),
        getStoreCountry: (steamId) => call('getStoreCountry', [steamId]),
        getRateAccountData: () => call('getRateAccountData', []),
        purchaseKey: (itemId, options) => call('purchaseKey', [itemId, options]),
    };
    Object.defineProperties(api, {
        __linuxBinding: { value: binding },
        __dispose: { value: dispose },
    });
    Object.defineProperty(w, 'SteamBooster', {
        value: Object.freeze(api),
        configurable: true,
    });
    w.addEventListener('pagehide', dispose, { once: true });
    w.dispatchEvent(new w.Event('sb:embed'));
})("__BINDING__","__RESOLVER__")