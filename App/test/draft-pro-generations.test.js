'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const pro=require('../src/script.06b.pro-mode.js');

test('Draft PRO draws a trainer in all nine generations',()=>{
  for(let gen=1;gen<=9;gen++){
    for(const roll of [0.05,0.3,0.9]){
      const mods=pro.rollProModifiers(gen,()=>roll);
      assert.ok(mods.trainer&&mods.trainer.name&&mods.trainer.type,'generation '+gen+' roll '+roll);
    }
  }
});

test('every PRO trainer type is a real type with a colour, and every league ace is a valid id',()=>{
  const types=new Set(['Normal','Feu','Eau','Plante','Électrik','Glace','Combat','Poison','Sol','Vol','Psy','Insecte','Roche','Spectre','Dragon','Ténèbres','Acier','Fée']);
  for(const leaders of [...Object.values(pro.PRO_GYM_LEADERS),...Object.values(pro.PRO_CONSEIL_4)])for(const [name,type] of leaders){assert.ok(name);assert.ok(types.has(type),name+' '+type);}
  for(const master of Object.values(pro.PRO_LEAGUE_MASTERS)){assert.ok(types.has(master.type));assert.ok(Number.isInteger(master.aceId)&&master.aceId>0&&master.aceId<=1025);}
});
