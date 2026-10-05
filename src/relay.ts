import { safeNavigation } from './actions.ts';

export type Message = Record<string, any>;
export type Frame = { node: HTMLIFrameElement | null; destroy: () => void; send: (data: unknown) => void };
export type WindowEntry = { id: string; title: string; url?: string; html?: string; popup: boolean; external?: boolean; visible: boolean; width?:number; height?:number; frame: Frame };
export type RelayEnvironment = {
  post: (data: Message) => void;
  create: (entry: Omit<WindowEntry, 'frame'>) => Frame | Promise<Frame>;
  show: (id: string) => void;
  hide: (id: string) => void;
  navigate: (url: string) => void;
  changed: () => void;
};

export class DeckyRelay {
  windows = new Map<string, WindowEntry>();
  pending = new Set<string>();
  secret: string;
  env: RelayEnvironment;
  closed = false;
  constructor(secret: string, env: RelayEnvironment) { this.secret = secret; this.env = env; }
  post(data: Message) { if (!this.closed) this.env.post({ ...data, __sbsec: this.secret }); }
  async receive(message: Message) {
    if (this.closed || !message || message.__sbsec !== this.secret) return;
    const kind = message.kind;
    const id = message.popupId ?? message.windowId ?? message.id;
    try {
      if (kind === 'navigate') {
        if (!safeNavigation(message.url)) throw new Error('Unsafe URL');
        this.env.navigate(message.url);
        this.post({kind:'navigate-done', requestId:message.requestId});
      } else if (kind === 'add-menu-item') {
        // QAM replaces desktop supernav. Acknowledge registration without a desktop DOM mutation.
        this.post({kind:'menu-item-added', requestId:message.requestId, menuItemId:message.menuItemId});
      } else if (['attach-popup','open-window','external-window-open'].includes(kind)) {
        if (typeof id !== 'string' || !/^[a-zA-Z0-9_-]{1,64}$/.test(id)) throw new Error('Invalid window ID');
        if (this.pending.has(id)) throw new Error('Window is loading');
        if (!this.windows.has(id)) {
          if (this.windows.size >= 16) throw new Error('Too many windows');
          if (message.url && !safeNavigation(message.url)) throw new Error('Unsafe URL');
          if (message.html && (typeof message.html !== 'string' || message.html.length > 2*1024*1024)) throw new Error('Invalid HTML');
          if (!message.url && !message.html) throw new Error('Window has no content');
          const entry = {id, title: String(message.title ?? 'SteamBooster'), url: message.url, html: message.html, width:Number.isFinite(message.width)?Math.min(1920,Math.max(240,message.width)):undefined, height:Number.isFinite(message.height)?Math.min(1200,Math.max(200,message.height)):undefined, popup: kind === 'attach-popup', external: kind === 'external-window-open', visible:false};
          this.pending.add(id);
          try {
            const frame = await this.env.create(entry);
            if (this.closed) { frame.destroy(); return; }
            this.windows.set(id, {...entry, frame});
          } finally { this.pending.delete(id); }
        }
        if (kind === 'attach-popup') this.post({kind:'popup-attached',popupId:id,requestId:message.requestId});
        if (kind === 'open-window') {
          this.post({kind:'window-opened',windowId:id,requestId:message.requestId,effectiveWidth:message.width,effectiveHeight:message.height});
          this.show(id);
        }
        if (kind === 'external-window-open') {
          this.show(id);
          this.post({kind:'external-window-open-reply',requestId:message.requestId,ok:true});
        }
      } else if (['popup-show','popup-toggle','window-show','window-bring'].includes(kind)) {
        if (kind === 'popup-toggle' && this.windows.get(id)?.visible) this.hide(id);
        else this.show(id);
      } else if (kind === 'popup-hide' || kind === 'window-hide') this.hide(id);
      else if (['popup-destroy','window-close','external-window-close'].includes(kind)) this.remove(id);
      else if (kind === 'window-postMessage') this.windows.get(id)?.frame.send(message.data);
      else if (kind === 'window-set-title') { const entry=this.windows.get(id); if(entry) {entry.title=String(message.title);this.env.changed();} }
      else if (kind === 'external-window-set-url') {
        if (!safeNavigation(message.url)) throw new Error('Unsafe URL');
        const entry = this.windows.get(id);
        if (entry) {
          entry.url=message.url;
          if(entry.external) this.env.navigate(message.url);
          else if(entry.frame.node) entry.frame.node.src=message.url;
        }
      }
      // popup-postMessage goes directly to the original popup's BroadcastChannel listener.
    } catch (error) {
      const details = {requestId:message.requestId,error:String(error)};
      if (kind === 'attach-popup') this.post({...details,kind:'popup-attach-error',popupId:id});
      else if (kind === 'open-window') this.post({...details,kind:'window-open-error',windowId:id});
      else if (kind === 'external-window-open') this.post({...details,kind:'external-window-open-reply',ok:false});
      else if (kind === 'navigate') this.post({...details,kind:'navigate-error'});
    }
  }
  show(id: string) {
    const entry=this.windows.get(id); if(!entry || this.closed) return;
    this.env.show(id);
    entry.visible=true;
    this.post(entry.popup?{kind:'popup-show-event',popupId:id}:{kind:'window-show-event',windowId:id});
    this.env.changed();
  }
  hide(id: string) {
    const entry=this.windows.get(id); if(!entry || !entry.visible) return;
    entry.visible=false;this.env.hide(id);
    this.post(entry.popup?{kind:'popup-hide-event',popupId:id}:{kind:'window-hide-event',windowId:id});
    this.env.changed();
  }
  remove(id: string) {
    const entry=this.windows.get(id);if(!entry) return;
    this.hide(id);entry.frame.destroy();this.windows.delete(id);
    this.post({kind:'window-close-event',windowId:id,reason:'caller'});
    this.post({kind:'external-window-close-event',id});this.env.changed();
  }
  close() {
    for(const id of [...this.windows.keys()]) this.remove(id);
    this.closed=true;
  }
}
