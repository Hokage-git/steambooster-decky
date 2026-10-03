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
  var RU_GROUP_SEP = /[\u00a0\u202f\u2009]/g;
  function fmtMoneyKeys(n, symbol = "₽") {
    const hasFrac = Math.round(n * 100) % 100 !== 0;
    const num = n.toLocaleString("ru-RU", hasFrac ? { minimumFractionDigits: 2, maximumFractionDigits: 2 } : { maximumFractionDigits: 0 }).replace(RU_GROUP_SEP, " ");
    return symbol ? `${num} ${symbol}` : num;
  }

  // src/lib/user-snapshot.ts
  var services = new WeakMap;
  function ensureSnapshotService(sb2) {
    const existing = services.get(sb2.scope.signal);
    if (existing)
      return existing;
    let cached = null;
    const listeners = new Set;
    sb2.bus.subscribe("booster-checkout.user.snapshot", (data) => {
      const d = data;
      if (!d || typeof d.accountName !== "string")
        return;
      cached = {
        accountName: d.accountName,
        currency: typeof d.currency === "string" ? d.currency : null,
        balance: typeof d.balance === "number" && Number.isFinite(d.balance) ? d.balance : null
      };
      for (const cb of listeners)
        cb(cached);
    });
    sb2.bus.publish("booster-addfunds.user.snapshot.request", null);
    const svc = {
      get: () => cached,
      subscribe: (cb) => {
        listeners.add(cb);
        if (cached)
          cb(cached);
        return () => listeners.delete(cb);
      }
    };
    services.set(sb2.scope.signal, svc);
    return svc;
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
    addfunds: {
      cart_heading: "Вам не хватает баланса",
      catalog_menu_item: "Каталог игр",
      edition_offer_aria_label: "Предложение SteamBalance — купить дешевле",
      edition_offer_soon_badge: "СКОРО",
      keys_block_aria_label: "Доступные ключи для покупки в вашем регионе",
      keys_block_title: "У нас игра доступна для вашего региона:",
      keys_buy_button: "Купить",
      keys_email_modal_cancel: "Отмена",
      keys_email_modal_confirm: "Продолжить",
      keys_email_modal_hint: "Укажите email — на него придёт ключ после оплаты.",
      keys_email_modal_invalid: "Введите корректный email",
      keys_email_modal_placeholder: "you@example.com",
      keys_email_modal_title: "Куда отправить ключ?",
      keys_error_modal_close: "Закрыть",
      keys_error_modal_title: "Упс!",
      keys_item_coming_soon: "Скоро в продаже",
      keys_purchase_error: "Не удалось оформить заказ. Попробуйте ещё раз.",
      keys_purchase_window_taskbar_title: "Покупка ключа",
      keys_purchase_window_title: "Покупка ключа — «{gameName:string}»",
      keys_row_label: "Купить {gameName:string}",
      region_games_aria_label: "Игры недоступные в регионе",
      region_games_title: "Игры недоступные в регионе",
      row_aria_label: "Пополнить баланс через SteamBalance",
      row_label: "Пополнение баланса",
      submit_button: "Пополнить"
    },
    general: {
      product_display_name: "SteamBooster"
    }
  };
  var messages_default = ru;

  // src/i18n.ts
  var LL = typesafeI18nObject("ru", messages_default);
  // src/components/topup-bar.ts
  var SB_TOPUP_CSS = `#booster-topup-bar {
  /* Top edge alignment with Steam's right-column "ВАШ АККАУНТ STEAM"
   * block — Steam puts a 16px margin-top on .rightcol > .block, so
   * without a matching margin-top here our row sat 16px higher than
   * the right block (misalignment QA flagged 2026-05-21). Mirroring
   * Steam's offset on our own row (instead of touching its CSS) keeps
   * the override contained to this scoped block. */
  margin: 16px 0 8px 0;
  padding: 24px;
  border-radius: 6px;
  background: linear-gradient(90deg, #1c5742 0%, #34a37b 100%);
  width: 780px; max-width: 100%;
  box-sizing: border-box;
}
#booster-topup-bar .booster-topup-inner {
  display: flex; align-items: center; justify-content: space-between;
  gap: 16px; height: 36px;
}
#booster-topup-bar .booster-topup-left {
  display: flex; align-items: center; gap: 16px;
}
#booster-topup-bar .booster-topup-logo {
  display: block; height: 18px; width: auto; max-width: 120px; object-fit: contain;
}
#booster-topup-bar .booster-topup-label {
  font-family: 'Nunito Sans', 'Motiva Sans', Arial, sans-serif;
  font-weight: 700; font-size: 18px; line-height: 16px; color: #fff;
}
#booster-topup-bar .booster-topup-right {
  display: flex; align-items: center; gap: 0;
  background: #000; border-radius: 2px; padding: 2px 2px 2px 12px;
  height: 36px; box-sizing: border-box;
}
#booster-topup-bar .booster-topup-input-wrap {
  display: flex; align-items: center; gap: 8px;
}
#booster-topup-bar .booster-topup-input {
  width: 90px; background: transparent; border: 0; outline: none;
  font-family: 'Nunito Sans', 'Motiva Sans', Arial, sans-serif;
  font-weight: 700; font-size: 14px; line-height: 16px; color: #fff;
  text-align: left; padding: 0;
}
#booster-topup-bar .booster-topup-input::placeholder { color: rgba(255,255,255,0.5); }
#booster-topup-bar .booster-topup-symbol {
  font-family: 'Nunito Sans', 'Motiva Sans', Arial, sans-serif;
  font-weight: 700; font-size: 14px; color: #fff;
}
#booster-topup-bar .booster-topup-submit {
  margin-left: 8px; border: 0; cursor: pointer;
  padding: 8px 12px; border-radius: 2px;
  background: linear-gradient(180deg, #799905 0%, #536904 100%);
  font-family: 'Nunito Sans', 'Motiva Sans', Arial, sans-serif;
  font-weight: 700; font-size: 14px; line-height: 16px; color: #c6dc77;
  height: 32px;
}
#booster-topup-bar .booster-topup-submit:hover { color: #fff; }
`;
  function ensureTopupStyles() {
    if (document.getElementById("booster-topup-style"))
      return;
    const s = document.createElement("style");
    s.id = "booster-topup-style";
    s.textContent = SB_TOPUP_CSS;
    document.head.appendChild(s);
  }
  function buildTopupBar(opts) {
    const root = document.createElement("div");
    root.id = "booster-topup-bar";
    root.setAttribute("data-sb", "1");
    root.setAttribute("aria-label", opts.ariaLabel ?? opts.heading);
    const inner = document.createElement("div");
    inner.className = "booster-topup-inner";
    const left = document.createElement("div");
    left.className = "booster-topup-left";
    const logo = document.createElement("img");
    logo.src = opts.logoUrl;
    logo.alt = "SteamBalance";
    logo.className = "booster-topup-logo";
    const label = document.createElement("span");
    label.className = "booster-topup-label";
    label.textContent = opts.heading;
    left.appendChild(logo);
    left.appendChild(label);
    const right = document.createElement("div");
    right.className = "booster-topup-right";
    const inputWrap = document.createElement("div");
    inputWrap.className = "booster-topup-input-wrap";
    const input = document.createElement("input");
    input.type = "text";
    input.inputMode = "numeric";
    input.placeholder = opts.placeholder ?? "";
    if (opts.amount != null && opts.amount > 0)
      input.value = String(opts.amount);
    input.className = "booster-topup-input";
    input.maxLength = 12;
    input.setAttribute("aria-label", opts.heading);
    input.addEventListener("input", () => {
      const v = input.value.replace(/[^\d]/g, "");
      if (v !== input.value)
        input.value = v;
    });
    const symbol = document.createElement("span");
    symbol.className = "booster-topup-symbol";
    symbol.textContent = opts.currencySymbol;
    inputWrap.appendChild(input);
    inputWrap.appendChild(symbol);
    const submit = document.createElement("button");
    submit.type = "button";
    submit.className = "booster-topup-submit";
    submit.textContent = LL.addfunds.submit_button();
    function fireSubmit() {
      const raw = input.value.trim();
      const fromInput = raw ? parseInt(raw, 10) : 0;
      if (Number.isFinite(fromInput) && fromInput > 0) {
        opts.onSubmit(fromInput);
        return;
      }
      const ph = input.placeholder ? parseInt(input.placeholder, 10) : 0;
      if (Number.isFinite(ph) && ph > 0) {
        opts.onSubmit(ph);
        return;
      }
    }
    submit.addEventListener("click", fireSubmit);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        fireSubmit();
      }
    });
    right.appendChild(inputWrap);
    right.appendChild(submit);
    inner.appendChild(left);
    inner.appendChild(right);
    root.appendChild(inner);
    return {
      root,
      input,
      symbol,
      submit,
      setHeading: (s) => {
        label.textContent = s;
        root.setAttribute("aria-label", s);
        input.setAttribute("aria-label", s);
      },
      setAmount: (n) => {
        input.value = n != null && n > 0 ? String(n) : "";
      },
      setCurrency: (sym, ph) => {
        symbol.textContent = sym;
        input.placeholder = ph;
      }
    };
  }

  // src/lib/wait-for-element.ts
  async function waitForElement(selector, signal, timeoutMs = 5000) {
    if (signal.aborted)
      return null;
    const existing = document.querySelector(selector);
    if (existing)
      return existing;
    return new Promise((resolve) => {
      let done = false;
      const finish = (val) => {
        if (done)
          return;
        done = true;
        observer.disconnect();
        clearTimeout(timer);
        resolve(val);
      };
      const observer = new MutationObserver(() => {
        const el = document.querySelector(selector);
        if (el)
          finish(el);
      });
      observer.observe(document.documentElement, { childList: true, subtree: true });
      const timer = setTimeout(() => finish(null), timeoutMs);
      signal.addEventListener("abort", () => finish(null), { once: true });
    });
  }
  async function waitForElementBy(predicate, signal, timeoutMs = 5000) {
    if (signal.aborted)
      return null;
    const existing = predicate();
    if (existing)
      return existing;
    return new Promise((resolve) => {
      let done = false;
      const finish = (val) => {
        if (done)
          return;
        done = true;
        observer.disconnect();
        clearTimeout(timer);
        resolve(val);
      };
      const observer = new MutationObserver(() => {
        const el = predicate();
        if (el)
          finish(el);
      });
      observer.observe(document.documentElement, { childList: true, subtree: true });
      const timer = setTimeout(() => finish(null), timeoutMs);
      signal.addEventListener("abort", () => finish(null), { once: true });
    });
  }

  // src/pages/addfunds.ts
  var ADDFUNDS_LOGO_DATA_URI = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAIgAAAAkCAMAAABluoL1AAAAjVBMVEUAAAD///////////////////////////////////////////////////////9mS/5B0pn///9C05hA0JdlTP9iSv////////9PnsVB0plC0plB0phlTP5C0pllS/5lTP9mTP9nTP9lS/1D05hmS/9C05hC0pllS/9nTv9mTP9nTP////////9mTP5C0pnFhVtRAAAALHRSTlMAv39g359AII/vEB+vb0/f38/BIb8gMD8Qf59h7+/PfY9An0Zfr49gL6+fgKHZBZgAAARfSURBVFjDtZfretsgDEAFvgG1nTpJnWubZl3XXZS+/+NNRtg4Adr+6fm+xkxJ5hOEhYCR8/PT8TLnN8DqnbmHOOZfjtjVpRETd+AGCoieBgYGlBDNOMggzXl9ueEHRe+dyAqiVDla2gon7gAZAYQc3oUBgZhbd4oUkGL7fLll8QCwcx57iKMQ282mUZWRMmsQm0xKQyJFIynAt89RwUBuJQGyj0Qeni4BPykxjy4xK4gjsJ5ND98ISCQbY4bkMHciNQ65qbFOimwXoccfiu/fmQMk6D4TKTEnF8Mimc2WxiYp8nwJocQcnMcrpCgQmw9FFNaDAViBO42G1AQLRTj72x8XjhMlJr1S/Q9GnB6B3ouojDA2dw3ZFhy9K0iJ/pIi69HitJ2HfzmPHaRphyWYV2w1iTAbu0R6yDB3Ipmdnyol8tt5PM01ghKSoJKkovsbkU4QFGxRc8pYxGjdYgcZ/cU4+cfV40vIi/NLqyCKG5F2WiK5lNKuGTO8K7BDyVOUzszP6+jufeLx9cCx9JK9Ecmmp4op3Lw06HMV4uo6hInx3CdVuESZqEjFSeqmBNFLDkkRt0LA40uIZ7+NKVQ8I3l8RlpvyCKjuP6yyOE9YBkxybGrpUKUscWqoOBVaTQ2UM5F8IPUHH2AS0hoEu69Ai0i+vgK8lTjTvAVEbfPnNOJSReUStaiaMexNHYgmYwGPadINvwu00v5UYFf+8h2OedxenpW8I34Cv8MCQ5jon7B97IYS+sZ4qyWbkq28K28+WZoPePveFvfmLzA9xJ0iUGp3UVzU6qiFqLOgMmkbDkuG3oNozzoZcNfrkWtGkMfYCj2wMkJWlbPS7RllMgUU0HPOc7XIIrawFhY/yEDIMZRwuRqD9xGS4lEvek30m1yFRLmRoSjd6O2ZBEbFkqqurZtbS0IiJuc4HMR/m1j3cpQCMxuRdpZVKMev1X4j4jrzvF0rbIAiKTmNRTx/1OBSvFoFLmNKo2l+5ZGmRCBh7f1MZ4YX2p3URGNiidm03JAus6Ho22LmqNSobANNfSIbUKEZX6MKzXeFLwEIlVVKcSKF4MxvByk231uo7JELK0IDTYzkYowVyL+cBXbA++DRsSiN/yPbvj9jRcJohIEqoiIRcKMP2EJIY3duNvsQhEhOtc922MTd+xehAOKo/RKWTJfEHmbJWZ/72CL4MDn9/NK2/vmNPOlQu1F3BPlo4VdpKGIAs/8GT7y4SrgAFERsPfp/SHci/ho70QkTd+ni/XvWELindEOEiJyuDToaOYimY+yiNGYkYjB4PENzzeLeGe0h5RIgdqerV0zNhepeVRztOAGl0RAuI9UEZGFLyGrRF5CkQqgzDn5DRANajv/UhUFL4lZtHan1NxeaPE0AksS6eSAP2f5/ihIzHIFUREmr6bVR9d+2gyh99FynCdhRabPKAowkRKyuz7TLHeJhmgjOo2YFxVAK4Trp0ULmWCmKHCUtyQhCr4OXyVPJZj/j80BM5/SIzUAAAAASUVORK5CYII=";
  function registerAddFundsPage(sb2) {
    const snap = ensureSnapshotService(sb2);
    sb2.pages.register({
      name: "booster-addfunds",
      match: { url: /\/steamaccount\/addfunds\/?($|\?|#)/ },
      mount: async (ctx) => {
        if (document.readyState === "loading") {
          await new Promise((resolve) => {
            document.addEventListener("DOMContentLoaded", () => resolve(), { once: true, signal: ctx.signal });
          });
        }
        if (ctx.signal.aborted)
          return;
        const grid = await waitForElement(".game_area_purchase", ctx.signal);
        if (!grid) {
          console.warn("[booster-addfunds] .game_area_purchase not found");
          return;
        }
        const bar = buildTopupBar({
          heading: LL.addfunds.row_label(),
          ariaLabel: LL.addfunds.row_aria_label(),
          placeholder: "",
          currencySymbol: "",
          logoUrl: ADDFUNDS_LOGO_DATA_URI,
          onSubmit: (amount) => {
            sb2.bus.publish("booster-addfunds.topup-requested", { amount });
          }
        });
        const apply = (s) => {
          const def = defaultAmountForCurrency(s.currency);
          bar.setCurrency(currencySym(s.currency), def > 0 ? String(def) : "");
        };
        const unsub = snap.subscribe(apply);
        ensureTopupStyles();
        grid.style.display = "none";
        const footer = findFooter(grid);
        if (footer)
          footer.style.display = "none";
        grid.parentElement?.insertBefore(bar.root, grid);
        return () => {
          unsub();
          try {
            bar.root.remove();
          } catch {}
          grid.style.display = "";
          if (footer)
            footer.style.display = "";
          document.getElementById("booster-topup-style")?.remove();
        };
      }
    });
  }
  function findFooter(grid) {
    let n = grid.nextElementSibling;
    while (n) {
      if (n.tagName === "P")
        return n;
      if (n.tagName !== "SCRIPT" && n.tagName !== "LINK" && n.tagName !== "STYLE")
        break;
      n = n.nextElementSibling;
    }
    return null;
  }

  // src/lib/region-lock.ts
  var REGION_PHRASES = ["недоступен в вашем регионе", "не доступен в вашем регионе"];
  function detectRegionLock(doc) {
    if (doc.querySelector(".apphub_AppName") || doc.querySelector(".game_area_purchase"))
      return false;
    const errBox = doc.querySelector("#error_box");
    if (!errBox)
      return false;
    const txt = (errBox.textContent ?? "").toLowerCase();
    return REGION_PHRASES.some((p) => txt.includes(p));
  }

  // src/lib/app-id.ts
  function parseAppId(url) {
    const m = /\/app\/(\d+)/.exec(url);
    if (!m)
      return null;
    const n = parseInt(m[1], 10);
    return Number.isInteger(n) && n > 0 ? n : null;
  }

  // src/lib/amount.ts
  var WS = /[\s   ]/g;
  function parseAmount(input) {
    const s = (input ?? "").replace(WS, "").replace(/[^0-9.,]/g, "").replace(/^[.,]+|[.,]+$/g, "");
    if (!s)
      return null;
    const hasComma = s.includes(",");
    const hasDot = s.includes(".");
    let decimalSep = null;
    if (hasComma && hasDot) {
      decimalSep = s.lastIndexOf(",") > s.lastIndexOf(".") ? "," : ".";
    } else if (hasComma || hasDot) {
      const sep = hasComma ? "," : ".";
      if (/^\d{1,2}$/.test(s.slice(s.lastIndexOf(sep) + 1)))
        decimalSep = sep;
    }
    let normalized;
    if (decimalSep) {
      const at = s.lastIndexOf(decimalSep);
      const intPart = s.slice(0, at).replace(/[.,]/g, "");
      const fracPart = s.slice(at + 1).replace(/[.,]/g, "");
      normalized = `${intPart}.${fracPart}`;
    } else {
      normalized = s.replace(/[.,]/g, "");
    }
    const n = parseFloat(normalized);
    return Number.isFinite(n) ? n : null;
  }

  // src/lib/edition-price.ts
  function readBlockPrice(scope) {
    const raw = scope.querySelector("[data-price-final]")?.getAttribute("data-price-final");
    if (raw != null) {
      const minor = parseInt(raw, 10);
      if (Number.isFinite(minor) && minor > 0)
        return Math.round(minor / 100);
    }
    const priceEl = scope.querySelector(".discount_final_price, .game_purchase_price.price, .game_purchase_price");
    const v = priceEl ? parseAmount(priceEl.textContent ?? "") : null;
    return v != null && v > 0 ? Math.round(v) : null;
  }
  function readFirstEditionPrice(doc) {
    const gap = doc.querySelector("#game_area_purchase");
    return gap ? readBlockPrice(gap) : null;
  }

  // src/lib/edition-match.ts
  function isPurchasableBlock(block) {
    if (block.classList.contains("demo_above_purchase"))
      return false;
    const price = readBlockPrice(block);
    return price != null && price > 0;
  }
  function readBlockSubid(block) {
    const input = block.querySelector('input[name="subid"]');
    if (input && input.value) {
      const n = Number(input.value);
      if (Number.isInteger(n) && n > 0)
        return n;
    }
    const m = /addToCart\((\d+)\)/.exec(block.innerHTML);
    if (m) {
      const n = Number(m[1]);
      if (Number.isInteger(n) && n > 0)
        return n;
    }
    return null;
  }
  function matchItemsToBlocks(items, blocks) {
    const out = [];
    for (const block of blocks) {
      const subid = readBlockSubid(block);
      if (subid == null)
        continue;
      const item = items.find((it) => it.packageId === subid);
      if (item)
        out.push({ block, item });
    }
    return out;
  }

  // src/urls.ts
  var STORE_MENU_CATALOG_URL = "https://steambalance.cc/c/e6c5";
  var STORE_NAV_CATALOG_URL = "https://steambalance.cc/c/a3bd";
  var CATALOGUE_API = "https://steambalance.cc/api/booster/catalogue";
  var REGION_GAMES_PROMO_URL = "https://steambalance.cc/c/5533";
  var STEAM_KEYS_API = "https://steambalance.cc/api/services/steam_keys";

  // src/lib/keys-api.ts
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

  // src/lib/keys-fetch.ts
  async function fetchKeysDirect(sb2, args, signal) {
    try {
      const q = new URLSearchParams({ paymentId: args.paymentId, appid: String(args.appid) });
      if (args.storeCountry)
        q.set("store_country", args.storeCountry);
      const r = await sb2.net.fetch(`${STEAM_KEYS_API}?${q.toString()}`, { method: "GET", ...signal ? { signal } : {} });
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

  // src/lib/keys-client.ts
  var nonceCounter = 0;
  function makeNonce() {
    return `${Date.now().toString(36)}-${(nonceCounter++).toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
  }
  function createKeysClient(sb2, opts = {}) {
    const timeoutMs = opts.timeoutMs ?? 6000;
    const retryMs = opts.retryMs ?? 1000;
    const purchaseTimeoutMs = opts.purchaseTimeoutMs ?? 30000;
    const nonce = makeNonce();
    let counter = 0;
    const nextId = () => `${nonce}:${++counter}`;
    let activeListReqId = null;
    const listWaiters = new Map;
    const purchaseWaiters = new Map;
    const onReady = [];
    const subs = [];
    subs.push(sb2.bus.subscribe("booster-checkout.keys.response", (data) => {
      const d = data;
      if (!d || typeof d.reqId !== "string" || d.reqId !== activeListReqId)
        return;
      const w = listWaiters.get(d.reqId);
      if (w) {
        listWaiters.delete(d.reqId);
        w(Array.isArray(d.items) ? d.items : []);
      }
    }));
    subs.push(sb2.bus.subscribe("booster-checkout.keys.email-required", (data) => {
      const d = data;
      const w = d && typeof d.reqId === "string" ? purchaseWaiters.get(d.reqId) : undefined;
      if (w && d) {
        purchaseWaiters.delete(d.reqId);
        w({ status: "email-required" });
      }
    }));
    subs.push(sb2.bus.subscribe("booster-checkout.keys.purchase-result", (data) => {
      const d = data;
      const w = d && typeof d.reqId === "string" ? purchaseWaiters.get(d.reqId) : undefined;
      if (w && d) {
        purchaseWaiters.delete(d.reqId);
        w(d.ok ? { status: "ok" } : { status: "error", error: d.error, message: d.message });
      }
    }));
    subs.push(sb2.bus.subscribe("booster-checkout.keys.ready", () => {
      for (const cb of onReady.splice(0))
        cb();
    }));
    const fetchDirect = opts.fetchKeysDirect ?? fetchKeysDirect;
    function requestKeys(appid, signal) {
      const cfg = opts.keysConfig?.get();
      console.log("[booster-addfunds] requestKeys", appid, "paymentId?", !!cfg?.paymentId);
      if (cfg && cfg.paymentId) {
        return fetchDirect(sb2, { appid, paymentId: cfg.paymentId, storeCountry: cfg.storeCountry }, signal).then((items) => {
          console.log("[booster-addfunds] direct keys", appid, items.length);
          return items;
        }).catch((e) => {
          console.log("[booster-addfunds] direct fetch failed, falling back to bus", e);
          return requestKeysViaBus(appid, signal);
        });
      }
      return requestKeysViaBus(appid, signal).then((items) => {
        console.log("[booster-addfunds] bus keys", appid, items.length);
        return items;
      });
    }
    function requestKeysViaBus(appid, signal) {
      const reqId = nextId();
      activeListReqId = reqId;
      return new Promise((resolve) => {
        let done = false;
        const finish = (items) => {
          if (done)
            return;
          done = true;
          clearInterval(iv);
          clearTimeout(to);
          listWaiters.delete(reqId);
          resolve(items);
        };
        listWaiters.set(reqId, finish);
        const send = () => {
          if (!done)
            sb2.bus.publish("booster-addfunds.keys.request", { reqId, appid });
        };
        onReady.push(send);
        send();
        const iv = setInterval(send, retryMs);
        const to = setTimeout(() => finish([]), timeoutMs);
        signal.addEventListener("abort", () => finish([]), { once: true });
      });
    }
    function purchaseKey(itemId, email, titles) {
      const reqId = nextId();
      return new Promise((resolve) => {
        let done = false;
        const finish = (r) => {
          if (done)
            return;
          done = true;
          clearTimeout(to);
          purchaseWaiters.delete(reqId);
          resolve(r);
        };
        purchaseWaiters.set(reqId, finish);
        sb2.bus.publish("booster-addfunds.keys.purchase", {
          reqId,
          itemId,
          ...email ? { email } : {},
          ...titles ? { windowTitle: titles.title, windowTaskbarTitle: titles.taskbarTitle } : {}
        });
        const to = setTimeout(() => finish({ status: "error", error: "timeout" }), purchaseTimeoutMs);
      });
    }
    return { requestKeys, purchaseKey, dispose: () => {
      for (const u of subs)
        u();
    } };
  }
  // src/components/edition-offer-chip.ts
  var SB_EDITION_OFFER_CSS = `/* Edition offer chip — embedded inline in an edition's purchase row. Scoped via
 * the .booster-eo class (multiple chips can coexist on one page). Values come
 * from the project design system (frame 319:908), NOT keys-block.css (which uses
 * 12px/8px gaps — here it's 3/10). */
.booster-eo {
  display: flex; align-items: center; gap: 3px;     /* 319:909 itemSpacing=3 */
  margin-left: auto;                                 /* pin right inside .game_purchase_action */
  background: #000; border-radius: 2px; padding: 3px;
  box-sizing: border-box;
  font-family: 'Motiva Sans', 'Nunito Sans', Arial, sans-serif;
}
.booster-eo .booster-eo-discount {                  /* 319:910/911 */
  background: #664cfe; color: #fff; font-weight: 500; font-size: 22px;
  line-height: 16px; border-radius: 3px; padding: 7px 8px;
}
.booster-eo .booster-eo-prices {                    /* 319:913: column, right-aligned */
  display: flex; flex-direction: column; align-items: flex-end;
  /* 319:912 has 8px horizontal + 7px vertical padding; the 7px vertical is
   * intentionally dropped — it would push the 28px stack past the 30px design
   * height. align-items:center on the chip handles vertical centering. */
  color: #fff; padding: 0 8px;
}
.booster-eo .booster-eo-was {                       /* 319:914 */
  opacity: .5; font-size: 10px; line-height: 16px; text-decoration: line-through;
}
.booster-eo .booster-eo-now {                       /* 319:915; itemSpacing -4 → overlap */
  font-size: 12px; line-height: 16px; margin-top: -4px;
}
/* Single price (no struck original above): mirror Steam's native
 * .discount_final_price — 14px white, weight 400, vertically centered. The
 * -4px overlap offset exists only to tighten the two-line stack, so drop it. */
.booster-eo--single .booster-eo-now {
  font-size: 14px; margin-top: 0;
}
.booster-eo .booster-eo-buy {                       /* brand green action, like header top-up */
  display: inline-flex; align-items: center; justify-content: center;
  background: #34a37b; color: #fff; border: 0; cursor: pointer;
  border-radius: 2px; padding: 6px 10px; font-weight: 700; font-size: 11px;
  line-height: 16px; text-transform: uppercase; letter-spacing: .02em;
  white-space: nowrap;
}
.booster-eo .booster-eo-buy:hover { background: #3eb487; }
.booster-eo .booster-eo-buy:disabled { cursor: default; opacity: .6; }
.booster-eo .booster-eo-buy--busy { opacity: .6; }

/* Inactive item ("Скоро в продаже"): muted label, no buy button. */
.booster-eo--inactive { padding: 7px 12px; }
.booster-eo .booster-eo-inactive-label {
  color: #fff; opacity: .7; font-size: 12px; line-height: 16px; white-space: nowrap;
}

/* Host modifier: turn the edition's native action into a flex row so the native
 * cluster sits left and our chip (margin-left:auto) pins right. The action's only
 * native child is .game_purchase_action_bg (CDP-verified), and the discount
 * countdown lives outside .game_purchase_action — so this is safe. */
/* overflow:visible defends the «СКОРО» badge (which protrudes above the button)
 * against the host clipping it; no effect on the live full chip, which doesn't
 * overflow. Note: only THIS host node is under our control — native ancestors
 * (.game_area_purchase_game …) still need an in-Steam QA pass. */
.game_purchase_action.booster-dist-host { display: flex; align-items: center; text-align: left; overflow: visible; }

/* ── «СКОРО» (empty-state coming-soon) ────────────────────────────────────────
 * Active only on the standalone comingSoon chip (built with { comingSoon: true }).
 * The «СКОРО» pill (design: #664cfe, radius 3, padding 4/2, 10px/12px Medium
 * white) sits centered on the button's TOP edge — its own centre on the edge, so
 * it protrudes 50% upward — above the button by z-index; the button itself is
 * dimmed 40% via ::after. */
.booster-eo.booster-eo--soon .booster-eo-buy {
  /* position:relative WITHOUT a z-index is load-bearing: it makes the button the
   * containing block for the badge + dim overlay, yet does NOT open a new stacking
   * context — so the badge (z-index:2) paints above the dim (z-index:1) which
   * paints above the button's auto-z bg/label. Don't add z-index/isolation here. */
  position: relative;
  overflow: visible;         /* let the badge protrude above the button */
}
/* 40% black dim over the whole button (background + label) — the «coming soon»
 * de-emphasis. content:'' + inset:0; kept below the badge by z-index. */
.booster-eo.booster-eo--soon .booster-eo-buy::after {
  content: '';
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  border-radius: inherit;
  pointer-events: none;
  z-index: 1;
}
.booster-eo.booster-eo--soon .booster-eo-soon {
  position: absolute;
  left: 50%;
  top: 0;
  transform: translate(-50%, -50%);   /* centre on the button's top edge */
  z-index: 2;                          /* above the dim overlay + button content */
  background: #664cfe;
  border-radius: 3px;
  padding: 2px 4px;
  font-size: 10px;
  line-height: 12px;
  font-weight: 500;
  color: #fff;
  white-space: nowrap;
  pointer-events: none;
}
`;
  function ensureEditionOfferStyles() {
    if (document.getElementById("booster-edition-offer-style"))
      return;
    const s = document.createElement("style");
    s.id = "booster-edition-offer-style";
    s.textContent = SB_EDITION_OFFER_CSS;
    document.head.appendChild(s);
  }
  function buildEditionOfferChip(opts) {
    const item = opts.item;
    const comingSoon = opts.comingSoon ?? false;
    const inactive = item != null && item.isActive === false;
    const root = document.createElement("div");
    root.className = "booster-eo";
    root.setAttribute("data-sb", "1");
    root.setAttribute("aria-label", LL.addfunds.edition_offer_aria_label());
    if (comingSoon)
      root.classList.add("booster-eo--soon");
    if (inactive)
      root.classList.add("booster-eo--inactive");
    let buy = null;
    if (inactive) {
      const label = document.createElement("span");
      label.className = "booster-eo-inactive-label";
      label.textContent = LL.addfunds.keys_item_coming_soon();
      root.appendChild(label);
    } else {
      if (item) {
        if (item.discountPercent > 0) {
          const badge = document.createElement("span");
          badge.className = "booster-eo-discount";
          badge.textContent = `-${item.discountPercent}%`;
          root.appendChild(badge);
        }
        const prices = document.createElement("div");
        prices.className = "booster-eo-prices";
        if (item.oldPrice != null && item.oldPrice > item.price) {
          const was = document.createElement("span");
          was.className = "booster-eo-was";
          was.textContent = fmtMoneyKeys(item.oldPrice);
          prices.appendChild(was);
        } else {
          root.classList.add("booster-eo--single");
        }
        const now = document.createElement("span");
        now.className = "booster-eo-now";
        now.textContent = fmtMoneyKeys(item.price);
        prices.appendChild(now);
        root.appendChild(prices);
      }
      buy = document.createElement("button");
      buy.type = "button";
      buy.className = "booster-eo-buy";
      buy.textContent = LL.addfunds.keys_buy_button();
      if (comingSoon) {
        const soon = document.createElement("span");
        soon.className = "booster-eo-soon";
        soon.textContent = LL.addfunds.edition_offer_soon_badge();
        buy.appendChild(soon);
      }
      if (opts.onBuy) {
        const onBuy = opts.onBuy;
        buy.addEventListener("click", () => onBuy());
      }
      root.appendChild(buy);
    }
    return {
      root,
      setBusy(b) {
        if (!buy)
          return;
        buy.disabled = b;
        buy.classList.toggle("booster-eo-buy--busy", b);
      }
    };
  }

  // src/lib/icons.ts
  var SB_SWIRL_SVG = '<svg viewBox="0 0 14 12" width="14" height="12" aria-hidden="true"><path fill="currentColor" d="M0 4.3654C0 1.9544 1.8431 0 4.1166 0L8.1751 0 6.7887 2.3077 4.1166 2.3077C3.0449 2.3077 2.1762 3.2289 2.1762 4.3654 2.1762 5.5018 3.0449 6.4231 4.1166 6.4231L8.0354 6.4231 4.6850 12 2.1048 12 4.0690 8.7305C1.8174 8.7034 0 6.7595 0 4.3654Z M9.8834 5.5769C10.9551 5.5769 11.8238 6.4982 11.8238 7.6346 11.8238 8.7710 10.9551 9.6923 9.8834 9.6923L7.2102 9.6923 5.8238 12 9.8834 12C12.1569 12 14 10.0455 14 7.6346 14 5.2401 12.1820 3.2960 9.9300 3.2695L11.8941 0 9.3139 0 5.9635 5.5769 9.8834 5.5769Z"/></svg>';
  var WINDOWS_SVG = '<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path fill="currentColor" d="M3 5.1 10 4v8H3V5.1zM10 12.9V21l-7-1.1V12.9H10zM11.2 3.8 21 2v9.9l-9.8.1V3.8zM21 13.1V23l-9.8-1.4V13H21z"/></svg>';
  var CLOSE_SVG = '<svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true"><path fill="currentColor" d="M1.4.3.3 1.4 4.9 6 .3 10.6l1.1 1.1L6 7.1l4.6 4.6 1.1-1.1L7.1 6l4.6-4.6L10.6.3 6 4.9z"/></svg>';
  var SB_LOGO_TWOTONE_SVG = '<svg width="30" height="24" viewBox="0 0 30 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' + '<path d="M0 8.73079C0 3.9089 3.94941 0 8.82125 0H17.5181L14.5473 4.61538H8.82125C6.52481 4.61538 4.66321 6.45789 4.66321 8.73079C4.66321 11.0036 6.52481 12.8461 8.82125 12.8461H17.2188L10.0393 24H4.51021L8.71919 17.4609C3.89438 17.4069 0 13.5189 0 8.73079Z" fill="#664CFE"/>' + '<path d="M21.1788 11.1538C23.4752 11.1538 25.3368 12.9963 25.3368 15.2692C25.3368 17.5421 23.4752 19.3846 21.1788 19.3846H15.4504L12.4796 24H21.1788C26.0506 24 30 20.0911 30 15.2692C30 10.4803 26.1044 6.5919 21.2785 6.53898L25.4874 0H19.9583L12.7789 11.1538H21.1788Z" fill="#42D299"/>' + "</svg>";
  // src/components/keys-block.ts
  var SB_KEYS_CSS = `#booster-keys-block {
  margin: 24px 0 32px 0;
  width: 100%;
  box-sizing: border-box;
  font-family: 'Motiva Sans', 'Nunito Sans', Arial, sans-serif;
}
#booster-keys-block .booster-keys-title {
  font-weight: 700; font-size: 32px; line-height: 32px; color: #fff;
  /* 32px gap between our title and the rows (per keys-for-region.xml). */
  margin: 0 0 32px 0;
}
#booster-keys-block .booster-keys-list {
  display: flex; flex-direction: column;
  /* Rows carry a chip that protrudes ~18px below; keep rows from colliding
   * (single row in the mock; spacing covers the multi-row case too). */
  gap: 28px;
  /* Room for the last row's protruding chip. */
  padding-bottom: 18px;
}
#booster-keys-block .booster-keys-row {
  position: relative;               /* anchor for the absolute chip + os icon */
  min-height: 64px;
  padding: 14px 24px;
  border-radius: 4px;
  background: linear-gradient(90deg, #2c3c49 0%, #576674 100%);
  box-sizing: border-box;
  display: flex; align-items: center;
}
#booster-keys-block .booster-keys-head {
  display: flex; align-items: center; gap: 12px;
  /* Keep the name+region clear of the chip overlapping the right side. */
  padding-right: 280px;
}
#booster-keys-block .booster-keys-name {
  font-weight: 700; font-size: 20px; line-height: 24px; color: #fff;
}
/* Region label chip (e.g. "Global") next to the game name. */
#booster-keys-block .booster-keys-region {
  flex: none; background: rgba(255, 255, 255, .14); color: #fff;
  font-size: 12px; line-height: 16px; font-weight: 500;
  border-radius: 3px; padding: 2px 8px; white-space: nowrap;
}
/* Inactive row: dimmed, "Скоро в продаже" instead of the buy cluster. */
#booster-keys-block .booster-keys-row--inactive { opacity: .8; }
#booster-keys-block .booster-keys-inactive-label {
  color: #fff; opacity: .7; font-size: 12px; line-height: 16px; white-space: nowrap;
}
#booster-keys-block .booster-keys-os {
  position: absolute; top: 14px; right: 24px;
  display: inline-flex; align-items: center; color: #fff;
  width: 24px; height: 24px;
}
/* Black chip with the discount/price/buy cluster — bottom-right, straddling
 * the row's bottom edge so it protrudes downward (per the design). */
