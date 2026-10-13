"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");

const root=path.join(__dirname,"..");
const source=fs.readFileSync(path.join(root,"src/script.08.catalog.js"),"utf8");
const club=fs.readFileSync(path.join(root,"src/script.09.club.js"),"utf8");
const html=fs.readFileSync(path.join(root,"index.html"),"utf8");
const css=fs.readFileSync(path.join(root,"visual-refresh.css"),"utf8");

function tileFixture(){
  const context={
    document:{addEventListener(){},querySelectorAll(){return[];},getElementById(){return null;}},
    history:{state:null,replaceState(){}},
    location:{href:"https://pokdle.test/"},
    getSpriteUrl:id=>"sprite/"+id,
    String,Number,Object,Array,JSON
  };
  vm.createContext(context);
  vm.runInContext(source+"\nthis.__theme=MODE_TILE_THEME;this.__props=MODE_TILE_PROPS;",context);
  return context;
}

test("catalogue tiles give every card its own mascot, colour and drawn mechanic",()=>{
  const f=tileFixture();
  const buttons=[...html.matchAll(/<button[^>]*class="card all-modes-card"[^>]*>/g)].map(m=>m[0]);
  assert.ok(buttons.length>=27,"expected the complete mode library (3 families since 13/10, Pokédex and Profil in the menu)");
  for(const tag of buttons){
    const action=tag.match(/data-action="([^"]+)"/)?.[1] || "";
    const key=action==="openFromAllModes" ? JSON.parse(tag.match(/data-args='([^']+)'/)?.[1] || "[]")[0] : action;
    const theme=f.__theme[key];
    assert.ok(theme,`missing tile theme for ${key}`);
    assert.match(theme.tone,/^#[0-9A-F]{6}$/i);
    assert.match(theme.ink,/^#[0-9A-F]{6}$/i);
    assert.ok(theme.prop==="types" ? theme.types.length===2 : f.__props[theme.prop],`missing drawn mechanic for ${key}`);
  }
  assert.match(club,/catalogFeatureOfWeek/);
  assert.doesNotMatch(club,/isClubFeatured/);
});

test("mode families, special effects, dark mode and mobile are styled",()=>{
  assert.match(css,/MODE CARD IDENTITY V2/);
  for(const family of ["guess","play","social","tools"]){
    assert.match(css,new RegExp(`data-family="${family}"`));
  }
  for(const effect of ["art-mystery","art-pixel","art-scan","art-audio","art-duel","art-team"]){
    assert.match(css,new RegExp(effect));
  }
  assert.match(css,/theme-dark #screen-all-modes \.all-modes-card\.has-mode-art/);
  assert.match(css,/@media \(max-width:640px\)[\s\S]*\.all-modes-card\.has-mode-art/);
  assert.match(css,/@media \(max-width:640px\)[\s\S]*\.club-pick\.has-mode-art/);
});


test("the old catalogue art generator stays removed",()=>{
  assert.doesNotMatch(source,/MODE_CATALOG_ART|modeCatalogArtHtml|modeCatalogPreviewHtml/);
});
