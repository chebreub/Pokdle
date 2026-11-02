"""Social safety UI at phone and desktop sizes, with synthetic API fixtures only."""
import json
import os
import subprocess
import time
import urllib.request
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'quality-artifacts' / 'social-safety'


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    env = dict(os.environ, PORT='3198', DATABASE_URL='', DISCORD_CLIENT_ID='', DISCORD_CLIENT_SECRET='')
    log = (OUT / 'server.log').open('w')
    server = subprocess.Popen(['node', 'server.js'], cwd=ROOT / 'App', env=env, stdout=log, stderr=log)
    base = 'http://127.0.0.1:3198'
    results = []
    # Render the actual admin sections and CSS with synthetic reports/suspensions.
    admin_html = subprocess.check_output(['node', '-e', r'''
      const fs = require('fs'), chat = require('./App/lib/friend-chat');
      const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
      const css = fs.readFileSync('App/lib/admin-panel.js', 'utf8').match(/<style>([\s\S]*?)<\/style>/)[1];
      const reports = [{id:1, reporter_id:'A', reported_id:'B', reporter_name:'Alice', reported_name:'Bob', status:'open',
        created_at:'2026-11-02T12:00:00Z', excerpt:[{by:'reported', body:'Bonjour !', at:'2026-11-02T12:00:00Z'}]}];
      chat.suspensionSectionHtml({query:async()=>({rows:[{account_id:'B',username:'Bob',reason:'Signalement vérifié',until_at:null}]})},esc)
        .then(html=>process.stdout.write('<meta name="viewport" content="width=device-width,initial-scale=1"><style>'+css+'</style><main><h1>Panneau admin</h1>'+chat.adminSectionHtml(reports,esc)+html+'</main>'));
    '''], cwd=ROOT, text=True)
    try:
        for _ in range(80):
            try:
                urllib.request.urlopen(base, timeout=2).close()
                break
            except Exception:
                time.sleep(.25)
        else:
            raise RuntimeError('QA server did not start')
        with sync_playwright() as pw:
            browser = pw.chromium.launch()
            for width, height in [(390, 844), (1366, 900)]:
                context = browser.new_context(viewport=dict(width=width, height=height), has_touch=width < 640, reduced_motion='reduce')
                page = context.new_page()
                errors = []
                page.on('pageerror', lambda e: errors.append(str(e)))
                pid = 'bbbbbbbbbbbbbbbb'
                messages = [dict(id=1, mine=False, body='Bonjour ! On joue au quiz ?', at='2026-11-02T12:00:00Z')]
                thread = dict(ok=True, friends=True, canSend=True, messages=messages)
                reports = []
                page.route('**/api/chat/thread?*', lambda route: route.fulfill(json=thread))
                page.route('**/api/chat/report', lambda route: (reports.append(route.request.post_data_json), route.fulfill(json=dict(ok=True))))
                page.goto(base, wait_until='domcontentloaded')
                page.wait_for_function('typeof openFriendChat === "function" && typeof frPanelHtml === "function"')
                page.wait_for_function('!document.getElementById("app-splash") || getComputedStyle(document.getElementById("app-splash")).pointerEvents === "none"')
                page.evaluate("window.__pokedleAuthed = true; openFriendChat('bbbbbbbbbbbbbbbb', 'Bob')")
                expect(page.locator('#chat-msgs')).to_contain_text('Bonjour !')
                expect(page.locator('#chat-input')).to_be_enabled()
                # The other player removes the friendship while this window is open.
                thread.update(friends=False, canSend=False)
                page.evaluate('chatPoll()')
                expect(page.locator('#chat-input')).to_be_disabled()
                expect(page.locator('#chat-msgs')).to_contain_text('Bonjour !')
                page.locator('[data-action="chatMenu"]').click()
                expect(page.locator('[data-action="chatReport"]')).to_be_visible()
                page.locator('[data-action="chatReport"]').click()
                expect(page.locator('#chat-warn')).to_contain_text('Les 30 derniers messages')
                assert page.evaluate('document.documentElement.scrollWidth <= innerWidth + 2'), 'Horizontal overflow'
                page.screenshot(path=str(OUT / f'{width}-archived-report.png'), full_page=False)
                page.locator('[data-action="chatReportNow"][data-args="[false]"]').click()
                expect(page.locator('#chat-warn')).to_have_text('')
                assert reports == [dict(pid=pid)]
                # After reopening Mes amis, the old thread is still reachable.
                page.evaluate("""({pid, message}) => {
                    closeOverlayModal(); frState.data = {friends:[], incoming:[], outgoing:[], blocked:[], max:50};
                    chatState.convs = {[pid]:{friends:false, username:'Bob', last:message, unread:0}};
                    ensureOverlay('Mes amis', frPanelHtml());
                }""", dict(pid=pid, message=messages[0]))
                page.locator('summary', has_text='Anciennes discussions').click()
                page.locator('[data-action="openFriendChat"]', has_text='Bob').click()
                expect(page.locator('#chat-input')).to_be_disabled()
                expect(page.locator('#chat-msgs')).to_contain_text('Bonjour !')
                # A suspension retains report/block actions and disables writing.
                thread.update(friends=True, canSend=False)
                page.evaluate("openFriendChat('bbbbbbbbbbbbbbbb', 'Bob')")
                expect(page.locator('#chat-status')).to_contain_text('suspendue')
                expect(page.locator('#chat-input')).to_be_disabled()
                page.locator('[data-action="chatMenu"]').click()
                expect(page.locator('[data-action="chatBlock"]')).to_be_visible()
                page.screenshot(path=str(OUT / f'{width}-suspended-chat.png'), full_page=False)
                assert not errors, errors
                page.goto('about:blank')
                page.set_content(admin_html)
                expect(page.get_by_role('heading', name='Suspendre la discussion')).to_be_visible()
                assert page.evaluate('document.documentElement.scrollWidth <= innerWidth + 2'), 'Admin horizontal overflow'
                page.screenshot(path=str(OUT / f'{width}-admin-suspension.png'), full_page=True)
                results.append(dict(width=width, ok=True, cases=['removed-friend-report', 'archive-reopen', 'suspended-chat']))
                context.close()
            browser.close()
    finally:
        server.terminate()
        server.wait(timeout=15)
        log.close()
        (OUT / 'report.json').write_text(json.dumps(results, indent=2))
    print(json.dumps(results))


if __name__ == '__main__':
    main()
