import {chromium} from 'playwright';
import ts from 'typescript';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
const profile=await mkdtemp(join(tmpdir(),'sb-browser-'));
let context,backend;
try{
 context=await chromium.launchPersistentContext(profile,{executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,viewport:{width:1280,height:800},args:['--remote-debugging-port=0','--site-per-process']});
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
 const source=await readFile('src/frame-layout.ts','utf8');
 const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
 await page.evaluate(code=>{const exports={};new Function('exports',code)(exports);window.presentFrame=exports.presentFrame;},code);
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
 assert.ok(Math.abs(bounds.x-(1280-bounds.width)/2)<1);
 await remote.goto(remote.url());
 await remote.waitForFunction(()=>window.detected===true);
 assert.deepEqual(await remote.evaluate(()=>window.SteamBooster.getSteamId()),{steamId:'76561198000000000'});
 const bundle=await readFile('vendor/booster-checkout.js','utf8');
 const ast=ts.createSourceFile('checkout.js',bundle,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
 let popupHTML;
 const visit=node=>{if(ts.isPropertyAssignment(node)&&node.name.getText(ast)==='html'&&ts.isNoSubstitutionTemplateLiteral(node.initializer)&&node.initializer.text.includes('Пополнение баланса'))popupHTML=node.initializer.text;ts.forEachChild(node,visit);};visit(ast);
 assert.ok(popupHTML,'original topup HTML missing');
 await page.evaluate(html=>{window.hideFrame();const node=document.createElement('iframe');node.id='topup';node.style.border='0';node.style.background='#171a21';node.srcdoc=html;document.body.append(node);window.hideFrame=window.presentFrame({popup:true,width:378,height:322,frame:{node}},document.getElementById('host'));},popupHTML);
 await page.waitForTimeout(300);
 const topup=await page.locator('#topup').contentFrame();
 assert.equal(await topup.locator('.root').count(),1);
 if(process.env.SCREENSHOT)await page.screenshot({path:process.env.SCREENSHOT});
 console.log('PASS: isolated iframe bridge and site detection, identity RPC, reload, persistent form, centered popup');
}finally{
 if(backend){backend.stdin.end('\n');await new Promise(resolve=>{const timer=setTimeout(()=>{backend.kill('SIGTERM');resolve();},5000);backend.once('exit',()=>{clearTimeout(timer);resolve();});});}
 await context?.close();await rm(profile,{recursive:true,force:true});
}
