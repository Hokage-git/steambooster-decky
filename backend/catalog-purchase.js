;(()=>{
 if(location.origin!=='https://steambalance.cc')return;
 const base=globalThis.SteamBooster;
 if(!base?.purchaseKey||base.__deckyPurchase)return;
 let active=false,cancelPrompt;
 const explain=result=>{
  if(result?.ok)return result;
  const error=result?.error||'unknown';
  const messages={
   'no-payment':'Способ оплаты ключей недоступен. Попробуйте позже.',
   'no-email':'Steam не передал email для получения ключа.',
   'window':'Заказ мог быть создан, но страница оплаты не открылась. Проверьте «Мои заказы» перед новой покупкой.',
   'cancelled':'Покупка отменена. Заказ не создан.',
  };
  return {...result,ok:false,error,message:result?.message||messages[error]||`Не удалось подтвердить покупку (${error}). Проверьте «Мои заказы» перед повторной покупкой.`};
 };
 const emailPrompt=name=>new Promise(resolve=>{
  const previous=document.activeElement;
  const dialog=document.createElement('dialog');dialog.setAttribute('role','dialog');dialog.setAttribute('aria-label','Email для получения ключа');
  dialog.style.cssText='box-sizing:border-box;width:min(480px,90vw);max-height:85vh;overflow:auto;padding:24px;border:1px solid #6389a1;border-radius:12px;background:#172a3a;color:#fff;font:16px sans-serif;z-index:2147483647';
  const form=document.createElement('form');
  const title=document.createElement('h2');title.textContent='Куда отправить ключ?';title.style.fontSize='22px';
  const description=document.createElement('p');description.textContent=(name?name+' — ':'')+'Steam не передал email. Укажите адрес для получения ключа.';
  const label=document.createElement('label');label.textContent='Email';
  const input=document.createElement('input');input.type='email';input.required=true;input.maxLength=254;input.autocomplete='email';input.placeholder='name@example.com';input.style.cssText='box-sizing:border-box;width:100%;margin:8px 0 18px;padding:12px;background:#101e2a;color:white;border:1px solid #6389a1;font:inherit';label.append(input);
  const button=(text,type)=>{const b=document.createElement('button');b.type=type;b.textContent=text;b.style.cssText='padding:12px;margin:4px;border:1px solid #6389a1;border-radius:4px;background:#31566b;color:white;font:inherit';b.setAttribute('data-panel','{"focusable":true,"clickOnActivate":true}');return b;};
  const submit=button('Продолжить покупку','submit'),cancel=button('Отмена','button');cancel.dataset.cancel='';
  let done=false;
  const finish=value=>{if(done)return;done=true;cancelPrompt=undefined;dialog.remove();previous?.focus?.();resolve(value);};
  cancelPrompt=()=>finish(null);cancel.onclick=cancelPrompt;
  dialog.addEventListener('cancel',event=>{event.preventDefault();finish(null);});
  form.onsubmit=event=>{event.preventDefault();if(done||!input.checkValidity())return;submit.disabled=true;finish(input.value.trim());};
  form.append(title,description,label,submit,cancel);dialog.append(form);document.body.append(dialog);
  if(typeof dialog.showModal==='function')dialog.showModal();else dialog.setAttribute('open','');
  input.focus();
 });
 const purchaseKey=async(itemId,options={})=>{
  if(active)return {ok:false,error:'busy',message:'Покупка уже обрабатывается.'};
  active=true;
  try{
   let result=await base.purchaseKey(itemId,options);
   // This specific response guarantees that checkout has not created an order.
   if(result?.error==='no-email'&&!options?.email){
    const email=await emailPrompt(options?.gameName);
    if(!email)return explain({error:'cancelled'});
    result=await base.purchaseKey(itemId,{...options,email});
   }
   return explain(result);
  }catch{return explain({error:'connection'});}
  finally{active=false;}
 };
 const onPageHide=()=>cancelPrompt?.();
 globalThis.addEventListener("pagehide",onPageHide);
 const descriptors=Object.getOwnPropertyDescriptors(base);
 descriptors.purchaseKey={value:purchaseKey,enumerable:true};
 descriptors.__deckyPurchase={value:true};
 descriptors.__dispose={value:()=>{cancelPrompt?.();globalThis.removeEventListener("pagehide",onPageHide);base.__dispose?.();}};
 const api=Object.freeze(Object.defineProperties({},descriptors));
 Object.defineProperty(globalThis,'SteamBooster',{value:api,configurable:true});
})();
