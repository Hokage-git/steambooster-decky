"""Decky-owned Steam connection and generation-scoped injections."""
import asyncio
import hashlib
import json
import logging
from pathlib import Path
import re
import secrets
from urllib.parse import urlsplit
from aiohttp import ClientSession, ClientTimeout
from .cdp import CDP
from .policy import allowed_url
from .website import Website

LOG = logging.getLogger('SteamBooster')
VENDOR = Path(__file__).resolve().parents[1] / 'vendor'
UI_KINDS = ['attach-popup', 'popup-show', 'popup-hide', 'popup-toggle', 'popup-destroy', 'popup-postMessage',
            'navigate', 'add-menu-item', 'remove-menu-item', 'open-window', 'window-show', 'window-hide',
            'window-close', 'window-bring', 'window-postMessage', 'external-window-open', 'external-window-set-url',
            'external-window-close', 'external-window-state-request', 'external-window-native-title-request']


def can_claim(status, owner):
    if status.get('owner') not in {None, owner}:
        return False
    return not (status.get('sb') or status.get('relay')) or status.get('owner') == owner


class Runtime:
    def __init__(self, settings_dir):
        self.settings_dir = Path(settings_dir)
        self.settings_dir.mkdir(parents=True, exist_ok=True)
        try:
            settings = json.loads((self.settings_dir/'settings.json').read_text())
        except (OSError, ValueError):
            settings = {}
        self.enabled = settings.get('enabled', True) is True
        self.state = {'phase': 'disconnected' if self.enabled else 'disabled', 'message': '', 'steamId': None, 'enabled': self.enabled}
        self.task = None
        self.cdp = None
        self.http = None
        self.website = None
        self.owner = secrets.token_hex(16)
        self.sessions = {}
        self.bus_targets = set()
        self.workers = set()
        self.main_session = None
        self.secrets = {}
        self.entries = []
        self.shared_target = None
        self.generation = 0
        self.frames = set()

    def spawn(self, awaitable):
        if len(self.workers) >= 256:
            awaitable.close()
            return None
        task = asyncio.create_task(awaitable)
        self.workers.add(task)
        def completed(item):
            self.workers.discard(item)
            if not item.cancelled():
                error = item.exception()
                if error:
                    LOG.debug('worker ended: %s', type(error).__name__)
        task.add_done_callback(completed)
        return task

    def write_json(self, filename, data):
        path = self.settings_dir/filename
        temporary = path.with_suffix('.tmp')
        temporary.write_text(json.dumps(data))
        temporary.chmod(0o600)
        temporary.replace(path)

    async def start(self):
        if self.enabled and self.task is None:
            self.task = asyncio.create_task(self.run())

    async def stop(self):
        if self.task:
            self.task.cancel()
            await asyncio.gather(self.task, return_exceptions=True)
            self.task = None
        await self.cleanup()

    async def set_enabled(self, enabled):
        if type(enabled) is not bool:
            raise ValueError('enabled must be boolean')
        await self.stop()
        self.enabled = enabled
        self.write_json('settings.json', {'enabled': enabled})
        self.state.update(enabled=enabled, phase='disconnected' if enabled else 'disabled', steamId=None, message='')
        await self.start()
        return dict(self.state)

    async def reconnect(self):
        await self.stop()
        await self.start()
        return dict(self.state)

    async def targets(self):
        async with self.http.get('http://127.0.0.1:8080/json/list', timeout=ClientTimeout(total=5)) as response:
            response.raise_for_status()
            result = await response.json()
        if not isinstance(result, list):
            raise RuntimeError('invalid Steam target list')
        return result

    async def run(self):
        async with ClientSession(timeout=ClientTimeout(total=30)) as http:
            self.http = http
            try:
                while self.enabled:
                    try:
                        self.state.update(phase='connecting', message='', steamId=None)
                        await self.connect()
                    except asyncio.CancelledError:
                        raise
                    except Exception as error:
                        # Never log request payloads, keys, inventories or HTTP bodies.
                        text = str(error)
                        if text.startswith('conflict:'):
                            phase, text = 'conflict', 'Другой мост SteamBooster активен. Отключите Linux-сервис и восстановите подключение.'
                        elif text.startswith('decky:'):
                            phase, text = 'waiting', 'Ожидание интерфейса Decky в игровом режиме.'
                        else:
                            phase, text = 'disconnected', 'Steam недоступен. Проверьте Decky и локальный CEF debugging (порт 8080).'
                        self.state.update(phase=phase, message=text, steamId=None)
                        LOG.debug('connection ended: %s', type(error).__name__)
                    finally:
                        await self.cleanup()
                    await asyncio.sleep(3)
            finally:
                self.http = None

    async def session_for(self, target):
        if target['id'] not in self.sessions:
            self.sessions[target['id']] = await self.cdp.attach(target['id'])
        return self.sessions[target['id']]

    async def inspect(self, session, context=None):
        return await self.cdp.evaluate('({sb:!!globalThis.sb,relay:globalThis.__sb_relay_started===true,owner:globalThis.__sb_decky_owner??null,decky:globalThis.__sb_decky_frontend===true})', session, context, timeout=5)

    async def connect(self):
        manifest = json.loads((VENDOR/'manifest.json').read_text())
        for name, digest in manifest['sha256'].items():
            if hashlib.sha256((VENDOR/name).read_bytes()).hexdigest() != digest:
                raise RuntimeError('vendor asset integrity failure')
        targets = await self.targets()
        shared = next((t for t in targets if t.get('title') == 'SharedJSContext' or 'IN_STEAMUI_SHARED_CONTEXT=true' in t.get('url', '')), None)
        if not shared or not shared.get('webSocketDebuggerUrl'):
            raise RuntimeError('SharedJSContext unavailable')
        self.cdp = await CDP.connect(self.http, shared['webSocketDebuggerUrl'])
        self.shared_target = shared['id']
        shared_session = await self.session_for(shared)
        main = None
        # Decky's frontend marks its actual renderer; titles differ by Steam UI/language.
        for target in targets:
            if target.get('type') != 'page':
                continue
            try:
                session = await self.session_for(target)
                status = await self.inspect(session)
                if status.get('decky'):
                    main = target, session, status
                    break
            except (RuntimeError, TimeoutError):
                continue
        if main is None:
            raise RuntimeError('decky: frontend not ready')
        self.main_session = main[1]
        shared_status = await self.inspect(shared_session)
        if not can_claim(shared_status, self.owner) or not can_claim(main[2], self.owner):
            raise RuntimeError('conflict: another bridge owns Steam')
        self.generation += 1
        self.secrets = {name:'__sb_' + secrets.token_hex(16) for name in ['hostAccount', 'rateAccountData', 'keysPurchase', 'keysActivate']}
        self.secrets.update(frameworkToken=secrets.token_hex(16), resolverName='__sb_resolve', busDispatchName='__sb_bus_dispatch', relaySecret=secrets.token_hex(16))
        self.entries = []
        for meta in manifest['plugins']:
            entry = dict(meta, required=False, url=f"https://localhost/{meta['id']}.js", sha256=manifest['sha256'][meta['id']+'.js'], token=secrets.token_hex(16))
            self.entries.append(entry)
        self.website = Website(self.cdp, self.invoke, self.navigate_store, self.store_action)
        self.spawn(self.events())
        await self.cdp.evaluate(f'globalThis.__sb_decky_configure({json.dumps({"secret":self.secrets["relaySecret"], "uiKinds": UI_KINDS})})', self.main_session)
        combined = shared_session == self.main_session
        if not combined:
            await self.inject(shared_session, 'shared', [])
        await self.inject(self.main_session, 'main', [p for p in self.entries if 'main' in p['contextKinds']], combined=combined)
        for session in self.sessions.values():
            await self.website.watch(session)
        await self.wait_plugins(self.main_session, [p['id'] for p in self.entries if 'main' in p['contextKinds']])
        self.state.update(phase='ready', message='Подключено', steamId=None)
        self.spawn(self.identity_loop())
        while not self.cdp.closed:
            await asyncio.sleep(1.5)
            targets = await self.targets()
            if not any(t['id'] == self.shared_target for t in targets):
                raise ConnectionError('shared renderer replaced')
            if not await self.cdp.evaluate('globalThis.__sb_relay_started === true', shared_session, timeout=5):
                raise ConnectionError('shared relay stopped')
            if not await self.cdp.evaluate(f'globalThis.__sb_decky_owner==={json.dumps(self.owner)} && !!globalThis.sb && globalThis.__sb_decky_frontend===true', self.main_session, timeout=5):
                raise ConnectionError('main renderer replaced')
            live_ids = {t['id'] for t in targets}
            for target_id, session in list(self.sessions.items()):
                if target_id not in live_ids:
                    self.sessions.pop(target_id)
                    self.website.forget(session)
                    self.bus_targets = {item for item in self.bus_targets if item[0] != session}
                    await self.cdp.send('Target.detachFromTarget', {'sessionId': session})
            for target in targets:
                if target.get('type') == 'page' and target['id'] not in self.sessions:
                    session = await self.session_for(target)
                    await self.website.watch(session)

    async def inject(self, session, kind, entries, context=None, combined=False):
        status = await self.inspect(session, context)
        if not can_claim(status, self.owner):
            raise RuntimeError('conflict: framework already present')
        manifest = {'injectorVersion': 'decky-0.1.4', 'contextKind': kind, 'deckyCombined': combined, 'userDisabledPlugins': [], 'plugins': entries, '_sec': self.secrets}
        prefix = (VENDOR/'bootstrap.js').read_text().replace('__MANIFEST__', json.dumps(manifest))
        await self.cdp.evaluate(prefix + f';globalThis.__sb_decky_owner={json.dumps(self.owner)};', session, context)
        # Track ownership immediately so even a failed bundle is cleaned up.
        self.bus_targets.add((session, context))
        # Shared keeps account/library/key collectors. Decky's Main UI adapter owns popup/navigation messages.
        if kind == 'shared' or combined:
            filter_script = '''(()=>{const Original=globalThis.BroadcastChannel;
            globalThis.__sb_decky_originalBC=Original;
            const kinds=new Set(__KINDS__); const secret=__SECRET__;
            globalThis.BroadcastChannel=class extends Original{
              addEventListener(type,handler,opts){
                if(type!=='message'||this.name!=='sb_cmd')return super.addEventListener(type,handler,opts);
                const wrapped=e=>{if(e.data?.__sbsec===secret&&kinds.has(e.data.kind))return;
                  if(typeof handler==='function')handler(e);else handler.handleEvent(e)};
                (this.__handlers??=new Map()).set(handler,wrapped);super.addEventListener(type,wrapped,opts);
              }
              removeEventListener(type,handler,opts){super.removeEventListener(type,this.__handlers?.get(handler)??handler,opts)}
            };})()'''.replace('__KINDS__', json.dumps(UI_KINDS)).replace('__SECRET__', json.dumps(self.secrets['relaySecret']))
            await self.cdp.evaluate(filter_script, session, context)
        try:
            await self.cdp.evaluate((VENDOR/'framework.js').read_text(), session, context)
        finally:
            if kind == 'shared' or combined:
                await self.cdp.evaluate('globalThis.BroadcastChannel=globalThis.__sb_decky_originalBC; delete globalThis.__sb_decky_originalBC;', session, context)
        self.spawn(self.pump(session, context))
        for entry in entries:
            code = f'globalThis.__SB_PLUGIN_BOOT__={json.dumps({"id":entry["id"],"token":entry["token"]})};' + (VENDOR/(entry['id']+'.js')).read_text()
            await self.cdp.evaluate(code, session, context)

    async def events(self):
        while not self.cdp.closed:
            message = await self.cdp.events.get()
            try:
                await self.handle_event(message)
            except (RuntimeError, ConnectionError, TimeoutError) as error:
                # A frame can disappear between discovery and injection. One
                # navigation must not terminate discovery for every other frame.
                LOG.debug('frame event failed: %s', type(error).__name__)

    async def handle_event(self, message):
        method, session, params = message['method'], message.get('sessionId'), message.get('params', {})
        if method == 'Target.attachedToTarget':
            child = params['sessionId']
            try:
                if params.get('targetInfo', {}).get('type') == 'iframe':
                    await self.website.watch(child)
                    # The document may already exist when Chromium pauses the
                    # new renderer; new-document scripts alone are then too late.
                    await self.cdp.evaluate(self.website.script + '\n' + self.website.store_script, child, timeout=5)
            finally:
                await self.cdp.send('Runtime.runIfWaitingForDebugger', session=child)
            return
        if method == 'Target.detachedFromTarget':
            child = params['sessionId']
            self.website.forget(child)
            self.website.sessions.discard(child)
            self.website.scripts.pop(child, None)
            self.frames = {item for item in self.frames if item[0] != child}
            self.bus_targets = {item for item in self.bus_targets if item[0] != child}
            return
        # Binding calls may await collectors: never block invalidation behind them.
        if method == 'Runtime.bindingCalled':
            self.spawn(self.website.event(message))
            return
        if method == 'Runtime.executionContextCreated':
            context = params['context']
            if context.get('auxData', {}).get('isDefault'):
                self.frames.add((session, context['id']))
            if context.get('auxData', {}).get('isDefault') and context.get('origin') == 'https://store.steampowered.com':
                self.spawn(self.inject_store(session, context['id']))
        elif method == 'Runtime.executionContextDestroyed':
            self.bus_targets.discard((session, params['executionContextId']))
            self.frames.discard((session, params['executionContextId']))
        elif method == 'Runtime.executionContextsCleared':
            self.bus_targets = {item for item in self.bus_targets if item[0] != session}
            self.frames = {item for item in self.frames if item[0] != session}
        await self.website.event(message)

    async def inject_store(self, session, context):
        if (session, context) in self.bus_targets:
            return
        entries = [p for p in self.entries if 'web' in p['contextKinds']]
        await self.inject(session, 'web', entries, context)

    async def wait_plugins(self, session, expected):
        deadline = asyncio.get_running_loop().time() + 15
        expression = 'globalThis.__sb_internal?._pluginOutcomes?.map(p=>({pluginId:p.pluginId,ok:p.ok}))'
        while asyncio.get_running_loop().time() < deadline:
            outcomes = await self.cdp.evaluate(expression, session, timeout=5)
            if isinstance(outcomes, list) and set(expected).issubset({p['pluginId'] for p in outcomes}):
                if any(not p.get('ok') for p in outcomes):
                    raise RuntimeError('plugin initialization failed')
                return
            await asyncio.sleep(.1)
        raise RuntimeError('plugin initialization timed out')

    async def invoke(self, delegate, args):
        if not self.main_session or not self.cdp or self.cdp.closed:
            raise ConnectionError('Steam is reconnecting')
        name = self.secrets.get(delegate)
        if not name:
            raise ValueError('unsupported delegate')
        expression = f'(async()=>{{const fn=globalThis[{json.dumps(name)}];if(typeof fn!=="function")throw Error("Steam account unavailable");return fn(...{json.dumps(args)})}})()'
        return await self.cdp.evaluate(expression, self.main_session)

    async def identity_loop(self):
        while self.cdp and not self.cdp.closed:
            try:
                data = await self.invoke('hostAccount', ['getSteamId'])
                self.state['steamId'] = data.get('steamId') if isinstance(data, dict) else None
            except Exception:
                self.state['steamId'] = None
            await asyncio.sleep(5)

    async def store_action(self, action):
        if action in ("catalog", "valuation", "topup") and self.main_session and self.cdp:
            await self.cdp.evaluate(f"globalThis.__sb_decky_open({json.dumps(action)})", self.main_session, timeout=5)

    async def navigate_store(self, url):
        if self.main_session and self.cdp:
            await self.cdp.evaluate(f'globalThis.__sb_decky_navigate({json.dumps(url)})', self.main_session, timeout=5)

    async def browser_action(self, frame_name, action, value=''):
        if action not in {'read', 'next', 'prev', 'activate', 'text'}:
            raise ValueError('unsupported browser action')
        if not isinstance(frame_name, str) or not re.fullmatch(r'sb-decky:[a-zA-Z0-9_-]{1,64}', frame_name):
            raise ValueError('invalid frame name')
        if not isinstance(value, str) or len(value) > 4096:
            raise ValueError('invalid input value')
        if not self.cdp or self.cdp.closed:
            raise ConnectionError('Steam disconnected')
        function = (Path(__file__).parent/'browser-controls.js').read_text()
        expression = f'window.name==={json.dumps(frame_name)}?({function})({json.dumps(action)},{json.dumps(value)}):null'
        for session, context in list(self.frames):
            try:
                result = await self.cdp.evaluate(expression, session, context, timeout=5)
                if isinstance(result, dict):
                    return result
            except (ConnectionError, RuntimeError, TimeoutError):
                continue
        raise RuntimeError('Страница ещё загружается или не поддерживает управление')

    async def pump(self, session, context):
        loop_id = secrets.token_hex(12)
        await self.cdp.evaluate(f'globalThis.__sb_decky_loop={json.dumps(loop_id)}', session, context)
        expression = f'(()=>{{if(globalThis.__sb_decky_loop!=={json.dumps(loop_id)})return null;const q=globalThis.__sb_native_queue||[];globalThis.__sb_native_queue=[];return q.slice(0,128)}})()'
        while self.cdp and not self.cdp.closed:
            queue = await self.cdp.evaluate(expression, session, context, timeout=5)
            if not isinstance(queue, list):
                return
            for request in queue:
                if isinstance(request, dict):
                    self.spawn(self.answer_native(request, session, context, loop_id))
            await asyncio.sleep(.08)

    async def answer_native(self, request, session, context, loop_id):
        response = await self.native(request)
        request_id = request.get('requestId')
        if type(request_id) is not int:
            return
        expression = f'globalThis.__sb_decky_loop==={json.dumps(loop_id)}&&globalThis.__sb_resolve?.({request_id},{json.dumps(response)})'
        await self.cdp.evaluate(expression, session, context, timeout=5)

    async def native(self, request):
        try:
            op, args = request.get('op'), request.get('args') or {}
            if not isinstance(args, dict):
                raise ValueError('invalid native arguments')
            if op in {'get_store_country', 'set_store_country'}:
                steam_id = args.get('steamId')
                if not isinstance(steam_id, str) or not re.fullmatch('[0-9]{17}', steam_id):
                    raise ValueError('invalid steamId')
                try:
                    countries = json.loads((self.settings_dir/'countries.json').read_text())
                except (ValueError, OSError):
                    countries = {}
                if op == 'set_store_country':
                    country = args.get('country')
                    if not isinstance(country, str) or not re.fullmatch('[A-Z]{2}', country):
                        raise ValueError('invalid country')
                    countries[steam_id] = country
                    self.write_json('countries.json', countries)
                    return {'ok': True, 'result': None}
                return {'ok': True, 'result': {'country': countries.get(steam_id)}}
            if op == 'bus.publish':
                topic = args.get('topic')
                if not isinstance(topic, str) or not topic or len(topic) > 256:
                    raise ValueError('invalid bus topic')
                code = f'globalThis.__sb_bus_dispatch?.({json.dumps(topic)},{json.dumps(args.get("data"))})'
                await asyncio.gather(*(self.cdp.evaluate(code, sid, ctx, timeout=5) for sid, ctx in list(self.bus_targets)), return_exceptions=True)
                return {'ok': True, 'result': None}
            if op == 'net_fetch':
                entry = next((p for p in self.entries if p['id'] == request.get('pluginId') and p['token'] == request.get('token')), None)
                if not entry or not allowed_url(args.get('url'), set(entry.get('allowedHosts', []))):
                    raise ValueError('network request not allowed')
                if not self.http:
                    raise ConnectionError('Steam disconnected')
                timeout_ms = args.get('timeoutMs', 30000)
                timeout = min(30, max(1, float(timeout_ms)/1000))
                # Redirects cannot escape the plugin's allowlist, and POST is never retried.
                async with self.http.request(str(args.get('method', 'GET')).upper(), args['url'], headers=args.get('headers'), data=args.get('body'), allow_redirects=False, timeout=ClientTimeout(total=timeout)) as response:
                    data = await response.content.read(4*1024*1024+1)
                    if len(data) > 4*1024*1024:
                        raise RuntimeError('response too large')
                    return {'ok': True, 'result': {'status': response.status, 'ok': 200 <= response.status < 300, 'headers': dict(response.headers), 'body': data.decode('utf-8', errors='replace')}}
            if op == 'listPageTargetIds':
                return {'ok': True, 'result': {'targetIds': list(self.sessions)}}
            if op in {'injectTabTitleOverride', 'setNativeWindowTitle', 'log'}:
                return {'ok': True, 'result': None}
            raise ValueError('unsupported native operation')
        except Exception as error:
            return {'ok': False, 'error': str(error)}

    async def cleanup(self):
        workers = list(self.workers)
        for task in workers:
            task.cancel()
        await asyncio.gather(*workers, return_exceptions=True)
        self.workers.clear()
        if self.website:
            await self.website.close()
            self.website = None
        if self.cdp and not self.cdp.closed:
            code = f'''(()=>{{if(globalThis.__sb_decky_owner!=={json.dumps(self.owner)})return;
                globalThis.__sb_internal?.rollbackAll?.();globalThis.__sb_internal?.teardown?.();
                globalThis.__sb_relay_teardown?.();globalThis.__sb_decky_reset?.();
                delete globalThis.__sb_decky_loop; delete globalThis.__sb_decky_owner;
                delete globalThis.__sb_native;delete globalThis.__sb_native_queue;delete globalThis.__SB_PLUGINS_MANIFEST__;
                Object.defineProperty(globalThis,'sb',{{value:undefined,configurable:true,writable:true}});
            }})()'''
            await asyncio.gather(*(self.cdp.evaluate(code, sid, ctx, timeout=2) for sid, ctx in self.bus_targets), return_exceptions=True)
        if self.cdp:
            await self.cdp.close()
        self.cdp = None
        self.sessions.clear()
        self.bus_targets.clear()
        self.frames.clear()
        self.entries.clear()
        self.main_session = None
