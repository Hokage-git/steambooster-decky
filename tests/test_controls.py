import tempfile
import unittest
from pathlib import Path

class ControlsTests(unittest.IsolatedAsyncioTestCase):
    async def test_refuses_arbitrary_action(self):
        from backend.runtime import Runtime
        with tempfile.TemporaryDirectory() as temporary:
            runtime = Runtime(Path(temporary))
            with self.assertRaises(ValueError):
                await runtime.browser_action('sb-decky:test', 'eval', 'alert(1)')

    async def test_requires_own_frame_name(self):
        from backend.runtime import Runtime
        with tempfile.TemporaryDirectory() as temporary:
            runtime = Runtime(Path(temporary))
            with self.assertRaises(ValueError):
                await runtime.browser_action('Steam', 'read')
