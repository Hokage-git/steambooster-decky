import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from types import SimpleNamespace
import asyncio

class GenerationCDP:
    def __init__(self, marker=True, conflict=False):
        self.closed=False
        self.events=asyncio.Queue()
        self.marker=marker
        self.conflict=conflict
        self.calls=[]
    async def attach(self, target): return target
    async def evaluate(self, expression, session, context=None, timeout=None):
        self.calls.append((expression,session))
        if expression.startswith('({sb:'):
            return {'sb':self.conflict,'relay':False,'owner':None,'decky':session=='main' and self.marker}
        if expression == 'globalThis.__sb_relay_started === true':
            return False
        if '_pluginOutcomes?.map' in expression:
            return [{'pluginId': name, 'ok':True} for name in ['booster-checkout','booster-addfunds','booster-rateaccount']]
        if expression.startswith('(async()=>'):
            return {'steamId':'76561198000000000'}
        if 'return q.slice' in expression:
            return []
        return None
    async def send(self, method, params=None, session=None, timeout=None):
        self.calls.append((method,session))
        return {'identifier': session or 'script'}
    async def close(self): self.closed=True

class LifecycleTests(unittest.IsolatedAsyncioTestCase):
    async def make_runtime(self, temporary):
        from backend.runtime import Runtime
        runtime=Runtime(Path(temporary))
        async def targets():
            return [{'id':'shared','type':'page','title':'SharedJSContext','url':'about:blank','webSocketDebuggerUrl':'ws://127.0.0.1:8080/devtools/page/shared'}, {'id':'main','type':'page','title':'Steam Big Picture','url':'https://steamloopback.host/'}]
        runtime.targets=targets
        return runtime

    async def test_conflicting_owner_causes_no_injection(self):
        from backend.cdp import CDP
        cdp=GenerationCDP(conflict=True)
        with tempfile.TemporaryDirectory() as temporary:
            runtime=await self.make_runtime(temporary)
            with patch.object(CDP,'connect',return_value=cdp):
                with self.assertRaisesRegex(RuntimeError,'conflict:'):
                    await runtime.connect()
            self.assertFalse(any('__SB_PLUGINS_MANIFEST__ =' in expression for expression,_ in cdp.calls))
            await runtime.cleanup()
            self.assertTrue(cdp.closed)

    async def test_game_mode_marker_required_before_injection(self):
        from backend.cdp import CDP
        cdp=GenerationCDP(marker=False)
        with tempfile.TemporaryDirectory() as temporary:
            runtime=await self.make_runtime(temporary)
            with patch.object(CDP,'connect',return_value=cdp):
                with self.assertRaisesRegex(RuntimeError,'decky:'):
                    await runtime.connect()
            self.assertFalse(any('__SB_PLUGINS_MANIFEST__ =' in expression for expression,_ in cdp.calls))
            await runtime.cleanup()

    async def test_generation_injects_and_unloads_own_targets(self):
        from backend.cdp import CDP
        cdp=GenerationCDP()
        with tempfile.TemporaryDirectory() as temporary:
            runtime=await self.make_runtime(temporary)
            async def quick_sleep(_): await asyncio.get_running_loop().run_in_executor(None, lambda: None)
            with patch.object(CDP,'connect',return_value=cdp), patch('backend.runtime.asyncio.sleep', quick_sleep):
                with self.assertRaisesRegex(ConnectionError,'shared relay stopped'):
                    await runtime.connect()
            injected=[expression for expression,_ in cdp.calls if '__SB_PLUGINS_MANIFEST__ =' in expression]
            self.assertEqual(len(injected),2)
            self.assertTrue(any('__sb_decky_configure' in expression for expression,_ in cdp.calls))
            await runtime.cleanup()
            self.assertFalse(runtime.workers)
            self.assertFalse(runtime.bus_targets)
            self.assertIsNone(runtime.main_session)
            self.assertTrue(any('rollbackAll' in expression for expression,_ in cdp.calls))

    async def test_failed_bundle_rolls_back_claimed_context(self):
        from backend.runtime import VENDOR
        cdp=GenerationCDP()
        original=cdp.evaluate
        async def evaluate(expression, session, context=None, timeout=None):
            if expression == (VENDOR/'framework.js').read_text():
                raise RuntimeError('bundle failed')
            return await original(expression,session,context,timeout)
        cdp.evaluate=evaluate
        with tempfile.TemporaryDirectory() as temporary:
            runtime=await self.make_runtime(temporary)
            runtime.cdp=cdp
            with self.assertRaisesRegex(RuntimeError,'bundle failed'):
                await runtime.inject('main','main',[])
            await runtime.cleanup()
            self.assertTrue(any('rollbackAll' in expression for expression,_ in cdp.calls))

    async def test_decky_in_shared_context_is_injected_once_as_combined_main(self):
        from backend.cdp import CDP
        cdp=GenerationCDP()
        original=cdp.evaluate
        async def evaluate(expression, session, context=None, timeout=None):
            if expression.startswith('({sb:'):
                return {'sb':False,'relay':False,'owner':None,'decky':session=='shared'}
            return await original(expression,session,context,timeout)
        cdp.evaluate=evaluate
        with tempfile.TemporaryDirectory() as temporary:
            runtime=await self.make_runtime(temporary)
            async def quick_sleep(_): await asyncio.get_running_loop().run_in_executor(None, lambda: None)
            with patch.object(CDP,'connect',return_value=cdp), patch('backend.runtime.asyncio.sleep',quick_sleep):
                with self.assertRaisesRegex(ConnectionError,'shared relay stopped'):
                    await runtime.connect()
            injected=[expression for expression,_ in cdp.calls if '__SB_PLUGINS_MANIFEST__ =' in expression]
            self.assertEqual(len(injected),1)
            self.assertIn('"deckyCombined": true',injected[0])
            self.assertIn('"contextKind": "main"',injected[0])
            await runtime.cleanup()
