import json
with open('gc_app12_plumber_nums.json') as f:
    data = json.load(f)
items = data['items']
print('Items 073-080:')
for item in items:
    ino_norm = item['item_no'].lstrip('0') or '0'
    if 73 <= int(ino_norm) <= 80:
        print('  Item %s: phase=%-20s desc=%-25s C_CURR=%10.0f D=%9.0f E=%9.0f G=%9.0f pct=%s' % (
            item['item_no'], item.get('phase','')[:20], item.get('description','')[:25],
            item.get('C_CURR',0), item.get('D',0), item.get('E',0), item.get('G',0), item.get('pct','')))
