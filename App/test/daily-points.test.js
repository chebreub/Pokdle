'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {DAILY_MAX,DAILY_TOTAL,WORDLE_POINTS,enquiryPoints,wordlePoints,challengePoints}=require('../lib/daily-points');

test('the daily journey is worth 100 whole points: Enquête 40, Défi 30, Dossier 20, Wordle 10',()=>{
  assert.deepEqual({...DAILY_MAX},{enquiry:40,wordle:10,dossier:20,challenge:30});
  assert.equal(DAILY_TOTAL,100);
  assert.equal(enquiryPoints(true,1,0),DAILY_MAX.enquiry);
  assert.equal(wordlePoints(true,1),DAILY_MAX.wordle);
  assert.equal(Array.from({length:10},()=>challengePoints(true,1)).reduce((a,b)=>a+b,0),DAILY_MAX.challenge);
});
test('Enquête loses 2 per extra try and 4 per hint, never below 4 once found',()=>{
  assert.equal(enquiryPoints(true,3,0),36);
  assert.equal(enquiryPoints(true,1,2),32);
  assert.equal(enquiryPoints(true,6,1),26);
  assert.equal(enquiryPoints(true,40,9),4);
  assert.equal(enquiryPoints(false,1,0),0);
});
test('Wordle and Défi use fixed integer tables',()=>{
  assert.deepEqual([...WORDLE_POINTS],[10,8,6,4,2,1]);
  assert.deepEqual([1,2,3,4,5,6].map(n=>wordlePoints(true,n)),[10,8,6,4,2,1]);
  assert.equal(wordlePoints(false,3),0);
  assert.deepEqual([1,2,3,4,5,6].map(n=>challengePoints(true,n)),[3,2,2,1,1,1]);
  assert.equal(challengePoints(false,6),0);
});
