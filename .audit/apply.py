"""Last targeted source edits after visual review, before read-only PR CI."""
from pathlib import Path
import json,subprocess
ROOT=Path(__file__).resolve().parents[1]
p=ROOT/'App/visual-refresh.css';s=p.read_text()
old='#pokdle-app.design-refresh .club-pick-icon svg { width: 23px; height: 23px; }'
new='#pokdle-app.design-refresh .club-pick-icon svg { width: 23px; height: 23px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }'
if old in s:s=s.replace(old,new,1)
elif new not in s:raise RuntimeError('Missing owning SVG rule')
p.write_text(s,encoding='utf-8')
# qs remains pinned by transitive consumers after npm audit fix; keep major 6 and test the override.
p=ROOT/'App/package.json';d=json.loads(p.read_text());d.setdefault('overrides',{})['qs']='6.16.0';p.write_text(json.dumps(d,indent=2)+'\n')
subprocess.run(['npm','install','--package-lock-only','--ignore-scripts'],cwd=ROOT/'App',check=True,timeout=120)
subprocess.run(['npm','ci','--ignore-scripts'],cwd=ROOT/'App',check=True,timeout=120)
# Ensure browser assertions verify drawn icons, not merely their classes.
p=ROOT/'tools/browser_quality.py';s=p.read_text()
if 'def icon_strokes()' not in s:
 s=s.replace("    check('preview-layout',preview_layout,False)",'''    check('preview-layout',preview_layout,False)
    def icon_strokes():
     styles=page.locator('.club-pick-icon svg:visible').evaluate_all('(els)=>els.map(e=>({fill:getComputedStyle(e).fill,stroke:getComputedStyle(e).stroke}))')
     expect(len(styles)==3 and all(e['fill']=='none' and e['stroke']!='none' for e in styles),str(styles))
     return styles
    check('catalog-icons',icon_strokes,False)''')
# Let transient feedback finish for reference screenshots of the completed home, without changing app behavior.
s=s.replace("     return screen('screen-config')\n    check('home-completed',completed_home)","     page.wait_for_timeout(3500)\n     return screen('screen-config')\n    check('home-completed',completed_home)")
p.write_text(s,encoding='utf-8')
p=ROOT/'App/test/audit-reliability.test.js';s=p.read_text()
if "query parser override preserves" not in s:
 s+='''\ntest('query parser override preserves ordinary nested and array form data',()=>{\n const qs=require('qs');\n assert.deepEqual(qs.parse('room=ABCDE&gens[]=1&gens[]=9'),{room:'ABCDE',gens:['1','9']});\n assert.deepEqual(qs.parse('profile[name]=QA'),{profile:{name:'QA'}});\n assert.deepEqual(qs.parse(''),{});\n});\n'''
p.write_text(s,encoding='utf-8')
print('Final SVG rendering and qs compatibility fixes applied.')
