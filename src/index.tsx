import { useEffect, useRef, useState } from 'react';
import { ButtonItem, PanelSection, PanelSectionRow, ToggleField, Navigation, staticClasses, Focusable, GamepadButton, findSP, Router, findModuleChild } from '@decky/ui';
import { callable, definePlugin, routerHook } from '@decky/api';
import { FaSteam, FaWallet, FaThLarge, FaChartLine } from 'react-icons/fa';
import { pageUrl, safeNavigation } from './actions.ts';
import { FormKeyboard, keyboardHook, keyboardVisibilityHook } from './keyboard.ts';
import type { KeyboardHook } from './keyboard.ts';
import { PageNavigation } from './navigation.ts';
import { TOPUP_ID, topupHTML } from './topup-theme.ts';
import { presentFrame } from './frame-layout.ts';
import { DeckyRelay } from './relay.ts';
import type { Frame, WindowEntry, Message } from './relay.ts';

type Status = { phase:string; message:string; steamId:string|null; enabled:boolean };
type Control = { label:string; input:boolean; value:string };
const getStatus=callable<[],Status>('get_status');
const setEnabled=callable<[boolean],Status>('set_enabled');
const reconnect=callable<[],Status>('reconnect');
const browserAction=callable<[string,string,string],Control>('browser_action');
const ROUTE='/steambooster';
const useSteamKeyboard:KeyboardHook=findModuleChild(keyboardHook)??(()=>undefined);
const useKeyboardVisible:()=>boolean=findModuleChild(keyboardVisibilityHook)??(()=>false);
let relay: DeckyRelay | undefined;
let channel: BroadcastChannel | undefined;

