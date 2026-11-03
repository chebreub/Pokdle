'use strict';
// CI-only server: real economy routes + disposable PostgreSQL schema + built frontend.
// Never imported by App/server.js. Only QA_DATABASE_URL is accepted.
const path = require('node:path'), fs = require('node:fs'), {randomUUID} = require('node:crypto');
const appDir = path.resolve(__dirname,'../App');
const express = require(path.join(appDir,'node_modules/express'));
const {Pool} = require(path.join(appDir,'node_modules/pg'));
const {mountBallRoutes,initBallsDb} = require(path.join(appDir,'lib/poke-balls'));
(async()=>{
  if (!process.env.QA_DATABASE_URL) throw new Error('QA_DATABASE_URL required');
  const schema='browser_arcade_'+randomUUID().replaceAll('-','');
  const admin=new Pool({connectionString:process.env.QA_DATABASE_URL});
  await admin.query('CREATE SCHEMA '+schema);
  const db=new Pool({connectionString:process.env.QA_DATABASE_URL,options:'-c search_path='+schema});
  await initBallsDb(db);
  const app=express();
  const readCookies=req=>Object.fromEntries(String(req.headers.cookie||'').split(';').map(s=>s.trim().split('=')));
  const pokemon=JSON.parse(fs.readFileSync(path.join(appDir,'pokemon.js'),'utf8').match(/const POKEMON_LIST =\s*(\[[\s\S]*\]);/)[1]).filter(p=>[6,25,133].includes(p.id));
  mountBallRoutes({app,express,db,pokemon,secret:'isolated-browser-test-only',randomInt:()=>0,
    readCookies,getUser:req=>({id:readCookies(req).qa_user||'qa-default'})});
  app.use('/api',(req,res)=>res.status(503).json({ok:false,error:'unavailable'}));
  app.get('/',(req,res)=>res.sendFile(path.join(appDir,'dist/index.html')));
  app.use(express.static(appDir));
  const server=app.listen(3198,'127.0.0.1',()=>console.log('verified arcade QA ready'));
  process.on('SIGTERM',()=>server.close(async()=>{await db.end();await admin.query('DROP SCHEMA '+schema+' CASCADE');await admin.end();process.exit(0);}));
})().catch(e=>{console.error(e);process.exit(1);});
