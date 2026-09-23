
// Album missions V1 — 108 curated rewards, 12 per generation.
// The engine is deliberately data-driven: adding a mission should not require new gameplay code.
const ALBUM_MISSION_TIERS = {
  confirmed: { label: 'Confirmé', icon: '◆', weight: 1 },
  expert: { label: 'Expert', icon: '◆◆', weight: 2 },
  prestige: { label: 'Prestige', icon: '★', weight: 3 },
  legendary: { label: 'Légendaire', icon: '♛', weight: 4 },
  secret: { label: 'Secret', icon: '✦', weight: 5 }
};
const ALBUM_REGIONS = ['Kanto','Johto','Hoenn','Sinnoh','Unys','Kalos','Alola','Galar','Paldea'];
const AMR = {
  gen: (generation, goal, label) => ({ type: 'gen', generation, goal, label }),
  type: (value, goal, label) => ({ type: 'type', value, goal, label }),
  total: (goal, label) => ({ type: 'total', goal, label }),
  modes: (goal, label) => ({ type: 'modes', goal, label }),
  wins: (mode, goal, label) => ({ type: 'wins', mode, goal, label }),
  quick: (mode, attempts, goal, label) => ({ type: 'quick', mode, attempts, goal, label }),
  record: (field, goal, label) => ({ type: 'record', field, goal, label }),
  draft: (generation, goal, label) => ({ type: 'draft', generation, goal, label }),
  specific: (ids, goal, label) => ({ type: 'specific', ids, goal: goal || ids.length, label }),
  missions: (ids, label) => ({ type: 'missions', ids, goal: ids.length, label }),
  types: (goal, label) => ({ type: 'types', goal, label }),
  secret: (goal, label) => ({ type: 'secret', goal, label }),
  dexrace: (field, goal, label) => ({ type: 'dexrace', field, goal, label })
};
function albumMission(id, pokemonId, generation, tier, title, hint, reqs, options = {}) {
  return { id, pokemonId, generation, tier, title, hint, reqs, gated: options.gated !== false, hidden: Boolean(options.hidden) };
}
const ALBUM_MISSIONS = [
  // Gen 1 — Kanto
  albumMission('g1_venusaur',3,1,'expert','Racines profondes','La maîtrise vient d’une équipe qui connaît son terrain.',[AMR.gen(1,18),AMR.type('Plante',8)]),
  albumMission('g1_charizard',6,1,'prestige','La flamme du champion','Un grand favori ne se contente pas d’une seule bonne réponse.',[AMR.draft(1,500),AMR.type('Feu',8)]),
  albumMission('g1_blastoise',9,1,'expert','Précision hydro','Peu d’erreurs, beaucoup de sang-froid.',[AMR.quick('normal',3,3),AMR.type('Eau',8)]),
  albumMission('g1_alakazam',65,1,'prestige','Esprit supérieur','Résous vite, et surtout juste.',[AMR.quick('normal',4,5),AMR.record('quizHighScore',8,'Atteindre 8 au Quiz')]),
  albumMission('g1_gengar',94,1,'prestige','La silhouette dans l’ombre','Les Spectres se méritent en reconnaissant ce qui se cache.',[AMR.wins('silhouette',3),AMR.type('Spectre',6)]),
  albumMission('g1_gyarados',130,1,'expert','De l’insignifiant au redoutable','La patience finit par transformer une petite victoire en menace.',[AMR.total(35),AMR.type('Eau',10)]),
  albumMission('g1_snorlax',143,1,'expert','Poids lourd','Tout est une question de mesure.',[AMR.record('weightBattleHighScore',10,'Atteindre 10 au Duel de poids')]),
  albumMission('g1_dragonite',149,1,'prestige','Le dragon de Kanto','Une équipe solide et une vraie culture Dragon.',[AMR.draft(1,505),AMR.type('Dragon',6)]),
  albumMission('g1_articuno',144,1,'legendary','Ailes de glace','Kanto doit reconnaître ta maîtrise du froid.',[AMR.gen(1,35),AMR.type('Glace',6)]),
  albumMission('g1_zapdos',145,1,'legendary','Orage sur Kanto','Rapidité et puissance électrique.',[AMR.record('speedrunHighScore',11,'Atteindre 11 au Speedrun'),AMR.type('Électrik',7)]),
  albumMission('g1_moltres',146,1,'legendary','Brasier légendaire','La flamme doit être présente dans tout ton parcours.',[AMR.gen(1,35),AMR.type('Feu',8)]),
  albumMission('g1_mewtwo',150,1,'legendary','Le projet ultime','Les trois oiseaux ne sont qu’une étape.',[AMR.missions(['g1_articuno','g1_zapdos','g1_moltres'],'Obtenir les trois oiseaux légendaires'),AMR.draft(1,520),AMR.gen(1,50)]),

  // Gen 2 — Johto
  albumMission('g2_typhlosion',157,2,'expert','Feu sous pression','Garde le rythme sans perdre le contrôle.',[AMR.gen(2,14),AMR.type('Feu',8)]),
  albumMission('g2_feraligatr',160,2,'expert','Morsure parfaite','Les victoires propres comptent plus que les longues séries.',[AMR.quick('normal',4,4),AMR.type('Eau',8)]),
  albumMission('g2_espeon',196,2,'expert','Clarté mentale','Une bonne déduction doit arriver tôt.',[AMR.quick('normal',4,4),AMR.type('Psy',7)]),
  albumMission('g2_umbreon',197,2,'prestige','Dans l’ombre','Les modes sombres récompensent les joueurs réguliers.',[AMR.wins('silhouette',4),AMR.type('Ténèbres',7)]),
  albumMission('g2_scizor',212,2,'prestige','Acier rouge','L’évolution demande de connaître l’original et le métal.',[AMR.specific([123],1,'Avoir Insécateur dans l’album'),AMR.type('Acier',6)]),
  albumMission('g2_heracross',214,2,'expert','Force collective','La victoire compte aussi quand elle se partage.',[AMR.wins('party',2),AMR.type('Insecte',7)]),
  albumMission('g2_tyranitar',248,2,'prestige','Tempête de sable','Johto exige une vraie équipe de haut niveau.',[AMR.draft(2,500),AMR.type('Ténèbres',7)]),
  albumMission('g2_raikou',243,2,'legendary','Éclair fugitif','La vitesse ouvre la piste de Raikou.',[AMR.record('speedrunHighScore',12,'Atteindre 12 au Speedrun'),AMR.type('Électrik',7)]),
  albumMission('g2_entei',244,2,'legendary','Rugissement volcanique','Le feu et la victoire vont de pair.',[AMR.wins('party',4),AMR.type('Feu',9)]),
  albumMission('g2_suicune',245,2,'legendary','Eau cristalline','Une série propre vaut mieux qu’un marathon.',[AMR.quick('normal',3,4),AMR.type('Eau',10)]),
  albumMission('g2_lugia',249,2,'legendary','Gardien des abysses','Les trois fauves doivent reconnaître ton parcours.',[AMR.missions(['g2_raikou','g2_entei','g2_suicune'],'Obtenir Raikou, Entei et Suicune'),AMR.gen(2,40)]),
  albumMission('g2_hooh',250,2,'legendary','Arc-en-ciel de Johto','Maîtrise plusieurs familles de types avant d’atteindre le sommet.',[AMR.missions(['g2_raikou','g2_entei','g2_suicune'],'Obtenir les trois fauves légendaires'),AMR.types(12)]),

  // Gen 3 — Hoenn
  albumMission('g3_sceptile',254,3,'expert','Lame verte','Vitesse et maîtrise végétale.',[AMR.record('speedrunHighScore',10,'Atteindre 10 au Speedrun'),AMR.type('Plante',9)]),
  albumMission('g3_blaziken',257,3,'prestige','Brasier martial','Les victoires doivent s’enchaîner.',[AMR.wins('normal',5),AMR.type('Combat',7)]),
  albumMission('g3_swampert',260,3,'expert','Terrain sûr','Un parcours régulier entre Eau et Sol.',[AMR.gen(3,18),AMR.type('Sol',8)]),
  albumMission('g3_gardevoir',282,3,'prestige','Lecture des intentions','La déduction doit devenir une habitude.',[AMR.quick('normal',4,5),AMR.type('Psy',8)]),
  albumMission('g3_milotic',350,3,'prestige','Beauté cachée','La rareté se mérite par la constance.',[AMR.gen(3,28),AMR.type('Eau',12)]),
  albumMission('g3_absol',359,3,'expert','Présage','Anticipe avant d’avoir besoin de tous les indices.',[AMR.quick('normal',3,4),AMR.type('Ténèbres',7)]),
  albumMission('g3_flygon',330,3,'prestige','Vent du désert','Sol et Dragon doivent être familiers.',[AMR.type('Sol',9),AMR.type('Dragon',7)]),
  albumMission('g3_metagross',376,3,'prestige','Calcul parfait','La meilleure équipe de Hoenn demande des chiffres solides.',[AMR.draft(3,510),AMR.record('quizHighScore',9,'Atteindre 9 au Quiz')]),
  albumMission('g3_kyogre',382,3,'legendary','Le monde sous la pluie','Hoenn côté mer.',[AMR.gen(3,38),AMR.type('Eau',14)]),
  albumMission('g3_groudon',383,3,'legendary','Le monde sous le soleil','Hoenn côté terre.',[AMR.gen(3,38),AMR.type('Sol',10)]),
  albumMission('g3_rayquaza',384,3,'legendary','Maître des cieux','Le ciel ne s’ouvre qu’après la mer et la terre.',[AMR.missions(['g3_kyogre','g3_groudon'],'Obtenir Kyogre et Groudon'),AMR.draft(3,520),AMR.type('Dragon',9)]),
  albumMission('g3_deoxys',386,3,'secret','Signal venu d’ailleurs','Une présence change de forme quand ta maîtrise devient assez large.',[AMR.modes(7),AMR.types(14),AMR.gen(3,45)],{hidden:true}),

  // Gen 4 — Sinnoh
  albumMission('g4_torterra',389,4,'expert','Continent vivant','Sinnoh et les plantes doivent prendre racine.',[AMR.gen(4,16),AMR.type('Plante',10)]),
  albumMission('g4_infernape',392,4,'prestige','Flamme agile','Une série rapide et offensive.',[AMR.record('higherLowerHighScore',9,'Atteindre 9 à Higher or Lower'),AMR.type('Combat',8)]),
  albumMission('g4_empoleon',395,4,'expert','Empereur des eaux','Précision et acier.',[AMR.type('Eau',10),AMR.type('Acier',8)]),
  albumMission('g4_togekiss',468,4,'prestige','Série parfaite','La régularité finit par porter chance.',[AMR.quick('normal',3,5),AMR.type('Fée',6)]),
  albumMission('g4_lucario',448,4,'prestige','Épreuve de l’Aura','Trouve vite, joue juste, maîtrise le Combat.',[AMR.quick('normal',4,6),AMR.type('Combat',9)]),
  albumMission('g4_garchomp',445,4,'prestige','Prédateur de Sinnoh','Une équipe d’élite et une collection Dragon.',[AMR.draft(4,510),AMR.type('Dragon',9)]),
  albumMission('g4_darkrai',491,4,'secret','Cauchemar lucide','Les ombres deviennent lisibles quand ton œil s’habitue.',[AMR.wins('silhouette',6),AMR.type('Ténèbres',9),AMR.type('Spectre',8)],{hidden:true}),
  albumMission('g4_cresselia',488,4,'legendary','Lueur lunaire','Une série propre et sereine.',[AMR.quick('normal',3,5),AMR.gen(4,32)]),
  albumMission('g4_dialga',483,4,'legendary','Maître du temps','Les modes chronométrés doivent devenir naturels.',[AMR.record('speedrunHighScore',13,'Atteindre 13 au Speedrun'),AMR.record('higherLower60sHighScore',10,'Atteindre 10 en Higher/Lower 60s')]),
  albumMission('g4_palkia',484,4,'legendary','Maître de l’espace','Traverse plusieurs régions et plusieurs modes.',[AMR.modes(6),AMR.types(13),AMR.gen(4,36)]),
  albumMission('g4_giratina',487,4,'legendary','Monde Distorsion','Temps et espace doivent déjà être sous contrôle.',[AMR.missions(['g4_dialga','g4_palkia'],'Obtenir Dialga et Palkia'),AMR.type('Spectre',9)]),
  albumMission('g4_arceus',493,4,'secret','Au-dessus des types','Le dernier palier de Sinnoh embrasse presque tout le Pokédex.',[AMR.missions(['g4_giratina'],'Obtenir Giratina'),AMR.types(16),AMR.total(120)],{hidden:true}),

  // Gen 5 — Unys
  albumMission('g5_excadrill',530,5,'expert','Sous la surface','Sol, acier et précision.',[AMR.type('Sol',10),AMR.type('Acier',9)]),
  albumMission('g5_krookodile',553,5,'expert','Prédateur du désert','La maîtrise Ténèbres prend de l’ampleur.',[AMR.gen(5,18),AMR.type('Ténèbres',9)]),
  albumMission('g5_zoroark',571,5,'prestige','Illusion parfaite','Les apparences ne suffisent plus.',[AMR.wins('silhouette',5),AMR.quick('normal',4,4)]),
  albumMission('g5_chandelure',609,5,'prestige','Lumière spectrale','Une flamme étrange récompense les connaisseurs de Spectres.',[AMR.type('Spectre',10),AMR.type('Feu',10)]),
  albumMission('g5_haxorus',612,5,'prestige','Tranchant dragon','La collection Dragon devient sérieuse.',[AMR.type('Dragon',10),AMR.gen(5,24)]),
  albumMission('g5_volcarona',637,5,'prestige','Soleil vivant','Insecte et Feu réunis dans une vraie maîtrise.',[AMR.type('Insecte',9),AMR.type('Feu',11)]),
  albumMission('g5_hydreigon',635,5,'prestige','Trois têtes, une maîtrise','Le Draft Unys doit atteindre un niveau d’élite.',[AMR.draft(5,515),AMR.type('Dragon',11)]),
  albumMission('g5_reshiram',643,5,'legendary','La vérité','Unys doit être profondément explorée.',[AMR.gen(5,38),AMR.record('quizHighScore',10,'Atteindre 10 au Quiz')]),
  albumMission('g5_zekrom',644,5,'legendary','L’idéal','Vitesse, Électrik et exploration.',[AMR.gen(5,38),AMR.type('Électrik',10),AMR.record('speedrunHighScore',12,'Atteindre 12 au Speedrun')]),
  albumMission('g5_kyurem',646,5,'legendary','Le vide entre les deux','Vérité et idéal doivent se rencontrer.',[AMR.missions(['g5_reshiram','g5_zekrom'],'Obtenir Reshiram et Zekrom'),AMR.draft(5,520)]),
  albumMission('g5_victini',494,5,'secret','V pour victoire','Les séries gagnantes finissent par attirer une présence rare.',[AMR.wins('normal',10),AMR.wins('party',4),AMR.modes(6)],{hidden:true}),
  albumMission('g5_genesect',649,5,'secret','Projet antique','Technologie, fossiles et variété.',[AMR.specific([138,140,142],2,'Avoir deux fossiles de Kanto dans l’album'),AMR.modes(7),AMR.gen(5,42)],{hidden:true}),

  // Gen 6 — Kalos
  albumMission('g6_greninja',658,6,'prestige','Ninja de Kalos','La vitesse ne pardonne pas les hésitations.',[AMR.record('speedrunHighScore',14,'Atteindre 14 au Speedrun'),AMR.quick('normal',3,4)]),
  albumMission('g6_talonflame',663,6,'expert','Premier dans le ciel','Rapidité et Vol.',[AMR.record('higherLowerHighScore',10,'Atteindre 10 à Higher or Lower'),AMR.type('Vol',10)]),
  albumMission('g6_sylveon',700,6,'prestige','Lien féerique','La collection Fée doit être bien installée.',[AMR.type('Fée',10),AMR.modes(5)]),
  albumMission('g6_aegislash',681,6,'prestige','Attaque ou défense','Une bonne culture des statistiques avant la récompense.',[AMR.record('quizHighScore',9,'Atteindre 9 au Quiz'),AMR.type('Acier',10),AMR.type('Spectre',9)]),
  albumMission('g6_hawlucha',701,6,'expert','Entrée spectaculaire','La compétition amicale compte.',[AMR.wins('party',3),AMR.type('Combat',10)]),
  albumMission('g6_goodra',706,6,'prestige','Dragon tendre','Une maîtrise Dragon sans brutalité.',[AMR.type('Dragon',11),AMR.gen(6,24)]),
  albumMission('g6_noivern',715,6,'expert','Écho nocturne','Vitesse et Vol dans plusieurs parties.',[AMR.wins('cry',2),AMR.type('Vol',11)]),
  albumMission('g6_xerneas',716,6,'legendary','Cycle de vie','Les types doivent se diversifier.',[AMR.gen(6,34),AMR.types(14)]),
  albumMission('g6_yveltal',717,6,'legendary','Ailes de destruction','La maîtrise Ténèbres doit être réelle.',[AMR.gen(6,34),AMR.type('Ténèbres',10)]),
  albumMission('g6_zygarde',718,6,'legendary','Équilibre parfait','Vie et destruction doivent déjà être réunies.',[AMR.missions(['g6_xerneas','g6_yveltal'],'Obtenir Xerneas et Yveltal'),AMR.gen(6,42),AMR.draft(6,515)]),
  albumMission('g6_diancie',719,6,'secret','Éclat sous pression','Les pierres précieuses apparaissent aux collections solides.',[AMR.type('Roche',9),AMR.total(150)],{hidden:true}),
  albumMission('g6_hoopa',720,6,'secret','Portails impossibles','Voyage entre les régions et les modes.',[AMR.modes(8),AMR.types(15),AMR.total(170)],{hidden:true}),

  // Gen 7 — Alola
  albumMission('g7_decidueye',724,7,'expert','Flèche silencieuse','Précision et Spectre.',[AMR.quick('normal',4,4),AMR.type('Spectre',10)]),
  albumMission('g7_incineroar',727,7,'prestige','Show de combat','Combat, Feu et victoires.',[AMR.wins('party',4),AMR.type('Combat',10),AMR.type('Feu',11)]),
  albumMission('g7_primarina',730,7,'expert','Mélodie marine','Eau et culture sonore.',[AMR.wins('cry',3),AMR.type('Eau',13)]),
  albumMission('g7_lycanroc',745,7,'expert','Entre jour et nuit','Roche et régularité.',[AMR.type('Roche',10),AMR.gen(7,18)]),
  albumMission('g7_golisopod',768,7,'expert','Ne plus fuir','Les victoires finissent par remplacer la fuite.',[AMR.wins('normal',6),AMR.type('Insecte',10)]),
  albumMission('g7_mimikyu',778,7,'secret','Sous le costume','Une silhouette te suit, mais ne veut pas être reconnue trop vite.',[AMR.wins('silhouette',7),AMR.type('Spectre',11),AMR.gen(7,25)],{hidden:true}),
  albumMission('g7_kommoo',784,7,'prestige','Écailles résonnantes','Dragon et Combat à haut niveau.',[AMR.type('Dragon',12),AMR.type('Combat',11)]),
  albumMission('g7_silvally',773,7,'prestige','Toutes les mémoires','Presque tous les types doivent avoir une place dans ton album.',[AMR.types(15),AMR.gen(7,30)]),
  albumMission('g7_solgaleo',791,7,'legendary','Soleil d’Alola','Une collection lumineuse et solide.',[AMR.gen(7,38),AMR.type('Acier',11)]),
  albumMission('g7_lunala',792,7,'legendary','Lune d’Alola','Le ciel nocturne récompense les Spectres.',[AMR.gen(7,38),AMR.type('Spectre',12)]),
  albumMission('g7_necrozma',800,7,'legendary','Lumière volée','Le Soleil et la Lune doivent être réunis.',[AMR.missions(['g7_solgaleo','g7_lunala'],'Obtenir Solgaleo et Lunala'),AMR.draft(7,515)]),
  albumMission('g7_marshadow',802,7,'secret','Dans ton ombre','Plusieurs disciplines, aucune mise en lumière.',[AMR.wins('silhouette',8),AMR.type('Combat',12),AMR.modes(7)],{hidden:true}),

  // Gen 8 — Galar
  albumMission('g8_cinderace',815,8,'prestige','Frappe éclair','La vitesse devient une spécialité.',[AMR.record('speedrunHighScore',14,'Atteindre 14 au Speedrun'),AMR.type('Feu',12)]),
  albumMission('g8_inteleon',818,8,'expert','Tir de précision','Les victoires rapides sont la clé.',[AMR.quick('normal',3,5),AMR.type('Eau',13)]),
  albumMission('g8_corviknight',823,8,'expert','Armure du ciel','Vol et Acier en équilibre.',[AMR.type('Vol',12),AMR.type('Acier',12)]),
  albumMission('g8_toxtricity',849,8,'prestige','Volume maximum','Les cris et l’Électrik se répondent.',[AMR.wins('cry',4),AMR.type('Électrik',12)]),
  albumMission('g8_hatterene',858,8,'expert','Silence psychique','Déduction et Psy.',[AMR.quick('normal',4,5),AMR.type('Psy',11)]),
  albumMission('g8_grimmsnarl',861,8,'prestige','Conte sombre','Fée et Ténèbres réunis.',[AMR.type('Fée',11),AMR.type('Ténèbres',12)]),
  albumMission('g8_falinks',870,8,'prestige','Tous ensemble','La Course au Pokédex récompense une vraie victoire collective.',[AMR.dexrace('teamWins',1,'Gagner une Course au Pokédex en équipe'),AMR.dexrace('balancedWins',1,'Gagner avec chaque coéquipier ayant marqué')]),
  albumMission('g8_dracovish',882,8,'expert','Fossile improbable','Les fossiles et l’Eau finissent par former quelque chose d’étrange.',[AMR.specific([138,140,142,345,347,408,410,564,566,696,698],4,'Avoir 4 fossiles différents dans l’album'),AMR.type('Eau',14)]),
  albumMission('g8_dragapult',887,8,'prestige','Projectile fantôme','Galar exige un Draft d’élite et des Spectres.',[AMR.draft(8,520),AMR.type('Spectre',12)]),
  albumMission('g8_zacian',888,8,'legendary','Lame couronnée','Une grande maîtrise Acier et Galar.',[AMR.gen(8,40),AMR.type('Acier',13)]),
  albumMission('g8_zamazenta',889,8,'legendary','Bouclier couronné','Défense, Combat et Galar.',[AMR.gen(8,40),AMR.type('Combat',13)]),
  albumMission('g8_eternatus',890,8,'legendary','Énergie infinie','Épée et Bouclier doivent déjà être réunis.',[AMR.missions(['g8_zacian','g8_zamazenta'],'Obtenir Zacian et Zamazenta'),AMR.draft(8,525),AMR.gen(8,48)]),

  // Gen 9 — Paldea
  albumMission('g9_meowscarada',908,9,'prestige','Tour de passe-passe','Déduction rapide et Plante.',[AMR.quick('normal',4,5),AMR.type('Plante',12)]),
  albumMission('g9_skeledirge',911,9,'expert','Chant ardent','Feu et cris reconnus.',[AMR.wins('cry',4),AMR.type('Feu',13)]),
  albumMission('g9_quaquaval',914,9,'expert','Danse du courant','Vitesse, Eau et Combat.',[AMR.record('higherLowerHighScore',10,'Atteindre 10 à Higher or Lower'),AMR.type('Eau',14)]),
  albumMission('g9_annihilape',979,9,'prestige','Colère accumulée','L’évolution de Colossinge ne vient qu’après un vrai parcours Combat.',[AMR.specific([57],1,'Avoir Colossinge dans l’album'),AMR.type('Combat',13)]),
  albumMission('g9_tinkaton',959,9,'prestige','Marteau de prestige','Fée et Acier doivent être très présents.',[AMR.type('Fée',12),AMR.type('Acier',13)]),
  albumMission('g9_kingambit',983,9,'prestige','Le dernier général','Une ancienne lignée doit précéder le chef.',[AMR.specific([625],1,'Avoir Scalproie dans l’album'),AMR.type('Ténèbres',13)]),
  albumMission('g9_baxcalibur',998,9,'prestige','Dragon de glace','Le Draft Paldea doit atteindre le très haut niveau.',[AMR.draft(9,520),AMR.type('Dragon',13)]),
  albumMission('g9_roaringmoon',1005,9,'prestige','Écho du passé','Les Dragons et les découvertes de Paldea ouvrent la voie.',[AMR.gen(9,32),AMR.type('Dragon',14)]),
  albumMission('g9_ironvaliant',1006,9,'prestige','Lame du futur','Fée, Combat et Paldea.',[AMR.gen(9,32),AMR.type('Fée',13),AMR.type('Combat',13)]),
  albumMission('g9_koraidon',1007,9,'legendary','Route du passé','Paldea, puissance et exploration.',[AMR.missions(['g9_roaringmoon'],'Obtenir Rugit-Lune'),AMR.gen(9,44),AMR.draft(9,520)]),
  albumMission('g9_miraidon',1008,9,'legendary','Route du futur','Paldea, vitesse et Électrik.',[AMR.missions(['g9_ironvaliant'],'Obtenir Garde-de-Fer'),AMR.gen(9,44),AMR.type('Électrik',13)]),
  albumMission('g9_terapagos',1024,9,'secret','Le cœur des types','Passé et futur convergent vers une maîtrise presque totale.',[AMR.missions(['g9_koraidon','g9_miraidon'],'Obtenir Koraidon et Miraidon'),AMR.types(17),AMR.total(220)],{hidden:true})
];
let albumMissionLimit = 12;

