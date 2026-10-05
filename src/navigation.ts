import type {WindowEntry} from './relay.ts';
type Environment={get:(id:string)=>WindowEntry|undefined;openPage:()=>void;openWeb:(url:string)=>void;back:()=>void;changed:()=>void};
export class PageNavigation {
 activeId?:string;
 returnId?:string;
 paymentId?:string;
 env:Environment;
 constructor(env:Environment){this.env=env;}
 show(id:string){
  const entry=this.env.get(id);
  if(entry?.external&&entry.url){this.openWeb(entry.url);this.paymentId=id;this.env.changed();return;}
  const previous=this.activeId;this.activeId=id;this.returnId=id;
  if(!previous)this.env.openPage();this.env.changed();
 }
 openWeb(url:string){
  const previous=this.activeId;
  const entry=previous?this.env.get(previous):undefined;
  const display=entry?.frame.node?.style.display;
  if(entry?.frame.node)entry.frame.node.style.display='none';
  // The original checkout sends popup-hide after opening its payment page.
  // Clear ownership before navigating so that hide cannot pop the new route.
  this.activeId=undefined;
  try{this.env.openWeb(url);}catch(error){this.activeId=previous;if(entry?.frame.node)entry.frame.node.style.display=display??'';throw error;}
 }
 reset(){this.activeId=undefined;this.returnId=undefined;this.paymentId=undefined;}
 hide(id:string){
  const entry=this.env.get(id);if(entry?.frame.node)entry.frame.node.style.display='none';
  if(this.activeId===id){this.activeId=undefined;this.returnId=undefined;this.env.back();}
 }
}
