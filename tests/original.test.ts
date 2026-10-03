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

test('original plugins initialize through Decky UI adapter and expose current account', async () => {
  const main=new Window({url:'https://steamloopback.host/'});
  (main as any).BroadcastChannel=Channel;
  const secret='test-secret';
  const native:any=JSON.parse(asset('manifest.json'));
  const entries=native.plugins.map((p:any)=>({...p,required:false,url:'https://localhost/'+p.id+'.js',sha256:native.sha256[p.id+'.js'],token:'token-'+p.id}));
  const manifest={injectorVersion:'decky-test',contextKind:'main',userDisabledPlugins:[],plugins:entries,_sec:{frameworkToken:'framework',resolverName:'__sb_resolve',busDispatchName:'__sb_bus_dispatch',relaySecret:secret,hostAccount:'__hostAccount'}};
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
    if(message.kind==='get-parental-state')response({kind:'parental-state-ok',state:{enabled:false}});
  });
  let pump:ReturnType<typeof setInterval>|undefined;
  try {
    main.eval(asset('bootstrap.js').replace('__MANIFEST__',JSON.stringify(manifest)));
    main.eval(asset('framework.js'));
    pump=setInterval(()=>{
      const queue=(main as any).__sb_native_queue??[];(main as any).__sb_native_queue=[];
      for(const req of queue){
        let result:unknown=null;
        if(req.op==='net_fetch')result={status:200,ok:true,headers:{},body:'[]'};
        if(req.op==='get_store_country')result={country:'RU'};
        if(req.op==='bus.publish')(main as any).__sb_bus_dispatch(req.args.topic,req.args.data);
        (main as any).__sb_resolve(req.requestId,{ok:true,result});
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
  } finally {
    if(pump)clearInterval(pump);
    (main as any).__sb_internal?.rollbackAll();
    (main as any).__sb_internal?.teardown();
    relay.close();relayChannel.close();shared.close();
    for(const frame of frames)await frame.happyDOM.close();
    await main.happyDOM.close();
    for(const channel of [...Channel.channels])channel.close();
  }
});
