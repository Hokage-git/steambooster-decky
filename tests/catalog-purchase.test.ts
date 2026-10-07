import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Window} from 'happy-dom';
const code=()=>readFileSync(new URL('../backend/catalog-purchase.js',import.meta.url),'utf8');
const tick=()=>new Promise(r=>setTimeout(r,10));
test('catalog asks for email only after explicit no-email, and submits once on confirmation',async()=>{
 const w=new Window({url:'https://steambalance.cc/booster/catalogue'});const calls:any[]=[];
 (w as any).SteamBooster=Object.freeze({purchaseKey:async(...args:any[])=>{calls.push(args);return calls.length===1?{ok:false,error:'no-email'}:{ok:true};},getSteamId:()=>({steamId:'test'})});
 try{
 w.eval(code());w.eval(code());
 const result=(w as any).SteamBooster.purchaseKey(41,{gameName:'Test Game'});await tick();
 assert.equal(calls.length,1);const dialog=w.document.querySelector('[role="dialog"]')!;assert.ok(dialog);
 assert.match(dialog.textContent,/Test Game/);
 const form=dialog.querySelector('form')!,input=dialog.querySelector('input')!;
 form.dispatchEvent(new w.Event('submit',{cancelable:true}));assert.equal(calls.length,1);
 input.value='player@example.com';form.dispatchEvent(new w.Event('submit',{cancelable:true}));form.dispatchEvent(new w.Event('submit',{cancelable:true}));
 assert.deepEqual(await result,{ok:true});assert.equal(calls.length,2);assert.equal(calls[1][1].email,'player@example.com');
 assert.equal(w.document.querySelector('[role="dialog"]'),null);
 assert.equal((w as any).SteamBooster.getSteamId().steamId,'test');
 }finally{await w.happyDOM.close();}
});
test('unknown payment result is never retried and gives a useful message',async()=>{
 const w=new Window({url:'https://steambalance.cc/booster/catalogue'});let calls=0;
 (w as any).SteamBooster=Object.freeze({purchaseKey:async()=>{calls++;return {ok:false,error:'window'};}});
 try{w.eval(code());const result=await (w as any).SteamBooster.purchaseKey(41);assert.equal(calls,1);assert.match(result.message,/заказ/i);assert.equal(w.document.querySelector('input'),null);}finally{await w.happyDOM.close();}
});
test('closing the email prompt does not submit an order',async()=>{
 const w=new Window({url:'https://steambalance.cc/booster/catalogue'});let calls=0;
 (w as any).SteamBooster=Object.freeze({purchaseKey:async()=>{calls++;return {ok:false,error:'no-email'};}});
 try{w.eval(code());const pending=(w as any).SteamBooster.purchaseKey(41);await tick();w.document.querySelector<HTMLButtonElement>('[data-cancel]')!.click();assert.equal((await pending).error,'cancelled');assert.equal(calls,1);}finally{await w.happyDOM.close();}
});
