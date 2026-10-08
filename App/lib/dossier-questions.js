"use strict";
const crypto=require('node:crypto');
const facts=require('../data/dossier-facts.json');
const STAT_NAMES=['PV','Attaque','Défense','Attaque Spéciale','Défense Spéciale','Vitesse'];
const EGG_NAMES=['','Monstrueux','Aquatique 1','Insectoïde','Aérien','Terrestre','Féerique','Végétal','Humanoïde','Aquatique 3','Minéral','Amorphe','Aquatique 2','Métamorph','Draconique','Inconnu'];
const GROWTH=['','lente','moyenne','rapide','parabolique','erratique','fluctuante'];
const ALL=Object.values(facts),ABILITIES=[...new Set(ALL.flatMap(f=>f.abilities.map(a=>a.name)))];
function seeded(seed) {
  let n=crypto.createHash('sha256').update(seed).digest().readUInt32LE();
  return ()=>{n+=0x6D2B79F5;let t=n;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return ((t^t>>>14)>>>0)/4294967296;};
}
function shuffle(values,rng) {const a=[...values];for(let i=a.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
function buildDossierQuestions(pokemonId,day) {
  const f=facts[pokemonId];if(!f)throw new Error('Missing verified dossier facts');
  const rng=seeded('dossier-v1:'+day+':'+pokemonId),bank=[];
  function add(id,category,prompt,correct,distractors,detail) {
    correct=String(correct);const alternatives=[...new Set(distractors.map(String))].filter(s=>s!==correct&&s);
    if(alternatives.length<3)throw new Error('Ambiguous question '+id);
    const options=shuffle([correct,...shuffle(alternatives,rng).slice(0,3)],rng);
    bank.push({id,category,prompt,options,answer:options.indexOf(correct),explanation:detail||'La bonne réponse est « '+correct+' ».'});
  }
  function numeric(id,category,prompt,value,step=10,detail) {
    const alternatives=[-3,-2,-1,1,2,3,4].map(x=>value+x*step).filter(v=>v>=0&&(id!=='capture'||v<=255));
    add(id,category,prompt,value,alternatives,detail||f.name+' : '+value+'.');
  }
  const normal=f.abilities.filter(a=>!a.hidden).map(a=>a.name).sort(),hidden=f.abilities.find(a=>a.hidden)?.name||'Aucun talent caché';
  add('ability','Talents','Quel ensemble correspond à ses talents standards ?',normal.join(' / '),ALL.map(x=>x.abilities.filter(a=>!a.hidden).map(a=>a.name).sort().join(' / ')),f.name+' possède '+normal.join(' et ')+' comme talent'+(normal.length>1?'s standards.':' standard.'));
  add('hidden','Talents','Quel est son talent caché ?',hidden,['Aucun talent caché',...ABILITIES.filter(a=>!normal.includes(a))],hidden==='Aucun talent caché'?f.name+' ne possède pas de talent caché.':'Le talent caché de '+f.name+' est '+hidden+'.');
  numeric('ability-count','Talents','Combien de talents standards peut-il posséder ?',normal.length,1);
  add('category','Pokédex','Quelle est sa catégorie dans le Pokédex ?',f.category,ALL.map(x=>x.category));
  const egg=f.eggGroups.map(g=>EGG_NAMES[g]).join(' / ');
  add('egg','Reproduction','À quel ensemble de groupes d’Œufs appartient-il ?',egg,ALL.map(x=>x.eggGroups.map(g=>EGG_NAMES[g]).join(' / ')),f.name+' appartient '+(f.eggGroups.length>1?'aux groupes ':'au groupe ')+egg+'.');
  numeric('egg-count','Reproduction','Combien de groupes d’Œufs lui sont attribués ?',f.eggGroups.length,1);
  add('growth','Progression','Quelle est sa courbe d’expérience ?',GROWTH[f.growth],GROWTH.slice(1),'Sa courbe d’expérience est '+GROWTH[f.growth]+'.');
  const gender=f.gender<0?'Sans sexe':(f.gender*12.5).toLocaleString('fr-FR')+' %';
  add('gender','Reproduction','Quelle proportion de femelles cette espèce possède-t-elle ?',gender,['Sans sexe',...'0,12.5,25,50,75,87.5,100'.split(',').map(n=>Number(n).toLocaleString('fr-FR')+' %')],f.gender<0?f.name+' est une espèce sans sexe.':'La proportion de femelles est de '+gender+'.');
  numeric('capture','Capture','Quel est son taux de capture de base (sur 255) ?',f.capture,15,'Son taux de capture de base est '+f.capture+' sur 255. Ce n’est pas un pourcentage de réussite.');
  numeric('friendship','Progression','Quelle est son amitié de base ?',f.happiness,10,'Son amitié de base est '+f.happiness+'.');
  numeric('hatch','Reproduction','Combien de cycles d’Œuf sont indiqués pour cette espèce ?',f.hatch,5,'Cette espèce possède un compteur de '+f.hatch+' cycles d’Œuf. La durée en pas dépend du jeu.');
  if(f.experience!==null)numeric('experience','Progression','Quelle est son expérience de base gagnée lorsqu’il est vaincu ?',f.experience,20,'L’expérience de base est '+f.experience+' ; le gain réel dépend du niveau et des règles du jeu.');
  const parent=f.parent?facts[f.parent].name:'Aucune pré-évolution';
  add('parent','Évolution','Quelle est sa pré-évolution directe ?',parent,['Aucune pré-évolution',...ALL.map(x=>x.name)].filter(n=>n!==f.name));
  const children=Object.entries(facts).filter(([,x])=>x.parent===Number(pokemonId)).map(([,x])=>x.name).sort();
  add('children','Évolution','Vers quelles espèces peut-il évoluer directement ?',children.length?children.join(' / '):'Aucune évolution directe',['Aucune évolution directe',...ALL.map(x=>x.name)].filter(n=>n!==f.name));
  const total=f.stats.reduce((s,v)=>s+v,0);
  numeric('total','Statistiques','Quel est le total de ses six statistiques de base ?',total,30,'Le total de ses statistiques de base est '+total+'.');
  for(const [i,name]of STAT_NAMES.entries())numeric('stat-'+i,'Statistiques','Quelle est sa statistique de base en '+name+' ?',f.stats[i],10,name+' : '+f.stats[i]+' points de base, avant niveau, nature, IV et EV.');
  for(const [id,label,extreme]of [['highest','la plus élevée',Math.max(...f.stats)],['lowest','la plus faible',Math.min(...f.stats)]]) {
    const tied=STAT_NAMES.filter((_,i)=>f.stats[i]===extreme).join(' / ');
    add(id,'Statistiques','Quelle(s) statistique(s) de base est/sont '+label+' ?',tied,STAT_NAMES,'À '+extreme+' points : '+tied+'. Les égalités sont conservées.');
  }
  if(f.english!==f.name)add('english','Pokédex','Quel est son nom anglais ?',f.english,ALL.map(x=>x.english));
  // The opening ten sample every topic; precise numeric stats are mainly in the expert bonus.
  const openingIds=['ability','hidden','category','egg','parent','highest','total','gender','growth','children'];
  const opening=shuffle(openingIds.map(id=>bank.find(q=>q.id===id)),rng);
  const bonus=shuffle(bank.filter(q=>!openingIds.includes(q.id)),rng).slice(0,10);
  if(bonus.length!==10)throw new Error('Insufficient verified questions');
  return [...opening,...bonus];
}
module.exports={facts,buildDossierQuestions,STAT_NAMES};
