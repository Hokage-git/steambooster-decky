(()=>{
  if(location.origin!=='https://store.steampowered.com')return;
  globalThis.__sb_decky_store_tools?.();
  const binding=__STORE_BINDING__;
  let disposed=false;
  const button=document.createElement('button');
  button.id='sb-decky-store-tools';button.type='button';button.textContent='Пополнить баланс';button.tabIndex=0;button.setAttribute('data-panel',JSON.stringify({focusable:true,clickOnActivate:true}));
  button.style.cssText='display:inline-flex;align-items:center;justify-content:center;margin:4px 8px;padding:7px 12px;min-height:36px;border:1px solid #47738d;border-radius:3px;background:#23465b;color:#fff;font:inherit;font-size:14px;cursor:pointer;box-sizing:border-box;';
  // Native button focus lets Steam/browser navigation own the selected state.
  button.addEventListener('click',()=>globalThis[binding]?.('topup'));
  const visible=el=>{if(!el)return false;for(let node=el;node;node=node.parentElement){const css=getComputedStyle(node);if(node.hidden||css.display==='none'||css.visibility==='hidden')return false;}return true;};
  const mount=()=>{
    if(disposed||!document.documentElement)return;
    const catalog=document.querySelector('[data-booster-storenav-btn]');
    const host=[catalog?.parentElement,document.querySelector('[data-featuretarget="store-menu-v7"]'),document.querySelector('#store_nav'),document.querySelector('#game_area_purchase'),document.querySelector('#purchaseOptionsContent')].find(visible);
    if(host&&button.parentElement!==host)host.append(button);
    else if(!host&&button.isConnected)button.remove();
  };
  const observer=new MutationObserver(mount);
  observer.observe(document,{childList:true,subtree:true,attributes:true,attributeFilter:["hidden","style","class"]});mount();
  globalThis.__sb_decky_store_tools=()=>{disposed=true;observer.disconnect();button.remove();delete globalThis.__sb_decky_store_tools;};
})();
