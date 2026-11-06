"""DEX-02: live-built Pokédex details use server capture-route payload, no inferred routes."""
import json, os
from playwright.sync_api import sync_playwright
import mobile_chat_quality as qa
OUT=qa.ROOT/'quality-artifacts'/'pokedex-routes'

def scenario(browser,engine,width):
    context=browser.new_context(viewport={'width':width,'height':844 if width<640 else 900},has_touch=width<640,is_mobile=width<640,reduced_motion='reduce')
    page=context.new_page()
    data={'ok':True,'captures':[{'id':25,'normal':1,'shiny':0}],
          'captureHistory':[{'id':25,'normal':1,'shiny':0}],
          'catchableTotal':852,
          'captureRoutes':{'wild':[10,25],'expedition':[380,485,639,785,894,1001],'prestige':373}}
    page.route('**/api/wild/collection',lambda route:route.fulfill(json=data))
    page.route('**://pokeapi.co/**',lambda route:route.fulfill(status=503,body=''))
    try:
        page.goto(qa.URL,wait_until='domcontentloaded')
        qa.ready(page,'typeof openPokedexCollection==="function" && POKEMON_LIST.length>1000')
        qa.ready(page,'!document.getElementById("app-splash") || getComputedStyle(document.getElementById("app-splash")).pointerEvents === "none"')
        page.evaluate('''() => {
          closeOverlayModal();
          playerProfile.discoveries=Object.fromEntries([25,150,373,380].map(id=>[id,{mode:"classic",at:1}]));
          openPokedexCollection();
        }''')
        qa.ready(page,'wildCaptureRoutes !== null && wildCaptureHistory !== null')
        for id,expected in [(25,'Hautes herbes'),(380,'Expédition hebdomadaire'),(373,'Épreuve de prestige Drattak'),(150,'Aucune voie de capture'),(377,'Aucune voie de capture'),(151,'Piste secrète')]:
            page.evaluate('(id)=>{pokedexSelectedId=id;return renderPokedexDetail(POKEMON_BY_ID.get(id));}',id)
            qa.ready(page,f'document.querySelector(".pokedex-acquisition")?.dataset.pokemonId === "{id}"')
            info=page.locator('.pokedex-acquisition').inner_text()
            assert expected in info,(engine,width,id,info)
            if id==150:
                assert 'découverte uniquement' in info and 'capture automatique' in info
            if id==151:
                assert 'Mew' not in page.locator('.pokedex-acquisition').inner_text()
            if id==25:
                assert 'sans prouver une capture personnelle' in info
            assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+2'),(engine,width,id)
            if id in (25,373,377):
                page.screenshot(path=str(OUT/f'{engine}-{width}-{id}.png'))
        data.pop('captureRoutes')
        page.evaluate('openPokedexCollection()')
        qa.ready(page,'wildCaptureRoutes === null && wildCaptureHistory !== null')
        page.evaluate('(id)=>{pokedexSelectedId=id;return renderPokedexDetail(POKEMON_BY_ID.get(id));}',377)
        qa.ready(page,'document.querySelector(".pokedex-acquisition")?.dataset.pokemonId === "377"')
        missing=page.locator('.pokedex-acquisition').inner_text()
        assert 'Informations indisponibles' in missing and 'Aucune voie de capture' not in missing
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
