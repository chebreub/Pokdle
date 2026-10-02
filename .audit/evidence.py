"""Temporary workbench evidence export. No production data is used."""
from pathlib import Path
import base64,json,subprocess
from PIL import Image
root=Path(__file__).resolve().parents[1];out=root/'quality-artifacts';doc=root/'docs/qa';doc.mkdir(parents=True,exist_ok=True)
summary={}
for phase in ['before','after']:
 p=out/phase/'report.json'
 if p.exists():summary[phase]=json.loads(p.read_text())
audit=subprocess.run(['npm','audit','--json'],cwd=root/'App',capture_output=True,text=True)
try:
 raw=json.loads(audit.stdout);summary['dependencies']={'counts':raw.get('metadata',{}).get('vulnerabilities',{}),'findings':{k:{'severity':v.get('severity'),'range':v.get('range'),'fixAvailable':v.get('fixAvailable'),'via':[x if isinstance(x,str) else {'title':x.get('title'),'url':x.get('url'),'range':x.get('range')} for x in v.get('via',[])]} for k,v in raw.get('vulnerabilities',{}).items()}}
 (out/'dependency-audit.json').write_text(audit.stdout)
except Exception:summary['dependencies']={'error':audit.stdout[:200]}
(doc/'workbench.json').write_text(json.dumps(summary,indent=2),encoding='utf-8')
for name in ['1366-home-completed','1366-catalog','390-collection-back']:
 p=out/'after'/(name+'.png')
 if not p.exists():continue
 image=Image.open(p).convert('RGB');image.thumbnail((560,720));target=out/(name+'-preview.jpg');image.save(target,quality=35,optimize=True)
 (doc/(name+'.b64')).write_text(base64.b64encode(target.read_bytes()).decode('ascii'))
for phase in ['before','after']:
 if phase in summary:print('EVIDENCE',phase,summary[phase]['passed'],'passed',summary[phase]['failed'],'failed',flush=True)
print('DEPENDENCIES',json.dumps(summary['dependencies']),flush=True)
