"use strict";
// Same nine criteria as the local Unlimited game, including null second types,
// color sets and the established numeric tolerances. No target values leave here.
function colors(value) {
  const text=Array.isArray(value)?value.map(c=>String(c).trim()).filter(Boolean).join(" / "):
    typeof value==="string"?value.split(/[\/|,]/).map(c=>c.trim()).filter(Boolean).join(" / ")||"Inconnu":"Inconnu";
  return new Set(text.split("/").map(c=>c.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"")).filter(Boolean));
}
function compareDaily(guess,secret) {
  const g=colors(guess.color),s=colors(secret.color),overlap=[...g].filter(c=>s.has(c)).length;
  const numeric=(a,b,t)=>a===b?"ok":Math.abs(a-b)<=t?"close":"wrong";
  return {
    generation:guess.gen===secret.gen?"ok":"wrong",
    altForm:Boolean(guess.isAltForm)===Boolean(secret.isAltForm)?"ok":"wrong",
    type1:guess.type1===secret.type1?"ok":guess.type1&&guess.type1===secret.type2?"close":"wrong",
    type2:guess.type2===secret.type2?"ok":guess.type2&&guess.type2===secret.type1?"close":"wrong",
    habitat:guess.habitat===secret.habitat?"ok":"wrong",
    color:!overlap?"wrong":overlap===g.size&&overlap===s.size?"ok":"close",
    stage:guess.stage===secret.stage?"ok":"wrong",
    height:numeric(guess.height,secret.height,0.3),weight:numeric(guess.weight,secret.weight,15)
  };
}
module.exports={compareDaily};
