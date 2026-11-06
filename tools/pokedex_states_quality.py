"""DEX-01 presentation with explicit collection fixtures; PostgreSQL tested separately."""
import json, os
from playwright.sync_api import sync_playwright
import mobile_chat_quality as qa
OUT = qa.ROOT / 'quality-artifacts' / 'pokedex-states'


def case(browser, engine, width):
    context = browser.new_context(viewport={'width':width,'height':844 if width<640 else 900},has_touch=width<640,is_mobile=width<640,reduced_motion='reduce')
    page = context.new_page()
    data = {'ok':True,'captures':[{'id':25,'normal':2,'shiny':0},{'id':380,'normal':1,'shiny':0}],
            'captureHistory':[{'id':373,'normal':1,'shiny':0},{'id':380,'normal':1,'shiny':0}], 'catchableTotal':852}
    page.route('**/api/wild/collection',lambda route: route.fulfill(json=data))
    # Encyclopaedia enrichment is unrelated to collection status, fail fast.
    page.route('**://pokeapi.co/**',lambda route: route.fulfill(status=503,body=''))
    try:
        page.goto(qa.URL,wait_until='domcontentloaded')
        qa.ready(page,'typeof openPokedexCollection === "function" && POKEMON_LIST.length>1000')
        qa.ready(page,'!document.getElementById("app-splash") || getComputedStyle(document.getElementById("app-splash")).pointerEvents === "none"')
        page.evaluate('''() => {
          closeOverlayModal();
          playerProfile.discoveries=Object.fromEntries([10,25,150,373,380].map(id=>[id,{source:id===25?'capture':id===150?'mission':'game',mode:id===25?'capture':'classic',at:1}]));
          window.qaDiscoveries=JSON.stringify(playerProfile.discoveries);
          openPokedexCollection();
        }''')
        qa.ready(page,'wildCaptureHistory !== null')
        national=page.locator('#pokedex-collection-national')
        assert 'Découverts' in national.inner_text() and 'Déjà capturés' in national.inner_text() and 'Possédés actuellement' in national.inner_text()
        for key,expected in [('seen',[10,25,150,373,380]),('caught',[373,380]),('obtained',[25,380])]:
            page.locator(f'[data-collection-filter="{key}"]').click()
            assert page.evaluate('getFilteredPokedexList().map(p=>p.id)')==expected,(engine,width,key)
        # Received trade: possession does not claim that the player captured it.
        page.locator('#pokedex-grid [data-pokemon-id="25"]').click()
        qa.ready(page,'!!document.querySelector(".pokedex-personal-record")')
        record=page.locator('.pokedex-personal-record')
        assert 'Aucune capture enregistrée' in record.inner_text() and '2 exemplaires' in record.inner_text()
        assert 'Entrée de collection' in record.inner_text()
        assert 'Hautes herbes' not in record.inner_text() and 'Pokémon capturé' not in record.inner_text()
        page.screenshot(path=str(OUT/f'{engine}-{width}-received.png'))
        if width<640: page.locator('.pokedex-back-to-list').click()
        page.locator('[data-collection-filter="caught"]').click()
        page.locator('#pokedex-grid [data-pokemon-id="373"]').click()
        qa.ready(page,'document.querySelector(".pokedex-personal-record")?.textContent.includes("Drattak")')
        assert 'Oui · capture enregistrée' in record.inner_text()
        assert 'Possédé actuellement\nNon' in record.inner_text()
        page.screenshot(path=str(OUT/f'{engine}-{width}-ceded.png'))
        if width<640: page.locator('.pokedex-back-to-list').click()
        page.evaluate('setPokedexCollectionFilter("all")')
        # Reopening refreshes changed server data without altering discoveries.
        data['captures'][0]['normal']=1
        page.evaluate('closeWildGrass()')
        qa.ready(page,'wildCaptureHistory !== null && wildCaptures[25].normal===1')
        assert page.evaluate('JSON.stringify(playerProfile.discoveries)===qaDiscoveries')
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+2'),'horizontal overflow'
        page.locator('#pokedex-collection-hub').scroll_into_view_if_needed()
        page.screenshot(path=str(OUT/f'{engine}-{width}-overview.png'))
        # Missing history must stay unknown; no inference from held Pokémon.
        del data['captureHistory']
        page.evaluate('openPokedexCollection()')
        qa.ready(page,'colCapturesAsked && wildCaptureHistory === null')
        assert page.locator('[data-collection-filter="caught"]').is_disabled()
        assert page.evaluate('colEverCaughtCount(25)') is None
        return {'engine':engine,'width':width,'ok':True}
    except Exception:
        page.screenshot(path=str(OUT/f'{engine}-{width}-failure.png'))
        raise
    finally: context.close()


def main():
    OUT.mkdir(parents=True,exist_ok=True);qa.OUT=OUT
    results=[]
    try:
        with qa.local_server('collection'),sync_playwright() as pw:
            for engine in os.getenv('QA_BROWSERS','chromium,webkit').split(','):
                browser=getattr(pw,engine).launch()
                try:
                    for width in [390,1366]:results.append(case(browser,engine,width))
                finally:browser.close()
    finally:(OUT/'report.json').write_text(json.dumps(results,indent=2))
    print(json.dumps(results))

if __name__=='__main__':main()
