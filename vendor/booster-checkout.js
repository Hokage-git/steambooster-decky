(() => {
  // ../../node_modules/.bun/@steambalance+booster-framework@file+..+booster-framework/node_modules/@steambalance/booster-framework/src/api/api-types.ts
  var ContextKind = {
    Main: "main",
    Shared: "shared",
    TabbedBrowser: "tabbedBrowser",
    Web: "web"
  };
  var Capability = {
    Ui: "ui",
    Steam: "steam",
    Configs: "configs",
    Bus: "bus",
    Pages: "pages",
    Keys: "keys",
    Net: "net"
  };
  var SUPPORTED_API_VERSIONS = new Set([1]);

  // src/main/headers.ts
  function getStackVersions(sb2) {
    const pm = typeof window !== "undefined" ? window.__SB_PLUGINS_MANIFEST__ : undefined;
    const injector = typeof pm?.injectorVersion === "string" ? pm.injectorVersion : "";
    const framework = sb2 && typeof sb2.version === "string" ? sb2.version : "";
    return { injector, framework };
  }
  function getBoosterHeaders(sb2, contentType) {
    const pm = typeof window !== "undefined" ? window.__SB_PLUGINS_MANIFEST__ : undefined;
    const { injector, framework } = getStackVersions(sb2);
    const pluginPairs = Array.isArray(pm?.plugins) ? pm.plugins.filter((p) => !!p && typeof p.id === "string" && p.id.length > 0 && typeof p.version === "string" && p.version.length > 0 && !/[\r\n]/.test(p.id) && !/[\r\n]/.test(p.version)).sort((a, b) => a.id.localeCompare(b.id)).map((p) => `${p.id}@${p.version}`) : [];
    const h = { "x-booster": "true" };
    if (injector && !/[\r\n]/.test(injector))
      h["x-booster-injector"] = injector;
    if (framework && !/[\r\n]/.test(framework))
      h["x-booster-framework"] = framework;
    if (pluginPairs.length)
      h["x-booster-plugins"] = pluginPairs.join(";");
    const rawUuid = typeof window !== "undefined" ? window.__SB_BOOSTER_UUID__ : undefined;
    if (typeof rawUuid === "string" && rawUuid && !/[\r\n]/.test(rawUuid))
      h["x-booster-uuid"] = rawUuid;
    if (contentType && !/[\r\n]/.test(contentType))
      h["Content-Type"] = contentType;
    return h;
  }

  // src/urls.ts
  var URLS = {
    paymentMethodsApi: "https://steambalance.cc/api/payments",
    balanceCalcApi: "https://steambalance.cc/api/balance/calc",
    balanceAddApi: "https://steambalance.cc/api/balance/add",
    orders: "https://steambalance.cc/booster/orders",
    catalog: "https://steambalance.cc/c/b810",
    faq: "https://steambalance.cc/booster/faq",
    terms: "https://steambalance.cc/booster/terms",
    privacy: "https://steambalance.cc/booster/privacy",
    telegram: "https://steambalance.cc/c/0eb9",
    paymentImagesBase: "https://steambalance.cc/assets/images/payments",
    popupLogoLink: "https://steambalance.cc",
    support: "https://jivo.chat/OdRu6JcBYZ",
    about: "https://steambalance.cc",
    steamKeysApi: "https://steambalance.cc/api/services/steam_keys"
  };

  // src/main/payment-methods.ts
  var CACHE_KEY = "sb:paymentMethods";
  function buildImageUrl(image) {
    if (/^https?:\/\//i.test(image) || image.startsWith("//"))
      return image;
    return `${URLS.paymentImagesBase}/${image}`;
  }
  function readCache() {
    try {
      if (typeof localStorage === "undefined")
        return [];
      const raw = localStorage.getItem(CACHE_KEY);
      if (!raw)
        return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed))
        return [];
      return parsed.filter((x) => x !== null && typeof x === "object" && typeof x.type === "string" && x.type.length > 0 && typeof x.name === "string" && typeof x.imageUrl === "string");
    } catch {
      return [];
    }
  }
  function writeCache(methods) {
    try {
      if (typeof localStorage === "undefined")
        return;
      localStorage.setItem(CACHE_KEY, JSON.stringify(methods));
    } catch {}
  }
  async function fetchPaymentMethods(sb2) {
    try {
      const r = await fetch(URLS.paymentMethodsApi, {
        method: "GET",
        headers: getBoosterHeaders(sb2)
      });
      if (!r.ok) {
        return null;
      }
      const body = await r.json();
      if (body === null || typeof body !== "object")
        return null;
      const obj = body;
      if (obj.success !== true || !Array.isArray(obj.data))
        return null;
      const dataArr = obj.data;
      const methods = [];
      for (const raw of dataArr) {
        if (raw === null || typeof raw !== "object")
          continue;
        const r2 = raw;
        if (typeof r2.type !== "string" || !r2.type)
          continue;
        if (typeof r2.name !== "string")
          continue;
        if (typeof r2.image !== "string" || !r2.image)
          continue;
        const m = {
          type: r2.type,
          name: r2.name,
          imageUrl: buildImageUrl(r2.image)
        };
        if (typeof r2.badge === "string" && r2.badge)
          m.badge = r2.badge;
        methods.push(m);
      }
      writeCache(methods);
      return methods;
    } catch {
      return null;
    }
  }

  // src/main/urls-helper.ts
  function buildOrdersUrl(baseUrl, uids) {
    const u = new URL(baseUrl);
    for (const id of uids)
      u.searchParams.append("uid[]", id);
    return u.toString();
  }
  function buildSupportUrl(baseUrl, env) {
    const u = new URL(baseUrl);
    u.searchParams.set("utm_source", "desktop_app");
    u.searchParams.set("utm_medium", "support");
    u.searchParams.set("utm_campaign", "app_" + (env.appVersion || "unknown"));
    u.searchParams.set("utm_content", "steam_" + (env.steamVersion || "unknown"));
    u.searchParams.set("utm_term", "os_" + (env.osVersion || "unknown"));
    return u.toString();
  }

  // src/main/order-uids.ts
  var MAX_ORDER_UIDS = 20;
  var UID_RE = /^(?=.*[0-9a-fA-F])[0-9a-fA-F-]{8,64}$/;
  function isValidUid(uid) {
    return typeof uid === "string" && UID_RE.test(uid) && !/[\r\n]/.test(uid);
  }
  function appendOrderUid(list, uid) {
    if (!isValidUid(uid))
      return [...list];
    const without = list.filter((x) => x !== uid);
    const next = [...without, uid];
    return next.length > MAX_ORDER_UIDS ? next.slice(next.length - MAX_ORDER_UIDS) : next;
  }
  function sanitizeStoredUids(raw) {
    if (!Array.isArray(raw))
      return [];
    return raw.filter(isValidUid).slice(-MAX_ORDER_UIDS);
  }

  // src/main/env-info.ts
  var STEAM_UA_RE = /Valve Steam Client\/([0-9.]+)/;
  var WINDOWS_NT_RE = /Windows NT (\d+(?:\.\d+)?)/;
  function extractSteamClientVersion(userAgent) {
    const m = STEAM_UA_RE.exec(userAgent);
    return m ? m[1] : "";
  }
  function extractOsVersionFromUserAgent(userAgent) {
    const m = WINDOWS_NT_RE.exec(userAgent);
    return m ? m[1] : "";
  }
  var UACH_TIMEOUT_MS = 100;
  async function readOsVersion(nav) {
    const uad = nav.userAgentData;
    if (uad && typeof uad.getHighEntropyValues === "function") {
      try {
        const hv = await Promise.race([
          uad.getHighEntropyValues(["platformVersion"]),
          new Promise((_, reject) => setTimeout(() => reject(new Error("uach-timeout")), UACH_TIMEOUT_MS))
        ]);
        if (typeof hv.platformVersion === "string" && hv.platformVersion) {
          return hv.platformVersion;
        }
      } catch {}
    }
    return extractOsVersionFromUserAgent(nav.userAgent);
  }
  async function readSupportEnvInfo() {
    const manifest = typeof window !== "undefined" ? window.__SB_PLUGINS_MANIFEST__ : undefined;
    const appVersion = manifest && typeof manifest.injectorVersion === "string" ? manifest.injectorVersion : "";
    const nav = typeof navigator !== "undefined" ? navigator : undefined;
    const ua = nav?.userAgent ?? "";
    const steamVersion = extractSteamClientVersion(ua);
    const osVersion = nav ? await readOsVersion(nav) : "";
    return { appVersion, steamVersion, osVersion };
  }

  // src/main/orders-embed.ts
  function wireOrdersEmbed(handle, payload) {
    return handle.on("message", (d) => {
      const m = d;
      if (!m || m.__sbEmbed !== true || m.type !== "sb:ready")
        return;
      handle.postMessage({ ...payload, __sbEmbed: true, v: 1, type: "sb:embed-payload" });
    });
  }

  // src/main/orders-keys.ts
  var RESPONSE_MAX_BYTES = 16 * 1024;
  var REQUEST_NAME = "activate-key";
  var RESULT_NAME = "activate-key-result";
  var KEY_MAX = 256;
  function result(requestId, data) {
    return { __sbEmbed: true, v: 1, type: "sb:event", name: RESULT_NAME, data: { requestId, ...data } };
  }
  function byteLength(v) {
    return new TextEncoder().encode(JSON.stringify(v)).length;
  }
  function wireOrdersKeyActivation(handle, deps) {
    return handle.on("message", (d) => {
      const m = d;
      if (!m || m.__sbEmbed !== true || m.type !== "sb:event" || m.name !== REQUEST_NAME)
        return;
      const data = m.data;
      if (!data || typeof data.requestId !== "number" || !Number.isFinite(data.requestId))
        return;
      const requestId = data.requestId;
      const key = data.key;
      if (typeof key !== "string" || key.length < 1 || key.length > KEY_MAX) {
        handle.postMessage(result(requestId, { error: "invalid product key" }));
        return;
      }
      (async () => {
        try {
          const outcome = await deps.activate(key);
          const reply = result(requestId, { outcome });
          if (byteLength(reply) > RESPONSE_MAX_BYTES) {
            handle.postMessage(result(requestId, { error: "activation response too large" }));
            return;
          }
          handle.postMessage(reply);
        } catch (e) {
          handle.postMessage(result(requestId, { error: e instanceof Error ? e.message : String(e) }));
        }
      })();
    });
  }

  // ../../node_modules/.bun/typesafe-i18n@5.27.1+1fb4c65d43e298b9/node_modules/typesafe-i18n/runtime/esm/parser/src/basic.mjs
  var removeEmptyValues = (object) => Object.fromEntries(Object.entries(object).map(([key, value]) => key !== "i" && value && value != "0" && [key, value]).filter(Boolean));
  var trimAllValues = (part) => Object.fromEntries(Object.keys(part).map((key) => {
    const val = part[key];
    return [
      key,
      Array.isArray(val) ? val.map((v) => v === null || v === undefined ? undefined : v.trim()) : val === !!val ? val : val === null || val === undefined ? undefined : val.trim()
    ];
  }));
  var parseArgumentPart = (text) => {
    const [keyPart = "", ...formatterKeys] = text.split("|");
    const [keyWithoutType = "", type] = keyPart.split(":");
    const [key, isOptional] = keyWithoutType.split("?");
    return { k: key, i: type, n: isOptional === "", f: formatterKeys };
  };
  var isBasicPluralPart = (part) => !!(part.o || part.r);
  var parsePluralPart = (content, lastAccessor) => {
    let [key, values] = content.split(":");
    if (!values) {
      values = key;
      key = lastAccessor;
    }
    const entries = values.split("|");
    const [zero, one, two, few, many, rest] = entries;
    const nrOfEntries = entries.filter((entry) => entry !== undefined).length;
    if (nrOfEntries === 1) {
      return { k: key, r: zero };
    }
    if (nrOfEntries === 2) {
      return { k: key, o: zero, r: one };
    }
    if (nrOfEntries === 3) {
      return { k: key, z: zero, o: one, r: two };
    }
    return { k: key, z: zero, o: one, t: two, f: few, m: many, r: rest };
  };
  var REGEX_SWITCH_CASE = /^\{.*\}$/;
  var parseCases = (text) => Object.fromEntries(removeOuterBrackets(text).split(",").map((part) => part.split(":")).reduce((accumulator, entry) => {
    if (entry.length === 2) {
      return [...accumulator, entry.map((entry2) => entry2.trim())];
    }
    accumulator[accumulator.length - 1][1] += "," + entry[0];
    return accumulator;
  }, []));
  var REGEX_BRACKETS_SPLIT = /(\{(?:[^{}]+|\{(?:[^{}]+)*\})*\})/g;
  var removeOuterBrackets = (text) => text.substring(1, text.length - 1);
  var parseRawText = (rawText, optimize = true, firstKey = "", lastKey = "") => rawText.split(REGEX_BRACKETS_SPLIT).map((part) => {
    if (!part.match(REGEX_BRACKETS_SPLIT)) {
      return part;
    }
    const content = removeOuterBrackets(part);
    if (content.startsWith("{")) {
      return parsePluralPart(removeOuterBrackets(content), lastKey);
    }
    const parsedPart = parseArgumentPart(content);
    lastKey = parsedPart.k || lastKey;
    !firstKey && (firstKey = lastKey);
    return parsedPart;
  }).map((part) => {
    if (typeof part === "string")
      return part;
    if (!part.k)
      part.k = firstKey || "0";
    const trimmed = trimAllValues(part);
    return optimize ? removeEmptyValues(trimmed) : trimmed;
  });

  // ../../node_modules/.bun/typesafe-i18n@5.27.1+1fb4c65d43e298b9/node_modules/typesafe-i18n/runtime/esm/runtime/src/core.mjs
  var applyFormatters = (formatters, formatterKeys, initialValue) => formatterKeys.reduce((value, formatterKey) => {
    var _a, _b;
    return (_b = formatterKey.match(REGEX_SWITCH_CASE) ? ((cases) => {
      var _a2;
      return (_a2 = cases[value]) !== null && _a2 !== undefined ? _a2 : cases["*"];
    })(parseCases(formatterKey)) : (_a = formatters[formatterKey]) === null || _a === undefined ? undefined : _a.call(formatters, value)) !== null && _b !== undefined ? _b : value;
  }, initialValue);
  var getPlural = (pluralRules, { z, o, t, f, m, r }, value) => {
    switch (z && value == 0 ? "zero" : pluralRules.select(value)) {
      case "zero":
        return z;
      case "one":
        return o;
      case "two":
        return t;
      case "few":
        return f !== null && f !== undefined ? f : r;
      case "many":
        return m !== null && m !== undefined ? m : r;
      default:
        return r;
    }
  };
  var REGEX_PLURAL_VALUE_INJECTION = /\?\?/g;
  var applyArguments = (textParts, pluralRules, formatters, args) => textParts.map((part) => {
    if (typeof part === "string") {
      return part;
    }
    const { k: key = "0", f: formatterKeys = [] } = part;
    const value = args[key];
    if (isBasicPluralPart(part)) {
      return ((typeof value === "boolean" ? value ? part.o : part.r : getPlural(pluralRules, part, value)) || "").replace(REGEX_PLURAL_VALUE_INJECTION, value);
    }
    const formattedValue = formatterKeys.length ? applyFormatters(formatters, formatterKeys, value) : value;
    return ("" + (formattedValue !== null && formattedValue !== undefined ? formattedValue : "")).trim();
  }).join("");
  var translate = (textParts, pluralRules, formatters, args) => {
    const firstArg = args[0];
    const isObject = firstArg && typeof firstArg === "object" && firstArg.constructor === Object;
    const transformedArgs = args.length === 1 && isObject ? firstArg : args;
    return applyArguments(textParts, pluralRules, formatters, transformedArgs);
  };
  // ../../node_modules/.bun/typesafe-i18n@5.27.1+1fb4c65d43e298b9/node_modules/typesafe-i18n/runtime/esm/runtime/src/util.string.mjs
  var getPartsFromString = (cache, text) => cache[text] || (cache[text] = parseRawText(text));

  // ../../node_modules/.bun/typesafe-i18n@5.27.1+1fb4c65d43e298b9/node_modules/typesafe-i18n/runtime/esm/runtime/src/util.object.mjs
  var getTranslateInstance = (locale, formatters) => {
    const cache = {};
    const pluralRules = new Intl.PluralRules(locale);
    return (text, ...args) => translate(getPartsFromString(cache, text), pluralRules, formatters, args);
  };
  function typesafeI18nObject(locale, translations, formatters = {}) {
    return createProxy(translations, getTranslateInstance(locale, formatters));
  }
  var wrap = (proxyObject = {}, translateFn) => typeof proxyObject === "string" ? translateFn.bind(null, proxyObject) : Object.assign(Object.defineProperty(() => "", "name", { writable: true }), proxyObject);
  var createProxy = (proxyObject, translateFn) => new Proxy(wrap(proxyObject, translateFn), {
    get: (target, key) => {
      if (key === Symbol.iterator)
        return [][Symbol.iterator].bind(Object.values(target).map((entry) => wrap(entry, translateFn)));
      return createProxy(target[key], translateFn);
    }
  });
  // src/generated/messages.ts
  var ru = {
    checkout: {
      amount: {
        placeholder: "Введите сумму"
      },
      error_screen: {
        retry: "Обновить",
        subtitle: "Попробуйте позже",
        title: "Не удалось загрузить методы оплаты"
      },
      footer: {
        secure_note: "Безопасно и конфиденциально"
      },
      header: {
        menu_button: "МЕНЮ"
      },
      info_row: {
        login: "Логин:",
        receive: "Получите:",
        total_will_be: "Итого на балансе будет"
      },
      keys: {
        purchase_window_taskbar_title: "Покупка ключа",
        purchase_window_title: "Покупка ключа — «{gameName:string}»"
      },
      menu: {
        faq: "FAQ",
        my_orders: "МОИ ЗАКАЗЫ",
        privacy: "ПОЛИТИКА",
        settings: "НАСТРОЙКИ",
        support: "ПОДДЕРЖКА",
        telegram: "ТЕЛЕГРАМ",
        terms: "СОГЛАШЕНИЕ"
      },
      pay_button: {
        calc_error: "Ошибка расчёта",
        calculating: "Расчёт...",
        default: "Оплатить",
        desired_too_low: "Желаемый баланс ниже текущего",
        network_error: "Ошибка сети",
        ready: "Оплатить {amount:string} ₽",
        submitting: "Загрузка..."
      },
      pay_error: {
        close_aria: "Закрыть",
        faq: "FAQ",
        generic: "Не удалось обработать запрос. Попробуйте позже или обратитесь в поддержку.",
        support: "Написать в поддержку",
        title: "Упс!"
      },
      payment_methods_error_toast: "Не удалось загрузить методы оплаты",
      popup: {
        button_label: "Пополнить",
        button_tooltip: "Пополнить баланс Steam",
        faq_window_title: "SteamBooster FAQ",
        orders_window_title: "Мои заказы — SteamBalance",
        privacy_window_title: "Политика конфиденциальности — SteamBalance",
        support_window_title: "Поддержка SteamBalance",
        terms_window_title: "Пользовательское соглашение — SteamBalance",
        window_title: "Пополнение аккаунта {login:string}",
        window_title_no_login: "Пополнение аккаунта"
      },
      promo: {
        button: "Каталог",
        title: "Игры дешевле"
      },
      total_input: {
        placeholder: "Желаемый баланс"
      }
    },
    general: {
      product_display_name: "SteamBooster"
    }
  };
  var messages_default = ru;

  // src/i18n.ts
  var LL = typesafeI18nObject("ru", messages_default);

  // src/main/doc-windows.ts
  var DOC_KEYS = ["terms", "privacy", "faq"];
  function isDocKey(x) {
    return typeof x === "string" && DOC_KEYS.includes(x);
  }
  var DOC_WINDOW_DIMS = {
    width: 720,
    height: 640,
    minWidth: 560,
    minHeight: 420
  };
  function docWindowContent(doc) {
    switch (doc) {
      case "terms":
        return { url: URLS.terms, title: LL.checkout.popup.terms_window_title() };
      case "privacy":
        return { url: URLS.privacy, title: LL.checkout.popup.privacy_window_title() };
      case "faq":
        return { url: URLS.faq, title: LL.checkout.popup.faq_window_title() };
    }
  }

  // src/main/keys-payment.ts
  var CACHE_KEY2 = "sb:keysPaymentId";
  function readCache2() {
    try {
      if (typeof localStorage === "undefined")
        return null;
      const v = localStorage.getItem(CACHE_KEY2);
      return typeof v === "string" && v ? v : null;
    } catch {
      return null;
    }
  }
  function writeCache2(value) {
    try {
      if (typeof localStorage !== "undefined")
        localStorage.setItem(CACHE_KEY2, value);
    } catch {}
  }
  async function fetchPaymentId(sb2, fetchImpl) {
    try {
      const r = await fetchImpl(URLS.paymentMethodsApi, { method: "GET", headers: getBoosterHeaders(sb2) });
      if (!r.ok)
        return null;
      const body = await r.json();
      if (body === null || typeof body !== "object")
        return null;
      const data = body.data;
      if (!Array.isArray(data))
        return null;
      for (const raw of data) {
        if (!raw || typeof raw !== "object")
          continue;
        const e = raw;
        const id = typeof e.type === "string" && e.type ? e.type : typeof e.value === "string" && e.value ? e.value : "";
        if (!id)
          continue;
        if (e.disabled === true)
          continue;
        if (e.can_pay_services === false)
          continue;
        return id;
      }
      return null;
    } catch {
      return null;
    }
  }
  async function resolveKeysPaymentId(sb2, fetchImpl = fetch) {
    const cached = readCache2();
    const refresh = fetchPaymentId(sb2, fetchImpl).then((v) => {
      if (v)
        writeCache2(v);
      return v;
    });
    if (cached) {
      return cached;
    }
    return await refresh;
  }

  // src/main/keys-fetch.ts
  function toKeyItem(raw) {
    if (!raw || typeof raw !== "object")
      return null;
    const r = raw;
    if (typeof r.id !== "number" || typeof r.price !== "number")
      return null;
    const pkg = r.package && typeof r.package === "object" ? r.package : null;
    return {
      itemId: r.id,
      name: typeof r.name === "string" ? r.name : "",
      isActive: r.is_active === true,
      regionLabel: typeof r.region_label === "string" ? r.region_label : "",
      packageId: pkg && typeof pkg.id === "number" ? pkg.id : null,
      productType: pkg && typeof pkg.product_type === "string" ? pkg.product_type : null,
      price: r.price,
      oldPrice: typeof r.old_price === "number" ? r.old_price : null,
      discountPercent: typeof r.discount_percent === "number" ? r.discount_percent : 0
    };
  }
  async function fetchKeys(sb2, args) {
    try {
      const q = new URLSearchParams({ paymentId: args.paymentId, appid: String(args.appid) });
      if (args.storeCountry)
        q.set("store_country", args.storeCountry);
      const r = await sb2.net.fetch(`${URLS.steamKeysApi}?${q.toString()}`, { method: "GET" });
      if (!r.ok)
        return [];
      const body = await r.json();
      const items = body?.data?.items;
      if (!Array.isArray(items))
        return [];
      return items.map(toKeyItem).filter((x) => x !== null);
    } catch {
      return [];
    }
  }

  // src/main/keys-order.ts
  async function postKeysOrder(sb2, args) {
    try {
      const r = await sb2.net.fetch(URLS.steamKeysApi, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentId: args.paymentId, itemId: args.itemId, account: args.account, login: args.login })
      });
      const body = await r.json().catch(() => ({}));
      const data = body.data && typeof body.data === "object" ? body.data : {};
      const redirectUrl = (typeof data.redirectUrl === "string" ? data.redirectUrl : undefined) ?? (typeof body.redirectUrl === "string" ? body.redirectUrl : undefined);
      const uid = (typeof data.uid === "string" ? data.uid : undefined) ?? (typeof body.uid === "string" ? body.uid : undefined);
      if (!r.ok || body.success === false || !redirectUrl) {
        const message = typeof body.message === "string" && body.message.trim() ? body.message.trim() : undefined;
        return { ok: false, error: `http-${r.status}`, message };
      }
      return { ok: true, redirectUrl, uid };
    } catch (e) {
      return { ok: false, error: "network" };
    }
  }

  // src/main/keys-install.ts
  var TITLE_MIN = 1;
  var TITLE_MAX = 200;
  function sanitizeTitle(x) {
    return typeof x === "string" && x.length >= TITLE_MIN && x.length <= TITLE_MAX ? x : undefined;
  }
  async function resolveSteamEmail(user) {
    if (!user)
      return;
    try {
      return await user.email() || undefined;
    } catch {
      return;
    }
  }
  async function placeKeysOrder(sb2, deps, fetchImpl, input) {
    const paymentId = await resolveKeysPaymentId(sb2, fetchImpl);
    if (!paymentId)
      return { ok: false, error: "no-payment" };
    const res = await postKeysOrder(sb2, {
      paymentId,
      itemId: input.itemId,
      account: input.account,
      login: input.login
    });
    if (!res.ok || !res.redirectUrl)
      return { ok: false, error: res.error, message: res.message };
    if (res.uid)
      deps.onOrderUid?.(res.uid);
    const opened = await deps.openPayment(res.redirectUrl, input.titles);
    return { ok: opened, orderUid: res.uid, error: opened ? undefined : "window" };
  }
  function installKeysBridge(sb2, deps) {
    const fetchImpl = deps.fetchImpl ?? fetch;
    const subs = [];
    subs.push(sb2.bus.subscribe("booster-addfunds.keys.request", (data) => {
      (async () => {
        const d = data;
        if (!d || typeof d.reqId !== "string" || typeof d.appid !== "number")
          return;
        const reqId = d.reqId;
        const appid = d.appid;
        let storeCountry;
        try {
          storeCountry = await sb2.steam.getStoreCountry();
        } catch {
          storeCountry = undefined;
        }
        const paymentId = await resolveKeysPaymentId(sb2, fetchImpl);
        if (!paymentId) {
          sb2.bus.publish("booster-checkout.keys.response", { reqId, appid, items: [], error: "no-payment" });
          return;
        }
        const items = await fetchKeys(sb2, { appid, paymentId, storeCountry });
        sb2.bus.publish("booster-checkout.keys.response", { reqId, appid, items });
      })();
    }));
    subs.push(sb2.bus.subscribe("booster-addfunds.keys.purchase", (data) => {
      (async () => {
        const d = data;
        if (!d || typeof d.reqId !== "string" || typeof d.itemId !== "number")
          return;
        const reqId = d.reqId;
        const itemId = d.itemId;
        const titles = {
          title: sanitizeTitle(d.windowTitle),
          taskbarTitle: sanitizeTitle(d.windowTaskbarTitle)
        };
        const user = sb2.steam.getCurrentUser();
        const account = typeof d.email === "string" && d.email ? d.email : await resolveSteamEmail(user);
        if (!account) {
          sb2.bus.publish("booster-checkout.keys.email-required", { reqId });
          return;
        }
        const login = user?.accountName ?? "";
        const r = await placeKeysOrder(sb2, deps, fetchImpl, { itemId, account, login, titles });
        sb2.bus.publish("booster-checkout.keys.purchase-result", { reqId, ok: r.ok, error: r.error, message: r.message });
      })();
    }));
    subs.push(sb2.bus.subscribe("booster-checkout.keys.external-purchase", (data) => {
      (async () => {
        const d = data;
        if (!d || typeof d.reqId !== "string" || typeof d.itemId !== "number")
          return;
        const reqId = d.reqId;
        const itemId = d.itemId;
        const gn = typeof d.gameName === "string" && d.gameName ? d.gameName.slice(0, 150) : undefined;
        const titles = {
          title: sanitizeTitle(gn ? LL.checkout.keys.purchase_window_title({ gameName: gn }) : undefined),
          taskbarTitle: sanitizeTitle(LL.checkout.keys.purchase_window_taskbar_title())
        };
        const user = sb2.steam.getCurrentUser();
        const account = await resolveSteamEmail(user);
        if (!account) {
          sb2.bus.publish("booster-checkout.keys.external-purchase-result", { reqId, ok: false, error: "no-email" });
          return;
        }
        const login = user?.accountName ?? "";
        const r = await placeKeysOrder(sb2, deps, fetchImpl, { itemId, account, login, titles });
        sb2.bus.publish("booster-checkout.keys.external-purchase-result", {
          reqId,
          ok: r.ok,
          orderUid: r.orderUid,
          error: r.error,
          message: r.message
        });
      })();
    }));
    async function publishKeysConfig() {
      let storeCountry;
      try {
        storeCountry = await sb2.steam.getStoreCountry();
      } catch {
        storeCountry = undefined;
      }
      const paymentId = await resolveKeysPaymentId(sb2, fetchImpl);
      sb2.bus.publish("booster-checkout.keys.config", { paymentId: paymentId ?? null, storeCountry: storeCountry ?? null });
    }
    subs.push(sb2.bus.subscribe("booster-addfunds.keys.config.request", () => {
      publishKeysConfig();
    }));
    sb2.bus.publish("booster-checkout.keys.ready", {});
    publishKeysConfig();
    return () => {
      for (const u of subs)
        u();
    };
  }

  // src/main/store-currency-fallback.ts
  function installStoreCurrencyFallback(sb2, onResolved) {
    let storeCurrency = null;
    async function refresh() {
      try {
        const c = await sb2.steam.getStoreCurrency?.();
        if (c && c !== storeCurrency) {
          storeCurrency = c;
          onResolved(c);
        }
      } catch {}
    }
    return { get: () => storeCurrency, refresh };
  }

  // src/main/install.ts
  var POPUP_DROPDOWN = "sb_topup";
  var WINDOW_SUPPORT = "sb_support";
  var WINDOW_PAYMENT = "sb_topup_payment";
  var WINDOW_KEYS_PAYMENT = "sb_keys_payment";
  var WINDOW_ORDERS = "sb_orders";
  var WINDOW_FAQ = "sb_faq";
  var WINDOW_TERMS = "sb_terms";
  var WINDOW_PRIVACY = "sb_privacy";
  var POPUP_W = 378;
  var POPUP_H = 322;
  async function installMain(ctx) {
    const sb2 = ctx.sb;
    const ORDER_UIDS_KEY = "order_uids";
    let orderUids = [];
    async function persistOrderUid(uid) {
      if (!isValidUid(uid))
        return;
      orderUids = appendOrderUid(orderUids, uid);
      try {
        await ctx.configs?.write(ORDER_UIDS_KEY, orderUids);
      } catch (e) {
        ctx.log.warn(`order_uids write failed: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    const cleanups = [];
    let paymentMethodsCache = readCache();
    let paymentMethodsLoading = false;
    let paymentMethodsError = null;
    let popupRef = null;
    function postPaymentMethodsIfPossible() {
      if (!popupRef)
        return;
      popupRef.postMessage({
        kind: "payment-methods",
        methods: paymentMethodsCache,
        loading: paymentMethodsLoading,
        error: paymentMethodsError
      });
    }
    async function refreshPaymentMethods() {
      if (paymentMethodsLoading)
        return;
      paymentMethodsLoading = true;
      paymentMethodsError = null;
      postPaymentMethodsIfPossible();
      try {
        const result2 = await fetchPaymentMethods(sb2);
        if (result2 !== null) {
          paymentMethodsCache = result2;
          paymentMethodsError = null;
        } else if (paymentMethodsCache.length === 0) {
          paymentMethodsError = LL.checkout.payment_methods_error_toast();
        }
      } finally {
        paymentMethodsLoading = false;
        postPaymentMethodsIfPossible();
      }
    }
    refreshPaymentMethods();
    await sb2.lifecycle.ready();
    try {
      orderUids = sanitizeStoredUids(await ctx.configs?.read(ORDER_UIDS_KEY));
    } catch {
      orderUids = [];
    }
    const pendingTopups = [];
    let popupReadyForTopup = false;
    let topupPopupRef = null;
    let topupButtonRef = null;
    let pendingPrefillAmount = null;
    function openTopupWithAmount(amount) {
      if (!topupPopupRef)
        return;
      const p = topupPopupRef;
      const rect = topupButtonRef?.getRect();
      let x;
      let y;
      if (rect && rect.right > 0 && rect.bottom > 0) {
        x = window.screenX + rect.right - p.width;
        y = window.screenY + rect.bottom;
      } else {
        x = window.screenX + window.innerWidth - p.width - 16;
        y = window.screenY + 40;
      }
      pendingPrefillAmount = amount;
      p.show({ x, y });
    }
    const unsubTopupOpen = sb2.bus.subscribe("booster-addfunds.topup-requested", (data) => {
      const d = data;
      const raw = d?.amount;
      if (typeof raw !== "number" || !Number.isFinite(raw) || raw <= 0)
        return;
      const amount = Math.floor(raw);
      if (!popupReadyForTopup) {
        pendingTopups.push(amount);
        return;
      }
      openTopupWithAmount(amount);
    });
    cleanups.push(unsubTopupOpen);
    const storeCurrencyFallback = installStoreCurrencyFallback(sb2, () => {
      sendInitCore();
      publishUserSnapshot();
    });
    function publishUserSnapshot() {
      const u = sb2.steam.getCurrentUser();
      if (!u)
        return;
      sb2.bus.publish("booster-checkout.user.snapshot", {
        accountName: u.accountName,
        currency: u.currency ?? storeCurrencyFallback.get(),
        balance: u.balance ?? null
      });
    }
    const unsubSnapshotReq = sb2.bus.subscribe("booster-addfunds.user.snapshot.request", () => {
      publishUserSnapshot();
    });
    cleanups.push(unsubSnapshotReq);
    let keysPaymentHandle = null;
    let keysPaymentInFlight = false;
    async function openKeysPayment(url, titles) {
      if (keysPaymentHandle) {
        try {
          keysPaymentHandle.setUrl(url);
          return true;
        } catch (e) {
          console.error("[booster-checkout] keys setUrl failed:", e);
          return false;
        }
      }
      if (keysPaymentInFlight)
        return false;
      keysPaymentInFlight = true;
      try {
        const handle = await sb2.ui.openExternalWindow({
          id: WINDOW_KEYS_PAYMENT,
          url,
          ...titles?.title ? { title: titles.title } : {},
          ...titles?.taskbarTitle ? { taskbarTitle: titles.taskbarTitle } : {}
        });
        keysPaymentHandle = handle;
        handle.on("close", () => {
          keysPaymentHandle = null;
        });
        return true;
      } catch (e) {
        console.error("[booster-checkout] keys openExternalWindow failed:", e);
        return false;
      } finally {
        keysPaymentInFlight = false;
      }
    }
    cleanups.push(installKeysBridge(sb2, {
      openPayment: openKeysPayment,
      onOrderUid: (uid) => {
        persistOrderUid(uid);
      }
    }));
    console.log("[booster-checkout] attaching popup...");
    const popup = await sb2.ui.attachPopup({
      id: POPUP_DROPDOWN,
      html: `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="utf-8">
<title>Пополнение баланса</title>
<style>
/* payload/popup-svelte/styles/tokens.css */
:root {
  /* Brand */
  --booster-brand-green:        #34a37b;
  --booster-brand-green-hover:  #3eb487;
  --booster-brand-green-active: #2a8c69;
  --booster-total-green:        #2ee4a2;
  --booster-soon-green:         #93e0ad;
  --booster-soon-bg:            #93e0ad1a;

  /* Surface */
  --booster-surface-0:          #25282e;
  --booster-surface-1:          #2b2b37;
  --booster-surface-2:          #3d4450;
  --booster-surface-3:          #21212c;
  --booster-surface-hover:      #48505c;
  --booster-divider:            #0000000d;
  /* Steam-native popups carry a 1px black border on the window edge.
   * Verified live against the Notifications Menu CDP target: the inner
   * panel is 0.8px solid #000 over #25282e + radial-gradient highlight
   * at top-left. Browsers can't draw 0.8px reliably (sub-pixel borders
   * are renderer-dependent), so we widen to 1px (visually identical at
   * 100% DPI scale) and pair with the inset highlight shadow on .root
   * to match the native frame. */
  --booster-popup-stroke:       #000000;
  /* Native Notifications-popup highlight: radial gradient + inset
   * shadows lifted directly from Steam's computed style on the inner
   * popup div. The radial gives a subtle "lit from top-left" sheen;
   * the inset shadow pair (bright TL + darker BR) draws the 1px
   * inner frame that sits below the black outer border. */
  --booster-popup-bg-highlight: radial-gradient(circle at left top, rgba(74, 81, 92, 0.4) 0%, rgba(75, 81, 92, 0) 60%);
  --booster-popup-inset-shadow: inset 1px 1px 1px 0 rgba(61, 68, 80, 0.75), inset -1px -1px 1px 0 rgba(61, 68, 80, 0.25);
  /* Pay-error modal: full-cover scrim (#171D25 at ~90% alpha via the
   * E5 hex) + card surface, both lifted from modal-design.xml. */
  --booster-modal-scrim:   #171d25e5;
  --booster-modal-surface: #2d333c;

  /* Text */
  --booster-text-primary:       #ffffff;
  --booster-text-secondary:     #67707b;
  --booster-text-muted:         rgba(255, 255, 255, 0.3);

  /* Typography — Motiva Sans is Steam's native UI face. We deliberately
   * do NOT ship a custom brand webfont: the popup must be visually
   * indistinguishable from Steam's own popups (Notifications, Friends),
   * so we inherit Motiva from Steam's runtime instead of layering a
   * brand face on top.
   *
   * Weight availability in Steam's runtime (verified via
   * \`document.fonts.check('<W> 14px "Motiva Sans"')\` on a live CDP
   * target): only 400 (Regular) and 700 (Bold) are LOADED. The Figma
   * design specifies 500 (Medium) for several secondary-text slots
   * (Footer copy, InfoRow labels, TotalBox label); we intentionally
   * keep \`font-weight: 500\` in those rules so the CSS still expresses
   * design intent, but at render time CSS Fonts L4 substitution will
   * fall back to 400 (closest lighter available weight). 600 maps to
   * the loaded 700. This mirrors Steam's own popups which also only
   * use 400/700 in practice — matching the runtime is more important
   * than literal Figma-weight fidelity. */
  --booster-font-stack: 'Motiva Sans', Arial, Helvetica, sans-serif;
  /* Weight tokens — semantic names so a future "switch all 500 → 700"
   * (or shipping a Medium woff2) is a single-line edit. Match the
   * Figma weights as authored, even where the runtime substitutes
   * (see comment above). */
  --booster-fw-medium: 500;
  --booster-fw-bold:   700;

  /* Geometry — popup root is sharp-cornered to match Steam Notifications. */
  --booster-radius-sm: 2px;
  --booster-radius-md: 4px;
  --booster-radius-pill: 12px;
}

/* payload/popup-svelte/styles/reset.css */
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body {
  /* Transparent so the taller popup window (panel + 8px gap + promo block)
   * composites the empty gap through to the Steam main window behind it — the
   * promo appears to float below the popup. The popup panel (.root) paints its
   * own opaque #25282e fill and covers its region 1:1, so its native look is
   * unchanged. The window backing is alpha-capable (COMPOSITED +
   * TRANSPARENT_PARENT dropdown flags). */
  background: transparent;
  font-family: var(--booster-font-stack);
  color: var(--booster-text-primary);
  /* Fill the whole popup window so overflow:hidden clips at the window edge,
   * not at the in-flow content height (panel+gap+promo). Without this, body
   * shrinks to the block and cuts off the money illustration that overhangs
   * below it into the transparent floating strip. */
  height: 100%;
  overflow: hidden;
  user-select: none;
  -webkit-user-select: none;
}

/* bun-svelte:bun-svelte:MethodPicker.svelte-t0jqmw6emrg1-style.css */
.picker.svelte-3pu6qb5q6iq2r {
  position: relative;
  flex: 1;
  min-width: 0;
  height: 32px;
}

.trigger.svelte-3pu6qb5q6iq2r {
  display: flex;
  background: var(--booster-surface-2);
  cursor: pointer;
  border-radius: var(--booster-radius-sm);
  color: var(--booster-text-primary);
  font: 700 12px / 16px var(--booster-font-stack);
  outline: none;
  border: none;
  align-items:  center;
  gap: 8px;
  width: 100%;
  height: 100%;
  padding: 0 12px;
  transition: background-color .12s;
}

.trigger.svelte-3pu6qb5q6iq2r:hover {
  background: var(--booster-surface-hover);
}

.trigger.svelte-3pu6qb5q6iq2r:focus {
  outline: none;
}

.trigger.svelte-3pu6qb5q6iq2r:focus-visible {
  outline: none;
}

.icon.svelte-3pu6qb5q6iq2r {
  display: inline-flex;
  flex-shrink: 0;
  justify-content: center;
  align-items:  center;
  width: 29px;
  height: 14px;
}

.icon.svelte-3pu6qb5q6iq2r img:where(.svelte-3pu6qb5q6iq2r) {
  object-fit: contain;
  display: block;
  width: 100%;
  height: 100%;
}

.spinner.svelte-3pu6qb5q6iq2r {
  border: 2px solid var(--booster-surface-3);
  border-top-color: var(--booster-text-primary);
  animation: svelte-3pu6qb5q6iq2r-booster-spin .7s linear infinite;
  border-radius: 50%;
  width: 12px;
  height: 12px;
}

@keyframes svelte-3pu6qb5q6iq2r-booster-spin {
  to {
    transform: rotate(360deg);
  }
}

.name.svelte-3pu6qb5q6iq2r {
  white-space: nowrap;
}

.badge.svelte-3pu6qb5q6iq2r {
  background: var(--booster-soon-bg);
  color: var(--booster-soon-green);
  font: 800 10px / 12px var(--booster-font-stack);
  letter-spacing: .02em;
  border-radius: 6px;
  flex-shrink: 0;
  padding: 2px 4px;
}

.chevron.svelte-3pu6qb5q6iq2r {
  display: inline-flex;
  flex-shrink: 0;
  margin-left: auto;
  transition: transform .12s;
}

.chevron.svelte-3pu6qb5q6iq2r svg {
  width: 8px;
  height: 8px;
}

.chevron.open.svelte-3pu6qb5q6iq2r {
  transform: rotate(180deg);
}

.menu.svelte-3pu6qb5q6iq2r {
  list-style: none;
  position: absolute;
  background: var(--booster-surface-2);
  border-radius: var(--booster-radius-md);
  overflow: hidden;
  z-index: 20;
  width: 100%;
  padding: 0;
  top: 36px;
  right: 0;
  box-shadow: 0 8px 32px #00000080;
}

.item.svelte-3pu6qb5q6iq2r button:where(.svelte-3pu6qb5q6iq2r) {
  display: flex;
  background: var(--booster-surface-2);
  cursor: pointer;
  color: var(--booster-text-primary);
  font: 700 12px / 16px var(--booster-font-stack);
  outline: none;
  border: none;
  align-items:  center;
  gap: 8px;
  width: 100%;
  padding: 8px 12px;
  transition: background-color .12s;
}

.item.svelte-3pu6qb5q6iq2r button:where(.svelte-3pu6qb5q6iq2r):focus {
  outline: none;
}

.item.svelte-3pu6qb5q6iq2r button:where(.svelte-3pu6qb5q6iq2r):focus-visible {
  outline: none;
}

.item.svelte-3pu6qb5q6iq2r button:where(.svelte-3pu6qb5q6iq2r):hover {
  background: var(--booster-surface-hover);
}

.item.active.svelte-3pu6qb5q6iq2r button:where(.svelte-3pu6qb5q6iq2r) {
  background: var(--booster-surface-hover);
}

.check.svelte-3pu6qb5q6iq2r {
  display: inline-flex;
  flex-shrink: 0;
  justify-content: center;
  align-items:  center;
  width: 8px;
  height: 8px;
  margin-left: auto;
}

.check.svelte-3pu6qb5q6iq2r svg {
  display: block;
  width: 8px;
  height: 6px;
}

/* bun-svelte:bun-svelte:AmountRow.svelte-27tubf2fngmce-style.css */
.row.svelte-bcuwcmp5u0do {
  display: flex;
  gap: 8px;
  height: 32px;
  margin-top: 8px;
}

.amount-cell.svelte-bcuwcmp5u0do {
  display: flex;
  background: var(--booster-surface-2);
  border-radius: var(--booster-radius-sm);
  border: 1px solid #0000;
  flex: 1;
  align-items:  center;
  min-width: 0;
  height: 32px;
  padding: 0 12px;
  transition: border-color .12s;
}

.amount-cell.svelte-bcuwcmp5u0do:focus-within {
  border-color: var(--booster-surface-hover);
}

.amount-input.svelte-bcuwcmp5u0do {
  outline: none;
  color: var(--booster-text-primary);
  font: 700 14px / 16px var(--booster-font-stack);
  background: none;
  border: none;
  flex: 1;
  min-width: 0;
}

.amount-input.svelte-bcuwcmp5u0do::placeholder {
  color: var(--booster-text-muted);
}

.suffix.svelte-bcuwcmp5u0do {
  color: var(--booster-text-primary);
  font: 700 14px / 16px var(--booster-font-stack);
  margin-left: 4px;
}

.suffix.invisible.svelte-bcuwcmp5u0do {
  visibility: hidden;
}

/* bun-svelte:bun-svelte:Footer.svelte-3e55aba1dtc7m-style.css */
.footer.svelte-2nmw93bwhumj2 {
  display: flex;
  justify-content: center;
  align-items:  center;
  gap: 4px;
  height: 12px;
  margin-top: auto;
}

.icon.svelte-2nmw93bwhumj2 {
  display: inline-flex;
  opacity: .5;
}

.icon.svelte-2nmw93bwhumj2 svg {
  width: 10px;
  height: 10px;
}

.label.svelte-2nmw93bwhumj2 {
  font: var(--booster-fw-medium) 10px / 12px var(--booster-font-stack);
  color: var(--booster-text-primary);
  opacity: .5;
}

/* bun-svelte:bun-svelte:Header.svelte-2oe1hm5108edw-style.css */
.header.svelte-1wz4py3st2cvt {
  display: flex;
  flex-shrink: 0;
  justify-content: space-between;
  align-items:  center;
  height: 24px;
}

.logo-link.svelte-1wz4py3st2cvt {
  display: inline-flex;
  cursor: pointer;
  outline: none;
  -webkit-tap-highlight-color: transparent;
}

.logo-link.svelte-1wz4py3st2cvt:focus {
  outline: none;
}

.logo-link.svelte-1wz4py3st2cvt:focus-visible {
  outline: none;
}

.logo.svelte-1wz4py3st2cvt {
  object-fit: contain;
  width: auto;
  height: 18px;
  transition: filter .15s;
}

.logo-link.svelte-1wz4py3st2cvt:hover .logo:where(.svelte-1wz4py3st2cvt) {
  filter: brightness(1.15);
}

.menu-trigger.svelte-1wz4py3st2cvt {
  display: flex;
  cursor: pointer;
  color: var(--booster-text-secondary);
  font: 700 10px / 12px var(--booster-font-stack);
  outline: none;
  background: none;
  border: none;
  align-items:  center;
  gap: 6px;
  height: 24px;
  padding: 6px 4px;
  transition: color .12s;
}

.menu-trigger.svelte-1wz4py3st2cvt:hover {
  color: var(--booster-text-primary);
}

.menu-trigger.svelte-1wz4py3st2cvt:focus {
  outline: none;
}

.menu-trigger.svelte-1wz4py3st2cvt:focus-visible {
  outline: none;
}

.icon-gear.svelte-1wz4py3st2cvt {
  display: inline-flex;
  opacity: .5;
  transition: opacity .12s;
}

.menu-trigger.svelte-1wz4py3st2cvt:hover .icon-gear:where(.svelte-1wz4py3st2cvt) {
  opacity: 1;
}

.icon-gear.svelte-1wz4py3st2cvt svg {
  display: block;
  width: 10px;
  height: 10px;
}

.label.svelte-1wz4py3st2cvt {
  letter-spacing: .02em;
}

.chevron.svelte-1wz4py3st2cvt {
  display: inline-flex;
  transition: transform .12s;
}

.chevron.svelte-1wz4py3st2cvt svg {
  display: block;
  width: 8px;
  height: 8px;
}

.chevron.open.svelte-1wz4py3st2cvt {
  transform: rotate(180deg);
}

/* bun-svelte:bun-svelte:InfoRow.svelte-3ko8n6lgz2r0c-style.css */
.row.svelte-1396edna6qnfv {
  display: flex;
  align-items:  center;
  gap: 4px;
  height: 16px;
}

.label.svelte-1396edna6qnfv {
  font: var(--booster-fw-medium) 12px / 16px var(--booster-font-stack);
  color: var(--booster-text-primary);
  opacity: .5;
  flex-shrink: 0;
}

.value.svelte-1396edna6qnfv {
  font: var(--booster-fw-medium) 12px / 16px var(--booster-font-stack);
  color: var(--booster-text-primary);
  flex-shrink: 0;
}

.dots.svelte-1396edna6qnfv {
  color: var(--booster-text-primary);
  opacity: .5;
  background-image: radial-gradient(circle, currentColor 1px, #0000 1px);
  background-repeat: repeat-x;
  background-size: 4px 2px;
  flex: 1;
  align-self:  end;
  height: 2px;
  margin: 0 4px 4px;
}

/* bun-svelte:bun-svelte:MenuDropdown.svelte-29i5jebucenl0-style.css */
.menu.svelte-29y9fywxyagyi {
  list-style: none;
  border-radius: var(--booster-radius-md);
  overflow: hidden;
  width: 140px;
}

.row.svelte-29y9fywxyagyi {
  display: flex;
  background: var(--booster-surface-2);
  cursor: pointer;
  color: var(--booster-text-primary);
  text-decoration: none;
  font: 700 10px / 12px var(--booster-font-stack);
  box-shadow: inset 0 -1px 0 var(--booster-divider);
  outline: none;
  border: none;
  align-items:  center;
  gap: 11px;
  width: 100%;
  height: 32px;
  padding: 0 12px;
  transition: background-color .12s;
}

.row.svelte-29y9fywxyagyi:focus {
  outline: none;
}

.row.svelte-29y9fywxyagyi:focus-visible {
  outline: none;
}

.row.svelte-29y9fywxyagyi:last-child {
  box-shadow: none;
}

.row.svelte-29y9fywxyagyi:hover {
  background: var(--booster-surface-hover);
}

.row[aria-disabled="true"].svelte-29y9fywxyagyi {
  cursor: default;
}

.icon.svelte-29y9fywxyagyi, .label.svelte-29y9fywxyagyi {
  opacity: .5;
  transition: opacity .12s;
}

.row.svelte-29y9fywxyagyi:hover .icon:where(.svelte-29y9fywxyagyi) {
  opacity: 1;
}

.row.svelte-29y9fywxyagyi:hover .label:where(.svelte-29y9fywxyagyi) {
  opacity: 1;
}

.icon.svelte-29y9fywxyagyi {
  display: inline-flex;
  align-items:  center;
  width: 12px;
  height: 12px;
}

.icon.svelte-29y9fywxyagyi svg {
  display: block;
  width: 12px;
  height: 12px;
}

.label.svelte-29y9fywxyagyi {
  white-space: nowrap;
}

/* bun-svelte:bun-svelte:PayButton.svelte-bffjjn9n1xsn-style.css */
.pay.svelte-3z2n6p7emyyh {
  display: block;
  border-radius: var(--booster-radius-sm);
  background: var(--booster-brand-green);
  color: var(--booster-text-primary);
  font: 700 14px / 16px var(--booster-font-stack);
  cursor: pointer;
  border: none;
  width: 100%;
  margin-top: 8px;
  padding: 8px 12px;
  transition: background-color .12s;
}

.pay.svelte-3z2n6p7emyyh:hover:not(:disabled) {
  background: var(--booster-brand-green-hover);
}

.pay.svelte-3z2n6p7emyyh:disabled {
  color: var(--booster-text-muted);
  cursor: default;
  background: #67707b4d;
}

/* bun-svelte:bun-svelte:PayErrorModal.svelte-1f28j05sjeadc-style.css */
.pe-overlay.svelte-vlfjpr04kqzc {
  position: absolute;
  z-index: 30;
  display: flex;
  justify-content: center;
  align-items:  center;
  inset: 0;
}

.pe-scrim.svelte-vlfjpr04kqzc {
  position: absolute;
  background: var(--booster-modal-scrim);
  inset: 0;
}

.pe-card.svelte-vlfjpr04kqzc {
  position: relative;
  box-sizing: border-box;
  display: flex;
  background: var(--booster-modal-surface);
  border-radius: var(--booster-radius-md);
  border: 1px solid #ffffff0d;
  flex-direction: column;
  gap: 8px;
  width: 314px;
  max-width: calc(100% - 48px);
  max-height: calc(100% - 24px);
  padding: 16px;
}

.pe-close.svelte-vlfjpr04kqzc {
  position: absolute;
  cursor: pointer;
  opacity: .7;
  outline: none;
  background: none;
  border: none;
  width: 12px;
  height: 12px;
  padding: 0;
  transition: opacity .12s;
  top: 14px;
  right: 14px;
}

.pe-close.svelte-vlfjpr04kqzc:hover {
  opacity: 1;
}

.pe-close.svelte-vlfjpr04kqzc:focus {
  outline: none;
}

.pe-close.svelte-vlfjpr04kqzc:focus-visible {
  outline: none;
}

.pe-close.svelte-vlfjpr04kqzc svg {
  display: block;
  width: 12px;
  height: 12px;
}

.pe-text.svelte-vlfjpr04kqzc {
  display: flex;
  overflow-y: auto;
  color: var(--booster-text-primary);
  font: var(--booster-fw-medium) 13px / 1.5 var(--booster-font-stack);
  letter-spacing: .02em;
  flex-direction: column;
  padding-right: 16px;
}

.pe-title.svelte-vlfjpr04kqzc {
  font-weight: var(--booster-fw-bold);
}

.pe-body.svelte-vlfjpr04kqzc {
  white-space: pre-wrap;
}

.pe-actions.svelte-vlfjpr04kqzc {
  display: flex;
  gap: 8px;
}

.pe-btn.svelte-vlfjpr04kqzc {
  display: inline-flex;
  background: var(--booster-brand-green);
  color: var(--booster-text-primary);
  border-radius: var(--booster-radius-md);
  font: var(--booster-fw-bold) 10px / 16px var(--booster-font-stack);
  cursor: pointer;
  outline: none;
  white-space: nowrap;
  border: none;
  flex: 1;
  justify-content: center;
  align-items:  center;
  height: 32px;
  padding: 8px 12px;
  transition: background-color .12s;
}

.pe-btn.svelte-vlfjpr04kqzc:hover {
  background: var(--booster-brand-green-hover);
}

.pe-btn.svelte-vlfjpr04kqzc:focus {
  outline: none;
}

.pe-btn.svelte-vlfjpr04kqzc:focus-visible {
  outline: none;
}

/* bun-svelte:bun-svelte:PaymentMethodsError.svelte-wt5q7z57sy1j-style.css */
.error.svelte-tx6kxlh5kmy6 {
  display: flex;
  flex-direction: column;
  flex: 1;
  justify-content: center;
  align-items:  center;
  gap: 12px;
  padding: 16px 24px;
}

.title.svelte-tx6kxlh5kmy6 {
  font: var(--booster-fw-bold) 14px / 18px var(--booster-font-stack);
  color: var(--booster-text-primary);
  text-align: center;
  margin: 0;
}

.subtitle.svelte-tx6kxlh5kmy6 {
  font: var(--booster-fw-medium) 12px / 16px var(--booster-font-stack);
  color: var(--booster-text-secondary);
  text-align: center;
  margin: 0;
}

.btn-refresh.svelte-tx6kxlh5kmy6 {
  background: var(--booster-brand-green);
  color: var(--booster-text-primary);
  border-radius: var(--booster-radius-sm);
  font: var(--booster-fw-bold) 13px / 16px var(--booster-font-stack);
  cursor: pointer;
  outline: none;
  border: none;
  margin-top: 4px;
  padding: 8px 24px;
  transition: background-color .12s;
}

.btn-refresh.svelte-tx6kxlh5kmy6:hover {
  background: var(--booster-brand-green-hover);
}

.btn-refresh.svelte-tx6kxlh5kmy6:focus {
  outline: none;
}

.btn-refresh.svelte-tx6kxlh5kmy6:focus-visible {
  outline: none;
}

/* bun-svelte:bun-svelte:TotalBox.svelte-3i62s237i4u1o-style.css */
.box.svelte-3rcvu548pqj64 {
  display: flex;
  align-items: stretch;
  height: 32px;
  margin-top: 8px;
}

.label-cell.svelte-3rcvu548pqj64 {
  display: flex;
  border: 2px solid var(--booster-surface-2);
  border-top-left-radius: var(--booster-radius-md);
  border-bottom-left-radius: var(--booster-radius-md);
  border-right: none;
  flex: 0 0 193px;
  align-items:  center;
  padding: 0 12px;
}

.label.svelte-3rcvu548pqj64 {
  white-space: nowrap;
  font: var(--booster-fw-medium) 12px / 12px var(--booster-font-stack);
  color: var(--booster-text-primary);
}

.input-cell.svelte-3rcvu548pqj64 {
  display: flex;
  background: var(--booster-surface-2);
  border-top-right-radius: var(--booster-radius-md);
  border-bottom-right-radius: var(--booster-radius-md);
  flex: auto;
  justify-content: flex-end;
  align-items:  center;
  gap: 8px;
  min-width: 0;
  padding: 0 12px;
}

.desired-input.svelte-3rcvu548pqj64 {
  outline: none;
  text-align: right;
  color: var(--booster-total-green);
  font: var(--booster-fw-bold) 14px / 16px var(--booster-font-stack);
  background: none;
  border: none;
  flex: 1;
  min-width: 0;
}

.desired-input.svelte-3rcvu548pqj64::placeholder {
  color: var(--booster-text-muted);
}

.amount-static.svelte-3rcvu548pqj64 {
  text-align: right;
  color: var(--booster-total-green);
  font: var(--booster-fw-bold) 14px / 16px var(--booster-font-stack);
}

.suffix.svelte-3rcvu548pqj64 {
  color: var(--booster-total-green);
  font: var(--booster-fw-bold) 14px / 16px var(--booster-font-stack);
}

.suffix.invisible.svelte-3rcvu548pqj64 {
  visibility: hidden;
}

/* bun-svelte:bun-svelte:App.svelte-3vjjy8r42m2hg-style.css */
.root.svelte-1tt5ni5l81491 {
  background: var(--booster-popup-bg-highlight), var(--booster-surface-0);
  border: 1px solid var(--booster-popup-stroke);
  box-shadow: var(--booster-popup-inset-shadow);
  box-sizing: border-box;
  position: relative;
  display: flex;
  border-radius: 0;
  flex-direction: column;
  width: 378px;
  height: 248px;
  padding: 20px 20px 8px;
}

.menu-overlay.svelte-1tt5ni5l81491 {
  position: absolute;
  z-index: 10;
  top: 44px;
  right: 20px;
}

.info-rows.svelte-1tt5ni5l81491 {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 8px;
}

.body-slot.svelte-1tt5ni5l81491 {
  display: contents;
}

.stack.svelte-1tt5ni5l81491 {
  position: relative;
  width: 378px;
}

.promo-wrap.svelte-1tt5ni5l81491 {
  display: contents;
}

.promo-gap.svelte-1tt5ni5l81491 {
  height: 8px;
}

.promo.svelte-1tt5ni5l81491 {
  position: relative;
  display: flex;
  overflow: visible;
  background: linear-gradient(90deg, #664cfe33, #34a37b33), #21212c;
  border-radius: 6px;
  justify-content: space-between;
  align-items:  center;
  width: 378px;
  height: 48px;
  padding: 0 8px 0 16px;
}

.promo-title.svelte-1tt5ni5l81491 {
  position: relative;
  z-index: 2;
  color: #fff;
  font-weight: var(--booster-fw-bold);
  letter-spacing: .02em;
  white-space: nowrap;
  font-size: 16px;
  line-height: 1.5;
}

.promo-btn.svelte-1tt5ni5l81491 {
  position: relative;
  z-index: 2;
  display: flex;
  cursor: pointer;
  background: var(--booster-brand-green);
  color: #fff;
  font-family: inherit;
  font-weight: var(--booster-fw-bold);
  letter-spacing: .02em;
  white-space: nowrap;
  border: 0;
  border-radius: 6px;
  align-items:  center;
  gap: 8px;
  padding: 8px 12px;
  font-size: 12px;
  line-height: 16px;
}

.promo-btn.svelte-1tt5ni5l81491:hover {
  background: var(--booster-brand-green-hover);
}

.promo-btn.svelte-1tt5ni5l81491:active {
  background: var(--booster-brand-green-active);
}

.promo-btn.svelte-1tt5ni5l81491 svg {
  display: block;
  flex-shrink: 0;
  width: 12px;
  height: 12px;
}

.promo-money.svelte-1tt5ni5l81491 {
  position: absolute;
  z-index: 1;
  pointer-events: none;
  user-select: none;
  -webkit-user-select: none;
  height: 68px;
  bottom: -10px;
  left: 50%;
  transform: translateX(-50%)scale(.8);
}

</style>
</head>
<body>
<div id="root"></div>
<script>
(() => {
  // ../../node_modules/.bun/esm-env@1.2.2/node_modules/esm-env/true.js
  var true_default = true;
  // ../../node_modules/.bun/svelte@5.55.9/node_modules/svelte/src/internal/shared/utils.js
  var is_array = Array.isArray;
  var index_of = Array.prototype.indexOf;
  var includes = Array.prototype.includes;
  var array_from = Array.from;
  var object_keys = Object.keys;
  var define_property = Object.defineProperty;
  var get_descriptor = Object.getOwnPropertyDescriptor;
  var get_descriptors = Object.getOwnPropertyDescriptors;
  var object_prototype = Object.prototype;
  var array_prototype = Array.prototype;
  var get_prototype_of = Object.getPrototypeOf;
  var is_extensible = Object.isExtensible;
  var noop = () => {};
  function run(fn) {
    return fn();
  }
  function run_all(arr) {
    for (var i = 0;i < arr.length; i++) {
      arr[i]();
    }
  }
  function deferred() {
    var resolve;
    var reject;
    var promise = new Promise((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  }

  // ../../node_modules/.bun/svelte@5.55.9/node_modules/svelte/src/internal/client/constants.js
  var DERIVED = 1 << 1;
  var EFFECT = 1 << 2;
  var RENDER_EFFECT = 1 << 3;
  var MANAGED_EFFECT = 1 << 24;
  var BLOCK_EFFECT = 1 << 4;
  var BRANCH_EFFECT = 1 << 5;
  var ROOT_EFFECT = 1 << 6;
  var BOUNDARY_EFFECT = 1 << 7;
  var CONNECTED = 1 << 9;
  var CLEAN = 1 << 10;
  var DIRTY = 1 << 11;
  var MAYBE_DIRTY = 1 << 12;
  var INERT = 1 << 13;
  var DESTROYED = 1 << 14;
  var REACTION_RAN = 1 << 15;
  var DESTROYING = 1 << 25;
  var EFFECT_TRANSPARENT = 1 << 16;
  var EAGER_EFFECT = 1 << 17;
  var HEAD_EFFECT = 1 << 18;
  var EFFECT_PRESERVED = 1 << 19;
  var USER_EFFECT = 1 << 20;
  var EFFECT_OFFSCREEN = 1 << 25;
  var WAS_MARKED = 1 << 16;
  var REACTION_IS_UPDATING = 1 << 21;
  var ASYNC = 1 << 22;
  var ERROR_VALUE = 1 << 23;
  var STATE_SYMBOL = Symbol("$state");
  var LEGACY_PROPS = Symbol("legacy props");
  var LOADING_ATTR_SYMBOL = Symbol("");
  var PROXY_PATH_SYMBOL = Symbol("proxy path");
  var ATTRIBUTES_CACHE = Symbol("attributes");
  var CLASS_CACHE = Symbol("class");
  var STYLE_CACHE = Symbol("style");
  var TEXT_CACHE = Symbol("text");
  var FORM_RESET_HANDLER = Symbol("form reset");
  var HMR_ANCHOR = Symbol("hmr anchor");
  var STALE_REACTION = new class StaleReactionError extends Error {
    name = "StaleReactionError";
    message = "The reaction that called \`getAbortSignal()\` was re-run or destroyed";
  };
  var IS_XHTML = !!globalThis.document?.contentType && /* @__PURE__ */ globalThis.document.contentType.includes("xml");
  var ELEMENT_NODE = 1;
  var TEXT_NODE = 3;
  var COMMENT_NODE = 8;
  var DOCUMENT_FRAGMENT_NODE = 11;

  // ../../node_modules/.bun/svelte@5.55.9/node_modules/svelte/src/internal/shared/errors.js
  function invariant_violation(message) {
    if (true_default) {
      const error = new Error(\`invariant_violation
An invariant violation occurred, meaning Svelte's internal assumptions were flawed. This is a bug in Svelte, not your app — please open an issue at https://github.com/sveltejs/svelte, citing the following message: "\${message}"
https://svelte.dev/e/invariant_violation\`);
      error.name = "Svelte error";
      throw error;
    } else {
      throw new Error(\`https://svelte.dev/e/invariant_violation\`);
    }
  }

  // ../../node_modules/.bun/svelte@5.55.9/node_modules/svelte/src/internal/client/errors.js
  function async_derived_orphan() {
    if (true_default) {
      const error = new Error(\`async_derived_orphan
Cannot create a \\\`$derived(...)\\\` with an \\\`await\\\` expression outside of an effect tree
https://svelte.dev/e/async_derived_orphan\`);
      error.name = "Svelte error";
      throw error;
    } else {
      throw new Error(\`https://svelte.dev/e/async_derived_orphan\`);
    }
  }
  function component_api_changed(method, component) {
    if (true_default) {
      const error = new Error(\`component_api_changed
Calling \\\`\${method}\\\` on a component instance (of \${component}) is no longer valid in Svelte 5
https://svelte.dev/e/component_api_changed\`);
      error.name = "Svelte error";
      throw error;
    } else {
      throw new Error(\`https://svelte.dev/e/component_api_changed\`);
    }
  }
  function component_api_invalid_new(component, name) {
    if (true_default) {
      const error = new Error(\`component_api_invalid_new
Attempted to instantiate \${component} with \\\`new \${name}\\\`, which is no longer valid in Svelte 5. If this component is not under your control, set the \\\`compatibility.componentApi\\\` compiler option to \\\`4\\\` to keep it working.
https://svelte.dev/e/component_api_invalid_new\`);
      error.name = "Svelte error";
      throw error;
    } else {
      throw new Error(\`https://svelte.dev/e/component_api_invalid_new\`);
    }
  }
  function derived_references_self() {
    if (true_default) {
      const error = new Error(\`derived_references_self
A derived value cannot reference itself recursively
https://svelte.dev/e/derived_references_self\`);
      error.name = "Svelte error";
      throw error;
    } else {
      throw new Error(\`https://svelte.dev/e/derived_references_self\`);
    }
  }
  function each_key_duplicate(a, b, value) {
    if (true_default) {
      const error = new Error(\`each_key_duplicate
\${value ? \`Keyed each block has duplicate key \\\`\${value}\\\` at indexes \${a} and \${b}\` : \`Keyed each block has duplicate key at indexes \${a} and \${b}\`}
https://svelte.dev/e/each_key_duplicate\`);
      error.name = "Svelte error";
      throw error;
    } else {
      throw new Error(\`https://svelte.dev/e/each_key_duplicate\`);
    }
  }
  function each_key_volatile(index, a, b) {
    if (true_default) {
      const error = new Error(\`each_key_volatile
Keyed each block has key that is not idempotent — the key for item at index \${index} was \\\`\${a}\\\` but is now \\\`\${b}\\\`. Keys must be the same each time for a given item
https://svelte.dev/e/each_key_volatile\`);
      error.name = "Svelte error";
      throw error;
    } else {
      throw new Error(\`https://svelte.dev/e/each_key_volatile\`);
    }
  }
  function effect_in_teardown(rune) {
    if (true_default) {
      const error = new Error(\`effect_in_teardown
\\\`\${rune}\\\` cannot be used inside an effect cleanup function
https://svelte.dev/e/effect_in_teardown\`);
      error.name = "Svelte error";
      throw error;
    } else {
      throw new Error(\`https://svelte.dev/e/effect_in_teardown\`);
    }
  }
  function effect_in_unowned_derived() {
    if (true_default) {
      const error = new Error(\`effect_in_unowned_derived
Effect cannot be created inside a \\\`$derived\\\` value that was not itself created inside an effect
https://svelte.dev/e/effect_in_unowned_derived\`);
      error.name = "Svelte error";
      throw error;
    } else {
      throw new Error(\`https://svelte.dev/e/effect_in_unowned_derived\`);
    }
  }
  function effect_orphan(rune) {
    if (true_default) {
      const error = new Error(\`effect_orphan
\\\`\${rune}\\\` can only be used inside an effect (e.g. during component initialisation)
https://svelte.dev/e/effect_orphan\`);
      error.name = "Svelte error";
      throw error;
    } else {
      throw new Error(\`https://svelte.dev/e/effect_orphan\`);
    }
  }
  function effect_update_depth_exceeded() {
    if (true_default) {
      const error = new Error(\`effect_update_depth_exceeded
Maximum update depth exceeded. This typically indicates that an effect reads and writes the same piece of state
https://svelte.dev/e/effect_update_depth_exceeded\`);
      error.name = "Svelte error";
      throw error;
    } else {
      throw new Error(\`https://svelte.dev/e/effect_update_depth_exceeded\`);
    }
  }
  function hydration_failed() {
    if (true_default) {
      const error = new Error(\`hydration_failed
Failed to hydrate the application
https://svelte.dev/e/hydration_failed\`);
      error.name = "Svelte error";
      throw error;
    } else {
      throw new Error(\`https://svelte.dev/e/hydration_failed\`);
    }
  }
  function props_invalid_value(key) {
    if (true_default) {
      const error = new Error(\`props_invalid_value
Cannot do \\\`bind:\${key}={undefined}\\\` when \\\`\${key}\\\` has a fallback value
https://svelte.dev/e/props_invalid_value\`);
      error.name = "Svelte error";
      throw error;
    } else {
      throw new Error(\`https://svelte.dev/e/props_invalid_value\`);
    }
  }
  function rune_outside_svelte(rune) {
    if (true_default) {
      const error = new Error(\`rune_outside_svelte
The \\\`\${rune}\\\` rune is only available inside \\\`.svelte\\\` and \\\`.svelte.js/ts\\\` files
https://svelte.dev/e/rune_outside_svelte\`);
      error.name = "Svelte error";
      throw error;
    } else {
      throw new Error(\`https://svelte.dev/e/rune_outside_svelte\`);
    }
  }
  function state_descriptors_fixed() {
    if (true_default) {
      const error = new Error(\`state_descriptors_fixed
Property descriptors defined on \\\`$state\\\` objects must contain \\\`value\\\` and always be \\\`enumerable\\\`, \\\`configurable\\\` and \\\`writable\\\`.
https://svelte.dev/e/state_descriptors_fixed\`);
      error.name = "Svelte error";
      throw error;
    } else {
      throw new Error(\`https://svelte.dev/e/state_descriptors_fixed\`);
    }
  }
  function state_prototype_fixed() {
    if (true_default) {
      const error = new Error(\`state_prototype_fixed
Cannot set prototype of \\\`$state\\\` object
https://svelte.dev/e/state_prototype_fixed\`);
      error.name = "Svelte error";
      throw error;
    } else {
      throw new Error(\`https://svelte.dev/e/state_prototype_fixed\`);
    }
  }
  function state_unsafe_mutation() {
    if (true_default) {
      const error = new Error(\`state_unsafe_mutation
Updating state inside \\\`$derived(...)\\\`, \\\`$inspect(...)\\\` or a template expression is forbidden. If the value should not be reactive, declare it without \\\`$state\\\`
https://svelte.dev/e/state_unsafe_mutation\`);
      error.name = "Svelte error";
      throw error;
    } else {
      throw new Error(\`https://svelte.dev/e/state_unsafe_mutation\`);
    }
  }
  function svelte_boundary_reset_onerror() {
    if (true_default) {
      const error = new Error(\`svelte_boundary_reset_onerror
A \\\`<svelte:boundary>\\\` \\\`reset\\\` function cannot be called while an error is still being handled
https://svelte.dev/e/svelte_boundary_reset_onerror\`);
      error.name = "Svelte error";
      throw error;
    } else {
      throw new Error(\`https://svelte.dev/e/svelte_boundary_reset_onerror\`);
    }
  }

  // ../../node_modules/.bun/svelte@5.55.9/node_modules/svelte/src/constants.js
  var EACH_ITEM_REACTIVE = 1;
  var EACH_INDEX_REACTIVE = 1 << 1;
  var EACH_IS_CONTROLLED = 1 << 2;
  var EACH_IS_ANIMATED = 1 << 3;
  var EACH_ITEM_IMMUTABLE = 1 << 4;
  var PROPS_IS_IMMUTABLE = 1;
  var PROPS_IS_RUNES = 1 << 1;
  var PROPS_IS_UPDATED = 1 << 2;
  var PROPS_IS_BINDABLE = 1 << 3;
  var PROPS_IS_LAZY_INITIAL = 1 << 4;
  var TRANSITION_OUT = 1 << 1;
  var TRANSITION_GLOBAL = 1 << 2;
  var TEMPLATE_FRAGMENT = 1;
  var TEMPLATE_USE_IMPORT_NODE = 1 << 1;
  var TEMPLATE_USE_SVG = 1 << 2;
  var TEMPLATE_USE_MATHML = 1 << 3;
  var HYDRATION_START = "[";
  var HYDRATION_START_ELSE = "[!";
  var HYDRATION_START_FAILED = "[?";
  var HYDRATION_END = "]";
  var HYDRATION_ERROR = {};
  var ELEMENT_PRESERVE_ATTRIBUTE_CASE = 1 << 1;
  var ELEMENT_IS_INPUT = 1 << 2;
  var UNINITIALIZED = Symbol("uninitialized");
  var FILENAME = Symbol("filename");
  var HMR = Symbol("hmr");
  var NAMESPACE_HTML = "http://www.w3.org/1999/xhtml";
  var NAMESPACE_SVG = "http://www.w3.org/2000/svg";
  var NAMESPACE_MATHML = "http://www.w3.org/1998/Math/MathML";

  // ../../node_modules/.bun/svelte@5.55.9/node_modules/svelte/src/internal/client/warnings.js
  var bold = "font-weight: bold";
  var normal = "font-weight: normal";
  function await_reactivity_loss(name) {
    if (true_default) {
      console.warn(\`%c[svelte] await_reactivity_loss
%cDetected reactivity loss when reading \\\`\${name}\\\`. This happens when state is read in an async function after an earlier \\\`await\\\`
https://svelte.dev/e/await_reactivity_loss\`, bold, normal);
    } else {
      console.warn(\`https://svelte.dev/e/await_reactivity_loss\`);
    }
  }
  function await_waterfall(name, location) {
    if (true_default) {
      console.warn(\`%c[svelte] await_waterfall
%cAn async derived, \\\`\${name}\\\` (\${location}) was not read immediately after it resolved. This often indicates an unnecessary waterfall, which can slow down your app
https://svelte.dev/e/await_waterfall\`, bold, normal);
    } else {
      console.warn(\`https://svelte.dev/e/await_waterfall\`);
    }
  }
  function console_log_state(method) {
    if (true_default) {
      console.warn(\`%c[svelte] console_log_state
%cYour \\\`console.\${method}\\\` contained \\\`$state\\\` proxies. Consider using \\\`$inspect(...)\\\` or \\\`$state.snapshot(...)\\\` instead
https://svelte.dev/e/console_log_state\`, bold, normal);
    } else {
      console.warn(\`https://svelte.dev/e/console_log_state\`);
    }
  }
  function derived_inert() {
    if (true_default) {
      console.warn(\`%c[svelte] derived_inert
%cReading a derived belonging to a now-destroyed effect may result in stale values
https://svelte.dev/e/derived_inert\`, bold, normal);
    } else {
      console.warn(\`https://svelte.dev/e/derived_inert\`);
    }
  }
  function event_handler_invalid(handler, suggestion) {
    if (true_default) {
      console.warn(\`%c[svelte] event_handler_invalid
%c\${handler} should be a function. Did you mean to \${suggestion}?
https://svelte.dev/e/event_handler_invalid\`, bold, normal);
    } else {
      console.warn(\`https://svelte.dev/e/event_handler_invalid\`);
    }
  }
  function hydration_attribute_changed(attribute, html, value) {
    if (true_default) {
      console.warn(\`%c[svelte] hydration_attribute_changed
%cThe \\\`\${attribute}\\\` attribute on \\\`\${html}\\\` changed its value between server and client renders. The client value, \\\`\${value}\\\`, will be ignored in favour of the server value
https://svelte.dev/e/hydration_attribute_changed\`, bold, normal);
    } else {
      console.warn(\`https://svelte.dev/e/hydration_attribute_changed\`);
    }
  }
  function hydration_html_changed(location) {
    if (true_default) {
      console.warn(\`%c[svelte] hydration_html_changed
%c\${location ? \`The value of an \\\`{@html ...}\\\` block \${location} changed between server and client renders. The client value will be ignored in favour of the server value\` : "The value of an \`{@html ...}\` block changed between server and client renders. The client value will be ignored in favour of the server value"}
https://svelte.dev/e/hydration_html_changed\`, bold, normal);
    } else {
      console.warn(\`https://svelte.dev/e/hydration_html_changed\`);
    }
  }
  function hydration_mismatch(location) {
    if (true_default) {
      console.warn(\`%c[svelte] hydration_mismatch
%c\${location ? \`Hydration failed because the initial UI does not match what was rendered on the server. The error occurred near \${location}\` : "Hydration failed because the initial UI does not match what was rendered on the server"}
https://svelte.dev/e/hydration_mismatch\`, bold, normal);
    } else {
      console.warn(\`https://svelte.dev/e/hydration_mismatch\`);
    }
  }
  function lifecycle_double_unmount() {
    if (true_default) {
      console.warn(\`%c[svelte] lifecycle_double_unmount
%cTried to unmount a component that was not mounted
https://svelte.dev/e/lifecycle_double_unmount\`, bold, normal);
    } else {
      console.warn(\`https://svelte.dev/e/lifecycle_double_unmount\`);
    }
  }
  function state_proxy_equality_mismatch(operator) {
    if (true_default) {
      console.warn(\`%c[svelte] state_proxy_equality_mismatch
%cReactive \\\`$state(...)\\\` proxies and the values they proxy have different identities. Because of this, comparisons with \\\`\${operator}\\\` will produce unexpected results
https://svelte.dev/e/state_proxy_equality_mismatch\`, bold, normal);
    } else {
      console.warn(\`https://svelte.dev/e/state_proxy_equality_mismatch\`);
    }
  }
  function state_proxy_unmount() {
    if (true_default) {
      console.warn(\`%c[svelte] state_proxy_unmount
%cTried to unmount a state proxy, rather than a component
https://svelte.dev/e/state_proxy_unmount\`, bold, normal);
    } else {
      console.warn(\`https://svelte.dev/e/state_proxy_unmount\`);
    }
  }
  function svelte_boundary_reset_noop() {
    if (true_default) {
      console.warn(\`%c[svelte] svelte_boundary_reset_noop
%cA \\\`<svelte:boundary>\\\` \\\`reset\\\` function only resets the boundary the first time it is called
https://svelte.dev/e/svelte_boundary_reset_noop\`, bold, normal);
    } else {
      console.warn(\`https://svelte.dev/e/svelte_boundary_reset_noop\`);
    }
  }

  // ../../node_modules/.bun/svelte@5.55.9/node_modules/svelte/src/internal/client/dom/hydration.js
  var hydrating = false;
  function set_hydrating(value) {
    hydrating = value;
  }
  var hydrate_node;
  function set_hydrate_node(node) {
    if (node === null) {
      hydration_mismatch();
      throw HYDRATION_ERROR;
    }
    return hydrate_node = node;
  }
  function hydrate_next() {
    return set_hydrate_node(get_next_sibling(hydrate_node));
  }
  function reset(node) {
    if (!hydrating)
      return;
    if (get_next_sibling(hydrate_node) !== null) {
      hydration_mismatch();
      throw HYDRATION_ERROR;
    }
    hydrate_node = node;
  }
  function next(count = 1) {
    if (hydrating) {
      var i = count;
      var node = hydrate_node;
      while (i--) {
        node = get_next_sibling(node);
      }
      hydrate_node = node;
    }
  }
  function skip_nodes(remove = true) {
    var depth = 0;
    var node = hydrate_node;
    while (true) {
      if (node.nodeType === COMMENT_NODE) {
        var data = node.data;
        if (data === HYDRATION_END) {
          if (depth === 0)
            return node;
          depth -= 1;
        } else if (data === HYDRATION_START || data === HYDRATION_START_ELSE || data[0] === "[" && !isNaN(Number(data.slice(1)))) {
          depth += 1;
        }
      }
      var next2 = get_next_sibling(node);
      if (remove)
        node.remove();
      node = next2;
    }
  }
  function read_hydration_instruction(node) {
    if (!node || node.nodeType !== COMMENT_NODE) {
      hydration_mismatch();
      throw HYDRATION_ERROR;
    }
    return node.data;
  }

  // ../../node_modules/.bun/svelte@5.55.9/node_modules/svelte/src/internal/client/reactivity/equality.js
  function equals(value) {
    return value === this.v;
  }
  function safe_not_equal(a, b) {
    return a != a ? b == b : a !== b || a !== null && typeof a === "object" || typeof a === "function";
  }
  function safe_equals(value) {
    return !safe_not_equal(value, this.v);
  }

  // ../../node_modules/.bun/svelte@5.55.9/node_modules/svelte/src/internal/flags/index.js
  var async_mode_flag = false;
  var legacy_mode_flag = false;
  var tracing_mode_flag = false;
  function enable_legacy_mode_flag() {
    legacy_mode_flag = true;
  }

  // ../../node_modules/.bun/svelte@5.55.9/node_modules/svelte/src/internal/shared/warnings.js
  var bold2 = "font-weight: bold";
  var normal2 = "font-weight: normal";
  function state_snapshot_uncloneable(properties) {
    if (true_default) {
      console.warn(\`%c[svelte] state_snapshot_uncloneable
%c\${properties ? \`The following properties cannot be cloned with \\\`$state.snapshot\\\` — the return value contains the originals:

\${properties}\` : "Value cannot be cloned with \`$state.snapshot\` — the original value was returned"}
https://svelte.dev/e/state_snapshot_uncloneable\`, bold2, normal2);
    } else {
      console.warn(\`https://svelte.dev/e/state_snapshot_uncloneable\`);
    }
  }

  // ../../node_modules/.bun/svelte@5.55.9/node_modules/svelte/src/internal/shared/clone.js
  var empty = [];
  function snapshot(value, skip_warning = false, no_tojson = false) {
    if (true_default && !skip_warning) {
      const paths = [];
      const copy = clone(value, new Map, "", paths, null, no_tojson);
      if (paths.length === 1 && paths[0] === "") {
        state_snapshot_uncloneable();
      } else if (paths.length > 0) {
        const slice = paths.length > 10 ? paths.slice(0, 7) : paths.slice(0, 10);
        const excess = paths.length - slice.length;
        let uncloned = slice.map((path) => \`- <value>\${path}\`).join(\`
\`);
        if (excess > 0)
          uncloned += \`
- ...and \${excess} more\`;
        state_snapshot_uncloneable(uncloned);
      }
      return copy;
    }
    return clone(value, new Map, "", empty, null, no_tojson);
  }
  function clone(value, cloned, path, paths, original = null, no_tojson = false) {
    if (typeof value === "object" && value !== null) {
      var unwrapped = cloned.get(value);
      if (unwrapped !== undefined)
        return unwrapped;
      if (value instanceof Map)
        return new Map(value);
      if (value instanceof Set)
        return new Set(value);
      if (is_array(value)) {
        var copy = Array(value.length);
        cloned.set(value, copy);
        if (original !== null) {
          cloned.set(original, copy);
        }
        for (var i = 0;i < value.length; i += 1) {
          var element = value[i];
          if (i in value) {
            copy[i] = clone(element, cloned, true_default ? \`\${path}[\${i}]\` : path, paths, null, no_tojson);
          }
        }
        return copy;
      }
      if (get_prototype_of(value) === object_prototype) {
        copy = {};
        cloned.set(value, copy);
        if (original !== null) {
          cloned.set(original, copy);
        }
        for (var key of Object.keys(value)) {
          copy[key] = clone(value[key], cloned, true_default ? \`\${path}.\${key}\` : path, paths, null, no_tojson);
        }
        return copy;
      }
      if (value instanceof Date) {
        return structuredClone(value);
      }
      if (typeof value.toJSON === "function" && !no_tojson) {
        return clone(value.toJSON(), cloned, true_default ? \`\${path}.toJSON()\` : path, paths, value);
      }
    }
    if (value instanceof EventTarget) {
      return value;
    }
    try {
      return structuredClone(value);
    } catch (e) {
      if (true_default) {
        paths.push(path);
      }
      return value;
    }
  }

  // ../../node_modules/.bun/svelte@5.55.9/node_modules/svelte/src/internal/client/dev/tracing.js
  var tracing_expressions = null;
  function tag(source, label) {
    source.label = label;
    tag_proxy(source.v, label);
    return source;
  }
  function tag_proxy(value, label) {
    value?.[PROXY_PATH_SYMBOL]?.(label);
    return value;
  }

  // ../../node_modules/.bun/svelte@5.55.9/node_modules/svelte/src/internal/shared/dev.js
  function get_error(label) {
    const error = new Error;
    const stack = get_stack();
    if (stack.length === 0) {
      return null;
    }
    stack.unshift(\`
\`);
    define_property(error, "stack", {
      value: stack.join(\`
\`)
    });
    define_property(error, "name", {
      value: label
    });
    return error;
  }
  function get_stack() {
    const limit = Error.stackTraceLimit;
    Error.stackTraceLimit = Infinity;
    const stack = new Error().stack;
    Error.stackTraceLimit = limit;
    if (!stack)
      return [];
    const lines = stack.split(\`
\`);
    const new_lines = [];
    for (let i = 0;i < lines.length; i++) {
      const line = lines[i];
      const posixified = line.replaceAll("\\\\", "/");
      if (line.trim() === "Error") {
        continue;
      }
      if (line.includes("validate_each_keys")) {
        return [];
      }
      if (posixified.includes("svelte/src/internal") || posixified.includes("node_modules/.vite")) {
        continue;
      }
      new_lines.push(line);
    }
    return new_lines;
  }
  function invariant(condition, message) {
    if (!true_default) {
      throw new Error("invariant(...) was not guarded by if (DEV)");
    }
    if (!condition)
      invariant_violation(message);
  }

  // ../../node_modules/.bun/svelte@5.55.9/node_modules/svelte/src/internal/client/context.js
  var component_context = null;
  function set_component_context(context) {
    component_context = context;
  }
  var dev_stack = null;
  function set_dev_stack(stack) {
    dev_stack = stack;
  }
  function add_svelte_meta(callback, type, component, line, column, additional) {
    const parent = dev_stack;
    dev_stack = {
      type,
      file: component[FILENAME],
      line,
      column,
      parent,
      ...additional
    };
    try {
      return callback();
    } finally {
      dev_stack = parent;
    }
  }
  var dev_current_component_function = null;
  function set_dev_current_component_function(fn) {
    dev_current_component_function = fn;
  }
  function push(props, runes = false, fn) {
    component_context = {
      p: component_context,
      i: false,
      c: null,
      e: null,
      s: props,
      x: null,
      r: active_effect,
      l: legacy_mode_flag && !runes ? { s: null, u: null, $: [] } : null
    };
    if (true_default) {
      component_context.function = fn;
      dev_current_component_function = fn;
    }
  }
  function pop(component) {
    var context = component_context;
    var effects = context.e;
    if (effects !== null) {
      context.e = null;
      for (var fn of effects) {
        create_user_effect(fn);
      }
    }
    if (component !== undefined) {
      context.x = component;
    }
    context.i = true;
    component_context = context.p;
    if (true_default) {
      dev_current_component_function = component_context?.function ?? null;
    }
    return component ?? {};
  }
  function is_runes() {
    return !legacy_mode_flag || component_context !== null && component_context.l === null;
  }

  // ../../node_modules/.bun/svelte@5.55.9/node_modules/svelte/src/internal/client/dom/task.js
  var micro_tasks = [];
  function run_micro_tasks() {
    var tasks = micro_tasks;
    micro_tasks = [];
    run_all(tasks);
  }
  function queue_micro_task(fn) {
    if (micro_tasks.length === 0 && !is_flushing_sync) {
      var tasks = micro_tasks;
      queueMicrotask(() => {
        if (tasks === micro_tasks)
          run_micro_tasks();
      });
    }
    micro_tasks.push(fn);
  }
  function flush_tasks() {
    while (micro_tasks.length > 0) {
      run_micro_tasks();
    }
  }

  // ../../node_modules/.bun/svelte@5.55.9/node_modules/svelte/src/internal/client/error-handling.js
  var adjustments = new WeakMap;
  function handle_error(error) {
    var effect = active_effect;
    if (effect === null) {
      active_reaction.f |= ERROR_VALUE;
      return error;
    }
    if (true_default && error instanceof Error && !adjustments.has(error)) {
      adjustments.set(error, get_adjustments(error, effect));
    }
    if ((effect.f & REACTION_RAN) === 0 && (effect.f & EFFECT) === 0) {
      if (true_default && !effect.parent && error instanceof Error) {
        apply_adjustments(error);
      }
      throw error;
    }
    invoke_error_boundary(error, effect);
  }
  function invoke_error_boundary(error, effect) {
    while (effect !== null) {
      if ((effect.f & BOUNDARY_EFFECT) !== 0) {
        if ((effect.f & REACTION_RAN) === 0) {
          throw error;
        }
        try {
          effect.b.error(error);
          return;
        } catch (e) {
          error = e;
        }
      }
      effect = effect.parent;
    }
    if (true_default && error instanceof Error) {
      apply_adjustments(error);
    }
    throw error;
  }
  function get_adjustments(error, effect) {
    const message_descriptor = get_descriptor(error, "message");
    if (message_descriptor && !message_descriptor.configurable)
      return;
    var indent = is_firefox ? "  " : "\\t";
    var component_stack = \`
\${indent}in \${effect.fn?.name || "<unknown>"}\`;
    var context = effect.ctx;
    while (context !== null) {
      component_stack += \`
\${indent}in \${context.function?.[FILENAME].split("/").pop()}\`;
      context = context.p;
    }
    return {
      message: error.message + \`
\${component_stack}
\`,
      stack: error.stack?.split(\`
\`).filter((line) => !line.includes("svelte/src/internal")).join(\`
\`)
    };
  }
  function apply_adjustments(error) {
    const adjusted = adjustments.get(error);
    if (adjusted) {
      define_property(error, "message", {
        value: adjusted.message
      });
      define_property(error, "stack", {
        value: adjusted.stack
      });
    }
  }

  // ../../node_modules/.bun/svelte@5.55.9/node_modules/svelte/src/internal/client/reactivity/status.js
  var STATUS_MASK = ~(DIRTY | MAYBE_DIRTY | CLEAN);
  function set_signal_status(signal, status) {
    signal.f = signal.f & STATUS_MASK | status;
  }
  function update_derived_status(derived) {
    if ((derived.f & CONNECTED) !== 0 || derived.deps === null) {
      set_signal_status(derived, CLEAN);
    } else {
      set_signal_status(derived, MAYBE_DIRTY);
    }
  }

  // ../../node_modules/.bun/svelte@5.55.9/node_modules/svelte/src/internal/client/reactivity/utils.js
  function clear_marked(deps) {
    if (deps === null)
      return;
    for (const dep of deps) {
      if ((dep.f & DERIVED) === 0 || (dep.f & WAS_MARKED) === 0) {
        continue;
      }
      dep.f ^= WAS_MARKED;
      clear_marked(dep.deps);
    }
  }
  function defer_effect(effect, dirty_effects, maybe_dirty_effects) {
    if ((effect.f & DIRTY) !== 0) {
      dirty_effects.add(effect);
    } else if ((effect.f & MAYBE_DIRTY) !== 0) {
      maybe_dirty_effects.add(effect);
    }
    clear_marked(effect.deps);
    set_signal_status(effect, CLEAN);
  }

  // ../../node_modules/.bun/svelte@5.55.9/node_modules/svelte/src/internal/client/reactivity/store.js
  var legacy_is_updating_store = false;
  var is_store_binding = false;
  var IS_UNMOUNTED = Symbol("unmounted");
  function capture_store_binding(fn) {
    var previous_is_store_binding = is_store_binding;
    try {
      is_store_binding = false;
      return [fn(), is_store_binding];
    } finally {
      is_store_binding = previous_is_store_binding;
    }
  }

  // ../../node_modules/.bun/svelte@5.55.9/node_modules/svelte/src/internal/client/reactivity/batch.js
  var first_batch = null;
  var last_batch = null;
  var current_batch = null;
  var previous_batch = null;
  var batch_values = null;
  var last_scheduled_effect = null;
  var is_flushing_sync = false;
  var is_processing = false;
  var collected_effects = null;
  var legacy_updates = null;
  var flush_count = 0;
  var source_stacks = new Set;
  var uid = 1;

  class Batch {
    id = uid++;
    #started = false;
    linked = true;
    #prev = null;
    #next = null;
    async_deriveds = new Map;
    current = new Map;
    previous = new Map;
    unblocked = new Set;
    #commit_callbacks = new Set;
    #discard_callbacks = new Set;
    #fork_commit_callbacks = new Set;
    #pending = 0;
    #blocking_pending = new Map;
    #deferred = null;
    #roots = [];
    #new_effects = [];
    #dirty_effects = new Set;
    #maybe_dirty_effects = new Set;
    #skipped_branches = new Map;
    #unskipped_branches = new Set;
    is_fork = false;
    #decrement_queued = false;
    #is_deferred() {
      if (this.is_fork)
        return true;
      for (const effect of this.#blocking_pending.keys()) {
        var e = effect;
        var skipped = false;
        while (e.parent !== null) {
          if (this.#skipped_branches.has(e)) {
            skipped = true;
            break;
          }
          e = e.parent;
        }
        if (!skipped) {
          return true;
        }
      }
      return false;
    }
    skip_effect(effect) {
      if (!this.#skipped_branches.has(effect)) {
        this.#skipped_branches.set(effect, { d: [], m: [] });
      }
      this.#unskipped_branches.delete(effect);
    }
    unskip_effect(effect, callback = (e) => this.schedule(e)) {
      var tracked = this.#skipped_branches.get(effect);
      if (tracked) {
        this.#skipped_branches.delete(effect);
        for (var e of tracked.d) {
          set_signal_status(e, DIRTY);
          callback(e);
        }
        for (e of tracked.m) {
          set_signal_status(e, MAYBE_DIRTY);
          callback(e);
        }
      }
      this.#unskipped_branches.add(effect);
    }
    #process() {
      this.#started = true;
      if (flush_count++ > 1000) {
        this.#unlink();
        infinite_loop_guard();
      }
      if (true_default) {
        for (const value of this.current.keys()) {
          source_stacks.add(value);
        }
      }
      if (!this.#is_deferred()) {
        for (const e of this.#dirty_effects) {
          this.#maybe_dirty_effects.delete(e);
          set_signal_status(e, DIRTY);
          this.schedule(e);
        }
        for (const e of this.#maybe_dirty_effects) {
          set_signal_status(e, MAYBE_DIRTY);
          this.schedule(e);
        }
      }
      const roots = this.#roots;
      this.#roots = [];
      this.apply();
      var effects = collected_effects = [];
      var render_effects = [];
      var updates = legacy_updates = [];
      for (const root of roots) {
        try {
          this.#traverse(root, effects, render_effects);
        } catch (e) {
          reset_all(root);
          throw e;
        }
      }
      current_batch = null;
      if (updates.length > 0) {
        var batch = Batch.ensure();
        for (const e of updates) {
          batch.schedule(e);
        }
      }
      collected_effects = null;
      legacy_updates = null;
      if (this.#is_deferred()) {
        this.#defer_effects(render_effects);
        this.#defer_effects(effects);
        for (const [e, t] of this.#skipped_branches) {
          reset_branch(e, t);
        }
        if (updates.length > 0) {
          current_batch.#process();
        }
        return;
      }
      const earlier_batch = this.#find_earlier_batch();
      if (earlier_batch) {
        earlier_batch.#merge(this);
        return;
      }
      this.#dirty_effects.clear();
      this.#maybe_dirty_effects.clear();
      for (const fn of this.#commit_callbacks)
        fn(this);
      this.#commit_callbacks.clear();
      previous_batch = this;
      flush_queued_effects(render_effects);
      flush_queued_effects(effects);
      previous_batch = null;
      this.#deferred?.resolve();
      var next_batch = current_batch;
      if (this.linked && this.#pending === 0) {
        this.#unlink();
      }
      if (async_mode_flag && !this.linked) {
        this.#commit();
        current_batch = next_batch;
      }
      if (this.#roots.length > 0) {
        if (next_batch === null) {
          next_batch = this;
          this.#link();
        }
        const batch2 = next_batch;
        batch2.#roots.push(...this.#roots.filter((r) => !batch2.#roots.includes(r)));
      }
      if (next_batch !== null) {
        next_batch.#process();
      }
    }
    #traverse(root, effects, render_effects) {
      root.f ^= CLEAN;
      var effect = root.first;
      while (effect !== null) {
        var flags = effect.f;
        var is_branch = (flags & (BRANCH_EFFECT | ROOT_EFFECT)) !== 0;
        var is_skippable_branch = is_branch && (flags & CLEAN) !== 0;
        var skip = is_skippable_branch || (flags & INERT) !== 0 || this.#skipped_branches.has(effect);
        if (!skip && effect.fn !== null) {
          if (is_branch) {
            effect.f ^= CLEAN;
          } else if ((flags & EFFECT) !== 0) {
            effects.push(effect);
          } else if (async_mode_flag && (flags & (RENDER_EFFECT | MANAGED_EFFECT)) !== 0) {
            render_effects.push(effect);
          } else if (is_dirty(effect)) {
            if ((flags & BLOCK_EFFECT) !== 0)
              this.#maybe_dirty_effects.add(effect);
            update_effect(effect);
          }
          var child = effect.first;
          if (child !== null) {
            effect = child;
            continue;
          }
        }
        while (effect !== null) {
          var next2 = effect.next;
          if (next2 !== null) {
            effect = next2;
            break;
          }
          effect = effect.parent;
        }
      }
    }
    #find_earlier_batch() {
      var batch = this.#prev;
      while (batch !== null) {
        if (!batch.is_fork) {
          for (const [value, [, is_derived]] of this.current) {
            if (batch.current.has(value) && !is_derived) {
              return batch;
            }
          }
        }
        batch = batch.#prev;
      }
      return null;
    }
    #merge(batch) {
      for (const [source2, value] of batch.current) {
        if (!this.previous.has(source2) && batch.previous.has(source2)) {
          this.previous.set(source2, batch.previous.get(source2));
        }
        this.current.set(source2, value);
      }
      for (const [effect, deferred2] of batch.async_deriveds) {
        const d = this.async_deriveds.get(effect);
        if (d)
          deferred2.promise.then(d.resolve);
      }
      const mark = (value) => {
        var reactions = value.reactions;
        if (reactions === null)
          return;
        for (const reaction of reactions) {
          var flags = reaction.f;
          if ((flags & DERIVED) !== 0) {
            mark(reaction);
          } else {
            var effect = reaction;
            if (flags & (ASYNC | BLOCK_EFFECT) && !this.async_deriveds.has(effect)) {
              this.#maybe_dirty_effects.delete(effect);
              set_signal_status(effect, DIRTY);
              this.schedule(effect);
            }
          }
        }
      };
      for (const source2 of this.current.keys()) {
        mark(source2);
      }
      this.oncommit(() => batch.discard());
      batch.#unlink();
      current_batch = this;
      this.#process();
    }
    #defer_effects(effects) {
      for (var i = 0;i < effects.length; i += 1) {
        defer_effect(effects[i], this.#dirty_effects, this.#maybe_dirty_effects);
      }
    }
    capture(source2, value, is_derived = false) {
      if (source2.v !== UNINITIALIZED && !this.previous.has(source2)) {
        this.previous.set(source2, source2.v);
      }
      if ((source2.f & ERROR_VALUE) === 0) {
        this.current.set(source2, [value, is_derived]);
        batch_values?.set(source2, value);
      }
      if (!this.is_fork) {
        source2.v = value;
      }
    }
    activate() {
      current_batch = this;
    }
    deactivate() {
      current_batch = null;
      batch_values = null;
    }
    flush() {
      try {
        if (true_default) {
          source_stacks.clear();
        }
        is_processing = true;
        current_batch = this;
        this.#process();
      } finally {
        flush_count = 0;
        last_scheduled_effect = null;
        collected_effects = null;
        legacy_updates = null;
        is_processing = false;
        current_batch = null;
        batch_values = null;
        old_values.clear();
        if (true_default) {
          for (const source2 of source_stacks) {
            source2.updated = null;
          }
        }
      }
    }
    discard() {
      for (const fn of this.#discard_callbacks)
        fn(this);
      this.#discard_callbacks.clear();
      this.#fork_commit_callbacks.clear();
      this.#unlink();
    }
    register_created_effect(effect) {
      this.#new_effects.push(effect);
    }
    #commit() {
      this.#unlink();
      for (let batch = first_batch;batch !== null; batch = batch.#next) {
        var is_earlier = batch.id < this.id;
        var sources = [];
        for (const [source3, [value, is_derived]] of this.current) {
          if (batch.current.has(source3)) {
            var batch_value = batch.current.get(source3)[0];
            if (is_earlier && value !== batch_value) {
              batch.current.set(source3, [value, is_derived]);
            } else {
              continue;
            }
          }
          sources.push(source3);
        }
        if (is_earlier) {
          for (const [effect, deferred2] of this.async_deriveds) {
            const d = batch.async_deriveds.get(effect);
            if (d)
              deferred2.promise.then(d.resolve);
          }
        }
        if (!batch.#started)
          continue;
        var others = [...batch.current.keys()].filter((s) => !this.current.has(s));
        if (others.length === 0) {
          if (is_earlier) {
            batch.discard();
          }
        } else if (sources.length > 0) {
          if (true_default && !batch.#decrement_queued) {
            invariant(batch.#roots.length === 0, "Batch has scheduled roots");
          }
          if (is_earlier) {
            for (const unskipped of this.#unskipped_branches) {
              batch.unskip_effect(unskipped, (e) => {
                if ((e.f & (BLOCK_EFFECT | ASYNC)) !== 0) {
                  batch.schedule(e);
                } else {
                  batch.#defer_effects([e]);
                }
              });
            }
          }
          batch.activate();
          var marked = new Set;
          var checked = new Map;
          for (var source2 of sources) {
            mark_effects(source2, others, marked, checked);
          }
          checked = new Map;
          var current_unequal = [...batch.current.keys()].filter((c) => this.current.has(c) ? this.current.get(c)[0] !== c.v : true);
          if (current_unequal.length > 0) {
            for (const effect of this.#new_effects) {
              if ((effect.f & (DESTROYED | INERT | EAGER_EFFECT)) === 0 && depends_on(effect, current_unequal, checked)) {
                if ((effect.f & (ASYNC | BLOCK_EFFECT)) !== 0) {
                  set_signal_status(effect, DIRTY);
                  batch.schedule(effect);
                } else {
                  batch.#dirty_effects.add(effect);
                }
              }
            }
          }
          if (batch.#roots.length > 0 && !batch.#decrement_queued) {
            batch.apply();
            for (var root of batch.#roots) {
              batch.#traverse(root, [], []);
            }
            batch.#roots = [];
          }
          batch.deactivate();
        }
      }
    }
    increment(blocking, effect) {
      this.#pending += 1;
      if (blocking) {
        let blocking_pending_count = this.#blocking_pending.get(effect) ?? 0;
        this.#blocking_pending.set(effect, blocking_pending_count + 1);
      }
    }
    decrement(blocking, effect) {
      this.#pending -= 1;
      if (blocking) {
        let blocking_pending_count = this.#blocking_pending.get(effect) ?? 0;
        if (blocking_pending_count === 1) {
          this.#blocking_pending.delete(effect);
        } else {
          this.#blocking_pending.set(effect, blocking_pending_count - 1);
        }
      }
      if (this.#decrement_queued)
        return;
      this.#decrement_queued = true;
      queue_micro_task(() => {
        this.#decrement_queued = false;
        if (this.linked) {
          this.flush();
        }
      });
    }
    transfer_effects(dirty_effects, maybe_dirty_effects) {
      for (const e of dirty_effects) {
        this.#dirty_effects.add(e);
      }
      for (const e of maybe_dirty_effects) {
        this.#maybe_dirty_effects.add(e);
      }
      dirty_effects.clear();
      maybe_dirty_effects.clear();
    }
    oncommit(fn) {
      this.#commit_callbacks.add(fn);
    }
    ondiscard(fn) {
      this.#discard_callbacks.add(fn);
    }
    on_fork_commit(fn) {
      this.#fork_commit_callbacks.add(fn);
    }
    run_fork_commit_callbacks() {
      for (const fn of this.#fork_commit_callbacks)
        fn(this);
      this.#fork_commit_callbacks.clear();
    }
    settled() {
      return (this.#deferred ??= deferred()).promise;
    }
    static ensure() {
      if (current_batch === null) {
        const batch = current_batch = new Batch;
        batch.#link();
        if (!is_processing && !is_flushing_sync) {
          queue_micro_task(() => {
            if (!batch.#started) {
              batch.flush();
            }
          });
        }
      }
      return current_batch;
    }
    apply() {
      if (!async_mode_flag || !this.is_fork && this.#prev === null && this.#next === null) {
        batch_values = null;
        return;
      }
      batch_values = new Map;
      for (const [source2, [value]] of this.current) {
        batch_values.set(source2, value);
      }
      for (let batch = first_batch;batch !== null; batch = batch.#next) {
        if (batch === this || batch.is_fork)
          continue;
        var intersects = false;
        if (batch.id < this.id) {
          for (const [source2, [, is_derived]] of batch.current) {
            if (is_derived)
              continue;
            if (this.current.has(source2)) {
              intersects = true;
              break;
            }
          }
        }
        if (!intersects) {
          for (const [source2, previous] of batch.previous) {
            if (!batch_values.has(source2)) {
              batch_values.set(source2, previous);
            }
          }
        }
      }
    }
    schedule(effect) {
      last_scheduled_effect = effect;
      if (effect.b?.is_pending && (effect.f & (EFFECT | RENDER_EFFECT | MANAGED_EFFECT)) !== 0 && (effect.f & REACTION_RAN) === 0) {
        effect.b.defer_effect(effect);
        return;
      }
      var e = effect;
      while (e.parent !== null) {
        e = e.parent;
        var flags = e.f;
        if (collected_effects !== null && e === active_effect) {
          if (async_mode_flag)
            return;
          if ((active_reaction === null || (active_reaction.f & DERIVED) === 0) && !legacy_is_updating_store) {
            return;
          }
        }
        if ((flags & (ROOT_EFFECT | BRANCH_EFFECT)) !== 0) {
          if ((flags & CLEAN) === 0) {
            return;
          }
          e.f ^= CLEAN;
        }
      }
      this.#roots.push(e);
    }
    #link() {
      if (last_batch === null) {
        first_batch = last_batch = this;
      } else {
        last_batch.#next = this;
        this.#prev = last_batch;
      }
      last_batch = this;
    }
    #unlink() {
      var prev = this.#prev;
      var next2 = this.#next;
      if (prev === null) {
        first_batch = next2;
      } else {
        prev.#next = next2;
      }
      if (next2 === null) {
        last_batch = prev;
      } else {
        next2.#prev = prev;
      }
      this.linked = false;
    }
  }
  function flushSync(fn) {
    var was_flushing_sync = is_flushing_sync;
    is_flushing_sync = true;
    try {
      var result;
      if (fn) {
        if (current_batch !== null && !current_batch.is_fork) {
          current_batch.flush();
        }
        result = fn();
      }
      while (true) {
        flush_tasks();
        if (current_batch === null) {
          return result;
        }
        current_batch.flush();
      }
    } finally {
      is_flushing_sync = was_flushing_sync;
    }
  }
  function infinite_loop_guard() {
    if (true_default) {
      var updates = new Map;
      for (const source2 of current_batch.current.keys()) {
        for (const [stack, update2] of source2.updated ?? []) {
          var entry = updates.get(stack);
          if (!entry) {
            entry = { error: update2.error, count: 0 };
            updates.set(stack, entry);
          }
          entry.count += update2.count;
        }
      }
      for (const update2 of updates.values()) {
        if (update2.error) {
          console.error(update2.error);
        }
      }
    }
    try {
      effect_update_depth_exceeded();
    } catch (error) {
      if (true_default) {
        define_property(error, "stack", { value: "" });
      }
      invoke_error_boundary(error, last_scheduled_effect);
    }
  }
  var eager_block_effects = null;
  function flush_queued_effects(effects) {
    var length = effects.length;
    if (length === 0)
      return;
    var i = 0;
    while (i < length) {
      var effect = effects[i++];
      if ((effect.f & (DESTROYED | INERT)) === 0 && is_dirty(effect)) {
        eager_block_effects = new Set;
        update_effect(effect);
        if (effect.deps === null && effect.first === null && effect.nodes === null && effect.teardown === null && effect.ac === null) {
          unlink_effect(effect);
        }
        if (eager_block_effects?.size > 0) {
          old_values.clear();
          for (const e of eager_block_effects) {
            if ((e.f & (DESTROYED | INERT)) !== 0)
              continue;
            const ordered_effects = [e];
            let ancestor = e.parent;
            while (ancestor !== null) {
              if (eager_block_effects.has(ancestor)) {
                eager_block_effects.delete(ancestor);
                ordered_effects.push(ancestor);
              }
              ancestor = ancestor.parent;
            }
            for (let j = ordered_effects.length - 1;j >= 0; j--) {
              const e2 = ordered_effects[j];
              if ((e2.f & (DESTROYED | INERT)) !== 0)
                continue;
              update_effect(e2);
            }
          }
          eager_block_effects.clear();
        }
      }
    }
    eager_block_effects = null;
  }
  function mark_effects(value, sources, marked, checked) {
    if (marked.has(value))
      return;
    marked.add(value);
    if (value.reactions !== null) {
      for (const reaction of value.reactions) {
        const flags = reaction.f;
        if ((flags & DERIVED) !== 0) {
          mark_effects(reaction, sources, marked, checked);
        } else if ((flags & (ASYNC | BLOCK_EFFECT)) !== 0 && (flags & DIRTY) === 0 && depends_on(reaction, sources, checked)) {
          set_signal_status(reaction, DIRTY);
          schedule_effect(reaction);
        }
      }
    }
  }
  function depends_on(reaction, sources, checked) {
    const depends = checked.get(reaction);
    if (depends !== undefined)
      return depends;
    if (reaction.deps !== null) {
      for (const dep of reaction.deps) {
        if (includes.call(sources, dep)) {
          return true;
        }
        if ((dep.f & DERIVED) !== 0 && depends_on(dep, sources, checked)) {
          checked.set(dep, true);
          return true;
        }
      }
    }
    checked.set(reaction, false);
    return false;
  }
  function schedule_effect(effect) {
    current_batch.schedule(effect);
  }
  var version_map = new Map;
  function reset_branch(effect, tracked) {
    if ((effect.f & BRANCH_EFFECT) !== 0 && (effect.f & CLEAN) !== 0) {
      return;
    }
    if ((effect.f & DIRTY) !== 0) {
      tracked.d.push(effect);
    } else if ((effect.f & MAYBE_DIRTY) !== 0) {
      tracked.m.push(effect);
    }
    set_signal_status(effect, CLEAN);
    var e = effect.first;
    while (e !== null) {
      reset_branch(e, tracked);
      e = e.next;
    }
  }
  function reset_all(effect) {
    set_signal_status(effect, CLEAN);
    var e = effect.first;
    while (e !== null) {
      reset_all(e);
      e = e.next;
    }
  }

  // ../../node_modules/.bun/svelte@5.55.9/node_modules/svelte/src/reactivity/create-subscriber.js
  function createSubscriber(start) {
    let subscribers = 0;
    let version = source(0);
    let stop;
    if (true_default) {
      tag(version, "createSubscriber version");
    }
    return () => {
      if (effect_tracking()) {
        get2(version);
        render_effect(() => {
          if (subscribers === 0) {
            stop = untrack(() => start(() => increment(version)));
          }
          subscribers += 1;
          return () => {
            queue_micro_task(() => {
              subscribers -= 1;
              if (subscribers === 0) {
                stop?.();
                stop = undefined;
                increment(version);
              }
            });
          };
        });
      }
    };
  }

  // ../../node_modules/.bun/svelte@5.55.9/node_modules/svelte/src/internal/client/dom/blocks/boundary.js
  var flags = EFFECT_TRANSPARENT | EFFECT_PRESERVED;
  function boundary(node, props, children, transform_error) {
    new Boundary(node, props, children, transform_error);
  }

  class Boundary {
    parent;
    is_pending = false;
    transform_error;
    #anchor;
    #hydrate_open = hydrating ? hydrate_node : null;
    #props;
    #children;
    #effect;
    #main_effect = null;
    #pending_effect = null;
    #failed_effect = null;
    #offscreen_fragment = null;
    #local_pending_count = 0;
    #pending_count = 0;
    #pending_count_update_queued = false;
    #dirty_effects = new Set;
    #maybe_dirty_effects = new Set;
    #effect_pending = null;
    #effect_pending_subscriber = createSubscriber(() => {
      this.#effect_pending = source(this.#local_pending_count);
      if (true_default) {
        tag(this.#effect_pending, "$effect.pending()");
      }
      return () => {
        this.#effect_pending = null;
      };
    });
    constructor(node, props, children, transform_error) {
      this.#anchor = node;
      this.#props = props;
      this.#children = (anchor) => {
        var effect = active_effect;
        effect.b = this;
        effect.f |= BOUNDARY_EFFECT;
        children(anchor);
      };
      this.parent = active_effect.b;
      this.transform_error = transform_error ?? this.parent?.transform_error ?? ((e) => e);
      this.#effect = block(() => {
        if (hydrating) {
          const comment = this.#hydrate_open;
          hydrate_next();
          const server_rendered_pending = comment.data === HYDRATION_START_ELSE;
          const server_rendered_failed = comment.data.startsWith(HYDRATION_START_FAILED);
          if (server_rendered_failed) {
            const serialized_error = JSON.parse(comment.data.slice(HYDRATION_START_FAILED.length));
            this.#hydrate_failed_content(serialized_error);
          } else if (server_rendered_pending) {
            this.#hydrate_pending_content();
          } else {
            this.#hydrate_resolved_content();
          }
        } else {
          this.#render();
        }
      }, flags);
      if (hydrating) {
        this.#anchor = hydrate_node;
      }
    }
    #hydrate_resolved_content() {
      try {
        this.#main_effect = branch(() => this.#children(this.#anchor));
      } catch (error) {
        this.error(error);
      }
    }
    #hydrate_failed_content(error) {
      const failed = this.#props.failed;
      if (!failed)
        return;
      this.#failed_effect = branch(() => {
        failed(this.#anchor, () => error, () => () => {});
      });
    }
    #hydrate_pending_content() {
      const pending = this.#props.pending;
      if (!pending)
        return;
      this.is_pending = true;
      this.#pending_effect = branch(() => pending(this.#anchor));
      queue_micro_task(() => {
        var fragment = this.#offscreen_fragment = document.createDocumentFragment();
        var anchor = create_text();
        fragment.append(anchor);
        this.#main_effect = this.#run(() => {
          return branch(() => this.#children(anchor));
        });
        if (this.#pending_count === 0) {
          this.#anchor.before(fragment);
          this.#offscreen_fragment = null;
          pause_effect(this.#pending_effect, () => {
            this.#pending_effect = null;
          });
          this.#resolve(current_batch);
        }
      });
    }
    #render() {
      try {
        this.is_pending = this.has_pending_snippet();
        this.#pending_count = 0;
        this.#local_pending_count = 0;
        this.#main_effect = branch(() => {
          this.#children(this.#anchor);
        });
        if (this.#pending_count > 0) {
          var fragment = this.#offscreen_fragment = document.createDocumentFragment();
          move_effect(this.#main_effect, fragment);
          const pending = this.#props.pending;
          this.#pending_effect = branch(() => pending(this.#anchor));
        } else {
          this.#resolve(current_batch);
        }
      } catch (error) {
        this.error(error);
      }
    }
    #resolve(batch) {
      this.is_pending = false;
      batch.transfer_effects(this.#dirty_effects, this.#maybe_dirty_effects);
    }
    defer_effect(effect) {
      defer_effect(effect, this.#dirty_effects, this.#maybe_dirty_effects);
    }
    is_rendered() {
      return !this.is_pending && (!this.parent || this.parent.is_rendered());
    }
    has_pending_snippet() {
      return !!this.#props.pending;
    }
    #run(fn) {
      var previous_effect = active_effect;
      var previous_reaction = active_reaction;
      var previous_ctx = component_context;
      set_active_effect(this.#effect);
      set_active_reaction(this.#effect);
      set_component_context(this.#effect.ctx);
      try {
        Batch.ensure();
        return fn();
      } catch (e) {
        handle_error(e);
        return null;
      } finally {
        set_active_effect(previous_effect);
        set_active_reaction(previous_reaction);
        set_component_context(previous_ctx);
      }
    }
    #update_pending_count(d, batch) {
      if (!this.has_pending_snippet()) {
        if (this.parent) {
          this.parent.#update_pending_count(d, batch);
        }
        return;
      }
      this.#pending_count += d;
      if (this.#pending_count === 0) {
        this.#resolve(batch);
        if (this.#pending_effect) {
          pause_effect(this.#pending_effect, () => {
            this.#pending_effect = null;
          });
        }
        if (this.#offscreen_fragment) {
          this.#anchor.before(this.#offscreen_fragment);
          this.#offscreen_fragment = null;
        }
      }
    }
    update_pending_count(d, batch) {
      this.#update_pending_count(d, batch);
      this.#local_pending_count += d;
      if (!this.#effect_pending || this.#pending_count_update_queued)
        return;
      this.#pending_count_update_queued = true;
      queue_micro_task(() => {
        this.#pending_count_update_queued = false;
        if (this.#effect_pending) {
          internal_set(this.#effect_pending, this.#local_pending_count);
        }
      });
    }
    get_effect_pending() {
      this.#effect_pending_subscriber();
      return get2(this.#effect_pending);
    }
    error(error) {
      if (!this.#props.onerror && !this.#props.failed) {
        throw error;
      }
      if (current_batch?.is_fork) {
        if (this.#main_effect)
          current_batch.skip_effect(this.#main_effect);
        if (this.#pending_effect)
          current_batch.skip_effect(this.#pending_effect);
        if (this.#failed_effect)
          current_batch.skip_effect(this.#failed_effect);
        current_batch.on_fork_commit(() => {
          this.#handle_error(error);
        });
      } else {
        this.#handle_error(error);
      }
    }
    #handle_error(error) {
      if (this.#main_effect) {
        destroy_effect(this.#main_effect);
        this.#main_effect = null;
      }
      if (this.#pending_effect) {
        destroy_effect(this.#pending_effect);
        this.#pending_effect = null;
      }
      if (this.#failed_effect) {
        destroy_effect(this.#failed_effect);
        this.#failed_effect = null;
      }
      if (hydrating) {
        set_hydrate_node(this.#hydrate_open);
        next();
        set_hydrate_node(skip_nodes());
      }
      var onerror = this.#props.onerror;
      let failed = this.#props.failed;
      var did_reset = false;
      var calling_on_error = false;
      const reset2 = () => {
        if (did_reset) {
          svelte_boundary_reset_noop();
          return;
        }
        did_reset = true;
        if (calling_on_error) {
          svelte_boundary_reset_onerror();
        }
        if (this.#failed_effect !== null) {
          pause_effect(this.#failed_effect, () => {
            this.#failed_effect = null;
          });
        }
        this.#run(() => {
          this.#render();
        });
      };
      const handle_error_result = (transformed_error) => {
        try {
          calling_on_error = true;
          onerror?.(transformed_error, reset2);
          calling_on_error = false;
        } catch (error2) {
          invoke_error_boundary(error2, this.#effect && this.#effect.parent);
        }
        if (failed) {
          this.#failed_effect = this.#run(() => {
            try {
              return branch(() => {
                var effect = active_effect;
                effect.b = this;
                effect.f |= BOUNDARY_EFFECT;
                failed(this.#anchor, () => transformed_error, () => reset2);
              });
            } catch (error2) {
              invoke_error_boundary(error2, this.#effect.parent);
              return null;
            }
          });
        }
      };
      queue_micro_task(() => {
        var result;
        try {
          result = this.transform_error(error);
        } catch (e) {
          invoke_error_boundary(e, this.#effect && this.#effect.parent);
          return;
        }
        if (result !== null && typeof result === "object" && typeof result.then === "function") {
          result.then(handle_error_result, (e) => invoke_error_boundary(e, this.#effect && this.#effect.parent));
        } else {
          handle_error_result(result);
        }
      });
    }
  }

  // ../../node_modules/.bun/svelte@5.55.9/node_modules/svelte/src/internal/client/reactivity/async.js
  function flatten(blockers, sync, async, fn) {
    const d = is_runes() ? derived : derived_safe_equal;
    var pending = blockers.filter((b) => !b.settled);
    if (async.length === 0 && pending.length === 0) {
      fn(sync.map(d));
      return;
    }
    var parent = active_effect;
    var restore = capture();
    var blocker_promise = pending.length === 1 ? pending[0].promise : pending.length > 1 ? Promise.all(pending.map((b) => b.promise)) : null;
    function finish(values) {
      if ((parent.f & DESTROYED) !== 0) {
        return;
      }
      restore();
      try {
        fn(values);
      } catch (error) {
        invoke_error_boundary(error, parent);
      }
      unset_context();
    }
    var decrement_pending = increment_pending();
    if (async.length === 0) {
      blocker_promise.then(() => finish(sync.map(d))).finally(decrement_pending);
      return;
    }
    function run2() {
      Promise.all(async.map((expression) => async_derived(expression))).then((result) => finish([...sync.map(d), ...result])).catch((error) => invoke_error_boundary(error, parent)).finally(decrement_pending);
    }
    if (blocker_promise) {
      blocker_promise.then(() => {
        restore();
        run2();
        unset_context();
      });
    } else {
      run2();
    }
  }
  function capture() {
    var previous_effect = active_effect;
    var previous_reaction = active_reaction;
    var previous_component_context = component_context;
    var previous_batch2 = current_batch;
    if (true_default) {
      var previous_dev_stack = dev_stack;
    }
    return function restore(activate_batch = true) {
      set_active_effect(previous_effect);
      set_active_reaction(previous_reaction);
      set_component_context(previous_component_context);
      if (activate_batch && (previous_effect.f & DESTROYED) === 0) {
        previous_batch2?.activate();
        previous_batch2?.apply();
      }
      if (true_default) {
        set_reactivity_loss_tracker(null);
        set_dev_stack(previous_dev_stack);
      }
    };
  }
  function unset_context(deactivate_batch = true) {
    set_active_effect(null);
    set_active_reaction(null);
    set_component_context(null);
    if (deactivate_batch)
      current_batch?.deactivate();
    if (true_default) {
      set_reactivity_loss_tracker(null);
      set_dev_stack(null);
    }
  }
  function increment_pending() {
    var effect = active_effect;
    var boundary2 = effect.b;
    var batch = current_batch;
    var blocking = boundary2.is_rendered();
    boundary2.update_pending_count(1, batch);
    batch.increment(blocking, effect);
    return () => {
      boundary2.update_pending_count(-1, batch);
      batch.decrement(blocking, effect);
    };
  }

  // ../../node_modules/.bun/svelte@5.55.9/node_modules/svelte/src/internal/client/reactivity/deriveds.js
  var reactivity_loss_tracker = null;
  function set_reactivity_loss_tracker(v) {
    reactivity_loss_tracker = v;
  }
  var recent_async_deriveds = new Set;
  function derived(fn) {
    var flags2 = DERIVED | DIRTY;
    if (active_effect !== null) {
      active_effect.f |= EFFECT_PRESERVED;
    }
    const signal = {
      ctx: component_context,
      deps: null,
      effects: null,
      equals,
      f: flags2,
      fn,
      reactions: null,
      rv: 0,
      v: UNINITIALIZED,
      wv: 0,
      parent: active_effect,
      ac: null
    };
    if (true_default && tracing_mode_flag) {
      signal.created = get_error("created at");
    }
    return signal;
  }
  var OBSOLETE = Symbol("obsolete");
  function async_derived(fn, label, location) {
    let parent = active_effect;
    if (parent === null) {
      async_derived_orphan();
    }
    var promise = undefined;
    var signal = source(UNINITIALIZED);
    if (true_default)
      signal.label = label ?? fn.toString();
    var should_suspend = !active_reaction;
    var deferreds = new Set;
    async_effect(() => {
      var effect = active_effect;
      if (true_default) {
        reactivity_loss_tracker = { effect, effect_deps: new Set, warned: false };
      }
      var d = deferred();
      promise = d.promise;
      try {
        Promise.resolve(fn()).then(d.resolve, (e) => {
          if (e !== STALE_REACTION)
            d.reject(e);
        }).finally(unset_context);
      } catch (error) {
        d.reject(error);
        unset_context();
      }
      if (true_default) {
        if (reactivity_loss_tracker) {
          if (effect.deps !== null) {
            for (let i = 0;i < skipped_deps; i += 1) {
              reactivity_loss_tracker.effect_deps.add(effect.deps[i]);
            }
          }
          if (new_deps !== null) {
            for (let i = 0;i < new_deps.length; i += 1) {
              reactivity_loss_tracker.effect_deps.add(new_deps[i]);
            }
          }
        }
        reactivity_loss_tracker = null;
      }
      var batch = current_batch;
      if (should_suspend) {
        if ((effect.f & REACTION_RAN) !== 0) {
          var decrement_pending = increment_pending();
        }
        if (parent.b.is_rendered()) {
          batch.async_deriveds.get(effect)?.reject(OBSOLETE);
        } else {
          for (const d2 of deferreds.values()) {
            d2.reject(OBSOLETE);
          }
        }
        deferreds.add(d);
        batch.async_deriveds.set(effect, d);
      }
      const handler = (value, error = undefined) => {
        if (true_default) {
          reactivity_loss_tracker = null;
        }
        decrement_pending?.();
        deferreds.delete(d);
        if (error === OBSOLETE)
          return;
        batch.activate();
        if (error) {
          signal.f |= ERROR_VALUE;
          internal_set(signal, error);
        } else {
          if ((signal.f & ERROR_VALUE) !== 0) {
            signal.f ^= ERROR_VALUE;
          }
          internal_set(signal, value);
          if (true_default && location !== undefined) {
            recent_async_deriveds.add(signal);
            setTimeout(() => {
              if (recent_async_deriveds.has(signal) && (effect.f & DESTROYED) === 0) {
                await_waterfall(signal.label, location);
                recent_async_deriveds.delete(signal);
              }
            });
          }
        }
        batch.deactivate();
      };
      d.promise.then(handler, (e) => handler(null, e || "unknown"));
    });
    teardown(() => {
      for (const d of deferreds) {
        d.reject(OBSOLETE);
      }
    });
    if (true_default) {
      signal.f |= ASYNC;
    }
    return new Promise((fulfil) => {
      function next2(p) {
        function go() {
          if (p === promise) {
            fulfil(signal);
          } else {
            next2(promise);
          }
        }
        p.then(go, go);
      }
      next2(promise);
    });
  }
  function user_derived(fn) {
    const d = derived(fn);
    if (!async_mode_flag)
      push_reaction_value(d);
    return d;
  }
  function derived_safe_equal(fn) {
    const signal = derived(fn);
    signal.equals = safe_equals;
    return signal;
  }
  function destroy_derived_effects(derived2) {
    var effects = derived2.effects;
    if (effects !== null) {
      derived2.effects = null;
      for (var i = 0;i < effects.length; i += 1) {
        destroy_effect(effects[i]);
      }
    }
  }
  var stack = [];
  function execute_derived(derived2) {
    var value;
    var prev_active_effect = active_effect;
    var parent = derived2.parent;
    if (!is_destroying_effect && parent !== null && derived2.v !== UNINITIALIZED && (parent.f & (DESTROYED | INERT)) !== 0) {
      derived_inert();
      return derived2.v;
    }
    set_active_effect(parent);
    if (true_default) {
      let prev_eager_effects = eager_effects;
      set_eager_effects(new Set);
      try {
        if (includes.call(stack, derived2)) {
          derived_references_self();
        }
        stack.push(derived2);
        derived2.f &= ~WAS_MARKED;
        destroy_derived_effects(derived2);
        value = update_reaction(derived2);
      } finally {
        set_active_effect(prev_active_effect);
        set_eager_effects(prev_eager_effects);
        stack.pop();
      }
    } else {
      try {
        derived2.f &= ~WAS_MARKED;
        destroy_derived_effects(derived2);
        value = update_reaction(derived2);
      } finally {
        set_active_effect(prev_active_effect);
      }
    }
    return value;
  }
  function update_derived(derived2) {
    var value = execute_derived(derived2);
    if (!derived2.equals(value)) {
      derived2.wv = increment_write_version();
      if (!current_batch?.is_fork || derived2.deps === null) {
        if (current_batch !== null) {
          current_batch.capture(derived2, value, true);
          previous_batch?.capture(derived2, value, true);
        } else {
          derived2.v = value;
        }
        if (derived2.deps === null) {
          set_signal_status(derived2, CLEAN);
          return;
        }
      }
    }
    if (is_destroying_effect) {
      return;
    }
    if (batch_values !== null) {
      if (effect_tracking() || current_batch?.is_fork) {
        batch_values.set(derived2, value);
      }
    } else {
      update_derived_status(derived2);
    }
  }
  function freeze_derived_effects(derived2) {
    if (derived2.effects === null)
      return;
    for (const e of derived2.effects) {
      if (e.teardown || e.ac) {
        e.teardown?.();
        e.ac?.abort(STALE_REACTION);
        if (e.fn !== null)
          e.teardown = noop;
        e.ac = null;
        remove_reactions(e, 0);
        destroy_effect_children(e);
      }
    }
  }
  function unfreeze_derived_effects(derived2) {
    if (derived2.effects === null)
      return;
    for (const e of derived2.effects) {
      if (e.teardown && e.fn !== null) {
        update_effect(e);
      }
    }
  }

  // ../../node_modules/.bun/svelte@5.55.9/node_modules/svelte/src/internal/client/reactivity/sources.js
  var eager_effects = new Set;
  var old_values = new Map;
  function set_eager_effects(v) {
    eager_effects = v;
  }
  var eager_effects_deferred = false;
  function set_eager_effects_deferred() {
    eager_effects_deferred = true;
  }
  function source(v, stack2) {
    var signal = {
      f: 0,
      v,
      reactions: null,
      equals,
      rv: 0,
      wv: 0
    };
    if (true_default && tracing_mode_flag) {
      signal.created = stack2 ?? get_error("created at");
      signal.updated = null;
      signal.set_during_effect = false;
      signal.trace = null;
    }
    return signal;
  }
  function state(v, stack2) {
    const s = source(v, stack2);
    push_reaction_value(s);
    return s;
  }
  function mutable_source(initial_value, immutable = false, trackable = true) {
    const s = source(initial_value);
    if (!immutable) {
      s.equals = safe_equals;
    }
    if (legacy_mode_flag && trackable && component_context !== null && component_context.l !== null) {
      (component_context.l.s ??= []).push(s);
    }
    return s;
  }
  function set(source2, value, should_proxy = false) {
    if (active_reaction !== null && (!untracking || (active_reaction.f & EAGER_EFFECT) !== 0) && is_runes() && (active_reaction.f & (DERIVED | BLOCK_EFFECT | ASYNC | EAGER_EFFECT)) !== 0 && (current_sources === null || !includes.call(current_sources, source2))) {
      state_unsafe_mutation();
    }
    let new_value = should_proxy ? proxy(value) : value;
    if (true_default) {
      tag_proxy(new_value, source2.label);
    }
    return internal_set(source2, new_value, legacy_updates);
  }
  function internal_set(source2, value, updated_during_traversal = null) {
    if (!source2.equals(value)) {
      old_values.set(source2, is_destroying_effect ? value : source2.v);
      var batch = Batch.ensure();
      batch.capture(source2, value);
      if (true_default) {
        if (tracing_mode_flag || active_effect !== null) {
          source2.updated ??= new Map;
          const count = (source2.updated.get("")?.count ?? 0) + 1;
          source2.updated.set("", { error: null, count });
          if (tracing_mode_flag || count > 5) {
            const error = get_error("updated at");
            if (error !== null) {
              let entry = source2.updated.get(error.stack);
              if (!entry) {
                entry = { error, count: 0 };
                source2.updated.set(error.stack, entry);
              }
              entry.count++;
            }
          }
        }
        if (active_effect !== null) {
          source2.set_during_effect = true;
        }
      }
      if ((source2.f & DERIVED) !== 0) {
        const derived2 = source2;
        if ((source2.f & DIRTY) !== 0) {
          execute_derived(derived2);
        }
        if (batch_values === null) {
          update_derived_status(derived2);
        }
      }
      source2.wv = increment_write_version();
      mark_reactions(source2, DIRTY, updated_during_traversal);
      if (is_runes() && active_effect !== null && (active_effect.f & CLEAN) !== 0 && (active_effect.f & (BRANCH_EFFECT | ROOT_EFFECT)) === 0) {
        if (untracked_writes === null) {
          set_untracked_writes([source2]);
        } else {
          untracked_writes.push(source2);
        }
      }
      if (!batch.is_fork && eager_effects.size > 0 && !eager_effects_deferred) {
        flush_eager_effects();
      }
    }
    return value;
  }
  function flush_eager_effects() {
    eager_effects_deferred = false;
    for (const effect of eager_effects) {
      if ((effect.f & CLEAN) !== 0) {
        set_signal_status(effect, MAYBE_DIRTY);
      }
      let dirty;
      try {
        dirty = is_dirty(effect);
      } catch {
        dirty = true;
      }
      if (dirty) {
        update_effect(effect);
      }
    }
    eager_effects.clear();
  }
  function increment(source2) {
    set(source2, source2.v + 1);
  }
  function mark_reactions(signal, status, updated_during_traversal) {
    var reactions = signal.reactions;
    if (reactions === null)
      return;
    var runes = is_runes();
    var length = reactions.length;
    for (var i = 0;i < length; i++) {
      var reaction = reactions[i];
      var flags2 = reaction.f;
      if (!runes && reaction === active_effect)
        continue;
      var not_dirty = (flags2 & DIRTY) === 0;
      if (not_dirty) {
        set_signal_status(reaction, status);
      }
      if ((flags2 & EAGER_EFFECT) !== 0) {
        eager_effects.add(reaction);
      } else if ((flags2 & DERIVED) !== 0) {
        var derived2 = reaction;
        batch_values?.delete(derived2);
        if ((flags2 & WAS_MARKED) === 0) {
          if (flags2 & CONNECTED && (active_effect === null || (active_effect.f & REACTION_IS_UPDATING) === 0)) {
            reaction.f |= WAS_MARKED;
          }
          mark_reactions(derived2, MAYBE_DIRTY, updated_during_traversal);
        }
      } else if (not_dirty) {
        var effect = reaction;
        if ((flags2 & BLOCK_EFFECT) !== 0 && eager_block_effects !== null) {
          eager_block_effects.add(effect);
        }
        if (updated_during_traversal !== null) {
          updated_during_traversal.push(effect);
        } else {
          schedule_effect(effect);
        }
      }
    }
  }

  // ../../node_modules/.bun/svelte@5.55.9/node_modules/svelte/src/internal/client/proxy.js
  var regex_is_valid_identifier = /^[a-zA-Z_$][a-zA-Z_$0-9]*$/;
  function proxy(value) {
    if (typeof value !== "object" || value === null || STATE_SYMBOL in value) {
      return value;
    }
    const prototype = get_prototype_of(value);
    if (prototype !== object_prototype && prototype !== array_prototype) {
      return value;
    }
    var sources = new Map;
    var is_proxied_array = is_array(value);
    var version = state(0);
    var stack2 = true_default && tracing_mode_flag ? get_error("created at") : null;
    var parent_version = update_version;
    var with_parent = (fn) => {
      if (update_version === parent_version) {
        return fn();
      }
      var reaction = active_reaction;
      var version2 = update_version;
      set_active_reaction(null);
      set_update_version(parent_version);
      var result = fn();
      set_active_reaction(reaction);
      set_update_version(version2);
      return result;
    };
    if (is_proxied_array) {
      sources.set("length", state(value.length, stack2));
      if (true_default) {
        value = inspectable_array(value);
      }
    }
    var path = "";
    let updating = false;
    function update_path(new_path) {
      if (updating)
        return;
      updating = true;
      path = new_path;
      tag(version, \`\${path} version\`);
      for (const [prop, source2] of sources) {
        tag(source2, get_label(path, prop));
      }
      updating = false;
    }
    return new Proxy(value, {
      defineProperty(_, prop, descriptor) {
        if (!("value" in descriptor) || descriptor.configurable === false || descriptor.enumerable === false || descriptor.writable === false) {
          state_descriptors_fixed();
        }
        var s = sources.get(prop);
        if (s === undefined) {
          with_parent(() => {
            var s2 = state(descriptor.value, stack2);
            sources.set(prop, s2);
            if (true_default && typeof prop === "string") {
              tag(s2, get_label(path, prop));
            }
            return s2;
          });
        } else {
          set(s, descriptor.value, true);
        }
        return true;
      },
      deleteProperty(target, prop) {
        var s = sources.get(prop);
        if (s === undefined) {
          if (prop in target) {
            const s2 = with_parent(() => state(UNINITIALIZED, stack2));
            sources.set(prop, s2);
            increment(version);
            if (true_default) {
              tag(s2, get_label(path, prop));
            }
          }
        } else {
          set(s, UNINITIALIZED);
          increment(version);
        }
        return true;
      },
      get(target, prop, receiver) {
        if (prop === STATE_SYMBOL) {
          return value;
        }
        if (true_default && prop === PROXY_PATH_SYMBOL) {
          return update_path;
        }
        var s = sources.get(prop);
        var exists = prop in target;
        if (s === undefined && (!exists || get_descriptor(target, prop)?.writable)) {
          s = with_parent(() => {
            var p = proxy(exists ? target[prop] : UNINITIALIZED);
            var s2 = state(p, stack2);
            if (true_default) {
              tag(s2, get_label(path, prop));
            }
            return s2;
          });
          sources.set(prop, s);
        }
        if (s !== undefined) {
          var v = get2(s);
          return v === UNINITIALIZED ? undefined : v;
        }
        return Reflect.get(target, prop, receiver);
      },
      getOwnPropertyDescriptor(target, prop) {
        var descriptor = Reflect.getOwnPropertyDescriptor(target, prop);
        if (descriptor && "value" in descriptor) {
          var s = sources.get(prop);
          if (s)
            descriptor.value = get2(s);
        } else if (descriptor === undefined) {
          var source2 = sources.get(prop);
          var value2 = source2?.v;
          if (source2 !== undefined && value2 !== UNINITIALIZED) {
            return {
              enumerable: true,
              configurable: true,
              value: value2,
              writable: true
            };
          }
        }
        return descriptor;
      },
      has(target, prop) {
        if (prop === STATE_SYMBOL) {
          return true;
        }
        var s = sources.get(prop);
        var has = s !== undefined && s.v !== UNINITIALIZED || Reflect.has(target, prop);
        if (s !== undefined || active_effect !== null && (!has || get_descriptor(target, prop)?.writable)) {
          if (s === undefined) {
            s = with_parent(() => {
              var p = has ? proxy(target[prop]) : UNINITIALIZED;
              var s2 = state(p, stack2);
              if (true_default) {
                tag(s2, get_label(path, prop));
              }
              return s2;
            });
            sources.set(prop, s);
          }
          var value2 = get2(s);
          if (value2 === UNINITIALIZED) {
            return false;
          }
        }
        return has;
      },
      set(target, prop, value2, receiver) {
        var s = sources.get(prop);
        var has = prop in target;
        if (is_proxied_array && prop === "length") {
          for (var i = value2;i < s.v; i += 1) {
            var other_s = sources.get(i + "");
            if (other_s !== undefined) {
              set(other_s, UNINITIALIZED);
            } else if (i in target) {
              other_s = with_parent(() => state(UNINITIALIZED, stack2));
              sources.set(i + "", other_s);
              if (true_default) {
                tag(other_s, get_label(path, i));
              }
            }
          }
        }
        if (s === undefined) {
          if (!has || get_descriptor(target, prop)?.writable) {
            s = with_parent(() => state(undefined, stack2));
            if (true_default) {
              tag(s, get_label(path, prop));
            }
            set(s, proxy(value2));
            sources.set(prop, s);
          }
        } else {
          has = s.v !== UNINITIALIZED;
          var p = with_parent(() => proxy(value2));
          set(s, p);
        }
        var descriptor = Reflect.getOwnPropertyDescriptor(target, prop);
        if (descriptor?.set) {
          descriptor.set.call(receiver, value2);
        }
        if (!has) {
          if (is_proxied_array && typeof prop === "string") {
            var ls = sources.get("length");
            var n = Number(prop);
            if (Number.isInteger(n) && n >= ls.v) {
              set(ls, n + 1);
            }
          }
          increment(version);
        }
        return true;
      },
      ownKeys(target) {
        get2(version);
        var own_keys = Reflect.ownKeys(target).filter((key2) => {
          var source3 = sources.get(key2);
          return source3 === undefined || source3.v !== UNINITIALIZED;
        });
        for (var [key, source2] of sources) {
          if (source2.v !== UNINITIALIZED && !(key in target)) {
            own_keys.push(key);
          }
        }
        return own_keys;
      },
      setPrototypeOf() {
        state_prototype_fixed();
      }
    });
  }
  function get_label(path, prop) {
    if (typeof prop === "symbol")
      return \`\${path}[Symbol(\${prop.description ?? ""})]\`;
    if (regex_is_valid_identifier.test(prop))
      return \`\${path}.\${prop}\`;
    return /^\\d+$/.test(prop) ? \`\${path}[\${prop}]\` : \`\${path}['\${prop}']\`;
  }
  function get_proxied_value(value) {
    try {
      if (value !== null && typeof value === "object" && STATE_SYMBOL in value) {
        return value[STATE_SYMBOL];
      }
    } catch {}
    return value;
  }
  var ARRAY_MUTATING_METHODS = new Set([
    "copyWithin",
    "fill",
    "pop",
    "push",
    "reverse",
    "shift",
    "sort",
    "splice",
    "unshift"
  ]);
  function inspectable_array(array) {
    return new Proxy(array, {
      get(target, prop, receiver) {
        var value = Reflect.get(target, prop, receiver);
        if (!ARRAY_MUTATING_METHODS.has(prop)) {
          return value;
        }
        return function(...args) {
          set_eager_effects_deferred();
          var result = value.apply(this, args);
          flush_eager_effects();
          return result;
        };
      }
    });
  }

  // ../../node_modules/.bun/svelte@5.55.9/node_modules/svelte/src/internal/client/dev/equality.js
  function init_array_prototype_warnings() {
    const array_prototype2 = Array.prototype;
    const cleanup = Array.__svelte_cleanup;
    if (cleanup) {
      cleanup();
    }
    const { indexOf, lastIndexOf, includes: includes2 } = array_prototype2;
    array_prototype2.indexOf = function(item, from_index) {
      const index = indexOf.call(this, item, from_index);
      if (index === -1) {
        for (let i = from_index ?? 0;i < this.length; i += 1) {
          if (get_proxied_value(this[i]) === item) {
            state_proxy_equality_mismatch("array.indexOf(...)");
            break;
          }
        }
      }
      return index;
    };
    array_prototype2.lastIndexOf = function(item, from_index) {
      const index = lastIndexOf.call(this, item, from_index ?? this.length - 1);
      if (index === -1) {
        for (let i = 0;i <= (from_index ?? this.length - 1); i += 1) {
          if (get_proxied_value(this[i]) === item) {
            state_proxy_equality_mismatch("array.lastIndexOf(...)");
            break;
          }
        }
      }
      return index;
    };
    array_prototype2.includes = function(item, from_index) {
      const has = includes2.call(this, item, from_index);
      if (!has) {
        for (let i = 0;i < this.length; i += 1) {
          if (get_proxied_value(this[i]) === item) {
            state_proxy_equality_mismatch("array.includes(...)");
            break;
          }
        }
      }
      return has;
    };
    Array.__svelte_cleanup = () => {
      array_prototype2.indexOf = indexOf;
      array_prototype2.lastIndexOf = lastIndexOf;
      array_prototype2.includes = includes2;
    };
  }
  function strict_equals(a, b, equal = true) {
    try {
      if (a === b !== (get_proxied_value(a) === get_proxied_value(b))) {
        state_proxy_equality_mismatch(equal ? "===" : "!==");
      }
    } catch {}
    return a === b === equal;
  }

  // ../../node_modules/.bun/svelte@5.55.9/node_modules/svelte/src/internal/client/dom/operations.js
  var $window;
  var $document;
  var is_firefox;
  var first_child_getter;
  var next_sibling_getter;
  function init_operations() {
    if ($window !== undefined) {
      return;
    }
    $window = window;
    $document = document;
    is_firefox = /Firefox/.test(navigator.userAgent);
    var element_prototype = Element.prototype;
    var node_prototype = Node.prototype;
    var text_prototype = Text.prototype;
    first_child_getter = get_descriptor(node_prototype, "firstChild").get;
    next_sibling_getter = get_descriptor(node_prototype, "nextSibling").get;
    if (is_extensible(element_prototype)) {
      element_prototype[CLASS_CACHE] = undefined;
      element_prototype[ATTRIBUTES_CACHE] = null;
      element_prototype[STYLE_CACHE] = undefined;
      element_prototype.__e = undefined;
    }
    if (is_extensible(text_prototype)) {
      text_prototype[TEXT_CACHE] = undefined;
    }
    if (true_default) {
      element_prototype.__svelte_meta = null;
      init_array_prototype_warnings();
    }
  }
  function create_text(value = "") {
    return document.createTextNode(value);
  }
  function get_first_child(node) {
    return first_child_getter.call(node);
  }
  function get_next_sibling(node) {
    return next_sibling_getter.call(node);
  }
  function child(node, is_text) {
    if (!hydrating) {
      return get_first_child(node);
    }
    var child2 = get_first_child(hydrate_node);
    if (child2 === null) {
      child2 = hydrate_node.appendChild(create_text());
    } else if (is_text && child2.nodeType !== TEXT_NODE) {
      var text = create_text();
      child2?.before(text);
      set_hydrate_node(text);
      return text;
    }
    if (is_text) {
      merge_text_nodes(child2);
    }
    set_hydrate_node(child2);
    return child2;
  }
  function first_child(node, is_text = false) {
    if (!hydrating) {
      var first = get_first_child(node);
      if (first instanceof Comment && first.data === "")
        return get_next_sibling(first);
      return first;
    }
    if (is_text) {
      if (hydrate_node?.nodeType !== TEXT_NODE) {
        var text = create_text();
        hydrate_node?.before(text);
        set_hydrate_node(text);
        return text;
      }
      merge_text_nodes(hydrate_node);
    }
    return hydrate_node;
  }
  function sibling(node, count = 1, is_text = false) {
    let next_sibling = hydrating ? hydrate_node : node;
    var last_sibling;
    while (count--) {
      last_sibling = next_sibling;
      next_sibling = get_next_sibling(next_sibling);
    }
    if (!hydrating) {
      return next_sibling;
    }
    if (is_text) {
      if (next_sibling?.nodeType !== TEXT_NODE) {
        var text = create_text();
        if (next_sibling === null) {
          last_sibling?.after(text);
        } else {
          next_sibling.before(text);
        }
        set_hydrate_node(text);
        return text;
      }
      merge_text_nodes(next_sibling);
    }
    set_hydrate_node(next_sibling);
    return next_sibling;
  }
  function clear_text_content(node) {
    node.textContent = "";
  }
  function should_defer_append() {
    if (!async_mode_flag)
      return false;
    if (eager_block_effects !== null)
      return false;
    var flags2 = active_effect.f;
    return (flags2 & REACTION_RAN) !== 0;
  }
  function create_element(tag2, namespace, is) {
    let options = is ? { is } : undefined;
    return document.createElementNS(namespace ?? NAMESPACE_HTML, tag2, options);
  }
  function merge_text_nodes(text) {
    if (text.nodeValue.length < 65536) {
      return;
    }
    let next2 = text.nextSibling;
    while (next2 !== null && next2.nodeType === TEXT_NODE) {
      next2.remove();
      text.nodeValue += next2.nodeValue;
      next2 = text.nextSibling;
    }
  }

  // ../../node_modules/.bun/svelte@5.55.9/node_modules/svelte/src/internal/client/dom/elements/misc.js
  var listening_to_form_reset = false;
  function add_form_reset_listener() {
    if (!listening_to_form_reset) {
      listening_to_form_reset = true;
      document.addEventListener("reset", (evt) => {
        Promise.resolve().then(() => {
          if (!evt.defaultPrevented) {
            for (const e of evt.target.elements) {
              e[FORM_RESET_HANDLER]?.();
            }
          }
        });
      }, { capture: true });
    }
  }

  // ../../node_modules/.bun/svelte@5.55.9/node_modules/svelte/src/internal/client/dom/elements/bindings/shared.js
  function without_reactive_context(fn) {
    var previous_reaction = active_reaction;
    var previous_effect = active_effect;
    set_active_reaction(null);
    set_active_effect(null);
    try {
      return fn();
    } finally {
      set_active_reaction(previous_reaction);
      set_active_effect(previous_effect);
    }
  }

  // ../../node_modules/.bun/svelte@5.55.9/node_modules/svelte/src/internal/client/reactivity/effects.js
  function validate_effect(rune) {
    if (active_effect === null) {
      if (active_reaction === null) {
        effect_orphan(rune);
      }
      effect_in_unowned_derived();
    }
    if (is_destroying_effect) {
      effect_in_teardown(rune);
    }
  }
  function push_effect(effect, parent_effect) {
    var parent_last = parent_effect.last;
    if (parent_last === null) {
      parent_effect.last = parent_effect.first = effect;
    } else {
      parent_last.next = effect;
      effect.prev = parent_last;
      parent_effect.last = effect;
    }
  }
  function create_effect(type, fn) {
    var parent = active_effect;
    if (true_default) {
      while (parent !== null && (parent.f & EAGER_EFFECT) !== 0) {
        parent = parent.parent;
      }
    }
    if (parent !== null && (parent.f & INERT) !== 0) {
      type |= INERT;
    }
    var effect = {
      ctx: component_context,
      deps: null,
      nodes: null,
      f: type | DIRTY | CONNECTED,
      first: null,
      fn,
      last: null,
      next: null,
      parent,
      b: parent && parent.b,
      prev: null,
      teardown: null,
      wv: 0,
      ac: null
    };
    if (true_default) {
      effect.component_function = dev_current_component_function;
    }
    current_batch?.register_created_effect(effect);
    var e = effect;
    if ((type & EFFECT) !== 0) {
      if (collected_effects !== null) {
        collected_effects.push(effect);
      } else {
        Batch.ensure().schedule(effect);
      }
    } else if (fn !== null) {
      try {
        update_effect(effect);
      } catch (e2) {
        destroy_effect(effect);
        throw e2;
      }
      if (e.deps === null && e.teardown === null && e.nodes === null && e.first === e.last && (e.f & EFFECT_PRESERVED) === 0) {
        e = e.first;
        if ((type & BLOCK_EFFECT) !== 0 && (type & EFFECT_TRANSPARENT) !== 0 && e !== null) {
          e.f |= EFFECT_TRANSPARENT;
        }
      }
    }
    if (e !== null) {
      e.parent = parent;
      if (parent !== null) {
        push_effect(e, parent);
      }
      if (active_reaction !== null && (active_reaction.f & DERIVED) !== 0 && (type & ROOT_EFFECT) === 0) {
        var derived2 = active_reaction;
        (derived2.effects ??= []).push(e);
      }
    }
    return effect;
  }
  function effect_tracking() {
    return active_reaction !== null && !untracking;
  }
  function teardown(fn) {
    const effect = create_effect(RENDER_EFFECT, null);
    set_signal_status(effect, CLEAN);
    effect.teardown = fn;
    return effect;
  }
  function user_effect(fn) {
    validate_effect("$effect");
    if (true_default) {
      define_property(fn, "name", {
        value: "$effect"
      });
    }
    var flags2 = active_effect.f;
    var defer = !active_reaction && (flags2 & BRANCH_EFFECT) !== 0 && (flags2 & REACTION_RAN) === 0;
    if (defer) {
      var context = component_context;
      (context.e ??= []).push(fn);
    } else {
      return create_user_effect(fn);
    }
  }
  function create_user_effect(fn) {
    return create_effect(EFFECT | USER_EFFECT, fn);
  }
  function user_pre_effect(fn) {
    validate_effect("$effect.pre");
    if (true_default) {
      define_property(fn, "name", {
        value: "$effect.pre"
      });
    }
    return create_effect(RENDER_EFFECT | USER_EFFECT, fn);
  }
  function effect_root(fn) {
    Batch.ensure();
    const effect = create_effect(ROOT_EFFECT | EFFECT_PRESERVED, fn);
    return () => {
      destroy_effect(effect);
    };
  }
  function component_root(fn) {
    Batch.ensure();
    const effect = create_effect(ROOT_EFFECT | EFFECT_PRESERVED, fn);
    return (options = {}) => {
      return new Promise((fulfil) => {
        if (options.outro) {
          pause_effect(effect, () => {
            destroy_effect(effect);
            fulfil(undefined);
          });
        } else {
          destroy_effect(effect);
          fulfil(undefined);
        }
      });
    };
  }
  function async_effect(fn) {
    return create_effect(ASYNC | EFFECT_PRESERVED, fn);
  }
  function render_effect(fn, flags2 = 0) {
    return create_effect(RENDER_EFFECT | flags2, fn);
  }
  function template_effect(fn, sync = [], async = [], blockers = []) {
    flatten(blockers, sync, async, (values) => {
      create_effect(RENDER_EFFECT, () => fn(...values.map(get2)));
    });
  }
  function block(fn, flags2 = 0) {
    var effect = create_effect(BLOCK_EFFECT | flags2, fn);
    if (true_default) {
      effect.dev_stack = dev_stack;
    }
    return effect;
  }
  function branch(fn) {
    return create_effect(BRANCH_EFFECT | EFFECT_PRESERVED, fn);
  }
  function execute_effect_teardown(effect) {
    var teardown2 = effect.teardown;
    if (teardown2 !== null) {
      const previously_destroying_effect = is_destroying_effect;
      const previous_reaction = active_reaction;
      set_is_destroying_effect(true);
      set_active_reaction(null);
      try {
        teardown2.call(null);
      } finally {
        set_is_destroying_effect(previously_destroying_effect);
        set_active_reaction(previous_reaction);
      }
    }
  }
  function destroy_effect_children(signal, remove_dom = false) {
    var effect = signal.first;
    signal.first = signal.last = null;
    while (effect !== null) {
      const controller = effect.ac;
      if (controller !== null) {
        without_reactive_context(() => {
          controller.abort(STALE_REACTION);
        });
      }
      var next2 = effect.next;
      if ((effect.f & ROOT_EFFECT) !== 0) {
        effect.parent = null;
      } else {
        destroy_effect(effect, remove_dom);
      }
      effect = next2;
    }
  }
  function destroy_block_effect_children(signal) {
    var effect = signal.first;
    while (effect !== null) {
      var next2 = effect.next;
      if ((effect.f & BRANCH_EFFECT) === 0) {
        destroy_effect(effect);
      }
      effect = next2;
    }
  }
  function destroy_effect(effect, remove_dom = true) {
    var removed = false;
    if ((remove_dom || (effect.f & HEAD_EFFECT) !== 0) && effect.nodes !== null && effect.nodes.end !== null) {
      remove_effect_dom(effect.nodes.start, effect.nodes.end);
      removed = true;
    }
    set_signal_status(effect, DESTROYING);
    destroy_effect_children(effect, remove_dom && !removed);
    remove_reactions(effect, 0);
    var transitions = effect.nodes && effect.nodes.t;
    if (transitions !== null) {
      for (const transition of transitions) {
        transition.stop();
      }
    }
    execute_effect_teardown(effect);
    effect.f ^= DESTROYING;
    effect.f |= DESTROYED;
    var parent = effect.parent;
    if (parent !== null && parent.first !== null) {
      unlink_effect(effect);
    }
    if (true_default) {
      effect.component_function = null;
    }
    effect.next = effect.prev = effect.teardown = effect.ctx = effect.deps = effect.fn = effect.nodes = effect.ac = effect.b = null;
  }
  function remove_effect_dom(node, end) {
    while (node !== null) {
      var next2 = node === end ? null : get_next_sibling(node);
      node.remove();
      node = next2;
    }
  }
  function unlink_effect(effect) {
    var parent = effect.parent;
    var prev = effect.prev;
    var next2 = effect.next;
    if (prev !== null)
      prev.next = next2;
    if (next2 !== null)
      next2.prev = prev;
    if (parent !== null) {
      if (parent.first === effect)
        parent.first = next2;
      if (parent.last === effect)
        parent.last = prev;
    }
  }
  function pause_effect(effect, callback, destroy = true) {
    var transitions = [];
    pause_children(effect, transitions, true);
    var fn = () => {
      if (destroy)
        destroy_effect(effect);
      if (callback)
        callback();
    };
    var remaining = transitions.length;
    if (remaining > 0) {
      var check = () => --remaining || fn();
      for (var transition of transitions) {
        transition.out(check);
      }
    } else {
      fn();
    }
  }
  function pause_children(effect, transitions, local) {
    if ((effect.f & INERT) !== 0)
      return;
    effect.f ^= INERT;
    var t = effect.nodes && effect.nodes.t;
    if (t !== null) {
      for (const transition of t) {
        if (transition.is_global || local) {
          transitions.push(transition);
        }
      }
    }
    var child2 = effect.first;
    while (child2 !== null) {
      var sibling2 = child2.next;
      if ((child2.f & ROOT_EFFECT) === 0) {
        var transparent = (child2.f & EFFECT_TRANSPARENT) !== 0 || (child2.f & BRANCH_EFFECT) !== 0 && (effect.f & BLOCK_EFFECT) !== 0;
        pause_children(child2, transitions, transparent ? local : false);
      }
      child2 = sibling2;
    }
  }
  function resume_effect(effect) {
    resume_children(effect, true);
  }
  function resume_children(effect, local) {
    if ((effect.f & INERT) === 0)
      return;
    effect.f ^= INERT;
    if ((effect.f & CLEAN) === 0) {
      set_signal_status(effect, DIRTY);
      Batch.ensure().schedule(effect);
    }
    var child2 = effect.first;
    while (child2 !== null) {
      var sibling2 = child2.next;
      var transparent = (child2.f & EFFECT_TRANSPARENT) !== 0 || (child2.f & BRANCH_EFFECT) !== 0;
      resume_children(child2, transparent ? local : false);
      child2 = sibling2;
    }
    var t = effect.nodes && effect.nodes.t;
    if (t !== null) {
      for (const transition of t) {
        if (transition.is_global || local) {
          transition.in();
        }
      }
    }
  }
  function move_effect(effect, fragment) {
    if (!effect.nodes)
      return;
    var node = effect.nodes.start;
    var end = effect.nodes.end;
    while (node !== null) {
      var next2 = node === end ? null : get_next_sibling(node);
      fragment.append(node);
      node = next2;
    }
  }

  // ../../node_modules/.bun/svelte@5.55.9/node_modules/svelte/src/internal/client/legacy.js
  var captured_signals = null;

  // ../../node_modules/.bun/svelte@5.55.9/node_modules/svelte/src/internal/client/runtime.js
  var is_updating_effect = false;
  var is_destroying_effect = false;
  function set_is_destroying_effect(value) {
    is_destroying_effect = value;
  }
  var active_reaction = null;
  var untracking = false;
  function set_active_reaction(reaction) {
    active_reaction = reaction;
  }
  var active_effect = null;
  function set_active_effect(effect) {
    active_effect = effect;
  }
  var current_sources = null;
  function push_reaction_value(value) {
    if (active_reaction !== null && (!async_mode_flag || (active_reaction.f & DERIVED) !== 0)) {
      if (current_sources === null) {
        current_sources = [value];
      } else {
        current_sources.push(value);
      }
    }
  }
  var new_deps = null;
  var skipped_deps = 0;
  var untracked_writes = null;
  function set_untracked_writes(value) {
    untracked_writes = value;
  }
  var write_version = 1;
  var read_version = 0;
  var update_version = read_version;
  function set_update_version(value) {
    update_version = value;
  }
  function increment_write_version() {
    return ++write_version;
  }
  function is_dirty(reaction) {
    var flags2 = reaction.f;
    if ((flags2 & DIRTY) !== 0) {
      return true;
    }
    if (flags2 & DERIVED) {
      reaction.f &= ~WAS_MARKED;
    }
    if ((flags2 & MAYBE_DIRTY) !== 0) {
      var dependencies = reaction.deps;
      var length = dependencies.length;
      for (var i = 0;i < length; i++) {
        var dependency = dependencies[i];
        if (is_dirty(dependency)) {
          update_derived(dependency);
        }
        if (dependency.wv > reaction.wv) {
          return true;
        }
      }
      if ((flags2 & CONNECTED) !== 0 && batch_values === null) {
        set_signal_status(reaction, CLEAN);
      }
    }
    return false;
  }
  function schedule_possible_effect_self_invalidation(signal, effect, root = true) {
    var reactions = signal.reactions;
    if (reactions === null)
      return;
    if (!async_mode_flag && current_sources !== null && includes.call(current_sources, signal)) {
      return;
    }
    for (var i = 0;i < reactions.length; i++) {
      var reaction = reactions[i];
      if ((reaction.f & DERIVED) !== 0) {
        schedule_possible_effect_self_invalidation(reaction, effect, false);
      } else if (effect === reaction) {
        if (root) {
          set_signal_status(reaction, DIRTY);
        } else if ((reaction.f & CLEAN) !== 0) {
          set_signal_status(reaction, MAYBE_DIRTY);
        }
        schedule_effect(reaction);
      }
    }
  }
  function update_reaction(reaction) {
    var previous_deps = new_deps;
    var previous_skipped_deps = skipped_deps;
    var previous_untracked_writes = untracked_writes;
    var previous_reaction = active_reaction;
    var previous_sources = current_sources;
    var previous_component_context = component_context;
    var previous_untracking = untracking;
    var previous_update_version = update_version;
    var flags2 = reaction.f;
    new_deps = null;
    skipped_deps = 0;
    untracked_writes = null;
    active_reaction = (flags2 & (BRANCH_EFFECT | ROOT_EFFECT)) === 0 ? reaction : null;
    current_sources = null;
    set_component_context(reaction.ctx);
    untracking = false;
    update_version = ++read_version;
    if (reaction.ac !== null) {
      without_reactive_context(() => {
        reaction.ac.abort(STALE_REACTION);
      });
      reaction.ac = null;
    }
    try {
      reaction.f |= REACTION_IS_UPDATING;
      var fn = reaction.fn;
      var result = fn();
      reaction.f |= REACTION_RAN;
      var deps = reaction.deps;
      var is_fork = current_batch?.is_fork;
      if (new_deps !== null) {
        var i;
        if (!is_fork) {
          remove_reactions(reaction, skipped_deps);
        }
        if (deps !== null && skipped_deps > 0) {
          deps.length = skipped_deps + new_deps.length;
          for (i = 0;i < new_deps.length; i++) {
            deps[skipped_deps + i] = new_deps[i];
          }
        } else {
          reaction.deps = deps = new_deps;
        }
        if (effect_tracking() && (reaction.f & CONNECTED) !== 0) {
          for (i = skipped_deps;i < deps.length; i++) {
            (deps[i].reactions ??= []).push(reaction);
          }
        }
      } else if (!is_fork && deps !== null && skipped_deps < deps.length) {
        remove_reactions(reaction, skipped_deps);
        deps.length = skipped_deps;
      }
      if (is_runes() && untracked_writes !== null && !untracking && deps !== null && (reaction.f & (DERIVED | MAYBE_DIRTY | DIRTY)) === 0) {
        for (i = 0;i < untracked_writes.length; i++) {
          schedule_possible_effect_self_invalidation(untracked_writes[i], reaction);
        }
      }
      if (previous_reaction !== null && previous_reaction !== reaction) {
        read_version++;
        if (previous_reaction.deps !== null) {
          for (let i2 = 0;i2 < previous_skipped_deps; i2 += 1) {
            previous_reaction.deps[i2].rv = read_version;
          }
        }
        if (previous_deps !== null) {
          for (const dep of previous_deps) {
            dep.rv = read_version;
          }
        }
        if (untracked_writes !== null) {
          if (previous_untracked_writes === null) {
            previous_untracked_writes = untracked_writes;
          } else {
            previous_untracked_writes.push(...untracked_writes);
          }
        }
      }
      if ((reaction.f & ERROR_VALUE) !== 0) {
        reaction.f ^= ERROR_VALUE;
      }
      return result;
    } catch (error) {
      return handle_error(error);
    } finally {
      reaction.f ^= REACTION_IS_UPDATING;
      new_deps = previous_deps;
      skipped_deps = previous_skipped_deps;
      untracked_writes = previous_untracked_writes;
      active_reaction = previous_reaction;
      current_sources = previous_sources;
      set_component_context(previous_component_context);
      untracking = previous_untracking;
      update_version = previous_update_version;
    }
  }
  function remove_reaction(signal, dependency) {
    let reactions = dependency.reactions;
    if (reactions !== null) {
      var index = index_of.call(reactions, signal);
      if (index !== -1) {
        var new_length = reactions.length - 1;
        if (new_length === 0) {
          reactions = dependency.reactions = null;
        } else {
          reactions[index] = reactions[new_length];
          reactions.pop();
        }
      }
    }
    if (reactions === null && (dependency.f & DERIVED) !== 0 && (new_deps === null || !includes.call(new_deps, dependency))) {
      var derived2 = dependency;
      if ((derived2.f & CONNECTED) !== 0) {
        derived2.f ^= CONNECTED;
        derived2.f &= ~WAS_MARKED;
      }
      if (derived2.v !== UNINITIALIZED) {
        update_derived_status(derived2);
      }
      freeze_derived_effects(derived2);
      remove_reactions(derived2, 0);
    }
  }
  function remove_reactions(signal, start_index) {
    var dependencies = signal.deps;
    if (dependencies === null)
      return;
    for (var i = start_index;i < dependencies.length; i++) {
      remove_reaction(signal, dependencies[i]);
    }
  }
  function update_effect(effect) {
    var flags2 = effect.f;
    if ((flags2 & DESTROYED) !== 0) {
      return;
    }
    set_signal_status(effect, CLEAN);
    var previous_effect = active_effect;
    var was_updating_effect = is_updating_effect;
    active_effect = effect;
    is_updating_effect = true;
    if (true_default) {
      var previous_component_fn = dev_current_component_function;
      set_dev_current_component_function(effect.component_function);
      var previous_stack = dev_stack;
      set_dev_stack(effect.dev_stack ?? dev_stack);
    }
    try {
      if ((flags2 & (BLOCK_EFFECT | MANAGED_EFFECT)) !== 0) {
        destroy_block_effect_children(effect);
      } else {
        destroy_effect_children(effect);
      }
      execute_effect_teardown(effect);
      var teardown2 = update_reaction(effect);
      effect.teardown = typeof teardown2 === "function" ? teardown2 : null;
      effect.wv = write_version;
      if (true_default && tracing_mode_flag && (effect.f & DIRTY) !== 0 && effect.deps !== null) {
        for (var dep of effect.deps) {
          if (dep.set_during_effect) {
            dep.wv = increment_write_version();
            dep.set_during_effect = false;
          }
        }
      }
    } finally {
      is_updating_effect = was_updating_effect;
      active_effect = previous_effect;
      if (true_default) {
        set_dev_current_component_function(previous_component_fn);
        set_dev_stack(previous_stack);
      }
    }
  }
  function get2(signal) {
    var flags2 = signal.f;
    var is_derived = (flags2 & DERIVED) !== 0;
    captured_signals?.add(signal);
    if (active_reaction !== null && !untracking) {
      var destroyed = active_effect !== null && (active_effect.f & DESTROYED) !== 0;
      if (!destroyed && (current_sources === null || !includes.call(current_sources, signal))) {
        var deps = active_reaction.deps;
        if ((active_reaction.f & REACTION_IS_UPDATING) !== 0) {
          if (signal.rv < read_version) {
            signal.rv = read_version;
            if (new_deps === null && deps !== null && deps[skipped_deps] === signal) {
              skipped_deps++;
            } else if (new_deps === null) {
              new_deps = [signal];
            } else {
              new_deps.push(signal);
            }
          }
        } else {
          active_reaction.deps ??= [];
          if (!includes.call(active_reaction.deps, signal)) {
            active_reaction.deps.push(signal);
          }
          var reactions = signal.reactions;
          if (reactions === null) {
            signal.reactions = [active_reaction];
          } else if (!includes.call(reactions, active_reaction)) {
            reactions.push(active_reaction);
          }
        }
      }
    }
    if (true_default) {
      if (!untracking && reactivity_loss_tracker && !reactivity_loss_tracker.warned && (reactivity_loss_tracker.effect.f & REACTION_IS_UPDATING) === 0 && !reactivity_loss_tracker.effect_deps.has(signal)) {
        reactivity_loss_tracker.warned = true;
        await_reactivity_loss(signal.label);
        var trace = get_error("traced at");
        if (trace)
          console.warn(trace);
      }
      recent_async_deriveds.delete(signal);
      if (tracing_mode_flag && !untracking && tracing_expressions !== null && active_reaction !== null && tracing_expressions.reaction === active_reaction) {
        if (signal.trace) {
          signal.trace();
        } else {
          trace = get_error("traced at");
          if (trace) {
            var entry = tracing_expressions.entries.get(signal);
            if (entry === undefined) {
              entry = { traces: [] };
              tracing_expressions.entries.set(signal, entry);
            }
            var last = entry.traces[entry.traces.length - 1];
            if (trace.stack !== last?.stack) {
              entry.traces.push(trace);
            }
          }
        }
      }
    }
    if (is_destroying_effect && old_values.has(signal)) {
      return old_values.get(signal);
    }
    if (is_derived) {
      var derived2 = signal;
      if (is_destroying_effect) {
        var value = derived2.v;
        if ((derived2.f & CLEAN) === 0 && derived2.reactions !== null || depends_on_old_values(derived2)) {
          value = execute_derived(derived2);
        }
        old_values.set(derived2, value);
        return value;
      }
      var should_connect = (derived2.f & CONNECTED) === 0 && !untracking && active_reaction !== null && (is_updating_effect || (active_reaction.f & CONNECTED) !== 0);
      var is_new = (derived2.f & REACTION_RAN) === 0;
      if (is_dirty(derived2)) {
        if (should_connect) {
          derived2.f |= CONNECTED;
        }
        update_derived(derived2);
      }
      if (should_connect && !is_new) {
        unfreeze_derived_effects(derived2);
        reconnect(derived2);
      }
    }
    if (batch_values?.has(signal)) {
      return batch_values.get(signal);
    }
    if ((signal.f & ERROR_VALUE) !== 0) {
      throw signal.v;
    }
    return signal.v;
  }
  function reconnect(derived2) {
    derived2.f |= CONNECTED;
    if (derived2.deps === null)
      return;
    for (const dep of derived2.deps) {
      (dep.reactions ??= []).push(derived2);
      if ((dep.f & DERIVED) !== 0 && (dep.f & CONNECTED) === 0) {
        unfreeze_derived_effects(dep);
        reconnect(dep);
      }
    }
  }
  function depends_on_old_values(derived2) {
    if (derived2.v === UNINITIALIZED)
      return true;
    if (derived2.deps === null)
      return false;
    for (const dep of derived2.deps) {
      if (old_values.has(dep)) {
        return true;
      }
      if ((dep.f & DERIVED) !== 0 && depends_on_old_values(dep)) {
        return true;
      }
    }
    return false;
  }
  function untrack(fn) {
    var previous_untracking = untracking;
    try {
      untracking = true;
      return fn();
    } finally {
      untracking = previous_untracking;
    }
  }
  function deep_read_state(value) {
    if (typeof value !== "object" || !value || value instanceof EventTarget) {
      return;
    }
    if (STATE_SYMBOL in value) {
      deep_read(value);
    } else if (!Array.isArray(value)) {
      for (let key in value) {
        const prop = value[key];
        if (typeof prop === "object" && prop && STATE_SYMBOL in prop) {
          deep_read(prop);
        }
      }
    }
  }
  function deep_read(value, visited = new Set) {
    if (typeof value === "object" && value !== null && !(value instanceof EventTarget) && !visited.has(value)) {
      visited.add(value);
      if (value instanceof Date) {
        value.getTime();
      }
      for (let key in value) {
        try {
          deep_read(value[key], visited);
        } catch (e) {}
      }
      const proto = get_prototype_of(value);
      if (proto !== Object.prototype && proto !== Array.prototype && proto !== Map.prototype && proto !== Set.prototype && proto !== Date.prototype) {
        const descriptors = get_descriptors(proto);
        for (let key in descriptors) {
          const get3 = descriptors[key].get;
          if (get3) {
            try {
              get3.call(value);
            } catch (e) {}
          }
        }
      }
    }
  }
  // ../../node_modules/.bun/svelte@5.55.9/node_modules/svelte/src/utils.js
  var regex_return_characters = /\\r/g;
  function hash(str) {
    str = str.replace(regex_return_characters, "");
    let hash2 = 5381;
    let i = str.length;
    while (i--)
      hash2 = (hash2 << 5) - hash2 ^ str.charCodeAt(i);
    return (hash2 >>> 0).toString(36);
  }
  var DOM_BOOLEAN_ATTRIBUTES = [
    "allowfullscreen",
    "async",
    "autofocus",
    "autoplay",
    "checked",
    "controls",
    "default",
    "disabled",
    "formnovalidate",
    "indeterminate",
    "inert",
    "ismap",
    "loop",
    "multiple",
    "muted",
    "nomodule",
    "novalidate",
    "open",
    "playsinline",
    "readonly",
    "required",
    "reversed",
    "seamless",
    "selected",
    "webkitdirectory",
    "defer",
    "disablepictureinpicture",
    "disableremoteplayback"
  ];
  var DOM_PROPERTIES = [
    ...DOM_BOOLEAN_ATTRIBUTES,
    "formNoValidate",
    "isMap",
    "noModule",
    "playsInline",
    "readOnly",
    "value",
    "volume",
    "defaultValue",
    "defaultChecked",
    "srcObject",
    "noValidate",
    "allowFullscreen",
    "disablePictureInPicture",
    "disableRemotePlayback"
  ];
  var PASSIVE_EVENTS = ["touchstart", "touchmove"];
  function is_passive_event(name) {
    return PASSIVE_EVENTS.includes(name);
  }
  var STATE_CREATION_RUNES = [
    "$state",
    "$state.raw",
    "$derived",
    "$derived.by"
  ];
  var RUNES = [
    ...STATE_CREATION_RUNES,
    "$state.eager",
    "$state.snapshot",
    "$props",
    "$props.id",
    "$bindable",
    "$effect",
    "$effect.pre",
    "$effect.tracking",
    "$effect.root",
    "$effect.pending",
    "$inspect",
    "$inspect().with",
    "$inspect.trace",
    "$host"
  ];
  function sanitize_location(location) {
    return location?.replace(/\\//g, "/​");
  }
  // ../../node_modules/.bun/svelte@5.55.9/node_modules/svelte/src/internal/client/dev/css.js
  var all_styles = new Map;
  // ../../node_modules/.bun/svelte@5.55.9/node_modules/svelte/src/internal/client/dev/elements.js
  function add_locations(fn, filename, locations) {
    return (...args) => {
      const dom = fn(...args);
      var node = hydrating ? dom : dom.nodeType === DOCUMENT_FRAGMENT_NODE ? dom.firstChild : dom;
      assign_locations(node, filename, locations);
      return dom;
    };
  }
  function assign_location(element, filename, location) {
    element.__svelte_meta = {
      parent: dev_stack,
      loc: { file: filename, line: location[0], column: location[1] }
    };
    if (location[2]) {
      assign_locations(element.firstChild, filename, location[2]);
    }
  }
  function assign_locations(node, filename, locations) {
    var i = 0;
    var depth = 0;
    while (node && i < locations.length) {
      if (hydrating && node.nodeType === COMMENT_NODE) {
        var comment = node;
        if (comment.data[0] === HYDRATION_START)
          depth += 1;
        else if (comment.data[0] === HYDRATION_END)
          depth -= 1;
      }
      if (depth === 0 && node.nodeType === ELEMENT_NODE) {
        assign_location(node, filename, locations[i++]);
      }
      node = node.nextSibling;
    }
  }
  // ../../node_modules/.bun/svelte@5.55.9/node_modules/svelte/src/internal/client/dom/elements/events.js
  var event_symbol = Symbol("events");
  var all_registered_events = new Set;
  var root_event_handles = new Set;
  function create_event(event_name, dom, handler, options = {}) {
    function target_handler(event) {
      if (!options.capture) {
        handle_event_propagation.call(dom, event);
      }
      if (!event.cancelBubble) {
        return without_reactive_context(() => {
          return handler?.call(this, event);
        });
      }
    }
    if (event_name.startsWith("pointer") || event_name.startsWith("touch") || event_name === "wheel") {
      queue_micro_task(() => {
        dom.addEventListener(event_name, target_handler, options);
      });
    } else {
      dom.addEventListener(event_name, target_handler, options);
    }
    return target_handler;
  }
  function event(event_name, dom, handler, capture2, passive) {
    var options = { capture: capture2, passive };
    var target_handler = create_event(event_name, dom, handler, options);
    if (dom === document.body || dom === window || dom === document || dom instanceof HTMLMediaElement) {
      teardown(() => {
        dom.removeEventListener(event_name, target_handler, options);
      });
    }
  }
  function delegated(event_name, element, handler) {
    (element[event_symbol] ??= {})[event_name] = handler;
  }
  function delegate(events) {
    for (var i = 0;i < events.length; i++) {
      all_registered_events.add(events[i]);
    }
    for (var fn of root_event_handles) {
      fn(events);
    }
  }
  var last_propagated_event = null;
  function handle_event_propagation(event2) {
    var handler_element = this;
    var owner_document = handler_element.ownerDocument;
    var event_name = event2.type;
    var path = event2.composedPath?.() || [];
    var current_target = path[0] || event2.target;
    last_propagated_event = event2;
    var path_idx = 0;
    var handled_at = last_propagated_event === event2 && event2[event_symbol];
    if (handled_at) {
      var at_idx = path.indexOf(handled_at);
      if (at_idx !== -1 && (handler_element === document || handler_element === window)) {
        event2[event_symbol] = handler_element;
        return;
      }
      var handler_idx = path.indexOf(handler_element);
      if (handler_idx === -1) {
        return;
      }
      if (at_idx <= handler_idx) {
        path_idx = at_idx;
      }
    }
    current_target = path[path_idx] || event2.target;
    if (current_target === handler_element)
      return;
    define_property(event2, "currentTarget", {
      configurable: true,
      get() {
        return current_target || owner_document;
      }
    });
    var previous_reaction = active_reaction;
    var previous_effect = active_effect;
    set_active_reaction(null);
    set_active_effect(null);
    try {
      var throw_error;
      var other_errors = [];
      while (current_target !== null) {
        var parent_element = current_target.assignedSlot || current_target.parentNode || current_target.host || null;
        try {
          var delegated2 = current_target[event_symbol]?.[event_name];
          if (delegated2 != null && (!current_target.disabled || event2.target === current_target)) {
            delegated2.call(current_target, event2);
          }
        } catch (error) {
          if (throw_error) {
            other_errors.push(error);
          } else {
            throw_error = error;
          }
        }
        if (event2.cancelBubble || parent_element === handler_element || parent_element === null) {
          break;
        }
        current_target = parent_element;
      }
      if (throw_error) {
        for (let error of other_errors) {
          queueMicrotask(() => {
            throw error;
          });
        }
        throw throw_error;
      }
    } finally {
      event2[event_symbol] = handler_element;
      delete event2.currentTarget;
      set_active_reaction(previous_reaction);
      set_active_effect(previous_effect);
    }
  }
  function apply(thunk, element, args, component, loc, has_side_effects = false, remove_parens = false) {
    let handler;
    let error;
    try {
      handler = thunk();
    } catch (e) {
      error = e;
    }
    if (typeof handler !== "function" && (has_side_effects || handler != null || error)) {
      const filename = component?.[FILENAME];
      const location = loc ? \` at \${filename}:\${loc[0]}:\${loc[1]}\` : \` in \${filename}\`;
      const phase = args[0]?.eventPhase < Event.BUBBLING_PHASE ? "capture" : "";
      const event_name = args[0]?.type + phase;
      const description = \`\\\`\${event_name}\\\` handler\${location}\`;
      const suggestion = remove_parens ? "remove the trailing \`()\`" : "add a leading \`() =>\`";
      event_handler_invalid(description, suggestion);
      if (error) {
        throw error;
      }
    }
    handler?.apply(element, args);
  }

  // ../../node_modules/.bun/svelte@5.55.9/node_modules/svelte/src/internal/client/dom/reconciler.js
  var policy = globalThis?.window?.trustedTypes && /* @__PURE__ */ globalThis.window.trustedTypes.createPolicy("svelte-trusted-html", {
    createHTML: (html) => {
      return html;
    }
  });
  function create_trusted_html(html) {
    return policy?.createHTML(html) ?? html;
  }
  function create_fragment_from_html(html) {
    var elem = create_element("template");
    elem.innerHTML = create_trusted_html(html.replaceAll("<!>", "<!---->"));
    return elem.content;
  }

  // ../../node_modules/.bun/svelte@5.55.9/node_modules/svelte/src/internal/client/dom/template.js
  function assign_nodes(start, end) {
    var effect = active_effect;
    if (effect.nodes === null) {
      effect.nodes = { start, end, a: null, t: null };
    }
  }
  function from_html(content, flags2) {
    var is_fragment = (flags2 & TEMPLATE_FRAGMENT) !== 0;
    var use_import_node = (flags2 & TEMPLATE_USE_IMPORT_NODE) !== 0;
    var node;
    var has_start = !content.startsWith("<!>");
    return () => {
      if (hydrating) {
        assign_nodes(hydrate_node, null);
        return hydrate_node;
      }
      if (node === undefined) {
        node = create_fragment_from_html(has_start ? content : "<!>" + content);
        if (!is_fragment)
          node = get_first_child(node);
      }
      var clone2 = use_import_node || is_firefox ? document.importNode(node, true) : node.cloneNode(true);
      if (is_fragment) {
        var start = get_first_child(clone2);
        var end = clone2.lastChild;
        assign_nodes(start, end);
      } else {
        assign_nodes(clone2, clone2);
      }
      return clone2;
    };
  }
  function append(anchor, dom) {
    if (hydrating) {
      var effect = active_effect;
      if ((effect.f & REACTION_RAN) === 0 || effect.nodes.end === null) {
        effect.nodes.end = hydrate_node;
      }
      hydrate_next();
      return;
    }
    if (anchor === null) {
      return;
    }
    anchor.before(dom);
  }

  // ../../node_modules/.bun/svelte@5.55.9/node_modules/svelte/src/internal/client/render.js
  var should_intro = true;
  function set_text(text, value) {
    var str = value == null ? "" : typeof value === "object" ? \`\${value}\` : value;
    if (str !== (text[TEXT_CACHE] ??= text.nodeValue)) {
      text[TEXT_CACHE] = str;
      text.nodeValue = \`\${str}\`;
    }
  }
  function mount(component, options) {
    return _mount(component, options);
  }
  function hydrate(component, options) {
    init_operations();
    options.intro = options.intro ?? false;
    const target = options.target;
    const was_hydrating = hydrating;
    const previous_hydrate_node = hydrate_node;
    try {
      var anchor = get_first_child(target);
      while (anchor && (anchor.nodeType !== COMMENT_NODE || anchor.data !== HYDRATION_START)) {
        anchor = get_next_sibling(anchor);
      }
      if (!anchor) {
        throw HYDRATION_ERROR;
      }
      set_hydrating(true);
      set_hydrate_node(anchor);
      const instance = _mount(component, { ...options, anchor });
      set_hydrating(false);
      return instance;
    } catch (error) {
      if (error instanceof Error && error.message.split(\`
\`).some((line) => line.startsWith("https://svelte.dev/e/"))) {
        throw error;
      }
      if (error !== HYDRATION_ERROR) {
        console.warn("Failed to hydrate: ", error);
      }
      if (options.recover === false) {
        hydration_failed();
      }
      init_operations();
      clear_text_content(target);
      set_hydrating(false);
      return mount(component, options);
    } finally {
      set_hydrating(was_hydrating);
      set_hydrate_node(previous_hydrate_node);
    }
  }
  var listeners = new Map;
  function _mount(Component, { target, anchor, props = {}, events, context, intro = true, transformError }) {
    init_operations();
    var component = undefined;
    var unmount = component_root(() => {
      var anchor_node = anchor ?? target.appendChild(create_text());
      boundary(anchor_node, {
        pending: () => {}
      }, (anchor_node2) => {
        push({});
        var ctx = component_context;
        if (context)
          ctx.c = context;
        if (events) {
          props.$$events = events;
        }
        if (hydrating) {
          assign_nodes(anchor_node2, null);
        }
        should_intro = intro;
        component = Component(anchor_node2, props) || {};
        should_intro = true;
        if (hydrating) {
          active_effect.nodes.end = hydrate_node;
          if (hydrate_node === null || hydrate_node.nodeType !== COMMENT_NODE || hydrate_node.data !== HYDRATION_END) {
            hydration_mismatch();
            throw HYDRATION_ERROR;
          }
        }
        pop();
      }, transformError);
      var registered_events = new Set;
      var event_handle = (events2) => {
        for (var i = 0;i < events2.length; i++) {
          var event_name = events2[i];
          if (registered_events.has(event_name))
            continue;
          registered_events.add(event_name);
          var passive = is_passive_event(event_name);
          for (const node of [target, document]) {
            var counts = listeners.get(node);
            if (counts === undefined) {
              counts = new Map;
              listeners.set(node, counts);
            }
            var count = counts.get(event_name);
            if (count === undefined) {
              node.addEventListener(event_name, handle_event_propagation, { passive });
              counts.set(event_name, 1);
            } else {
              counts.set(event_name, count + 1);
            }
          }
        }
      };
      event_handle(array_from(all_registered_events));
      root_event_handles.add(event_handle);
      return () => {
        for (var event_name of registered_events) {
          for (const node of [target, document]) {
            var counts = listeners.get(node);
            var count = counts.get(event_name);
            if (--count == 0) {
              node.removeEventListener(event_name, handle_event_propagation);
              counts.delete(event_name);
              if (counts.size === 0) {
                listeners.delete(node);
              }
            } else {
              counts.set(event_name, count);
            }
          }
        }
        root_event_handles.delete(event_handle);
        if (anchor_node !== anchor) {
          anchor_node.parentNode?.removeChild(anchor_node);
        }
      };
    });
    mounted_components.set(component, unmount);
    return component;
  }
  var mounted_components = new WeakMap;
  function unmount(component, options) {
    const fn = mounted_components.get(component);
    if (fn) {
      mounted_components.delete(component);
      return fn(options);
    }
    if (true_default) {
      if (STATE_SYMBOL in component) {
        state_proxy_unmount();
      } else {
        lifecycle_double_unmount();
      }
    }
    return Promise.resolve();
  }
  // ../../node_modules/.bun/svelte@5.55.9/node_modules/svelte/src/internal/client/dev/legacy.js
  function check_target(target) {
    if (target) {
      component_api_invalid_new(target[FILENAME] ?? "a component", target.name);
    }
  }
  function legacy_api() {
    const component = component_context?.function;
    function error(method) {
      component_api_changed(method, component[FILENAME]);
    }
    return {
      $destroy: () => error("$destroy()"),
      $on: () => error("$on(...)"),
      $set: () => error("$set(...)")
    };
  }
  // ../../node_modules/.bun/svelte@5.55.9/node_modules/svelte/src/internal/client/dom/blocks/branches.js
  class BranchManager {
    anchor;
    #batches = new Map;
    #onscreen = new Map;
    #offscreen = new Map;
    #outroing = new Set;
    #transition = true;
    constructor(anchor, transition = true) {
      this.anchor = anchor;
      this.#transition = transition;
    }
    #commit = (batch) => {
      if (!this.#batches.has(batch))
        return;
      var key = this.#batches.get(batch);
      var onscreen = this.#onscreen.get(key);
      if (onscreen) {
        resume_effect(onscreen);
        this.#outroing.delete(key);
      } else {
        var offscreen = this.#offscreen.get(key);
        if (offscreen) {
          this.#onscreen.set(key, offscreen.effect);
          this.#offscreen.delete(key);
          if (true_default) {
            offscreen.fragment.lastChild[HMR_ANCHOR] = this.anchor;
          }
          offscreen.fragment.lastChild.remove();
          this.anchor.before(offscreen.fragment);
          onscreen = offscreen.effect;
        }
      }
      for (const [b, k] of this.#batches) {
        this.#batches.delete(b);
        if (b === batch) {
          break;
        }
        const offscreen2 = this.#offscreen.get(k);
        if (offscreen2) {
          destroy_effect(offscreen2.effect);
          this.#offscreen.delete(k);
        }
      }
      for (const [k, effect] of this.#onscreen) {
        if (k === key || this.#outroing.has(k))
          continue;
        const on_destroy = () => {
          const keys = Array.from(this.#batches.values());
          if (keys.includes(k)) {
            var fragment = document.createDocumentFragment();
            move_effect(effect, fragment);
            fragment.append(create_text());
            this.#offscreen.set(k, { effect, fragment });
          } else {
            destroy_effect(effect);
          }
          this.#outroing.delete(k);
          this.#onscreen.delete(k);
        };
        if (this.#transition || !onscreen) {
          this.#outroing.add(k);
          pause_effect(effect, on_destroy, false);
        } else {
          on_destroy();
        }
      }
    };
    #discard = (batch) => {
      this.#batches.delete(batch);
      const keys = Array.from(this.#batches.values());
      for (const [k, branch2] of this.#offscreen) {
        if (!keys.includes(k)) {
          destroy_effect(branch2.effect);
          this.#offscreen.delete(k);
        }
      }
    };
    ensure(key, fn) {
      var batch = current_batch;
      var defer = should_defer_append();
      if (fn && !this.#onscreen.has(key) && !this.#offscreen.has(key)) {
        if (defer) {
          var fragment = document.createDocumentFragment();
          var target = create_text();
          fragment.append(target);
          this.#offscreen.set(key, {
            effect: branch(() => fn(target)),
            fragment
          });
        } else {
          this.#onscreen.set(key, branch(() => fn(this.anchor)));
        }
      }
      this.#batches.set(batch, key);
      if (defer) {
        for (const [k, effect] of this.#onscreen) {
          if (k === key) {
            batch.unskip_effect(effect);
          } else {
            batch.skip_effect(effect);
          }
        }
        for (const [k, branch2] of this.#offscreen) {
          if (k === key) {
            batch.unskip_effect(branch2.effect);
          } else {
            batch.skip_effect(branch2.effect);
          }
        }
        batch.oncommit(this.#commit);
        batch.ondiscard(this.#discard);
      } else {
        if (hydrating) {
          this.anchor = hydrate_node;
        }
        this.#commit(batch);
      }
    }
  }
  // ../../node_modules/.bun/svelte@5.55.9/node_modules/svelte/src/internal/client/dom/blocks/if.js
  function if_block(node, fn, elseif = false) {
    var marker;
    if (hydrating) {
      marker = hydrate_node;
      hydrate_next();
    }
    var branches = new BranchManager(node);
    var flags2 = elseif ? EFFECT_TRANSPARENT : 0;
    function update_branch(key, fn2) {
      if (hydrating) {
        var data = read_hydration_instruction(marker);
        if (key !== parseInt(data.substring(1))) {
          var anchor = skip_nodes();
          set_hydrate_node(anchor);
          branches.anchor = anchor;
          set_hydrating(false);
          branches.ensure(key, fn2);
          set_hydrating(true);
          return;
        }
      }
      branches.ensure(key, fn2);
    }
    block(() => {
      var has_branch = false;
      fn((fn2, key = 0) => {
        has_branch = true;
        update_branch(key, fn2);
      });
      if (!has_branch) {
        update_branch(-1, null);
      }
    }, flags2);
  }
  // ../../node_modules/.bun/svelte@5.55.9/node_modules/svelte/src/internal/client/dom/blocks/key.js
  var NAN = Symbol("NaN");
  // ../../node_modules/.bun/svelte@5.55.9/node_modules/svelte/src/internal/client/dom/blocks/each.js
  function pause_effects(state2, to_destroy, controlled_anchor) {
    var transitions = [];
    var length = to_destroy.length;
    var group;
    var remaining = to_destroy.length;
    for (var i = 0;i < length; i++) {
      let effect = to_destroy[i];
      pause_effect(effect, () => {
        if (group) {
          group.pending.delete(effect);
          group.done.add(effect);
          if (group.pending.size === 0) {
            var groups = state2.outrogroups;
            destroy_effects(state2, array_from(group.done));
            groups.delete(group);
            if (groups.size === 0) {
              state2.outrogroups = null;
            }
          }
        } else {
          remaining -= 1;
        }
      }, false);
    }
    if (remaining === 0) {
      var fast_path = transitions.length === 0 && controlled_anchor !== null;
      if (fast_path) {
        var anchor = controlled_anchor;
        var parent_node = anchor.parentNode;
        clear_text_content(parent_node);
        parent_node.append(anchor);
        state2.items.clear();
      }
      destroy_effects(state2, to_destroy, !fast_path);
    } else {
      group = {
        pending: new Set(to_destroy),
        done: new Set
      };
      (state2.outrogroups ??= new Set).add(group);
    }
  }
  function destroy_effects(state2, to_destroy, remove_dom = true) {
    var preserved_effects;
    if (state2.pending.size > 0) {
      preserved_effects = new Set;
      for (const keys of state2.pending.values()) {
        for (const key of keys) {
          preserved_effects.add(state2.items.get(key).e);
        }
      }
    }
    for (var i = 0;i < to_destroy.length; i++) {
      var e = to_destroy[i];
      if (preserved_effects?.has(e)) {
        e.f |= EFFECT_OFFSCREEN;
        const fragment = document.createDocumentFragment();
        move_effect(e, fragment);
      } else {
        destroy_effect(to_destroy[i], remove_dom);
      }
    }
  }
  var offscreen_anchor;
  function each(node, flags2, get_collection, get_key, render_fn, fallback_fn = null) {
    var anchor = node;
    var items = new Map;
    var is_controlled = (flags2 & EACH_IS_CONTROLLED) !== 0;
    if (is_controlled) {
      var parent_node = node;
      anchor = hydrating ? set_hydrate_node(get_first_child(parent_node)) : parent_node.appendChild(create_text());
    }
    if (hydrating) {
      hydrate_next();
    }
    var fallback = null;
    var each_array = derived_safe_equal(() => {
      var collection = get_collection();
      return is_array(collection) ? collection : collection == null ? [] : array_from(collection);
    });
    if (true_default) {
      tag(each_array, "{#each ...}");
    }
    var array;
    var pending = new Map;
    var first_run = true;
    function commit(batch) {
      if ((state2.effect.f & DESTROYED) !== 0) {
        return;
      }
      state2.pending.delete(batch);
      state2.fallback = fallback;
      reconcile(state2, array, anchor, flags2, get_key);
      if (fallback !== null) {
        if (array.length === 0) {
          if ((fallback.f & EFFECT_OFFSCREEN) === 0) {
            resume_effect(fallback);
          } else {
            fallback.f ^= EFFECT_OFFSCREEN;
            move(fallback, null, anchor);
          }
        } else {
          pause_effect(fallback, () => {
            fallback = null;
          });
        }
      }
    }
    function discard(batch) {
      state2.pending.delete(batch);
    }
    var effect = block(() => {
      array = get2(each_array);
      var length = array.length;
      let mismatch = false;
      if (hydrating) {
        var is_else = read_hydration_instruction(anchor) === HYDRATION_START_ELSE;
        if (is_else !== (length === 0)) {
          anchor = skip_nodes();
          set_hydrate_node(anchor);
          set_hydrating(false);
          mismatch = true;
        }
      }
      var keys = new Set;
      var batch = current_batch;
      var defer = should_defer_append();
      for (var index = 0;index < length; index += 1) {
        if (hydrating && hydrate_node.nodeType === COMMENT_NODE && hydrate_node.data === HYDRATION_END) {
          anchor = hydrate_node;
          mismatch = true;
          set_hydrating(false);
        }
        var value = array[index];
        var key = get_key(value, index);
        if (true_default) {
          var key_again = get_key(value, index);
          if (key !== key_again) {
            each_key_volatile(String(index), String(key), String(key_again));
          }
        }
        var item = first_run ? null : items.get(key);
        if (item) {
          if (item.v)
            internal_set(item.v, value);
          if (item.i)
            internal_set(item.i, index);
          if (defer) {
            batch.unskip_effect(item.e);
          }
        } else {
          item = create_item(items, first_run ? anchor : offscreen_anchor ??= create_text(), value, key, index, render_fn, flags2, get_collection);
          if (!first_run) {
            item.e.f |= EFFECT_OFFSCREEN;
          }
          items.set(key, item);
        }
        keys.add(key);
      }
      if (length === 0 && fallback_fn && !fallback) {
        if (first_run) {
          fallback = branch(() => fallback_fn(anchor));
        } else {
          fallback = branch(() => fallback_fn(offscreen_anchor ??= create_text()));
          fallback.f |= EFFECT_OFFSCREEN;
        }
      }
      if (length > keys.size) {
        if (true_default) {
          validate_each_keys(array, get_key);
        } else {
          each_key_duplicate("", "", "");
        }
      }
      if (hydrating && length > 0) {
        set_hydrate_node(skip_nodes());
      }
      if (!first_run) {
        pending.set(batch, keys);
        if (defer) {
          for (const [key2, item2] of items) {
            if (!keys.has(key2)) {
              batch.skip_effect(item2.e);
            }
          }
          batch.oncommit(commit);
          batch.ondiscard(discard);
        } else {
          commit(batch);
        }
      }
      if (mismatch) {
        set_hydrating(true);
      }
      get2(each_array);
    });
    var state2 = { effect, flags: flags2, items, pending, outrogroups: null, fallback };
    first_run = false;
    if (hydrating) {
      anchor = hydrate_node;
    }
  }
  function skip_to_branch(effect) {
    while (effect !== null && (effect.f & BRANCH_EFFECT) === 0) {
      effect = effect.next;
    }
    return effect;
  }
  function reconcile(state2, array, anchor, flags2, get_key) {
    var is_animated = (flags2 & EACH_IS_ANIMATED) !== 0;
    var length = array.length;
    var items = state2.items;
    var current = skip_to_branch(state2.effect.first);
    var seen;
    var prev = null;
    var to_animate;
    var matched = [];
    var stashed = [];
    var value;
    var key;
    var effect;
    var i;
    if (is_animated) {
      for (i = 0;i < length; i += 1) {
        value = array[i];
        key = get_key(value, i);
        effect = items.get(key).e;
        if ((effect.f & EFFECT_OFFSCREEN) === 0) {
          effect.nodes?.a?.measure();
          (to_animate ??= new Set).add(effect);
        }
      }
    }
    for (i = 0;i < length; i += 1) {
      value = array[i];
      key = get_key(value, i);
      effect = items.get(key).e;
      if (state2.outrogroups !== null) {
        for (const group of state2.outrogroups) {
          group.pending.delete(effect);
          group.done.delete(effect);
        }
      }
      if ((effect.f & INERT) !== 0) {
        resume_effect(effect);
        if (is_animated) {
          effect.nodes?.a?.unfix();
          (to_animate ??= new Set).delete(effect);
        }
      }
      if ((effect.f & EFFECT_OFFSCREEN) !== 0) {
        effect.f ^= EFFECT_OFFSCREEN;
        if (effect === current) {
          move(effect, null, anchor);
        } else {
          var next2 = prev ? prev.next : current;
          if (effect === state2.effect.last) {
            state2.effect.last = effect.prev;
          }
          if (effect.prev)
            effect.prev.next = effect.next;
          if (effect.next)
            effect.next.prev = effect.prev;
          link(state2, prev, effect);
          link(state2, effect, next2);
          move(effect, next2, anchor);
          prev = effect;
          matched = [];
          stashed = [];
          current = skip_to_branch(prev.next);
          continue;
        }
      }
      if (effect !== current) {
        if (seen !== undefined && seen.has(effect)) {
          if (matched.length < stashed.length) {
            var start = stashed[0];
            var j;
            prev = start.prev;
            var a = matched[0];
            var b = matched[matched.length - 1];
            for (j = 0;j < matched.length; j += 1) {
              move(matched[j], start, anchor);
            }
            for (j = 0;j < stashed.length; j += 1) {
              seen.delete(stashed[j]);
            }
            link(state2, a.prev, b.next);
            link(state2, prev, a);
            link(state2, b, start);
            current = start;
            prev = b;
            i -= 1;
            matched = [];
            stashed = [];
          } else {
            seen.delete(effect);
            move(effect, current, anchor);
            link(state2, effect.prev, effect.next);
            link(state2, effect, prev === null ? state2.effect.first : prev.next);
            link(state2, prev, effect);
            prev = effect;
          }
          continue;
        }
        matched = [];
        stashed = [];
        while (current !== null && current !== effect) {
          (seen ??= new Set).add(current);
          stashed.push(current);
          current = skip_to_branch(current.next);
        }
        if (current === null) {
          continue;
        }
      }
      if ((effect.f & EFFECT_OFFSCREEN) === 0) {
        matched.push(effect);
      }
      prev = effect;
      current = skip_to_branch(effect.next);
    }
    if (state2.outrogroups !== null) {
      for (const group of state2.outrogroups) {
        if (group.pending.size === 0) {
          destroy_effects(state2, array_from(group.done));
          state2.outrogroups?.delete(group);
        }
      }
      if (state2.outrogroups.size === 0) {
        state2.outrogroups = null;
      }
    }
    if (current !== null || seen !== undefined) {
      var to_destroy = [];
      if (seen !== undefined) {
        for (effect of seen) {
          if ((effect.f & INERT) === 0) {
            to_destroy.push(effect);
          }
        }
      }
      while (current !== null) {
        if ((current.f & INERT) === 0 && current !== state2.fallback) {
          to_destroy.push(current);
        }
        current = skip_to_branch(current.next);
      }
      var destroy_length = to_destroy.length;
      if (destroy_length > 0) {
        var controlled_anchor = (flags2 & EACH_IS_CONTROLLED) !== 0 && length === 0 ? anchor : null;
        if (is_animated) {
          for (i = 0;i < destroy_length; i += 1) {
            to_destroy[i].nodes?.a?.measure();
          }
          for (i = 0;i < destroy_length; i += 1) {
            to_destroy[i].nodes?.a?.fix();
          }
        }
        pause_effects(state2, to_destroy, controlled_anchor);
      }
    }
    if (is_animated) {
      queue_micro_task(() => {
        if (to_animate === undefined)
          return;
        for (effect of to_animate) {
          effect.nodes?.a?.apply();
        }
      });
    }
  }
  function create_item(items, anchor, value, key, index, render_fn, flags2, get_collection) {
    var v = (flags2 & EACH_ITEM_REACTIVE) !== 0 ? (flags2 & EACH_ITEM_IMMUTABLE) === 0 ? mutable_source(value, false, false) : source(value) : null;
    var i = (flags2 & EACH_INDEX_REACTIVE) !== 0 ? source(index) : null;
    if (true_default && v) {
      v.trace = () => {
        get_collection()[i?.v ?? index];
      };
    }
    return {
      v,
      i,
      e: branch(() => {
        render_fn(anchor, v ?? value, i ?? index, get_collection);
        return () => {
          items.delete(key);
        };
      })
    };
  }
  function move(effect, next2, anchor) {
    if (!effect.nodes)
      return;
    var node = effect.nodes.start;
    var end = effect.nodes.end;
    var dest = next2 && (next2.f & EFFECT_OFFSCREEN) === 0 ? next2.nodes.start : anchor;
    while (node !== null) {
      var next_node = get_next_sibling(node);
      dest.before(node);
      if (node === end) {
        return;
      }
      node = next_node;
    }
  }
  function link(state2, prev, next2) {
    if (prev === null) {
      state2.effect.first = next2;
    } else {
      prev.next = next2;
    }
    if (next2 === null) {
      state2.effect.last = prev;
    } else {
      next2.prev = prev;
    }
  }
  function validate_each_keys(array, key_fn) {
    const keys = new Map;
    const length = array.length;
    for (let i = 0;i < length; i++) {
      const key = key_fn(array[i], i);
      if (keys.has(key)) {
        const a = String(keys.get(key));
        const b = String(i);
        let k = String(key);
        if (k.startsWith("[object "))
          k = null;
        each_key_duplicate(a, b, k);
      }
      keys.set(key, i);
    }
  }
  // ../../node_modules/.bun/svelte@5.55.9/node_modules/svelte/src/internal/client/dom/blocks/html.js
  function check_hash(element, server_hash, value) {
    if (!server_hash || server_hash === hash(String(value ?? "")))
      return;
    let location;
    const loc = element.__svelte_meta?.loc;
    if (loc) {
      location = \`near \${loc.file}:\${loc.line}:\${loc.column}\`;
    } else if (dev_current_component_function?.[FILENAME]) {
      location = \`in \${dev_current_component_function[FILENAME]}\`;
    }
    hydration_html_changed(sanitize_location(location));
  }
  function html(node, get_value, is_controlled = false, svg = false, mathml = false, skip_warning = false) {
    var anchor = node;
    var value = "";
    if (is_controlled) {
      var parent_node = node;
      if (hydrating) {
        anchor = set_hydrate_node(get_first_child(parent_node));
      }
    }
    template_effect(() => {
      var effect = active_effect;
      if (value === (value = get_value() ?? "")) {
        if (hydrating)
          hydrate_next();
        return;
      }
      if (is_controlled && !hydrating) {
        effect.nodes = null;
        parent_node.innerHTML = value;
        if (value !== "") {
          assign_nodes(get_first_child(parent_node), parent_node.lastChild);
        }
        return;
      }
      if (effect.nodes !== null) {
        remove_effect_dom(effect.nodes.start, effect.nodes.end);
        effect.nodes = null;
      }
      if (value === "")
        return;
      if (hydrating) {
        var hash2 = hydrate_node.data;
        var next2 = hydrate_next();
        var last = next2;
        while (next2 !== null && (next2.nodeType !== COMMENT_NODE || next2.data !== "")) {
          last = next2;
          next2 = get_next_sibling(next2);
        }
        if (next2 === null) {
          hydration_mismatch();
          throw HYDRATION_ERROR;
        }
        if (true_default && !skip_warning) {
          check_hash(next2.parentNode, hash2, value);
        }
        assign_nodes(hydrate_node, last);
        anchor = set_hydrate_node(next2);
        return;
      }
      var ns = svg ? NAMESPACE_SVG : mathml ? NAMESPACE_MATHML : undefined;
      var wrapper = create_element(svg ? "svg" : mathml ? "math" : "template", ns);
      wrapper.innerHTML = value;
      var node2 = svg || mathml ? wrapper : wrapper.content;
      assign_nodes(get_first_child(node2), node2.lastChild);
      if (svg || mathml) {
        while (get_first_child(node2)) {
          anchor.before(get_first_child(node2));
        }
      } else {
        anchor.before(node2);
      }
    });
  }
  // ../../node_modules/.bun/svelte@5.55.9/node_modules/svelte/src/internal/client/timing.js
  var now = true_default ? () => performance.now() : () => Date.now();
  var raf = {
    tick: (_) => (true_default ? requestAnimationFrame : noop)(_),
    now: () => now(),
    tasks: new Set
  };
  // ../../node_modules/.bun/svelte@5.55.9/node_modules/svelte/src/internal/shared/attributes.js
  var replacements = {
    translate: new Map([
      [true, "yes"],
      [false, "no"]
    ])
  };
  var whitespace = [...\` 	
\\r\\f \\v\\uFEFF\`];
  function to_class(value, hash2, directives) {
    var classname = value == null ? "" : "" + value;
    if (hash2) {
      classname = classname ? classname + " " + hash2 : hash2;
    }
    if (directives) {
      for (var key of Object.keys(directives)) {
        if (directives[key]) {
          classname = classname ? classname + " " + key : key;
        } else if (classname.length) {
          var len = key.length;
          var a = 0;
          while ((a = classname.indexOf(key, a)) >= 0) {
            var b = a + len;
            if ((a === 0 || whitespace.includes(classname[a - 1])) && (b === classname.length || whitespace.includes(classname[b]))) {
              classname = (a === 0 ? "" : classname.substring(0, a)) + classname.substring(b + 1);
            } else {
              a = b;
            }
          }
        }
      }
    }
    return classname === "" ? null : classname;
  }

  // ../../node_modules/.bun/svelte@5.55.9/node_modules/svelte/src/internal/client/dom/elements/class.js
  function set_class(dom, is_html, value, hash2, prev_classes, next_classes) {
    var prev = dom[CLASS_CACHE];
    if (hydrating || prev !== value || prev === undefined) {
      var next_class_name = to_class(value, hash2, next_classes);
      if (!hydrating || next_class_name !== dom.getAttribute("class")) {
        if (next_class_name == null) {
          dom.removeAttribute("class");
        } else if (is_html) {
          dom.className = next_class_name;
        } else {
          dom.setAttribute("class", next_class_name);
        }
      }
      dom[CLASS_CACHE] = value;
    } else if (next_classes && prev_classes !== next_classes) {
      for (var key in next_classes) {
        var is_present = !!next_classes[key];
        if (prev_classes == null || is_present !== !!prev_classes[key]) {
          dom.classList.toggle(key, is_present);
        }
      }
    }
    return next_classes;
  }

  // ../../node_modules/.bun/svelte@5.55.9/node_modules/svelte/src/internal/client/dom/elements/attributes.js
  var CLASS = Symbol("class");
  var STYLE = Symbol("style");
  var IS_CUSTOM_ELEMENT = Symbol("is custom element");
  var IS_HTML = Symbol("is html");
  var LINK_TAG = IS_XHTML ? "link" : "LINK";
  var PROGRESS_TAG = IS_XHTML ? "progress" : "PROGRESS";
  function remove_input_defaults(input) {
    if (!hydrating)
      return;
    var already_removed = false;
    var remove_defaults = () => {
      if (already_removed)
        return;
      already_removed = true;
      if (input.hasAttribute("value")) {
        var value = input.value;
        set_attribute2(input, "value", null);
        input.value = value;
      }
      if (input.hasAttribute("checked")) {
        var checked = input.checked;
        set_attribute2(input, "checked", null);
        input.checked = checked;
      }
    };
    input[FORM_RESET_HANDLER] = remove_defaults;
    queue_micro_task(remove_defaults);
    add_form_reset_listener();
  }
  function set_value(element, value) {
    var attributes = get_attributes(element);
    if (attributes.value === (attributes.value = value ?? undefined) || element.value === value && (value !== 0 || element.nodeName !== PROGRESS_TAG)) {
      return;
    }
    element.value = value ?? "";
  }
  function set_attribute2(element, attribute, value, skip_warning) {
    var attributes = get_attributes(element);
    if (hydrating) {
      attributes[attribute] = element.getAttribute(attribute);
      if (attribute === "src" || attribute === "srcset" || attribute === "href" && element.nodeName === LINK_TAG) {
        if (!skip_warning) {
          check_src_in_dev_hydration(element, attribute, value ?? "");
        }
        return;
      }
    }
    if (attributes[attribute] === (attributes[attribute] = value))
      return;
    if (attribute === "loading") {
      element[LOADING_ATTR_SYMBOL] = value;
    }
    if (value == null) {
      element.removeAttribute(attribute);
    } else if (typeof value !== "string" && get_setters(element).includes(attribute)) {
      element[attribute] = value;
    } else {
      element.setAttribute(attribute, value);
    }
  }
  function get_attributes(element) {
    return element[ATTRIBUTES_CACHE] ??= {
      [IS_CUSTOM_ELEMENT]: element.nodeName.includes("-"),
      [IS_HTML]: element.namespaceURI === NAMESPACE_HTML
    };
  }
  var setters_cache = new Map;
  function get_setters(element) {
    var cache_key = element.getAttribute("is") || element.nodeName;
    var setters = setters_cache.get(cache_key);
    if (setters)
      return setters;
    setters_cache.set(cache_key, setters = []);
    var descriptors;
    var proto = element;
    var element_proto = Element.prototype;
    while (element_proto !== proto) {
      descriptors = get_descriptors(proto);
      for (var key in descriptors) {
        if (descriptors[key].set && key !== "innerHTML" && key !== "textContent" && key !== "innerText") {
          setters.push(key);
        }
      }
      proto = get_prototype_of(proto);
    }
    return setters;
  }
  function check_src_in_dev_hydration(element, attribute, value) {
    if (!true_default)
      return;
    if (attribute === "srcset" && srcset_url_equal(element, value))
      return;
    if (src_url_equal(element.getAttribute(attribute) ?? "", value))
      return;
    hydration_attribute_changed(attribute, element.outerHTML.replace(element.innerHTML, element.innerHTML && "..."), String(value));
  }
  function src_url_equal(element_src, url) {
    if (element_src === url)
      return true;
    return new URL(element_src, document.baseURI).href === new URL(url, document.baseURI).href;
  }
  function split_srcset(srcset) {
    return srcset.split(",").map((src) => src.trim().split(" ").filter(Boolean));
  }
  function srcset_url_equal(element, srcset) {
    var element_urls = split_srcset(element.srcset);
    var urls = split_srcset(srcset);
    return urls.length === element_urls.length && urls.every(([url, width], i) => width === element_urls[i][1] && (src_url_equal(element_urls[i][0], url) || src_url_equal(url, element_urls[i][0])));
  }
  // ../../node_modules/.bun/svelte@5.55.9/node_modules/svelte/src/internal/client/dom/elements/bindings/input.js
  var pending = new Set;
  // ../../node_modules/.bun/svelte@5.55.9/node_modules/svelte/src/internal/client/dom/elements/bindings/size.js
  class ResizeObserverSingleton {
    #listeners = new WeakMap;
    #observer;
    #options;
    static entries = new WeakMap;
    constructor(options) {
      this.#options = options;
    }
    observe(element, listener) {
      var listeners2 = this.#listeners.get(element) || new Set;
      listeners2.add(listener);
      this.#listeners.set(element, listeners2);
      this.#getObserver().observe(element, this.#options);
      return () => {
        var listeners3 = this.#listeners.get(element);
        listeners3.delete(listener);
        if (listeners3.size === 0) {
          this.#listeners.delete(element);
          this.#observer.unobserve(element);
        }
      };
    }
    #getObserver() {
      return this.#observer ?? (this.#observer = new ResizeObserver((entries) => {
        for (var entry of entries) {
          ResizeObserverSingleton.entries.set(entry.target, entry);
          for (var listener of this.#listeners.get(entry.target) || []) {
            listener(entry);
          }
        }
      }));
    }
  }
  // ../../node_modules/.bun/svelte@5.55.9/node_modules/svelte/src/internal/client/dom/legacy/lifecycle.js
  function init(immutable = false) {
    const context = component_context;
    const callbacks = context.l.u;
    if (!callbacks)
      return;
    let props = () => deep_read_state(context.s);
    if (immutable) {
      let version = 0;
      let prev = {};
      const d = derived(() => {
        let changed = false;
        const props2 = context.s;
        for (const key in props2) {
          if (props2[key] !== prev[key]) {
            prev[key] = props2[key];
            changed = true;
          }
        }
        if (changed)
          version++;
        return version;
      });
      props = () => get2(d);
    }
    if (callbacks.b.length) {
      user_pre_effect(() => {
        observe_all(context, props);
        run_all(callbacks.b);
      });
    }
    user_effect(() => {
      const fns = untrack(() => callbacks.m.map(run));
      return () => {
        for (const fn of fns) {
          if (typeof fn === "function") {
            fn();
          }
        }
      };
    });
    if (callbacks.a.length) {
      user_effect(() => {
        observe_all(context, props);
        run_all(callbacks.a);
      });
    }
  }
  function observe_all(context, props) {
    if (context.l.s) {
      for (const signal of context.l.s)
        get2(signal);
    }
    props();
  }
  // ../../node_modules/.bun/svelte@5.55.9/node_modules/svelte/src/internal/client/reactivity/props.js
  function prop(props, key, flags2, fallback) {
    var runes = !legacy_mode_flag || (flags2 & PROPS_IS_RUNES) !== 0;
    var bindable = (flags2 & PROPS_IS_BINDABLE) !== 0;
    var lazy = (flags2 & PROPS_IS_LAZY_INITIAL) !== 0;
    var fallback_value = fallback;
    var fallback_dirty = true;
    var fallback_signal = undefined;
    var get_fallback = () => {
      if (lazy && runes) {
        fallback_signal ??= derived(fallback);
        return get2(fallback_signal);
      }
      if (fallback_dirty) {
        fallback_dirty = false;
        fallback_value = lazy ? untrack(fallback) : fallback;
      }
      return fallback_value;
    };
    let setter;
    if (bindable) {
      var is_entry_props = STATE_SYMBOL in props || LEGACY_PROPS in props;
      setter = get_descriptor(props, key)?.set ?? (is_entry_props && key in props ? (v) => props[key] = v : undefined);
    }
    var initial_value;
    var is_store_sub = false;
    if (bindable) {
      [initial_value, is_store_sub] = capture_store_binding(() => props[key]);
    } else {
      initial_value = props[key];
    }
    if (initial_value === undefined && fallback !== undefined) {
      initial_value = get_fallback();
      if (setter) {
        if (runes)
          props_invalid_value(key);
        setter(initial_value);
      }
    }
    var getter;
    if (runes) {
      getter = () => {
        var value = props[key];
        if (value === undefined)
          return get_fallback();
        fallback_dirty = true;
        return value;
      };
    } else {
      getter = () => {
        var value = props[key];
        if (value !== undefined) {
          fallback_value = undefined;
        }
        return value === undefined ? fallback_value : value;
      };
    }
    if (runes && (flags2 & PROPS_IS_UPDATED) === 0) {
      return getter;
    }
    if (setter) {
      var legacy_parent = props.$$legacy;
      return function(value, mutation) {
        if (arguments.length > 0) {
          if (!runes || !mutation || legacy_parent || is_store_sub) {
            setter(mutation ? getter() : value);
          }
          return value;
        }
        return getter();
      };
    }
    var overridden = false;
    var d = ((flags2 & PROPS_IS_IMMUTABLE) !== 0 ? derived : derived_safe_equal)(() => {
      overridden = false;
      return getter();
    });
    if (true_default) {
      d.label = key;
    }
    if (bindable)
      get2(d);
    var parent_effect = active_effect;
    return function(value, mutation) {
      if (arguments.length > 0) {
        const new_value = mutation ? get2(d) : runes && bindable ? proxy(value) : value;
        set(d, new_value);
        overridden = true;
        if (fallback_value !== undefined) {
          fallback_value = new_value;
        }
        return value;
      }
      if (is_destroying_effect && overridden || (parent_effect.f & DESTROYED) !== 0) {
        return d.v;
      }
      return get2(d);
    };
  }
  // ../../node_modules/.bun/svelte@5.55.9/node_modules/svelte/src/legacy/legacy-client.js
  function createClassComponent(options) {
    return new Svelte4Component(options);
  }
  class Svelte4Component {
    #events;
    #instance;
    constructor(options) {
      var sources = new Map;
      var add_source = (key, value) => {
        var s = mutable_source(value, false, false);
        sources.set(key, s);
        return s;
      };
      const props = new Proxy({ ...options.props || {}, $$events: {} }, {
        get(target, prop2) {
          return get2(sources.get(prop2) ?? add_source(prop2, Reflect.get(target, prop2)));
        },
        has(target, prop2) {
          if (prop2 === LEGACY_PROPS)
            return true;
          get2(sources.get(prop2) ?? add_source(prop2, Reflect.get(target, prop2)));
          return Reflect.has(target, prop2);
        },
        set(target, prop2, value) {
          set(sources.get(prop2) ?? add_source(prop2, value), value);
          return Reflect.set(target, prop2, value);
        }
      });
      this.#instance = (options.hydrate ? hydrate : mount)(options.component, {
        target: options.target,
        anchor: options.anchor,
        props,
        context: options.context,
        intro: options.intro ?? false,
        recover: options.recover,
        transformError: options.transformError
      });
      if (!async_mode_flag && (!options?.props?.$$host || options.sync === false)) {
        flushSync();
      }
      this.#events = props.$$events;
      for (const key of Object.keys(this.#instance)) {
        if (key === "$set" || key === "$destroy" || key === "$on")
          continue;
        define_property(this, key, {
          get() {
            return this.#instance[key];
          },
          set(value) {
            this.#instance[key] = value;
          },
          enumerable: true
        });
      }
      this.#instance.$set = (next2) => {
        Object.assign(props, next2);
      };
      this.#instance.$destroy = () => {
        unmount(this.#instance);
      };
    }
    $set(props) {
      this.#instance.$set(props);
    }
    $on(event2, callback) {
      this.#events[event2] = this.#events[event2] || [];
      const cb = (...args) => callback.call(this, ...args);
      this.#events[event2].push(cb);
      return () => {
        this.#events[event2] = this.#events[event2].filter((fn) => fn !== cb);
      };
    }
    $destroy() {
      this.#instance.$destroy();
    }
  }

  // ../../node_modules/.bun/svelte@5.55.9/node_modules/svelte/src/internal/client/dom/elements/custom-element.js
  var SvelteElement;
  if (typeof HTMLElement === "function") {
    SvelteElement = class extends HTMLElement {
      $$ctor;
      $$s;
      $$c;
      $$cn = false;
      $$d = {};
      $$r = false;
      $$p_d = {};
      $$l = {};
      $$l_u = new Map;
      $$me;
      $$shadowRoot = null;
      constructor($$componentCtor, $$slots, shadow_root_init) {
        super();
        this.$$ctor = $$componentCtor;
        this.$$s = $$slots;
        if (shadow_root_init) {
          this.$$shadowRoot = this.attachShadow(shadow_root_init);
        }
      }
      addEventListener(type, listener, options) {
        this.$$l[type] = this.$$l[type] || [];
        this.$$l[type].push(listener);
        if (this.$$c) {
          const unsub = this.$$c.$on(type, listener);
          this.$$l_u.set(listener, unsub);
        }
        super.addEventListener(type, listener, options);
      }
      removeEventListener(type, listener, options) {
        super.removeEventListener(type, listener, options);
        if (this.$$c) {
          const unsub = this.$$l_u.get(listener);
          if (unsub) {
            unsub();
            this.$$l_u.delete(listener);
          }
        }
      }
      async connectedCallback() {
        this.$$cn = true;
        if (!this.$$c) {
          let create_slot = function(name) {
            return (anchor) => {
              const slot = create_element("slot");
              if (name !== "default")
                slot.name = name;
              append(anchor, slot);
            };
          };
          await Promise.resolve();
          if (!this.$$cn || this.$$c) {
            return;
          }
          const $$slots = {};
          const existing_slots = get_custom_elements_slots(this);
          for (const name of this.$$s) {
            if (name in existing_slots) {
              if (name === "default" && !this.$$d.children) {
                this.$$d.children = create_slot(name);
                $$slots.default = true;
              } else {
                $$slots[name] = create_slot(name);
              }
            }
          }
          for (const attribute of this.attributes) {
            const name = this.$$g_p(attribute.name);
            if (!(name in this.$$d)) {
              this.$$d[name] = get_custom_element_value(name, attribute.value, this.$$p_d, "toProp");
            }
          }
          for (const key in this.$$p_d) {
            if (!(key in this.$$d) && this[key] !== undefined) {
              this.$$d[key] = this[key];
              delete this[key];
            }
          }
          this.$$c = createClassComponent({
            component: this.$$ctor,
            target: this.$$shadowRoot || this,
            props: {
              ...this.$$d,
              $$slots,
              $$host: this
            }
          });
          this.$$me = effect_root(() => {
            render_effect(() => {
              this.$$r = true;
              for (const key of object_keys(this.$$c)) {
                if (!this.$$p_d[key]?.reflect)
                  continue;
                this.$$d[key] = this.$$c[key];
                const attribute_value = get_custom_element_value(key, this.$$d[key], this.$$p_d, "toAttribute");
                if (attribute_value == null) {
                  this.removeAttribute(this.$$p_d[key].attribute || key);
                } else {
                  this.setAttribute(this.$$p_d[key].attribute || key, attribute_value);
                }
              }
              this.$$r = false;
            });
          });
          for (const type in this.$$l) {
            for (const listener of this.$$l[type]) {
              const unsub = this.$$c.$on(type, listener);
              this.$$l_u.set(listener, unsub);
            }
          }
          this.$$l = {};
        }
      }
      attributeChangedCallback(attr, _oldValue, newValue) {
        if (this.$$r)
          return;
        attr = this.$$g_p(attr);
        this.$$d[attr] = get_custom_element_value(attr, newValue, this.$$p_d, "toProp");
        this.$$c?.$set({ [attr]: this.$$d[attr] });
      }
      disconnectedCallback() {
        this.$$cn = false;
        Promise.resolve().then(() => {
          if (!this.$$cn && this.$$c) {
            this.$$c.$destroy();
            this.$$me();
            this.$$c = undefined;
          }
        });
      }
      $$g_p(attribute_name) {
        return object_keys(this.$$p_d).find((key) => this.$$p_d[key].attribute === attribute_name || !this.$$p_d[key].attribute && key.toLowerCase() === attribute_name) || attribute_name;
      }
    };
  }
  function get_custom_element_value(prop2, value, props_definition, transform) {
    const type = props_definition[prop2]?.type;
    value = type === "Boolean" && typeof value !== "boolean" ? value != null : value;
    if (!transform || !props_definition[prop2]) {
      return value;
    } else if (transform === "toAttribute") {
      switch (type) {
        case "Object":
        case "Array":
          return value == null ? null : JSON.stringify(value);
        case "Boolean":
          return value ? "" : null;
        case "Number":
          return value == null ? null : value;
        default:
          return value;
      }
    } else {
      switch (type) {
        case "Object":
        case "Array":
          return value && JSON.parse(value);
        case "Boolean":
          return value;
        case "Number":
          return value != null ? +value : value;
        default:
          return value;
      }
    }
  }
  function get_custom_elements_slots(element) {
    const result = {};
    element.childNodes.forEach((node) => {
      result[node.slot || "default"] = true;
    });
    return result;
  }
  // ../../node_modules/.bun/svelte@5.55.9/node_modules/svelte/src/internal/client/dev/console-log.js
  function log_if_contains_state(method, ...objects) {
    untrack(() => {
      try {
        let has_state = false;
        const transformed = [];
        for (const obj of objects) {
          if (obj && typeof obj === "object" && STATE_SYMBOL in obj) {
            transformed.push(snapshot(obj, true));
            has_state = true;
          } else {
            transformed.push(obj);
          }
        }
        if (has_state) {
          console_log_state(method);
          console.log("%c[snapshot]", "color: grey", ...transformed);
        }
      } catch {}
    });
    return objects;
  }
  // ../../node_modules/.bun/svelte@5.55.9/node_modules/svelte/src/index-client.js
  if (true_default) {
    let throw_rune_error = function(rune) {
      if (!(rune in globalThis)) {
        let value;
        Object.defineProperty(globalThis, rune, {
          configurable: true,
          get: () => {
            if (value !== undefined) {
              return value;
            }
            rune_outside_svelte(rune);
          },
          set: (v) => {
            value = v;
          }
        });
      }
    };
    throw_rune_error("$state");
    throw_rune_error("$effect");
    throw_rune_error("$derived");
    throw_rune_error("$inspect");
    throw_rune_error("$props");
    throw_rune_error("$bindable");
  }

  // ../../node_modules/.bun/svelte@5.55.9/node_modules/svelte/src/version.js
  var PUBLIC_VERSION = "5";

  // ../../node_modules/.bun/svelte@5.55.9/node_modules/svelte/src/internal/disclose-version.js
  if (typeof window !== "undefined") {
    ((window.__svelte ??= {}).v ??= new Set).add(PUBLIC_VERSION);
  }

  // popup-svelte/lib/icons.ts
  var ICON_BOX = \`<svg viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M11.6442 2.45173L6.24419 0.0517495C6.08879 -0.0172498 5.9118 -0.0172498 5.7564 0.0517495L0.356396 2.45173C0.139796 2.54773 0 2.76309 0 3.00009V9.00003C0 9.23703 0.139796 9.45186 0.356396 9.54846L5.7564 11.9484C5.8338 11.9832 5.9172 12 6 12C6.0828 12 6.1662 11.9826 6.2436 11.9484L11.6436 9.54846C11.8602 9.45246 12 9.23703 12 9.00003V3.00009C12.0006 2.76249 11.8608 2.54773 11.6442 2.45173ZM6.00059 1.2565L9.9234 3.00009L8.85058 3.47652L4.92777 1.73352L6.00059 1.2565ZM6.00059 4.74309L2.07777 2.9995L3.45059 2.38932L7.3734 4.13291L6.00059 4.74309ZM1.20059 3.92286L5.40059 5.78949V10.4767L1.20059 8.61002V3.92286ZM6.60058 10.4767V5.78949L10.8006 3.92286V8.61002L6.60058 10.4767Z" fill="white"/>
</svg>
\`;
  var ICON_CHECK = \`<svg viewBox="0 0 8 6" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M6.79843 0L3.1502 3.61719L1.20157 1.68516L0 2.87656L3.1502 6L8 1.19141L6.79843 0Z" fill="white"/>
</svg>
\`;
  var ICON_CHEVRON_DOWN = \`<svg viewBox="0 0 8 8" fill="none" xmlns="http://www.w3.org/2000/svg">
<path fill-rule="evenodd" clip-rule="evenodd" d="M0 2.58924L0.649682 2.03033L4 4.91253L7.35032 2.03033L8 2.58924L4 6.03033L0 2.58924Z" fill="currentColor"/>
</svg>
\`;
  var ICON_CLOSE = \`<svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M1 1L11 11M11 1L1 11" stroke="#ffffff" stroke-width="1.5" stroke-linecap="round"/></svg>
\`;
  var ICON_DOCUMENT = \`<svg viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M8.04842 0H2.39996C1.73816 0 1.19995 0.538805 1.19995 1.20001V10.8001C1.19995 11.4619 1.73816 12.0001 2.39996 12.0001H9.60004C10.2618 12.0001 10.8 11.4619 10.8 10.8001V2.75163L8.04842 0ZM9.60064 10.8001H2.39996V1.20001H7.20001V3.60004H9.60004L9.60064 10.8001Z" fill="white"/>
<path d="M7.19999 5.40001H3.59996V6.60002H7.19999V5.40001Z" fill="white"/>
<path d="M8.4 7.80011H3.59996V9.00013H8.4V7.80011Z" fill="white"/>
</svg>
\`;
  var ICON_FAQ = \`<svg viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M6 9C6.33138 9 6.6 8.73138 6.6 8.4C6.6 8.06862 6.33138 7.8 6 7.8C5.66862 7.8 5.4 8.06862 5.4 8.4C5.4 8.73138 5.66862 9 6 9Z" fill="white"/>
<path d="M10.8 6C10.8 3.34903 8.65099 1.19999 6 1.19999C3.34903 1.19999 1.19999 3.34903 1.19999 6C1.19999 8.65099 3.34903 10.8 6 10.8C8.65099 10.8 10.8 8.65099 10.8 6ZM6 7.2C6.66275 7.2 7.2 7.73725 7.20001 8.4C7.20001 9.06275 6.66275 9.6 6 9.6C5.33725 9.6 4.79999 9.06275 4.79999 8.4C4.8 7.73725 5.33725 7.2 6 7.2ZM6.30001 2.4C7.4161 2.4 8.21501 2.98098 8.45192 3.81017C8.68232 4.61657 8.32304 5.50929 7.46834 5.93665C6.98446 6.17859 6.7786 6.45944 6.68666 6.64332C6.63857 6.7395 6.61682 6.81905 6.6071 6.86767C6.60252 6.89058 6.60067 6.90634 6.59999 6.91331V7.20001H5.40001V6.9H6C5.40056 6.9 5.40001 6.89961 5.40001 6.89921V6.8967C5.40001 6.89554 5.40003 6.89432 5.40004 6.89304C5.40007 6.89048 5.4001 6.88767 5.40016 6.88464C5.40029 6.87857 5.40052 6.87158 5.40087 6.86368C5.40155 6.84791 5.40274 6.82851 5.4048 6.80583C5.40892 6.76052 5.41651 6.70179 5.4304 6.63234C5.45817 6.49346 5.51144 6.31049 5.61335 6.10666C5.82141 5.69055 6.21556 5.2214 6.93168 4.86334C7.27697 4.6907 7.36769 4.38342 7.29809 4.13983C7.235 3.91901 6.98391 3.60001 6.30001 3.6C5.60328 3.6 5.35227 3.87074 5.2395 4.05869C5.17148 4.17205 5.13508 4.29026 5.11647 4.38329C5.10738 4.42872 5.1032 4.46488 5.10132 4.48679C5.10046 4.49677 5.10013 4.5035 5.1 4.50646V4.79999H3.89999V4.5L4.5 4.5C3.90359 4.5 3.90001 4.49965 3.89999 4.49928C3.89999 4.49915 3.89999 4.49877 3.89999 4.49851C3.89999 4.498 3.90001 4.49746 3.90001 4.49689C3.90002 4.49576 3.90001 4.49453 3.90003 4.4932C3.90005 4.49055 3.9001 4.48749 3.90017 4.48408C3.9003 4.47725 3.90053 4.46891 3.90092 4.45917C3.9017 4.4397 3.90312 4.41447 3.90571 4.38431C3.91086 4.32418 3.92073 4.24314 3.93977 4.14795C3.97742 3.95973 4.05353 3.70294 4.21051 3.44131C4.54774 2.87925 5.19674 2.4 6.30001 2.4ZM12 6C12 9.31373 9.31373 12 6 12C2.68629 12 0 9.31374 0 6C0 2.68629 2.68629 0 6 0C9.31374 0 12 2.68629 12 6Z" fill="white"/>
</svg>
\`;
  var ICON_GEAR = \`<svg viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M10 5.83333V4.16667H8.215C8.13667 3.86417 8.01668 3.57999 7.86084 3.31749L9.12501 2.05332L7.94668 0.87499L6.68251 2.13915C6.42001 1.98416 6.13583 1.86333 5.83333 1.785V0H4.16667V1.785C3.86417 1.86333 3.57999 1.98332 3.31749 2.13915L2.05332 0.87499L0.87499 2.05332L2.13915 3.31749C1.98416 3.57999 1.86333 3.86417 1.785 4.16667H0V5.83333H1.785C1.86333 6.13583 1.98332 6.42001 2.13915 6.68251L0.87499 7.94668L2.05332 9.12501L3.31749 7.86084C3.57999 8.01584 3.86417 8.13667 4.16667 8.215V10H5.83333V8.215C6.13583 8.13667 6.42001 8.01668 6.68251 7.86084L7.94668 9.12501L9.12501 7.94668L7.86084 6.68251C8.01584 6.42001 8.13667 6.13667 8.215 5.83333H10ZM5 6.66667C4.08083 6.66667 3.33333 5.91917 3.33333 5C3.33333 4.08167 4.08083 3.33333 5 3.33333C5.91917 3.33333 6.66667 4.08167 6.66667 5C6.66667 5.91917 5.91917 6.66667 5 6.66667Z" fill="#67707B"/>
</svg>
\`;
  var ICON_SAFETY = \`<svg viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M9.743 2.2287L5.243 0.0547826C5.0915 -0.0182609 4.9085 -0.0182609 4.757 0.0547826L0.257004 2.2287C0.0985038 2.30565 0 2.45087 0 2.60869C0 2.91043 0.0570002 10 5 10C9.943 10 10 2.91043 10 2.60869C10 2.45087 9.902 2.30565 9.743 2.2287ZM5.1695 7.31175L2.625 5.65261L3.375 4.78305L4.8305 5.73261L6.97 2.75609L8.03 3.33217L5.1695 7.31175Z" fill="white"/>
</svg>
\`;
  var ICON_SETTINGS = \`<svg viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M10.2 4.33333C11.1924 4.33333 12 3.58556 12 2.66667C12 1.74778 11.1924 1 10.2 1C9.4188 1 8.7594 1.46556 8.511 2.11111H0V3.22222H8.511C8.7594 3.86778 9.4188 4.33333 10.2 4.33333ZM10.2 2.11111C10.5306 2.11111 10.8 2.36 10.8 2.66667C10.8 2.97333 10.5306 3.22222 10.2 3.22222C9.8694 3.22222 9.6 2.97333 9.6 2.66667C9.6 2.36 9.8694 2.11111 10.2 2.11111Z" fill="white"/>
<path d="M4.2 4.33333C3.4188 4.33333 2.7594 4.79889 2.511 5.44444H0V6.55556H2.511C2.7594 7.20111 3.4194 7.66667 4.2 7.66667C4.9806 7.66667 5.6406 7.20111 5.889 6.55556H12V5.44444H5.889C5.6406 4.79889 4.9812 4.33333 4.2 4.33333ZM4.2 6.55556C3.8694 6.55556 3.6 6.30667 3.6 6C3.6 5.69333 3.8694 5.44444 4.2 5.44444C4.5306 5.44444 4.8 5.69333 4.8 6C4.8 6.30667 4.5306 6.55556 4.2 6.55556Z" fill="white"/>
<path d="M10.2 7.66667C9.4188 7.66667 8.7594 8.13222 8.511 8.77778H0V9.88889H8.511C8.7594 10.5344 9.4194 11 10.2 11C11.1924 11 12 10.2522 12 9.33333C12 8.41444 11.1924 7.66667 10.2 7.66667ZM10.2 9.88889C9.8694 9.88889 9.6 9.64 9.6 9.33333C9.6 9.02667 9.8694 8.77778 10.2 8.77778C10.5306 8.77778 10.8 9.02667 10.8 9.33333C10.8 9.64 10.5306 9.88889 10.2 9.88889Z" fill="white"/>
</svg>
\`;
  var ICON_SUPPORT = \`<svg viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M12 11H7.68697C5.8397 11 4.33674 9.71857 4.33674 8.14286C4.33674 6.56714 5.8397 5.28571 7.68697 5.28571C9.53423 5.28571 11.0372 6.56714 11.0372 8.14286C11.0372 8.53476 10.9418 8.92288 10.7599 9.28049L12 11ZM7.68697 6.2381C6.40821 6.2381 5.36758 7.09238 5.36758 8.14286C5.36758 9.19333 6.40821 10.0476 7.68697 10.0476H10.0744L9.5466 9.31572L9.72082 9.05571C9.91049 8.77285 10.0064 8.46571 10.0064 8.14286C10.0064 7.09238 8.96572 6.2381 7.68697 6.2381Z" fill="white"/>
<path d="M3.3059 8.61905H0L1.94571 6.82191C1.48544 6.21858 1.24422 5.53095 1.24422 4.80952C1.24422 2.70905 3.32549 1 5.883 1C8.18589 1 10.161 2.41002 10.4774 4.28049L9.45898 4.42762C9.22034 3.01667 7.68285 1.95288 5.883 1.95288C3.89348 1.95288 2.27506 3.2343 2.27506 4.81002C2.27506 5.43907 2.53277 6.03763 3.01933 6.54144L3.34404 6.87716L2.48845 7.66716H3.3059V8.61905Z" fill="white"/>
</svg>
\`;
  var ICON_TELEGRAM = \`<svg viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
<path fill-rule="evenodd" clip-rule="evenodd" d="M11.9769 2.1927C12.1496 1.42418 11.3227 0.785513 10.5211 1.06826L0.694894 4.5341C-0.200306 4.84985 -0.240194 5.99263 0.631164 6.35974L2.77104 7.26139L3.78901 10.5139C3.84188 10.6829 3.98874 10.8137 4.17506 10.8578C4.36137 10.9018 4.55933 10.8526 4.69542 10.7284L6.26349 9.29685L8.46007 10.8008C9.09769 11.2374 10.016 10.9194 10.1762 10.2066L11.9769 2.1927ZM1.08644 5.45924L10.9127 1.99341L9.11192 10.0074L6.53847 8.24535C6.32222 8.09727 6.01959 8.11691 5.82844 8.29142L5.15682 8.90455L5.35862 7.89138L9.31269 4.2817C9.50515 4.10602 9.52547 3.82747 9.36028 3.63004C9.19509 3.4326 8.8954 3.37722 8.6591 3.50048L3.1984 6.34908L1.08644 5.45924ZM3.86422 7.14406L4.19361 8.19655L4.32008 7.56155C4.33984 7.46233 4.39229 7.37093 4.47042 7.29962L5.67629 6.19883L3.86422 7.14406Z" fill="white"/>
</svg>
\`;
  var ICON_CATALOG_ARROW = \`<svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M7.42773 6L1.29297 12L0 10.7354L4.84082 6L0 1.26465L1.29297 0L7.42773 6ZM12 6L5.86621 12L4.57324 10.7354L9.41309 6L4.57324 1.26465L5.86621 0L12 6Z" fill="white"/></svg>
\`;
  var IMG_LOGO_DATA_URI = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAIgAAAAkCAMAAABluoL1AAAAjVBMVEUAAAD///////////////////////////////////////////////////////9mS/5B0pn///9C05hA0JdlTP9iSv////////9PnsVB0plC0plB0phlTP5C0pllS/5lTP9mTP9nTP9lS/1D05hmS/9C05hC0pllS/9nTv9mTP9nTP////////9mTP5C0pnFhVtRAAAALHRSTlMAv39g359AII/vEB+vb0/f38/BIb8gMD8Qf59h7+/PfY9An0Zfr49gL6+fgKHZBZgAAARfSURBVFjDtZfretsgDEAFvgG1nTpJnWubZl3XXZS+/+NNRtg4Adr+6fm+xkxJ5hOEhYCR8/PT8TLnN8DqnbmHOOZfjtjVpRETd+AGCoieBgYGlBDNOMggzXl9ueEHRe+dyAqiVDla2gon7gAZAYQc3oUBgZhbd4oUkGL7fLll8QCwcx57iKMQ282mUZWRMmsQm0xKQyJFIynAt89RwUBuJQGyj0Qeni4BPykxjy4xK4gjsJ5ND98ISCQbY4bkMHciNQ65qbFOimwXoccfiu/fmQMk6D4TKTEnF8Mimc2WxiYp8nwJocQcnMcrpCgQmw9FFNaDAViBO42G1AQLRTj72x8XjhMlJr1S/Q9GnB6B3ouojDA2dw3ZFhy9K0iJ/pIi69HitJ2HfzmPHaRphyWYV2w1iTAbu0R6yDB3Ipmdnyol8tt5PM01ghKSoJKkovsbkU4QFGxRc8pYxGjdYgcZ/cU4+cfV40vIi/NLqyCKG5F2WiK5lNKuGTO8K7BDyVOUzszP6+jufeLx9cCx9JK9Ecmmp4op3Lw06HMV4uo6hInx3CdVuESZqEjFSeqmBNFLDkkRt0LA40uIZ7+NKVQ8I3l8RlpvyCKjuP6yyOE9YBkxybGrpUKUscWqoOBVaTQ2UM5F8IPUHH2AS0hoEu69Ai0i+vgK8lTjTvAVEbfPnNOJSReUStaiaMexNHYgmYwGPadINvwu00v5UYFf+8h2OedxenpW8I34Cv8MCQ5jon7B97IYS+sZ4qyWbkq28K28+WZoPePveFvfmLzA9xJ0iUGp3UVzU6qiFqLOgMmkbDkuG3oNozzoZcNfrkWtGkMfYCj2wMkJWlbPS7RllMgUU0HPOc7XIIrawFhY/yEDIMZRwuRqD9xGS4lEvek30m1yFRLmRoSjd6O2ZBEbFkqqurZtbS0IiJuc4HMR/m1j3cpQCMxuRdpZVKMev1X4j4jrzvF0rbIAiKTmNRTx/1OBSvFoFLmNKo2l+5ZGmRCBh7f1MZ4YX2p3URGNiidm03JAus6Ho22LmqNSobANNfSIbUKEZX6MKzXeFLwEIlVVKcSKF4MxvByk231uo7JELK0IDTYzkYowVyL+cBXbA++DRsSiN/yPbvj9jRcJohIEqoiIRcKMP2EJIY3duNvsQhEhOtc922MTd+xehAOKo/RKWTJfEHmbJWZ/72CL4MDn9/NK2/vmNPOlQu1F3BPlo4VdpKGIAs/8GT7y4SrgAFERsPfp/SHci/ho70QkTd+ni/XvWELindEOEiJyuDToaOYimY+yiNGYkYjB4PENzzeLeGe0h5RIgdqerV0zNhepeVRztOAGl0RAuI9UEZGFLyGrRF5CkQqgzDn5DRANajv/UhUFL4lZtHan1NxeaPE0AksS6eSAP2f5/ihIzHIFUREmr6bVR9d+2gyh99FynCdhRabPKAowkRKyuz7TLHeJhmgjOo2YFxVAK4Trp0ULmWCmKHCUtyQhCr4OXyVPJZj/j80BM5/SIzUAAAAASUVORK5CYII=";
  var IMG_MONEY_DATA_URI = "data:image/webp;base64,UklGRgInAABXRUJQVlA4TPUmAAAv5wAgEN8HvbYmRcpXXT0ui0MKxMBfciBNQnJ3GKuWqjQgybadNnofzA6OsrXee3oaZpb0pQ+7tu0ESp4kb3DXIuh/0QK/NODukJnIk/mP5RdjDDGpNGZbSKYcvoOjx59KAAso4UqExkgas7MI4qYKxSknW20iwE8LDMAL+4hmLkw/jqoGn4E19GEqCDQtmnjhPoIIpA9FsVp7IIb4S+Q7pdAtPxX9X8mNkKpeIH2/HHuWm38tg+GHeCYO7oz6NaOhNIoxrNEVkY6sTZZE/eahfJp8C6V+e2+zlc/NtKStWB//pnOWwiAxhKgkmmQNUaW2UsHU5Zt7fvCkuChPLk9AxevwC8UMKYmmZfDMCWExxb/RfdimP97ti0xMvv9J1+xPGxybVzeRxNMrAwnWwmsmIJEIXFhBWhiVynKnRqgMJIMmAwTmqYDT3EkEVkLCxHnSSMw7x5O5Q54IADDZmcMfywYIhmCeAIGQGCXmCQAABCD4ikIpurY9w1o4XeOqdYF2HQ1vML/AXEwFQQHSkOgYV8RxwpqYTAfsHE11bazblm3Tpg5KxioRCHPWouB6Q2yTjhaquogj6ipXKsg0se2oGsbScL0ht6IXVwximK1Zmw2fps4n6GDKhlkxr29d/hCf2XZrbtY3PvHgq6nKHbiuw38WJFtaWiOz0PGRewtRSA5rgrMcf1lxZfqi73/BQ0oKOYFsS8HU/ExNlXXTB1KNu5r+T+2DTx+q76e3p8ksPm2HpeJHz1x9rj0ur/z8XRrx6/sRFi9CmE5k6cJ+/Zybaf6B4idlQG4bSZIk+m923TOz+46ICWibrlsOrqTb1MIZjRAvnNEqOLKabpkX3cpYEzsRFTTZzMSkSv9XbNC2PXsah2bUAXWKJOr2XYgaopqSXrCMegVE3TXB0uKggImRsQSWsu5lBNbGioMUawsmbhSn0LtgOwwJGUbBRbhNzzb9ep77eT59H98nJ/+u+74j+i9Rkq2glc49NxwvVyTEKPKy+wH4p22bnUZOlu5xnK7sPcMAvVhGWEhMr9mT3so0uwY7+76vOlKUUY0SxdJxTuXMaUfYVWSDFlJZKlkzlhqpF0EDw4DX3vgpBQKTYaCtojQCTNqCSi9gY//0nU+4neIPeJeI/kOUbatqszl4L89kbMSApB8w8P8IW8RfjMianc/ZEfIGRTKzpb8wHMDMN1ivM7MWhux9ZC2ak3+5Nz8CZOai+QuB3OXvFhWX31Zxgz/86ptvvc3Mzp/iLw8fZOYrhz47kh0KVaC9lzl/jocSpvnzF05WRc67a1aXVhSV37az58YbbxZm83O7zS31Bx+QQkx6TNT0rxz7D+DTE9MygznI7AJVze8F84JUiuxF4Yn5GcaTMwvLi0orq8v6b0+7m958PcszzfUHHpSDFHkUtdFRE07xmdGxqYP9cE0d5WUslvl2//7c+eFZuzBjYSzS7MdXVn5bVKGJ/DTR09zQRDZqqLU0NLVfoDe+jq99VYSnT0XUHaNGqjKA4SMGsXtq4ry5HsJw4aKBwuq8zGDfaY5kZ92ObWYRuY1Xu6+L9rzruEBEndTVPdFNHc7C7CpmVrlnt2fCceEKXaUPHvxhZkbEQOlZI8YAGHtubj7xy8h7iV54/uWjh+8GieyaKqk2p0IE2bHX3sryUE+7mdPtnMOu2SFyqRozYhDNEADwZtYmLl19D+UMHTU8PsuDNDYRsAkUGMVg/uPjT7dZj9y3LasCUFmd018YKfjwrbXKUM8EO9dnEQtccWs6sRpI8laJiohIaQBIgo9TOH7p/Q+oKmP4CC8NYBMuXDRq5Uf09J3dju/cvU/Ka6pAhJimw/CUyQ6M197Kx2E9m3G7PBXRHHUiLSBO5UqRl3kBYAWLJUIGWKSl5SIvbYtuvkCFL0ESx9qSmc9fNA44PtPz1fu9ErS6qnS1osIGanhmuCXo7FoO8E74m+WKkvC4UHFXchmK6USkBrzp0sjY+LVJmJIDwNjIsChaWNyBbeZ3Hxx1hgSGDfd8JZLHjD3PbMBzL/Mf3OrY/eqN+7elH6vq6io4Iqh+ZkFCPh3Mq1Xk+Dr7xrlEHISHCNmKxqwbpCmZ4ZFRHrtGk3KQnIvMjDC6DIs778LHgFOjz8goQx7hvon4cQbMptDFcqvt5WN379+usdCKqloidLAJWckYkRryK3t2bt4lLNG83EVVuW8lPJV4kF3oqXjMHKZQZXiEzCgguqcuAfCOqHD1vZOf/C9IcBgPT3NvqInnL4iwzJ23YOlX/h8+/2W1FcTXVNWqQoQkZBcOwhMnJ40Bho8IQkjmoOb2l/KWzFMAv3HDHPfOebjsCgFg3B3S9IiheXLDuBdQLQnZuYwIOwt8fPSZk5+ckjto0DNDumA5jxf/0aMA9/8StRWrLUoJnHRzJQyI5MkEwPD4zMFSYgNMI3j+nIIldjaoqlr7f3/x7N3vJ9wVjomoIGl62IglcmvsQjhsSogDjjzKzMdE/uNXvz5+x+iTn5xmEozN8ry5ucDivJzAp0NaqnJWoJgZzwqTItZFVFWhRARIiJ+cRHwYmJE4YpAiPmlcYrx5XyLC8cnj5l4sINabZ0K/+0fPfiuZqMRjJHwyNIO1xGoO1ggJiMYApG48khSUgl/j1KgzJ0EOZrM8Ynb1zMFMhVMWTI6O9d7py0pLlByo1tEKVR3ElTAz0YISSIofbJFoZw0YJyLAhbm4SJl/qepSHjz7ujeRDcZMogYzuoW3F1JVC9QAIiJE0ByL4yL4tYwaeebU6JGEqQPBmaRMZo5jTnY+h56iunVMDuG6AqqQUkDMlMXl/HnMFAAQP+jq1Lgx56idZ75gAKOYV6zimmfPJ+PloCYiGcwcdMUTAgS8xbbKwGw3KhXBSNIsbczDYzg5etioMwrSRHyQc36DOGs8PjUtS/qL69auYyvgSVdYX71GVSrLncrMJb2X557D2KRJUzAGg4l576UXPGY5j/NNuSK37HySS4rpRw2dMQjImxmMK56NCgXeeju3msDNtdGRl1WYBAA/CU7xSZwZOeyOM6SSRwR3H42OS6GMAWtGDfU1IkaAurpeWlnmVs/Ov8yLCy6e+8MZZ5POJQbTaOHCpLHnidn0uRcv58/rvcyc2/Njb3IZgiJXJ82IURSRFMCgGTaqsjy/ifHM5mpu5LWXmQZFANK8w+OnqI0eZoISAibHTSGeICqylDikxJqISSCQUqwO4Nn5l1Zi8byCcwv+cMZ5ZAb5xDVuLDMzEfMuFlzk/F7O6en+Z29p4T2fKl5Np1BsECCKQQ4BMKnijeLhRBw3V9fYvUAAjmR25KnTLCImOmyUkCaCq8yMnpIyUdJjElSxtGSNUdZdEmE0AKn0zRNn9676aOW8uXwOSefOJwd9f0w8ZwBSAHMxb6H0//eb96YDqRXwq6hrwouYohCQEKnaKIQiwhq+9fYrL1uqkEvhG26QVJ4xrqqjho2UMyMB5bRg3n98yuT0s6qIm7K0om4t1rFIiYhWELF6TWmFO8k22lOu+Eh0SYFt4ByCnwlwYtJYYhbz8FcfuyF8VDGwtZz2aw/tbWk3TiiyHSAls5mZWEU0fNkmkEuhZYCs06eYPDYZ0gMPIvB9KXVhxtkvAUur7JkjolohUie0WAO7P2xrdv3FU7/K4HLvPFPMDboEkDbOIZ+T5EfvHjuf8ieDqpAXNH6ofY+qkoLZ6OdIrSXGCTZzb71o0l920vFLekRvUGyWGL5HD36BHvjBIL+85dWVK1ZxCSHdkDXiNGmiJfDuAWTm80ciK3E5f+65uRfSBkJg8eNoJHF+5gA89lYqyYEYCTSdou0GoARvJwnf2fj8iwYe3sysIp5XZn7rZXaOMYgsMUHmMz/wgDmjeP/B6KxgF/fKKitK7LdkLbU6YI17sNVSEmDRMKfXbuvK3gKdp7aVUMjkxHHqTEu/t1LyJoOaGmM2eBBgqXArSbWpYzdTPIEEqqpg/vDtl5nyL38p4p19HhPC4+//wMEdc5wYPT74Jb7ysuLlq5i5hEnqepE1FqVQLerx9zB3FVuoecGF1NCtmoPa4e1lb8mvasgsvEhUqcEJMTtNmDfwipCIADDyR3a2QoU3eJTZBL9ySq7gj70/LsaJqaOnhWThvZyLi5bXiQMhF0Mt8qYB0EsfkRfgcoHOCfk6h3yylC76AqrGrJMRCUd85gTZbdxNGU+iYvHXlvziy68I5S8Diq+KnZNdfeDKwnvvH+f0zJCtT/eUbwKjrPjdtWvWYXVR4AXgcnMIAWzRWzB7INQ4sVgsbfnVmEmEuUq02oP7SdNuNvtRde/heNvy57QJL9V5chLp8QU6dWxqRmHoV+TLe1gVAa167UfWsP6jSysvLgo1pv16KbXsExF9WjgSZu71RBWeQoRQQUa3NXsUfPgj0LmKn0T8qeIoI07tXKX8uMix0ycGwsOK1luu36Cmwd7+UH9iny2W5Lyte1tMhGwF2HCapFS9hxFNWCBU1cG16ngRUal9/TLy5MK7O8XJq3jlvSf3xwJa3dr18pHY/bAqN9R9/u5yPp0KaDqnQdvbWtvIFs0ipbdwxHeqiMNmZhVyZtZY9yRcbGqoOVALDRYb/4daqcw8tbDz7nLpMl68cuTYfqDH3OjMjutRshZ1ZaH+q831tBdUTaeAL9He2kat1aXBIMT9YJec3EysZlYlc81hqbVZ7Qg1BAdgQtSErx4lWSzMzsdbo+JdXP10P1BOIFjH6zdweYjxpjfJgajBWrpseKEaiOzhdhI0v3niptBaTjQZc7SS9eCPHTjUYKPamoMJo2IQNf0oCU6NL3286MOLzFeeCQNsWrsGdSIA1m/4uCe0eCZZUZN+jAx6k4qIXnqP4Ll9s4+KO55JrG4C4tpw94Xd+ocO1FlbmojIhg2SnjBslKYfu8h8YWpyYXF7JX2R8fJ+MGXkWQoEEuLMt0IQrCgBLZZkER8DvNojffRA1BENM4Lc2u5s60FrG01zk51Z1lQjRibYBDw5vrRIvuGLDNwTBli9RutU1+HjDbo2xBcUt9IbNXRNTXKsur774gT3BIbz2GTKnAPny+vT9R3NDnvNARvzHs6EmJHDhKZQmJXFrdT4FF68GgYoXbO6QqQUum4Dh7g+Fu2LhA1dTXrDDHhmT5t6cjyN+cCktIWbFPQkNnMjE4X5tvYOBHDYG5oAAPZQ1B0/cNBmMr68suTPT07B4f4weKEQgWpI7xuPukJ94V6IRL0BQ3gMuwlPsgYI+p1dcmL4QtPEvKMDZcmh2rHUHvgxujw5BdcWtpZSPnNh52YYYB0FPl4jIcWbWnQg3N8bUf1GX7+kNgW0Fc5LgMb9NaxIM6XMvA0nmjvkIOTsQnTsCvbosnZqEmChuLUSyE/CwX8r9P5BYhGxTOaQXq2LSysc6OpQnpTH/jHU1x/GiB5Qw/0D/bKhpQv1JnsLlwRkLlvmJzo6JRy7686eTIV5vafNhtUD/kEUjC9vrfh9o5MHD1/z/TAkD0tUdY4iNwBD8eTI1ZUVsuZjlIcQH+qhV8N9MKhipE8w8AwpFPBtE+6hDfsLU+zOlEvznUSSZnuycbfL/OrtiWfbpqsqHKi9fI1opLiFan78jdd9RVZuRRURl/JybsdPUmxVWQjxtdhgfwTDukZ9KEBmUoNW9dX4cvZup4UbJkKqzHaSrEQ27oppButEmqrATKvNXqXxazS6kloJePkgHz7iW5GoqLtEMbvwNv1JPIQv/SeUft3oC6sU6R9AlKJ/s83XiCoJs7B3ah1zwex8F5vwUNwTMsKGFHRSA+5Mm/watXRl/NrYyBamAvmDh1875Lv25l7Ks1kAwv63eNf93nAg0muoetgE5UiCNOQPkLADUAQIUaLZzi5mpo6Exx0LsyHqM5mBXUrW6pDVMD52bWQrhermaweV+33FCr1ErZoWWWGLKytFVQuzxkaf4N6uczAf3Qmnsw2DUV1Z75boiaEmInkqQ9n1oZimG1rIve6Q1GC5PDrGJd9WwP0vB5l9m/1FJascltvrfnxquOLG4nYxZoheqO0xx8HwVXqbcOALu9w8aGgRcnaziRtDkXBEe/8dMj/5Brk0nT3s7DJv4baGplEey6fAr+Xmxwt7JVG+vM5IXcVakzoiNpozwxXf+3i7rIV1NWC0ekp23K1scwon2XkiFJYposeMuIC7GAij4Qi57vpTOlFp2vWqRggqznZTtU2jI2PDaX9KSxbGRyaO7blFadUKrWNZC8mbEp0ctg6ffbydNPp0FeW00xA8EjDubZAurdINhaOGHoxUOgTcOQSucETRsn/+Z+6MLOs1t4wUnA6hhpqJkVEzqSq5+VH8zt7PzVfoKjVcv66oPIx/Zvbx9oLW26cHRG0DEvfLAM20eyiUFGGdjIwTQOAKxcJamrr+XP7MERiPGXowW2g3GwhoVCRVkcTCd++CVxZXFonIjk23bcadlV3eo8HiyY+X8nofaCoCSO6zHKhwm/fDcQDdiJCmzshElVDYq8SlO5uTMKQJk8h2mKptGCEa3vL5RXI+/z/3XE8s1NuWm7koZ/7CmuVFxcHeDr+7vaRE+ns1f8CE2fPiy1F4ng091UwEGTr5g+yEOaGeQUWDdKwg8IgZ0QnHs53tQrU0QkQCNZ6fHx6/sV92+s/PWKCoKa2oqQ4Wny0VI739rAeSvUzA7EHA47nSWSkHEGoq+vV41xwKzUaUkLoVnO9SVVd06xFSPRlnRztArXVYUPSxGsjNF/DD/UFqxuQUjZayYs4uDLbmelHrA/PAcq/8DPxsI4Bqa5szS6FssrsQqwEf4LpzTlJE8aaWyhdMVCmdBrPiKfd0CDXY8yNEayblAsB39sd25ljjGp+FEHzZXvNi3wD0h2PBkLhtv4qI0O8IqqBQeHZoc/mcEPengMqdc1LoirrSC+9emujmvZweQzMU93B3ByJa7HlhwOcnShcAv70/bOzCZMwPzR3wnwOxVwW9sYDOLCDsR9MPkurZ2QNv42SSEvAtjxYnCgBg4sJkaWkh7RSqdoYMVVfc5U4Tm8UEU36gyvxw7u398WuDTEGo7F/VPnFKw7rqhd4IDGD1fNDbSIAXU6i6jan+latXxp2zw5KcQ5on7feq2a7uaseJhhZQzFmUNPEfNkkHUr6EoHBsIKLsX/T+VwdQ1wLJPjC4V/KefUbhc1Wo98ZGJirO4qqaWmi4fEHatiXk7Bl0eWMGB9a7ucqphDW9jBVpUtzuQIlSQHSSK+Tyr0UWNMO8RFgvppRI2GBzjNirlVu2OpWe5g1bLJZHJycKuTVEM1MkYxg1IlqySs6KEVZD6XLmgomjg6TEamDLT+VCPvdhZOEbJtgXTpWCybiihXu5j01eC9qU4BlVuI2AKM8OLdHk8gQ4V6Uth6br7Im63DqFMV2e3eWebNII6yFvMT3W2UVE9vlhiZLAWykMl78fUTh2IjzwKhH2BSrxZDqerai6Id20WulRFApPB1RVvZDgUnl8IpsxBZK6PFH3kKGzmp43Nx4YYdawyLl2aU6Mw7m8EK6pPg5UCvnM18PxX80EcTm8cTL8qkm/GnG5A8l0JZvzqk0PSavao6hnlZyul7eqk2xFi5aKE6PrlYwQSpsrC3MOV8gzpPj8W8iaweHeWHp5Md3RadK+ls/hMCJCAHxKZTi3+Q9h6LHRnGx/mvi5btsneyXCBcT+kDvtLeWHC6t+M8NgjoSZmZleDwL/ccBQluaXCxXmzRdJkPAJl+Lm9VIqoOpGhF2l5RXvBXmNY6IsX1b5UkAFSOQzia+FITJSYoDo2C8f/tK9P1A3TvWZECQGEKE34kkkc8JZ85kniJg5HOGqD1SrN2YeqViex0w8gZUPiSCjN9ccVyA30bTmdmF8dJFW0s0idndxe668moO8dNDUYCIXh3/y34DDBEvv5HQjauoegS8ffnHvohuD/RKoywtSvYPBjPlksXttMyBv62GOqNohdQ6hDg1vaT6/7uE4JD7QF2nQlKOHM6XlpUs7sM1Lxby9UxryyZlElIwT4jEtEK+4PTJZkpkWH8uZ4QJMikHUtJWnG6x85Pm9im5E+gekpG52gX3YG9ZdpjuGhVwyoKJGRC2qSqtaaBtsRAxtOTs/63FXbV2ChyPtLbvl9NbCMmC5YOduOUyU0hUTyM+0PTEzRJSlyrcyeVHqtPGcEZ0SwxImAO6MihFri6OVkJlfeOSIee2YhAf6JIw9Ft7CkWgwU8jP4wQ7U/4AqJoSYUkuFi1Sz+l8oTzkJvJUZ/qyOlqs9sY25mlHd1WAhVIig9Ioud7GnR3NbGduycAMPTtJp06MipP4MIJIfWubnUQ+t1inLXXi0vniozciA/0Sg7jHfLc3bGihxNo8Xpi0d5V8XimDBFt8pizP5tcR0U0kiT/0Hgzm5rs6u51zAGNOAOYLV5bTmyCANehpbG3GDkeTaDtRz4qkTz123GBEWCDbhKcYWFqb7VZTtxxM03VkgUe+vHE2Kieq5/XYZ2YOaiFldv7C1OWLjvzWd//GCNq0SJMIM3FpbT5bcaEpuZYTzMl3tqopBeKYyZXtYjxhChGd040tiDZ7g2V64iSdMknPHjueHiexYZGclhIlQtHGzPYWBzChrRGmLdDQdmfjbHgAVUOa2e+RaS7DKOvOifYrFtsv3/6n7/7t/XTF+++oiTa5rGKCe9baIxOHEascZ3fXzvYyCaSQ6WltbLGy5RY01E2VsyIimh4TJ9FhkZhq2zKos1iZucXOzdhK1CgE08zc8sTxm2fjav/AHrRBtb3FJmQLF6iptsYxnJIqMCL4mNmbL88X3IK9neeZ0CtGxKFrfnF7WdpwiYyCmaNtt462oMl0Awpj5ZSYBB2eFh4gnl7/gnWamYXTzq2N0G6zyLK2tN3pXo+G91yqIUFz/7aScV642F5LTZKDSFtLOzCOl67ky3G3Ijl7ZVp6hGAOO6G4xHnFHRcAkYKJmZ97GhFv3YaGabKhRViIikvQmNQwASnqp7meWVIjAHQ21U23AjNY25odgDM3o/IUyRzS0abaKjlBd2Jt4nK7rbZhLu33lRambFeogSanJkppiO+R6ZIKWbO7wFsrxaTXrXg4jgiAQaLjT+N/I97GW2C3sfQgRCQSkBIfJiCsqZOwtjZaABzt9sY6i+gagNqe2KWOZto4W3WwkxFAWUhy4qtdE3Zbg+Vacas07OjssFOTrfbqlYVi+nPoA1XKwnqSi0vbKwFzW6mHKRZEImQ8/vQTeBTn8PYtBERwNJnbfsINdfVMRNzSSETTc112G1gaTZGpO0S0Ee0ThIF2Z0HKnMjr0Zgqqs92iwtn3PxQkDcOm6WJmh+r3SkmJfge3hiQM+WVRSqmoxgKsvmelBgEoxqRu0eMv9ZbpoUWK/O0pUay0eGxEZcgqhJTc4gZoM46TURNc9gOHTaBGYkl57hpevV2+kBPJMvLp5oaDGQKE6OMnmCIVVYwmW9/wDJZ9gju53s2+kJsmF0vbReVmBYlIumxiJtBeoapwEyb+RUJGZHrD9XU8Y/wj/KI+NTMgTCBtZgDhx5GZK6fttRR+xx2dzrtoprpMzPRHRYM9OnUJC2AI6pXioFiFHLPdl9wZpMB4DR7EQpWy3xckcT3bBTfDutDpeV41XPLjRCAK4gmSKiB4opnbm7M0J2nDuMXib7Ej8r/fyA8kKCUD0tBqI4c3Z3UBY0AbWxCRMJsDIqEIf1guF0dscd8nqKIQXe247J9Ku/1pYuAyVJTbV7xuJjZoZCDzlTy5VD1Bqc7GyHTY4oSIqocAD/FQgDue057w+TFgcvpunp7e5OjwzYt8Q2i5Pd8MyyvFDPv5Xp+YOgsi9//D391uckxulCiohczDVdme+5pKhvP/8+9e9lB6Pi0h4JMpkWkAECR/SGTv9u/SEq6WwgcTcDTZo/M3/idrdW7KBvrlXdws8G9/X3qrWolgT0PWeFZb6+1XCoRuWm2sW1IBhWU7PrN9D9u37OX4fD4waN/gzSICIBEKqa23/WGAIKeY/uQNLKbCfMUZrFgq52bHDaL8JtFdDDj8iZcVQsY8lJUe5sGSCA3OA4pnlzT1Z00JCtPtFEZpYiKtJdyhsvuPa0K62By52DN0Q0alDxETS1+fMkdAlD+fl+SHgWBxEg6JEWAQ9aWW2BnR+N0q1lj9y6xSXfJui/gT6Y5QCCKwyYt0gpASbqnmb0Yo2DCOTXuzbc+cad13qsEJYk4RJwOhdvaW30/Qtw4UPNw/dM3Y0ERB3VUlt4d94Ri4P7m3X0JgLOIwkSBtXr7rdvMwm0V1gkzcvfv1QDjS+kAFJd2FpZ9Ac2UautjcP+Q5aP0+fD0LJTEHXCjuS1ZbeLrnqQ32lt9F4RcdPTQw8gMx2/+zdkoxjKXLIfuhMgd35erxosmSlT6pIlRE6eqWGP7bTS3/93uMEudPfJ7NeInGN/ClaLft/jeB1eH45pe1YhYS5sCCliu+5uzZkZwN3/n+F+5nY1pxSXHmUo6GJH+Du3q49mj5j0UH6JDzwG8UP/wj/HjN0Pe14/tR1LTowRTJ6af1Uk6FVBrR2f77W5yOKGjuWO3x0TvBpBf8G2lVgAWty9dgXw8RsRjCjhZtIkNk/m5o08j4gsv3bkZcmWne9xS+dBMJqn2Mstvr009wnX0UIv10MMPIRFhXc2PMR91J799d18motOtTZw0fSqAL521djqgg27jXGGXiGalQ8mtu9WzmNxK+QmXtpcQF7jwwfaWdnIM0AB9TqyNI/rpx38F8aWnXboaKh/YdQfNapWkW+/rhSo8PxaBKJw93oLP8SF+XHCIfoyZZoqH9+f/6spMM+tcGWi0NhABUUtnR6udud052zPTM7Mu6v3+7lvr7i49uwIpn5/VQGplAVK+dDGfUWLSAuMz9Bi2vBWXwPQrL/080nM3DdZCmYO7bpdSySbTrnbnoyAL606TSnbd8PvFd4rQc4/zc2bzyTM+dR5zw3TXLx4+Ai2IVlvzLnWaLXpmskNEM+/8xOD9CjnrXcKUuTbOgWA8X0r5vVBKxweBLKHShts3pCSM4Ycef46Zf98zCEHO1ux63Nmhkjcqn1Nt8/3ikoBeMTfcqs0DgJeI6IWlf/of48P+P9R75vDLR1obSRr2dgVDdJNIfnDrJ3i/surs6a1UwK/ppwEGAVyVhVLSzcXlLP+9x76/wM5zHjfDcXfwdJRcWVtPZnao7Iqevo/Au3kvsPu5s4nK5hrz9f/69UlPGdbNioxGaH1id4aINgR/C+C9W6is/ZvTJ7148pQKVSF27jolvUiCbd/fTVFpr9fTgqMbp86dPH3qJK43OWfLgJ+/bDcYYGYwP4fe5Gb5HFz/1anoSPn/GF985wi0tu2K8WBDjhtwCzW1fyvOl/ckYjVnTp3E88LjbQBkN7H38hYoH/21v0U8ef7U6VdOnpi/WLiePvU5Tuv3SB3A/D2qmPnkOTgPJ+D6r0ePGIgYe/TwEfjKLuJTGx+ZALK8ZtZHZ/DkCSQ8s1c49Qqcu/6f3dtUH4DILjtawDdAnLOTr18/g3Di3IXxt+GVM/cVdtve8wsPMAsPTgg+jc4aiCB75uUjX0HE39v4qBoRvHLC1J7nCxDggW599QUxfXrv2w/sAnAGAOD82ydQ2Nc/Ydr7bD7Ou5wOkF6TLQbwAOMFYWXcliOlmSdfFoff+7X//Yhilp6gfzsj829nqo7wikgRIXgczfLt97bZCNI5fuXMvwn7+ifiDd077CJ5Thd2OSYvMAIR8dtXCgcizDKPzMJyvGspvHzW8se3mdGQxubAI7arGfXd2xpNB1RE3xPV+m7TC9vHH9/g5scHgUescl0AaQbkhXplNMu2er4+EHFWaGhghHDNrB8/Is2PY1v9NpFHBACNC6R5W/O27huN9Y9IU6M0yzatV9NB24v6G2h6hNrj3gPsIh1ofkSkWeyWmK1GrWdR2+mGAUQgZy4rsmAuqpnV3WjHQeq7mxq1+RG/NTdJY/ePeauINHn6IsZf1cZHgjECEUtpqm8U0SZt7N7cMxCRLC8mLOLqZd2NSj737vomUYNHRVRURFSbGpvq5QY2a/OjTSoqIqq6tf7K591O59Ttoqi1ZhUlXTCg3TTqx9ZvXLk5EKFGWMQ1Odld9dL0qKo2dclW04MA1qRqcEA3N6ntgyozd135/Majg7cmT4dJT7meu1iV8TnZJ2Ilm3JmVn/XViFjUn9gc2A+YcfG8JB2cRMz82Y5cAWbnxgMWJnkefqrTD6NA9ykynLA7BOxLCPIBq4bPmFtsyE/4Td7KrDcuAIcEpEDIqpd0vREkKbMrGRUeTMOMDc9YRCxMQDoLyt2/gvpa12bYfGkIQJReOdWBkzg80+/nBH96Q3e+WQQ+woLyRPeSc85CEw/hbc20FjE5lSbn0EDgO7bDDxpreuQkU+KPCEizPQAstOabUdVdvKTQRuLMG/tYhCH6SiDthjJoepypT1o2NxFuLPrUEPH1kGNGTMzAGYWDhrEjBKgA8zseGQXtATQb7mT8kCH8CDBTDWHQLFRKg0dEGYW2TQQ6cgWz9e1p0H6hAxcw7KXOkSCG8KO4FyYO0QauvqMN3QYiHQi4qEKeNjHzB1PPSnSsYwDUEmeiqoKfRUdJFRUO2xEpI9ZxLiKyI5CDC3Wf/Wzq30NT6lqx0vLGjpE9DaY631eb9g/1DigJ/QqNzz9lCpMVoMICBASAKpQBaz38VXuE94ndqyJDz2cdsIMjBkrYMtLy3QfK2B7ERJTUNvSwEaxCfSJGtfOociBrBOf7evb9/DTAISXvWTFwwilScfDSpw/O8F9+7Yo66aBocquXzVUeRoQE7y5j5kfFgmYKhABxNsPCLEtzFSNt2De0jOAIYx9+/rUCHlQ9x3BTVblLRIaU1W+ec3AKFW9enPffUOZA/1Cg/IglG8aYe2+BwVeQMTbD2wBoKo3Va+pfmaUKQxM+0Ob6TUWe/KoWhoBiBHMDzpGxtO4txvMzOSDOHLis2vMrCzSMzD0GYvcVCWjBlY5Yk33qy/VHWsGwNSUlfkaOevE2vX+gaHQCllu3ucQnYb7BYBIpzuWAU1ZSEE+D1W10aHS+q9L531Cz5JrIsaFVEE6hewqxFgcYxZyUomwq4ZQ0bmjU3aI3Nd5TbhTSEREOu2WxyzIkO+QB0U6hcXsVTgwxJr2kMHbIZ79XDhGO7DDmrOf7L82sxBDsfGmHWY8dwjJJUPpjOOOQOaq6z0DQ7b1mwCuM0T28xGWwEO6CRACdALOtX1IDwDXmYEdwH5ghwgEIiLgmbwf1Li/cOALwNRWXUdAY2uw6PFFviBS2VfFAM21dV9MptqvysyqWqj4P6kBAA==";

  // popup-svelte/components/MethodPicker.svelte
  MethodPicker[FILENAME] = "popup-svelte/components/MethodPicker.svelte";
  var root_1 = add_locations(from_html(\`
      <span class="icon svelte-3pu6qb5q6iq2r"><span class="spinner svelte-3pu6qb5q6iq2r"></span></span>
    \`, 1), MethodPicker[FILENAME], [[60, 6, [[60, 25]]]]);
  var root_3 = add_locations(from_html(\`
        <span class="badge svelte-3pu6qb5q6iq2r"> </span>
      \`, 1), MethodPicker[FILENAME], [[67, 8]]);
  var root_2 = add_locations(from_html(\`
      <span class="icon svelte-3pu6qb5q6iq2r">
        <img class="svelte-3pu6qb5q6iq2r"/>
      </span>
      <span class="name svelte-3pu6qb5q6iq2r"> </span>
      <!>
    \`, 1), MethodPicker[FILENAME], [[62, 6, [[63, 8]]], [65, 6]]);
  var root_6 = add_locations(from_html(\`
              <span class="badge svelte-3pu6qb5q6iq2r"> </span>
            \`, 1), MethodPicker[FILENAME], [[90, 14]]);
  var root_7 = add_locations(from_html(\`
              <span class="check svelte-3pu6qb5q6iq2r" aria-hidden="true"></span>
            \`, 1), MethodPicker[FILENAME], [[93, 14]]);
  var root_5 = add_locations(from_html(\`
        <li role="none">
          <!-- role="menuitemradio" + aria-checked: this menu picks exactly
               one payment method from a mutually-exclusive set; \\\`menuitem\\\`
               alone does not support aria-checked per WAI-ARIA. -->
          <button type="button" role="menuitemradio" class="svelte-3pu6qb5q6iq2r">
            <span class="icon svelte-3pu6qb5q6iq2r">
              <img class="svelte-3pu6qb5q6iq2r"/>
            </span>
            <span class="name svelte-3pu6qb5q6iq2r"> </span>
            <!>
            <!>
          </button>
        </li>
      \`, 1), MethodPicker[FILENAME], [[78, 8, [[82, 10, [[85, 12, [[86, 14]]], [88, 12]]]]]]);
  var root_4 = add_locations(from_html(\`
    <!-- A11y: Esc-key close + focus restore — see BACKLOG. Outside-click
         already wired via App.svelte's <svelte:document onclick> handler. -->
    <ul class="menu svelte-3pu6qb5q6iq2r" role="menu">
      <!>
    </ul>
  \`, 1), MethodPicker[FILENAME], [[76, 4]]);
  var root = add_locations(from_html(\`<!-- booster-plugins/packages/booster-checkout/popup-svelte/components/MethodPicker.svelte -->


<div class="picker svelte-3pu6qb5q6iq2r">
  <button type="button" class="trigger svelte-3pu6qb5q6iq2r" aria-haspopup="menu">
    <!>
    <span></span>
  </button>

  <!>
</div>

\`, 1), MethodPicker[FILENAME], [[54, 0, [[55, 2, [[70, 4]]]]]]);
  function MethodPicker($$anchor, $$props) {
    check_target(new.target);
    push($$props, true, MethodPicker);
    let selectedMethod = tag(user_derived(() => $$props.methods.find((m) => strict_equals(m.type, $$props.selectedType)) ?? $$props.methods[0]), "selectedMethod");
    user_effect(() => {
      if (strict_equals($$props.methods.length, 0))
        return;
      const found = $$props.methods.find((m) => strict_equals(m.type, $$props.selectedType));
      if (!found && strict_equals($$props.selectedType, "", false)) {
        console.warn(...log_if_contains_state("warn", "[booster-popup] MethodPicker: selectedType", $$props.selectedType, "not in methods", $$props.methods.map((m) => m.type)));
      }
    });
    function handleClickPicker(e) {
      e.stopPropagation();
      $$props.onToggle();
    }
    function handleSelect(type, e) {
      e.stopPropagation();
      $$props.onSelect(type);
    }
    var $$exports = { ...legacy_api() };
    var fragment = root();
    var node = first_child(fragment);
    var div = sibling(node, 2);
    var button = sibling(child(div));
    var node_1 = sibling(child(button));
    {
      var consequent = ($$anchor2) => {
        var fragment_1 = root_1();
        next(2);
        append($$anchor2, fragment_1);
      };
      var consequent_2 = ($$anchor2) => {
        var fragment_2 = root_2();
        var span = sibling(first_child(fragment_2));
        var img = sibling(child(span));
        next();
        reset(span);
        var span_1 = sibling(span, 2);
        var text2 = child(span_1, true);
        reset(span_1);
        var node_2 = sibling(span_1, 2);
        {
          var consequent_1 = ($$anchor3) => {
            var fragment_3 = root_3();
            var span_2 = sibling(first_child(fragment_3));
            var text_1 = child(span_2, true);
            reset(span_2);
            next();
            template_effect(() => set_text(text_1, get2(selectedMethod).badge));
            append($$anchor3, fragment_3);
          };
          add_svelte_meta(() => if_block(node_2, ($$render) => {
            if (get2(selectedMethod).badge)
              $$render(consequent_1);
          }), "if", MethodPicker, 66, 6);
        }
        next();
        template_effect(() => {
          set_attribute2(img, "src", get2(selectedMethod).imageUrl);
          set_attribute2(img, "alt", get2(selectedMethod).name);
          set_text(text2, get2(selectedMethod).name);
        });
        append($$anchor2, fragment_2);
      };
      add_svelte_meta(() => if_block(node_1, ($$render) => {
        if (strict_equals($$props.methods.length, 0) && $$props.loading && $$props.pastThreshold)
          $$render(consequent);
        else if (get2(selectedMethod))
          $$render(consequent_2, 1);
      }), "if", MethodPicker, 59, 4);
    }
    var span_3 = sibling(node_1, 2);
    let classes;
    html(span_3, () => ICON_CHEVRON_DOWN, true);
    reset(span_3);
    next();
    reset(button);
    var node_3 = sibling(button, 2);
    {
      var consequent_5 = ($$anchor2) => {
        var fragment_4 = root_4();
        var node_4 = sibling(first_child(fragment_4));
        var ul = sibling(node_4, 2);
        var node_5 = sibling(child(ul));
        add_svelte_meta(() => each(node_5, 17, () => $$props.methods, (method) => method.type, ($$anchor3, method) => {
          next();
          var fragment_5 = root_5();
          var li = sibling(first_child(fragment_5));
          let classes_1;
          var node_6 = sibling(child(li));
          var button_1 = sibling(node_6, 2);
          var span_4 = sibling(child(button_1));
          var img_1 = sibling(child(span_4));
          next();
          reset(span_4);
          var span_5 = sibling(span_4, 2);
          var text_2 = child(span_5, true);
          reset(span_5);
          var node_7 = sibling(span_5, 2);
          {
            var consequent_3 = ($$anchor4) => {
              var fragment_6 = root_6();
              var span_6 = sibling(first_child(fragment_6));
              var text_3 = child(span_6, true);
              reset(span_6);
              next();
              template_effect(() => set_text(text_3, get2(method).badge));
              append($$anchor4, fragment_6);
            };
            add_svelte_meta(() => if_block(node_7, ($$render) => {
              if (get2(method).badge)
                $$render(consequent_3);
            }), "if", MethodPicker, 89, 12);
          }
          var node_8 = sibling(node_7, 2);
          {
            var consequent_4 = ($$anchor4) => {
              var fragment_7 = root_7();
              var span_7 = sibling(first_child(fragment_7));
              html(span_7, () => ICON_CHECK, true);
              reset(span_7);
              next();
              append($$anchor4, fragment_7);
            };
            add_svelte_meta(() => if_block(node_8, ($$render) => {
              if (strict_equals(get2(method).type, $$props.selectedType))
                $$render(consequent_4);
            }), "if", MethodPicker, 92, 12);
          }
          next();
          reset(button_1);
          next();
          reset(li);
          next();
          template_effect(() => {
            classes_1 = set_class(li, 1, "item svelte-3pu6qb5q6iq2r", null, classes_1, {
              active: strict_equals(get2(method).type, $$props.selectedType)
            });
            set_attribute2(button_1, "aria-checked", strict_equals(get2(method).type, $$props.selectedType));
            set_attribute2(img_1, "src", get2(method).imageUrl);
            set_attribute2(img_1, "alt", get2(method).name);
            set_text(text_2, get2(method).name);
          });
          delegated("click", button_1, function click(e) {
            return handleSelect(get2(method).type, e);
          });
          append($$anchor3, fragment_5);
        }), "each", MethodPicker, 77, 6);
        next();
        reset(ul);
        next();
        append($$anchor2, fragment_4);
      };
      add_svelte_meta(() => if_block(node_3, ($$render) => {
        if ($$props.open)
          $$render(consequent_5);
      }), "if", MethodPicker, 73, 2);
    }
    next();
    reset(div);
    next();
    template_effect(() => {
      set_attribute2(button, "aria-expanded", $$props.open);
      classes = set_class(span_3, 1, "chevron svelte-3pu6qb5q6iq2r", null, classes, { open: $$props.open });
    });
    delegated("click", button, handleClickPicker);
    append($$anchor, fragment);
    return pop($$exports);
  }
  if (undefined) {}
  var MethodPicker_default = MethodPicker;
  delegate(["click"]);

  // ../../node_modules/.bun/typesafe-i18n@5.27.1+1fb4c65d43e298b9/node_modules/typesafe-i18n/runtime/esm/parser/src/basic.mjs
  var removeEmptyValues = (object) => Object.fromEntries(Object.entries(object).map(([key2, value]) => key2 !== "i" && value && value != "0" && [key2, value]).filter(Boolean));
  var trimAllValues = (part) => Object.fromEntries(Object.keys(part).map((key2) => {
    const val = part[key2];
    return [
      key2,
      Array.isArray(val) ? val.map((v) => v === null || v === undefined ? undefined : v.trim()) : val === !!val ? val : val === null || val === undefined ? undefined : val.trim()
    ];
  }));
  var parseArgumentPart = (text2) => {
    const [keyPart = "", ...formatterKeys] = text2.split("|");
    const [keyWithoutType = "", type] = keyPart.split(":");
    const [key2, isOptional] = keyWithoutType.split("?");
    return { k: key2, i: type, n: isOptional === "", f: formatterKeys };
  };
  var isBasicPluralPart = (part) => !!(part.o || part.r);
  var parsePluralPart = (content, lastAccessor) => {
    let [key2, values] = content.split(":");
    if (!values) {
      values = key2;
      key2 = lastAccessor;
    }
    const entries = values.split("|");
    const [zero, one, two, few, many, rest] = entries;
    const nrOfEntries = entries.filter((entry) => entry !== undefined).length;
    if (nrOfEntries === 1) {
      return { k: key2, r: zero };
    }
    if (nrOfEntries === 2) {
      return { k: key2, o: zero, r: one };
    }
    if (nrOfEntries === 3) {
      return { k: key2, z: zero, o: one, r: two };
    }
    return { k: key2, z: zero, o: one, t: two, f: few, m: many, r: rest };
  };
  var REGEX_SWITCH_CASE = /^\\{.*\\}$/;
  var parseCases = (text2) => Object.fromEntries(removeOuterBrackets(text2).split(",").map((part) => part.split(":")).reduce((accumulator, entry) => {
    if (entry.length === 2) {
      return [...accumulator, entry.map((entry2) => entry2.trim())];
    }
    accumulator[accumulator.length - 1][1] += "," + entry[0];
    return accumulator;
  }, []));
  var REGEX_BRACKETS_SPLIT = /(\\{(?:[^{}]+|\\{(?:[^{}]+)*\\})*\\})/g;
  var removeOuterBrackets = (text2) => text2.substring(1, text2.length - 1);
  var parseRawText = (rawText, optimize = true, firstKey = "", lastKey = "") => rawText.split(REGEX_BRACKETS_SPLIT).map((part) => {
    if (!part.match(REGEX_BRACKETS_SPLIT)) {
      return part;
    }
    const content = removeOuterBrackets(part);
    if (content.startsWith("{")) {
      return parsePluralPart(removeOuterBrackets(content), lastKey);
    }
    const parsedPart = parseArgumentPart(content);
    lastKey = parsedPart.k || lastKey;
    !firstKey && (firstKey = lastKey);
    return parsedPart;
  }).map((part) => {
    if (typeof part === "string")
      return part;
    if (!part.k)
      part.k = firstKey || "0";
    const trimmed = trimAllValues(part);
    return optimize ? removeEmptyValues(trimmed) : trimmed;
  });

  // ../../node_modules/.bun/typesafe-i18n@5.27.1+1fb4c65d43e298b9/node_modules/typesafe-i18n/runtime/esm/runtime/src/core.mjs
  var applyFormatters = (formatters, formatterKeys, initialValue) => formatterKeys.reduce((value, formatterKey) => {
    var _a, _b;
    return (_b = formatterKey.match(REGEX_SWITCH_CASE) ? ((cases) => {
      var _a2;
      return (_a2 = cases[value]) !== null && _a2 !== undefined ? _a2 : cases["*"];
    })(parseCases(formatterKey)) : (_a = formatters[formatterKey]) === null || _a === undefined ? undefined : _a.call(formatters, value)) !== null && _b !== undefined ? _b : value;
  }, initialValue);
  var getPlural = (pluralRules, { z, o, t, f, m, r }, value) => {
    switch (z && value == 0 ? "zero" : pluralRules.select(value)) {
      case "zero":
        return z;
      case "one":
        return o;
      case "two":
        return t;
      case "few":
        return f !== null && f !== undefined ? f : r;
      case "many":
        return m !== null && m !== undefined ? m : r;
      default:
        return r;
    }
  };
  var REGEX_PLURAL_VALUE_INJECTION = /\\?\\?/g;
  var applyArguments = (textParts, pluralRules, formatters, args) => textParts.map((part) => {
    if (typeof part === "string") {
      return part;
    }
    const { k: key2 = "0", f: formatterKeys = [] } = part;
    const value = args[key2];
    if (isBasicPluralPart(part)) {
      return ((typeof value === "boolean" ? value ? part.o : part.r : getPlural(pluralRules, part, value)) || "").replace(REGEX_PLURAL_VALUE_INJECTION, value);
    }
    const formattedValue = formatterKeys.length ? applyFormatters(formatters, formatterKeys, value) : value;
    return ("" + (formattedValue !== null && formattedValue !== undefined ? formattedValue : "")).trim();
  }).join("");
  var translate = (textParts, pluralRules, formatters, args) => {
    const firstArg = args[0];
    const isObject = firstArg && typeof firstArg === "object" && firstArg.constructor === Object;
    const transformedArgs = args.length === 1 && isObject ? firstArg : args;
    return applyArguments(textParts, pluralRules, formatters, transformedArgs);
  };
  // ../../node_modules/.bun/typesafe-i18n@5.27.1+1fb4c65d43e298b9/node_modules/typesafe-i18n/runtime/esm/runtime/src/util.string.mjs
  var getPartsFromString = (cache, text2) => cache[text2] || (cache[text2] = parseRawText(text2));

  // ../../node_modules/.bun/typesafe-i18n@5.27.1+1fb4c65d43e298b9/node_modules/typesafe-i18n/runtime/esm/runtime/src/util.object.mjs
  var getTranslateInstance = (locale, formatters) => {
    const cache = {};
    const pluralRules = new Intl.PluralRules(locale);
    return (text2, ...args) => translate(getPartsFromString(cache, text2), pluralRules, formatters, args);
  };
  function typesafeI18nObject(locale, translations, formatters = {}) {
    return createProxy(translations, getTranslateInstance(locale, formatters));
  }
  var wrap = (proxyObject = {}, translateFn) => typeof proxyObject === "string" ? translateFn.bind(null, proxyObject) : Object.assign(Object.defineProperty(() => "", "name", { writable: true }), proxyObject);
  var createProxy = (proxyObject, translateFn) => new Proxy(wrap(proxyObject, translateFn), {
    get: (target, key2) => {
      if (key2 === Symbol.iterator)
        return [][Symbol.iterator].bind(Object.values(target).map((entry) => wrap(entry, translateFn)));
      return createProxy(target[key2], translateFn);
    }
  });
  // src/generated/messages.ts
  var ru = {
    checkout: {
      amount: {
        placeholder: "Введите сумму"
      },
      error_screen: {
        retry: "Обновить",
        subtitle: "Попробуйте позже",
        title: "Не удалось загрузить методы оплаты"
      },
      footer: {
        secure_note: "Безопасно и конфиденциально"
      },
      header: {
        menu_button: "МЕНЮ"
      },
      info_row: {
        login: "Логин:",
        receive: "Получите:",
        total_will_be: "Итого на балансе будет"
      },
      keys: {
        purchase_window_taskbar_title: "Покупка ключа",
        purchase_window_title: "Покупка ключа — «{gameName:string}»"
      },
      menu: {
        faq: "FAQ",
        my_orders: "МОИ ЗАКАЗЫ",
        privacy: "ПОЛИТИКА",
        settings: "НАСТРОЙКИ",
        support: "ПОДДЕРЖКА",
        telegram: "ТЕЛЕГРАМ",
        terms: "СОГЛАШЕНИЕ"
      },
      pay_button: {
        calc_error: "Ошибка расчёта",
        calculating: "Расчёт...",
        default: "Оплатить",
        desired_too_low: "Желаемый баланс ниже текущего",
        network_error: "Ошибка сети",
        ready: "Оплатить {amount:string} ₽",
        submitting: "Загрузка..."
      },
      pay_error: {
        close_aria: "Закрыть",
        faq: "FAQ",
        generic: "Не удалось обработать запрос. Попробуйте позже или обратитесь в поддержку.",
        support: "Написать в поддержку",
        title: "Упс!"
      },
      payment_methods_error_toast: "Не удалось загрузить методы оплаты",
      popup: {
        button_label: "Пополнить",
        button_tooltip: "Пополнить баланс Steam",
        faq_window_title: "SteamBooster FAQ",
        orders_window_title: "Мои заказы — SteamBalance",
        privacy_window_title: "Политика конфиденциальности — SteamBalance",
        support_window_title: "Поддержка SteamBalance",
        terms_window_title: "Пользовательское соглашение — SteamBalance",
        window_title: "Пополнение аккаунта {login:string}",
        window_title_no_login: "Пополнение аккаунта"
      },
      promo: {
        button: "Каталог",
        title: "Игры дешевле"
      },
      total_input: {
        placeholder: "Желаемый баланс"
      }
    },
    general: {
      product_display_name: "SteamBooster"
    }
  };
  var messages_default = ru;

  // src/i18n.ts
  var LL = typesafeI18nObject("ru", messages_default);

  // popup-svelte/lib/numeric-input.ts
  function parseDigitsWithCaretPreservation(el) {
    const raw = el.value;
    const sepIdx = raw.search(/[.,]/);
    const truncated = sepIdx >= 0 ? raw.slice(0, sepIdx) : raw;
    const cleaned = truncated.replace(/\\D/g, "");
    if (raw !== cleaned) {
      const caret = el.selectionStart ?? raw.length;
      const caretInTruncated = Math.min(caret, truncated.length);
      const strippedBeforeCaret = truncated.slice(0, caretInTruncated).replace(/\\d/g, "").length;
      el.value = cleaned;
      const newCaret = Math.max(0, caretInTruncated - strippedBeforeCaret);
      el.setSelectionRange(newCaret, newCaret);
    }
    const n = parseInt(cleaned, 10);
    return Number.isFinite(n) && n > 0 ? n : 0;
  }

  // popup-svelte/components/AmountRow.svelte
  AmountRow[FILENAME] = "popup-svelte/components/AmountRow.svelte";
  var root2 = add_locations(from_html(\`<!-- booster-plugins/packages/booster-checkout/popup-svelte/components/AmountRow.svelte -->


<div class="row svelte-bcuwcmp5u0do">
  <div class="amount-cell svelte-bcuwcmp5u0do">
    <input class="amount-input svelte-bcuwcmp5u0do" type="text" inputmode="numeric" pattern="\\\\d*"/>
    <!-- Reserve space pre-init: render a placeholder ₽ with visibility
         hidden when userCurrency is null, so the input width is stable
         across the init message arrival. -->
    <span> </span>
  </div>
  <!>
</div>

\`, 1), AmountRow[FILENAME], [[38, 0, [[39, 2, [[40, 4], [52, 4]]]]]]);
  function AmountRow($$anchor, $$props) {
    check_target(new.target);
    push($$props, true, AmountRow);
    function handleInput(e) {
      const el = e.currentTarget;
      $$props.onAmountChange(parseDigitsWithCaretPreservation(el));
    }
    var $$exports = { ...legacy_api() };
    var fragment = root2();
    var node = first_child(fragment);
    var div = sibling(node, 2);
    var div_1 = sibling(child(div));
    var input = sibling(child(div_1));
    remove_input_defaults(input);
    var node_1 = sibling(input, 2);
    var span = sibling(node_1, 2);
    let classes;
    var text2 = child(span, true);
    reset(span);
    next();
    reset(div_1);
    var node_2 = sibling(div_1, 2);
    add_svelte_meta(() => MethodPicker_default(node_2, {
      get methods() {
        return $$props.methods;
      },
      get selectedType() {
        return $$props.methodSelectedType;
      },
      get open() {
        return $$props.methodOpen;
      },
      get loading() {
        return $$props.methodLoading;
      },
      get pastThreshold() {
        return $$props.methodPastThreshold;
      },
      get onToggle() {
        return $$props.onMethodToggle;
      },
      get onSelect() {
        return $$props.onMethodSelect;
      }
    }), "component", AmountRow, 54, 2, { componentTag: "MethodPicker" });
    next();
    reset(div);
    next();
    template_effect(($0) => {
      set_value(input, $$props.amount > 0 ? $$props.amount : "");
      set_attribute2(input, "placeholder", $0);
      classes = set_class(span, 1, "suffix svelte-bcuwcmp5u0do", null, classes, { invisible: !$$props.currencySymbol });
      set_text(text2, $$props.currencySymbol || "₽");
    }, [() => LL.checkout.amount.placeholder()]);
    event("focus", input, function focus(e) {
      return e.currentTarget.select();
    });
    delegated("input", input, handleInput);
    delegated("change", input, function(...$$args) {
      apply(() => $$props.onAmountCommit, this, $$args, AmountRow, [47, 16]);
    });
    append($$anchor, fragment);
    return pop($$exports);
  }
  if (undefined) {}
  var AmountRow_default = AmountRow;
  delegate(["input", "change"]);

  // ../../node_modules/.bun/svelte@5.55.9/node_modules/svelte/src/internal/flags/legacy.js
  enable_legacy_mode_flag();

  // popup-svelte/components/Footer.svelte
  Footer[FILENAME] = "popup-svelte/components/Footer.svelte";
  var root3 = add_locations(from_html(\`<!-- booster-plugins/packages/booster-checkout/popup-svelte/components/Footer.svelte -->


<footer class="footer svelte-2nmw93bwhumj2">
  <span class="icon svelte-2nmw93bwhumj2"></span>
  <span class="label svelte-2nmw93bwhumj2"> </span>
</footer>

\`, 1), Footer[FILENAME], [[7, 0, [[8, 2], [9, 2]]]]);
  function Footer($$anchor, $$props) {
    check_target(new.target);
    push($$props, false, Footer);
    var $$exports = { ...legacy_api() };
    init();
    var fragment = root3();
    var node = first_child(fragment);
    var footer = sibling(node, 2);
    var span = sibling(child(footer));
    html(span, () => ICON_SAFETY, true);
    reset(span);
    var span_1 = sibling(span, 2);
    var text2 = child(span_1, true);
    reset(span_1);
    next();
    reset(footer);
    next();
    template_effect(($0) => set_text(text2, $0), [() => LL.checkout.footer.secure_note()]);
    append($$anchor, fragment);
    return pop($$exports);
  }
  if (undefined) {}
  var Footer_default = Footer;

  // src/lib/currency.ts
  var CURRENCY_SYM = {
    RUB: "₽",
    KZT: "₸",
    USD: "$",
    EUR: "€",
    GBP: "£",
    UAH: "₴",
    JPY: "¥",
    KRW: "₩",
    TRY: "₺",
    INR: "₹",
    BRL: "R$",
    PLN: "zł",
    CZK: "Kč",
    HUF: "Ft",
    RON: "lei",
    CHF: "CHF",
    NOK: "kr",
    AZN: "ман",
    ILS: "₪",
    SAR: "SAR",
    AED: "AED",
    ZAR: "R",
    CLP: "CLP$",
    COP: "COL$",
    MXN: "Mex$",
    ARS: "ARS$",
    PEN: "S/.",
    TWD: "NT$",
    HKD: "HK$",
    THB: "฿",
    IDR: "Rp",
    MYR: "RM",
    PHP: "₱"
  };
  function currencySym(code) {
    if (code === null)
      return "";
    return CURRENCY_SYM[code] ?? code;
  }
  var DEFAULT_AMOUNT_BY_CURRENCY = {
    RUB: 1000,
    KZT: 7000,
    USD: 15
  };
  function defaultAmountForCurrency(code) {
    if (code == null)
      return 0;
    return DEFAULT_AMOUNT_BY_CURRENCY[code] ?? 0;
  }

  // popup-svelte/lib/state.svelte.ts
  var ui = tag_proxy(proxy({
    amount: 0,
    methodId: "",
    menuOpen: false,
    methodOpen: false,
    lastEdited: "pay",
    desiredBalance: 0,
    userLogin: "",
    userCurrency: null,
    userBalance: null,
    urls: {
      support: "",
      popupLogoLink: "",
      telegram: "",
      balanceCalcApi: "",
      balanceAddApi: ""
    },
    initSeen: false,
    emailReceived: false,
    uuidReceived: false,
    pendingPay: false,
    paymentMethods: [],
    paymentMethodsLoading: false,
    paymentMethodsError: null,
    calc: null,
    calcLoading: false,
    calcError: null,
    paySubmitting: false,
    payError: null
  }), "ui");
  function receiveAmount() {
    if (!ui.calc)
      return null;
    switch (ui.userCurrency) {
      case "USD":
        return ui.calc.amountToBalanceUSD;
      case "KZT":
        return ui.calc.amountToBalanceKZT;
      case "RUB":
        return ui.calc.amountToBalance;
      default:
        return null;
    }
  }
  function payAmountRub() {
    return ui.calc?.amount ?? null;
  }
  function validAmount() {
    if (!ui.calc)
      return false;
    return ui.amount >= ui.calc.minAmount && ui.amount <= ui.calc.maxAmount;
  }
  function clampAmountToCalcBounds() {
    if (!ui.calc)
      return;
    if (ui.amount > 0 && ui.amount < ui.calc.minAmount) {
      ui.amount = ui.calc.minAmount;
    } else if (ui.amount > ui.calc.maxAmount) {
      ui.amount = ui.calc.maxAmount;
    }
  }
  function payDisabled() {
    return ui.amount <= 0 || !ui.calc || !validAmount() || ui.calcLoading || strict_equals(ui.calcError, null, false) || ui.paySubmitting || !!ui.calc.notice || strict_equals(ui.paymentMethods.length, 0);
  }
  var methodHealHandler = null;
  function _setMethodHealHandler(fn) {
    methodHealHandler = fn;
  }
  function applyPaymentMethods(fresh) {
    const prevMethodId = ui.methodId;
    ui.paymentMethods = fresh;
    if (strict_equals(fresh.length, 0)) {
      ui.methodId = "";
      return;
    }
    if (!fresh.some((m) => strict_equals(m.type, ui.methodId))) {
      ui.methodId = fresh[0].type;
    }
    if (strict_equals(prevMethodId, "") && strict_equals(ui.methodId, "", false) && ui.amount > 0) {
      methodHealHandler?.();
    }
  }
  function formatMoney(n) {
    const fixed = n.toFixed(2);
    if (fixed.endsWith(".00"))
      return fixed.slice(0, -3);
    return fixed;
  }
  function derivedPay() {
    if (ui.desiredBalance <= 0)
      return 0;
    const balance = ui.userBalance ?? 0;
    const needed = ui.desiredBalance - balance;
    if (needed <= 0)
      return 0;
    return Math.ceil(needed);
  }
  function derivedDesiredFromPay() {
    if (!ui.calc || ui.calc.notice)
      return null;
    if (ui.amount <= 0)
      return null;
    const balance = ui.userBalance ?? 0;
    const receive = receiveAmount();
    if (strict_equals(receive, null))
      return null;
    return balance + receive;
  }

  // popup-svelte/components/Header.svelte
  Header[FILENAME] = "popup-svelte/components/Header.svelte";
  var root_12 = add_locations(from_html(\`
    <a class="logo-link svelte-1wz4py3st2cvt" target="_blank" rel="noopener noreferrer">
      <img class="logo svelte-1wz4py3st2cvt" alt="SteamBalance"/>
    </a>
  \`, 1), Header[FILENAME], [[25, 4, [[26, 6]]]]);
  var root_22 = add_locations(from_html(\`
    <!--
      Pre-init state: BC init message hasn't arrived yet (sub-100 ms cold
      path) — logo is non-interactive but visible. After init, popupLogoLink
      becomes a non-empty string and Svelte's reactive swap renders the <a>.
    -->
    <span class="logo-link svelte-1wz4py3st2cvt" aria-disabled="true">
      <img class="logo svelte-1wz4py3st2cvt" alt="SteamBalance"/>
    </span>
  \`, 1), Header[FILENAME], [[34, 4, [[35, 6]]]]);
  var root4 = add_locations(from_html(\`<!-- booster-plugins/packages/booster-checkout/popup-svelte/components/Header.svelte -->


<header class="header svelte-1wz4py3st2cvt">
  <!>
  <button type="button" class="menu-trigger svelte-1wz4py3st2cvt" aria-haspopup="menu">
    <span class="icon-gear svelte-1wz4py3st2cvt"></span>
    <span class="label svelte-1wz4py3st2cvt"> </span>
    <span></span>
  </button>
</header>

\`, 1), Header[FILENAME], [[23, 0, [[38, 2, [[42, 4], [43, 4], [44, 4]]]]]]);
  function Header($$anchor, $$props) {
    check_target(new.target);
    push($$props, true, Header);
    function handleClick(e) {
      e.stopPropagation();
      $$props.onMenuToggle();
    }
    var $$exports = { ...legacy_api() };
    var fragment = root4();
    var node = first_child(fragment);
    var header = sibling(node, 2);
    var node_1 = sibling(child(header));
    {
      var consequent = ($$anchor2) => {
        var fragment_1 = root_12();
        var a = sibling(first_child(fragment_1));
        var img = sibling(child(a));
        next();
        reset(a);
        next();
        template_effect(() => {
          set_attribute2(a, "href", ui.urls.popupLogoLink);
          set_attribute2(img, "src", IMG_LOGO_DATA_URI);
        });
        append($$anchor2, fragment_1);
      };
      var alternate = ($$anchor2) => {
        var fragment_2 = root_22();
        var node_2 = sibling(first_child(fragment_2));
        var span = sibling(node_2, 2);
        var img_1 = sibling(child(span));
        next();
        reset(span);
        next();
        template_effect(() => set_attribute2(img_1, "src", IMG_LOGO_DATA_URI));
        append($$anchor2, fragment_2);
      };
      add_svelte_meta(() => if_block(node_1, ($$render) => {
        if (ui.urls.popupLogoLink)
          $$render(consequent);
        else
          $$render(alternate, -1);
      }), "if", Header, 24, 2);
    }
    var button = sibling(node_1, 2);
    var span_1 = sibling(child(button));
    html(span_1, () => ICON_GEAR, true);
    reset(span_1);
    var span_2 = sibling(span_1, 2);
    var text2 = child(span_2, true);
    reset(span_2);
    var span_3 = sibling(span_2, 2);
    let classes;
    html(span_3, () => ICON_CHEVRON_DOWN, true);
    reset(span_3);
    next();
    reset(button);
    next();
    reset(header);
    next();
    template_effect(($0) => {
      set_attribute2(button, "aria-expanded", $$props.menuOpen);
      set_text(text2, $0);
      classes = set_class(span_3, 1, "chevron svelte-1wz4py3st2cvt", null, classes, { open: $$props.menuOpen });
    }, [() => LL.checkout.header.menu_button()]);
    delegated("click", button, handleClick);
    append($$anchor, fragment);
    return pop($$exports);
  }
  if (undefined) {}
  var Header_default = Header;
  delegate(["click"]);

  // popup-svelte/components/InfoRow.svelte
  InfoRow[FILENAME] = "popup-svelte/components/InfoRow.svelte";
  var root5 = add_locations(from_html(\`<!-- booster-plugins/packages/booster-checkout/popup-svelte/components/InfoRow.svelte -->


<div class="row svelte-1396edna6qnfv">
  <span class="label svelte-1396edna6qnfv"> </span>
  <span class="dots svelte-1396edna6qnfv"></span>
  <span class="value svelte-1396edna6qnfv"> </span>
</div>

\`, 1), InfoRow[FILENAME], [[10, 0, [[11, 2], [12, 2], [13, 2]]]]);
  function InfoRow($$anchor, $$props) {
    check_target(new.target);
    push($$props, true, InfoRow);
    var $$exports = { ...legacy_api() };
    var fragment = root5();
    var node = first_child(fragment);
    var div = sibling(node, 2);
    var span = sibling(child(div));
    var text2 = child(span, true);
    reset(span);
    var span_1 = sibling(span, 4);
    var text_1 = child(span_1, true);
    reset(span_1);
    next();
    reset(div);
    next();
    template_effect(() => {
      set_text(text2, $$props.label);
      set_text(text_1, $$props.value);
    });
    append($$anchor, fragment);
    return pop($$exports);
  }
  if (undefined) {}
  var InfoRow_default = InfoRow;

  // popup-svelte/components/MenuDropdown.svelte
  MenuDropdown[FILENAME] = "popup-svelte/components/MenuDropdown.svelte";
  var root_13 = add_locations(from_html(\`
    <li role="none">
      <button type="button" role="menuitem" class="row svelte-29y9fywxyagyi">
        <span class="icon svelte-29y9fywxyagyi"></span>
        <span class="label svelte-29y9fywxyagyi"> </span>
      </button>
    </li>
  \`, 1), MenuDropdown[FILENAME], [[48, 4, [[49, 6, [[50, 8], [51, 8]]]]]]);
  var root_23 = add_locations(from_html(\`
      <!-- Системный браузер: Steam CEF отдаёт внешние target=_blank ссылки в
           браузер ОС (как логотип в Header.svelte). onTelegram только закрывает
           меню — навигацию делает href. -->
      <a class="row svelte-29y9fywxyagyi" role="menuitem" target="_blank" rel="noopener noreferrer">
        <span class="icon svelte-29y9fywxyagyi"></span>
        <span class="label svelte-29y9fywxyagyi"> </span>
      </a>
    \`, 1), MenuDropdown[FILENAME], [[60, 6, [[62, 8], [63, 8]]]]);
  var root_32 = add_locations(from_html(\`
      <span class="row svelte-29y9fywxyagyi" aria-disabled="true">
        <span class="icon svelte-29y9fywxyagyi"></span>
        <span class="label svelte-29y9fywxyagyi"> </span>
      </span>
    \`, 1), MenuDropdown[FILENAME], [[66, 6, [[67, 8], [68, 8]]]]);
  var root_42 = add_locations(from_html(\`
    <li role="none">
      <button type="button" role="menuitem" class="row svelte-29y9fywxyagyi">
        <span class="icon svelte-29y9fywxyagyi"></span>
        <span class="label svelte-29y9fywxyagyi"> </span>
      </button>
    </li>
  \`, 1), MenuDropdown[FILENAME], [[91, 4, [[92, 6, [[93, 8], [94, 8]]]]]]);
  var root6 = add_locations(from_html(\`<!-- booster-plugins/packages/booster-checkout/popup-svelte/components/MenuDropdown.svelte -->


<!-- A11y: Esc-key + arrow-key navigation + focus restore: see BACKLOG. -->
<ul class="menu svelte-29y9fywxyagyi" role="menu">
  <li role="none">
    <button type="button" role="menuitem" class="row svelte-29y9fywxyagyi">
      <span class="icon svelte-29y9fywxyagyi"></span>
      <span class="label svelte-29y9fywxyagyi"> </span>
    </button>
  </li>
  <!>
  <li role="none">
    <!>
  </li>
  <li role="none">
    <button type="button" role="menuitem" class="row svelte-29y9fywxyagyi">
      <span class="icon svelte-29y9fywxyagyi"></span>
      <span class="label svelte-29y9fywxyagyi"> </span>
    </button>
  </li>
  <li role="none">
    <button type="button" role="menuitem" class="row svelte-29y9fywxyagyi">
      <span class="icon svelte-29y9fywxyagyi"></span>
      <span class="label svelte-29y9fywxyagyi"> </span>
    </button>
  </li>
  <li role="none">
    <button type="button" role="menuitem" class="row svelte-29y9fywxyagyi">
      <span class="icon svelte-29y9fywxyagyi"></span>
      <span class="label svelte-29y9fywxyagyi"> </span>
    </button>
  </li>
  <!>
</ul>

\`, 1), MenuDropdown[FILENAME], [
    [
      40,
      0,
      [
        [41, 2, [[42, 4, [[43, 6], [44, 6]]]]],
        [55, 2],
        [72, 2, [[73, 4, [[74, 6], [75, 6]]]]],
        [78, 2, [[79, 4, [[80, 6], [81, 6]]]]],
        [84, 2, [[85, 4, [[86, 6], [87, 6]]]]]
      ]
    ]
  ]);
  function MenuDropdown($$anchor, $$props) {
    check_target(new.target);
    push($$props, true, MenuDropdown);
    let showSettings = prop($$props, "showSettings", 3, false);
    var $$exports = { ...legacy_api() };
    var fragment = root6();
    var node = first_child(fragment);
    var node_1 = sibling(node, 2);
    var ul = sibling(node_1, 2);
    var li = sibling(child(ul));
    var button = sibling(child(li));
    var span = sibling(child(button));
    html(span, () => ICON_BOX, true);
    reset(span);
    var span_1 = sibling(span, 2);
    var text2 = child(span_1, true);
    reset(span_1);
    next();
    reset(button);
    next();
    reset(li);
    var node_2 = sibling(li, 2);
    {
      var consequent = ($$anchor2) => {
        var fragment_1 = root_13();
        var li_1 = sibling(first_child(fragment_1));
        var button_1 = sibling(child(li_1));
        var span_2 = sibling(child(button_1));
        html(span_2, () => ICON_SUPPORT, true);
        reset(span_2);
        var span_3 = sibling(span_2, 2);
        var text_1 = child(span_3, true);
        reset(span_3);
        next();
        reset(button_1);
        next();
        reset(li_1);
        next();
        template_effect(($0) => set_text(text_1, $0), [() => LL.checkout.menu.support()]);
        delegated("click", button_1, function(...$$args) {
          apply(() => $$props.onSupport, this, $$args, MenuDropdown, [49, 65]);
        });
        append($$anchor2, fragment_1);
      };
      add_svelte_meta(() => if_block(node_2, ($$render) => {
        if ($$props.supportUrl)
          $$render(consequent);
      }), "if", MenuDropdown, 47, 2);
    }
    var li_2 = sibling(node_2, 2);
    var node_3 = sibling(child(li_2));
    {
      var consequent_1 = ($$anchor2) => {
        var fragment_2 = root_23();
        var node_4 = sibling(first_child(fragment_2));
        var a = sibling(node_4, 2);
        var span_4 = sibling(child(a));
        html(span_4, () => ICON_TELEGRAM, true);
        reset(span_4);
        var span_5 = sibling(span_4, 2);
        var text_2 = child(span_5, true);
        reset(span_5);
        next();
        reset(a);
        next();
        template_effect(($0) => {
          set_attribute2(a, "href", $$props.telegramUrl);
          set_text(text_2, $0);
        }, [() => LL.checkout.menu.telegram()]);
        delegated("click", a, function(...$$args) {
          apply(() => $$props.onTelegram, this, $$args, MenuDropdown, [61, 60]);
        });
        append($$anchor2, fragment_2);
      };
      var alternate = ($$anchor2) => {
        var fragment_3 = root_32();
        var span_6 = sibling(first_child(fragment_3));
        var span_7 = sibling(child(span_6));
        html(span_7, () => ICON_TELEGRAM, true);
        reset(span_7);
        var span_8 = sibling(span_7, 2);
        var text_3 = child(span_8, true);
        reset(span_8);
        next();
        reset(span_6);
        next();
        template_effect(($0) => set_text(text_3, $0), [() => LL.checkout.menu.telegram()]);
        append($$anchor2, fragment_3);
      };
      add_svelte_meta(() => if_block(node_3, ($$render) => {
        if ($$props.telegramUrl)
          $$render(consequent_1);
        else
          $$render(alternate, -1);
      }), "if", MenuDropdown, 56, 4);
    }
    next();
    reset(li_2);
    var li_3 = sibling(li_2, 2);
    var button_2 = sibling(child(li_3));
    var span_9 = sibling(child(button_2));
    html(span_9, () => ICON_DOCUMENT, true);
    reset(span_9);
    var span_10 = sibling(span_9, 2);
    var text_4 = child(span_10, true);
    reset(span_10);
    next();
    reset(button_2);
    next();
    reset(li_3);
    var li_4 = sibling(li_3, 2);
    var button_3 = sibling(child(li_4));
    var span_11 = sibling(child(button_3));
    html(span_11, () => ICON_DOCUMENT, true);
    reset(span_11);
    var span_12 = sibling(span_11, 2);
    var text_5 = child(span_12, true);
    reset(span_12);
    next();
    reset(button_3);
    next();
    reset(li_4);
    var li_5 = sibling(li_4, 2);
    var button_4 = sibling(child(li_5));
    var span_13 = sibling(child(button_4));
    html(span_13, () => ICON_FAQ, true);
    reset(span_13);
    var span_14 = sibling(span_13, 2);
    var text_6 = child(span_14, true);
    reset(span_14);
    next();
    reset(button_4);
    next();
    reset(li_5);
    var node_5 = sibling(li_5, 2);
    {
      var consequent_2 = ($$anchor2) => {
        var fragment_4 = root_42();
        var li_6 = sibling(first_child(fragment_4));
        var button_5 = sibling(child(li_6));
        var span_15 = sibling(child(button_5));
        html(span_15, () => ICON_SETTINGS, true);
        reset(span_15);
        var span_16 = sibling(span_15, 2);
        var text_7 = child(span_16, true);
        reset(span_16);
        next();
        reset(button_5);
        next();
        reset(li_6);
        next();
        template_effect(($0) => set_text(text_7, $0), [() => LL.checkout.menu.settings()]);
        delegated("click", button_5, function(...$$args) {
          apply(() => $$props.onSettings, this, $$args, MenuDropdown, [92, 65]);
        });
        append($$anchor2, fragment_4);
      };
      add_svelte_meta(() => if_block(node_5, ($$render) => {
        if (showSettings())
          $$render(consequent_2);
      }), "if", MenuDropdown, 90, 2);
    }
    next();
    reset(ul);
    next();
    template_effect(($0, $1, $2, $3) => {
      set_text(text2, $0);
      set_text(text_4, $1);
      set_text(text_5, $2);
      set_text(text_6, $3);
    }, [
      () => LL.checkout.menu.my_orders(),
      () => LL.checkout.menu.terms(),
      () => LL.checkout.menu.privacy(),
      () => LL.checkout.menu.faq()
    ]);
    delegated("click", button, function(...$$args) {
      apply(() => $$props.onOrders, this, $$args, MenuDropdown, [42, 63]);
    });
    delegated("click", button_2, function(...$$args) {
      apply(() => $$props.onTerms, this, $$args, MenuDropdown, [73, 63]);
    });
    delegated("click", button_3, function(...$$args) {
      apply(() => $$props.onPrivacy, this, $$args, MenuDropdown, [79, 63]);
    });
    delegated("click", button_4, function(...$$args) {
      apply(() => $$props.onFaq, this, $$args, MenuDropdown, [85, 63]);
    });
    append($$anchor, fragment);
    return pop($$exports);
  }
  if (undefined) {}
  var MenuDropdown_default = MenuDropdown;
  delegate(["click"]);

  // popup-svelte/components/PayButton.svelte
  PayButton[FILENAME] = "popup-svelte/components/PayButton.svelte";
  var root7 = add_locations(from_html(\`<!-- booster-plugins/packages/booster-checkout/popup-svelte/components/PayButton.svelte -->


<button class="pay svelte-3z2n6p7emyyh" type="button"> </button>

\`, 1), PayButton[FILENAME], [[17, 0]]);
  function PayButton($$anchor, $$props) {
    check_target(new.target);
    push($$props, true, PayButton);
    function handleClick(e) {
      e.stopPropagation();
      if ($$props.disabled)
        return;
      $$props.onClick?.();
    }
    var $$exports = { ...legacy_api() };
    var fragment = root7();
    var node = first_child(fragment);
    var button = sibling(node, 2);
    var text2 = child(button);
    reset(button);
    next();
    template_effect(() => {
      button.disabled = $$props.disabled;
      set_text(text2, \`
  \${$$props.label ?? ""}
\`);
    });
    delegated("click", button, handleClick);
    append($$anchor, fragment);
    return pop($$exports);
  }
  if (undefined) {}
  var PayButton_default = PayButton;
  delegate(["click"]);

  // popup-svelte/components/PayErrorModal.svelte
  PayErrorModal[FILENAME] = "popup-svelte/components/PayErrorModal.svelte";
  var root8 = add_locations(from_html(\`<!-- booster-plugins/packages/booster-checkout/popup-svelte/components/PayErrorModal.svelte -->


<div class="pe-overlay svelte-vlfjpr04kqzc" role="presentation">
  <div class="pe-scrim svelte-vlfjpr04kqzc"></div>
  <div class="pe-card svelte-vlfjpr04kqzc" role="alertdialog" aria-modal="true">
    <button type="button" class="pe-close svelte-vlfjpr04kqzc">
      <!>
    </button>
    <div class="pe-text svelte-vlfjpr04kqzc">
      <span class="pe-title svelte-vlfjpr04kqzc"> </span>
      <span class="pe-body svelte-vlfjpr04kqzc"> </span>
    </div>
    <div class="pe-actions svelte-vlfjpr04kqzc">
      <button type="button" class="pe-btn svelte-vlfjpr04kqzc"> </button>
      <button type="button" class="pe-btn svelte-vlfjpr04kqzc"> </button>
    </div>
  </div>
</div>

\`, 1), PayErrorModal[FILENAME], [
    [
      19,
      0,
      [
        [20, 2],
        [
          21,
          2,
          [
            [22, 4],
            [25, 4, [[26, 6], [27, 6]]],
            [29, 4, [[30, 6], [31, 6]]]
          ]
        ]
      ]
    ]
  ]);
  function PayErrorModal($$anchor, $$props) {
    check_target(new.target);
    push($$props, true, PayErrorModal);
    const body = tag(user_derived(() => $$props.message.replace(/\\r\\n/g, \`
\`)), "body");
    var $$exports = { ...legacy_api() };
    var fragment = root8();
    var node = first_child(fragment);
    var div = sibling(node, 2);
    var div_1 = sibling(child(div), 3);
    var button = sibling(child(div_1));
    var node_1 = sibling(child(button));
    html(node_1, () => ICON_CLOSE);
    next();
    reset(button);
    var div_2 = sibling(button, 2);
    var span = sibling(child(div_2));
    var text2 = child(span, true);
    reset(span);
    var span_1 = sibling(span, 2);
    var text_1 = child(span_1, true);
    reset(span_1);
    next();
    reset(div_2);
    var div_3 = sibling(div_2, 2);
    var button_1 = sibling(child(div_3));
    var text_2 = child(button_1, true);
    reset(button_1);
    var button_2 = sibling(button_1, 2);
    var text_3 = child(button_2, true);
    reset(button_2);
    next();
    reset(div_3);
    next();
    reset(div_1);
    next();
    reset(div);
    next();
    template_effect(($0, $1, $2, $3) => {
      set_attribute2(button, "aria-label", $0);
      set_text(text2, $1);
      set_text(text_1, get2(body));
      set_text(text_2, $2);
      set_text(text_3, $3);
    }, [
      () => LL.checkout.pay_error.close_aria(),
      () => LL.checkout.pay_error.title(),
      () => LL.checkout.pay_error.faq(),
      () => LL.checkout.pay_error.support()
    ]);
    delegated("click", button, function(...$$args) {
      apply(() => $$props.onClose, this, $$args, PayErrorModal, [22, 100]);
    });
    delegated("click", button_1, function(...$$args) {
      apply(() => $$props.onFaq, this, $$args, PayErrorModal, [30, 52]);
    });
    delegated("click", button_2, function(...$$args) {
      apply(() => $$props.onSupport, this, $$args, PayErrorModal, [31, 52]);
    });
    append($$anchor, fragment);
    return pop($$exports);
  }
  if (undefined) {}
  var PayErrorModal_default = PayErrorModal;
  delegate(["click"]);

  // popup-svelte/components/PaymentMethodsError.svelte
  PaymentMethodsError[FILENAME] = "popup-svelte/components/PaymentMethodsError.svelte";
  var root9 = add_locations(from_html(\`<!-- booster-plugins/packages/booster-checkout/popup-svelte/components/PaymentMethodsError.svelte -->


<!-- No icon. None of the existing icons (SAFETY, BOX, GEAR, SUPPORT,
     CHEVRON_DOWN) read as "error" — SAFETY belongs to Footer, the
     rest are semantically wrong here. Title + subtitle are unambiguous
     in Russian; if a dedicated error/cloud-off icon is wanted later,
     add the asset under packages/booster-checkout/assets/icons/ and wire it through
     build-popup.ts. -->
<div class="error svelte-tx6kxlh5kmy6">
  <h2 class="title svelte-tx6kxlh5kmy6"> </h2>
  <p class="subtitle svelte-tx6kxlh5kmy6"> </p>
  <button type="button" class="btn-refresh svelte-tx6kxlh5kmy6"> </button>
</div>

\`, 1), PaymentMethodsError[FILENAME], [[17, 0, [[18, 2], [19, 2], [20, 2]]]]);
  function PaymentMethodsError($$anchor, $$props) {
    check_target(new.target);
    push($$props, true, PaymentMethodsError);
    var $$exports = { ...legacy_api() };
    var fragment = root9();
    var node = first_child(fragment);
    var node_1 = sibling(node, 2);
    var div = sibling(node_1, 2);
    var h2 = sibling(child(div));
    var text2 = child(h2, true);
    reset(h2);
    var p = sibling(h2, 2);
    var text_1 = child(p, true);
    reset(p);
    var button = sibling(p, 2);
    var text_2 = child(button);
    reset(button);
    next();
    reset(div);
    next();
    template_effect(($0, $1, $2) => {
      set_text(text2, $0);
      set_text(text_1, $1);
      set_text(text_2, \`
    \${$2 ?? ""}
  \`);
    }, [
      () => LL.checkout.error_screen.title(),
      () => LL.checkout.error_screen.subtitle(),
      () => LL.checkout.error_screen.retry()
    ]);
    delegated("click", button, function(...$$args) {
      apply(() => $$props.onRefresh, this, $$args, PaymentMethodsError, [20, 53]);
    });
    append($$anchor, fragment);
    return pop($$exports);
  }
  if (undefined) {}
  var PaymentMethodsError_default = PaymentMethodsError;
  delegate(["click"]);

  // popup-svelte/components/TotalBox.svelte
  TotalBox[FILENAME] = "popup-svelte/components/TotalBox.svelte";
  var root_14 = add_locations(from_html(\`
      <input class="desired-input svelte-3rcvu548pqj64" type="text" inputmode="numeric" pattern="\\\\d*"/>
    \`, 1), TotalBox[FILENAME], [[40, 6]]);
  var root_24 = add_locations(from_html(\`
      <span class="amount-static svelte-3rcvu548pqj64"> </span>
    \`, 1), TotalBox[FILENAME], [[50, 6]]);
  var root10 = add_locations(from_html(\`<!-- booster-plugins/packages/booster-checkout/popup-svelte/components/TotalBox.svelte -->


<!--
  Figma 252:12 split-frame: left label-cell (transparent fill, 2 px
  border, left corners rounded), right input-cell (#3d4450 fill, no
  border, right corners rounded). The seam is invisible because the
  right cell's background equals the left cell's border color — DO NOT
  add border-right on the left or border-left on the right; the design
  intentionally lets fill continue the border.
-->
<div class="box svelte-3rcvu548pqj64">
  <span class="label-cell svelte-3rcvu548pqj64"><span class="label svelte-3rcvu548pqj64"> </span></span>
  <span class="input-cell svelte-3rcvu548pqj64">
    <!>
    <!-- Suffix is ALWAYS rendered — same pattern as AmountRow. Lives
         outside the {#if} so editable and read-only modes share the
         same \\\`number + suffix\\\` layout (figma Frame_1000003045 green
         #2ee4a2 for both digits and currency glyph). Hidden via
         \\\`visibility: hidden\\\` when currencySymbol is empty (pre-init
         window — keeps width stable across the BC init arrival). -->
    <span> </span>
  </span>
</div>

\`, 1), TotalBox[FILENAME], [[36, 0, [[37, 2, [[37, 27]]], [38, 2, [[58, 4]]]]]]);
  function TotalBox($$anchor, $$props) {
    check_target(new.target);
    push($$props, true, TotalBox);
    function handleInput(e) {
      const el = e.currentTarget;
      $$props.onInput(parseDigitsWithCaretPreservation(el));
    }
    var $$exports = { ...legacy_api() };
    var fragment = root10();
    var node = first_child(fragment);
    var node_1 = sibling(node, 2);
    var div = sibling(node_1, 2);
    var span = sibling(child(div));
    var span_1 = child(span);
    var text2 = child(span_1, true);
    reset(span_1);
    reset(span);
    var span_2 = sibling(span, 2);
    var node_2 = sibling(child(span_2));
    {
      var consequent = ($$anchor2) => {
        var fragment_1 = root_14();
        var input = sibling(first_child(fragment_1));
        remove_input_defaults(input);
        next();
        template_effect(() => {
          set_value(input, $$props.displayValue);
          set_attribute2(input, "placeholder", $$props.placeholder);
        });
        event("focus", input, function focus(e) {
          return e.currentTarget.select();
        });
        delegated("input", input, handleInput);
        delegated("change", input, function(...$$args) {
          apply(() => $$props.onCommit, this, $$args, TotalBox, [47, 18]);
        });
        append($$anchor2, fragment_1);
      };
      var alternate = ($$anchor2) => {
        var fragment_2 = root_24();
        var span_3 = sibling(first_child(fragment_2));
        var text_1 = child(span_3, true);
        reset(span_3);
        next();
        template_effect(() => set_text(text_1, $$props.displayValue));
        append($$anchor2, fragment_2);
      };
      add_svelte_meta(() => if_block(node_2, ($$render) => {
        if ($$props.editable)
          $$render(consequent);
        else
          $$render(alternate, -1);
      }), "if", TotalBox, 39, 4);
    }
    var node_3 = sibling(node_2, 2);
    var span_4 = sibling(node_3, 2);
    let classes;
    var text_2 = child(span_4, true);
    reset(span_4);
    next();
    reset(span_2);
    next();
    reset(div);
    next();
    template_effect(() => {
      set_text(text2, $$props.label);
      classes = set_class(span_4, 1, "suffix svelte-3rcvu548pqj64", null, classes, { invisible: !$$props.currencySymbol });
      set_text(text_2, $$props.currencySymbol || "₽");
    });
    append($$anchor, fragment);
    return pop($$exports);
  }
  if (undefined) {}
  var TotalBox_default = TotalBox;
  delegate(["input", "change"]);

  // popup-svelte/lib/headers.ts
  function getBoosterHeaders(contentType) {
    const vers = typeof window !== "undefined" ? window.__SB_BOOSTER_VERSIONS__ : undefined;
    const injector = typeof vers?.injector === "string" ? vers.injector : "";
    const framework = typeof vers?.framework === "string" ? vers.framework : "";
    const pluginVersion = "1.0.2";
    const uuid = typeof window !== "undefined" && typeof window.__SB_BOOSTER_UUID__ === "string" ? window.__SB_BOOSTER_UUID__ : "";
    const h = { "x-booster": "true" };
    if (injector && !/[\\r\\n]/.test(injector))
      h["x-booster-injector"] = injector;
    if (framework && !/[\\r\\n]/.test(framework))
      h["x-booster-framework"] = framework;
    if (uuid && !/[\\r\\n]/.test(uuid))
      h["x-booster-uuid"] = uuid;
    if (pluginVersion && !/[\\r\\n]/.test(pluginVersion))
      h["x-booster-plugins"] = \`booster-checkout@\${pluginVersion}\`;
    if (contentType && !/[\\r\\n]/.test(contentType))
      h["Content-Type"] = contentType;
    return h;
  }

  // popup-svelte/lib/api.ts
  var calcId = 0;
  var timer;
  function scheduleCalc() {
    clearTimeout(timer);
    ui.calcLoading = true;
    timer = setTimeout(runCalc, 400);
  }
  function cancelPendingCalc() {
    if (timer !== undefined) {
      clearTimeout(timer);
      timer = undefined;
    }
  }
  async function runCalc() {
    const myId = ++calcId;
    if (ui.amount <= 0 || !ui.urls.balanceCalcApi || !ui.methodId || !ui.userLogin) {
      ui.calc = null;
      ui.calcLoading = false;
      ui.calcError = null;
      return;
    }
    ui.calcLoading = true;
    ui.calcError = null;
    try {
      const r = await fetch(ui.urls.balanceCalcApi, {
        method: "POST",
        headers: getBoosterHeaders("application/json"),
        body: JSON.stringify({
          amount: ui.amount,
          paymentId: ui.methodId,
          login: ui.userLogin,
          currency: ui.userCurrency ?? "RUB"
        })
      });
      if (myId !== calcId)
        return;
      if (!r.ok) {
        ui.calcError = \`HTTP \${r.status}\`;
        return;
      }
      const body = await r.json();
      ui.calc = body.data;
    } catch {
      if (myId !== calcId)
        return;
      ui.calcError = "network";
    } finally {
      if (myId === calcId)
        ui.calcLoading = false;
    }
  }
  _setMethodHealHandler(scheduleCalc);
  async function submitPay(email) {
    if (!ui.urls.balanceAddApi || !ui.userLogin)
      return null;
    const body = {
      paymentId: ui.methodId,
      amount: ui.amount,
      login: ui.userLogin,
      currency: ui.userCurrency ?? "RUB",
      ...email ? { email } : {}
    };
    ui.paySubmitting = true;
    try {
      const r = await fetch(ui.urls.balanceAddApi, {
        method: "POST",
        headers: getBoosterHeaders("application/json"),
        body: JSON.stringify(body)
      });
      let respBody = null;
      try {
        respBody = await r.json();
      } catch {
        respBody = null;
      }
      if (!r.ok || respBody && respBody.success === false) {
        ui.payError = respBody && typeof respBody.message === "string" && respBody.message ? respBody.message : LL.checkout.pay_error.generic();
        return null;
      }
      const redirectUrl = respBody?.data?.redirectUrl ?? respBody?.redirectUrl ?? null;
      const uid2 = respBody?.data?.uid ?? respBody?.uid ?? null;
      return { redirectUrl, uid: uid2 };
    } catch {
      ui.payError = LL.checkout.pay_error.generic();
      return null;
    } finally {
      ui.paySubmitting = false;
    }
  }

  // popup-svelte/lib/desired-debounce.ts
  var pending3 = null;
  var DEBOUNCE_MS = 400;
  function scheduleDesiredCommit(commit) {
    if (pending3 !== null)
      clearTimeout(pending3.timer);
    ui.calcLoading = true;
    const timer2 = setTimeout(() => {
      pending3 = null;
      commit();
    }, DEBOUNCE_MS);
    pending3 = { timer: timer2, commit };
  }
  function cancelDesiredCommit() {
    if (pending3 !== null) {
      clearTimeout(pending3.timer);
      pending3 = null;
    }
  }

  // popup-svelte/lib/bridge.ts
  var POPUP_ID = "booster-checkout__sb_topup";
  var CHANNEL = "sb_cmd";
  var bc = null;
  var email = "";
  function initBridge() {
    if (bc)
      return;
    bc = new BroadcastChannel(CHANNEL);
    bc.addEventListener("message", (e) => {
      const m = e.data;
      if (!m || typeof m !== "object")
        return;
      if (m.popupId !== POPUP_ID)
        return;
      if (m.kind !== "popup-postMessage")
        return;
      const d = m.data;
      if (!d || typeof d !== "object")
        return;
      handleIncoming(d);
    });
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "hidden")
          resetTransientUI();
      });
    }
  }
  function resetTransientUI(prefillAmount = null) {
    cancelPendingCalc();
    cancelDesiredCommit();
    ui.amount = prefillAmount !== null ? prefillAmount : defaultAmountForCurrency(ui.userCurrency);
    ui.menuOpen = false;
    ui.methodOpen = false;
    ui.calc = null;
    ui.calcError = null;
    ui.calcLoading = false;
    ui.pendingPay = false;
    ui.payError = null;
    ui.lastEdited = "pay";
    ui.desiredBalance = 0;
  }
  function handleIncoming(d) {
    if (d.kind === "init") {
      if (typeof d.login === "string" && d.login)
        ui.userLogin = d.login;
      if (typeof d.currency === "string" && d.currency)
        ui.userCurrency = d.currency;
      if (typeof d.balance === "number" && Number.isFinite(d.balance))
        ui.userBalance = d.balance;
      const urls = d.urls;
      if (urls && typeof urls === "object") {
        const u = urls;
        if (typeof u.support === "string")
          ui.urls.support = u.support;
        if (typeof u.popupLogoLink === "string")
          ui.urls.popupLogoLink = u.popupLogoLink;
        if (typeof u.telegram === "string")
          ui.urls.telegram = u.telegram;
        if (typeof u.balanceCalcApi === "string")
          ui.urls.balanceCalcApi = u.balanceCalcApi;
        if (typeof u.balanceAddApi === "string")
          ui.urls.balanceAddApi = u.balanceAddApi;
      }
      const versions = d.versions;
      if (versions && typeof versions === "object" && typeof window !== "undefined") {
        const vv = versions;
        const ok = (x) => typeof x === "string" && x.length > 0 && !/[\\r\\n]/.test(x);
        const w = window;
        const cur = w.__SB_BOOSTER_VERSIONS__ ?? {};
        w.__SB_BOOSTER_VERSIONS__ = {
          injector: ok(vv.injector) ? vv.injector : cur.injector,
          framework: ok(vv.framework) ? vv.framework : cur.framework
        };
      }
      const rawUuid = d.uuid;
      if (typeof rawUuid === "string" && rawUuid.length > 0 && !/[\\r\\n]/.test(rawUuid)) {
        if (typeof window !== "undefined")
          window.__SB_BOOSTER_UUID__ = rawUuid;
        ui.uuidReceived = true;
      }
      if (d.uuidResolved === true) {
        ui.uuidReceived = true;
      }
      ui.initSeen = !!(ui.userLogin && ui.urls.balanceAddApi);
      if (ui.amount === 0) {
        ui.amount = defaultAmountForCurrency(ui.userCurrency);
      }
    } else if (d.kind === "payment-methods") {
      const methods = Array.isArray(d.methods) ? d.methods.filter((x) => x !== null && typeof x === "object" && typeof x.type === "string" && typeof x.name === "string" && typeof x.imageUrl === "string") : [];
      applyPaymentMethods(methods);
      ui.paymentMethodsLoading = !!d.loading;
      ui.paymentMethodsError = typeof d.error === "string" && d.error ? d.error : null;
    } else if (d.kind === "email") {
      email = typeof d.email === "string" ? d.email : "";
      ui.emailReceived = true;
    } else if (d.kind === "hidden") {
      resetTransientUI();
    } else if (d.kind === "shown") {
      const rawPrefill = d.prefillAmount;
      const prefillAmount = typeof rawPrefill === "number" && Number.isFinite(rawPrefill) && rawPrefill > 0 ? Math.floor(rawPrefill) : null;
      resetTransientUI(prefillAmount);
      scheduleCalc();
      queueMicrotask(() => {
        if (typeof document === "undefined")
          return;
        const inp = document.querySelector(".amount-input");
        inp?.focus?.();
      });
    }
    if (ui.pendingPay && ui.initSeen && ui.emailReceived && ui.uuidReceived) {
      ui.pendingPay = false;
      payAndNavigate();
    }
  }
  function postSupport() {
    if (!bc)
      return;
    bc.postMessage({ kind: "popup-message", popupId: POPUP_ID, data: { kind: "support" } });
  }
  function postOpenDoc(doc) {
    if (!bc)
      return;
    bc.postMessage({ kind: "popup-message", popupId: POPUP_ID, data: { kind: "open-doc", doc } });
  }
  function postOpenCatalog() {
    if (!bc)
      return;
    bc.postMessage({ kind: "popup-message", popupId: POPUP_ID, data: { kind: "open-catalog" } });
  }
  function postFaq() {
    postOpenDoc("faq");
  }
  function postMenuAction(action2) {
    if (!bc)
      return;
    bc.postMessage({ kind: "popup-message", popupId: POPUP_ID, data: { kind: "menu-action", action: action2 } });
  }
  function postRefreshPaymentMethods() {
    if (!bc)
      return;
    bc.postMessage({
      kind: "popup-message",
      popupId: POPUP_ID,
      data: { kind: "refresh-payment-methods" }
    });
  }
  async function payAndNavigate() {
    if (!ui.initSeen || !ui.emailReceived || !ui.uuidReceived) {
      ui.pendingPay = true;
      return;
    }
    const res = await submitPay(email || undefined);
    if (!res || !bc)
      return;
    const { redirectUrl, uid: uid2 } = res;
    if (!redirectUrl && !uid2)
      return;
    bc.postMessage({
      kind: "popup-message",
      popupId: POPUP_ID,
      data: { kind: "navigate", url: redirectUrl ?? "", uid: uid2 ?? undefined }
    });
  }

  // popup-svelte/App.svelte
  App[FILENAME] = "popup-svelte/App.svelte";
  var root_15 = add_locations(from_html(\`
    <div class="menu-overlay svelte-1tt5ni5l81491">
      <!>
    </div>
  \`, 1), App[FILENAME], [[258, 4]]);
  var root_25 = add_locations(from_html(\`
    <!>
  \`, 1), App[FILENAME], []);
  var root_33 = add_locations(from_html(\`
    <!-- Single-child wrapper for the body slot — \\\`display: contents\\\`
     * makes the wrapper transparent to flex layout (children participate
     * in \\\`.root\\\`'s column flow as if it weren't there) while giving
     * Svelte's compiled \\\`{#if}/{:else}\\\` block a single, stable child to
     * mount/unmount. Multiple top-level children in the alternate branch
     * caused happy-dom's sibling traversal to throw (null parentNode)
     * during test runs; flattening to a single child sidesteps that. -->
    <div class="body-slot svelte-1tt5ni5l81491">
      <!>

      <div class="info-rows svelte-1tt5ni5l81491">
        <!>
        <!>
      </div>

      <!>

      <!>
    </div>
  \`, 1), App[FILENAME], [[284, 4, [[299, 6]]]]);
  var root_43 = add_locations(from_html(\`
    <!>
  \`, 1), App[FILENAME], []);
  var root_52 = add_locations(from_html(\`
  <div class="promo-wrap svelte-1tt5ni5l81491">
    <div class="promo-gap svelte-1tt5ni5l81491"></div>
    <div class="promo svelte-1tt5ni5l81491">
      <span class="promo-title svelte-1tt5ni5l81491"> </span>
      <button class="promo-btn svelte-1tt5ni5l81491" type="button"> <!>
      </button>
    </div>
    <img class="promo-money svelte-1tt5ni5l81491" alt="" aria-hidden="true"/>
  </div>
\`, 1), App[FILENAME], [
    [342, 2, [[343, 4], [344, 4, [[345, 6], [346, 6]]], [351, 4]]]
  ]);
  var root11 = add_locations(from_html(\`<!-- booster-plugins/packages/booster-checkout/popup-svelte/App.svelte -->




<div class="stack svelte-1tt5ni5l81491">
<div class="root svelte-1tt5ni5l81491">
  <!>

  <!>

  <!>

  <!>

  <!>
</div>

<!-- Detached promo block, floating 8px below the popup (transparent gap). The
     money illustration bleeds up across the gap onto the panel's bottom edge.
     Hidden while the pay-error modal is up — its scrim only covers .root, so a
     visible/clickable promo underneath would be wrong. \\\`.promo-wrap\\\` uses
     display:contents (single {#if} child → sidesteps happy-dom's null-parentNode
     on multi-child toggle; see .body-slot above); .promo-money still positions
     against .stack. -->
<!>
</div>

\`, 1), App[FILENAME], [[250, 0, [[251, 0]]]]);
  function App($$anchor, $$props) {
    check_target(new.target);
    push($$props, true, App);
    user_effect(() => {
      ui.amount;
      ui.methodId;
      ui.userLogin;
      scheduleCalc();
    });
    let pastThreshold = tag(state(false), "pastThreshold");
    let methodPickerTimerId = null;
    user_effect(() => {
      const isEmptyLoading = strict_equals(ui.paymentMethods.length, 0) && ui.paymentMethodsLoading && strict_equals(ui.paymentMethodsError, null);
      if (isEmptyLoading) {
        if (strict_equals(methodPickerTimerId, null)) {
          set(pastThreshold, false);
          methodPickerTimerId = setTimeout(() => {
            set(pastThreshold, true);
            methodPickerTimerId = null;
          }, 300);
        }
        return () => {
          if (strict_equals(methodPickerTimerId, null, false)) {
            clearTimeout(methodPickerTimerId);
            methodPickerTimerId = null;
          }
        };
      }
      if (strict_equals(methodPickerTimerId, null, false)) {
        clearTimeout(methodPickerTimerId);
        methodPickerTimerId = null;
      }
      set(pastThreshold, false);
    });
    const showErrorScreen = tag(user_derived(() => strict_equals(ui.paymentMethods.length, 0) && strict_equals(ui.paymentMethodsError, null, false)), "showErrorScreen");
    const isPayDisabled = tag(user_derived(payDisabled), "isPayDisabled");
    const sym = tag(user_derived(() => currencySym(ui.userCurrency)), "sym");
    const desiredText = tag(user_derived(() => {
      if (strict_equals(ui.lastEdited, "desired")) {
        return ui.desiredBalance > 0 ? String(ui.desiredBalance) : "";
      }
      const d = derivedDesiredFromPay();
      if (strict_equals(d, null))
        return "";
      return formatMoney(d);
    }), "desiredText");
    const SUPPORTED_DESIRED_CURRENCIES = ["RUB", "KZT", "USD"];
    const desiredEditable = tag(user_derived(() => strict_equals(ui.userCurrency, null, false) && SUPPORTED_DESIRED_CURRENCIES.includes(ui.userCurrency) && strict_equals(ui.userBalance, null, false)), "desiredEditable");
    const desiredPlaceholder = tag(user_derived(() => strict_equals(ui.lastEdited, "desired") ? LL.checkout.total_input.placeholder() : "—"), "desiredPlaceholder");
    function onDesiredInput(value) {
      ui.desiredBalance = value;
      ui.lastEdited = "desired";
      if (strict_equals(derivedPay(), ui.amount)) {
        cancelDesiredCommit();
        ui.calcLoading = false;
        return;
      }
      scheduleDesiredCommit(() => {
        ui.amount = derivedPay();
      });
    }
    function onDesiredCommit() {}
    function onMethodSelect(type) {
      ui.methodId = type;
      ui.methodOpen = false;
      if (strict_equals(ui.lastEdited, "desired") && ui.desiredBalance > 0) {
        ui.amount = derivedPay();
      }
    }
    function onPayInput(n) {
      cancelDesiredCommit();
      ui.amount = n;
      ui.lastEdited = "pay";
    }
    const payLabel = tag(user_derived(() => {
      if (ui.paySubmitting)
        return LL.checkout.pay_button.submitting();
      if (strict_equals(ui.lastEdited, "desired") && ui.desiredBalance > 0 && strict_equals(ui.userBalance, null, false) && ui.desiredBalance <= ui.userBalance) {
        return LL.checkout.pay_button.desired_too_low();
      }
      if (ui.calcLoading)
        return LL.checkout.pay_button.calculating();
      if (ui.calcError)
        return strict_equals(ui.calcError, "network") ? LL.checkout.pay_button.network_error() : LL.checkout.pay_button.calc_error();
      if (ui.calc?.notice)
        return ui.calc.notice;
      const p = payAmountRub();
      if (strict_equals(p, null))
        return LL.checkout.pay_button.default();
      return LL.checkout.pay_button.ready({ amount: formatMoney(p) });
    }), "payLabel");
    const receiveText = tag(user_derived(() => {
      if (ui.calc?.notice)
        return "—";
      if (ui.amount <= 0)
        return "—";
      const r = receiveAmount();
      if (strict_equals(r, null))
        return "—";
      return \`\${formatMoney(r)} \${get2(sym) || "₽"}\`;
    }), "receiveText");
    function handleClickOutside(e) {
      if (!ui.menuOpen && !ui.methodOpen)
        return;
      const target = e.target;
      if (ui.menuOpen && !target.closest(".menu-overlay") && !target.closest(".menu-trigger"))
        ui.menuOpen = false;
      if (ui.methodOpen && !target.closest(".picker"))
        ui.methodOpen = false;
    }
    var $$exports = { ...legacy_api() };
    var fragment = root11();
    event("click", $document, handleClickOutside);
    var node = first_child(fragment);
    var div = sibling(node, 2);
    var div_1 = sibling(child(div));
    var node_1 = sibling(child(div_1));
    add_svelte_meta(() => Header_default(node_1, {
      get menuOpen() {
        return ui.menuOpen;
      },
      onMenuToggle: () => {
        ui.menuOpen = !ui.menuOpen;
        ui.methodOpen = false;
      }
    }), "component", App, 252, 2, { componentTag: "Header" });
    var node_2 = sibling(node_1, 2);
    {
      var consequent = ($$anchor2) => {
        var fragment_1 = root_15();
        var div_2 = sibling(first_child(fragment_1));
        var node_3 = sibling(child(div_2));
        add_svelte_meta(() => MenuDropdown_default(node_3, {
          get supportUrl() {
            return ui.urls.support;
          },
          get telegramUrl() {
            return ui.urls.telegram;
          },
          showSettings: false,
          onOrders: () => {
            ui.menuOpen = false;
            postMenuAction("orders");
          },
          onSupport: () => {
            ui.menuOpen = false;
            postSupport();
          },
          onTelegram: () => {
            ui.menuOpen = false;
          },
          onTerms: () => {
            ui.menuOpen = false;
            postOpenDoc("terms");
          },
          onPrivacy: () => {
            ui.menuOpen = false;
            postOpenDoc("privacy");
          },
          onFaq: () => {
            ui.menuOpen = false;
            postOpenDoc("faq");
          },
          onSettings: () => {
            ui.menuOpen = false;
            postMenuAction("settings");
          }
        }), "component", App, 259, 6, { componentTag: "MenuDropdown" });
        next();
        reset(div_2);
        next();
        append($$anchor2, fragment_1);
      };
      add_svelte_meta(() => if_block(node_2, ($$render) => {
        if (ui.menuOpen)
          $$render(consequent);
      }), "if", App, 257, 2);
    }
    var node_4 = sibling(node_2, 2);
    {
      var consequent_1 = ($$anchor2) => {
        var fragment_2 = root_25();
        var node_5 = sibling(first_child(fragment_2));
        add_svelte_meta(() => PaymentMethodsError_default(node_5, {
          get onRefresh() {
            return postRefreshPaymentMethods;
          }
        }), "component", App, 275, 4, { componentTag: "PaymentMethodsError" });
        next();
        append($$anchor2, fragment_2);
      };
      var alternate = ($$anchor2) => {
        var fragment_3 = root_33();
        var node_6 = sibling(first_child(fragment_3));
        var div_3 = sibling(node_6, 2);
        var node_7 = sibling(child(div_3));
        add_svelte_meta(() => AmountRow_default(node_7, {
          get amount() {
            return ui.amount;
          },
          onAmountChange: onPayInput,
          get onAmountCommit() {
            return clampAmountToCalcBounds;
          },
          get currencySymbol() {
            return get2(sym);
          },
          get methods() {
            return ui.paymentMethods;
          },
          get methodSelectedType() {
            return ui.methodId;
          },
          get methodOpen() {
            return ui.methodOpen;
          },
          get methodLoading() {
            return ui.paymentMethodsLoading;
          },
          get methodPastThreshold() {
            return get2(pastThreshold);
          },
          onMethodToggle: () => {
            ui.methodOpen = !ui.methodOpen;
            ui.menuOpen = false;
          },
          onMethodSelect
        }), "component", App, 285, 6, { componentTag: "AmountRow" });
        var div_4 = sibling(node_7, 2);
        var node_8 = sibling(child(div_4));
        {
          let $0 = user_derived(() => LL.checkout.info_row.login());
          let $1 = user_derived(() => ui.userLogin || "—");
          add_svelte_meta(() => InfoRow_default(node_8, {
            get label() {
              return get2($0);
            },
            get value() {
              return get2($1);
            }
          }), "component", App, 300, 8, { componentTag: "InfoRow" });
        }
        var node_9 = sibling(node_8, 2);
        {
          let $0 = user_derived(() => LL.checkout.info_row.receive());
          add_svelte_meta(() => InfoRow_default(node_9, {
            get label() {
              return get2($0);
            },
            get value() {
              return get2(receiveText);
            }
          }), "component", App, 301, 8, { componentTag: "InfoRow" });
        }
        next();
        reset(div_4);
        var node_10 = sibling(div_4, 2);
        {
          let $0 = user_derived(() => LL.checkout.info_row.total_will_be());
          add_svelte_meta(() => TotalBox_default(node_10, {
            get label() {
              return get2($0);
            },
            get displayValue() {
              return get2(desiredText);
            },
            get currencySymbol() {
              return get2(sym);
            },
            get editable() {
              return get2(desiredEditable);
            },
            get placeholder() {
              return get2(desiredPlaceholder);
            },
            onInput: onDesiredInput,
            onCommit: onDesiredCommit
          }), "component", App, 304, 6, { componentTag: "TotalBox" });
        }
        var node_11 = sibling(node_10, 2);
        add_svelte_meta(() => PayButton_default(node_11, {
          get label() {
            return get2(payLabel);
          },
          get disabled() {
            return get2(isPayDisabled);
          },
          onClick: () => void payAndNavigate()
        }), "component", App, 314, 6, { componentTag: "PayButton" });
        next();
        reset(div_3);
        next();
        append($$anchor2, fragment_3);
      };
      add_svelte_meta(() => if_block(node_4, ($$render) => {
        if (get2(showErrorScreen))
          $$render(consequent_1);
        else
          $$render(alternate, -1);
      }), "if", App, 274, 2);
    }
    var node_12 = sibling(node_4, 2);
    add_svelte_meta(() => Footer_default(node_12, {}), "component", App, 322, 2, { componentTag: "Footer" });
    var node_13 = sibling(node_12, 2);
    {
      var consequent_2 = ($$anchor2) => {
        var fragment_4 = root_43();
        var node_14 = sibling(first_child(fragment_4));
        add_svelte_meta(() => PayErrorModal_default(node_14, {
          get message() {
            return ui.payError;
          },
          onClose: () => {
            ui.payError = null;
          },
          onFaq: () => {
            ui.payError = null;
            postFaq();
          },
          onSupport: () => {
            ui.payError = null;
            postSupport();
          }
        }), "component", App, 325, 4, { componentTag: "PayErrorModal" });
        next();
        append($$anchor2, fragment_4);
      };
      add_svelte_meta(() => if_block(node_13, ($$render) => {
        if (strict_equals(ui.payError, null, false))
          $$render(consequent_2);
      }), "if", App, 324, 2);
    }
    next();
    reset(div_1);
    var node_15 = sibling(div_1, 2);
    var node_16 = sibling(node_15, 2);
    {
      var consequent_3 = ($$anchor2) => {
        var fragment_5 = root_52();
        var div_5 = sibling(first_child(fragment_5));
        var div_6 = sibling(child(div_5), 3);
        var span = sibling(child(div_6));
        var text2 = child(span, true);
        reset(span);
        var button = sibling(span, 2);
        var text_1 = child(button);
        var node_17 = sibling(text_1);
        html(node_17, () => ICON_CATALOG_ARROW);
        next();
        reset(button);
        next();
        reset(div_6);
        var img = sibling(div_6, 2);
        next();
        reset(div_5);
        next();
        template_effect(($0, $1) => {
          set_text(text2, $0);
          set_text(text_1, \`
        \${$1 ?? ""}
        \`);
          set_attribute2(img, "src", IMG_MONEY_DATA_URI);
        }, [
          () => LL.checkout.promo.title(),
          () => LL.checkout.promo.button()
        ]);
        delegated("click", button, function click() {
          return postOpenCatalog();
        });
        append($$anchor2, fragment_5);
      };
      add_svelte_meta(() => if_block(node_16, ($$render) => {
        if (strict_equals(ui.payError, null))
          $$render(consequent_3);
      }), "if", App, 341, 0);
    }
    next();
    reset(div);
    next();
    append($$anchor, fragment);
    return pop($$exports);
  }
  if (undefined) {}
  var App_default = App;
  delegate(["click"]);

  // popup-svelte/main.ts
  initBridge();
  var target = document.getElementById("root");
  if (!target)
    throw new Error("booster-popup: #root element missing — wrapper HTML changed");
  mount(App_default, { target });
})();

</script>
</body>
</html>`,
      width: POPUP_W,
      height: POPUP_H,
      hideOnBlur: true,
      nativeBorder: false,
      composited: true,
      transparentParent: true
    });
    console.log("[booster-checkout] popup attached", popup ? "ok" : "null");
    popupRef = popup;
    topupPopupRef = popup;
    postPaymentMethodsIfPossible();
    let paymentHandle = null;
    let paymentOpenInFlight = false;
    let supportHandle = null;
    let supportInFlight = false;
    let ordersHandle = null;
    let ordersInFlight = false;
    const DOC_WINDOW_IDS = {
      terms: WINDOW_TERMS,
      privacy: WINDOW_PRIVACY,
      faq: WINDOW_FAQ
    };
    const docHandles = {};
    const docInFlight = {};
    async function openDocWindow(doc) {
      const existing = docHandles[doc];
      if (existing) {
        try {
          existing.bringToFront();
        } catch {}
        popup.hide();
        return;
      }
      if (docInFlight[doc])
        return;
      docInFlight[doc] = true;
      try {
        const { url, title } = docWindowContent(doc);
        const handle = await sb2.ui.openWindow({ id: DOC_WINDOW_IDS[doc], url, title, ...DOC_WINDOW_DIMS });
        docHandles[doc] = handle;
        handle.on("close", () => {
          delete docHandles[doc];
        });
        popup.hide();
      } catch (e) {
        console.error(`[booster-checkout] openWindow ${doc} failed:`, e);
      } finally {
        docInFlight[doc] = false;
      }
    }
    popup.on("message", async (data) => {
      const d = data;
      if (d?.kind === "navigate") {
        const rawUid = d.uid;
        if (typeof rawUid === "string")
          persistOrderUid(rawUid);
        const url = d.url;
        if (typeof url !== "string" || !url)
          return;
        if (paymentHandle) {
          try {
            paymentHandle.setUrl(url);
          } catch (e) {
            console.error("[booster-checkout] payment setUrl failed:", e);
            return;
          }
          popup.hide();
          return;
        }
        if (paymentOpenInFlight)
          return;
        paymentOpenInFlight = true;
        try {
          const login = sb2.steam.getCurrentUser()?.accountName;
          const reactTitle = login ? LL.checkout.popup.window_title({ login }) : LL.checkout.popup.window_title_no_login();
          ctx.log.info(`[booster-checkout] opening external window for payment, sb.ui=${typeof sb2?.ui?.openExternalWindow}`);
          const handle = await sb2.ui.openExternalWindow({
            id: WINDOW_PAYMENT,
            url,
            title: reactTitle,
            taskbarTitle: LL.checkout.popup.window_title_no_login()
          });
          paymentHandle = handle;
          handle.on("close", () => {
            paymentHandle = null;
          });
          popup.hide();
        } catch (e) {
          console.error("[booster-checkout] openExternalWindow payment failed:", e);
        } finally {
          paymentOpenInFlight = false;
        }
      } else if (d?.kind === "refresh-payment-methods") {
        refreshPaymentMethods();
      } else if (d?.kind === "menu-action" && d.action === "orders") {
        if (ordersHandle) {
          try {
            ordersHandle.bringToFront();
          } catch {}
          popup.hide();
          return;
        }
        if (ordersInFlight)
          return;
        ordersInFlight = true;
        try {
          const url = buildOrdersUrl(URLS.orders, orderUids);
          const handle = await sb2.ui.openWindow({
            id: WINDOW_ORDERS,
            url,
            title: LL.checkout.popup.orders_window_title(),
            width: 720,
            height: 640,
            minWidth: 560,
            minHeight: 420
          });
          ordersHandle = handle;
          wireOrdersEmbed(handle, { source: "booster-checkout" });
          const unwireKeys = wireOrdersKeyActivation(handle, {
            activate: (k) => sb2.keys.activate(k)
          });
          handle.on("close", () => {
            ordersHandle = null;
            unwireKeys();
          });
          popup.hide();
        } catch (e) {
          console.error("[booster-checkout] openWindow orders failed:", e);
        } finally {
          ordersInFlight = false;
        }
      } else if (d?.kind === "menu-action" && d.action === "settings") {
        console.warn("[booster-checkout] settings click ignored — not shipped");
      } else if (d?.kind === "support") {
        if (supportHandle) {
          try {
            supportHandle.bringToFront();
          } catch {}
          popup.hide();
          return;
        }
        if (supportInFlight)
          return;
        supportInFlight = true;
        try {
          const mh = window.outerHeight || 800;
          const width = 360;
          const height = Math.max(560, Math.min(900, Math.round(mh * 0.78)));
          const env = await readSupportEnvInfo();
          const supportUrl = buildSupportUrl(URLS.support, env);
          const handle = await sb2.ui.openWindow({
            id: WINDOW_SUPPORT,
            url: supportUrl,
            title: LL.checkout.popup.support_window_title(),
            width,
            height,
            minWidth: 360,
            minHeight: 480
          });
          supportHandle = handle;
          handle.on("close", () => {
            supportHandle = null;
          });
          popup.hide();
        } catch (e) {
          console.error("[booster-checkout] openWindow support failed:", e);
        } finally {
          supportInFlight = false;
        }
      } else if (d?.kind === "open-doc") {
        const doc = d.doc;
        if (isDocKey(doc))
          openDocWindow(doc);
        else
          console.warn("[booster-checkout] open-doc: unknown doc", doc);
      } else if (d?.kind === "open-catalog") {
        sb2.steam.openUrl(URLS.catalog).catch((e) => console.error("[booster-checkout] openUrl catalog failed:", e));
        popup.hide();
      }
    });
    let uuidResolved = false;
    function sendInitCore() {
      const user = sb2.steam.getCurrentUser();
      popup.postMessage({
        kind: "init",
        login: user?.accountName ?? "",
        currency: user?.currency ?? storeCurrencyFallback.get(),
        balance: user?.balance ?? null,
        urls: {
          support: URLS.support,
          telegram: URLS.telegram,
          popupLogoLink: URLS.popupLogoLink,
          balanceCalcApi: URLS.balanceCalcApi,
          balanceAddApi: URLS.balanceAddApi
        },
        versions: getStackVersions(sb2),
        uuid: typeof window !== "undefined" && typeof window.__SB_BOOSTER_UUID__ === "string" ? window.__SB_BOOSTER_UUID__ : undefined,
        uuidResolved
      });
    }
    async function sendInitEmail() {
      const user = sb2.steam.getCurrentUser();
      if (!user)
        return;
      const email = await user.email();
      popup.postMessage({ kind: "email", email: email ?? "" });
    }
    sendInitCore();
    sendInitEmail();
    publishUserSnapshot();
    if (!sb2.steam.getCurrentUser()?.currency)
      storeCurrencyFallback.refresh();
    let uuidResolverStopped = false;
    cleanups.push(() => {
      uuidResolverStopped = true;
    });
    (async () => {
      const MAX_ATTEMPTS = 20;
      for (let i = 0;i < MAX_ATTEMPTS && !uuidResolverStopped; i++) {
        let id;
        try {
          id = await sb2.app.getSetupId();
        } catch {
          id = undefined;
        }
        if (uuidResolverStopped)
          return;
        if (id && !/[\r\n]/.test(id)) {
          if (typeof window !== "undefined") {
            window.__SB_BOOSTER_UUID__ = id;
          }
          uuidResolved = true;
          sendInitCore();
          return;
        }
        await new Promise((r) => setTimeout(r, Math.min(2000, 250 * (i + 1))));
      }
      if (uuidResolverStopped)
        return;
      uuidResolved = true;
      ctx.log.warn("setupId unavailable after retries — x-booster-uuid will be empty");
      sendInitCore();
    })();
    const unsubUserChange = sb2.steam.onUserChange((user) => {
      if (!user)
        return;
      sendInitCore();
      sendInitEmail();
      publishUserSnapshot();
      if (!user.currency)
        storeCurrencyFallback.refresh();
    });
    cleanups.push(unsubUserChange);
    popup.on("show", () => {
      sendInitCore();
      sendInitEmail();
      if (!sb2.steam.getCurrentUser()?.currency)
        storeCurrencyFallback.refresh();
      const prefillAmount = pendingPrefillAmount;
      pendingPrefillAmount = null;
      popup.postMessage({ kind: "shown", prefillAmount });
      postPaymentMethodsIfPossible();
      refreshPaymentMethods();
    });
    popup.on("hide", () => {
      popup.postMessage({ kind: "hidden" });
    });
    console.log("[booster-checkout] adding header button...");
    try {
      topupButtonRef = sb2.ui.addHeaderButton({
        id: "booster-topup",
        label: LL.checkout.popup.button_label(),
        tooltip: LL.checkout.popup.button_tooltip(),
        placement: "before-profile",
        variant: "brand",
        icon: `<svg viewBox="0 0 15 12" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M0 4.3654C0 1.95445 1.97472 0 4.41066 0H8.75909L7.27367 2.30769H4.41066C3.26243 2.30769 2.33162 3.22894 2.33162 4.3654C2.33162 5.50182 3.26243 6.42307 4.41066 6.42307H8.60943L5.01969 12H2.25512L4.35962 8.73047C1.9472 8.70343 0 6.75945 0 4.3654Z" fill="white"/>
<path d="M10.5893 5.57692C11.7376 5.57692 12.6684 6.49817 12.6684 7.63462C12.6684 8.77104 11.7376 9.69229 10.5893 9.69229H7.72516L6.23975 12H10.5893C13.0253 12 15 10.0455 15 7.63462C15 5.24014 13.0522 3.29595 10.6392 3.26949L12.7437 0H9.97911L6.3894 5.57692H10.5893Z" fill="white"/>
</svg>
`,
        togglePopup: popup
      });
      console.log("[booster-checkout] header button added", topupButtonRef ? "ok" : "null");
    } catch (e) {
      console.error("[booster-checkout] header button failed:", e);
      topupButtonRef = null;
    }
    popupReadyForTopup = true;
    const drain = pendingTopups.splice(0);
    for (const amount of drain)
      openTopupWithAmount(amount);
    cleanups.push(() => {
      if (topupButtonRef)
        topupButtonRef.remove();
    });
    return () => {
      for (let i = cleanups.length - 1;i >= 0; i--) {
        try {
          cleanups[i]();
        } catch (e) {
          ctx.log.warn(`cleanup failed: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
    };
  }

  // src/index.ts
  sb.plugins.register({
    id: "booster-checkout",
    version: "1.0.2",
    apiVersion: 1,
    displayName: "SteamBalance — Пополнить",
    description: "Кнопка «Пополнить» в шапке Steam, popup, оплата, поддержка, заказы.",
    contextKinds: [ContextKind.Main],
    capabilities: [
      Capability.Ui,
      Capability.Steam,
      Capability.Configs,
      Capability.Bus,
      Capability.Keys,
      Capability.Net
    ],
    async init(ctx) {
      if (ctx.contextKind !== ContextKind.Main)
        return () => {};
      return installMain(ctx);
    }
  });
})();

//# debugId=61AFF66885C44E0264756E2164756E21
