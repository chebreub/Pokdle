// Shared written questions for solo, Party and server-verified Quiz.
const QUIZ_QUESTIONS = [
  { question: "Quel type est immunisé aux attaques Dragon ?", options: ["Acier", "Fée", "Glace", "Psy"], answer: 1 },
  { question: "Quel Pokémon est le n° 384 du Pokédex National ?", options: ["Groudon", "Kyogre", "Rayquaza", "Deoxys"], answer: 2 },
  { question: "Quel Pokémon a une faiblesse x4 au type Combat ?", options: ["Tyranocif", "Milobellus", "Dracolosse", "Airmure"], answer: 0 },
  { question: "Quelle capacité augmente fortement l'Attaque Spéciale mais baisse la Défense Spéciale ?", options: ["Danse Draco", "Machination", "Vibra Soin", "Exuviation"], answer: 3 },
  { question: "Quel talent rend immunisé aux attaques Sol ?", options: ["Lévitation", "Fermeté", "Intimidation", "Technicien"], answer: 0 },
  { question: "Quel starter final de Sinnoh est de type Feu/Combat ?", options: ["Simiabraz", "Braségali", "Torterra", "Pingoléon"], answer: 0 },
  { question: "Quel Pokémon légendaire est de type Psy/Vol ?", options: ["Lugia", "Mewtwo", "Yveltal", "Dialga"], answer: 0 },
  { question: "Quel est le talent signature de Métamorph en français ?", options: ["Imposteur", "Mue", "Calque", "Synchro"], answer: 0 },
  { question: "Quel objet augmente la puissance des attaques super efficaces ?", options: ["Lunettes Choix", "Orbe Vie", "Veste de Combat", "Lentilscope"], answer: 1 },
  { question: "Dans les versions Rouge/Bleu, quel type n'avait aucune faiblesse ?", options: ["Normal", "Psy", "Combat", "Roche"], answer: 1 },
  { question: "Quel Pokémon est n° 25 du Pokédex ?", options: ["Raichu", "Pikachu", "Rondoudou", "Évoli"], answer: 1 },
  { question: "Quel duo de types est celui de Magnézone ?", options: ["Électrik/Acier", "Électrik/Vol", "Acier/Psy", "Acier/Dragon"], answer: 0 },
  { question: "Quel Pokémon possède la forme Originelle en Gen 4 ?", options: ["Dialga", "Giratina", "Palkia", "Darkrai"], answer: 1 },
  { question: "Quel type est super efficace contre le type Fée ?", options: ["Dragon", "Acier", "Ténèbres", "Spectre"], answer: 1 },
  { question: "Quel Pokémon évolue avec une Pierre Nuit ?", options: ["Kirlia", "Roserade", "Corboss", "Nostenfer"], answer: 2 },
  { question: "Quel est le type secondaire de Brutalibré ?", options: ["Vol", "Acier", "Ténèbres", "Psy"], answer: 0 },
  { question: "Quel Pokémon est de type Eau/Dragon en 9G ?", options: ["Lanssorien", "Serpente-Eau", "Hydragon", "Nigirigon"], answer: 1 },
  { question: "Quel statut réduit l'Attaque physique de moitié (hors talents/objets) ?", options: ["Paralysie", "Brûlure", "Gel", "Sommeil"], answer: 1 },
  { question: "Quelle statistique détermine l'ordre d'action par défaut ?", options: ["Attaque", "Défense", "Vitesse", "PV"], answer: 2 },
  { question: "Quel Pokémon est n° 150 du Pokédex ?", options: ["Mew", "Dracolosse", "Mewtwo", "Lugia"], answer: 2 },
];
if (typeof module !== "undefined" && module.exports) module.exports = QUIZ_QUESTIONS;
