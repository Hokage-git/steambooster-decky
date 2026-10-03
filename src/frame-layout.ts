import type {WindowEntry} from './relay.ts';

// Iframes remain attached to the same parent for their lifetime. Reparenting
// unloads their documents in Chromium, losing form state and bridge bindings.
export function presentFrame(entry:WindowEntry, host:HTMLElement):()=>void {
  const node=entry.frame.node;
  if(!node)return()=>{};
  const layout=()=>{
    const box=host.getBoundingClientRect();
    const width=entry.popup?(entry.width??378):box.width;
    const height=entry.popup?(entry.height??322):box.height;
    const scale=entry.popup?Math.min(1.35,Math.max(0,box.width-32)/width,Math.max(0,box.height-32)/height):1;
    Object.assign(node.style,{display:'block',position:'fixed',zIndex:'100',
      width:width+'px',height:height+'px',
      left:(box.left+(box.width-width*scale)/2)+'px',top:(box.top+(box.height-height*scale)/2)+'px',
      transform:`scale(${scale})`,transformOrigin:'top left',borderRadius:entry.popup?'12px':'0',
      boxShadow:entry.popup?'0 20px 64px #0008':'none'});
  };
  layout();
  const observer=new ResizeObserver(layout);observer.observe(host);
  window.addEventListener('resize',layout);
  return()=>{observer.disconnect();window.removeEventListener('resize',layout);node.style.display='none';};
}
