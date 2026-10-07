import unittest

class PolicyTests(unittest.TestCase):
    def test_exact_origin(self):
        from backend.policy import trusted_origin
        self.assertTrue(trusted_origin('https://steambalance.cc'))
        for value in ['https://steambalance.cc.evil.test', 'http://steambalance.cc', 'https://steambalance.cc:443', 'null']:
            self.assertFalse(trusted_origin(value))

    def test_routes(self):
        from backend.policy import host_call
        self.assertEqual(host_call('getSteamId', []), ('hostAccount', ['getSteamId']))
        self.assertEqual(host_call('getRateAccountData', []), ('rateAccountData', []))
        self.assertEqual(host_call('purchaseKey', [5, {'gameName': 'Test'}]), ('keysPurchase', [5, 'Test']))
        self.assertEqual(host_call('purchaseKey', [5, {'gameName':'Test','email':'buyer@example.com'}]), ('keysPurchaseEmail',[5,'Test','buyer@example.com']))
        self.assertEqual(host_call('activateKey', ['ABC']), ('keysActivate', ['ABC']))
        self.assertEqual(host_call('getStoreCountry', ['76561198000000000']), ('hostAccount', ['getStoreCountry', '76561198000000000']))

    def test_bad_arguments(self):
        from backend.policy import host_call
        for method, args in [('purchaseKey', [True]), ('purchaseKey', [5, {'email':'bad'}]), ('purchaseKey', [5, {'email':'a@b.com\nheader'}]), ('purchaseKey', [-1]), ('purchaseKey', [1.2]), ('activateKey', ['']), ('activateKey', ['x'*257]), ('getStoreCountry', ['bad']), ('eval', [])]:
            with self.assertRaises(ValueError):
                host_call(method, args)

    def test_network_allowlist(self):
        from backend.policy import allowed_url
        self.assertTrue(allowed_url('https://steambalance.cc/api/payments', {'steambalance.cc'}))
        for url in ['http://steambalance.cc/api', 'https://steambalance.cc.evil.test', 'https://user:pass@steambalance.cc', 'https://steambalance.cc:8080/api']:
            self.assertFalse(allowed_url(url, {'steambalance.cc'}))
