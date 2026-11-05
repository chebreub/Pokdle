"""Visual QA on synthetic, private Admin Stats V2 HTML. No network, database or real key."""
import json
import subprocess
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/"quality-artifacts"/"admin-stats"

def main():
    subprocess.run(["node","tools/admin_stats_fixture.cjs"],cwd=ROOT,check=True)
    checks=[]
    with sync_playwright() as p:
        for browser_name in ("chromium","webkit"):
            browser=getattr(p,browser_name).launch()
            for width,height in ((390,844),(768,900),(1366,900)):
                context=browser.new_context(viewport={"width":width,"height":height},has_touch=width<769)
                page=context.new_page()
                page_errors=[]
                page.on("pageerror",lambda err: page_errors.append(str(err)))
                for days in (1,3,14):
                    page.goto((OUT/("view-"+str(days)+".html")).as_uri(),wait_until="domcontentloaded")
                    assert page.title()=="Statistiques · Pokédle"
                    assert page.locator("h1").inner_text()=="Tableau de bord"
                    assert page.locator(".kpis .kpi").count()==6
                    assert page.locator("form.period button[name='days']").count()==6
                    assert page.locator("form.period .is-active").get_attribute("value")==str(days)
                    assert page.locator("table").count()>=2
                    assert page.get_by_text("Dessine-le !").count()>0
                    assert page.get_by_text("Wordle du jour").count()>0
                    assert page.get_by_text("Circulation des Pokédollars").count()==1
                    assert page.get_by_text("Shinies capturés").count()==1
                    assert page.get_by_text("Balls lancées").count()==1
                    export = page.get_by_role("link", name="Exporter le bilan anonymisé (JSON)")
                    assert export.count()==1
                    assert export.get_attribute("href").startswith("data:application/json;charset=utf-8,")
                    assert export.get_attribute("download")=="pokdle-economie-2026-11-04.json"
                    if days==1:
                        assert page.get_by_text("Sessions aujourd’hui").count()>0
                        assert page.locator("svg.trend-chart").count()==0
                    else:
                        assert page.locator("svg.trend-chart").count()==1
                    sizes=page.evaluate("""() => ({
                       doc:document.documentElement.scrollWidth,viewport:innerWidth,
                       chart:[...document.querySelectorAll('.chart-scroll')].map(e=>({
                         width:e.clientWidth,content:e.scrollWidth
                       }))
                    })""")
                    assert sizes["doc"]<=sizes["viewport"]+1, (browser_name,width,days,sizes)
                    assert not page_errors, (browser_name,width,days,page_errors)
                    page.screenshot(path=str(OUT/(browser_name+"-"+str(width)+"-"+str(days)+".png")),full_page=True)
                    checks.append({"browser":browser_name,"width":width,"days":days,"ok":True})
                context.close()
            browser.close()
    (OUT/"report.json").write_text(json.dumps(checks,ensure_ascii=False,indent=2),encoding="utf-8")
    print(json.dumps({"checks":len(checks),"failures":0},ensure_ascii=False))

if __name__=="__main__":
    main()
