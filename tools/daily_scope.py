"""Select focused daily QA when the whole diff belongs to that journey."""
import os,re,subprocess
base=os.environ.get('QA_BASE') or 'HEAD^'
paths=subprocess.check_output(['git','diff','--name-only',base,'HEAD'],text=True).splitlines()
allowed=re.compile(r'^(App/(lib/daily[^/]*\.js|test/daily[^/]*\.test\.js|src/script\.10[opq]\.[^/]+\.js|src/script\.10g\.leaderboard-v2\.js|server\.js|index\.html|build\.mjs|(?:challenge|dossier|wordle)\.css)|tools/(?:daily_scope|challenge_quality|dossier_quality|wordle_quality)\.py|docs/daily[^/]*\.md|\.github/workflows/browser-quality\.yml)$')
focused=bool(paths) and any('daily-' in p or 'challenge' in p for p in paths) and all(allowed.match(p) for p in paths)
with open(os.environ['GITHUB_OUTPUT'],'a') as out:out.write('focused='+str(focused).lower()+'\n')
print('QA scope:', 'Daily journey only' if focused else 'Whole application')