#booster-keys-block .booster-keys-actions {
  position: absolute; right: 24px; bottom: -18px;
  display: flex; align-items: center; gap: 12px;
  background: #000; border-radius: 2px; padding: 3px;
}
#booster-keys-block .booster-keys-discount {
  background: #664cfe; color: #fff; font-weight: 500; font-size: 22px;
  line-height: 16px; border-radius: 3px; padding: 7px 8px;
}
#booster-keys-block .booster-keys-prices {
  display: flex; flex-direction: column; align-items: flex-end;
  line-height: 1; color: #fff;
}
/* No discount badge on the left → give the price the same 12px breathing room
   it has on its right (the chip's gap before the buy button) so it looks
   symmetric inside the black chip. */
#booster-keys-block .booster-keys-actions--no-discount .booster-keys-prices {
  padding-left: 12px;
}
#booster-keys-block .booster-keys-orig {
  opacity: .5; font-size: 10px; text-decoration: line-through; color: #fff;
}
#booster-keys-block .booster-keys-price {
  font-size: 12px; color: #fff;
}
#booster-keys-block .booster-keys-buy {
  display: inline-flex; align-items: center; gap: 8px;
  background: #34a37b; color: #fff; border: 0; cursor: pointer;
  border-radius: 2px; padding: 7px 16px; font-weight: 500; font-size: 14px;
  line-height: 16px;
}
#booster-keys-block .booster-keys-buy:hover { filter: brightness(1.08); }
#booster-keys-block .booster-keys-buy:disabled { cursor: default; filter: none; opacity: .6; }
#booster-keys-block .booster-keys-buy--busy { opacity: .6; }
#booster-keys-block .booster-keys-buy-icon {
  display: inline-flex; align-items: center;
  width: 14px; height: 12px;
}
`;
  function ensureKeysStyles() {
    if (document.getElementById("booster-keys-style"))
      return;
    const s = document.createElement("style");
    s.id = "booster-keys-style";
    s.textContent = SB_KEYS_CSS;
    document.head.appendChild(s);
  }
  function buildKeysBlock(items, opts) {
    opts.logoUrl;
    const root = document.createElement("div");
    root.id = "booster-keys-block";
    root.setAttribute("data-sb", "1");
    root.setAttribute("aria-label", LL.addfunds.keys_block_aria_label());
    const title = document.createElement("div");
    title.className = "booster-keys-title";
    title.textContent = LL.addfunds.keys_block_title();
    root.appendChild(title);
    const list = document.createElement("div");
    list.className = "booster-keys-list";
    for (const item of items)
      list.appendChild(buildRow(item, opts.onBuy));
    root.appendChild(list);
    return root;
  }
  function buildRow(item, onBuy) {
    const inactive = item.isActive === false;
    const row = document.createElement("div");
    row.className = "booster-keys-row";
    if (inactive)
      row.classList.add("booster-keys-row--inactive");
    const head = document.createElement("div");
    head.className = "booster-keys-head";
    const name = document.createElement("div");
    name.className = "booster-keys-name";
    name.textContent = LL.addfunds.keys_row_label({ gameName: item.name });
    head.appendChild(name);
    if (item.regionLabel) {
      const region = document.createElement("span");
      region.className = "booster-keys-region";
      region.textContent = item.regionLabel;
      head.appendChild(region);
    }
    row.appendChild(head);
    const os = document.createElement("span");
    os.className = "booster-keys-os";
    os.innerHTML = WINDOWS_SVG;
    row.appendChild(os);
    const actions = document.createElement("div");
    actions.className = "booster-keys-actions";
    let buy = null;
    if (inactive) {
      const soon = document.createElement("span");
      soon.className = "booster-keys-inactive-label";
      soon.textContent = LL.addfunds.keys_item_coming_soon();
      actions.appendChild(soon);
    } else {
      if (item.discountPercent > 0) {
        const badge = document.createElement("span");
        badge.className = "booster-keys-discount";
        badge.textContent = `-${item.discountPercent}%`;
        actions.appendChild(badge);
      } else {
        actions.classList.add("booster-keys-actions--no-discount");
      }
      const price = document.createElement("div");
      price.className = "booster-keys-prices";
      if (item.oldPrice != null && item.oldPrice > item.price) {
        const orig = document.createElement("span");
        orig.className = "booster-keys-orig";
        orig.textContent = fmtMoneyKeys(item.oldPrice);
        price.appendChild(orig);
      }
      const cur = document.createElement("span");
      cur.className = "booster-keys-price";
      cur.textContent = fmtMoneyKeys(item.price);
      price.appendChild(cur);
      actions.appendChild(price);
      buy = document.createElement("button");
      buy.type = "button";
      buy.className = "booster-keys-buy";
      buy.textContent = LL.addfunds.keys_buy_button();
      const buyIcon = document.createElement("span");
      buyIcon.className = "booster-keys-buy-icon";
      buyIcon.innerHTML = SB_SWIRL_SVG;
      buy.appendChild(buyIcon);
      const handle = {
        setBusy(b) {
          if (buy) {
            buy.disabled = b;
            buy.classList.toggle("booster-keys-buy--busy", b);
          }
        }
      };
      buy.addEventListener("click", () => onBuy(item, handle));
      actions.appendChild(buy);
    }
    row.appendChild(actions);
    return row;
  }

  // src/components/email-modal.css
  var email_modal_default = `#booster-email-modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 2147483000;
  background: rgba(0, 0, 0, 0.65);
  display: flex;
  align-items: center;
  justify-content: center;
}

