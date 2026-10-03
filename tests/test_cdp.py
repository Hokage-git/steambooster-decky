import asyncio
import unittest
from aiohttp import web, ClientSession


class CDPTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        async def handler(request):
            ws = web.WebSocketResponse()
            await ws.prepare(request)
            async for msg in ws:
                data = msg.json()
                if data['method'] == 'hold':
                    continue
                if data['method'] == 'event':
                    await ws.send_json({'method': 'Runtime.executionContextsCleared', 'sessionId': 'main', 'params': {}})
                if data['method'] == 'bad':
                    await ws.send_json({'id': data['id'], 'error': {'message': 'failed'}})
                else:
                    await ws.send_json({'id': data['id'], 'result': {'session': data.get('sessionId')}})
            return ws
        app = web.Application()
        app.router.add_get('/ws', handler)
        self.runner = web.AppRunner(app)
        await self.runner.setup()
        site = web.TCPSite(self.runner, '127.0.0.1', 0)
        await site.start()
        port = site._server.sockets[0].getsockname()[1]
        self.http = ClientSession()
        from backend.cdp import CDP
        self.cdp = await CDP.connect(self.http, f'ws://127.0.0.1:{port}/ws')

    async def asyncTearDown(self):
        if hasattr(self, 'cdp'):
            await self.cdp.close()
        await self.http.close()
        await self.runner.cleanup()

    async def test_correlates_sessions(self):
        a, b = await asyncio.gather(self.cdp.send('x', session='a'), self.cdp.send('x', session='b'))
        self.assertEqual((a['session'], b['session']), ('a', 'b'))

    async def test_events(self):
        await self.cdp.send('event')
        event = await asyncio.wait_for(self.cdp.events.get(), .2)
        self.assertEqual(event['sessionId'], 'main')

    async def test_timeout_removes_pending(self):
        with self.assertRaises(TimeoutError):
            await self.cdp.send('hold', timeout=.02)
        self.assertEqual(self.cdp.pending_count, 0)

    async def test_close_rejects_pending(self):
        task = asyncio.create_task(self.cdp.send('hold'))
        await asyncio.sleep(.01)
        await self.cdp.close()
        with self.assertRaises(ConnectionError):
            await task

    async def test_cdp_error(self):
        with self.assertRaisesRegex(RuntimeError, 'failed'):
            await self.cdp.send('bad')

    async def test_rejects_remote_socket(self):
        from backend.cdp import CDP
        for url in ['ws://example.com/ws', 'ws://127.0.0.1@evil.test/ws', 'wss://127.0.0.1/ws']:
            with self.assertRaises(ValueError):
                await CDP.connect(self.http, url)
