"""Exact-origin CDP bindings; replies belong to one execution context."""
import asyncio
import json
from pathlib import Path
import secrets
import re
from .policy import host_call, trusted_origin

VENDOR = Path(__file__).resolve().parents[1] / 'vendor'


class Website:
    def __init__(self, cdp, invoke, navigate=None):
        self.cdp, self.invoke = cdp, invoke
        self.navigate = navigate
        self.binding = '__sb_host_' + secrets.token_hex(12)
        self.navigation_binding = '__sb_nav_' + secrets.token_hex(12)
        self.resolver = '__sb_reply_' + secrets.token_hex(12)
        self.script = (VENDOR/'website.js').read_text().replace('__BINDING__', self.binding).replace('__RESOLVER__', self.resolver)
        # Game Mode's top window hosts Decky: navigating it would destroy Steam UI.
        self.script += (Path(__file__).parent/'catalog-links.js').read_text().replace('__NAV__', json.dumps(self.navigation_binding))
        self.sessions = set()
        self.contexts = {}
        self.scripts = {}

    async def watch(self, session):
        if session in self.sessions:
            return
        self.sessions.add(session)
        await self.cdp.send('Runtime.addBinding', {'name': self.binding}, session)
        await self.cdp.send('Runtime.addBinding', {'name': self.navigation_binding}, session)
        result = await self.cdp.send('Page.addScriptToEvaluateOnNewDocument', {'source': self.script}, session)
        self.scripts[session] = result['identifier']
        await self.cdp.send('Runtime.enable', session=session)

    async def event(self, message):
        session = message.get('sessionId')
        if session not in self.sessions:
            return
        params = message.get('params', {})
        method = message['method']
        if method == 'Runtime.executionContextCreated':
            context = params['context']
            if context.get('auxData', {}).get('isDefault') and trusted_origin(context.get('origin')):
                self.contexts[(session, context['id'])] = set()
                await self.cdp.evaluate(self.script, session, context['id'])
        elif method == 'Runtime.executionContextDestroyed':
            self.contexts.pop((session, params['executionContextId']), None)
        elif method == 'Runtime.executionContextsCleared':
            self.forget(session)
        elif method == 'Runtime.bindingCalled' and params.get('name') == self.binding:
            await self.receive(session, params['executionContextId'], params.get('payload'))
        elif method == 'Runtime.bindingCalled' and params.get('name') == self.navigation_binding:
            url = params.get('payload')
            if ((session, params['executionContextId']) in self.contexts and self.navigate
                and isinstance(url, str) and re.fullmatch(r'https://store\.steampowered\.com/app/[0-9]+(?:/[^\s]*)?', url)):
                await self.navigate(url)

    def forget(self, session):
        for key in list(self.contexts):
            if key[0] == session:
                self.contexts.pop(key, None)

    async def receive(self, session, context_id, payload):
        key = session, context_id
        pending = self.contexts.get(key)
        if pending is None or not isinstance(payload, str) or len(payload) > 16384:
            return
        try:
            request = json.loads(payload)
        except ValueError:
            return
        if not isinstance(request, dict):
            return
        request_id = request.get('id')
        if type(request_id) is not int or not 0 < request_id <= 9007199254740991 or request_id in pending or len(pending) >= 32:
            return
        pending.add(request_id)
        try:
            delegate, args = host_call(request.get('method'), request.get('args'))
            result = await asyncio.wait_for(self.invoke(delegate, args), 44)
            response = {'id': request_id, 'ok': True, 'result': result}
        except Exception as error:
            response = {'id': request_id, 'ok': False, 'error': 'status unknown; do not retry automatically' if isinstance(error, TimeoutError) else str(error)}
        finally:
            pending.discard(request_id)
        if self.contexts.get(key) is not pending or self.cdp.closed:
            return
        try:
            await self.cdp.evaluate(f'globalThis[{json.dumps(self.resolver)}]?.({json.dumps(response)})', session, context_id, timeout=5)
        except (RuntimeError, ConnectionError, TimeoutError):
            pass

    async def close(self):
        contexts = list(self.contexts)
        self.contexts.clear()
        for session, context in contexts:
            try:
                await self.cdp.evaluate('globalThis.SteamBooster?.__dispose?.(); delete globalThis.SteamBooster; globalThis.__sb_decky_links?.();', session, context, timeout=2)
            except Exception:
                pass
        for session, script_id in self.scripts.items():
            try:
                await self.cdp.send('Page.removeScriptToEvaluateOnNewDocument', {'identifier': script_id}, session, timeout=2)
                await self.cdp.send('Runtime.removeBinding', {'name': self.binding}, session, timeout=2)
                await self.cdp.send('Runtime.removeBinding', {'name': self.navigation_binding}, session, timeout=2)
            except Exception:
                pass
        self.sessions.clear()
        self.scripts.clear()
