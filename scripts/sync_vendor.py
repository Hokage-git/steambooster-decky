#!/usr/bin/env python3
"""Import reproducibly built JS from the pinned Linux monorepo."""
import argparse
import hashlib
import json
from pathlib import Path
import re
import shutil
import subprocess

ROOT = Path(__file__).resolve().parents[1]
PIN = '0b462bb853acb54540c1d65a68cac2f6061f9e06'


def sync(source):
    commit = subprocess.check_output(['git', '-C', str(source), 'rev-parse', 'HEAD'], text=True).strip()
    if commit != PIN:
        raise RuntimeError(f'expected source commit {PIN}, got {commit}')
    framework = source/'source/booster-framework'
    plugins = source/'source/steambooster-plugins/packages'
    vendor = ROOT/'vendor'
    vendor.mkdir(exist_ok=True)
    shutil.copyfile(framework/'out/booster-framework.js', vendor/'framework.js')
    shutil.copyfile(framework/'LICENSE', vendor/'SteamBalance-LICENSE.txt')
    entries = []
    for name in ['booster-checkout', 'booster-addfunds', 'booster-rateaccount']:
        bundle, = (plugins/name/'out').glob(f'{name}-*.js')
        meta, = (plugins/name/'out').glob(f'{name}-*.meta.json')
        shutil.copyfile(bundle, vendor/f'{name}.js')
        shutil.copyfile(meta, vendor/f'{name}.meta.json')
        entries.append(json.loads(meta.read_text()))
    launcher = framework/'linux-launcher'
    source_text = (launcher/'src/index.ts').read_text()
    bootstrap = re.search(r'function buildBootstrapPrefix.*?return `(.*?)`;\n}', source_text, re.S).group(1)
    bootstrap = bootstrap.replace('${JSON.stringify(manifest)}', '__MANIFEST__')
    (vendor/'bootstrap.js').write_text(bootstrap)
    # JS serialization preserves the exact already-tested website API and link handler.
    bridge_uri = (launcher/'dist/website-bridge.js').as_uri()
    catalog_uri = (launcher/'dist/catalog-link-bridge.js').as_uri()
    program = (f"import {{websiteBridgeScript}} from {json.dumps(bridge_uri)};"
               f"import {{CATALOG_LINK_BRIDGE_SCRIPT}} from {json.dumps(catalog_uri)};"
               "process.stdout.write(websiteBridgeScript('__BINDING__','__RESOLVER__')+';'+CATALOG_LINK_BRIDGE_SCRIPT);")
    script = subprocess.check_output(['node', '--input-type=module', '-e', program], text=True)
    (vendor/'website.js').write_text(script)
    manifest = {'repository': 'https://github.com/Hokage-git/steambooster-linux', 'commit': commit, 'frameworkVersion': '1.0.2', 'plugins': entries,
                'sha256': {p.name: hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(vendor.iterdir()) if p.name != 'manifest.json'}}
    (vendor/'manifest.json').write_text(json.dumps(manifest, indent=2)+'\n')

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('source', type=Path, help='built steambooster-linux checkout at the pinned commit')
    sync(parser.parse_args().source.resolve())
