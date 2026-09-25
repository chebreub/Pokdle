"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");

const root=path.join(__dirname,"..");
const html=fs.readFileSync(path.join(root,"index.html"),"utf8");
const collection=fs.readFileSync(path.join(root,"src/script.10d.pokedex-collection.js"),"utf8");
const missions=fs.readFileSync(path.join(root,"src/script.10b.album-missions.js"),"utf8");
const secrets=fs.readFileSync(path.join(root,"src/script.11.secrets.js"),"utf8");
const account=fs.readFileSync(path.join(root,"src/script.07.delegation-party.js"),"utf8");
const pokedexCss=fs.readFileSync(path.join(root,"pokedex.css"),"utf8");
const profileCss=fs.readFileSync(path.join(root,"profile.css"),"utf8");

test("Pokédex is the single collection home while profile exposes missions",()=>{
  assert.match(html,/data-args='\["album"\]' aria-pressed="false">Missions/);
  assert.match(html,/profile-missions-view/);
  assert.match(html,/Ta collection personnelle vit désormais dans le Pokédex/);
  assert.doesNotMatch(html,/id="album-grid"/);
  assert.doesNotMatch(html,/id="album-search"/);
  assert.match(html,/data-action="openPokedexCollection">Ouvrir ma collection/);
});

test("collection and encyclopedia are explicitly different experiences",()=>{
  assert.match(collection,/>Ma collection<\/button>/);
  assert.match(collection,/>Encyclopédie complète<\/button>/);
  assert.match(collection,/Gagné en jouant/);
  assert.match(collection,/Récompense de maîtrise/);
  assert.match(collection,/À rencontrer/);
  assert.match(collection,/Piste cachée/);
});

test("base species and alternate forms are reported separately",()=>{
  assert.match(collection,/function pokedexCollectionFormStats/);
  assert.match(collection,/formsFound:forms\.found/);
  assert.match(collection,/formes<\/span>/);
  assert.match(collection,/espèces de base enregistrées/);
});

test("mission and secret rewards open their exact Pokédex entry",()=>{
  assert.match(missions,/function viewAlbumMissionReward[\s\S]*openRegisteredPokemonInPokedex\(pokemon\.id\)/);
  assert.match(secrets,/function viewSecretAlbum[\s\S]*openRegisteredPokemonInPokedex\(pokemon\.id\)/);
  assert.match(account,/Ma collection/);
});

test("collection identity has responsive and dark visual treatment",()=>{
  assert.match(pokedexCss,/Collection Identity V2/);
  assert.match(pokedexCss,/\.pokedex-collection-legend/);
  assert.match(pokedexCss,/body\.theme-dark \.pokedex-collection-legend/);
  assert.match(profileCss,/Profile Missions V2/);
  assert.match(profileCss,/#profile-album\.profile-missions-view/);
  assert.match(profileCss,/body\.theme-dark \.profile-mission-intro/);
  assert.match(profileCss,/@media \(max-width:720px\)/);
});
