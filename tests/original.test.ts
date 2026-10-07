import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Window } from 'happy-dom';
import { DeckyRelay } from '../src/relay.ts';

class Channel extends EventTarget {
  static channels=new Set<Channel>();
  name:string;
  constructor(name:string) {super();this.name=name;Channel.channels.add(this);}
  postMessage(data:unknown) {for(const other of Channel.channels)if(other!==this&&other.name===this.name)queueMicrotask(()=>{if(Channel.channels.has(other))other.dispatchEvent(new MessageEvent('message',{data}));});}
  close() {Channel.channels.delete(this);}
}
const asset=(name:string)=>readFileSync(new URL('../vendor/'+name,import.meta.url),'utf8');
const wait=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));

test('original plugins expose current account and serve scoped Deck store offers through the native bus', async () => {
  const main=new Window({url:'https://steamloopback.host/'});
  const store=new Window({url:'https://store.steampowered.com/app/620/'});
  (main as any).BroadcastChannel=Channel;
  (store as any).BroadcastChannel=Channel;
  // The original checkout fetches payment methods directly. Every response in
  // this harness is synthetic; no request may reach an actual payment service.
  main.fetch=async(input:any)=>{
    assert.equal(String(input),'https://steambalance.cc/api/payments');
    return new main.Response(JSON.stringify({data:[{type:'fixture-card',can_pay_services:true}]}),{status:200});
  };
  const secret='test-secret';
  const native:any=JSON.parse(asset('manifest.json'));
  const entries=native.plugins.map((p:any)=>({...p,required:false,url:'https://localhost/'+p.id+'.js',sha256:native.sha256[p.id+'.js'],token:'token-'+p.id}));
  const manifest={injectorVersion:'decky-test',contextKind:'main',userDisabledPlugins:[],plugins:entries,_sec:{frameworkToken:'framework',resolverName:'__sb_resolve',busDispatchName:'__sb_bus_dispatch',relaySecret:secret,hostAccount:'__hostAccount',rateAccountData:'__rateAccountData'}};
  const relayChannel=new Channel('sb_cmd');
  const frames:Window[]=[];
  const relay=new DeckyRelay(secret,{post:data=>relayChannel.postMessage(data),show:()=>{},hide:()=>{},navigate:()=>{},changed:()=>{},create:entry=>{
    const frame=new Window({url:'https://steamloopback.host/'});
    (frame as any).BroadcastChannel=Channel;
    frames.push(frame);
    if(entry.html)frame.document.write(entry.html);
    return {node:null,destroy:()=>void frame.happyDOM.abort(),send:()=>{}};
  }});
  relayChannel.addEventListener('message',event=>void relay.receive((event as MessageEvent).data));
  const shared=new Channel('sb_cmd');
  shared.addEventListener('message',event=>{
    const message=(event as MessageEvent).data;
    const response=(data:any)=>shared.postMessage({...data,__sbsec:secret,requestId:message.requestId});
    if(message.kind==='request-snapshot')response({kind:'user-snapshot',snapshot:{accountName:'test',steamId:'76561198000000000',balanceFormatted:'0 руб.'}});
    if(message.kind==='get-user-country')response({kind:'user-country-ok',value:'RU'});
    if(message.kind==='get-user-language')response({kind:'user-language-ok',value:'russian'});
    if(message.kind==='get-user-account-settings')response({kind:'user-account-settings-ok',email:'',emailValidated:false});
    if(message.kind==='get-parental-state')response({kind:'parental-state-ok',state:{enabled:false,locked:false}});
    if(message.kind==='get-account-level')response({kind:'account-level-ok',level:12});
    if(message.kind==='get-avatar')response({kind:'avatar-ok',dataUrl:null});
    if(message.kind==='get-owned-games')response({kind:'owned-games-ok',result:{ready:true,games:[{appid:570,name:'Test game',appType:1,playtimeForeverMinutes:60}],currency:'RUB'}});
    if(message.kind==='get-inventory')response({kind:'inventory-ok',result:{items:[{appid:570,contextid:'2',assetid:'test-item',classid:'test-class',instanceid:'0',amount:1,marketable:true,tradable:false}],perApp:[{appid:570,contextid:'2',fetched:1,ok:true}],partial:false}});
  });
  let pump:ReturnType<typeof setInterval>|undefined;
  const nativeCalls:any[]=[];
  try {
    main.eval(asset('bootstrap.js').replace('__MANIFEST__',JSON.stringify(manifest)));
    main.eval(asset('framework.js'));
    pump=setInterval(()=>{
      for(const context of [main,store]){
       const queue=(context as any).__sb_native_queue??[];(context as any).__sb_native_queue=[];
       for(const req of queue){
        nativeCalls.push(req);
        let result:unknown=null;
        if(req.op==='net_fetch'){
          const url=new URL(req.args.url);
          const body=url.pathname==='/api/services/steam_keys'
            ?{data:{items:[{id:41,name:'Portal Deluxe',is_active:true,region_label:'Россия',price:799,package:{id:999,product_type:'game'}}]}}
            :[];
          result={status:200,ok:true,headers:{},body:JSON.stringify(body)};
        }
        if(req.op==='get_store_country')result={country:'RU'};
        if(req.op==='bus.publish'){
          const topic=req.args.topic==='decky-store.keys.request'?'booster-addfunds.keys.request':req.args.topic;
          for(const target of [main,store])(target as any).__sb_bus_dispatch?.(topic,req.args.data);
        }
        (context as any).__sb_resolve(req.requestId,{ok:true,result});
       }
      }
    },10);
    for(const entry of entries){
      main.eval('globalThis.__SB_PLUGIN_BOOT__='+JSON.stringify({id:entry.id,token:entry.token})+';'+asset(entry.id+'.js'));
    }
    const deadline=Date.now()+6000;
    while(!(main as any).__sb_internal?._pluginOutcomes&&Date.now()<deadline)await wait(20);
    const outcomes=(main as any).__sb_internal?._pluginOutcomes;
    assert.ok(Array.isArray(outcomes),'plugin initialization did not complete');
    assert.equal(outcomes.length,3);
    assert.ok(outcomes.every((outcome:any)=>outcome.ok===true),JSON.stringify(outcomes));
    assert.ok(relay.windows.has('booster-checkout__sb_topup'),'original checkout popup attached');
    assert.deepEqual(JSON.parse(JSON.stringify(await (main as any).__hostAccount('getSteamId'))),{steamId:'76561198000000000'});
    const valuation=await (main as any).__rateAccountData();
    assert.equal(valuation.account.steam_id,'76561198000000000');
    assert.equal(valuation.account.level,12);
    assert.equal(valuation.library.ready,true);
    assert.equal(valuation.library.games[0].appid,570);
    assert.equal(valuation.inventory.partial,false);
    assert.equal(valuation.inventory.items[0].assetid,'test-item');

    const entry={id:'decky-store',version:'1.0.0',apiVersion:1,contextKinds:['web'],
      urlPatterns:['^https://store\\.steampowered\\.com(/.*)?$'],grantedCapabilities:['bus','pages'],allowedHosts:[],
      subscribeTopics:['booster-checkout.keys.response','booster-checkout.keys.email-required','booster-checkout.keys.purchase-result','booster-checkout.keys.ready'],
      required:false,url:'https://localhost/decky-store.js',token:'store-token'};
    store.document.body.innerHTML='<div id="purchaseOptionsContent"><div id="game_area_purchase"><h2>Purchase Options</h2></div></div>';
    store.eval(asset('bootstrap.js').replace('__MANIFEST__',JSON.stringify({...manifest,contextKind:'web',plugins:[entry]})));
    store.eval(asset('framework.js'));
    store.eval('globalThis.__SB_PLUGIN_BOOT__='+JSON.stringify({id:entry.id,token:entry.token})+';'+readFileSync(new URL('../backend/store-offers.js',import.meta.url),'utf8'));
    const offerDeadline=Date.now()+3000;
    while(!store.document.querySelector('[data-item-id="41"]')&&Date.now()<offerDeadline)await wait(20);
    assert.deepEqual(JSON.parse(JSON.stringify((store as any).__sb_internal?._pluginOutcomes?.map((outcome:any)=>({pluginId:outcome.pluginId,ok:outcome.ok})))),[{pluginId:'decky-store',ok:true}]);
    const request=nativeCalls.find(req=>req.op==='bus.publish'&&req.args.topic==='decky-store.keys.request');
    assert.ok(request,'scoped plugin must publish its own prefixed request');
    assert.equal(request.pluginId,'booster-framework','the shared bus uses framework bridge identity');
    assert.equal(request.token,'framework');
    assert.equal(request.args.data.appid,620);
    assert.equal(typeof request.args.data.reqId,'string');
    const lookup=nativeCalls.find(req=>req.op==='net_fetch'&&new URL(req.args.url).pathname==='/api/services/steam_keys');
    assert.equal(lookup?.pluginId,'booster-checkout','original checkout owns the offer HTTP request');
    assert.equal(new URL(lookup.args.url).searchParams.get('appid'),'620');
    assert.equal(new URL(lookup.args.url).searchParams.get('paymentId'),'fixture-card');
    const response=nativeCalls.find(req=>req.op==='bus.publish'&&req.args.topic==='booster-checkout.keys.response'&&req.args.data.reqId===request.args.data.reqId);
    assert.equal(response?.args.data.items[0].itemId,41,'original checkout maps the service response to the subscribed bus contract');
    const offers=store.document.querySelector('#sb-decky-offers');
    assert.equal(offers?.parentElement?.id,'game_area_purchase');
    assert.match(offers?.textContent??'',/Portal Deluxe/);
    assert.match(offers?.textContent??'',/Россия/);
    assert.ok(offers?.querySelector('[data-item-id="41"]'),'response passes the real framework subscription allowlist');
    assert.equal(nativeCalls.some(req=>req.op==='net_fetch'&&req.args.method==='POST'),false,'viewing offers must not place an order');
    (store as any).__sb_internal.rollbackAll();
    assert.equal(store.document.querySelector('#sb-decky-offers'),null,'framework rollback removes the adapter');
  } finally {
    if(pump)clearInterval(pump);
    (main as any).__sb_internal?.rollbackAll();
    (main as any).__sb_internal?.teardown();
    (store as any).__sb_internal?.rollbackAll();
    (store as any).__sb_internal?.teardown();
    relay.close();relayChannel.close();shared.close();
    for(const frame of frames)await frame.happyDOM.close();
    await main.happyDOM.close();
    await store.happyDOM.close();
    for(const channel of [...Channel.channels])channel.close();
  }
});

test('combined Game Mode bootstrap preserves both the shared relay and main API', async()=>{
  const window=new Window({url:'https://steamloopback.host/index.html'});
  (window as any).BroadcastChannel=Channel;
  try {
    window.eval(asset('bootstrap.js').replace('__MANIFEST__',JSON.stringify({contextKind:'main',deckyCombined:true,plugins:[],_sec:{relaySecret:'combined',resolverName:'__sb_resolve'}})));
    window.eval(asset('framework.js'));
    assert.equal((window as any).__sb_relay_started,true);
    assert.equal(typeof (window as any).sb?.plugins.register,'function');
    (window as any).__sb_internal?.rollbackAll();
    (window as any).__sb_relay_teardown?.();
    assert.equal((window as any).__sb_relay_started,false);
  } finally {
    (window as any).__sb_internal?.teardown();
    (window as any).__sb_relay_teardown?.();
    await window.happyDOM.close();
    for(const channel of [...Channel.channels])channel.close();
  }
});
