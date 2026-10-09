"""Select focused daily QA when the whole diff belongs to that journey."""
import os,re,subprocess
base=os.environ.get('QA_BASE') or 'HEAD^'
paths=subprocess.check_output(['git','diff','--name-only',base,'HEAD'],text=True).splitlines()
allowed=re.compile(r'^(App/(lib/daily[^/]*\.js|test/daily[^/]*\.test\.js|src/script\.10[opqr]\.[^/]+\.js|src/script\.10g\.leaderboard-v2\.js|server\.js|index\.html|build\.mjs|(?:challenge|dossier|wordle)\.css)|tools/(?:daily_scope|challenge_quality|dossier_quality|wordle_quality)\.py|docs/daily[^/]*\.md|\.github/workflows/browser-quality\.yml)$')
maintenance_extra={'App/src/script.01.core.js','App/src/script.04.jeu-pokedex.js','App/src/script.07.delegation-party.js','App/src/script.10i.weekly-league.js','App/src/script.10s.daily-home.js','App/test/weekly-league.test.js','tools/daily_maintenance_quality.py','docs/step1-maintenance.md'}
maintenance='App/test/daily-maintenance.test.js' in paths and all(allowed.match(p) or p in maintenance_extra for p in paths)
focused=maintenance or (bool(paths) and any('daily-' in p or 'challenge' in p for p in paths) and all(allowed.match(p) for p in paths))
with open(os.environ['GITHUB_OUTPUT'],'a') as out:out.write('focused='+str(focused).lower()+'\nmaintenance='+str(maintenance).lower()+'\n')
print('QA scope:', 'Daily journey only' if focused else 'Whole application')
