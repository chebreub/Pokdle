"""DEX-04: six-slot showcase, verified ownership and voluntary fresh sharing."""
import json, os
from playwright.sync_api import sync_playwright
import mobile_chat_quality as qa
OUT=qa.ROOT/'quality-artifacts'/'pokedex-showcase'

def scenario(browser,engine,width):
    context=browser.new_context(viewport={'width':width,'height':844 if width<640 else 900},
                                has_touch=width<640,is_mobile=width<640,reduced_motion='reduce')
    page=context.new_page()
    data={'ok':True,'captures':[{'id':id,'normal':1,'shiny':0} for id in [1,4,7,10,25,133,380]],
          'captureHistory':[{'id':id,'normal':1,'shiny':0} for id in [1,25,380]],
          'catchableTotal':852,'captureRoutes':{'wild':[1,4,7,10,25,133],'expedition':[380],'prestige':373}}
    page.route('**/api/wild/collection',lambda route:route.fulfill(json=data))
    page.route('**://pokeapi.co/**',lambda route:route.fulfill(status=503,body=''))
    try:
        page.goto(qa.URL,wait_until='domcontentloaded')
        qa.ready(page,'typeof openPokedexCollection==="function" && POKEMON_LIST.length>1000')
        qa.ready(page,'!document.getElementById("app-splash") || getComputedStyle(document.getElementById("app-splash")).pointerEvents==="none"')
        page.evaluate("""() => {
          closeOverlayModal();
          playerProfile.pokedexShowcaseIds=[];
          playerProfile.pokedexShowcaseUpdatedAt=0;
          saveProfile();
          Object.defineProperty(navigator,'share',{configurable:true,value:async v=>{
            (window.__qaShares ||= []).push(v.text);
          }});
          window.__qaShares=[];
          openPokedexCollection();
        }""")
        qa.ready(page,'wildCaptures !== null && !!document.getElementById("pokedex-showcase-hub")')
        assert 'Objectif proche' in page.locator('#pokedex-showcase-hub').inner_text()
        assert page.evaluate('window.__qaShares.length')==0
        for id in [1,4,7,10,25,133]:
            page.evaluate('(id)=>{pokedexSelectedId=id;showPokedexMobileDetail();return renderPokedexDetail(POKEMON_BY_ID.get(id));}',id)
            qa.ready(page,'document.querySelector("#pokedex-detail .pokedex-showcase-control button")?.getAttribute("data-args") === "[%d]"' % id)
            button=page.locator('#pokedex-detail .pokedex-showcase-control button')
            assert not button.is_disabled(),(engine,width,id)
            button.click()
        assert page.evaluate('pokedexShowcaseIds().join(",")')=='1,4,7,10,25,133'
        assert '6 / 6' in page.locator('#pokedex-showcase-hub').inner_text()
        assert page.evaluate('window.__qaShares.length')==0,'showcase never auto-shares'
        page.evaluate('(id)=>{pokedexSelectedId=id;showPokedexMobileDetail();return renderPokedexDetail(POKEMON_BY_ID.get(id));}',380)
        qa.ready(page,'document.querySelector("#pokedex-detail .pokedex-showcase-control button")?.getAttribute("data-args") === "[380]"')
        assert page.locator('#pokedex-detail .pokedex-showcase-control button').is_disabled()
        # A remote trade/release occurred after the cached UI loaded.
        data['captures']=[c for c in data['captures'] if c['id']!=1]
        page.evaluate('closePokedexMobileDetail()')
        page.locator('#pokedex-showcase-hub [data-action="sharePokedexShowcase"]').click()
        qa.ready(page,'window.__qaShares.length===1')
        shared=page.evaluate('window.__qaShares[0]')
        assert 'Pikachu' in shared and 'Bulbizarre' not in shared,(engine,width,shared)
        assert 'Objectif proche : 3 / 5' in shared,shared
        assert 'Plus possédé' in page.locator('#pokedex-showcase-hub').inner_text()
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+2'),(engine,width)
        page.locator('#pokedex-showcase-hub').scroll_into_view_if_needed()
        page.screenshot(path=str(OUT/f'{engine}-{width}-showcase.png'))
        # Failed fresh API must not send a stale snapshot to native sharing.
        data['ok']=False
        assert page.evaluate('sharePokedexShowcase()') is False
        assert page.evaluate('window.__qaShares.length')==1
        page.reload(wait_until='domcontentloaded')
        qa.ready(page,'typeof pokedexShowcaseIds==="function"')
        assert page.evaluate('pokedexShowcaseIds().join(",")')=='1,4,7,10,25,133'
        return {'engine':engine,'width':width,'ok':True}
    finally:context.close()

def main():
    OUT.mkdir(parents=True,exist_ok=True);qa.OUT=OUT
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