.booster-email-card {
  background: #1b2838;
  border-radius: 4px;
  padding: 32px;
  width: 420px;
  max-width: calc(100vw - 48px);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6);
  font-family: 'Motiva Sans', 'Nunito Sans', Arial, sans-serif;
  color: #c6d4df;
  box-sizing: border-box;
}

.booster-email-title {
  margin: 0 0 12px 0;
  font-size: 20px;
  font-weight: 700;
  color: #fff;
}

.booster-email-hint {
  margin: 0 0 16px 0;
  font-size: 14px;
  line-height: 1.5;
  color: #8f98a0;
}

.booster-email-input {
  width: 100%;
  box-sizing: border-box;
  padding: 8px 12px;
  background: #316282;
  border: 1px solid #4d7695;
  border-radius: 3px;
  color: #c6d4df;
  font-size: 14px;
  outline: none;
}

.booster-email-input:focus {
  border-color: #66c0f4;
}

.booster-email-error {
  margin: 6px 0 0 0;
  min-height: 1.25em;
  font-size: 12px;
  color: #e96767;
}

.booster-email-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 20px;
}

.booster-email-cancel {
  padding: 8px 18px;
  background: transparent;
  border: 1px solid #4d7695;
  border-radius: 3px;
  color: #c6d4df;
  font-size: 14px;
  cursor: pointer;
}

