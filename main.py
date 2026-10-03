"""Decky Python entry point; no root flag or external service needed."""
from pathlib import Path
import sys
import decky
# Decky loads main.py by file path and only adds py_modules automatically.
sys.path.insert(0, str(Path(__file__).resolve().parent))
from backend.runtime import Runtime


class Plugin:
    async def _main(self):
        self.runtime = Runtime(Path(decky.DECKY_PLUGIN_SETTINGS_DIR))
        await self.runtime.start()

    async def _unload(self):
        if hasattr(self, 'runtime'):
            await self.runtime.stop()

    async def _uninstall(self):
        await self._unload()

    async def get_status(self):
        if not hasattr(self, 'runtime'):
            return {'phase':'connecting','message':'Запуск плагина','steamId':None,'enabled':True}
        return dict(self.runtime.state)

    async def set_enabled(self, enabled):
        return await self.runtime.set_enabled(enabled)

    async def reconnect(self):
        return await self.runtime.reconnect()

    async def browser_action(self, frame_name, action, value=''):
        return await self.runtime.browser_action(frame_name, action, value)
