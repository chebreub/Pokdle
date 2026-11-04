"use strict";
// Synthetic presentation fixture only: NEVER reads the real admin key, users or production statistics.
const fs=require("node:fs"),path=require("node:path");
const {renderStatsDashboard}=require("../App/lib/admin-stats-dashboard");
const root=path.resolve(__dirname,"../quality-artifacts/admin-stats");
fs.mkdirSync(root,{recursive:true});
const data=[];
for(let i=0;i<14;i++){
  const day=new Date(Date.UTC(2026,10,4-i)).toISOString().slice(0,10);
  data.push({day,event:"visit",hits:String(22+(i*7)%30)});
}
const latest="2026-11-04";
const games=[
 ["solo:daily",30],["solo:wordle",24],["solo:dossier",18],["solo:grid",14],
 ["solo:shiny",12],["solo:quiz",16],["solo:higherlowerrush",10],
 ["solo:higherlower",6],["solo:wordletraining",9],["solo:pixel",7],
 ["solo:weight",11],["solo:petitbac",4],["solo:normal",13]
];
for(const [event,hits] of games)data.push({day:latest,event,hits:String(hits)});
for(const [event,hits] of [
 ["complete:daily:win",16],["complete:quiz:win",8],
 ["complete:higher-lower-rush:win",6],
 ["party:create",5],["party:join",8],
 ["party:start:dessin",5],["party:start:dexrace",3],
 ["share:daily",12],["share:visit",7]
])data.push({day:latest,event,hits:String(hits)});
const uniqueRows=Array.from({length:14},(_,i)=>{
  const day=new Date(Date.UTC(2026,10,4-i)).toISOString().slice(0,10);
  return {day,uniques:11+(i*3)%17};
});
const rawRows=uniqueRows.map(x=>({d:x.day,hits:x.uniques+13}));
const base={
  endDay:latest,generatedAt:"2026-11-04T20:36:00Z",
  adminKey:"ci-synthetic-key-not-a-secret",metrics:data,uniqueRows,rawRows,
  feedbackHtml:"<h2>Retours des joueurs</h2><p>Exemple de test : 2 messages synthétiques.</p>",
  diagnosticDays:[latest],diagnosticRows:[{label:"solo:shiny",values:[12],total:12}],
  bootedAt:"2026-11-04 10:00",
  retention:{
    nextDay:{base:42,back:15,rate:36},
    week:{base:30,back:12,rate:40},
    newWeek:{base:10,back:3,rate:30}
  }
};
for(const period of [1,3,14]) {
  const selected={...base,days:period,livePeriod:period<=3,endDay:period<=3?latest:"2026-11-03"};
  const fromDate=new Date(Date.parse(selected.endDay+"T00:00:00Z")-(period-1)*86400000).toISOString().slice(0,10);
  selected.metrics=data.filter(x=>x.day>=fromDate&&x.day<=selected.endDay);
  selected.uniqueRows=uniqueRows.filter(x=>x.day>=fromDate&&x.day<=selected.endDay);
  selected.rawRows=rawRows.filter(x=>x.d>=fromDate&&x.d<=selected.endDay);
  fs.writeFileSync(path.join(root,"view-"+period+".html"),renderStatsDashboard(selected));
}
console.log("Synthetic Admin Stats V2 previews created.");
