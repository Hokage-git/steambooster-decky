import {chromium} from 'playwright';
import ts from 'typescript';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
const profile=await mkdtemp(join(tmpdir(),'sb-browser-'));
let context,backend;
try{
 context=await chromium.launchPersistentContext(profile,{executablePath:process.env.CHROMIUM_PATH||(existsSync('/usr/bin/chromium')?'/usr/bin/chromium':chromium.executablePath()),headless:true,viewport:{width:1280,height:800},args:['--remote-debugging-port=0','--site-per-process']});
 await context.route('https://steamloopback.host/**',r=>r.fulfill({contentType:'text/html',body:'<html><head><title>Fixture</title></head><body><div id="host" style="position:fixed;inset:0;background:radial-gradient(ellipse at top,#263a50,#101720 70%)"></div></body></html>'}));
 await context.route('https://steambalance.cc/**',r=>r.fulfill({contentType:'text/html',body:'<html><body><input value="original"><script>window.bridgeAtStartup=!!window.SteamBooster?.isSteamBooster;window.detected=window.bridgeAtStartup;window.addEventListener("sb:embed",()=>window.detected=!!window.SteamBooster?.isSteamBooster)</script></body></html>'}));
 const page=await context.newPage();await page.goto('https://steamloopback.host/fixture');
 const [port,path]=(await readFile(join(profile,'DevToolsActivePort'),'utf8')).trim().split('\n');
 backend=spawn(process.env.PYTHON||'.venv/bin/python',['tests/browser_bridge_fixture.py',`ws://127.0.0.1:${port}${path}`],{stdio:['pipe','pipe','pipe']});
 let errors='';backend.stderr.on('data',chunk=>errors+=chunk);
 await new Promise((resolve,reject)=>{
  const timeout=setTimeout(()=>reject(Error('backend startup timeout: '+errors)),10000);
  backend.once('exit',code=>{clearTimeout(timeout);reject(Error('backend exited '+code+': '+errors));});
  backend.stdout.on('data',data=>{if(String(data).includes('READY')){clearTimeout(timeout);resolve();}});
 });
 await page.evaluate(()=>{const f=document.createElement('iframe');f.id='remote';f.style.border='0';f.name='sb-decky:valuation';f.src='https://steambalance.cc/booster/viral';document.body.append(f);});
 await page.waitForFunction(()=>[...document.querySelectorAll('iframe')].length===1);
 const remote=await page.waitForEvent('framenavigated',{predicate:f=>f.url().includes('steambalance.cc'),timeout:10000}).catch(()=>page.frames().find(f=>f.url().includes('steambalance.cc')));
 assert.ok(remote,'cross-site frame is missing');
 await remote.waitForFunction(()=>window.SteamBooster?.isSteamBooster,{timeout:10000});
 assert.equal(await remote.evaluate(()=>window.detected),true,'site must detect the installed API, including late attachment');
 assert.deepEqual(await remote.evaluate(()=>window.SteamBooster.getSteamId()),{steamId:'76561198000000000'});
 // Exercise production layout code in Chromium: show/hide cannot reload a form.
 const modules={};
 for(const name of ['topup-theme','frame-layout','actions','relay','navigation']){
  modules['./'+name+'.ts']=ts.transpileModule(await readFile('src/'+name+'.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
 }
 await page.evaluate(modules=>{
  const cache={};const require=name=>{if(cache[name])return cache[name];const exports={};cache[name]=exports;new Function('exports','require',modules[name])(exports,require);return exports;};
  window.presentFrame=require('./frame-layout.ts').presentFrame;
  window.theme=require('./topup-theme.ts');window.PageNavigation=require('./navigation.ts').PageNavigation;window.DeckyRelay=require('./relay.ts').DeckyRelay;
 },modules);
 await remote.locator('input').fill('saved-value');
 await page.evaluate(()=>{
  const node=document.getElementById('remote');
  const entry={popup:false,frame:{node}};
  window.hideFrame=window.presentFrame(entry,document.getElementById('host'));
  window.hideFrame();window.hideFrame=window.presentFrame(entry,document.getElementById('host'));
 });
 assert.equal(await remote.locator('input').inputValue(),'saved-value');
 assert.equal(await page.locator('#remote').evaluate(n=>n.parentElement===document.body),true);
 await page.evaluate(()=>{
  window.hideFrame();const node=document.getElementById('remote');
  window.hideFrame=window.presentFrame({popup:true,width:378,height:322,frame:{node}},document.getElementById('host'));
 });
 const bounds=await page.locator('#remote').boundingBox();
 assert.ok(Math.abs(bounds.width-378*1.35)<1);
 assert.equal(await page.locator('#remote').evaluate(n=>getComputedStyle(n).zIndex),'2147483647');
 assert.ok(Math.abs(bounds.x-(1280-bounds.width)/2)<1);
 await remote.goto(remote.url());
 await remote.waitForFunction(()=>window.detected===true);
 assert.deepEqual(await remote.evaluate(()=>window.SteamBooster.getSteamId()),{steamId:'76561198000000000'});
 const bundle=await readFile('vendor/booster-checkout.js','utf8');
 const ast=ts.createSourceFile('checkout.js',bundle,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
 let popupHTML;
 const visit=node=>{if(ts.isPropertyAssignment(node)&&node.name.getText(ast)==='html'&&ts.isNoSubstitutionTemplateLiteral(node.initializer)&&node.initializer.text.includes('Пополнение баланса'))popupHTML=node.initializer.text;ts.forEachChild(node,visit);};visit(ast);
 assert.ok(popupHTML,'original topup HTML missing');
 await page.evaluate(html=>{window.hideFrame();const node=document.createElement('iframe');node.id='topup';node.style.border='0';node.style.background='#171a21';node.srcdoc=window.theme.topupHTML(html);document.body.append(node);window.hideFrame=window.presentFrame({id:window.theme.TOPUP_ID,popup:true,width:378,height:322,frame:{node}},document.getElementById('host'));},popupHTML);
 await page.waitForTimeout(300);
 const topup=await (await page.locator('#topup').elementHandle()).contentFrame();
 assert.equal(await topup.locator('.root').count(),1);
 // Exercise the real bundled Svelte form, with every payment response mocked.
 // No request in this test can create a real order.
 let orders=0;
 await context.route('https://checkout.example/**',async route=>{
  if(route.request().url().endsWith('/calc'))await route.fulfill({json:{success:true,data:{amount:1000,amountToBalance:950,amountToBalanceUSD:10,amountToBalanceKZT:4500,minAmount:100,maxAmount:100000}}});
  else{orders++;await route.fulfill({json:{success:true,data:{redirectUrl:'https://bank.example/order/fixture',uid:'fixture-order'}}});}
 });
 await page.evaluate(()=>{
  const id=window.theme.TOPUP_ID;
  window.navigationCalls=[];window.paymentURL='';
  const nav=new window.PageNavigation({get:id=>relay.windows.get(id),openPage:()=>window.navigationCalls.push('page'),openWeb:url=>{window.paymentURL=url;window.navigationCalls.push(url);},back:()=>{window.paymentURL='';window.navigationCalls.push('back');},changed:()=>{}});
  const relay=new window.DeckyRelay('fixture',{post:()=>{},create:()=>({node:null,destroy:()=>{},send:()=>{}}),show:id=>nav.show(id),hide:id=>nav.hide(id),navigate:url=>nav.openWeb(url),changed:()=>{}});
  relay.windows.set(id,{id,popup:true,visible:true,frame:{node:document.getElementById('topup'),destroy:()=>{},send:()=>{}}});nav.show(id);
  window.reopenPayment=()=>nav.show(nav.paymentId);
  window.bc=new BroadcastChannel('sb_cmd');
  window.bc.onmessage=async({data:m})=>{
   if(m.kind!=='popup-message'||m.data?.kind!=='navigate')return;
   // Original main-shell opens payment, then hides the top-up popup.
   await relay.receive({kind:'external-window-open',id:'payment',url:m.data.url,requestId:1,__sbsec:'fixture'});
   await relay.receive({kind:'popup-hide',popupId:id,__sbsec:'fixture'});
  };
  const post=data=>window.bc.postMessage({kind:'popup-postMessage',popupId:id,data});
  post({kind:'init',login:'deck_test',currency:'RUB',balance:250,uuid:'fixture',urls:{balanceCalcApi:'https://checkout.example/calc',balanceAddApi:'https://checkout.example/add'}});
  post({kind:'email',email:''});
  post({kind:'payment-methods',methods:[{type:'sbp',name:'СБП',imageUrl:'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg"/>',badge:'QR'},{type:'card',name:'Банковская карта',imageUrl:'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg"/>'}],loading:false});
  post({kind:'shown'});
 });
 await topup.locator('.pay').waitFor({state:'visible'});
 await topup.waitForFunction(()=>!document.querySelector('.pay').disabled);
 assert.ok((await topup.locator('.pay').boundingBox()).height>=48,'Pay must be a comfortable touch target');
 assert.equal(await topup.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'top-up must not overflow horizontally');
 await topup.locator('.picker .trigger').click();
 await topup.locator('.picker .menu button').last().click();
 await topup.waitForFunction(()=>!document.querySelector('.pay').disabled);
 await topup.locator('.amount-input').focus();
 if(process.env.SCREENSHOT)await page.screenshot({path:process.env.SCREENSHOT});
 await page.setViewportSize({width:800,height:600});
 await page.waitForFunction(()=>parseInt(document.getElementById('topup').style.height)===568);
 assert.equal(await topup.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'compact viewport must not overflow horizontally');
 await topup.locator('.pay').scrollIntoViewIfNeeded();
 assert.ok(await topup.locator('.pay').isVisible());
 await page.setViewportSize({width:1280,height:800});
 await page.waitForFunction(()=>parseInt(document.getElementById('topup').style.height)===660);
 await topup.locator('.pay').click();
 await page.waitForFunction(()=>window.paymentURL==='https://bank.example/order/fixture');
 assert.equal(orders,1);
 assert.equal(await page.evaluate(()=>window.navigationCalls.includes('back')),false,'hide must not cancel payment navigation');
 await page.evaluate(()=>window.reopenPayment());
 assert.equal(orders,1,'reopening payment must not submit another order');
 assert.equal(await page.evaluate(()=>window.navigationCalls.at(-1)),'https://bank.example/order/fixture');
 console.log('PASS: isolated iframe bridge and site detection, identity RPC, reload, persistent form, responsive top-up, real Pay submission with mocked API, payment navigation and order reuse');
}finally{
 if(backend){backend.stdin.end('\n');await new Promise(resolve=>{const timer=setTimeout(()=>{backend.kill('SIGTERM');resolve();},5000);backend.once('exit',()=>{clearTimeout(timer);resolve();});});}
 await context?.close();await rm(profile,{recursive:true,force:true});
}
