import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Window} from 'happy-dom';
const script=()=>readFileSync(new URL('../backend/store-tools.js',import.meta.url),'utf8').replace('__STORE_BINDING__',JSON.stringify('__storeAction'));
test('store toolbar dispatches actions, survives DOM replacement, and cleans up',async()=>{
 const w=new Window({url:'https://store.steampowered.com/app/730/'});
 const calls:string[]=[];(w as any).__storeAction=(action:string)=>calls.push(action);
 try{
  w.eval(script());w.eval(script());
  assert.equal(w.document.querySelectorAll('#sb-decky-store-tools').length,1);
  const buttons=w.document.querySelectorAll<HTMLButtonElement>('#sb-decky-store-tools button');
  assert.equal(buttons.length,3);
  for(const b of buttons)b.click();
  assert.deepEqual(calls,['catalog','valuation','topup']);
  w.document.body.replaceChildren();await new Promise(r=>setTimeout(r,20));
  assert.equal(w.document.querySelectorAll('#sb-decky-store-tools').length,1);
  (w as any).__sb_decky_store_tools();await new Promise(r=>setTimeout(r,20));
  assert.equal(w.document.querySelectorAll('#sb-decky-store-tools').length,0);
 }finally{(w as any).__sb_decky_store_tools?.();await w.happyDOM.close();}
});
test('store toolbar is absent on other origins',async()=>{
 const w=new Window({url:'https://example.com/'});
 try{w.eval(script());assert.equal(w.document.querySelector('#sb-decky-store-tools'),null);}finally{await w.happyDOM.close();}
});
