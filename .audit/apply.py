"""Final tablet header refinement and accurate occupied-seat browser assertion."""
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
p=ROOT/'App/visual-refresh.css';s=p.read_text()
old=' #pokdle-app.design-refresh > header #global-nav { order:3; flex:1 0 100%; width:100%; min-width:0; justify-content:center; }\n #pokdle-app.design-refresh > header .header-actions { margin-left:auto; min-width:0; max-width:100%; flex-wrap:wrap; }'
new=''' #pokdle-app.design-refresh > header #global-nav { display:flex !important; flex-wrap:wrap; order:3; flex:1 0 100%; width:100%; min-width:0; justify-content:center; gap:4px; }
 #pokdle-app.design-refresh > header #global-nav .nav-pill { width:auto !important; flex:0 0 auto !important; }
 #pokdle-app.design-refresh > header .header-actions { width:auto !important; flex:0 1 auto !important; margin-left:auto; min-width:0; max-width:100%; flex-wrap:wrap; gap:8px !important; }
 #pokdle-app.design-refresh > header #global-xp-badge { flex:0 1 220px !important; min-width:0 !important; max-width:220px !important; }
'''
if old in s:s=s.replace(old,new,1)
elif new not in s:raise RuntimeError('Missing tablet header owner')
p.write_text(s,encoding='utf-8')
# The roster includes an invitation placeholder; count players, not vacant-seat placeholders.
p=ROOT/'tools/multiplayer_quality.py';s=p.read_text().replace("#party-players li'", "#party-players li:not(.party-player-empty)'");p.write_text(s,encoding='utf-8')
p=ROOT/'tools/browser_quality.py';s=p.read_text()
if 'def header_density()' not in s:
 s=s.replace("    check('home-dark',dark)",'''    check('home-dark',dark)
    def header_density():
     rect=page.locator('body > header').bounding_box()
     if width>640: expect(rect is not None and rect['height']<=180,f'Header takes too much space: {rect}')
     return rect
    check('header-density',header_density,False)''')
p.write_text(s,encoding='utf-8')
print('Tablet navigation refined; occupied-player roster assertion corrected.')
