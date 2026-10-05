import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Window } from 'happy-dom';
const controls=readFileSync(new URL('../backend/browser-controls.js',import.meta.url),'utf8');
const links=readFileSync(new URL('../backend/catalog-links.js',import.meta.url),'utf8').replace('__NAV__','"navigateStore"');

test('catalog card uses native navigation and leaves purchase buttons to the original app', () => {
  const window=new Window({url:'https://steambalance.cc/booster/catalogue'});
  const calls:string[]=[];
  (window as any).navigateStore=(url:string)=>calls.push(url);
  window.document.body.innerHTML='<a href="https://store.steampowered.com/app/123/"><span>Game</span><button>Buy</button></a>';
  window.eval(links);
  window.document.querySelector('button')!.dispatchEvent(new window.MouseEvent('click',{bubbles:true,cancelable:true,button:0}));
  assert.equal(calls.length,0);
  const click=new window.MouseEvent('click',{bubbles:true,cancelable:true,button:0});
  window.document.querySelector('span')!.dispatchEvent(click);
  assert.equal(click.defaultPrevented,true);
  assert.deepEqual(calls,['https://store.steampowered.com/app/123/']);
  (window as any).__sb_decky_links();
  window.happyDOM.abort();
});

test('controller selects visible fields, writes through native setter and clicks once', () => {
  const window=new Window({url:'https://steamloopback.host/'});
  window.document.body.innerHTML='<input aria-label="Amount" value="1"><button>Pay</button><button disabled>Disabled</button>';
  for(const element of window.document.querySelectorAll('input,button')) {
    (element as any).getBoundingClientRect=()=>({width:50,height:20});
    (element as any).scrollIntoView=()=>{};
  }
  let clicks=0,inputs=0;
  window.document.querySelector('button')!.addEventListener('click',()=>clicks++);
  window.document.querySelector('input')!.addEventListener('input',()=>inputs++);
  const invoke=(action:string,value='')=>window.eval(`(${controls})(${JSON.stringify(action)},${JSON.stringify(value)})`);
  assert.equal(invoke('read').label,'Amount');
  assert.equal(invoke('text','250').value,'250');
  assert.equal(inputs,1);
  assert.equal(invoke('next').label,'Pay');
  invoke('activate');
  assert.equal(clicks,1);
  assert.equal(invoke('next').label,'Amount');
  assert.equal(window.document.querySelector('button')!.style.outline,'','only the selected control is highlighted');
  window.happyDOM.abort();
});
