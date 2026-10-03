#!/usr/bin/env python3
"""Build a deterministic ZIP with Decky's required single-root layout."""
import argparse
import hashlib
import json
from pathlib import Path
import zipfile

ROOT = Path(__file__).resolve().parents[1]


def build(output_dir):
    output_dir=Path(output_dir)
    output_dir.mkdir(parents=True,exist_ok=True)
    version=json.loads((ROOT/'package.json').read_text())['version']
    archive=output_dir/f'SteamBooster-Decky-v{version}.zip'
    files=[ROOT/name for name in ['main.py','package.json','plugin.json','LICENSE','README.md','THIRD_PARTY_NOTICES.md']]
    files.extend([ROOT/'dist/index.js'])
    for directory in ['backend','vendor','patches']:
        files.extend(p for p in (ROOT/directory).rglob('*') if p.is_file() and '__pycache__' not in p.parts and p.suffix!='.pyc')
    manifest=json.loads((ROOT/'vendor/manifest.json').read_text())
    for name,digest in manifest['sha256'].items():
        if hashlib.sha256((ROOT/'vendor'/name).read_bytes()).hexdigest()!=digest:
            raise RuntimeError('vendor hash mismatch: '+name)
    with zipfile.ZipFile(archive,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=9) as bundle:
        for path in sorted(files):
            payload=path.read_bytes()
            if b'/home/maksimg' in payload:
                raise RuntimeError('local workspace path in package')
            info=zipfile.ZipInfo('steambooster-decky/'+path.relative_to(ROOT).as_posix(),date_time=(2026,10,3,0,0,0))
            info.compress_type=zipfile.ZIP_DEFLATED
            info.external_attr=(0o100644<<16)
            bundle.writestr(info,payload,compress_type=zipfile.ZIP_DEFLATED,compresslevel=9)
    sums=output_dir/'SHA256SUMS'
    sums.write_text(f'{hashlib.sha256(archive.read_bytes()).hexdigest()}  {archive.name}\n')
    return archive,sums

if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--output-dir',type=Path,default=ROOT/'out')
    for path in build(parser.parse_args().output_dir): print(path)
