type Editable=HTMLInputElement|HTMLTextAreaElement;
export type SteamKeyboard={ShowVirtualKeyboard:()=>void;HideVirtualKeyboard:()=>void;BIsActive:()=>boolean};
export type KeyboardOptions={BIsElementValidForInput:()=>boolean;onTextEntered:(text:string)=>void;onKeyboardNavOut:()=>void};
export type KeyboardHook=(options:KeyboardOptions)=>SteamKeyboard|undefined;
const functions=(module:unknown):Function[]=>module&&typeof module==='object'?Object.values(module).filter((v):v is Function=>typeof v==='function'):[];
// Steam's exported names change across builds; these are the keyboard provider's
// own stable method names, also used by Steam's native text controls.
export function keyboardHook(module:unknown):KeyboardHook|undefined {
 const values=functions(module);
 if(!values.some(fn=>fn.toString().includes('CreateVirtualKeyboardRef.bind')))return;
 return values.find(fn=>{const text=fn.toString();return text.length<500&&text.includes('useContext')&&text.includes('.current');}) as KeyboardHook|undefined;
}
export function keyboardVisibilityHook(module:unknown):(()=>boolean)|undefined {
 return functions(module).find(fn=>{const text=fn.toString();return text.length<300&&text.includes('return')&&text.includes('.IsShowingVirtualKeyboard');}) as (()=>boolean)|undefined;
}
function editable(node:EventTarget|null):node is Editable {
 const el=node as HTMLInputElement|null;
 return !!el&&!el.disabled&&!el.readOnly&&(el.tagName==='TEXTAREA'||el.tagName==='INPUT'&&['text','search','tel','url','email','password','number'].includes(el.type));
}
export class FormKeyboard {
 target?:Editable;
 keyboard?:SteamKeyboard;
 open=false;
 changed:(open:boolean)=>void;
 unavailable:()=>void;
 closed:()=>void;
 constructor(changed:(open:boolean)=>void,unavailable:()=>void=()=>{},closed:()=>void=()=>{}){this.changed=changed;this.unavailable=unavailable;this.closed=closed;}
 options:KeyboardOptions={
  BIsElementValidForInput:()=>!!this.target?.isConnected,
  onTextEntered:text=>this.type(text),
  onKeyboardNavOut:()=>this.close(),
 };
 attach(document:Document,keyboard:SteamKeyboard|undefined):()=>void {
  this.keyboard=keyboard;
  const click=(event:Event)=>{
   if(!editable(event.target))return;
   if(!this.keyboard){this.unavailable();return;}
   this.target=event.target;
   const view=document.defaultView as (Window & {__sb_decky_focus?:Editable;__sb_decky_focusStyle?:{element:HTMLElement;outline:string}})|null;
   if(view){
    const previous=view.__sb_decky_focusStyle;
    if(previous?.element!==this.target){
     if(previous)previous.element.style.outline=previous.outline;
     view.__sb_decky_focusStyle={element:this.target,outline:this.target.style.outline};
    }
    view.__sb_decky_focus=this.target;
    this.target.style.outline='3px solid #1a9fff';
   }
   this.target.focus({preventScroll:true});
   try{this.target.select();}catch{/* number inputs do not support selection */}
   this.open=true;this.changed(true);
   try{
    this.keyboard.ShowVirtualKeyboard();
    if(!this.keyboard.BIsActive()){this.close();this.unavailable();}
   }catch{this.close();this.unavailable();}
  };
  document.addEventListener('click',click);
  return()=>{document.removeEventListener('click',click);this.close();this.keyboard=undefined;};
 }
 close(){
  if(!this.open)return;
  this.open=false;
  if(this.keyboard?.BIsActive())this.keyboard.HideVirtualKeyboard();
  this.target?.blur();this.target=undefined;this.changed(false);this.closed();
 }
 type(text:string){
  const input=this.target;
  if(!this.open||!input?.isConnected){this.close();return;}
  if(text==='Enter'||text==='Tab'){input.dispatchEvent(new input.ownerDocument.defaultView!.Event('change',{bubbles:true}));this.close();return;}
  let start=input.selectionStart??input.value.length,end=input.selectionEnd??start;
  if(text==='ArrowLeft'||text==='ArrowRight'){
   const at=text==='ArrowLeft'?Math.max(0,start-1):Math.min(input.value.length,end+1);
   try{input.setSelectionRange(at,at);}catch{}return;
  }
  if(text==='ArrowUp'||text==='ArrowDown')return;
  if(text==='Backspace'){if(start===end)start=Math.max(0,start-1);text='';}
  if(text==='Delete'){if(start===end)end=Math.min(input.value.length,end+1);text='';}
  const value=(input.value.slice(0,start)+text+input.value.slice(end)).slice(0,4096);
  const view=input.ownerDocument.defaultView! as Window & typeof globalThis;
  const prototype=input.tagName==='TEXTAREA'?view.HTMLTextAreaElement.prototype:view.HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(prototype,'value')!.set!.call(input,value);
  try{input.setSelectionRange(start+text.length,start+text.length);}catch{}
  input.dispatchEvent(new view.Event('input',{bubbles:true}));
 }
}
