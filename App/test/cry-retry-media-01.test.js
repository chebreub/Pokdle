"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const mini = fs.readFileSync(path.join(__dirname, "../src/script.03.minijeux.js"), "utf8");
const starts = fs.readFileSync(path.join(__dirname, "../src/script.02.statclash.js"), "utf8");
const from = mini.indexOf("let cryPlaybackVersion = 0;");
const to = mini.indexOf("let __draftBattleCryAudio = null;", from);
assert.ok(from > 0 && to > from, "MEDIA-01 playback functions must remain together");
const logic = mini.slice(from, to);
const tick = () => new Promise(resolve => setImmediate(resolve));

function fixture({verified=false,play=()=>Promise.resolve()}={}) {
  const elements = new Map(), timers = new Map(), audios = [];
  let timerId = 0;
  const classes = () => {
    const items = new Set();
    return {add(...names){names.forEach(n=>items.add(n));},
      remove(...names){names.forEach(n=>items.delete(n));},
      toggle(n,on){on ? items.add(n) : items.delete(n);},
      contains(n){return items.has(n);}};
  };
  const el = id => {
    if (!elements.has(id)) elements.set(id,{id,textContent:"",classList:classes(),disabled:false,
      querySelector(q){return q === ".cry-play-label" ? el("cry-play-label") : null;}});
    return elements.get(id);
  };
  class Audio {
    constructor() {
      this.src="";this.preload="";this.paused=true;this.currentTime=0;this.volume=1;this.error=null;
      this.pauses=0;this.plays=0;audios.push(this);
    }
    pause(){this.pauses++;this.paused=true;}
    play(){this.plays++;return play(this,audios.length);}
    event(name){const fn=this["on"+name]; if(typeof fn === "function") fn();}
  }
  const ctx={
    gameMode:"cry",gameOver:false,secretPokemon:verified ? null : {id:25,name:"Pikachu"},
    cryAudio:null,attempts:2,guessSeries:{found:3,rounds:[]},playerStats:{wins:0},
    document:{getElementById:el}, Audio, appSoundVolume:()=>0.4,
    getPokemonCryUrl:()=>"https://cdn.jsdelivr.net/25.ogg",
    verifiedGuessCry:()=>verified ? "https://pokdle.fr/api/arcade/cry/opaque-token" : "",
    setTimeout(fn,delay){const id=++timerId;timers.set(id,{fn,delay});return id;},
    clearTimeout(id){timers.delete(id);}
  };
  vm.createContext(ctx);vm.runInContext(logic,ctx);
  const status=()=>el("cry-status-text").textContent;
  const button=()=>el("cry-play-btn");
  const label=()=>el("cry-play-label").textContent;
  return {ctx,elements,timers,audios,status,button,label,
    fireTimer(){const item=timers.values().next().value; assert.ok(item);item.fn();},
    snapshot(){return JSON.stringify([ctx.attempts,ctx.gameOver,ctx.guessSeries.found,ctx.guessSeries.rounds.length,ctx.playerStats.wins]);}
  };
}

test("MEDIA-01: autoplay rejection offers replay, changes no round state or resources", async()=>{
  let n=0;
  const f=fixture({play:()=>++n === 1
    ? Promise.reject(Object.assign(new Error("blocked"),{name:"NotAllowedError"})) : Promise.resolve()});
  const before=f.snapshot();
  f.ctx.playCrySound();
  assert.equal(f.button().disabled,true);
  await tick();
  assert.match(f.status(),/navigateur bloque la lecture audio/);
  assert.match(f.status(),/aucun essai/);
  assert.equal(f.label(),"Réessayer le cri");
  assert.equal(f.button().disabled,false);
  assert.equal(f.timers.size,0);
  assert.equal(f.snapshot(),before);
  f.ctx.playCrySound();await tick();
  assert.equal(f.audios.length,2,"failed audio must be recreated");
  assert.equal(f.status(),"Écoute bien…");
  assert.equal(f.snapshot(),before);
  assert.equal(f.audios[1].volume,0.4,"existing sound-volume preference preserved");
});

test("MEDIA-01: HTTP/media decode errors retry same mystery with a fresh audio element", async()=>{
  const f=fixture({play:()=>new Promise(()=>{})});
  const before=f.snapshot();
  f.ctx.playCrySound();
  const first=f.audios[0], staleError=first.onerror, stalePlaying=first.onplaying;
  first.error={code:4};
  first.event("error");
  assert.equal(f.button().disabled,false);
  assert.match(f.status(),/Cri indisponible/);
  f.ctx.playCrySound();
  assert.equal(f.audios.length,2);
  assert.equal(f.audios[1].src,first.src);
  const loading=f.status();
  staleError();stalePlaying();
  assert.equal(f.status(),loading,"events from superseded audio cannot overwrite current state");
  assert.equal(f.button().disabled,true);
  f.audios[1].event("playing");
  assert.equal(f.status(),"Écoute bien…");
  assert.equal(f.timers.size,0);
  assert.equal(f.snapshot(),before);
});

