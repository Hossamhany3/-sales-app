
import json, sys

with open('app_fixed.html', 'r', encoding='utf-8') as f:
    c = f.read()

with open('_replacements.json', 'r', encoding='utf-8') as f:
    replacements = json.load(f)

results = []
for old, new in replacements:
    if old in c:
        c = c.replace(old, new, 1) if not old.startswith('__MANY__') else c.replace(old.replace('__MANY__',''), new)
        results.append(f'OK: replaced')
    else:
        results.append(f'MISS: not found - {old[:60]}...')

with open('app_fixed.html', 'w', encoding='utf-8') as f:
    f.write(c)

for r in results:
    print(r)
print('DONE')
