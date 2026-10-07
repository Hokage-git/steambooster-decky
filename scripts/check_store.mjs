import {chromium} from 'playwright';
import {readFile,mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1280,height:800}});
 await page.route('**/*',route=>route.fulfill({contentType:'text/html',body:`<!doctype html><html><head><meta charset="utf-8"><style>body{margin:0;background:#171d25;color:#dbe5ef;font:18px Arial}main{max-width:940px;margin:32px auto}nav{display:flex;align-items:center;background:#29485d;padding:8px}button{font:inherit;color:white;background:#31566b;border:0;padding:10px}h1{font-size:28px}.game_area_purchase_game{padding:20px;background:#293b48}#purchaseOptionsContent{margin-top:24px}input[name=subid]{display:none}</style></head><body><main><nav><button data-booster-storenav-btn>Каталог игр</button></nav><h1>Пример игры · тестовые данные</h1><h2>Варианты покупки</h2><div id="purchaseOptionsContent"><div id="game_area_purchase"><div class="game_area_purchase_game">Купить Standard Edition <input name="subid" value="123"><div class="discount_final_price" data-price-final="99900">999 ₽</div></div></div></div></main></body></html>`}));
 await page.goto('https://store.steampowered.com/app/620/');
 await page.evaluate(()=>{
  window.sent=[];window.subs=new Map();window.__storeAction=action=>window.sent.push({action});
  window.sb={plugins:{register:plugin=>{window.stopOffers=plugin.init({signal:new AbortController().signal,sb:{
   bus:{publish:(topic,data)=>window.sent.push({topic,data}),subscribe:(topic,fn)=>{window.subs.set(topic,fn);return()=>window.subs.delete(topic);}},
   pages:{register:spec=>{const cleanup=spec.mount({url:new URL(location.href),signal:new AbortController().signal});return{unregister:cleanup};}}
  }});}}};
 });
 await page.addScriptTag({content:(await readFile('backend/store-tools.js','utf8')).replace('__STORE_BINDING__',JSON.stringify('__storeAction'))});
 await page.addScriptTag({content:await readFile('backend/store-offers.js','utf8')});
 await page.evaluate(()=>window.subs.get('booster-checkout.keys.response')({reqId:window.sent.find(x=>x.topic==='decky-store.keys.request').data.reqId,items:[{itemId:41,name:'Standard Edition',regionLabel:'Россия / СНГ',price:799,isActive:true,packageId:123},{itemId:42,name:'Deluxe Edition',regionLabel:'Global',price:1199,isActive:true,packageId:999}]}));
 assert.equal(await page.locator('#sb-decky-store-tools').count(),1);
 assert.equal(await page.locator('#game_area_purchase #sb-decky-offers').count(),1);
 assert.match(await page.locator('#sb-decky-offers').innerText(),/Дешевле Steam на 200/);
 assert.equal(await page.locator('[data-booster-storenav-btn]').count(),1);
 await page.locator('[data-item-id="41"]').click();
 const purchase=await page.evaluate(()=>window.sent.filter(x=>x.topic==='decky-store.keys.purchase'));
 assert.equal(purchase.length,1);
 await page.evaluate(id=>window.subs.get('booster-checkout.keys.email-required')({reqId:id}),purchase[0].data.reqId);
 await page.locator('input[type=email]').fill('player@example.com');
 await page.getByRole('button',{name:'Продолжить'}).click();
 assert.equal(await page.evaluate(()=>window.sent.filter(x=>x.topic==='decky-store.keys.purchase').length),2);
 await page.evaluate(()=>{const p=window.sent.filter(x=>x.topic==='decky-store.keys.purchase').at(-1);window.subs.get('booster-checkout.keys.purchase-result')({reqId:p.data.reqId,ok:true});});
 for(const viewport of [{width:1280,height:800},{width:800,height:600}]){
  await page.setViewportSize(viewport);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'store offers must not overflow horizontally');
 }
 await page.setViewportSize({width:1280,height:800});
 await mkdir('../../docs/artifacts/verification/v0.1.5',{recursive:true});
 await page.screenshot({path:'../../docs/artifacts/verification/v0.1.5/store.png'});
 await page.evaluate(()=>{window.stopOffers();window.__sb_decky_store_tools();});
 assert.equal(await page.locator('#sb-decky-offers,#sb-decky-store-tools').count(),0);
 console.log('PASS: responsive store offers, compact topup, preserved catalog, explicit email checkout and unload; mocked transport, no orders');
}finally{await browser.close();}
