import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {Window} from 'happy-dom';
const file=new URL('../backend/store-offers.js',import.meta.url);
const tick=()=>new Promise(r=>setTimeout(r,25));
const until=async(check:()=>boolean)=>{for(let i=0;i<40&&!check();i++)await tick();assert.ok(check(),'DOM reconciliation completes');};
const offer={itemId:41,name:'Portal Deluxe',regionLabel:'Россия / СНГ',price:799,isActive:true,packageId:999};
async function fixture(html='<div id="game_area_purchase"><div class="game_area_purchase_game"><input name="subid" value="123"><span class="discount_final_price">999 ₽</span></div></div>',manualClock=false,earlyDocument=false){
 const w=new Window({url:'https://store.steampowered.com/app/620/'});w.document.body.innerHTML=html;if(earlyDocument)w.document.documentElement.remove();
 const timers=new Map<number,{cb:()=>void,ms:number,interval:boolean}>();let timerId=0;
 if(manualClock){
  (w as any).setTimeout=(cb:()=>void,ms:number)=>{timers.set(++timerId,{cb,ms,interval:false});return timerId;};
  (w as any).setInterval=(cb:()=>void,ms:number)=>{timers.set(++timerId,{cb,ms,interval:true});return timerId;};
  (w as any).clearTimeout=(id:number)=>timers.delete(id);(w as any).clearInterval=(id:number)=>timers.delete(id);
 }
 const fire=(ms:number)=>{for(const [id,timer] of [...timers])if(timer.ms===ms){if(!timer.interval)timers.delete(id);timer.cb();}};
 const subs=new Map<string,Set<(d:any)=>void>>();const sent:{topic:string,data:any}[]=[];let plugin:any,page:any;let unregisters=0;
 const controller=new w.AbortController();
 (w as any).sb={plugins:{register:(p:any)=>{assert.ok(p.displayName,'framework requires displayName');plugin=p;}}};
 assert.ok(existsSync(file),'scoped store offers plugin exists');w.eval(readFileSync(file,'utf8'));
 const emit=(topic:string,data:any)=>{for(const cb of subs.get('booster-checkout.keys.'+topic)||[])cb(data);};
 const stop=await plugin.init({signal:controller.signal,sb:{bus:{subscribe:(topic:string,cb:any)=>{if(!subs.has(topic))subs.set(topic,new Set());subs.get(topic)!.add(cb);return()=>subs.get(topic)!.delete(cb);},publish:(topic:string,data:any)=>{assert.ok(topic.startsWith('decky-store.'));sent.push({topic,data});}},pages:{register:(p:any)=>{page=p;return{unregister:()=>{unregisters++;}};}}}});
 const unmount=await page.mount({url:new URL(w.location.href),signal:controller.signal});
 const reply=(items:any[],extra={})=>emit('response',{reqId:sent.filter(x=>x.topic.endsWith('.request')).at(-1)?.data.reqId,items,...extra});
 const close=async()=>{unmount?.();stop?.();controller.abort();await w.happyDOM.close();};
 return {w,sent,emit,reply,close,subs,controller,plugin,unregisters:()=>unregisters,timers,fire};
}
test('available unmatched packages render actual name region and price inside Purchase Options',async()=>{
 const f=await fixture('<div id="purchaseOptionsContent"><div class="native">Purchase Options</div></div>');
 try{f.reply([offer,{...offer,itemId:42,isActive:false}]);await tick();
 const root=f.w.document.querySelector('#sb-decky-offers')!;assert.equal(root.parentElement?.id,'purchaseOptionsContent');
 assert.match(root.textContent,/Portal Deluxe/);assert.match(root.textContent,/Россия/);assert.match(root.textContent,/799/);
 assert.doesNotMatch(root.textContent,/дешевле/i);assert.equal(root.querySelectorAll('button[data-item-id]').length,1);
 }finally{await f.close();}
});
test('empty replies leave no dead offer or coming soon button',async()=>{
 const f=await fixture();try{f.reply([]);await tick();assert.equal(f.w.document.querySelector('#sb-decky-offers'),null);}finally{await f.close();}
});
test('list errors offer an explicit retry and new response survives Purchase Options replacement',async()=>{
 const f=await fixture();try{f.reply([],{error:'no-payment'});await tick();
 const retry=f.w.document.querySelector<HTMLButtonElement>('#sb-decky-offers button')!;assert.match(retry.textContent,/Повторить/);retry.click();
 assert.equal(f.sent.filter(x=>x.topic.endsWith('.request')).length,2);f.reply([offer]);await tick();
 f.w.document.body.innerHTML='<div id="purchaseOptionsContent"></div>';await until(()=>!!f.w.document.querySelector('#purchaseOptionsContent #sb-decky-offers'));
 assert.equal(f.w.document.querySelectorAll('#sb-decky-offers').length,1);
 assert.equal(f.w.document.querySelector('#sb-decky-offers')?.parentElement?.id,'purchaseOptionsContent');
 }finally{await f.close();}
});
test('email-required needs an explicit valid continuation; a purchase is never automatically resent',async()=>{
 const f=await fixture();try{f.reply([offer]);await tick();
 f.w.document.querySelector<HTMLButtonElement>('[data-item-id="41"]')!.click();
 const purchases=()=>f.sent.filter(x=>x.topic.endsWith('.purchase'));
 assert.equal(purchases().length,1);f.emit('email-required',{reqId:purchases()[0].data.reqId});await tick();assert.equal(purchases().length,1);
 const email=f.w.document.querySelector<HTMLInputElement>('input[type="email"]')!;assert.ok(email);
 const form=email.closest('form')!;form.dispatchEvent(new f.w.Event('submit',{cancelable:true,bubbles:true}));assert.equal(purchases().length,1);
 email.value='player@example.com';form.dispatchEvent(new f.w.Event('submit',{cancelable:true,bubbles:true}));assert.equal(purchases().length,2);assert.equal(purchases()[1].data.email,'player@example.com');
 f.emit('purchase-result',{reqId:purchases()[1].data.reqId,ok:false,error:'window'});await tick();assert.match(f.w.document.querySelector('#sb-decky-offers')!.textContent,/Мои заказы/);assert.equal(purchases().length,2);
 f.emit('ready',{});await tick();assert.equal(purchases().length,2);
 }finally{await f.close();}
});
test('unload removes offers styles subscriptions and ignores late replies',async()=>{
 const f=await fixture();f.reply([offer]);await tick();f.controller.abort();await tick();
 assert.equal(f.w.document.querySelector('#sb-decky-offers'),null);assert.equal(f.w.document.querySelector('#sb-decky-offers-style'),null);
 assert.equal(f.unregisters(),1);
 assert.equal([...f.subs.values()].reduce((n,s)=>n+s.size,0),0);f.reply([offer]);await tick();assert.equal(f.w.document.querySelector('#sb-decky-offers'),null);await f.close();
});
test('savings require the same native subid and an unambiguous RUB price, and reconcile price changes',async()=>{
 const f=await fixture();try{f.reply([offer]);await tick();assert.doesNotMatch(f.w.document.querySelector('#sb-decky-offers')!.textContent,/дешевле/i);
 const sub=f.w.document.querySelector<HTMLInputElement>('input[name="subid"]')!;sub.setAttribute('value','999');
 f.w.document.querySelector('.discount_final_price')!.textContent='999 ₽';
 await tick();assert.match(f.w.document.querySelector('#sb-decky-offers')!.textContent,/дешевле.*200/i);
 f.w.document.querySelector('.discount_final_price')!.textContent='$999';await tick();assert.doesNotMatch(f.w.document.querySelector('#sb-decky-offers')!.textContent,/дешевле/i);
 f.w.document.querySelector('.discount_final_price')!.textContent='699 руб.';await tick();assert.doesNotMatch(f.w.document.querySelector('#sb-decky-offers')!.textContent,/дешевле/i);
 }finally{await f.close();}
});
test('ready handshakes retry only list reads and are bounded; malformed and inactive offers cannot buy',async()=>{
 const f=await fixture();try{for(let i=0;i<8;i++)f.emit('ready',{});assert.equal(f.sent.length,3);
 f.reply([{...offer,isActive:false},{...offer,itemId:NaN},{...offer,price:-1},offer,offer]);await tick();assert.equal(f.w.document.querySelectorAll('button[data-item-id]').length,1);
 const before=f.sent.length;for(let i=0;i<8;i++)f.emit('ready',{});assert.equal(f.sent.length,before);
 }finally{await f.close();}
});

