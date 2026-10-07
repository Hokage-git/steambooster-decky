import json
import tempfile
import unittest
from pathlib import Path

class RuntimeTests(unittest.IsolatedAsyncioTestCase):
    def test_owner_conflict(self):
        from backend.runtime import can_claim
        self.assertTrue(can_claim({'sb': False, 'relay': False, 'owner': None}, 'ours'))
        self.assertTrue(can_claim({'sb': True, 'owner': 'ours'}, 'ours'))
        self.assertFalse(can_claim({'sb': True, 'owner': None}, 'ours'))
        self.assertFalse(can_claim({'relay': True, 'owner': None}, 'ours'))
        self.assertFalse(can_claim({'sb': True, 'owner': 'other'}, 'ours'))

    def test_filters_ui_without_blocking_account_relay(self):
        from backend.runtime import UI_KINDS
        self.assertIn('attach-popup', UI_KINDS)
        self.assertIn('external-window-open', UI_KINDS)
        self.assertNotIn('get-inventory', UI_KINDS)
        self.assertNotIn('activate-product-key', UI_KINDS)

    async def test_disabled_has_no_runner(self):
        from backend.runtime import Runtime
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            (root/'settings.json').write_text('{"enabled":false}')
            runtime = Runtime(root)
            await runtime.start()
            self.assertIsNone(runtime.task)
            self.assertEqual(runtime.state['phase'], 'disabled')
            await runtime.stop()

    async def test_country_persistence_and_validation(self):
        from backend.runtime import Runtime
        with tempfile.TemporaryDirectory() as temporary:
            runtime = Runtime(Path(temporary))
            result = await runtime.native({'op':'set_store_country','args':{'steamId':'76561198000000000','country':'RU'}})
            self.assertTrue(result['ok'])
            result = await runtime.native({'op':'get_store_country','args':{'steamId':'76561198000000000'}})
            self.assertEqual(result['result'], {'country':'RU'})
            self.assertEqual(json.loads((Path(temporary)/'countries.json').read_text()), {'76561198000000000':'RU'})
            result = await runtime.native({'op':'set_store_country','args':{'steamId':'../bad','country':'RU'}})
            self.assertFalse(result['ok'])

    async def test_network_requires_known_plugin_token(self):
        from backend.runtime import Runtime
        with tempfile.TemporaryDirectory() as temporary:
            runtime = Runtime(Path(temporary))
            result = await runtime.native({'op':'net_fetch','pluginId':'booster-checkout','token':'fake','args':{'url':'https://steambalance.cc'}})
            self.assertFalse(result['ok'])

    async def test_unload_cancels_retry(self):
        from backend.runtime import Runtime
        with tempfile.TemporaryDirectory() as temporary:
            runtime = Runtime(Path(temporary))
            await runtime.start()
            task = runtime.task
            await runtime.stop()
            self.assertTrue(task.done())
            self.assertIsNone(runtime.task)

    async def test_worker_limit(self):
        from backend.runtime import Runtime
        import asyncio
        with tempfile.TemporaryDirectory() as temporary:
            runtime=Runtime(Path(temporary))
            gate=asyncio.Event()
            for _ in range(300): runtime.spawn(gate.wait())
            self.assertLessEqual(len(runtime.workers),256)
            await runtime.cleanup()

    async def test_failed_plugin_not_reported_ready(self):
        from backend.runtime import Runtime
        class FailedCDP:
            async def evaluate(self,*_,**__):
                return [{'pluginId':'booster-checkout','ok':False,'error':'failed'}]
        with tempfile.TemporaryDirectory() as temporary:
            runtime=Runtime(Path(temporary))
            runtime.cdp=FailedCDP()
            with self.assertRaisesRegex(RuntimeError,'plugin'):
                await runtime.wait_plugins('main',['booster-checkout'])

    async def test_deck_store_messages_use_existing_checkout_with_validated_framework_token(self):
        from backend.runtime import Runtime
        from unittest.mock import AsyncMock
        with tempfile.TemporaryDirectory() as temporary:
            r=Runtime(Path(temporary))
            r.cdp=type('CDP',(),{'evaluate':AsyncMock()})()
            r.bus_targets={('main',None)}
            r.secrets={'frameworkToken':'session-token'}
            r.entries=[{'id':'decky-store'}]
            for action,field in [('request','appid'),('purchase','itemId')]:
                request={'op':'bus.publish','pluginId':'booster-framework','token':'session-token','args':{'topic':'decky-store.keys.'+action,'data':{'reqId':'test',field:570}}}
                result=await r.native(request)
                self.assertTrue(result['ok'])
                self.assertIn('booster-addfunds.keys.'+action,r.cdp.evaluate.call_args.args[0])
                before=r.cdp.evaluate.call_count
                request['token']='wrong'
                self.assertFalse((await r.native(request))['ok'])
                self.assertEqual(r.cdp.evaluate.call_count,before)

    async def test_catalog_email_purchase_correlates_one_checkout_request(self):
        from backend.runtime import Runtime
        from unittest.mock import AsyncMock
        import asyncio,json
        with tempfile.TemporaryDirectory() as temporary:
            r=Runtime(Path(temporary));r.main_session='main';r.secrets={'frameworkToken':'secret'}
            r.cdp=type('CDP',(),{'closed':False,'evaluate':AsyncMock()})();r.bus_targets=set()
            task=asyncio.create_task(r.invoke('keysPurchaseEmail',[41,'Test','buyer@example.com']))
            await asyncio.sleep(0)
            self.assertEqual(r.cdp.evaluate.call_count,1)
            expression=r.cdp.evaluate.call_args.args[0]
            self.assertIn('booster-addfunds.keys.purchase',expression)
            data=json.loads(expression.split(',',1)[1].removesuffix(')'))
            self.assertEqual(data['email'],'buyer@example.com')
            await r.native({'op':'bus.publish','pluginId':'booster-framework','token':'wrong','args':{'topic':'booster-checkout.keys.purchase-result','data':{'reqId':data['reqId'],'ok':True}}})
            self.assertFalse(task.done())
            await r.native({'op':'bus.publish','pluginId':'booster-framework','token':'secret','args':{'topic':'booster-checkout.keys.purchase-result','data':{'reqId':data['reqId'],'ok':True}}})
            self.assertTrue((await task)['ok'])
            self.assertFalse(r.key_purchases)

    async def test_cancelled_catalog_waiter_is_removed_without_resending(self):
        from backend.runtime import Runtime
        from unittest.mock import AsyncMock
        import asyncio
        with tempfile.TemporaryDirectory() as temporary:
            r=Runtime(Path(temporary));r.main_session='main'
            r.cdp=type('CDP',(),{'closed':False,'evaluate':AsyncMock()})()
            task=asyncio.create_task(r.invoke('keysPurchaseEmail',[41,'Test','buyer@example.com']))
            await asyncio.sleep(0)
            self.assertEqual(len(r.key_purchases),1)
            task.cancel()
            await asyncio.gather(task,return_exceptions=True)
            self.assertFalse(r.key_purchases)
            self.assertEqual(r.cdp.evaluate.call_count,1)