.booster-email-cancel:hover {
  border-color: #66c0f4;
  color: #fff;
}

.booster-email-confirm {
  padding: 8px 18px;
  background: #4c7b9e;
  border: 0;
  border-radius: 3px;
  color: #fff;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
}

.booster-email-confirm:hover {
  background: #5a8fb8;
}
`;

  // src/components/email-modal.ts
  var EMAIL_MODAL_CSS = typeof __SB_EMAIL_MODAL_CSS__ !== "undefined" ? __SB_EMAIL_MODAL_CSS__ : email_modal_default;
  function ensureEmailModalStyles() {
    if (document.getElementById("booster-email-modal-style"))
      return;
    const s = document.createElement("style");
    s.id = "booster-email-modal-style";
    s.textContent = EMAIL_MODAL_CSS;
    document.head.appendChild(s);
  }
  function isValidEmail(s) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
  }
  function openEmailModal() {
    ensureEmailModalStyles();
    return new Promise((resolve) => {
      const overlay = document.createElement("div");
      overlay.id = "booster-email-modal-overlay";
      const card = document.createElement("div");
      card.className = "booster-email-card";
      const title = document.createElement("h2");
      title.className = "booster-email-title";
      title.textContent = LL.addfunds.keys_email_modal_title();
      card.appendChild(title);
      const hint = document.createElement("p");
      hint.className = "booster-email-hint";
      hint.textContent = LL.addfunds.keys_email_modal_hint();
      card.appendChild(hint);
      const input = document.createElement("input");
      input.type = "email";
      input.className = "booster-email-input";
      input.placeholder = LL.addfunds.keys_email_modal_placeholder();
      card.appendChild(input);
      const error = document.createElement("p");
      error.className = "booster-email-error";
      card.appendChild(error);
      const actions = document.createElement("div");
      actions.className = "booster-email-actions";
      const cancelBtn = document.createElement("button");
      cancelBtn.type = "button";
      cancelBtn.className = "booster-email-cancel";
      cancelBtn.textContent = LL.addfunds.keys_email_modal_cancel();
      actions.appendChild(cancelBtn);
      const confirmBtn = document.createElement("button");
      confirmBtn.type = "button";
      confirmBtn.className = "booster-email-confirm";
      confirmBtn.textContent = LL.addfunds.keys_email_modal_confirm();
      actions.appendChild(confirmBtn);
      card.appendChild(actions);
      overlay.appendChild(card);
      document.body.appendChild(overlay);
      input.focus();
      function close(result) {
        document.removeEventListener("keydown", onKeyDown);
        overlay.remove();
        resolve(result);
      }
      function onKeyDown(e) {
        if (e.key === "Escape")
          close(null);
      }
      document.addEventListener("keydown", onKeyDown);
      cancelBtn.addEventListener("click", () => close(null));
      overlay.addEventListener("click", (e) => {
        if (e.target === overlay)
          close(null);
      });
      confirmBtn.addEventListener("click", () => {
        const val = input.value.trim();
        if (!isValidEmail(val)) {
          error.textContent = LL.addfunds.keys_email_modal_invalid();
          return;
        }
        close(val);
      });
    });
  }

  // src/components/error-modal.css
  var error_modal_default = `#booster-error-modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 2147483000;
  background: rgba(0, 0, 0, 0.65);
  display: flex;
  align-items: center;
  justify-content: center;
}

