'use strict';
// Barème de la journée Pokédle : 100 points entiers, chaque épreuve compte
// directement sur son propre maximum (aucune conversion au moment du bilan).
const DAILY_MAX = Object.freeze({ enquiry:40, wordle:10, dossier:20, challenge:30 });
const DAILY_TOTAL = DAILY_MAX.enquiry + DAILY_MAX.wordle + DAILY_MAX.dossier + DAILY_MAX.challenge;

// Enquête : 40 au premier essai, −2 par essai supplémentaire, −4 par indice consulté,
// au moins 4 points quand le Pokémon est trouvé.
const ENQUIRY_TRY_COST = 2, ENQUIRY_HINT_COST = 4, ENQUIRY_FLOOR = 4;
function enquiryPoints(won, attempts, hintsUsed) {
  if (!won) return 0;
  const extra = Math.max(0, Number(attempts) - 1), hints = Math.max(0, Number(hintsUsed) || 0);
  return Math.max(ENQUIRY_FLOOR, DAILY_MAX.enquiry - ENQUIRY_TRY_COST * extra - ENQUIRY_HINT_COST * hints);
}

// Wordle : six essais, 10, 8, 6, 4, 2 puis 1 point selon l'essai gagnant.
const WORDLE_POINTS = Object.freeze([10, 8, 6, 4, 2, 1]);
function wordlePoints(won, attempts) {
  return won ? WORDLE_POINTS[Number(attempts) - 1] || 0 : 0;
}

// Dossier : 2 points par bonne réponse aux dix questions, soit 20 au maximum (décidé le
// 14/10/2026). Les dix questions bonus d'un sans-faute se jouent pour le plaisir ; un
// abandon rapporte 0 point.
const DOSSIER_POINTS_PER_ANSWER = 2;
function dossierPoints(answers, abandoned = false) {
  if (abandoned || !Array.isArray(answers)) return 0;
  return DOSSIER_POINTS_PER_ANSWER * answers.slice(0, 10).filter(answer => answer && answer.correct).length;
}

// Défi : dix Pokémon, 3 points au premier essai, 2 au deuxième ou au troisième, 1 ensuite.
function challengePoints(correct, attempts) {
  if (!correct) return 0;
  const n = Number(attempts);
  return n <= 1 ? 3 : n <= 3 ? 2 : 1;
}

// Mêmes règles pour les classements calculés en SQL.
const sql = {
  enquiry: (status, guessed, hints) => `(CASE WHEN ${status}='won' THEN GREATEST(${ENQUIRY_FLOOR},${DAILY_MAX.enquiry}-${ENQUIRY_TRY_COST}*GREATEST(0,jsonb_array_length(${guessed})-1)-${ENQUIRY_HINT_COST}*COALESCE(${hints},0)) ELSE 0 END)`,
  wordle: (status, guessed) => `(CASE WHEN ${status}='won' THEN COALESCE((ARRAY[${WORDLE_POINTS.join(',')}])[jsonb_array_length(${guessed})],0) ELSE 0 END)`,
  challengeAnswer: answer => `(CASE WHEN (${answer}->>'correct')::boolean THEN CASE WHEN (${answer}->>'attempts')::int<=1 THEN 3 WHEN (${answer}->>'attempts')::int<=3 THEN 2 ELSE 1 END ELSE 0 END)`,
  dossier: answers => `(${DOSSIER_POINTS_PER_ANSWER}*(SELECT count(*) FROM jsonb_array_elements(${answers}) WITH ORDINALITY d(value,n) WHERE d.n<=10 AND (d.value->>'correct')::boolean))::int`
};

module.exports = { DAILY_MAX, DAILY_TOTAL, WORDLE_POINTS, DOSSIER_POINTS_PER_ANSWER, enquiryPoints, wordlePoints, dossierPoints, challengePoints, sql };
