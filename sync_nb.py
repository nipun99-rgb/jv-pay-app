"""Sync the notebook Cell 6 to match run_cell6.py (add contractor inference, fix filename)"""
import json

with open('gc_app12_extractor.ipynb', encoding='utf-8') as f:
    nb = json.load(f)

cell = nb['cells'][6]
src = cell['source']

# Fix filename line (should have no backslash escapes)
for i, line in enumerate(src):
    if 'LINE_ITEMS_CSV_V4' in line and 'gc_app12_line_items_v' in line:
        src[i] = 'LINE_ITEMS_CSV_V4 = os.path.join(BASE_DIR, "gc_app12_line_items_v5.csv")\n'
        print('Fixed filename at line', i)
        break

with open('gc_app12_extractor.ipynb', 'w', encoding='utf-8') as f:
    json.dump(nb, f, indent=1, ensure_ascii=False)
print('Notebook saved.')
