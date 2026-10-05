import {TOPUP_ID,TOPUP_WIDTH,TOPUP_HEIGHT} from './topup-theme.ts';
import type {WindowEntry} from './relay.ts';

// Iframes remain attached to the same parent for their lifetime. Reparenting
// unloads their documents in Chromium, losing form state and bridge bindings.
export function presentFrame(entry:WindowEntry, host:HTMLElement):()=>void {
  const node=entry.frame.node;
  if(!node)return()=>{};
  if(node.ownerDocument!==host.ownerDocument)throw Error('Окно Steam сменилось. Восстановите подключение SteamBooster.');
  const ownerWindow=host.ownerDocument.defaultView!;
  const layout=()=>{
    const box=host.getBoundingClientRect();
    const isTopup=entry.id===TOPUP_ID;
    const width=isTopup?Math.min(TOPUP_WIDTH,Math.max(240,box.width-32)):entry.popup?(entry.width??378):box.width;
    const height=isTopup?Math.min(TOPUP_HEIGHT,Math.max(200,box.height-32)):entry.popup?(entry.height??322):box.height;
    const scale=entry.popup&&!isTopup?Math.min(1.35,Math.max(0,box.width-32)/width,Math.max(0,box.height-32)/height):1;
    Object.assign(node.style,{display:'block',position:'fixed',zIndex:'2147483647',
      width:width+'px',height:height+'px',
      left:(box.left+(box.width-width*scale)/2)+'px',top:(box.top+(box.height-height*scale)/2)+'px',
      transform:`scale(${scale})`,transformOrigin:'top left',borderRadius:entry.popup?'12px':'0',
      boxShadow:entry.popup?'0 20px 64px #0008':'none'});
  };
  layout();
  const observer=new (ownerWindow as Window & typeof globalThis).ResizeObserver(layout);observer.observe(host);
  ownerWindow.addEventListener('resize',layout);
  return()=>{observer.disconnect();ownerWindow.removeEventListener('resize',layout);node.style.display='none';};
}
