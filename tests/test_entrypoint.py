import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]

class EntryPointTests(unittest.TestCase):
    def test_imports_under_decky_loader_without_workspace_on_sys_path(self):
        with tempfile.TemporaryDirectory() as temporary:
            Path(temporary,'settings.json').write_text('{"enabled":false}')
            code='''import asyncio, importlib.util, sys, types
sys.modules['decky']=types.SimpleNamespace(DECKY_PLUGIN_SETTINGS_DIR=sys.argv[2])
spec=importlib.util.spec_from_file_location('plugin',sys.argv[1])
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
async def check():
 p=module.Plugin();await p._main();assert (await p.get_status())['phase']=='disabled';await p._unload()
asyncio.run(check())
'''
            result=subprocess.run([sys.executable,'-I','-c',code,str(ROOT/'main.py'),temporary],cwd=temporary,capture_output=True,text=True)
            self.assertEqual(result.returncode,0,result.stderr)