test("MEDIA-01: an indefinitely pending load times out and can be retried without surrender",()=>{
  const f=fixture({play:()=>new Promise(()=>{})}),before=f.snapshot();
  f.ctx.playCrySound();
  assert.equal(f.timers.size,1);
  assert.equal([...f.timers.values()][0].delay,12000);
  f.fireTimer();
  assert.equal(f.timers.size,0);
  assert.match(f.status(),/prend trop de temps/);
  assert.equal(f.button().disabled,false);
  assert.equal(f.label(),"Réessayer le cri");
  assert.equal(f.snapshot(),before);
  f.ctx.playCrySound();
  assert.equal(f.audios.length,2);
  assert.equal(f.snapshot(),before);
});

test("MEDIA-01: a playback stall after starting also times out, then re-enables retry",async()=>{
  const f=fixture(),before=f.snapshot();
  f.ctx.playCrySound();await tick();
  const a=f.audios[0];
  a.event("waiting");
  assert.match(f.status(),/reprise du chargement/);
  assert.equal(f.button().disabled,true);
  f.fireTimer();
  assert.match(f.status(),/prend trop de temps/);
  assert.equal(f.button().disabled,false);
  assert.equal(f.snapshot(),before);
});

test("MEDIA-01: verified audio uses an opaque server URL and leaves the answer unavailable",async()=>{
  const f=fixture({verified:true,play:()=>Promise.reject(new Error("network failure"))}),before=f.snapshot();
  assert.equal(f.ctx.secretPokemon,null);
  f.ctx.playCrySound();await tick();
  assert.equal(f.audios[0].src,"https://pokdle.fr/api/arcade/cry/opaque-token");
  assert.match(f.status(),/Impossible de lire le son/);
  assert.equal(f.ctx.secretPokemon,null);
  assert.equal(f.timers.size,0);
  assert.equal(f.snapshot(),before);
});

test("MEDIA-01: verified start still loading keeps the round and asks to retry later",()=>{
  const f=fixture({verified:true}), before=f.snapshot();
  f.ctx.verifiedGuessCry=()=>"";
  f.ctx.playCrySound();
  assert.equal(f.audios.length,0);
  assert.equal(f.button().disabled,false);
  assert.match(f.status(),/Le cri arrive du serveur/);
  assert.equal(f.snapshot(),before);
});

test("MEDIA-01: close/navigation invalidates pending playback, timeouts and late errors",async()=>{
  let rejectPlay;
  const f=fixture({play:()=>new Promise((_resolve,reject)=>{rejectPlay=reject;})}),before=f.snapshot();
  f.ctx.playCrySound();
  const audio=f.audios[0], obsoleteError=audio.onerror,obsoletePlaying=audio.onplaying;
  const expiredTimer=[...f.timers.values()][0].fn;
  f.ctx.gameMode="quiz";
  f.ctx.stopCrySound();
  assert.equal(f.button().disabled,false);
  assert.equal(f.timers.size,0);
  assert.equal(f.ctx.cryAudio,null);
  assert.equal(f.status(),"");
  rejectPlay(new Error("late network"));
  await tick();
  obsoleteError();obsoletePlaying();expiredTimer();
  assert.equal(f.status(),"","no late event may put a Cry status on Quiz");
  assert.equal(f.snapshot(),before);
});

test("MEDIA-01: starting another Cry series round invalidates old sound even with the same gameMode",()=>{
  const start = starts.slice(starts.indexOf("function startCryGame()"),starts.indexOf("\nfunction startQuizGame()"));
  assert.match(start,/stopCrySound\(\)/);
  const old=fixture({play:()=>new Promise(()=>{})});
  old.ctx.playCrySound();
  const previous=old.audios[0],lateError=previous.onerror;
  old.ctx.stopCrySound();
  old.ctx.secretPokemon={id:6,name:"Dracaufeu"};
  old.ctx.playCrySound();
  assert.equal(old.audios.length,2);
  assert.equal(old.audios[1].src,"https://cdn.jsdelivr.net/25.ogg",
    "test fixture uses fixed URI; actual start picks a fresh Pokémon");
  const nextStatus=old.status();
  lateError();
  assert.equal(old.status(),nextStatus);
});

test("MEDIA-01: only the media state changes; existing answer and abandonment paths remain authoritative",()=>{
  assert.match(logic,/gameMode !== "cry" \|\| gameOver/);
  assert.doesNotMatch(logic,/\b(?:attempts\s*(?:\+\+|[+\-*\/]?=)|recordMatchHistory|verifiedGuessAbandon|surrenderGame|guessSeriesNext|awardXp|saveProfile)\b/);
  assert.match(fs.readFileSync(path.join(__dirname,"../src/script.10xzk.verified-guess.js"),"utf8"),/function verifiedGuessAbandon\(\) \{ return verifiedGuessSend\("abandon", \{\}\); \}/);
});
