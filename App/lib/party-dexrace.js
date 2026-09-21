"use strict";

function normalizeRaceName(value) {
  return typeof value === 'string' ? value.slice(0, 100).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/œ/g, 'oe').replace(/♀/g, 'f').replace(/♂/g, 'm').replace(/[^a-z0-9]/g, '') : '';
}
function racePool(catalogue, gen) {
  return catalogue.filter(p => !p.isAltForm && p.id > 0 && p.id < 10000 && Number(p.gen || p.generation) === gen).sort((a,b) => a.id-b.id);
}
function raceStartError(room) {
  if (room.raceFormat !== 'teams') return room.players.length === 2 ? null : 'Le duel se joue à 2. Choisis deux équipes pour jouer à plusieurs.';
  const blue = room.players.filter(p => p.raceTeam === 'blue').length;
  const coral = room.players.filter(p => p.raceTeam === 'coral').length;
  return blue > 0 && blue === coral && blue + coral === room.players.length ? null : 'Choisissez deux équipes de même taille avant de lancer.';
}
function balanceRaceTeams(room) { room.players.forEach((p,i) => { p.raceTeam = i % 2 ? 'coral' : 'blue'; }); }
function startRace(room, catalogue) {
  const error = raceStartError(room);
  if (error) throw new Error(error);
  const pool = racePool(catalogue, Number(room.selectedGens?.[0] || 1));
  if (!pool.length) throw new Error('Cette génération est indisponible.');
  room.roundSerial = (room.roundSerial || 0) + 1;
  room.race = { pool, claims: new Map(), roster: room.players.map((p,i) => ({id:p.id,nickname:p.nickname,team:room.raceFormat === 'teams' ? p.raceTeam : i ? 'coral' : 'blue'})), endedReason: null };
  room.target = null;
  room.status = 'playing';
  room.totalRounds = 1;
  room.roundNumber = 1;
  for (const p of room.players) { p.score = 0; p.correct = false; p.lastGain = 0; }
}
function submitRace(room, player, payload, now = Date.now()) {
  if (!room.race || room.status !== 'playing' || (room.deadlineAt && now >= room.deadlineAt) || payload.code !== room.code || payload.roundSerial !== room.roundSerial) return {error:'Cette course est terminée ou a changé.'};
  const member = room.race.roster.find(p => p.id === player.id);
  if (!member || !player.connected) return {error:'Tu ne participes pas à cette course.'};
  const name = normalizeRaceName(payload.guess);
  const pokemon = name && room.race.pool.find(p => normalizeRaceName(p.name) === name);
  if (!pokemon) return {error:'Nom non reconnu dans cette génération. Vérifie le nom français.'};
  if (room.race.claims.has(pokemon.id)) return {duplicate:true,name:pokemon.name};
  // No asynchronous operation between the check and assignment: a case has one owner.
  room.race.claims.set(pokemon.id, {id:pokemon.id,name:pokemon.name,playerId:player.id,nickname:member.nickname,team:member.team});
  player.score = (Number(player.score) || 0) + 1;
  return {claimed:true,name:pokemon.name,full:room.race.claims.size === room.race.pool.length};
}
function raceMissingSide(room) {
  return ['blue','coral'].some(team => !room.race?.roster.some(member => member.team === team && room.players.some(p => p.id === member.id && p.connected)));
}
function publicRace(room) {
  if (!room.race) return null;
  const claims = [...room.race.claims.values()];
  return {mode:'dexrace',serverNow:Date.now(),roundSerial:room.roundSerial,format:room.raceFormat || 'duel',generation:room.selectedGens[0],ids:room.race.pool.map(p=>p.id),claims,endedReason:room.race.endedReason,
    roster:room.race.roster.map(p=>({...p,connected:room.players.some(live=>live.id===p.id && live.connected),score:claims.filter(c=>c.playerId===p.id).length})),
    scores:{blue:claims.filter(c=>c.team==='blue').length,coral:claims.filter(c=>c.team==='coral').length}};
}
module.exports = {normalizeRaceName,racePool,raceStartError,balanceRaceTeams,startRace,submitRace,raceMissingSide,publicRace};
