import hashlib
import tempfile
import unittest
import zipfile
from pathlib import Path

class ReleaseTests(unittest.TestCase):
    def test_installable_layout_and_checksum(self):
        from scripts.build_release import build
        with tempfile.TemporaryDirectory() as temporary:
            archive, sums = build(Path(temporary))
            with zipfile.ZipFile(archive) as bundle:
                names=set(bundle.namelist())
                for name in ['dist/index.js','main.py','plugin.json','package.json','LICENSE','backend/runtime.py','backend/browser-controls.js','backend/store-offers.js','backend/store-tools.js','backend/catalog-purchase.js','vendor/framework.js','vendor/manifest.json','README.md']:
                    self.assertIn('steambooster-decky/'+name,names)
                self.assertFalse(any('.venv' in name or '__pycache__' in name or 'node_modules' in name for name in names))
                self.assertIsNone(bundle.testzip())
            self.assertTrue(sums.read_text().startswith(hashlib.sha256(archive.read_bytes()).hexdigest()))
