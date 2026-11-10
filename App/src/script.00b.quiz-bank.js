// Shared written questions for solo, Party and server-verified Quiz.
// 9/11/2026 : 20 → 80 questions (à relire par Kayan). Chaque question a un niveau (2 moyen, 3 difficile)
// et une explication montrée avec la bonne réponse. 4 anciennes questions corrigées (voir la PR).
const QUIZ_QUESTIONS = [
  // ===== Les 20 d'origine (relues) =====
  { level: 2, question: "Quel type est immunisé aux attaques Dragon ?", options: ["Acier", "Fée", "Glace", "Psy"], answer: 1, explain: "Le type Fée ne prend aucun dégât des attaques Dragon." },
  { level: 3, question: "Quel Pokémon est le n° 384 du Pokédex National ?", options: ["Groudon", "Kyogre", "Rayquaza", "Deoxys"], answer: 2, explain: "Rayquaza est le n° 384 (Groudon 383, Kyogre 382, Deoxys 386)." },
  { level: 3, question: "Quel Pokémon a une faiblesse ×4 au type Combat ?", options: ["Tyranocif", "Milobellus", "Dracolosse", "Airmure"], answer: 0, explain: "Tyranocif est Roche / Ténèbres : Combat fait ×2 sur chaque type, donc ×4." },
  { level: 3, question: "Quelle capacité augmente l'Attaque, l'Attaque Spé. et la Vitesse, mais baisse les deux Défenses ?", options: ["Danse Draco", "Machination", "Vibra Soin", "Exuviation"], answer: 3, explain: "Exuviation : +2 en Attaque, Attaque Spé. et Vitesse, −1 en Défense et Défense Spé." },
  { level: 2, question: "Quel talent rend immunisé aux attaques Sol ?", options: ["Lévitation", "Fermeté", "Intimidation", "Technicien"], answer: 0, explain: "Avec Lévitation, le Pokémon flotte : les attaques Sol ne le touchent pas." },
  { level: 2, question: "Quel starter final de Sinnoh est de type Feu / Combat ?", options: ["Simiabraz", "Braségali", "Torterra", "Pingoléon"], answer: 0, explain: "Simiabraz (Sinnoh). Braségali est aussi Feu / Combat, mais il vient de Hoenn." },
  { level: 2, question: "Quel Pokémon légendaire est de type Psy / Vol ?", options: ["Lugia", "Mewtwo", "Yveltal", "Dialga"], answer: 0, explain: "Lugia est Psy / Vol. Mewtwo est Psy pur, Yveltal Ténèbres / Vol." },
  { level: 2, question: "Quel est le talent signature de Métamorph ?", options: ["Imposteur", "Mue", "Calque", "Synchro"], answer: 0, explain: "Avec Imposteur, Métamorph se transforme dès qu'il entre en combat." },
  { level: 3, question: "Quel objet augmente la puissance des attaques super efficaces ?", options: ["Ceinture Pro", "Orbe Vie", "Veste de Combat", "Lentilscope"], answer: 0, explain: "La Ceinture Pro renforce les attaques super efficaces. L'Orbe Vie renforce toutes les attaques mais coûte des PV." },
  { level: 3, question: "Dans Rouge et Bleu, quel type était le plus fort à cause d'un bug sur le type Spectre ?", options: ["Normal", "Psy", "Combat", "Roche"], answer: 1, explain: "Les attaques Spectre ne touchaient pas le type Psy à cause d'un bug : Psy n'avait presque aucune faiblesse." },
  { level: 2, question: "Quel Pokémon est le n° 25 du Pokédex ?", options: ["Raichu", "Pikachu", "Rondoudou", "Évoli"], answer: 1, explain: "Pikachu est le n° 25." },
  { level: 2, question: "Quels sont les types de Magnézone ?", options: ["Électrik / Acier", "Électrik / Vol", "Acier / Psy", "Acier / Dragon"], answer: 0, explain: "Magnézone, comme Magnéti et Magnéton, est Électrik / Acier." },
  { level: 3, question: "Quel Pokémon a une Forme Originelle dès la Gen 4 (Platine) ?", options: ["Dialga", "Giratina", "Palkia", "Darkrai"], answer: 1, explain: "Giratina prend sa Forme Originelle dans Platine. Dialga et Palkia n'ont la leur que dans Légendes Pokémon : Arceus." },
  { level: 2, question: "Quel type est super efficace contre le type Fée ?", options: ["Dragon", "Acier", "Ténèbres", "Spectre"], answer: 1, explain: "Fée craint l'Acier et le Poison." },
  { level: 3, question: "Que devient Cornèbre avec une Pierre Nuit ?", options: ["Corboss", "Nostenfer", "Noctunoir", "Corvaillus"], answer: 0, explain: "Cornèbre évolue en Corboss avec une Pierre Nuit." },
  { level: 2, question: "Quel est le type secondaire de Brutalibré ?", options: ["Vol", "Acier", "Ténèbres", "Psy"], answer: 0, explain: "Brutalibré est Combat / Vol." },
  { level: 3, question: "Quel Pokémon de la Gen 9 est de type Eau / Dragon ?", options: ["Serpente-Eau", "Oyacata", "Trioxhydre", "Lanssorien"], answer: 0, explain: "Serpente-Eau est Eau / Dragon. Oyacata est Eau, Trioxhydre Ténèbres / Dragon, Lanssorien Dragon / Spectre." },
  { level: 2, question: "Quel statut divise par deux l'Attaque physique (hors talents et objets) ?", options: ["Paralysie", "Brûlure", "Gel", "Sommeil"], answer: 1, explain: "Un Pokémon brûlé fait deux fois moins de dégâts avec ses attaques physiques." },
  { level: 2, question: "Quelle statistique décide qui attaque en premier ?", options: ["Attaque", "Défense", "Vitesse", "PV"], answer: 2, explain: "Le plus rapide agit en premier, sauf attaques prioritaires." },
  { level: 2, question: "Quel Pokémon est le n° 150 du Pokédex ?", options: ["Mew", "Dracolosse", "Mewtwo", "Lugia"], answer: 2, explain: "Mewtwo est le n° 150, Mew le n° 151." },

  // ===== Nouvelles questions (9/11/2026) =====
  // Types et faiblesses
  { level: 2, question: "Contre quel type les attaques Psy n'ont-elles aucun effet ?", options: ["Ténèbres", "Acier", "Spectre", "Psy"], answer: 0, explain: "Le type Ténèbres est immunisé contre les attaques Psy." },
  { level: 2, question: "Quel type est immunisé contre les attaques Électrik ?", options: ["Sol", "Roche", "Plante", "Dragon"], answer: 0, explain: "Le type Sol ne prend aucun dégât des attaques Électrik." },
  { level: 2, question: "Quel type est immunisé contre les attaques Poison ?", options: ["Acier", "Roche", "Spectre", "Sol"], answer: 0, explain: "Les attaques Poison n'ont aucun effet sur le type Acier." },
  { level: 2, question: "Contre quel type les attaques Normal n'ont-elles aucun effet ?", options: ["Spectre", "Roche", "Acier", "Psy"], answer: 0, explain: "Le type Spectre est immunisé contre Normal (et contre Combat)." },
  { level: 2, question: "Quel type est immunisé contre les attaques Sol ?", options: ["Vol", "Plante", "Insecte", "Eau"], answer: 0, explain: "Les attaques Sol ne touchent pas le type Vol." },
  { level: 2, question: "Quelle est la seule faiblesse du type Normal ?", options: ["Combat", "Roche", "Spectre", "Ténèbres"], answer: 0, explain: "Le type Normal ne craint que le type Combat." },
  { level: 2, question: "Quel type est super efficace contre le type Dragon ?", options: ["Glace", "Feu", "Eau", "Plante"], answer: 0, explain: "Dragon craint la Glace, le Dragon et la Fée." },
  { level: 2, question: "Parmi ces types, lequel est super efficace contre l'Acier ?", options: ["Feu", "Eau", "Électrik", "Plante"], answer: 0, explain: "L'Acier craint le Feu, le Combat et le Sol." },
  { level: 3, question: "Avant la Gen 6, quel Pokémon Ténèbres / Spectre n'avait aucune faiblesse ?", options: ["Ténéfix", "Mysdibule", "Spectrum", "Noctali"], answer: 0, explain: "Ténéfix n'avait aucune faiblesse jusqu'à l'arrivée du type Fée en Gen 6." },
  { level: 2, question: "Combien de types existe-t-il depuis la Gen 6 ?", options: ["15", "17", "18", "20"], answer: 2, explain: "18 types depuis l'arrivée du type Fée en Gen 6." },
  { level: 2, question: "Quel type est apparu en Gen 6 ?", options: ["Fée", "Acier", "Ténèbres", "Dragon"], answer: 0, explain: "Le type Fée arrive avec Pokémon X et Y." },
  { level: 3, question: "Quels types sont apparus en Gen 2 ?", options: ["Acier et Ténèbres", "Fée et Acier", "Ténèbres et Spectre", "Dragon et Fée"], answer: 0, explain: "Or et Argent ajoutent les types Acier et Ténèbres." },
  { level: 2, question: "Parmi ceux-ci, lequel est Spectre / Dragon ?", options: ["Giratina", "Dracaufeu", "Ectoplasma", "Altaria"], answer: 0, explain: "Giratina est Spectre / Dragon." },
  { level: 2, question: "Quels sont les types de Lucario ?", options: ["Combat / Acier", "Combat / Psy", "Acier / Ténèbres", "Combat / Normal"], answer: 0, explain: "Lucario est Combat / Acier." },
  { level: 2, question: "Parmi ceux-ci, lequel est Feu / Vol ?", options: ["Dracaufeu", "Arcanin", "Ponyta", "Feunard"], answer: 0, explain: "Dracaufeu est Feu / Vol, même s'il ressemble à un dragon." },

  // Évolutions
  { level: 2, question: "Que devient Évoli avec une Pierre Eau ?", options: ["Aquali", "Voltali", "Pyroli", "Givrali"], answer: 0, explain: "Pierre Eau → Aquali, Pierre Foudre → Voltali, Pierre Feu → Pyroli." },
  { level: 2, question: "Quelle évolution d'Évoli est de type Fée ?", options: ["Nymphali", "Mentali", "Givrali", "Phyllali"], answer: 0, explain: "Nymphali est l'évolution Fée d'Évoli (Gen 6)." },
  { level: 3, question: "Quelle évolution d'Évoli s'obtient avec le bonheur, la nuit ?", options: ["Noctali", "Mentali", "Nymphali", "Pyroli"], answer: 0, explain: "Bonheur la nuit → Noctali ; le jour → Mentali." },
  { level: 3, question: "Combien d'évolutions différentes Évoli a-t-il ?", options: ["6", "7", "8", "9"], answer: 2, explain: "8 : Aquali, Voltali, Pyroli, Mentali, Noctali, Phyllali, Givrali et Nymphali." },
  { level: 2, question: "Quelle pierre fait évoluer Pikachu ?", options: ["Pierre Foudre", "Pierre Lune", "Pierre Éclat", "Pierre Soleil"], answer: 0, explain: "Pikachu devient Raichu avec une Pierre Foudre." },
  { level: 2, question: "Comment évolue Pichu ?", options: ["Avec le bonheur", "Avec une Pierre Foudre", "Au niveau 20", "Par échange"], answer: 0, explain: "Pichu devient Pikachu quand il est très attaché à son Dresseur (bonheur)." },
  { level: 2, question: "Quel Pokémon évolue avec une Pierre Lune ?", options: ["Mélofée", "Pikachu", "Tiplouf", "Racaillou"], answer: 0, explain: "Mélofée devient Mélodelfe avec une Pierre Lune." },
  { level: 2, question: "De quel Pokémon Ectoplasma est-il l'évolution ?", options: ["Spectrum", "Fantominus", "Mimiqui", "Polichombr"], answer: 0, explain: "Fantominus → Spectrum → Ectoplasma (par échange)." },
  { level: 2, question: "Quel Pokémon évolue en Lucario ?", options: ["Riolu", "Machoc", "Debugant", "Ouisticram"], answer: 0, explain: "Riolu devient Lucario avec le bonheur, le jour." },
  { level: 2, question: "À quel niveau Magicarpe évolue-t-il en Léviator ?", options: ["10", "20", "30", "40"], answer: 1, explain: "Magicarpe devient Léviator au niveau 20." },
  { level: 3, question: "Quel objet, tenu pendant un échange, fait évoluer Onix en Steelix ?", options: ["Peau Métal", "Écaille Draco", "Roche Royale", "Améliorator"], answer: 0, explain: "Onix tenant une Peau Métal devient Steelix lors d'un échange." },
  { level: 3, question: "Quel objet fait évoluer Hypocéan en Hyporoi lors d'un échange ?", options: ["Écaille Draco", "Peau Métal", "Roche Royale", "Croc Dragon"], answer: 0, explain: "Hypocéan tenant une Écaille Draco devient Hyporoi lors d'un échange." },

  // Talents, attaques, objets
  { level: 2, question: "Quelle attaque paralyse la cible sans lui faire de dégâts ?", options: ["Cage-Éclair", "Tonnerre", "Fatal-Foudre", "Éclair"], answer: 0, explain: "Cage-Éclair paralyse la cible ; les trois autres font des dégâts." },
  { level: 2, question: "Quelle attaque endort la cible ?", options: ["Poudre Dodo", "Para-Spore", "Poudre Toxik", "Spore Coton"], answer: 0, explain: "Poudre Dodo endort. Para-Spore paralyse, Poudre Toxik empoisonne, Spore Coton baisse la Vitesse." },
  { level: 2, question: "Quelle attaque protège de presque toutes les attaques pendant un tour ?", options: ["Abri", "Reflet", "Mur Lumière", "Protection"], answer: 0, explain: "Abri bloque presque tout pendant un tour (moins de chances de réussir s'il est répété)." },
  { level: 2, question: "Que fait l'attaque Trempette de Magicarpe ?", options: ["Rien du tout", "Elle soigne", "Elle confond", "Elle baisse la Vitesse"], answer: 0, explain: "Trempette n'a aucun effet : « Mais rien ne se passe ! »." },
  { level: 2, question: "Quel objet tenu rend un peu de PV à chaque tour ?", options: ["Restes", "Orbe Vie", "Bandeau Choix", "Ceinture Force"], answer: 0, explain: "Les Restes rendent 1/16 des PV max à chaque tour." },
  { level: 3, question: "Quel objet évite d'être mis K.O. en un coup quand les PV sont pleins ?", options: ["Ceinture Force", "Bandeau", "Casque Brut", "Restes"], answer: 0, explain: "Avec la Ceinture Force, un Pokémon à PV pleins garde 1 PV au lieu d'être mis K.O. en un coup." },
  { level: 2, question: "Quel talent baisse l'Attaque des adversaires quand le Pokémon arrive en combat ?", options: ["Intimidation", "Pression", "Engrais", "Statik"], answer: 0, explain: "Intimidation baisse d'un cran l'Attaque des adversaires à l'entrée." },
  { level: 3, question: "Quel talent absorbe les attaques Feu et renforce celles du Pokémon ?", options: ["Torche", "Brasier", "Corps Ardent", "Sécheresse"], answer: 0, explain: "Torche : immunisé au Feu, et ses attaques Feu deviennent plus fortes après en avoir reçu une." },
  { level: 2, question: "Quel talent fait briller un grand soleil à l'entrée du Pokémon ?", options: ["Sécheresse", "Crachin", "Sable Volant", "Alerte Neige"], answer: 0, explain: "Sécheresse → soleil, Crachin → pluie, Sable Volant → tempête de sable, Alerte Neige → grêle / neige." },
  { level: 3, question: "Quel Pokémon a le talent Garde Mystik ?", options: ["Munja", "Ninjask", "Ningale", "Spectrum"], answer: 0, explain: "Munja ne peut être touché que par les attaques super efficaces grâce à Garde Mystik." },
  { level: 2, question: "Combien d'attaques un Pokémon peut-il connaître au maximum ?", options: ["4", "5", "6", "8"], answer: 0, explain: "4 attaques au maximum." },
  { level: 3, question: "Combien d'EV au maximum peut-on mettre sur une seule statistique (Gen 6 et après) ?", options: ["252", "255", "510", "100"], answer: 0, explain: "252 EV par statistique, 510 au total." },
  { level: 3, question: "Quelle est la valeur maximale d'un IV ?", options: ["31", "15", "63", "100"], answer: 0, explain: "Un IV va de 0 à 31 pour chaque statistique." },

  // Balls
  { level: 2, question: "Quelle Ball capture à coup sûr ?", options: ["Master Ball", "Hyper Ball", "Luxe Ball", "Rapide Ball"], answer: 0, explain: "La Master Ball ne rate jamais." },
  { level: 3, question: "Quelle Ball est la plus efficace au tout premier tour du combat ?", options: ["Rapide Ball", "Chrono Ball", "Sombre Ball", "Filet Ball"], answer: 0, explain: "Rapide Ball : très forte au 1er tour. Chrono Ball : meilleure au fil des tours. Sombre Ball : la nuit ou dans les grottes." },
  { level: 3, question: "Quelle Ball marche mieux sur les Pokémon Eau et Insecte ?", options: ["Filet Ball", "Scuba Ball", "Bis Ball", "Faiblo Ball"], answer: 0, explain: "La Filet Ball est plus efficace sur les types Eau et Insecte." },

  // Légendaires et jeux
  { level: 2, question: "Quel légendaire est sur la jaquette de Pokémon Or ?", options: ["Ho-Oh", "Lugia", "Celebi", "Suicune"], answer: 0, explain: "Ho-Oh pour Or, Lugia pour Argent, Suicune pour Cristal." },
  { level: 2, question: "Quel légendaire est sur la jaquette de Pokémon X ?", options: ["Xerneas", "Yveltal", "Zygarde", "Diancie"], answer: 0, explain: "Xerneas pour X, Yveltal pour Y." },
  { level: 2, question: "Quel légendaire est sur la jaquette de Pokémon Épée ?", options: ["Zacian", "Zamazenta", "Éthernatos", "Solgaleo"], answer: 0, explain: "Zacian pour Épée, Zamazenta pour Bouclier." },
  { level: 2, question: "Quel légendaire est sur la jaquette de Pokémon Écarlate ?", options: ["Koraidon", "Miraidon", "Pêchaminus", "Terapagos"], answer: 0, explain: "Koraidon pour Écarlate, Miraidon pour Violet." },
  { level: 2, question: "Lequel n'est pas un des trois oiseaux légendaires de Kanto ?", options: ["Ho-Oh", "Artikodin", "Électhor", "Sulfura"], answer: 0, explain: "Les trois oiseaux de Kanto : Artikodin, Électhor et Sulfura. Ho-Oh vient de Johto." },
  { level: 2, question: "Lequel ne fait pas partie des trois chiens légendaires de Johto ?", options: ["Arcanin", "Raikou", "Entei", "Suicune"], answer: 0, explain: "Raikou, Entei et Suicune. Arcanin n'est pas légendaire." },
  { level: 2, question: "Quel légendaire de Sinnoh maîtrise le temps ?", options: ["Dialga", "Palkia", "Giratina", "Arceus"], answer: 0, explain: "Dialga maîtrise le temps, Palkia l'espace." },
  { level: 3, question: "Quel Pokémon porte le n° 1025, le dernier du Pokédex National ?", options: ["Pêchaminus", "Terapagos", "Ogerpon", "Serpente-Eau"], answer: 0, explain: "Pêchaminus est le n° 1025 (DLC d'Écarlate et Violet)." },
  { level: 2, question: "Quel Pokémon porte le n° 151 ?", options: ["Mew", "Mewtwo", "Celebi", "Dracolosse"], answer: 0, explain: "Mew est le n° 151, le dernier de la Gen 1." },
  { level: 2, question: "Quel Pokémon porte le n° 1 du Pokédex ?", options: ["Bulbizarre", "Pikachu", "Salamèche", "Mew"], answer: 0, explain: "Bulbizarre ouvre le Pokédex National." },

  // Starters
  { level: 2, question: "Quel est le starter final Eau de Hoenn ?", options: ["Laggron", "Pingoléon", "Aligatueur", "Tortank"], answer: 0, explain: "Laggron (Eau / Sol), le dernier stade de Gobou." },
  { level: 2, question: "Quel est le starter Plante de Kalos ?", options: ["Marisson", "Brindibou", "Ouisticram", "Gruikui"], answer: 0, explain: "Marisson (Kalos). Brindibou vient d'Alola, Ouisticram de Sinnoh, Gruikui d'Unys." },
  { level: 2, question: "Quel est le starter Feu de Galar ?", options: ["Flambino", "Ouistempo", "Larméléon", "Poussifeu"], answer: 0, explain: "Flambino (Feu). Ouistempo est Plante, Larméléon Eau, Poussifeu vient de Hoenn." },
  { level: 2, question: "Quel est le starter Eau de Paldea ?", options: ["Coiffeton", "Poussacha", "Chochodile", "Tiplouf"], answer: 0, explain: "Coiffeton (Eau), Poussacha (Plante), Chochodile (Feu). Tiplouf vient de Sinnoh." },
  { level: 2, question: "Quel est le starter Feu de Johto ?", options: ["Héricendre", "Germignon", "Kaiminus", "Salamèche"], answer: 0, explain: "Héricendre (Feu), Germignon (Plante), Kaiminus (Eau)." },

  // Régions, personnages, équipes
  { level: 2, question: "Quelle région est inspirée de la France ?", options: ["Kalos", "Galar", "Unys", "Paldea"], answer: 0, explain: "Kalos (X et Y) s'inspire de la France, avec Illumis comme Paris." },
  { level: 2, question: "Quelle région est inspirée du Royaume-Uni ?", options: ["Galar", "Kalos", "Alola", "Sinnoh"], answer: 0, explain: "Galar (Épée et Bouclier) s'inspire du Royaume-Uni." },
  { level: 2, question: "Dans quelle région se passent Pokémon Soleil et Lune ?", options: ["Alola", "Hoenn", "Kalos", "Paldea"], answer: 0, explain: "Alola, inspirée d'Hawaï." },
  { level: 2, question: "Dans quelle région se passent Pokémon Rubis et Saphir ?", options: ["Hoenn", "Johto", "Sinnoh", "Kanto"], answer: 0, explain: "Hoenn (Gen 3)." },
  { level: 2, question: "Qui est le premier champion d'arène de Kanto ?", options: ["Pierre", "Ondine", "Major Bob", "Érika"], answer: 0, explain: "Pierre, à Argenta, avec des Pokémon Roche." },
  { level: 2, question: "Quelle championne d'Azuria utilise des Pokémon Eau ?", options: ["Ondine", "Érika", "Sabrina", "Jasmine"], answer: 0, explain: "Ondine, championne d'Azuria." },
  { level: 3, question: "Qui est la Maîtresse de la Ligue de Sinnoh ?", options: ["Cynthia", "Iris", "Dianthéa", "Pierre Rochard"], answer: 0, explain: "Cynthia, avec son célèbre Carchacrok." },
  { level: 2, question: "Comment s'appelle l'équipe ennemie de Rouge et Bleu ?", options: ["Team Rocket", "Team Galaxie", "Team Plasma", "Team Flare"], answer: 0, explain: "La Team Rocket, menée par Giovanni." },
  { level: 3, question: "Quelle équipe ennemie affronte-t-on dans Diamant et Perle ?", options: ["Team Galaxie", "Team Magma", "Team Skull", "Team Aqua"], answer: 0, explain: "La Team Galaxie, menée par Hélio." },
  { level: 3, question: "Quelle équipe ennemie affronte-t-on dans Noir et Blanc ?", options: ["Team Plasma", "Team Flare", "Team Rocket", "Team Yell"], answer: 0, explain: "La Team Plasma, qui veut « libérer » les Pokémon." },

  // Histoire de la série et règles
  { level: 3, question: "En quelle année sortent les premiers jeux Pokémon au Japon ?", options: ["1994", "1996", "1998", "1999"], answer: 1, explain: "Pokémon Rouge et Vert sortent au Japon en 1996 (1999 en France)." },
  { level: 3, question: "Qui a créé Pokémon ?", options: ["Satoshi Tajiri", "Shigeru Miyamoto", "Hideo Kojima", "Junichi Masuda"], answer: 0, explain: "Satoshi Tajiri, fondateur de Game Freak." },
  { level: 2, question: "Combien de Pokémon peut-on avoir dans son équipe ?", options: ["6", "5", "8", "10"], answer: 0, explain: "6 Pokémon au maximum dans l'équipe." },
  { level: 3, question: "Combien de formes différentes Zarbi a-t-il ?", options: ["26", "28", "30", "24"], answer: 1, explain: "28 : les 26 lettres, plus « ! » et « ? »." },
  { level: 3, question: "Quelle génération a introduit les Méga-Évolutions ?", options: ["Gen 5", "Gen 6", "Gen 7", "Gen 8"], answer: 1, explain: "Les Méga-Évolutions arrivent avec X et Y (Gen 6)." },
  { level: 3, question: "Quel phénomène de la Gen 9 peut changer le type d'un Pokémon ?", options: ["La Téracristallisation", "Le Dynamax", "La Méga-Évolution", "Les capacités Z"], answer: 0, explain: "La Téracristallisation (Écarlate et Violet) donne au Pokémon son type Téra." },

  // Records
  { level: 3, question: "Parmi ceux-ci, lequel a le plus de PV de base ?", options: ["Leuphorie", "Leveinard", "Ronflex", "Wailord"], answer: 0, explain: "PV de base : Leuphorie 255, Leveinard 250, Wailord 170, Ronflex 160." },
  { level: 3, question: "Parmi ceux-ci, lequel a la plus haute Défense de base ?", options: ["Caratroc", "Steelix", "Cizayox", "Galeking"], answer: 0, explain: "Défense de base : Caratroc 230, Steelix 200, Galeking 180, Cizayox 100." },
  { level: 3, question: "Parmi ceux-ci, lequel est le plus rapide ?", options: ["Ninjask", "Alakazam", "Jungko", "Arcanin"], answer: 0, explain: "Vitesse de base : Ninjask 160, Alakazam 120, Jungko 120, Arcanin 95." },
  { level: 2, question: "Parmi ceux-ci, lequel est le plus lourd ?", options: ["Groudon", "Ronflex", "Steelix", "Wailord"], answer: 0, explain: "Groudon 950 kg, Ronflex 460 kg, Steelix 400 kg, Wailord 398 kg." },
  { level: 2, question: "Parmi ceux-ci, lequel est le plus grand ?", options: ["Éthernatos", "Wailord", "Steelix", "Rayquaza"], answer: 0, explain: "Éthernatos 20 m, Wailord 14,5 m, Steelix 9,2 m, Rayquaza 7 m." },
];
if (typeof module !== "undefined" && module.exports) module.exports = QUIZ_QUESTIONS;
