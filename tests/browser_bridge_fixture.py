"""Isolated Chromium fixture: exercises production CDP discovery with fake account data."""
import asyncio
import sys
import tempfile
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from aiohttp import ClientSession
from backend.cdp import CDP
from backend.runtime import Runtime
from backend.website import Website

async def main():
    with tempfile.TemporaryDirectory() as tmp:
        async with ClientSession() as http:
            runtime=Runtime(Path(tmp))
            runtime.cdp=await CDP.connect(http,sys.argv[1])
            targets=(await runtime.cdp.send('Target.getTargets'))['targetInfos']
            target=next(t for t in targets if t['url']=='https://steamloopback.host/fixture')
            session=await runtime.cdp.attach(target['targetId'])
            async def invoke(delegate,args):
                if delegate=='hostAccount' and args==['getSteamId']:
                    return {'steamId':'76561198000000000'}
                if delegate=='keysPurchase':
                    return {'ok':False,'error':'no-email'}
                if delegate=='keysPurchaseEmail':
                    return {'ok':True,'emailReceived':args[2]}
                if delegate=='rateAccountData' and args==[]:
                    return {'account':{'steam_id':'76561198000000000'}, 'library':{'ready':True,'games':[{'appid':570}]}, 'inventory':{'partial':False,'items':[{'appid':570,'assetid':'test-item'}]}}
                raise ValueError('unsupported fixture method')
            runtime.website=Website(runtime.cdp,invoke)
            runtime.spawn(runtime.events())
            await runtime.website.watch(session)
            print('READY',flush=True)
            await asyncio.to_thread(sys.stdin.readline)
            await runtime.cleanup()

asyncio.run(main())
