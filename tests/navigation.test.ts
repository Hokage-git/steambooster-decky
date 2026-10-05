import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PageNavigation} from '../src/navigation.ts';
import {DeckyRelay} from '../src/relay.ts';
test('payment navigation survives the original form hide message and can reopen the same order',async()=>{
 const calls:string[]=[];
 const entries=new Map<string,any>();
 const nav=new PageNavigation({get:id=>entries.get(id),openPage:()=>calls.push('page'),openWeb:url=>calls.push(url),back:()=>calls.push('back'),changed:()=>{}});
 entries.set('topup',{id:'topup',frame:{node:{style:{}}},visible:true});
 entries.set('payment',{id:'payment',external:true,url:'https://bank.example/order/1',frame:{node:null}});
 nav.show('topup');nav.show('payment');nav.hide('topup');
 assert.deepEqual(calls,['page','https://bank.example/order/1']);
 assert.equal(nav.returnId,'topup');
 nav.show('payment');
 assert.equal(calls.at(-1),'https://bank.example/order/1');
});
test('failed payment navigation does not acknowledge a successful open',async()=>{
 const sent:any[]=[];
 const relay=new DeckyRelay('s',{post:m=>sent.push(m),create:()=>({node:null,destroy:()=>{},send:()=>{}}),show:()=>{throw Error('navigation failed');},hide:()=>{},navigate:()=>{},changed:()=>{}});
 await relay.receive({kind:'external-window-open',id:'payment',url:'https://bank.example/order/1',requestId:4,__sbsec:'s'});
 assert.deepEqual(sent.filter(m=>m.kind==='external-window-open-reply').map(m=>m.ok),[false]);
 relay.close();
});

test('a navigation exception restores the current form',()=>{
 const entry:any={frame:{node:{style:{display:'block'}}}};
 const nav=new PageNavigation({get:()=>entry,openPage:()=>{},openWeb:()=>{throw Error('failed');},back:()=>{},changed:()=>{}});
 nav.show('topup');
 assert.throws(()=>nav.openWeb('https://bank.example/order/1'));
 assert.equal(nav.activeId,'topup');
 assert.equal(entry.frame.node.style.display,'block');
});
