"""Temporary workbench export; full-size captures remain in the CI artifact."""
from pathlib import Path
import base64,json,subprocess,textwrap
from PIL import Image
root=Path(__file__).resolve().parents[1];out=root/'quality-artifacts';doc=root/'docs/qa';doc.mkdir(parents=True,exist_ok=True)
summary={};compact={}
for phase in ['before','after','multiplayer']:
 p=out/phase/'report.json'
 if p.exists():
  data=json.loads(p.read_text());summary[phase]=data
  compact[phase]={k:v for k,v in data.items() if k!='cases'}
  if 'cases' in data:compact[phase]['failures']=[c for c in data['cases'] if not c['ok']]
audit=subprocess.run(['npm','audit','--json'],cwd=root/'App',capture_output=True,text=True,timeout=60)
try:
 raw=json.loads(audit.stdout);summary['dependencies']=raw;compact['dependencies']=raw.get('metadata',{}).get('vulnerabilities',{});(out/'dependency-audit.json').write_text(audit.stdout)
except Exception:compact['dependencies']={'error':audit.stdout[:200]}
(doc/'workbench.json').write_text(json.dumps(summary,indent=2),encoding='utf-8')
(doc/'summary.json').write_text(json.dumps(compact,indent=2),encoding='utf-8')
for name in ['1366-home-completed','1366-catalog','390-collection-back']:
 p=out/'after'/(name+'.png')
 if not p.exists():continue
 image=Image.open(p).convert('RGB');image.thumbnail((360,600));target=out/(name+'-preview.jpg');image.save(target,quality=18,optimize=True)
 (doc/(name+'.b64')).write_text('\n'.join(textwrap.wrap(base64.b64encode(target.read_bytes()).decode('ascii'),120)))
print('EVIDENCE_SUMMARY '+json.dumps(compact,ensure_ascii=True),flush=True)