const listeners=new Set<()=>void>();
function changed() { for(const listener of listeners) listener(); }
let lastError='';
function notify(error:unknown) {
  lastError=error instanceof Error?error.message:typeof error==='string'?error:'Не удалось выполнить действие';
  changed();
}
const pageNavigation=new PageNavigation({
  get:id=>relay?.windows.get(id),
  openPage:()=>{Navigation.Navigate(ROUTE);Navigation.CloseSideMenus();},
  openWeb:url=>{Navigation.NavigateToSteamWeb(url);Navigation.CloseSideMenus();},
  back:()=>Navigation.NavigateBack(),changed,
});
function navigate(url:string) {
  if(!safeNavigation(url))throw Error('Недопустимый адрес');
  pageNavigation.openWeb(url);
}
function hide(id:string){pageNavigation.hide(id);}
function frameDocument():Document {
  const browser=Router.WindowStore?.GamepadUIMainWindowInstance?.BrowserWindow??findSP();
  if(!browser?.document?.body)throw Error('Игровое окно Steam ещё загружается. Восстановите подключение.');
  return browser.document;
}
async function createFrame(entry:Omit<WindowEntry,'frame'>):Promise<Frame> {
  if(entry.url&&!entry.html) return {node:null,destroy:()=>{},send:()=>{}};
  const ownerDocument=frameDocument();
  const ownerWindow=ownerDocument.defaultView!;
  const node=ownerDocument.createElement('iframe');
  node.name='sb-decky:'+entry.id;
  node.title=entry.title;
  node.style.cssText='display:none;border:0;width:100%;height:100%;background:#171a21;';
  // Only pinned original plugin HTML is same-origin. Remote pages retain their own origin.
  node.setAttribute('sandbox','allow-scripts allow-same-origin allow-forms allow-popups');
  let destroyed=false;
  const origin=entry.url ? new URL(entry.url).origin : ownerWindow.location.origin;
  const message=(event:MessageEvent)=>{
    if(destroyed||event.source!==node.contentWindow||event.origin!==origin) return;
    const data=event.data;
    if(!data||typeof data!=='object') return;
    if(data.__sbEmbed===true && data.type==='sb:ready') node.contentWindow?.postMessage({__sbEmbed:true,v:1,type:'sb:embed',windowId:entry.id,app:{name:'SteamBooster',version:'0.1.5'}},origin);
    else relay?.post({kind:'window-message',windowId:entry.id,data});
  };
  ownerWindow.addEventListener('message',message);
  node.addEventListener('load',()=>{if(entry.url)node.contentWindow?.postMessage({__sbEmbed:true,v:1,type:'sb:embed',windowId:entry.id,app:{name:'SteamBooster',version:'0.1.5'}},origin);});
  const loaded=new Promise<void>((resolve,reject)=>{
    if(entry.url) {resolve();return;}
    const timer=setTimeout(()=>reject(Error('Страница не загрузилась')),4000);
    node.onload=()=>{clearTimeout(timer);resolve();};
    node.onerror=()=>{clearTimeout(timer);reject(Error('Ошибка загрузки страницы'));};
  });
  if(entry.html) node.srcdoc=entry.id===TOPUP_ID?topupHTML(entry.html):entry.html;else if(entry.url) node.src=entry.url;
  ownerDocument.body.appendChild(node);
  try { await loaded; }
  catch(error) { node.remove();ownerWindow.removeEventListener('message',message);throw error; }
  return {node,destroy:()=>{destroyed=true;node.remove();ownerWindow.removeEventListener('message',message);},send:(data)=>node.contentWindow?.postMessage(data,origin)};
}
function reset() { lastError='';relay?.close();relay=undefined;channel?.close();channel=undefined;pageNavigation.reset();changed(); }
function configure(config:{secret:string}) {
  reset();
  channel=new BroadcastChannel('sb_cmd');
  relay=new DeckyRelay(config.secret, {
    post:(data)=>channel?.postMessage(data), create:createFrame,
    show:id=>pageNavigation.show(id),
    hide, navigate, changed,
  });
  const ownedRelay=relay;
  channel.addEventListener('message',event=>{void ownedRelay.receive(event.data as Message).catch(notify);});
}
async function openPage(kind:string) {
  if(!relay) throw Error('Подключение ещё не готово');
  if(kind==='topup'){
    const id=TOPUP_ID;
    if(!relay.windows.has(id))throw Error('Форма пополнения ещё загружается');
    relay.show(id);return;
  }
  navigate(pageUrl(kind));
}
function Content() {
  const [status,update]=useState<Status>({phase:'connecting',message:'Запуск',steamId:null,enabled:true});
  const [busy,setBusy]=useState(false);
  const [settings,setSettings]=useState(false);
  const [,rerender]=useState(0);
  useEffect(()=>{const update=()=>rerender(n=>n+1);listeners.add(update);return()=>{listeners.delete(update);};},[]);
  useEffect(()=>{
    let mounted=true,request=false;
    const poll=async()=>{if(request)return;request=true;try{const value=await getStatus();if(mounted)update(value);}catch{if(mounted)update(s=>({...s,phase:'disconnected',message:'Бэкенд Decky недоступен'}));}finally{request=false;}};
    void poll();const timer=setInterval(()=>void poll(),2000);
    return()=>{mounted=false;clearInterval(timer);};
  },[]);
  const run=async(fn:()=>Promise<unknown>)=>{lastError='';setBusy(true);try{await fn();}catch(error){notify(error);}finally{setBusy(false);}};
  const ready=status.phase==='ready'&&!busy;
  const topupReady=ready&&!!relay?.windows.has(TOPUP_ID);
  const connected=status.phase==='ready';
  const actionLabel=(icon:React.ReactNode,label:string)=><span style={{display:'flex',alignItems:'center',gap:12}}>{icon}{label}</span>;
  return <>
    <PanelSection>
      <PanelSectionRow><div role='status' style={{display:'flex',alignItems:'center',gap:8,fontSize:13,color:'#c9deec',padding:'4px 0'}}>
        <span style={{width:7,height:7,borderRadius:'50%',background:connected?'#7fdaa8':'#f4c879'}}/>
        {!status.enabled?'Плагин выключен':connected?'Готов к работе':status.message||'Подключение…'}
      </div></PanelSectionRow>
      {lastError&&<PanelSectionRow><div role='alert' style={{padding:12,borderRadius:8,background:'#492b31',color:'#ffe1e5',fontSize:13,lineHeight:1.5}}>{lastError}</div></PanelSectionRow>}
    </PanelSection>
    <PanelSection title='Баланс Steam'>
      <PanelSectionRow><ButtonItem layout='below' disabled={!topupReady} onClick={()=>void run(()=>openPage('topup'))}>
        {actionLabel(<FaWallet/>,connected&&!topupReady?'Загрузка формы…':'Пополнить баланс')}
      </ButtonItem></PanelSectionRow>
      {pageNavigation.paymentId&&<PanelSectionRow><ButtonItem layout='below' disabled={busy} onClick={()=>void run(async()=>pageNavigation.show(pageNavigation.paymentId!))}>
        Открыть страницу оплаты
      </ButtonItem><div style={{fontSize:12,lineHeight:1.4,color:'#b8cddd',padding:'6px 0 2px'}}>Вернуться к последнему платежу</div></PanelSectionRow>}
    </PanelSection>
    <PanelSection title='Игры и аккаунт'>
      <PanelSectionRow><ButtonItem layout='below' disabled={!ready} onClick={()=>void run(()=>openPage('catalog'))}>{actionLabel(<FaThLarge/>,'Каталог игр')}</ButtonItem></PanelSectionRow>
      <PanelSectionRow><ButtonItem layout='below' disabled={!ready} onClick={()=>void run(()=>openPage('valuation'))}>{actionLabel(<FaChartLine/>,'Оцени аккаунт')}</ButtonItem></PanelSectionRow>
    </PanelSection>
    <PanelSection title='Подключение'>
      <PanelSectionRow><ButtonItem layout='below' onClick={()=>setSettings(value=>!value)}>{settings?'Скрыть настройки':'Настройки подключения'}</ButtonItem></PanelSectionRow>
      {settings&&<>
        <PanelSectionRow><ToggleField label='SteamBooster включён' checked={status.enabled} disabled={busy} onChange={value=>void run(async()=>update(await setEnabled(value)))}/></PanelSectionRow>
        <PanelSectionRow><ButtonItem layout='below' disabled={busy||!status.enabled} onClick={()=>void run(async()=>update(await reconnect()))}>{busy?'Подключение…':'Переподключиться'}</ButtonItem></PanelSectionRow>
        {status.steamId&&<PanelSectionRow><div style={{fontSize:11,color:'#9eb5c8'}}>Steam ID: {status.steamId}</div></PanelSectionRow>}
      </>}
    </PanelSection>
  </>;

}
function WindowPage() {
  const [,render]=useState(0);
  const [keyboardOpen,setKeyboardOpen]=useState(false);
  const [error,setError]=useState('');
  const keyboardSeen=useRef(false);
  const formKeyboard=useRef<FormKeyboard|null>(null);
  if(!formKeyboard.current)formKeyboard.current=new FormKeyboard(open=>{setKeyboardOpen(open);if(!open)keyboardSeen.current=false;},()=>setError('Клавиатура Steam недоступна. Для ввода нажмите Steam + X.'),()=>host.current?.focus());
  const keyboard=useSteamKeyboard(formKeyboard.current.options);
  const keyboardVisible=useKeyboardVisible();
  const inFlight=useRef(false);
  const host=useRef<HTMLDivElement>(null);
  const id=pageNavigation.activeId??pageNavigation.returnId;
  const entry=id?relay?.windows.get(id):undefined;
  useEffect(()=>{const listener=()=>render(n=>n+1);listeners.add(listener);return()=>{listeners.delete(listener);};},[]);
  useEffect(()=>{
    if(!entry||!host.current)return;
    pageNavigation.activeId=entry.id;
    // Returning from Steam's payment browser restores this route and its form.
    if(!entry.visible){
      entry.visible=true;
      relay?.post(entry.popup?{kind:'popup-show-event',popupId:entry.id}:{kind:'window-show-event',windowId:entry.id});
    }
    return()=>{
      formKeyboard.current?.close();
      if(pageNavigation.activeId===entry.id){
        pageNavigation.activeId=undefined;entry.visible=false;
        relay?.post(entry.popup?{kind:'popup-hide-event',popupId:entry.id}:{kind:'window-hide-event',windowId:entry.id});
      }
    };
  },[entry]);
  useEffect(()=>{
    if(!entry||!host.current)return;
    try{
      const cleanup=presentFrame(entry,host.current,keyboardOpen);
      if(keyboardOpen)formKeyboard.current?.target?.scrollIntoView({block:'nearest'});
      return cleanup;
    }catch(error){setError(error instanceof Error?error.message:'Ошибка отображения формы');}
  },[entry,keyboardOpen]);
  useEffect(()=>{
    const document=entry?.frame.node?.contentDocument;
    if(document)return formKeyboard.current!.attach(document,keyboard);
  },[entry,keyboard]);
  useEffect(()=>{
    if(keyboardOpen&&keyboardVisible)keyboardSeen.current=true;
    if(keyboardOpen&&keyboardSeen.current&&!keyboardVisible){formKeyboard.current?.close();host.current?.focus();}
  },[keyboardVisible,keyboardOpen]);
  useEffect(()=>{const node=entry?.frame.node;if(node)node.style.visibility=error?'hidden':'visible';return()=>{if(node)node.style.visibility='visible';};},[entry,error]);
  const action=async(kind:string,value='')=>{
    if(!id||inFlight.current)return;
    inFlight.current=true;
    try{
      await browserAction('sb-decky:'+id,kind,value);
      setError('');
    }catch(error){
      // Focus acquisition can race navigation. It must never generate toasts
      // or trigger another focus/render/failure loop.
      if(kind!=='read')setError(error instanceof Error?error.message:'Страница ещё загружается');
    }finally{inFlight.current=false;}
  };
  const close=()=>{if(formKeyboard.current?.open){formKeyboard.current.close();return;}if(id)relay?.hide(id);else Navigation.NavigateBack();};
  return <Focusable ref={host} preferredFocus noFocusRing
    style={{position:'absolute',inset:0,background:entry?.popup?'radial-gradient(ellipse at top,#263a50,#101720 70%)':'#171a21'}}
    onCancel={close} onCancelActionDescription='Назад'
    onActivate={()=>void action('activate')} onOKActionDescription='Нажать'
    onGamepadDirection={event=>{
      if(formKeyboard.current?.open)return;
      const direction=event.detail.button;
      void action(direction===GamepadButton.DIR_UP||direction===GamepadButton.DIR_LEFT?'prev':'next');
      event.stopPropagation();
    }}>
    {error&&<div role='alert' style={{position:'absolute',top:'30%',left:'15%',right:'15%',padding:24,background:'#172a3a',borderRadius:12}}>
      <p>{error}</p><ButtonItem onClick={()=>setError('')}>Вернуться к форме</ButtonItem>
    </div>}
  </Focusable>;
}

declare global {
  interface Window {
    __sb_decky_open?:(kind:string)=>Promise<void>;
    __sb_decky_frontend?:boolean;
    __sb_decky_configure?:(config:{secret:string})=>void;
    __sb_decky_reset?:()=>void;
    __sb_decky_navigate?:(url:string)=>void;
  }
}
export default definePlugin(()=>{
  window.__sb_decky_open=async(kind)=>{try{await openPage(kind);}catch(error){notify(error);}};
  window.__sb_decky_frontend=true;
  window.__sb_decky_configure=configure;
  window.__sb_decky_reset=reset;
  window.__sb_decky_navigate=navigate;
  routerHook.addRoute(ROUTE,WindowPage);
  return {name:'SteamBooster',titleView:<div className={staticClasses.Title}>SteamBooster</div>,content:<Content/>,icon:<FaSteam/>,
    onDismount(){delete window.__sb_decky_open;reset();routerHook.removeRoute(ROUTE);delete window.__sb_decky_frontend;delete window.__sb_decky_configure;delete window.__sb_decky_reset;delete window.__sb_decky_navigate;}
  };
});
