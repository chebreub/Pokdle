"use strict";

// PART-01 — A join link is a pointer to a LIVE server room, not a permission,
// resume token, player identity, secret or guaranteed reservation.
// Returning public status without players/identities keeps preview safe.
const PARTY_INVITE_MAX_PLAYERS = 8;

function partyInviteStatus(room, expectedMode = null) {
  if (expectedMode !== null && expectedMode !== "dessin") {
    return { ok:false, errorCode:"invite_invalid", error:"Cette invitation n'est pas valide." };
  }
  if (!room) {
    return { ok:false, errorCode:"invite_expired", error:"Invitation expirée : ce salon n'existe plus. Demande un nouveau lien." };
  }
  // A hostless room is pending cleanup and is not a viable invitation.
  if (!(room.players || []).length) {
    return { ok:false, errorCode:"invite_expired", error:"Invitation expirée : l'hôte a quitté ce salon. Demande un nouveau lien." };
  }
  if (expectedMode && room.gameMode !== expectedMode) {
    return { ok:false, errorCode:"invite_game_changed", error:"L'hôte a changé de jeu. Demande une nouvelle invitation Dessine-le !" };
  }
  if (room.status !== "waiting") {
    return { ok:false, errorCode:"invite_started", error:"Cette partie a déjà commencé. Demande à l'hôte de rouvrir un salon." };
  }
  if ((room.players || []).length >= PARTY_INVITE_MAX_PLAYERS) {
    return { ok:false, errorCode:"invite_full", error:"Ce salon est complet (8 joueurs). Demande un autre lien." };
  }
  return {
    ok:true, code:room.code, gameMode:room.gameMode,
    // Never include player names, auth, scores, secret targets or reconnect tokens.
    seatsLeft:PARTY_INVITE_MAX_PLAYERS - (room.players || []).length,
  };
}

module.exports = {partyInviteStatus,PARTY_INVITE_MAX_PLAYERS};