function normalizeAlbumMissionClaims(raw) {
  const clean = {};
  const valid = new Set(ALBUM_MISSIONS.map(m => m.id));
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return clean;
  for (const [id, at] of Object.entries(raw)) if (valid.has(id) && Number.isFinite(Number(at)) && Number(at) > 0) clean[id] = Math.min(Number(at), Date.now());
  return clean;
}
function cleanCounterMap(raw) {
  const out = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  for (const [key,value] of Object.entries(raw)) {
    const n = Math.max(0, Math.floor(Number(value) || 0));
    if (n > 0 && /^[a-z0-9_-]{1,40}$/i.test(key)) out[key] = Math.min(n, 100000);
  }
  return out;
}
function normalizeAlbumMissionStats(raw) {
  return {
    seeded: raw?.seeded === true,
    modeWins: cleanCounterMap(raw?.modeWins),
    quick3: cleanCounterMap(raw?.quick3),
    quick5: cleanCounterMap(raw?.quick5),
    dexraceWins: Math.max(0, Math.floor(Number(raw?.dexraceWins) || 0)),
    dexraceTeamWins: Math.max(0, Math.floor(Number(raw?.dexraceTeamWins) || 0)),
    dexraceBalancedWins: Math.max(0, Math.floor(Number(raw?.dexraceBalancedWins) || 0)),
    dexraceClaimsMax: Math.max(0, Math.floor(Number(raw?.dexraceClaimsMax) || 0)),
    dexraceSeen: Array.isArray(raw?.dexraceSeen) ? [...new Set(raw.dexraceSeen.filter(v => typeof v === 'string' && v.length <= 40))].slice(-30) : []
  };
}
function ensureAlbumMissionStats(seed = true) {
  if (!playerProfile.albumMissionStats) playerProfile.albumMissionStats = normalizeAlbumMissionStats(null);
  const stats = playerProfile.albumMissionStats;
  if (seed && !stats.seeded) {
    stats.seeded = true;
    for (const entry of Array.isArray(matchHistory) ? matchHistory : []) trackAlbumMissionHistoryEntry(entry, stats);
  }
  return stats;
}
function trackAlbumMissionHistoryEntry(entry, stats = ensureAlbumMissionStats(false)) {
  if (!entry || entry.result !== 'win') return false;
  const mode = String(entry.mode || 'normal').slice(0,40);
  stats.modeWins[mode] = (stats.modeWins[mode] || 0) + 1;
  const attempts = Number(entry.attempts) || 0;
  if (attempts > 0 && attempts <= 5) stats.quick5[mode] = (stats.quick5[mode] || 0) + 1;
  if (attempts > 0 && attempts <= 3) stats.quick3[mode] = (stats.quick3[mode] || 0) + 1;
  return true;
}
function recordAlbumMissionEvent(kind, payload = {}) {
  const stats = ensureAlbumMissionStats();
  if (kind !== 'dexraceComplete') return false;
  const key = String(payload.key || '').slice(0,40);
  if (!key || stats.dexraceSeen.includes(key)) return false;
  stats.dexraceSeen.push(key); stats.dexraceSeen = stats.dexraceSeen.slice(-30);
  stats.dexraceClaimsMax = Math.max(stats.dexraceClaimsMax, Math.max(0, Math.floor(Number(payload.score) || 0)));
  if (payload.won) stats.dexraceWins += 1;
  if (payload.won && payload.format === 'teams') stats.dexraceTeamWins += 1;
  if (payload.won && payload.format === 'teams' && payload.balanced) stats.dexraceBalancedWins += 1;
  try { saveProfile(); } catch (_e) {}
  return true;
}
if (typeof recordMatchHistory === 'function') {
  const recordMatchHistoryBeforeAlbumMissions = recordMatchHistory;
  recordMatchHistory = function (entry) {
    const stats = ensureAlbumMissionStats();
    const result = recordMatchHistoryBeforeAlbumMissions(entry);
    if (trackAlbumMissionHistoryEntry(entry, stats)) {
      try { saveProfile(); } catch (_e) {}
    }
    return result;
  };
}

