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
    rateaccount: {
      supernav: {
        button_label: "Оцени аккаунт"
      }
    },
    general: {
      product_display_name: "SteamBooster"
    }
  };
  var messages_default = ru;

  // src/i18n.ts
  var LL = typesafeI18nObject("ru", messages_default);

  // src/urls.ts
  var RATE_ACCOUNT_URL = "https://steambalance.cc/c/3f4d";

  // src/main/install.ts
  async function installMain(ctx) {
    const sb2 = ctx.sb;
    await sb2.lifecycle.ready();
    const handle = sb2.ui.addSuperNavButton({
      id: "button",
      label: LL.rateaccount.supernav.button_label(),
      variant: "brand",
      placement: "after-profile",
      onClick: () => {
        sb2.steam.openUrl(RATE_ACCOUNT_URL).catch(() => {
          ctx.log.warn("[booster-rateaccount] navigate failed");
        });
      }
    });
    return () => handle.remove();
  }

  // src/index.ts
  sb.plugins.register({
    id: "booster-rateaccount",
    version: "1.0.0",
    apiVersion: 1,
    displayName: "SteamBalance — Оцени аккаунт",
    description: "Кнопка «Оцени аккаунт» в супернаве Steam.",
    contextKinds: [ContextKind.Main],
    capabilities: [Capability.Ui, Capability.Steam],
    async init(ctx) {
      if (ctx.contextKind !== ContextKind.Main)
        return () => {};
      return installMain(ctx);
    }
  });
})();

//# debugId=671A3ADAE38B4D0364756E2164756E21
