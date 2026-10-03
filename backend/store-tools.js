(()=>{
  if(location.origin!=='https://store.steampowered.com')return;
  globalThis.__sb_decky_store_tools?.();
  const binding=__STORE_BINDING__;
  const bar=document.createElement('nav');
  bar.id='sb-decky-store-tools';
  bar.setAttribute('aria-label','SteamBooster');
  bar.style.cssText='position:sticky;top:0;z-index:1000;display:flex;flex-wrap:wrap;gap:8px;align-items:center;padding:10px 16px;background:#1b2838;color:white;box-sizing:border-box;';
  const title=document.createElement('span');title.textContent='SteamBooster';bar.append(title);
  for(const [action,label] of [['catalog','Каталог игр'],['valuation','Оцени аккаунт'],['topup','Пополнить баланс']]){
    const button=document.createElement('button');button.type='button';button.textContent=label;
    button.className='btnv6_blue_hoverfade btn_medium';button.tabIndex=0;
    button.style.cssText='padding:8px 12px;cursor:pointer;font:inherit;color:#fff;border:1px solid #67c1f5;border-radius:3px;background:#23465b;';
    button.addEventListener('click',()=>globalThis[binding]?.(action));
    bar.append(button);
  }
  const mount=()=>{if(document.body&&!bar.isConnected)document.body.prepend(bar);};
  const observer=new MutationObserver(mount);
  observer.observe(document,{childList:true,subtree:true});mount();
  globalThis.__sb_decky_store_tools=()=>{observer.disconnect();bar.remove();delete globalThis.__sb_decky_store_tools;};
})();