.booster-error-card {
  position: relative;
  background: #1b2838;
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 4px;
  padding: 28px 32px;
  width: 400px;
  max-width: calc(100vw - 48px);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6);
  font-family: 'Motiva Sans', 'Nunito Sans', Arial, sans-serif;
  color: #c6d4df;
  box-sizing: border-box;
}

.booster-error-close-x {
  position: absolute;
  top: 12px;
  right: 12px;
  width: 24px;
  height: 24px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  background: none;
  border: 0;
  color: #8f98a0;
  cursor: pointer;
  opacity: 0.85;
  transition: color 0.12s ease, opacity 0.12s ease;
}

.booster-error-close-x:hover {
  color: #fff;
  opacity: 1;
}

.booster-error-title {
  margin: 0 4px 12px 0;
  font-size: 20px;
  font-weight: 700;
  color: #fff;
}

.booster-error-body {
  margin: 0;
  font-size: 14px;
  line-height: 1.5;
  color: #c6d4df;
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 40vh;
  overflow-y: auto;
}

.booster-error-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 24px;
}

.booster-error-close-btn {
  padding: 9px 24px;
  background: linear-gradient(to right, #75b022 0%, #588a1b 100%);
  border: 0;
  border-radius: 3px;
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: filter 0.12s ease;
}

.booster-error-close-btn:hover {
  filter: brightness(1.12);
}

.booster-error-close-btn:focus {
  outline: none;
}

.booster-error-close-btn:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px rgba(102, 192, 244, 0.6);
}
`;

  // src/components/error-modal.ts
  var ERROR_MODAL_CSS = typeof __SB_ERROR_MODAL_CSS__ !== "undefined" ? __SB_ERROR_MODAL_CSS__ : error_modal_default;
  function ensureErrorModalStyles() {
    if (document.getElementById("booster-error-modal-style"))
      return;
    const s = document.createElement("style");
    s.id = "booster-error-modal-style";
    s.textContent = ERROR_MODAL_CSS;
    document.head.appendChild(s);
  }
  var activeClose = null;
  function openErrorModal(message) {
    ensureErrorModalStyles();
    activeClose?.();
    const overlay = document.createElement("div");
    overlay.id = "booster-error-modal-overlay";
    const card = document.createElement("div");
    card.className = "booster-error-card";
    card.setAttribute("role", "alertdialog");
    card.setAttribute("aria-modal", "true");
    card.setAttribute("aria-labelledby", "booster-error-title");
    card.setAttribute("aria-describedby", "booster-error-body");
    const closeX = document.createElement("button");
    closeX.type = "button";
    closeX.className = "booster-error-close-x";
    closeX.setAttribute("aria-label", LL.addfunds.keys_error_modal_close());
    closeX.innerHTML = CLOSE_SVG;
    card.appendChild(closeX);
    const title = document.createElement("h2");
    title.id = "booster-error-title";
    title.className = "booster-error-title";
    title.textContent = LL.addfunds.keys_error_modal_title();
    card.appendChild(title);
    const body = document.createElement("p");
    body.id = "booster-error-body";
    body.className = "booster-error-body";
    body.textContent = message.replace(/\r\n/g, `
