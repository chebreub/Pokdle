'use strict';
// A cached image error must not block "Shiny ou normal ?" indefinitely.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const client=fs.readFileSync(path.join(__dirname,'../src/script.10xzi.verified-arcade.js'),'utf8');
const chunk=client.slice(client.indexOf('renderShinyGame = function () {'));
assert.ok(chunk.startsWith('renderShinyGame = function () {'));

function fixture({complete=true,naturalWidth=0}={}) {
  const state={
    verified:{sessionId:'known-session',round:4},
    phase:'playing',round:{id:6,image:'/api/arcade/art/opaque-token'},
    busy:false,imageReady:false,score:5,lives:2
  };
  let current=state,removedImage=false,retry=null,appendCount=0;
  const choices=[{disabled:false},{disabled:false}];
  const img={
    complete,naturalWidth,src:'/api/arcade/art/opaque-token',onload:null,onerror:null,
    getAttribute(name){return name==='src'?'/api/arcade/art/opaque-token':null;}
  };
  const root={
    contains(el){return el===img&&!removedImage;},
    querySelector(sel){return sel==='.shiny-art'?img:sel==='#shiny-image-retry'?retry:null;},
    querySelectorAll(sel){return sel==='.shiny-choice'?choices:[];},
    appendChild(node){appendCount++;retry=node;}
  };
  const doc={
    getElementById(id){return id==='shiny-root'?root:null;},
    createElement(){
      const handlers={};
      const node={
        addEventListener(name,fn){handlers[name]=fn;},
        remove(){if(retry===node)retry=null;},
        click(){handlers.click?.();}
      };
      return node;
    }
  };
  const context=vm.createContext({
    document:doc,
    renderShinyLocal(){},
    shinyState:current
  });
  vm.runInContext(chunk,context);
  return {
    state,img,choices,root,context,
    retry:()=>retry,
    appendCount:()=>appendCount,
    replaceSession(){context.shinyState={...state};},
    detachImage(){removedImage=true;}
  };
}

test('a cached broken artwork shows a retry instead of disabling Shiny choices forever',()=>{
  const t=fixture({complete:true,naturalWidth:0});
  t.context.renderShinyGame();
  assert.ok(t.choices.every(x=>x.disabled));
  assert.equal(t.state.imageReady,false);
  assert.equal(t.retry().id,'shiny-image-retry');
  assert.equal(t.retry().textContent,'Recharger l’image');
  t.img.onerror();
  assert.equal(t.appendCount(),1,'one retry button only');
});

test('retry reloads the same opaque URL with a fresh cache key and preserves the round',()=>{
  const t=fixture({complete:true,naturalWidth:0});
  t.context.renderShinyGame();
  const initial=t.state.verified;
  t.retry().click();
  assert.equal(t.retry(),null);
  assert.equal(t.img.src,'/api/arcade/art/opaque-token?retry=1');
  assert.ok(t.choices.every(x=>x.disabled));
  assert.equal(t.state.imageReady,false);
  assert.equal(t.state.verified,initial);
  assert.equal(t.state.score,5);
  assert.equal(t.state.lives,2);
  t.img.onerror();
  assert.equal(t.retry().id,'shiny-image-retry');
  t.retry().click();
  assert.equal(t.img.src,'/api/arcade/art/opaque-token?retry=2');
  t.img.naturalWidth=260;
  t.img.onload();
  assert.equal(t.state.imageReady,true);
  assert.ok(t.choices.every(x=>!x.disabled));
});

test('a normally loaded artwork enables choices without showing recovery',()=>{
  const t=fixture({complete:true,naturalWidth:260});
  t.context.renderShinyGame();
  assert.equal(t.state.imageReady,true);
  assert.ok(t.choices.every(x=>!x.disabled));
  assert.equal(t.retry(),null);
});

test('asynchronous errors and stale image events cannot affect another round',()=>{
  const t=fixture({complete:false,naturalWidth:0});
  t.context.renderShinyGame();
  assert.equal(t.retry(),null);
  t.img.onerror();
  assert.ok(t.retry());
  t.replaceSession();
  t.retry().click();
  assert.equal(t.img.src,'/api/arcade/art/opaque-token');
  t.img.onload();
  assert.equal(t.state.imageReady,false);
  const x=fixture({complete:false,naturalWidth:0});
  x.context.renderShinyGame();
  x.detachImage();
  x.img.onerror();
  assert.equal(x.retry(),null);
});
