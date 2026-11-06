'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require('node:path').join(__dirname,'../src/script.10j.game-shell.js'),'utf8');
const fn = source.slice(source.indexOf('function fitMobileGuessSearch()'),source.indexOf('function scheduleMobileGuessSearch()'));
function fit(height, fieldTop=220) {
 let scroll=0, listHeight;
 const bar={};
 const input={closest:()=>bar,getBoundingClientRect:()=>({top:fieldTop-scroll,bottom:fieldTop+52-scroll})};
 const elements={'guess-input':input,'guess-ac':{style:{setProperty:(_,v)=>{listHeight=parseFloat(v);}}},'screen-game':{classList:{contains:()=>false},dataset:{shell:'focused'}},'btn-submit':{getBoundingClientRect:()=>({height:48})},'btn-surrender':{getBoundingClientRect:()=>({height:44})}};
 const context={document:{activeElement:input,getElementById:id=>elements[id],querySelector:()=>null,body:{classList:{contains:()=>true}}},window:{matchMedia:()=>({matches:true}),visualViewport:{height,offsetTop:0},scrollBy:({top})=>{scroll+=top;}},getComputedStyle:el=>el===bar?{rowGap:'8px',paddingBottom:'12px'}:{display:'block'}};
 vm.createContext(context);vm.runInContext(fn+';fitMobileGuessSearch();',context);
 return {context, bottom:fieldTop+52-scroll+8+listHeight+48+8+12+2, listHeight, scroll:()=>scroll};
}
for (const height of [260,320,400,600]) test(`MOB-03 action row fits a ${height}px visible viewport`,()=>{
 const state=fit(height);
 assert.ok(state.bottom<=height-12+1,JSON.stringify(state));
 assert.ok(state.listHeight>=0 && state.listHeight<=282);
 const before=state.scroll();vm.runInContext('fitMobileGuessSearch()',state.context);
 assert.equal(state.scroll(),before,'typing must not keep scrolling');
});