function albumMissionCatalogue() {
  if (typeof getPokemonUiList === 'function') return getPokemonUiList({ includeAltForms: false }).filter(p => !p.isAltForm);
  if (typeof POKEMON_BY_ID !== 'undefined') return [...POKEMON_BY_ID.values()].filter(p => !p.isAltForm);
  return [];
}
function albumMissionDiscoveries() { return playerProfile?.discoveries || {}; }
function albumMissionFoundPokemon() {
  const discoveries = albumMissionDiscoveries();
  const byId = typeof POKEMON_BY_ID !== 'undefined' ? POKEMON_BY_ID : new Map();
  return Object.keys(discoveries).map(Number).map(id => byId.get(id)).filter(Boolean);
}
function albumMissionClaimed(id) { return Boolean(playerProfile?.albumMissionClaims?.[id]); }
function albumMissionById(id) { return ALBUM_MISSIONS.find(m => m.id === id) || null; }
function getAlbumMissionGate(pokemonId) {
  const id = Number(pokemonId);
  return ALBUM_MISSIONS.find(m => m.gated && m.pokemonId === id) || null;
}
function isAlbumMissionGated(pokemonId) { return Boolean(getAlbumMissionGate(pokemonId)); }
function isAlbumMissionClaimedForPokemon(pokemonId) {
  const gate = getAlbumMissionGate(pokemonId);
  return !gate || albumMissionClaimed(gate.id);
}
function albumMissionTypeSet() {
  const types = new Set();
  for (const p of albumMissionFoundPokemon()) {
    if (p.type1 && p.type1 !== 'Aucun') types.add(p.type1);
    if (p.type2 && p.type2 !== 'Aucun') types.add(p.type2);
  }
  return types;
}
function albumMissionReqState(req) {
  const found = albumMissionFoundPokemon(), discoveries = albumMissionDiscoveries(), stats = ensureAlbumMissionStats();
  let value = 0;
  if (req.type === 'total') value = found.length;
  if (req.type === 'gen') value = found.filter(p => Number(p.gen) === Number(req.generation)).length;
  if (req.type === 'type') value = found.filter(p => p.type1 === req.value || p.type2 === req.value).length;
  if (req.type === 'specific') value = req.ids.filter(id => discoveries[id]).length;
  if (req.type === 'modes') value = Object.values(stats.modeWins).filter(Number).length;
  if (req.type === 'wins') value = Number(stats.modeWins[req.mode]) || 0;
  if (req.type === 'quick') value = Number((req.attempts <= 3 ? stats.quick3 : stats.quick5)[req.mode]) || 0;
  if (req.type === 'record') value = Number(playerProfile?.[req.field]) || 0;
  if (req.type === 'draft') value = Number(playerProfile?.draftScoreAttackRecords?.[req.generation]) || 0;
  if (req.type === 'missions') value = req.ids.filter(albumMissionClaimed).length;
  if (req.type === 'types') value = albumMissionTypeSet().size;
  if (req.type === 'secret') value = Object.keys(playerProfile?.secrets?.claimed || {}).length;
  if (req.type === 'dexrace') {
    const fieldMap = { wins:'dexraceWins', teamWins:'dexraceTeamWins', balancedWins:'dexraceBalancedWins', claimsMax:'dexraceClaimsMax' };
    value = Number(stats[fieldMap[req.field]]) || 0;
  }
  return { value: Math.max(0, value), goal: Math.max(1, Number(req.goal) || 1), done: value >= req.goal };
}
function albumMissionRequirementLabel(req) {
  if (req.label) return req.label;
  if (req.type === 'gen') return `${req.goal} Pokémon de ${ALBUM_REGIONS[req.generation - 1] || 'la génération'} dans l’album`;
  if (req.type === 'type') return `${req.goal} Pokémon de type ${req.value}`;
  if (req.type === 'total') return `${req.goal} Pokémon découverts au total`;
  if (req.type === 'modes') return `Gagner dans ${req.goal} modes différents`;
  if (req.type === 'wins') return `${req.goal} victoire(s) en ${typeof modeLabelFr === 'function' ? modeLabelFr(req.mode) : req.mode}`;
  if (req.type === 'quick') return `${req.goal} victoire(s) en ≤ ${req.attempts} essai(s)`;
  if (req.type === 'draft') return `Score Draft Gen ${req.generation} ≥ ${req.goal}`;
  if (req.type === 'specific') return `${req.goal} prérequis Pokémon`;
  if (req.type === 'missions') return `${req.goal} mission(s) préalable(s)`;
  if (req.type === 'types') return `${req.goal} types différents représentés dans l’album`;
  if (req.type === 'secret') return `${req.goal} rencontre(s) secrète(s)`;
  if (req.type === 'dexrace') return `Objectif Course au Pokédex : ${req.goal}`;
  return 'Objectif de mission';
}
function albumMissionState(mission) {
  const reqs = mission.reqs.map(req => ({ req, ...albumMissionReqState(req) }));
  const done = reqs.filter(r => r.done).length;
  return { reqs, done, total: reqs.length, ready: reqs.length > 0 && done === reqs.length, claimed: albumMissionClaimed(mission.id) };
}
function normalizeMissionRewardEntry(entry, missionId, at) {
  entry.missions ||= {};
  entry.missions[missionId] = Math.min(Number(at) || Date.now(), Date.now());
}
function claimAlbumMission(id, now = Date.now()) {
  const mission = albumMissionById(id);
  if (!mission) return false;
  playerProfile.albumMissionClaims ||= {};
  if (playerProfile.albumMissionClaims[id]) return false;
  const state = albumMissionState(mission);
  if (!state.ready) return false;
  const pokemon = POKEMON_BY_ID.get(mission.pokemonId);
  if (!pokemon) return false;
  playerProfile.discoveries ||= {};
  if (!playerProfile.discoveries[pokemon.id]) addDiscovery(playerProfile.discoveries, pokemon, 'mission', now, 'mission');
  normalizeMissionRewardEntry(playerProfile.discoveries[pokemon.id], mission.id, now);
  playerProfile.albumMissionClaims[id] = Math.min(Number(now) || Date.now(), Date.now());
  saveProfile();
  if (typeof renderPartner === 'function') renderPartner();
  if (typeof renderDiscoveryAlbum === 'function') renderDiscoveryAlbum();
  if (typeof celebrateAlbumMission === 'function') celebrateAlbumMission(mission, pokemon);
  else if (typeof showToast === 'function') showToast(`${pokemon.name} rejoint ton album · mission « ${mission.title} »`);
  return true;
}
function albumMissionTierLabel(mission) {
  const tier = ALBUM_MISSION_TIERS[mission.tier] || ALBUM_MISSION_TIERS.confirmed;
  return `${tier.icon} ${tier.label}`;
}
function albumMissingHintHtml(pokemon) {
  const mission = getAlbumMissionGate(pokemon?.id);
  if (!mission || albumMissionClaimed(mission.id)) return '<span class="album-date">Un prochain mystère…</span>';
  return `<span class="album-date album-mission-lock">${escapeHtml(albumMissionTierLabel(mission))} · mission requise</span><button type="button" class="btn-ghost" data-action="focusAlbumMission" data-args='["${mission.id}"]'>Voir la mission →</button>`;
}
function ensureAlbumMissionPanel() {
  const host = document.getElementById('profile-album');
  if (!host || document.getElementById('album-mission-panel')) return;
  const panel = document.createElement('section');
  panel.id = 'album-mission-panel';
  panel.className = 'album-mission-panel';
  panel.innerHTML = `
    <div class="album-mission-head"><div><span class="adventure-eyebrow">MISSIONS DE COLLECTION</span><h3>Les Pokémon trophées se méritent.</h3><p>108 missions, 12 par génération. Les anciennes cartes déjà acquises restent à toi.</p></div><div id="album-mission-summary" class="album-mission-summary"></div></div>
    <div class="album-mission-filters">
      <label>Génération<select id="album-mission-gen"><option value="all">Toutes</option>${ALBUM_REGIONS.map((r,i)=>`<option value="${i+1}">Gen ${i+1} · ${r}</option>`).join('')}</select></label>
      <label>Niveau<select id="album-mission-tier"><option value="all">Tous</option>${Object.entries(ALBUM_MISSION_TIERS).map(([id,t])=>`<option value="${id}">${t.label}</option>`).join('')}</select></label>
      <label>État<select id="album-mission-status"><option value="active">À accomplir</option><option value="ready">À réclamer</option><option value="claimed">Obtenues</option><option value="all">Toutes</option></select></label>
    </div>
    <div id="album-mission-grid" class="album-mission-grid"></div>
    <button id="album-mission-more" type="button" class="btn-ghost album-mission-more hidden" data-action="showMoreAlbumMissions">Afficher plus</button>`;
  const before = host.querySelector('.album-region-disclosure');
  host.insertBefore(panel, before || host.firstChild);
  for (const id of ['album-mission-gen','album-mission-tier','album-mission-status']) document.getElementById(id)?.addEventListener('change', () => { albumMissionLimit = 12; renderAlbumMissions(); });
}
function albumMissionCard(mission) {
  const state = albumMissionState(mission), pokemon = POKEMON_BY_ID.get(mission.pokemonId);
  if (!pokemon) return '';
  const hidden = mission.hidden && !state.ready && !state.claimed;
  const tier = ALBUM_MISSION_TIERS[mission.tier] || ALBUM_MISSION_TIERS.confirmed;
  const reward = hidden ? '<span class="album-mission-mystery" aria-hidden="true">?</span>' : partnerImage(pokemon,'album-mission-sprite');
  const reqs = hidden && state.done === 0
    ? '<p class="album-mission-secret-copy">Les détails apparaîtront quand tu commenceras à suivre la piste.</p>'
    : '<ul class="album-mission-reqs">' + state.reqs.map(item => `<li class="${item.done ? 'is-done' : ''}"><span>${item.done ? '✓' : '○'} ${escapeHtml(albumMissionRequirementLabel(item.req))}</span><b>${Math.min(item.value,item.goal)}/${item.goal}</b></li>`).join('') + '</ul>';
  const action = state.claimed
    ? `<button type="button" class="btn-ghost" data-action="viewAlbumMissionReward" data-args='["${mission.id}"]'>Voir dans l’album →</button>`
    : state.ready
      ? `<button type="button" class="btn-blue" data-action="claimAlbumMission" data-args='["${mission.id}"]'>Réclamer ${escapeHtml(pokemon.name)} →</button>`
      : '';
  return `<article id="album-mission-${mission.id}" class="album-mission-card tier-${mission.tier} ${state.ready ? 'is-ready' : ''} ${state.claimed ? 'is-claimed' : ''}">
    <div class="album-mission-top"><span class="album-mission-tier">${tier.icon} ${tier.label}</span><span>Gen ${mission.generation}</span></div>
    <div class="album-mission-reward">${reward}<div><small>${state.claimed ? 'OBTENU' : state.ready ? 'RÉCOMPENSE PRÊTE' : hidden ? 'POKÉMON SECRET' : 'RÉCOMPENSE'}</small><h4>${hidden ? '???' : escapeHtml(pokemon.name)}</h4><span>${escapeHtml(mission.title)}</span></div></div>
    <p>${escapeHtml(mission.hint)}</p>
    <progress max="${state.total}" value="${state.done}" aria-label="Progression ${escapeHtml(mission.title)}"></progress>
    ${reqs}${action}
  </article>`;
}
function renderAlbumMissions() {
  const grid = document.getElementById('album-mission-grid');
  if (!grid) return;
  ensureAlbumMissionStats();
  playerProfile.albumMissionClaims ||= {};
  const gen = document.getElementById('album-mission-gen')?.value || 'all';
  const tier = document.getElementById('album-mission-tier')?.value || 'all';
  const status = document.getElementById('album-mission-status')?.value || 'active';
  const allStates = ALBUM_MISSIONS.map(m => [m, albumMissionState(m)]);
  const readyCount = allStates.filter(([,s]) => s.ready && !s.claimed).length;
  const claimedCount = allStates.filter(([,s]) => s.claimed).length;
  const summary = document.getElementById('album-mission-summary');
  if (summary) summary.innerHTML = `<strong>${claimedCount}<small> / ${ALBUM_MISSIONS.length}</small></strong><span>${readyCount ? readyCount + ' récompense' + (readyCount > 1 ? 's' : '') + ' prête' + (readyCount > 1 ? 's' : '') : 'Progression enregistrée'}</span>`;
  let list = allStates.filter(([m,s]) =>
    (gen === 'all' || String(m.generation) === gen) &&
    (tier === 'all' || m.tier === tier) &&
    (status === 'all' || (status === 'claimed' ? s.claimed : status === 'ready' ? s.ready && !s.claimed : !s.claimed))
  );
  list.sort((a,b) => Number(b[1].ready && !b[1].claimed) - Number(a[1].ready && !a[1].claimed) || (ALBUM_MISSION_TIERS[b[0].tier]?.weight || 0) - (ALBUM_MISSION_TIERS[a[0].tier]?.weight || 0) || a[0].generation - b[0].generation);
  grid.innerHTML = list.slice(0, albumMissionLimit).map(([m]) => albumMissionCard(m)).join('') || '<p class="album-mission-empty">Aucune mission avec ces filtres.</p>';
  const more = document.getElementById('album-mission-more');
  if (more) more.classList.toggle('hidden', list.length <= albumMissionLimit);
}
function showMoreAlbumMissions() { albumMissionLimit += 12; renderAlbumMissions(); }
function focusAlbumMission(id) {
  const mission = albumMissionById(id);
  if (!mission) return;
  ensureAlbumMissionPanel();
  document.getElementById('album-mission-gen').value = String(mission.generation);
  document.getElementById('album-mission-tier').value = 'all';
  document.getElementById('album-mission-status').value = 'all';
  albumMissionLimit = 120; renderAlbumMissions();
  document.getElementById('album-mission-' + id)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
}
function viewAlbumMissionReward(id) {
  const mission = albumMissionById(id), pokemon = mission ? POKEMON_BY_ID.get(mission.pokemonId) : null;
  if (!pokemon) return;
  document.getElementById('album-search').value = pokemon.name;
  document.getElementById('album-generation').value = 'all';
  document.getElementById('album-status').value = 'found';
  albumPage = 1; renderDiscoveryAlbum();
  document.getElementById('album-results-label')?.scrollIntoView({ block: 'start', behavior: 'smooth' });
}
if (typeof window !== 'undefined' && window.addEventListener) window.addEventListener('DOMContentLoaded', () => {
  playerProfile.albumMissionClaims = normalizeAlbumMissionClaims(playerProfile.albumMissionClaims);
  const before = playerProfile.albumMissionStats;
  playerProfile.albumMissionStats = normalizeAlbumMissionStats(before);
  const wasSeeded = playerProfile.albumMissionStats.seeded;
  ensureAlbumMissionStats();
  ensureAlbumMissionPanel();
  renderAlbumMissions();
  if (!wasSeeded) try { saveProfile(); } catch (_e) {}
});
