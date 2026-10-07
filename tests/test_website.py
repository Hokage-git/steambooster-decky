import asyncio
import json
import unittest

class FakeCDP:
    closed = False
    def __init__(self):
        self.calls = []
    async def evaluate(self, expression, session, context=None, timeout=None):
        self.calls.append((expression, session, context))

class WebsiteTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        from backend.website import Website
        self.cdp = FakeCDP()
        self.invoked = []
        async def invoke(delegate, args):
            self.invoked.append((delegate, args))
            return {'steamId': '76561198000000000'}
        self.host = Website(self.cdp, invoke)
        self.host.sessions.add('web')

    async def create(self, origin='https://steambalance.cc'):
        await self.host.event({'method': 'Runtime.executionContextCreated', 'sessionId': 'web', 'params': {'context': {'id': 7, 'origin': origin, 'auxData': {'isDefault': True}}}})

    async def receive(self, request_id=1):
        await self.host.receive('web', 7, json.dumps({'id': request_id, 'method': 'getSteamId', 'args': []}))

    async def test_trusted_frame(self):
        await self.create()
        await self.receive()
        self.assertEqual(self.invoked, [('hostAccount', ['getSteamId'])])
        self.assertIn('"ok": true', self.cdp.calls[-1][0])

    async def test_untrusted_frame_rejected(self):
        await self.create('https://steambalance.cc.evil.test')
        await self.receive()
        self.assertEqual(self.invoked, [])
        self.assertEqual(self.cdp.calls, [])

    async def test_reply_dropped_after_navigation(self):
        await self.create()
        started, release = asyncio.Event(), asyncio.Event()
        async def invoke(*_):
            started.set()
            await release.wait()
            return 5
        self.host.invoke = invoke
        before = len(self.cdp.calls)
        task = asyncio.create_task(self.receive())
        await started.wait()
        await self.host.event({'method': 'Runtime.executionContextsCleared', 'sessionId': 'web', 'params': {}})
        release.set()
        await task
        self.assertEqual(len(self.cdp.calls), before)

    async def test_duplicate_pending_request_rejected(self):
        await self.create()
        started, release = asyncio.Event(), asyncio.Event()
        calls = []
        async def invoke(*_):
            calls.append(1)
            started.set()
            await release.wait()
        self.host.invoke = invoke
        task = asyncio.create_task(self.receive())
        await started.wait()
        await self.receive()
        release.set()
        await task
        self.assertEqual(calls, [1])

    async def test_invalid_payload(self):
        await self.create()
        for payload in ['null', '{}', '[]', 'x'*16385, '{"id":true}', '{"id":-1}']:
            await self.host.receive('web', 7, payload)
        self.assertEqual(self.invoked, [])

    async def test_catalog_store_navigation_uses_host_not_top_window(self):
        await self.create()
        navigated = []
        async def navigate(url): navigated.append(url)
        self.host.navigate = navigate
        await self.host.event({'method':'Runtime.bindingCalled','sessionId':'web','params':{'name':self.host.navigation_binding,'executionContextId':7,'payload':'https://store.steampowered.com/app/1245620/'}})
        self.assertEqual(navigated, ['https://store.steampowered.com/app/1245620/'])
        await self.host.event({'method':'Runtime.bindingCalled','sessionId':'web','params':{'name':self.host.navigation_binding,'executionContextId':7,'payload':'https://evil.test/'}})
        self.assertEqual(len(navigated), 1)

    async def test_store_actions_only_from_live_store_context(self):
        actions=[]
        async def action(name): actions.append(name)
        self.host.store_action=action
        await self.create('https://store.steampowered.com')
        self.assertIn('sb-decky-store-tools',self.cdp.calls[-1][0])
        async def press(name='catalog', context=7):
            await self.host.event({'method':'Runtime.bindingCalled','sessionId':'web','params':{'name':self.host.store_binding,'executionContextId':context,'payload':name}})
        await press()
        await press('valuation')
        await press('topup')
        await press('arbitrary')
        await press(context=99)
        self.assertEqual(actions,['catalog','valuation','topup'])
        await self.host.event({'method':'Runtime.executionContextDestroyed','sessionId':'web','params':{'executionContextId':7}})
        await press()
        self.assertEqual(len(actions),3)
