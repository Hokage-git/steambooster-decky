"""Bounded CDP transport with flattened target sessions and one reader."""
import asyncio
import json
from urllib.parse import urlsplit
from aiohttp import WSMsgType


class CDP:
    def __init__(self, socket):
        self.socket = socket
        self.events = asyncio.Queue(maxsize=1024)
        self.pending = {}
        self.sequence = 0
        self.closed = False
        self.reader = asyncio.create_task(self._read())

    @classmethod
    async def connect(cls, http, url):
        parsed = urlsplit(url)
        if parsed.scheme != 'ws' or parsed.hostname not in {'127.0.0.1', 'localhost', '::1'} or parsed.username or parsed.password:
            raise ValueError('CDP must use a local websocket')
        socket = await asyncio.wait_for(http.ws_connect(url, max_msg_size=8*1024*1024), 10)
        return cls(socket)

    @property
    def pending_count(self):
        return len(self.pending)

    async def send(self, method, params=None, session=None, timeout=None):
        if self.closed:
            raise ConnectionError('Steam disconnected')
        if len(self.pending) >= 128:
            raise RuntimeError('too many CDP requests')
        self.sequence += 1
        request_id = self.sequence
        future = asyncio.get_running_loop().create_future()
        self.pending[request_id] = future
        message = {'id': request_id, 'method': method, 'params': params or {}}
        if session:
            message['sessionId'] = session
        try:
            await self.socket.send_json(message)
            return await asyncio.wait_for(future, timeout if timeout is not None else (45 if method == 'Runtime.evaluate' else 5))
        finally:
            self.pending.pop(request_id, None)
            if not future.done():
                future.cancel()

    async def attach(self, target_id):
        return (await self.send('Target.attachToTarget', {'targetId': target_id, 'flatten': True}))['sessionId']

    async def evaluate(self, expression, session, context=None, timeout=None):
        params = {'expression': expression, 'returnByValue': True, 'awaitPromise': True, 'includeCommandLineAPI': True}
        if context is not None:
            params['contextId'] = context
        result = await self.send('Runtime.evaluate', params, session, timeout)
        if result.get('exceptionDetails'):
            details = result['exceptionDetails']
            raise RuntimeError(details.get('exception', {}).get('description', details.get('text', 'JavaScript call failed')))
        return result.get('result', {}).get('value')

    def _fail_pending(self):
        self.closed = True
        for future in list(self.pending.values()):
            if not future.done():
                future.set_exception(ConnectionError('Steam disconnected'))

    async def _read(self):
        try:
            async for message in self.socket:
                if message.type != WSMsgType.TEXT:
                    break
                data = json.loads(message.data)
                if 'id' in data:
                    future = self.pending.get(data['id'])
                    if future and not future.done():
                        if 'error' in data:
                            future.set_exception(RuntimeError(data['error'].get('message', 'CDP error')))
                        else:
                            future.set_result(data.get('result', {}))
                elif 'method' in data:
                    self.events.put_nowait(data)
        except (asyncio.QueueFull, ValueError, ConnectionError):
            pass
        finally:
            self._fail_pending()

    async def close(self):
        self._fail_pending()
        self.reader.cancel()
        await self.socket.close()
        await asyncio.gather(self.reader, return_exceptions=True)
