import asyncio
import tempfile
import unittest
from pathlib import Path
from unittest.mock import AsyncMock

class FrameTests(unittest.IsolatedAsyncioTestCase):
    async def test_cross_process_frame_gets_bindings_before_resume(self):
        from backend.runtime import Runtime
        from backend.website import Website
        with tempfile.TemporaryDirectory() as tmp:
            r=Runtime(Path(tmp))
            r.cdp=type('CDP',(),{'closed':False,'send':AsyncMock(return_value={'identifier':'init'}),'evaluate':AsyncMock(),'events':asyncio.Queue()})()
            r.website=Website(r.cdp,AsyncMock())
            task=asyncio.create_task(r.events())
            await r.cdp.events.put({'method':'Target.attachedToTarget','sessionId':'main','params':{'sessionId':'child','targetInfo':{'type':'iframe','targetId':'child-id'},'waitingForDebugger':True}})
            for _ in range(20): await asyncio.sleep(0)
            task.cancel();await asyncio.gather(task,return_exceptions=True)
            calls=r.cdp.send.call_args_list
            methods=[c.args[0] for c in calls]
            self.assertIn('Runtime.addBinding',methods)
            self.assertIn('Page.addScriptToEvaluateOnNewDocument',methods)
            self.assertIn('Runtime.runIfWaitingForDebugger',methods)
            self.assertLess(methods.index('Page.addScriptToEvaluateOnNewDocument'),methods.index('Runtime.runIfWaitingForDebugger'))

    async def test_context_failure_does_not_stop_discovery(self):
        from backend.runtime import Runtime
        with tempfile.TemporaryDirectory() as tmp:
            r=Runtime(Path(tmp))
            r.cdp=type('CDP',(),{'closed':False,'events':asyncio.Queue()})()
            r.website=type('Website',(),{'event':AsyncMock(side_effect=[RuntimeError('context navigated'),None])})()
            task=asyncio.create_task(r.events())
            for context in (1,2):
                await r.cdp.events.put({'method':'Runtime.executionContextCreated','sessionId':'main','params':{'context':{'id':context,'origin':'https://steambalance.cc','auxData':{'isDefault':True}}}})
            for _ in range(20): await asyncio.sleep(0)
            task.cancel();await asyncio.gather(task,return_exceptions=True)
            self.assertIn(('main',2),r.frames)
