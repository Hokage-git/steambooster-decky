import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Window} from 'happy-dom';
const script=()=>readFileSync(new URL('../backend/store-tools.js',import.meta.url),'utf8').replace('__STORE_BINDING__',JSON.stringify('__storeAction'));
const tick=()=>new Promise(r=>setTimeout(r,20));
test('one compact topup action sits beside original catalog and reconciles replacement',async()=>{
 const w=new Window({url:'https://store.steampowered.com/app/730/'});
 const calls:string[]=[];(w as any).__storeAction=(action:string)=>calls.push(action);
 try{
  w.document.body.innerHTML='<nav><button data-booster-storenav-btn id="catalog">Каталог</button></nav>';
  const catalog=w.document.querySelector('#catalog');
  w.eval(script());w.eval(script());
  const topup=w.document.querySelector<HTMLButtonElement>('#sb-decky-store-tools');
  assert.equal(topup?.tagName,'BUTTON');assert.equal(topup?.parentElement,catalog?.parentElement);
  assert.equal(w.document.querySelector('#catalog'),catalog);
  assert.ok(!/sticky|fixed/.test(topup!.style.cssText));topup!.click();assert.deepEqual(calls,['topup']);
  w.document.body.innerHTML='<nav><button data-booster-storenav-btn>Каталог</button></nav>';await tick();
  assert.equal(w.document.querySelectorAll('#sb-decky-store-tools').length,1);
  assert.equal(w.document.querySelector('#sb-decky-store-tools')?.parentElement?.tagName,'NAV');
  (w as any).__sb_decky_store_tools();await tick();assert.equal(w.document.querySelector('#sb-decky-store-tools'),null);
 }finally{(w as any).__sb_decky_store_tools?.();await w.happyDOM.close();}
});
test('topup waits for a real host and never inserts a body banner',async()=>{
 const w=new Window({url:'https://store.steampowered.com/'});
 try{w.eval(script());assert.equal(w.document.querySelector('#sb-decky-store-tools'),null);
 w.document.body.innerHTML='<div id="game_area_purchase"></div>';await tick();
 assert.equal(w.document.querySelector('#sb-decky-store-tools')?.parentElement?.id,'game_area_purchase');
 }finally{(w as any).__sb_decky_store_tools?.();await w.happyDOM.close();}
});
test('store control is absent on other origins',async()=>{
 const w=new Window({url:'https://example.com/'});
 try{w.eval(script());assert.equal(w.document.querySelector('#sb-decky-store-tools'),null);}finally{await w.happyDOM.close();}
});
