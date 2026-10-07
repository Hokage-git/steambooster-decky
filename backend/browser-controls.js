function browserControl(action, value) {
  const elements = [...document.querySelectorAll('a[href],button,input,textarea,select,[role="button"],[tabindex]')]
    .filter(el => !el.disabled && el.tabIndex >= 0 && el.getBoundingClientRect().width > 0 && el.getBoundingClientRect().height > 0 && getComputedStyle(el).visibility !== 'hidden');
  let current = elements.includes(document.activeElement) ? document.activeElement : globalThis.__sb_decky_focus;
  if (!elements.includes(current)) current = elements[0];
  if (action === 'next' || action === 'prev') {
    const index = elements.indexOf(current);
    current = elements[(index + (action === 'next' ? 1 : -1) + elements.length) % elements.length];
  }
  globalThis.__sb_decky_focus = current;
  if (!current) return {label:'Нет доступных элементов', input:false, value:''};
  const input = (current instanceof HTMLInputElement && ['text','search','tel','url','email','password','number'].includes(current.type)) || current instanceof HTMLTextAreaElement;
  if (action === 'text' && input) {
    const proto = current instanceof HTMLInputElement ? HTMLInputElement.prototype : HTMLTextAreaElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(current, value);
    current.dispatchEvent(new Event('input', {bubbles:true}));
    current.dispatchEvent(new Event('change', {bubbles:true}));
  }
  if (action !== 'read') {
    const previous = globalThis.__sb_decky_focusStyle;
    if (previous?.element !== current) {
      if (previous) previous.element.style.outline = previous.outline;
      globalThis.__sb_decky_focusStyle = {element:current, outline:current.style.outline};
    }
    current.focus({preventScroll:true});
    current.scrollIntoView({block:'nearest'});
    current.style.outline='3px solid #1a9fff';
  }
  if (action === 'activate') current.click();
  return {label:(current.getAttribute('aria-label') || current.getAttribute('placeholder') || current.textContent || current.tagName).trim().slice(0,120), input, value: input ? current.value : ''};
}
