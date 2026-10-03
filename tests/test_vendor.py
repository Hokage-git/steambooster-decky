import hashlib
import json
import unittest
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]

class VendorTests(unittest.TestCase):
    def test_pinned_assets(self):
        manifest = json.loads((ROOT / 'vendor/manifest.json').read_text())
        self.assertEqual(manifest['commit'], '0b462bb853acb54540c1d65a68cac2f6061f9e06')
        for name, digest in manifest['sha256'].items():
            self.assertEqual(hashlib.sha256((ROOT/'vendor'/name).read_bytes()).hexdigest(), digest, name)
        self.assertEqual(len(manifest['plugins']), 3)
        self.assertNotIn('/home/', (ROOT/'vendor/bootstrap.js').read_text())
