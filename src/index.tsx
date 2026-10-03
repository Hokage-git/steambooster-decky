import { useEffect, useRef, useState } from 'react';
import { ButtonItem, PanelSection, PanelSectionRow, ToggleField, Navigation, staticClasses, Focusable, TextField, GamepadButton } from '@decky/ui';
import { callable, definePlugin, routerHook, toaster } from '@decky/api';
import { FaSteam } from 'react-icons/fa';
import { pageUrl, safeNavigation } from './actions.ts';
import { DeckyRelay } from './relay.ts';
import type { Frame, WindowEntry, Message } from './relay.ts';

type Status = { phase:string; message:string; steamId:string|null; enabled:boolean };
type Control = { label:string; input:boolean; value:string };
const getStatus=callable<[],Status>('get_status');
const setEnabled=callable<[boolean],Status>('set_enabled');
const reconnect=callable<[],Status>('reconnect');
const browserAction=callable<[string,string,string],Control>('browser_action');
const ROUTE='/steambooster';
let relay: DeckyRelay | undefined;
let channel: BroadcastChannel | undefined;
let activeId: string | undefined;
const listeners=new Set<()=>void>();
function changed() { for(const listener of listeners) listener(); }
function notify(error:unknown) { toaster.toast({title:'SteamBooster',body: error instanceof Error ? error.message : String(error)}); }
function navigate(url:string) {
  if(!safeNavigation(url)) throw Error('Недопустимый адрес');
  Navigation.CloseSideMenus();
  Navigation.NavigateToSteamWeb(url);
}
function hide(id:string) {
  const entry=relay?.windows.get(id);
  if(entry?.frame.node) { entry.frame.node.style.display='none'; document.body.appendChild(entry.frame.node); }
  if(activeId===id) { activeId=undefined;Navigation.NavigateBack(); }
}
async function createFrame(entry:Omit<WindowEntry,'frame'>):Promise<Frame> {
  if(entry.external) return {node:null,destroy:()=>{},send:()=>{}};
  const node=document.createElement('iframe');
  node.name='sb-decky:'+entry.id;
  node.title=entry.title;
  node.style.cssText='display:none;border:0;width:100%;height:100%;background:#171a21;';
  // Only pinned original plugin HTML is same-origin. Remote pages retain their own origin.
  node.setAttribute('sandbox','allow-scripts allow-same-origin allow-forms allow-popups');
  let destroyed=false;
  const origin=entry.url ? new URL(entry.url).origin : window.location.origin;
  const message=(event:MessageEvent)=>{
    if(destroyed||event.source!==node.contentWindow||event.origin!==origin) return;
    const data=event.data;
    if(!data||typeof data!=='object') return;
    if(data.kind==='sb:embed' && data.v===1) node.contentWindow?.postMessage({kind:'sb:ready',v:1},origin);
    else relay?.post({kind:'window-message',windowId:entry.id,data});
  };
  window.addEventListener('message',message);
  const loaded=new Promise<void>((resolve,reject)=>{
    if(entry.url) {resolve();return;}
    const timer=setTimeout(()=>reject(Error('Страница не загрузилась')),4000);
    node.onload=()=>{clearTimeout(timer);resolve();};
    node.onerror=()=>{clearTimeout(timer);reject(Error('Ошибка загрузки страницы'));};
  });
  if(entry.html) node.srcdoc=entry.html;else if(entry.url) node.src=entry.url;
  document.body.appendChild(node);
  try { await loaded; }
  catch(error) { node.remove();window.removeEventListener('message',message);throw error; }
  return {node,destroy:()=>{destroyed=true;node.remove();window.removeEventListener('message',message);},send:(data)=>node.contentWindow?.postMessage(data,origin)};
}
function reset() { relay?.close();relay=undefined;channel?.close();channel=undefined;activeId=undefined;changed(); }
function configure(config:{secret:string}) {
  reset();
  channel=new BroadcastChannel('sb_cmd');
  relay=new DeckyRelay(config.secret, {
    post:(data)=>channel?.postMessage(data), create:createFrame,
    show:(id)=>{
      const entry=relay?.windows.get(id);
      if(entry?.external&&entry.url){navigate(entry.url);return;}
      const previous=activeId;activeId=id;if(previous===id){changed();return;} Navigation.CloseSideMenus();if(!previous)Navigation.Navigate(ROUTE);changed();
    },
    hide, navigate, changed,
  });
  const ownedRelay=relay;
  channel.addEventListener('message',event=>{void ownedRelay.receive(event.data as Message).catch(notify);});
}
async function openPage(kind:string) {
  if(!relay) throw Error('Подключение ещё не готово');
  await relay.receive({kind:'open-window',windowId:'decky_'+kind,title:kind==='catalog'?'Каталог':'Оцени аккаунт',url:pageUrl(kind),requestId:0,__sbsec:relay.secret});
}
function Content() {
  const [status,update]=useState<Status>({phase:'connecting',message:'Запуск',steamId:null,enabled:true});
  const [busy,setBusy]=useState(false);
  useEffect(()=>{
    let mounted=true,request=false;
    const poll=async()=>{if(request)return;request=true;try{const value=await getStatus();if(mounted)update(value);}catch{if(mounted)update(s=>({...s,phase:'disconnected',message:'Бэкенд Decky недоступен'}));}finally{request=false;}};
    void poll();const timer=setInterval(()=>void poll(),2000);
    return()=>{mounted=false;clearInterval(timer);};
  },[]);
  const run=async(fn:()=>Promise<unknown>)=>{setBusy(true);try{await fn();}catch(error){notify(error);}finally{setBusy(false);}};
  const ready=status.phase==='ready'&&!busy;
  return <PanelSection title='SteamBooster'>
    <PanelSectionRow><div>{status.message||status.phase}{status.steamId&&<div style={{fontSize:12}}>Steam ID: {status.steamId}</div>}</div></PanelSectionRow>
    <PanelSectionRow><ToggleField label='Включён' checked={status.enabled} disabled={busy} onChange={value=>void run(async()=>update(await setEnabled(value)))}/></PanelSectionRow>
    <PanelSectionRow><ButtonItem layout='below' disabled={!ready} onClick={()=>void run(()=>openPage('catalog'))}>Каталог игр</ButtonItem></PanelSectionRow>
    <PanelSectionRow><ButtonItem layout='below' disabled={!ready} onClick={()=>void run(()=>openPage('valuation'))}>Оцени аккаунт</ButtonItem></PanelSectionRow>
    <PanelSectionRow><ButtonItem layout='below' disabled={!ready} onClick={()=>{
      const id='booster-checkout__sb_topup';
      if(!relay?.windows.has(id)) {notify('Форма пополнения ещё загружается. Повторите через несколько секунд.');return;}
      relay.show(id);
    }}>Пополнить баланс</ButtonItem></PanelSectionRow>
    <PanelSectionRow><ButtonItem layout='below' disabled={!ready} onClick={()=>navigate('https://store.steampowered.com/')}>Магазин и предложения игр</ButtonItem></PanelSectionRow>
    <PanelSectionRow><ButtonItem layout='below' disabled={busy||!status.enabled} onClick={()=>void run(async()=>update(await reconnect()))}>Восстановить подключение</ButtonItem></PanelSectionRow>
  </PanelSection>;
}
function WindowPage() {
  const [,render]=useState(0);
  const [control,setControl]=useState<Control>({label:'Выберите элемент',input:false,value:''});
  const [text,setText]=useState('');
  const [busy,setBusy]=useState(false);
  const host=useRef<HTMLDivElement>(null);
  const id=activeId;
  const entry=id?relay?.windows.get(id):undefined;
  useEffect(()=>{const listener=()=>render(n=>n+1);listeners.add(listener);return()=>{listeners.delete(listener);};},[]);
  useEffect(()=>{
    const node=entry?.frame.node;
    if(!node||!host.current)return;
    host.current.appendChild(node);node.style.display='block';
    return()=>{
      node.style.display='none';
      if(relay?.windows.get(entry.id)===entry&&node.isConnected)document.body.appendChild(node);
      if(activeId===entry.id){
        activeId=undefined;entry.visible=false;
        relay?.post(entry.popup?{kind:'popup-hide-event',popupId:entry.id}:{kind:'window-hide-event',windowId:entry.id});
      }
    };
  },[entry]);
  const action=async(kind:string,value='')=>{
    if(!id||busy)return;
    setBusy(true);
    try{const result=await browserAction('sb-decky:'+id,kind,value);setControl(result);setText(result.value);}
    catch(error){notify(error);}finally{setBusy(false);}
  };
  const close=()=>{if(id)relay?.hide(id);else Navigation.NavigateBack();};
  return <Focusable style={{height:'100%',padding:18,boxSizing:'border-box',display:'flex',flexDirection:'column'}} onCancel={close} onCancelActionDescription='Назад'>
    <div style={{display:'flex',gap:12,alignItems:'center',marginBottom:8}}>
      <ButtonItem onClick={close}>Назад</ButtonItem><span>{entry?.title??'SteamBooster'}</span>
    </div>
    <Focusable style={{flex:1,minHeight:0}} onActivate={()=>void action('activate')} onGamepadDirection={event=>{
      const direction=event.detail.button;
      void action(direction===GamepadButton.DIR_UP||direction===GamepadButton.DIR_LEFT?'prev':'next');
      event.stopPropagation();
    }} onOKActionDescription='Нажать' onGamepadFocus={()=>void action('read')}>
      <div ref={host} style={{height:'100%'}}/>
    </Focusable>
    <div style={{display:'flex',gap:8,alignItems:'center',marginTop:8}}>
      <ButtonItem disabled={busy} onClick={()=>void action('prev')}>Предыдущее</ButtonItem>
      <ButtonItem disabled={busy} onClick={()=>void action('next')}>Следующее</ButtonItem>
      <ButtonItem disabled={busy} onClick={()=>void action('activate')}>Нажать</ButtonItem>
      <span style={{fontSize:12}}>{control.label}</span>
    </div>
    {control.input&&<div style={{display:'flex',gap:8,marginTop:8}}>
      <TextField label='Текст выбранного поля' value={text} onChange={event=>setText(event.target.value)}/>
      <ButtonItem disabled={busy} onClick={()=>void action('text',text)}>Применить</ButtonItem>
    </div>}
  </Focusable>;
}

declare global {
  interface Window {
    __sb_decky_frontend?:boolean;
    __sb_decky_configure?:(config:{secret:string})=>void;
    __sb_decky_reset?:()=>void;
    __sb_decky_navigate?:(url:string)=>void;
  }
}
export default definePlugin(()=>{
  window.__sb_decky_frontend=true;
  window.__sb_decky_configure=configure;
  window.__sb_decky_reset=reset;
  window.__sb_decky_navigate=navigate;
  routerHook.addRoute(ROUTE,WindowPage);
  return {name:'SteamBooster',titleView:<div className={staticClasses.Title}>SteamBooster</div>,content:<Content/>,icon:<FaSteam/>,
    onDismount(){reset();routerHook.removeRoute(ROUTE);delete window.__sb_decky_frontend;delete window.__sb_decky_configure;delete window.__sb_decky_reset;delete window.__sb_decky_navigate;}
  };
});