test('list timeout is retryable but purchase timeout locks the action and unload clears timers',async()=>{
 const f=await fixture(undefined,true);try{
  f.fire(1800);f.fire(1800);f.fire(1800);assert.equal(f.sent.length,3);
  f.fire(6500);assert.equal(f.timers.size,0);assert.match(f.w.document.querySelector('#sb-decky-offers')!.textContent,/Не удалось/);
  f.w.document.querySelector<HTMLButtonElement>('#sb-decky-offers button')!.click();f.reply([offer]);
  const buy=f.w.document.querySelector<HTMLButtonElement>('[data-item-id="41"]')!;buy.click();const count=f.sent.length;
  f.fire(30000);buy.click();assert.equal(f.sent.length,count);assert.equal(f.timers.size,0);assert.equal(buy.disabled,true);
 }finally{await f.close();assert.equal(f.timers.size,0);}
 const pending=await fixture(undefined,true);assert.equal(pending.timers.size,2);await pending.close();assert.equal(pending.timers.size,0);
});

test('early document waits for a purchase host and recovers style when head is created or replaced',async()=>{
 const f=await fixture('',false,true);try{assert.equal(f.sent.length,0);
 const html=f.w.document.createElement('html');html.innerHTML='<head></head><body><div id="purchaseOptionsContent"></div></body>';f.w.document.append(html);
 await until(()=>f.sent.length===1);f.reply([offer]);await until(()=>!!f.w.document.querySelector('#purchaseOptionsContent #sb-decky-offers'));
 assert.ok(f.w.document.head.querySelector('#sb-decky-offers-style'));
 const head=f.w.document.createElement('head');f.w.document.head.replaceWith(head);await until(()=>!!head.querySelector('#sb-decky-offers-style'));
 assert.deepEqual(JSON.parse(f.w.document.querySelector('[data-item-id]')!.getAttribute('data-panel')!),{focusable:true,clickOnActivate:true});
 }finally{await f.close();}
});
test('visible responsive purchase host wins over hidden desktop edition area',async()=>{
 const f=await fixture('<div hidden><div id="game_area_purchase"></div></div><div id="purchaseOptionsContent"></div>');try{f.reply([offer]);await tick();
 assert.equal(f.w.document.querySelector('#sb-decky-offers')?.parentElement?.id,'purchaseOptionsContent');
 }finally{await f.close();}
});
