"""DEX-03: real-built Pokédex tracking, optional and saved in the existing profile."""
import json, os
from playwright.sync_api import sync_playwright
import mobile_chat_quality as qa
OUT=qa.ROOT/'quality-artifacts'/'pokedex-targets'

def scenario(browser,engine,width):
    context=browser.new_context(viewport={'width':width,'height':844 if width<640 else 900},
                                has_touch=width<640,is_mobile=width<640,reduced_motion='reduce')
    page=context.new_page()
    collection={'ok':True,'captures':[], 'captureHistory':[], 'catchableTotal':852,
                'captureRoutes':{'wild':[25], 'expedition':[380,485,639,785,894,1001], 'prestige':373}}
    page.route('**/api/wild/collection',lambda route:route.fulfill(json=collection))
    page.route('**://pokeapi.co/**',lambda route:route.fulfill(status=503,body=''))
    try:
        page.goto(qa.URL,wait_until='domcontentloaded')
        qa.ready(page,'typeof openPokedexCollection==="function" && POKEMON_LIST.length>1000')
        qa.ready(page,'!document.getElementById("app-splash") || getComputedStyle(document.getElementById("app-splash")).pointerEvents==="none"')
        page.evaluate("""() => {
          closeOverlayModal();
          playerProfile.discoveries={25:{source:'game',mode:'normal',at:1},150:{source:'mission',mode:'mission',at:1}};
          playerProfile.pokedexTrackedTargets=[];
          playerProfile.pokedexTrackedUpdatedAt=0;
          saveProfile();
          openPokedexCollection();
        }""")
        qa.ready(page,'!!document.getElementById("pokedex-tracking-hub")')
        for id in [25,150,373]:
            page.evaluate('(id)=>{pokedexSelectedId=id;return renderPokedexDetail(POKEMON_BY_ID.get(id));}',id)
            qa.ready(page,'document.querySelector("#pokedex-detail .pokedex-tracking-control button")?.getAttribute("data-args") === "[%d]"' % id)
            button=page.locator('#pokedex-detail .pokedex-tracking-control button')
            assert not button.is_disabled(),(engine,width,id)
            button.click()
        assert page.evaluate('pokedexTrackedTargetIds().join(",")')=='25,150,373'
        assert '3 / 3' in page.locator('#pokedex-tracking-hub').inner_text()
        # The fourth selection is blocked, and no profile write occurs.
        page.evaluate('(id)=>{pokedexSelectedId=id;return renderPokedexDetail(POKEMON_BY_ID.get(id));}',380)
        qa.ready(page,'!!document.querySelector("#pokedex-detail .pokedex-tracking-control")')
        assert page.locator('#pokedex-detail .pokedex-tracking-control button').is_disabled()
        page.evaluate('togglePokedexTrackedTarget(150)')
        assert page.evaluate('pokedexTrackedTargetIds().join(",")')=='25,373'
        # An unrevealed target may be chosen deliberately in the encyclopedia,
        # but its name is masked in collection mode.
        page.evaluate('setPokedexExperienceView("encyclopedia")')
        page.evaluate('(id)=>{pokedexSelectedId=id;return renderPokedexDetail(POKEMON_BY_ID.get(id));}',380)
        qa.ready(page,'!!document.querySelector("#pokedex-detail .pokedex-tracking-control button")')
        page.locator('#pokedex-detail .pokedex-tracking-control button').click()
        assert page.evaluate('pokedexTrackedTargetIds().join(",")')=='25,373,380'
        page.evaluate('setPokedexExperienceView("collection")')
        pane=page.locator('#pokedex-tracking-hub')
        assert 'Cible non révélée' in pane.inner_text()
        assert 'Latias' not in pane.inner_text()
        page.evaluate('(id)=>{pokedexSelectedId=id;return renderPokedexDetail(POKEMON_BY_ID.get(id));}',151)
        qa.ready(page,'document.querySelector("#pokedex-detail .pokedex-collection-lock") !== null')
        assert page.locator('#pokedex-detail .pokedex-tracking-control').count()==0
        assert page.evaluate('togglePokedexTrackedTarget(151)') is False
        assert page.evaluate('pokedexTrackedTargetIds().join(",")')=='25,373,380'
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+2')
        page.screenshot(path=str(OUT/f'{engine}-{width}-targets.png'))
        page.reload(wait_until='domcontentloaded')
        qa.ready(page,'typeof pokedexTrackedTargetIds==="function"')
        assert page.evaluate('pokedexTrackedTargetIds().join(",")')=='25,373,380','targets must survive reload'
        return {'engine':engine,'width':width,'ok':True}
    finally:context.close()

def main():
    OUT.mkdir(parents=True,exist_ok=True)
    qa.OUT=OUT
    results=[]
    try:
        with qa.local_server('collection'),sync_playwright() as pw:
            for engine in os.getenv('QA_BROWSERS','chromium,webkit').split(','):
                browser=getattr(pw,engine).launch()
                try:
                    for width in [390,1366]:results.append(scenario(browser,engine,width))
                finally:browser.close()
    finally:(OUT/'report.json').write_text(json.dumps(results,indent=2))
    print(json.dumps(results))

if __name__=='__main__':main()
