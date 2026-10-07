// Deck presentation adapter. Checkout remains the sole owner of HTTP and orders.
(()=>{
  if(location.origin!=='https://store.steampowered.com')return;
  sb.plugins.register({
    id:'decky-store',version:'1.0.0',apiVersion:1,displayName:'SteamBooster Deck Store',
    contextKinds:['web'],urlPatterns:['^https://store\\.steampowered\\.com(/.*)?$'],
    capabilities:['bus','pages'],
    init(ctx){
      const api=ctx.sb;
      let teardownPage=()=>{},stopped=false;
      const style=document.createElement('style');style.id='sb-decky-offers-style';
      style.textContent=`
        #booster-topup-bar,#booster-region-games,#booster-keys-block,.booster-eo{display:none!important}
        #sb-decky-offers{margin:12px 0;padding:14px;background:#1b2838;color:#dbe5ef;font-size:14px;box-sizing:border-box}
        #sb-decky-offers h3{font-size:17px;margin:0 0 10px;color:#fff}
        #sb-decky-offers .sb-offer{padding:10px 0;border-top:1px solid #35485a;display:flex;align-items:center;flex-wrap:wrap;gap:10px}
        #sb-decky-offers .sb-offer-info{flex:1;min-width:150px}
        #sb-decky-offers .sb-offer-region{display:block;color:#a9b8c7;font-size:13px;margin-top:4px}
        #sb-decky-offers button{font:inherit;color:#fff;background:#31566b;border:1px solid #6389a1;border-radius:3px;padding:9px 12px;min-height:40px;cursor:pointer}
        #sb-decky-offers button:disabled{opacity:.6;cursor:default}
        #sb-decky-offers form{display:flex;flex-wrap:wrap;gap:8px;width:100%;align-items:center}
        #sb-decky-offers input{font:inherit;min-width:180px;max-width:100%;padding:10px;background:#111e2a;color:#fff;border:1px solid #6389a1;box-sizing:border-box}
        #sb-decky-offers .sb-offer-status{width:100%;line-height:1.4}
      `;
      document.head.append(style);
      const registration=api.pages.register({
        name:'decky-store-offers',match:{url:/^https:\/\/store\.steampowered\.com\/app\/\d+/},
        mount(page){
          if(stopped)return;
          teardownPage();
          const appid=Number(new URL(page.url).pathname.match(/^\/app\/(\d+)/)?.[1]);
          if(!appid||page.signal.aborted)return;
          let disposed=false,list=null,sequence=0;
          const nonce=`decky-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
          const pending=new Map();const subscriptions=[];
          const root=document.createElement('section');root.id='sb-decky-offers';root.setAttribute('aria-label','Предложения SteamBalance');
          let visible=false;const comparisons=[];
          const rub=value=>new Intl.NumberFormat('ru-RU',{style:'currency',currency:'RUB',maximumFractionDigits:2}).format(value);
          function savings(item){
            if(!Number.isSafeInteger(item.packageId)||item.packageId<=0)return '';
            for(const sub of document.querySelectorAll('.game_area_purchase_game input[name="subid"]')){
              if(Number(sub.value)!==item.packageId)continue;
              const block=sub.closest('.game_area_purchase_game');
              const price=block.querySelector('.discount_final_price,.game_purchase_price');
              const text=price?.textContent?.trim()||'';
              const match=text.match(/^(\d[\d \u00a0\u202f]*(?:[,.]\d{1,2})?)\s*(?:₽|руб\.?|RUB)$/i);
              if(!match)continue;
              const steamPrice=Number(match[1].replace(/[ \u00a0\u202f]/g,'').replace(',','.'));
              if(Number.isFinite(steamPrice)&&steamPrice>item.price)return `Дешевле Steam на ${rub(steamPrice-item.price)}`;
            }
            return '';
          }
          const reconcile=()=>{
            if(disposed)return;
            for(const {item,node} of comparisons){const text=savings(item);if(node.textContent!==text)node.textContent=text;}
            // These IDs are emitted by Steam itself. On responsive pages Steam
            // moves game_area_purchase into purchaseOptionsContent.
            const host=document.querySelector('#game_area_purchase')||document.querySelector('#purchaseOptionsContent');
            if(visible&&host){if(root.parentElement!==host)host.append(root);}
            else root.remove();
          };
          const observer=new MutationObserver(reconcile);observer.observe(document,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['value']});
          function finish(id,result){
            const request=pending.get(id);if(!request)return;
            clearTimeout(request.timeout);clearInterval(request.retry);pending.delete(id);
            if(list?.id===id)list=null;
            if(!disposed)request.done(result);
          }
          function request(kind,data,done){
            const id=`${nonce}:${++sequence}`;let sends=0;
            const send=()=>{if(disposed||!pending.has(id)||sends>=3)return;sends++;try{api.bus.publish(`decky-store.keys.${kind}`,{...data,reqId:id});}catch{finish(id,{error:'transport'});}};
            const entry={done,timeout:setTimeout(()=>finish(id,{error:'timeout'}),kind==='request'?6500:30000),retry:undefined};
            pending.set(id,entry);
            if(kind==='request'){list={id,send};entry.retry=setInterval(send,1800);}
            send();
          }
          const subscribe=(suffix,cb)=>subscriptions.push(api.bus.subscribe(`booster-checkout.keys.${suffix}`,cb));
          subscribe('response',data=>{if(data?.reqId===list?.id)finish(data.reqId,data);});
          subscribe('email-required',data=>{if(data?.reqId&&pending.has(data.reqId)&&data.reqId!==list?.id)finish(data.reqId,{emailRequired:true});});
          subscribe('purchase-result',data=>{if(data?.reqId&&pending.has(data.reqId)&&data.reqId!==list?.id)finish(data.reqId,data);});
          subscribe('ready',()=>list?.send());
          function button(label){const node=document.createElement('button');node.type='button';node.textContent=label;return node;}
          function heading(){comparisons.length=0;root.replaceChildren();const title=document.createElement('h3');title.textContent='Ключи SteamBalance';root.append(title);}
          function load(){
            if(disposed||list)return;
            heading();const status=document.createElement('p');status.textContent='Загрузка предложений…';status.setAttribute('role','status');root.append(status);visible=true;reconcile();
            request('request',{appid},result=>{
              if(result.error||!Array.isArray(result.items)){
                status.textContent='Не удалось загрузить предложения.';const retry=button('Повторить');retry.addEventListener('click',load);root.append(retry);return;
              }
              const seen=new Set();
              const items=result.items.filter(item=>item&&item.isActive===true&&Number.isSafeInteger(item.itemId)&&item.itemId>0&&typeof item.name==='string'&&item.name.trim()&&Number.isFinite(item.price)&&item.price>0&&!seen.has(item.itemId)&&seen.add(item.itemId));
              heading();for(const item of items)renderOffer(item);
              visible=items.length>0;reconcile();
            });
          }
          function renderOffer(item){
            const row=document.createElement('div');row.className='sb-offer';
            const info=document.createElement('div');info.className='sb-offer-info';info.textContent=item.name;
            const region=document.createElement('span');region.className='sb-offer-region';region.textContent=`Регион активации: ${typeof item.regionLabel==='string'&&item.regionLabel.trim()?item.regionLabel:'не указан — проверьте перед оплатой'}`;info.append(region);
            const price=document.createElement('strong');price.textContent=rub(item.price);
            const comparison=document.createElement('span');comparison.className='sb-offer-region';info.append(comparison);comparisons.push({item,node:comparison});
            const buy=button('Купить ключ');buy.dataset.itemId=String(item.itemId);
            const status=document.createElement('div');status.className='sb-offer-status';status.setAttribute('role','status');
            let form=null,busy=false,locked=false;
            function purchase(email){
              if(disposed||busy||locked)return;
              busy=true;buy.disabled=true;if(form)form.querySelector('button').disabled=true;status.textContent='Открываем оплату…';
              request('purchase',{itemId:item.itemId,...(email?{email}:{}),windowTitle:`Покупка: ${item.name}`.slice(0,200),windowTaskbarTitle:'SteamBalance'},result=>{
                busy=false;
                if(result.emailRequired){
                  status.textContent='Для получения ключа укажите email.';
                  if(!form){
                    form=document.createElement('form');
                    const input=document.createElement('input');input.type='email';input.required=true;input.autocomplete='email';input.placeholder='Email для ключа';input.setAttribute('aria-label','Email для получения ключа');
                    const proceed=button('Продолжить');proceed.type='submit';
                    form.append(input,proceed);row.append(form);
                    form.addEventListener('submit',event=>{event.preventDefault();if(!input.checkValidity())return;purchase(input.value.trim());});input.focus();
                  }
                  form.querySelector('button').disabled=false;
                  return;
                }
                // A timeout/window failure may already have created an order.
                // Keep this action locked; do not issue a second order as retry.
                locked=true;form?.remove();
                if(result.ok===true){buy.textContent='Оплата открыта';status.textContent='Продолжите оплату в открытом окне.';}
                else{buy.textContent='Оплата не подтверждена';status.textContent=typeof result.message==='string'&&result.message.trim()?`${result.message} Проверьте «Мои заказы» перед новой покупкой.`:'Не удалось подтвердить открытие оплаты. Проверьте «Мои заказы» перед новой покупкой.';}
              });
            }
            buy.addEventListener('click',()=>purchase());row.append(info,price,buy,status);root.append(row);
          }
          function cleanup(){
            if(disposed)return;disposed=true;observer.disconnect();
            for(const request of pending.values()){clearTimeout(request.timeout);clearInterval(request.retry);}pending.clear();list=null;
            for(const unsub of subscriptions)unsub();root.remove();page.signal.removeEventListener('abort',cleanup);
          }
          teardownPage=cleanup;page.signal.addEventListener('abort',cleanup,{once:true});load();return cleanup;
        }
      });
      function stop(){if(stopped)return;stopped=true;teardownPage();style.remove();registration?.unregister?.();ctx.signal?.removeEventListener('abort',stop);}
      ctx.signal?.addEventListener('abort',stop,{once:true});return stop;
    }
  });
})();
