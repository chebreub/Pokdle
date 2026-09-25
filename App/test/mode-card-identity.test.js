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

function artFixture(){
  const context={
    document:{addEventListener(){},querySelectorAll(){return[];},getElementById(){return null;}},
    history:{state:null,replaceState(){}},
    location:{href:"https://pokdle.test/"},
    getSpriteUrl:id=>"sprite/"+id,
    String,Number,Object,Array,JSON
  };
  vm.createContext(context);
  vm.runInContext(source+"\nthis.__art=MODE_CATALOG_ART;this.__html=modeCatalogArtHtml;",context);
  return context;
}

test("every visible catalog card has a Pokémon art identity",()=>{
  const f=artFixture();
  const buttons=[...html.matchAll(/<button[^>]*class="card all-modes-card"[^>]*>/g)].map(m=>m[0]);
  assert.ok(buttons.length>=30,"expected the complete mode library");
  for(const tag of buttons){
    const action=tag.match(/data-action="([^"]+)"/)?.[1] || "";
    let key=action;
    if(action==="openFromAllModes"){
      const raw=tag.match(/data-args='([^']+)'/)?.[1] || "[]";
      key=JSON.parse(raw)[0];
    }
    assert.ok(f.__art[key],`missing artwork mapping for ${key}`);
  }
});

test("mode art is decorative, lazy and sprite based",()=>{
  const f=artFixture();
  const out=f.__html("startDailyGame","card");
  assert.match(out,/mode-card-art art-mystery/);
  assert.match(out,/loading="lazy"/);
  assert.match(out,/decoding="async"/);
  assert.match(out,/aria-hidden="true"/);
  assert.match(out,/sprite\/149/);
});

test("featured picks reuse the same visual identity system",()=>{
  assert.match(club,/modeCatalogArtHtml\(p\[0\], "pick"\)/);
  assert.match(club,/has-mode-art/);
});

test("mode families, special effects, dark mode and mobile are styled",()=>{
  assert.match(css,/MODE CARD IDENTITY V2/);
  for(const family of ["guess","reflection","arcade","strategy","social","collection"]){
    assert.match(css,new RegExp(`data-family="${family}"`));
  }
  for(const effect of ["art-mystery","art-pixel","art-scan","art-audio","art-duel","art-team"]){
    assert.match(css,new RegExp(effect));
  }
  assert.match(css,/theme-dark #screen-all-modes \.all-modes-card\.has-mode-art/);
  const mobile=css.slice(css.lastIndexOf("@media (max-width:640px)"));
  assert.match(mobile,/\.all-modes-card\.has-mode-art/);
  assert.match(mobile,/\.club-pick\.has-mode-art/);
});
