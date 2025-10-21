import sys
import json

data = json.load(sys.stdin)
if data['projects']:
    p = data['projects'][0]
    print('Available project fields:')
    for k in sorted(p.keys()):
        if k != 'scenes':
            print(f'  - {k}: {type(p[k]).__name__}')

    if 'scenes' in p and p['scenes']:
        print('\nAvailable scene fields:')
        scene = p['scenes'][0]
        for k in sorted(scene.keys()):
            print(f'  - {k}: {type(scene[k]).__name__}')