`);
    card.appendChild(body);
    const actions = document.createElement("div");
    actions.className = "booster-error-actions";
    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "booster-error-close-btn";
    closeBtn.textContent = LL.addfunds.keys_error_modal_close();
    actions.appendChild(closeBtn);
    card.appendChild(actions);
    overlay.appendChild(card);
    document.body.appendChild(overlay);
    closeBtn.focus();
    function close() {
      if (activeClose === close)
        activeClose = null;
      document.removeEventListener("keydown", onKeyDown);
      overlay.remove();
    }
    activeClose = close;
    function onKeyDown(e) {
      if (e.key === "Escape")
        close();
    }
    document.addEventListener("keydown", onKeyDown);
    closeX.addEventListener("click", close);
    closeBtn.addEventListener("click", close);
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay)
        close();
    });
  }

  // src/lib/catalogue-api.ts
  var TTL_MS = 10 * 60 * 1000;
  var CACHE_KEY = "sb.addfunds.catalogue.v1";
  function isHttpUrl(s) {
    return /^https?:\/\//i.test(s);
  }
  function buildCatalogueUrl(params) {
    const q = new URLSearchParams;
    if (params?.country)
      q.set("country", params.country);
    if (params?.currency)
      q.set("currency", params.currency);
    const qs = q.toString();
    return qs ? `${CATALOGUE_API}?${qs}` : CATALOGUE_API;
  }
  async function fetchCatalogue(sb2, params) {
    try {
      if (!sb2 || !sb2.net)
        return { status: "error" };
      const signal = params?.signal;
      const r = await sb2.net.fetch(buildCatalogueUrl(params), signal ? { signal } : undefined);
      if (!r.ok)
        return { status: "error" };
      const body = await r.json();
      if (body.success !== true || !Array.isArray(body.data))
        return { status: "error" };
      const items = [];
      for (const e of body.data) {
        if (e && typeof e === "object" && typeof e.link === "string" && typeof e.cover === "string" && isHttpUrl(e.link) && isHttpUrl(e.cover)) {
          items.push({ link: e.link, cover: e.cover });
        }
      }
      return items.length ? { status: "ok", items } : { status: "empty" };
    } catch {
      return { status: "error" };
    }
  }
  function readCache() {
    try {
      const raw = window.localStorage.getItem(CACHE_KEY);
      if (!raw)
        return null;
      const o = JSON.parse(raw);
      if (!o || !Array.isArray(o.items) || typeof o.fetchedAt !== "number" || typeof o.attemptedAt !== "number")
        return null;
      return o;
    } catch {
      return null;
    }
  }
  function writeCache(rec) {
    try {
      window.localStorage.setItem(CACHE_KEY, JSON.stringify(rec));
    } catch {}
  }
  function decide(now, cache) {
    if (!cache)
      return { render: null, shouldFetch: true };
    const hasItems = cache.items.length > 0;
    const fresh = now - cache.fetchedAt < TTL_MS;
    const backoff = now - cache.attemptedAt < TTL_MS;
    if (hasItems && fresh)
      return { render: cache.items, shouldFetch: false };
    if (hasItems && !fresh)
      return { render: cache.items, shouldFetch: !backoff };
    return { render: null, shouldFetch: !backoff };
  }
  // src/components/region-games-block.ts
  var SB_REGION_GAMES_CSS = `#booster-region-games {
  background: #131a22;
  border-radius: 4px;
  padding: 24px;
  overflow: hidden;
  box-sizing: border-box;
  width: 100%;
  margin: 0 0 8px 0;
  cursor: pointer;
}
#booster-region-games .rg-header {
  display: flex; align-items: center; justify-content: space-between;
}
#booster-region-games .rg-title {
  color: #fff; font: 700 18px/1.5 'Nunito Sans', 'Motiva Sans', Arial, sans-serif;
}
#booster-region-games .rg-logo {
  display: inline-flex; align-items: center; flex: none;
}
#booster-region-games .rg-viewport {
  /* 150px (vs the 134px card) gives the hover-scale vertical room so the
     enlarged card isn't clipped by overflow; cards are centered in the extra
     space. overflow:hidden still clips the horizontal marquee. */
  height: 150px; overflow: hidden; position: relative; margin-top: 16px;
  display: flex; align-items: center;
}
#booster-region-games .rg-track {
  display: flex; align-items: center; gap: 8px; will-change: transform;
  animation-name: rg-scroll; animation-timing-function: linear; animation-iteration-count: infinite;
}
@keyframes rg-scroll {
  from { transform: translateX(0); }
  to   { transform: translateX(calc(-1 * var(--rg-shift))); }
}
#booster-region-games:hover .rg-track { animation-play-state: paused; }
#booster-region-games .rg-card {
  flex: 0 0 89px; width: 89px; height: 134px; border-radius: 4px; overflow: hidden;
  position: relative; transform-origin: center center; will-change: transform;
  /* PlayStation-menu style: grow in place on hover. The carousel is already
     paused on hover, so the card stays put while it scales. */
  transition: transform 0.24s cubic-bezier(0.2, 0.7, 0.2, 1), box-shadow 0.24s ease;
}
#booster-region-games .rg-card:hover {
  transform: scale(1.09);
  z-index: 2;
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.55);
}
#booster-region-games .rg-card img {
  width: 100%; height: 100%; object-fit: cover; display: block;
}
#booster-region-games .rg-fade-l,
#booster-region-games .rg-fade-r {
  position: absolute; top: 0; bottom: 0; width: 48px; pointer-events: none;
}
#booster-region-games .rg-fade-l {
  left: 0; background: linear-gradient(90deg, #131a22, transparent);
}
#booster-region-games .rg-fade-r {
  right: 0; background: linear-gradient(270deg, #131a22, transparent);
}
@media (prefers-reduced-motion: reduce) {
  #booster-region-games .rg-track { animation: none; }
  #booster-region-games .rg-card { transition: none; }
  #booster-region-games .rg-viewport { overflow-x: auto; }
}
`;
  var CARD_WIDTH = 89;
  var CARD_GAP = 8;
  var VIEWPORT_EST = 396;
  var SPEED_PX_S = 17.3;
  function ensureRegionGamesStyles() {
    if (document.getElementById("booster-region-games-style"))
      return;
    const s = document.createElement("style");
    s.id = "booster-region-games-style";
    s.textContent = SB_REGION_GAMES_CSS;
    document.head.appendChild(s);
  }
  function buildRegionGamesBlock(items, opts) {
    const root = document.createElement("div");
    root.id = "booster-region-games";
    root.setAttribute("data-sb", "1");
    root.setAttribute("aria-label", LL.addfunds.region_games_aria_label());
    root.addEventListener("click", () => {
      opts.onBackgroundClick();
    });
    const header = document.createElement("div");
    header.className = "rg-header";
    const title = document.createElement("div");
    title.className = "rg-title";
    title.textContent = LL.addfunds.region_games_title();
    header.appendChild(title);
    const logo = document.createElement("span");
    logo.className = "rg-logo";
    logo.innerHTML = SB_LOGO_TWOTONE_SVG;
    header.appendChild(logo);
    root.appendChild(header);
    if (items.length === 0)
      return root;
    const viewport = document.createElement("div");
    viewport.className = "rg-viewport";
    const track = document.createElement("div");
    track.className = "rg-track";
    const setWidth = items.length * (CARD_WIDTH + CARD_GAP);
    const setCount = Math.max(2, Math.ceil((VIEWPORT_EST + setWidth) / setWidth));
    for (let i = 0;i < setCount; i++) {
      for (const item of items)
        track.appendChild(buildCard(item));
    }
    track.style.setProperty("--rg-shift", `${setWidth}px`);
    track.style.animationDuration = `${setWidth / SPEED_PX_S}s`;
    viewport.appendChild(track);
    const fadeL = document.createElement("div");
    fadeL.className = "rg-fade-l";
    viewport.appendChild(fadeL);
    const fadeR = document.createElement("div");
    fadeR.className = "rg-fade-r";
    viewport.appendChild(fadeR);
    root.appendChild(viewport);
    return root;
  }
  function buildCard(item) {
    const card = document.createElement("a");
    card.className = "rg-card";
    card.href = item.link;
    card.addEventListener("click", (e) => {
      e.stopPropagation();
    });
    const img = document.createElement("img");
    img.loading = "lazy";
    img.draggable = false;
    img.alt = "";
    img.src = item.cover;
    card.appendChild(img);
    return card;
  }

  // src/pages/app.ts
  var LOGO = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAIgAAAAkCAMAAABluoL1AAAAjVBMVEUAAAD///////////////////////////////////////////////////////9mS/5B0pn///9C05hA0JdlTP9iSv////////9PnsVB0plC0plB0phlTP5C0pllS/5lTP9mTP9nTP9lS/1D05hmS/9C05hC0pllS/9nTv9mTP9nTP////////9mTP5C0pnFhVtRAAAALHRSTlMAv39g359AII/vEB+vb0/f38/BIb8gMD8Qf59h7+/PfY9An0Zfr49gL6+fgKHZBZgAAARfSURBVFjDtZfretsgDEAFvgG1nTpJnWubZl3XXZS+/+NNRtg4Adr+6fm+xkxJ5hOEhYCR8/PT8TLnN8DqnbmHOOZfjtjVpRETd+AGCoieBgYGlBDNOMggzXl9ueEHRe+dyAqiVDla2gon7gAZAYQc3oUBgZhbd4oUkGL7fLll8QCwcx57iKMQ282mUZWRMmsQm0xKQyJFIynAt89RwUBuJQGyj0Qeni4BPykxjy4xK4gjsJ5ND98ISCQbY4bkMHciNQ65qbFOimwXoccfiu/fmQMk6D4TKTEnF8Mimc2WxiYp8nwJocQcnMcrpCgQmw9FFNaDAViBO42G1AQLRTj72x8XjhMlJr1S/Q9GnB6B3ouojDA2dw3ZFhy9K0iJ/pIi69HitJ2HfzmPHaRphyWYV2w1iTAbu0R6yDB3Ipmdnyol8tt5PM01ghKSoJKkovsbkU4QFGxRc8pYxGjdYgcZ/cU4+cfV40vIi/NLqyCKG5F2WiK5lNKuGTO8K7BDyVOUzszP6+jufeLx9cCx9JK9Ecmmp4op3Lw06HMV4uo6hInx3CdVuESZqEjFSeqmBNFLDkkRt0LA40uIZ7+NKVQ8I3l8RlpvyCKjuP6yyOE9YBkxybGrpUKUscWqoOBVaTQ2UM5F8IPUHH2AS0hoEu69Ai0i+vgK8lTjTvAVEbfPnNOJSReUStaiaMexNHYgmYwGPadINvwu00v5UYFf+8h2OedxenpW8I34Cv8MCQ5jon7B97IYS+sZ4qyWbkq28K28+WZoPePveFvfmLzA9xJ0iUGp3UVzU6qiFqLOgMmkbDkuG3oNozzoZcNfrkWtGkMfYCj2wMkJWlbPS7RllMgUU0HPOc7XIIrawFhY/yEDIMZRwuRqD9xGS4lEvek30m1yFRLmRoSjd6O2ZBEbFkqqurZtbS0IiJuc4HMR/m1j3cpQCMxuRdpZVKMev1X4j4jrzvF0rbIAiKTmNRTx/1OBSvFoFLmNKo2l+5ZGmRCBh7f1MZ4YX2p3URGNiidm03JAus6Ho22LmqNSobANNfSIbUKEZX6MKzXeFLwEIlVVKcSKF4MxvByk231uo7JELK0IDTYzkYowVyL+cBXbA++DRsSiN/yPbvj9jRcJohIEqoiIRcKMP2EJIY3duNvsQhEhOtc922MTd+xehAOKo/RKWTJfEHmbJWZ/72CL4MDn9/NK2/vmNPOlQu1F3BPlo4VdpKGIAs/8GT7y4SrgAFERsPfp/SHci/ho70QkTd+ni/XvWELindEOEiJyuDToaOYimY+yiNGYkYjB4PENzzeLeGe0h5RIgdqerV0zNhepeVRztOAGl0RAuI9UEZGFLyGrRF5CkQqgzDn5DRANajv/UhUFL4lZtHan1NxeaPE0AksS6eSAP2f5/ihIzHIFUREmr6bVR9d+2gyh99FynCdhRabPKAowkRKyuz7TLHeJhmgjOo2YFxVAK4Trp0ULmWCmKHCUtyQhCr4OXyVPJZj/j80BM5/SIzUAAAAASUVORK5CYII=";
  function registerAppPage(sb2, deps = {}) {
    const keysClient = deps.keysClient ?? createKeysClient(sb2);
    const openEmailModal2 = deps.openEmailModal ?? openEmailModal;
    const openErrorModal2 = deps.openErrorModal ?? openErrorModal;
    const fetchCatalogue2 = deps.fetchCatalogue ?? fetchCatalogue;
    const snap = ensureSnapshotService(sb2);
    async function runPurchase(item, handle) {
      handle.setBusy(true);
      const titles = {
        title: LL.addfunds.keys_purchase_window_title({ gameName: item.name }),
        taskbarTitle: LL.addfunds.keys_purchase_window_taskbar_title()
      };
      let r = await keysClient.purchaseKey(item.itemId, undefined, titles);
      if (r.status === "email-required") {
        handle.setBusy(false);
        const email = await openEmailModal2();
        if (!email)
          return;
        handle.setBusy(true);
        r = await keysClient.purchaseKey(item.itemId, email, titles);
      }
      handle.setBusy(false);
      if (r.status === "error") {
        if (r.error)
          console.error("[booster-addfunds] key purchase failed:", r.error);
        const msg = typeof r.message === "string" && r.message.trim() ? r.message.trim() : LL.addfunds.keys_purchase_error();
        openErrorModal2(msg);
      }
    }
    async function mountRegion(ctx) {
      const errBox = await waitForElement("#error_box", ctx.signal);
      if (!errBox || ctx.signal.aborted)
        return;
      const appId = parseAppId(ctx.url.toString());
      if (appId == null)
        return;
      const items = await keysClient.requestKeys(appId, ctx.signal);
      if (ctx.signal.aborted || items.length === 0)
        return;
      ensureKeysStyles();
      const block = buildKeysBlock(items, {
        onBuy: (item, row) => {
          runPurchase(item, row);
        },
        logoUrl: LOGO
      });
      errBox.parentElement?.insertBefore(block, errBox.nextSibling);
      return () => {
        try {
          block.remove();
        } catch {}
        document.getElementById("booster-keys-style")?.remove();
      };
    }
    async function mountNormal(ctx) {
      const buyArea = await waitForElement("#game_area_purchase", ctx.signal);
      if (!buyArea || ctx.signal.aborted)
        return;
      const col = buyArea.parentElement;
      if (!col)
        return;
      const appId = parseAppId(ctx.url.toString());
      const items = appId != null ? await keysClient.requestKeys(appId, ctx.signal) : [];
      if (ctx.signal.aborted)
        return;
      const teardowns = [];
      const mountTopupBar = () => {
        if (document.getElementById("booster-topup-bar"))
          return;
        const bar = buildTopupBar({
          heading: LL.addfunds.row_label(),
          ariaLabel: LL.addfunds.row_aria_label(),
          placeholder: "",
          currencySymbol: "",
          logoUrl: LOGO,
          onSubmit: (amount) => {
            sb2.bus.publish("booster-addfunds.topup-requested", { amount });
          }
        });
        bar.root.style.marginTop = "0";
        const apply = (s) => {
          const def = defaultAmountForCurrency(s.currency);
          bar.setCurrency(currencySym(s.currency), def > 0 ? String(def) : "");
        };
        const unsub = snap.subscribe(apply);
        const editionPrice = readFirstEditionPrice(document);
        if (editionPrice != null)
          bar.setAmount(editionPrice);
        ensureTopupStyles();
        col.insertBefore(bar.root, col.firstChild);
        teardowns.push(() => {
          unsub();
          try {
            bar.root.remove();
          } catch {}
          document.getElementById("booster-topup-style")?.remove();
        });
      };
      const mountChip = (block, item) => {
        const action = block.querySelector(".game_purchase_action");
        if (!action || action.classList.contains("booster-dist-host"))
          return;
        ensureEditionOfferStyles();
        action.classList.add("booster-dist-host");
        if (item.packageId != null)
          action.dataset.sbKeysSubid = String(item.packageId);
        const chip = buildEditionOfferChip({ item, onBuy: () => void runPurchase(item, chip) });
        action.appendChild(chip.root);
        teardowns.push(() => {
          try {
            chip.root.remove();
            action.classList.remove("booster-dist-host");
            delete action.dataset.sbKeysSubid;
          } catch {}
          if (document.querySelectorAll(".booster-eo").length === 0)
            document.getElementById("booster-edition-offer-style")?.remove();
        });
      };
      const mountComingSoonChip = (block) => {
        const action = block.querySelector(".game_purchase_action");
        if (!action || action.classList.contains("booster-dist-host"))
          return;
        ensureEditionOfferStyles();
        action.classList.add("booster-dist-host");
        const chip = buildEditionOfferChip({ comingSoon: true });
        action.appendChild(chip.root);
        teardowns.push(() => {
          try {
            chip.root.remove();
            action.classList.remove("booster-dist-host");
          } catch {}
          if (document.querySelectorAll(".booster-eo").length === 0)
            document.getElementById("booster-edition-offer-style")?.remove();
        });
      };
      const blocks = [...buyArea.querySelectorAll(".game_area_purchase_game")];
      const pairs = matchItemsToBlocks(items, blocks);
      if (pairs.length > 0) {
        for (const { block, item } of pairs)
          mountChip(block, item);
      } else {
        mountTopupBar();
        const soonTarget = blocks.find(isPurchasableBlock);
        if (soonTarget)
          mountComingSoonChip(soonTarget);
      }
      if (teardowns.length === 0)
        return;
      return () => {
        for (const t of teardowns)
          t();
      };
    }
    async function mountRegionGames(ctx) {
      try {
        const col = await waitForElementBy(() => [...document.querySelectorAll(".rightcol.game_meta_data")].find((c) => c.childElementCount > 0) ?? null, ctx.signal);
        if (!col || ctx.signal.aborted)
          return;
        if (document.getElementById("booster-region-games"))
          return;
        const now = (deps.now ?? (() => Date.now()))();
        const cache = readCache();
        const d = decide(now, cache);
        let teardown;
        const insert = (items) => {
          if (ctx.signal.aborted || document.getElementById("booster-region-games"))
            return;
          ensureRegionGamesStyles();
          const block = buildRegionGamesBlock(items, {
            onBackgroundClick: () => {
              window.location.assign(REGION_GAMES_PROMO_URL);
            }
          });
          col.insertBefore(block, col.firstChild);
          teardown = () => {
            try {
              block.remove();
            } catch {}
            document.getElementById("booster-region-games-style")?.remove();
          };
        };
        if (d.render)
          insert(d.render);
        if (d.shouldFetch) {
          const country = (await sb2.steam?.getStoreCountry?.())?.toUpperCase() ?? null;
          const currency = snap.get()?.currency?.toUpperCase() ?? null;
          const res = await fetchCatalogue2(sb2, { country, currency, signal: ctx.signal });
          if (ctx.signal.aborted)
            return teardown;
          if (res.status === "ok") {
            writeCache({ items: res.items, fetchedAt: now, attemptedAt: now });
            if (!teardown)
              insert(res.items);
          } else if (res.status === "empty") {
            writeCache({ items: [], fetchedAt: now, attemptedAt: now });
            if (teardown) {
              teardown();
              teardown = undefined;
            }
          } else {
            writeCache({ items: cache?.items ?? [], fetchedAt: cache?.fetchedAt ?? 0, attemptedAt: now });
          }
        }
        return teardown;
      } catch {
        return;
      }
    }
    sb2.pages.register({
      name: "booster-addfunds-app",
      match: { url: /store\.steampowered\.com\/app\/\d+/ },
      mount: async (ctx) => {
        if (document.readyState === "loading") {
          await new Promise((r) => document.addEventListener("DOMContentLoaded", () => r(), { once: true, signal: ctx.signal }));
        }
        if (ctx.signal.aborted)
          return;
        if (detectRegionLock(document))
          return mountRegion(ctx);
        const results = await Promise.allSettled([mountNormal(ctx), mountRegionGames(ctx)]);
        const teardowns = results.filter((r) => r.status === "fulfilled").map((r) => r.value).filter((v) => typeof v === "function");
        if (teardowns.length === 0)
          return;
        return () => {
          for (const t of teardowns)
            t();
        };
      }
    });
  }

  // src/lib/cart-total.ts
  var norm = (s) => (s ?? "").replace(/\s+/g, " ").trim();
  function findCartTotalLabel(doc) {
    return [...doc.querySelectorAll("div")].find((d) => {
      const own = norm([...d.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join(""));
      return own.startsWith("Общая стоимость");
    }) ?? null;
  }
  function findCartTotal(doc) {
    const label = findCartTotalLabel(doc);
    const parent = label?.parentElement;
    if (!parent)
      return null;
    for (const child of parent.children) {
      if (child === label)
        continue;
      const v = parseAmount(child.textContent ?? "");
      if (v != null && Number.isFinite(v))
        return v;
    }
    return null;
  }

  // src/pages/cart.ts
  var LOGO2 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAIgAAAAkCAMAAABluoL1AAAAjVBMVEUAAAD///////////////////////////////////////////////////////9mS/5B0pn///9C05hA0JdlTP9iSv////////9PnsVB0plC0plB0phlTP5C0pllS/5lTP9mTP9nTP9lS/1D05hmS/9C05hC0pllS/9nTv9mTP9nTP////////9mTP5C0pnFhVtRAAAALHRSTlMAv39g359AII/vEB+vb0/f38/BIb8gMD8Qf59h7+/PfY9An0Zfr49gL6+fgKHZBZgAAARfSURBVFjDtZfretsgDEAFvgG1nTpJnWubZl3XXZS+/+NNRtg4Adr+6fm+xkxJ5hOEhYCR8/PT8TLnN8DqnbmHOOZfjtjVpRETd+AGCoieBgYGlBDNOMggzXl9ueEHRe+dyAqiVDla2gon7gAZAYQc3oUBgZhbd4oUkGL7fLll8QCwcx57iKMQ282mUZWRMmsQm0xKQyJFIynAt89RwUBuJQGyj0Qeni4BPykxjy4xK4gjsJ5ND98ISCQbY4bkMHciNQ65qbFOimwXoccfiu/fmQMk6D4TKTEnF8Mimc2WxiYp8nwJocQcnMcrpCgQmw9FFNaDAViBO42G1AQLRTj72x8XjhMlJr1S/Q9GnB6B3ouojDA2dw3ZFhy9K0iJ/pIi69HitJ2HfzmPHaRphyWYV2w1iTAbu0R6yDB3Ipmdnyol8tt5PM01ghKSoJKkovsbkU4QFGxRc8pYxGjdYgcZ/cU4+cfV40vIi/NLqyCKG5F2WiK5lNKuGTO8K7BDyVOUzszP6+jufeLx9cCx9JK9Ecmmp4op3Lw06HMV4uo6hInx3CdVuESZqEjFSeqmBNFLDkkRt0LA40uIZ7+NKVQ8I3l8RlpvyCKjuP6yyOE9YBkxybGrpUKUscWqoOBVaTQ2UM5F8IPUHH2AS0hoEu69Ai0i+vgK8lTjTvAVEbfPnNOJSReUStaiaMexNHYgmYwGPadINvwu00v5UYFf+8h2OedxenpW8I34Cv8MCQ5jon7B97IYS+sZ4qyWbkq28K28+WZoPePveFvfmLzA9xJ0iUGp3UVzU6qiFqLOgMmkbDkuG3oNozzoZcNfrkWtGkMfYCj2wMkJWlbPS7RllMgUU0HPOc7XIIrawFhY/yEDIMZRwuRqD9xGS4lEvek30m1yFRLmRoSjd6O2ZBEbFkqqurZtbS0IiJuc4HMR/m1j3cpQCMxuRdpZVKMev1X4j4jrzvF0rbIAiKTmNRTx/1OBSvFoFLmNKo2l+5ZGmRCBh7f1MZ4YX2p3URGNiidm03JAus6Ho22LmqNSobANNfSIbUKEZX6MKzXeFLwEIlVVKcSKF4MxvByk231uo7JELK0IDTYzkYowVyL+cBXbA++DRsSiN/yPbvj9jRcJohIEqoiIRcKMP2EJIY3duNvsQhEhOtc922MTd+xehAOKo/RKWTJfEHmbJWZ/72CL4MDn9/NK2/vmNPOlQu1F3BPlo4VdpKGIAs/8GT7y4SrgAFERsPfp/SHci/ho70QkTd+ni/XvWELindEOEiJyuDToaOYimY+yiNGYkYjB4PENzzeLeGe0h5RIgdqerV0zNhepeVRztOAGl0RAuI9UEZGFLyGrRF5CkQqgzDn5DRANajv/UhUFL4lZtHan1NxeaPE0AksS6eSAP2f5/ihIzHIFUREmr6bVR9d+2gyh99FynCdhRabPKAowkRKyuz7TLHeJhmgjOo2YFxVAK4Trp0ULmWCmKHCUtyQhCr4OXyVPJZj/j80BM5/SIzUAAAAASUVORK5CYII=";
  var DEBOUNCE_MS = 200;
  var norm2 = (s) => (s ?? "").replace(/\s+/g, " ").trim();
  var CART_HEADING = "Ваша корзина";
  function findCartHeaderNow() {
    return [...document.querySelectorAll("div,h1,h2,span")].find((el) => {
      const own = norm2([...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join(""));
      if (!own.startsWith(CART_HEADING))
        return false;
      if (el.closest("a"))
        return false;
      return ![...el.parentElement?.children ?? []].some((c) => c.tagName === "A");
    }) ?? null;
  }
  function isColumnRow(el) {
    try {
      const view = el.ownerDocument?.defaultView;
      const d = view?.getComputedStyle(el).display ?? el.style?.display ?? "";
      return d === "flex" || d === "grid" || d === "inline-flex" || d === "inline-grid";
    } catch {
      return false;
    }
  }
  function findItemsColumn(header) {
    const container = header.parentElement;
    if (!container)
      return null;
    const row = [...container.children].find((c) => c !== header && isColumnRow(c) && c.children.length === 2);
    const items = row?.children[0];
    return items && items.children.length > 0 ? items : null;
  }
  function findAnchorNow() {
    const header = findCartHeaderNow();
    if (header) {
      const items = findItemsColumn(header);
      if (items)
        return { parent: items, before: items.firstChild };
      if (header.parentElement)
        return { parent: header.parentElement, before: header.nextSibling };
    }
    const block = findCartTotalLabel(document)?.parentElement;
    if (block?.parentElement)
      return { parent: block.parentElement, before: block };
    return null;
  }
  function registerCartPage(sb2) {
    const snap = ensureSnapshotService(sb2);
    sb2.pages.register({
      name: "booster-addfunds-cart",
      match: { url: /store\.steampowered\.com\/cart\/?($|\?|#)/ },
      mount: async (ctx) => {
        if (document.readyState === "loading") {
          await new Promise((r) => document.addEventListener("DOMContentLoaded", () => r(), { once: true, signal: ctx.signal }));
        }
        if (ctx.signal.aborted)
          return;
        const anchor = await waitForElementBy(findAnchorNow, ctx.signal);
        if (ctx.signal.aborted)
          return;
        if (!anchor) {
          console.warn("[booster-addfunds] cart: no anchor — header and total both missing, bar not rendered");
          return;
        }
        if (!findCartHeaderNow()) {
          console.warn("[booster-addfunds] cart header not found — anchoring above the total block");
        }
        ensureTopupStyles();
        const root = document.querySelector(".responsive_page_content") ?? document.body;
        const OPTS = { subtree: true, childList: true, characterData: true };
        let bar = null;
        let lastAmount = null;
        const desired = () => {
          const total = findCartTotal(document);
          const s = snap.get();
          if (total == null || s == null || s.balance == null)
            return null;
          if (s.balance >= total)
            return null;
          return Math.ceil(total - s.balance);
        };
        const render = () => {
          const amount = desired();
          const sym = currencySym(snap.get()?.currency ?? null);
          if (amount == null) {
            if (bar) {
              observer.disconnect();
              bar.root.remove();
              bar = null;
              lastAmount = null;
              observer.observe(root, OPTS);
            }
            return;
          }
          if (!bar) {
            bar = buildTopupBar({
              heading: LL.addfunds.cart_heading(),
              amount,
              currencySymbol: sym,
              logoUrl: LOGO2,
              onSubmit: (a) => {
                sb2.bus.publish("booster-addfunds.topup-requested", { amount: a });
              }
            });
            observer.disconnect();
            anchor.parent.insertBefore(bar.root, anchor.before);
            observer.observe(root, OPTS);
            lastAmount = amount;
          } else if (amount !== lastAmount) {
            bar.setAmount(amount);
            if (bar.symbol.textContent !== sym)
              bar.setCurrency(sym, "");
            lastAmount = amount;
          }
        };
        let timer = null;
        const observer = new MutationObserver(() => {
          if (timer)
            clearTimeout(timer);
          timer = setTimeout(render, DEBOUNCE_MS);
        });
        render();
        observer.observe(root, OPTS);
        const unsub = snap.subscribe(render);
        ctx.signal.addEventListener("abort", () => {
          if (timer)
            clearTimeout(timer);
        }, { once: true });
        return () => {
          observer.disconnect();
          if (timer)
            clearTimeout(timer);
          unsub();
          try {
            bar?.root.remove();
          } catch {}
          document.getElementById("booster-topup-style")?.remove();
        };
      }
    });
  }

  // src/pages/catalog-nav.ts
  function registerCatalogNav(sb2) {
    sb2.pages.register({
      name: "booster-addfunds-catalog-nav",
      match: { url: /^https:\/\/store\.steampowered\.com(\/|$)/ },
      mount: () => {
        const handle = sb2.ui.addStoreNavButton({
          id: "booster-catalog-nav",
          label: LL.addfunds.catalog_menu_item(),
          icon: SB_SWIRL_SVG,
          url: STORE_NAV_CATALOG_URL,
          variant: "brand",
          placement: "start"
        });
        return () => handle.remove();
      }
    });
  }

  // src/lib/keys-config.ts
  var services2 = new WeakMap;
  function ensureKeysConfigService(sb2) {
    const existing = services2.get(sb2.scope.signal);
    if (existing)
      return existing;
    let cached = null;
    sb2.bus.subscribe("booster-checkout.keys.config", (data) => {
      const d = data;
      if (!d)
        return;
      cached = {
        paymentId: typeof d.paymentId === "string" && d.paymentId ? d.paymentId : null,
        storeCountry: typeof d.storeCountry === "string" && d.storeCountry ? d.storeCountry : null
      };
    });
    sb2.bus.publish("booster-addfunds.keys.config.request", null);
    const svc = { get: () => cached };
    services2.set(sb2.scope.signal, svc);
    return svc;
  }

  // src/install.ts
  async function installAddFundsWeb(ctx) {
    const sb2 = ctx.sb;
    await sb2.lifecycle.ready();
    const keysConfig = ensureKeysConfigService(sb2);
    const keysClient = createKeysClient(sb2, { keysConfig });
    registerAddFundsPage(sb2);
    registerAppPage(sb2, { keysClient });
    registerCartPage(sb2);
    registerCatalogNav(sb2);
    return () => {
      keysClient.dispose();
    };
  }

  // src/main/install.ts
  async function installAddFundsMain(ctx) {
    const sb2 = ctx.sb;
    await sb2.lifecycle.ready();
    let handle = null;
    const MAX_TRIES = 6;
    for (let attempt = 0;attempt < MAX_TRIES && !ctx.signal.aborted; attempt++) {
      try {
        handle = await sb2.ui.addMenuItem({
          id: "booster-catalog",
          menu: "store",
          label: LL.addfunds.catalog_menu_item(),
          icon: SB_SWIRL_SVG,
          url: STORE_MENU_CATALOG_URL,
          variant: "brand",
          placement: "top"
        });
        break;
      } catch (e) {
        ctx.log.warn(`addMenuItem attempt ${attempt + 1}/${MAX_TRIES} failed`, { error: String(e) });
        if (attempt < MAX_TRIES - 1) {
          try {
            await delay(ctx, 300 * (attempt + 1));
          } catch {
            break;
          }
        }
      }
    }
    return () => {
      if (handle) {
        handle.remove();
        handle = null;
      }
    };
  }
  function delay(ctx, ms) {
    return new Promise((resolve, reject) => {
      if (ctx.signal.aborted) {
        reject(new Error("aborted"));
        return;
      }
      const id = ctx.scope.setTimeout(resolve, ms);
      ctx.signal.addEventListener("abort", () => {
        ctx.scope.clearTimeout(id);
        reject(new Error("aborted"));
      }, { once: true });
    });
  }

  // src/url-patterns.ts
  var ADDFUNDS_URL_PATTERNS = [
    "^https://store\\.steampowered\\.com(/.*)?$"
  ];

  // src/index.ts
  sb.plugins.register({
    id: "booster-addfunds",
    version: "1.0.2",
    apiVersion: 1,
    displayName: "SteamBalance — AddFunds",
    description: "Дополнительная строка «Пополнить кошелёк» на Steam-странице /steamaccount/addfunds.",
    contextKinds: [ContextKind.Web, ContextKind.Main],
    urlPatterns: ADDFUNDS_URL_PATTERNS,
    capabilities: [
      Capability.Ui,
      Capability.Steam,
      Capability.Configs,
      Capability.Bus,
      Capability.Pages,
      Capability.Net
    ],
    async init(ctx) {
      if (ctx.contextKind === ContextKind.Main) {
        return await installAddFundsMain(ctx);
      }
      return await installAddFundsWeb(ctx);
    }
  });
})();

//# debugId=BE27A43CDD4558A464756E2164756E21
