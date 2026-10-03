;(() => {
  if (location.origin !== 'https://steambalance.cc') return;
  globalThis.__sb_decky_links?.();
  const navigate = event => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const node = event.target;
    if (!(node instanceof Element) || node.closest('button,[role=button]')) return;
    const anchor = node.closest('a[href]');
    if (!anchor || !/^https:\/\/store\.steampowered\.com\/app\/[0-9]+(?:\/|$)/.test(anchor.href)) return;
    event.preventDefault();
    globalThis[__NAV__](anchor.href);
  };
  document.addEventListener('click', navigate, true);
  globalThis.__sb_decky_links = () => {
    document.removeEventListener('click', navigate, true);
    delete globalThis.__sb_decky_links;
  };
})();
