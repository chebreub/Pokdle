# Telecharge les sprites de dresseurs (Pokepedia) vers App\img\trainers\
# Lancer depuis la racine du projet.
$ErrorActionPreference = 'Continue'
$dest = 'App\img\trainers'
New-Item -ItemType Directory -Force -Path $dest | Out-Null
$items = @(
  'https://www.pokepedia.fr/images/3/3e/Sprite_Pierre_HGSS.png|pierre.png',
  'https://www.pokepedia.fr/images/5/58/Sprite_Ondine_HGSS.png|ondine.png',
  'https://www.pokepedia.fr/images/b/b2/Sprite_Major_Bob_HGSS.png|major_bob.png',
  'https://www.pokepedia.fr/images/5/57/Sprite_Erika_HGSS.png|erika.png',
  'https://www.pokepedia.fr/images/e/ea/Sprite_Koga_RFVF.png|koga.png',
  'https://www.pokepedia.fr/images/b/b9/Sprite_Morgane_HGSS.png|morgane.png',
  'https://www.pokepedia.fr/images/6/60/Sprite_Auguste_HGSS.png|auguste.png',
  'https://www.pokepedia.fr/images/5/53/Sprite_Giovanni_RFVF.png|giovanni.png',
  'https://www.pokepedia.fr/images/d/d4/Sprite_Albert_HGSS.png|albert.png',
  'https://www.pokepedia.fr/images/f/fa/Sprite_Hector_HGSS.png|hector.png',
  'https://www.pokepedia.fr/images/a/a1/Sprite_Blanche_HGSS.png|blanche.png',
  'https://www.pokepedia.fr/images/c/c0/Sprite_Mortimer_HGSS.png|mortimer.png',
  'https://www.pokepedia.fr/images/8/89/Sprite_Chuck_HGSS.png|chuck.png',
  'https://www.pokepedia.fr/images/7/7d/Sprite_Jasmine_HGSS.png|jasmine.png',
  'https://www.pokepedia.fr/images/f/f0/Sprite_Fr%C3%A9do_HGSS.png|fredo.png',
  'https://www.pokepedia.fr/images/6/6a/Sprite_Sandra_HGSS.png|sandra.png',
  'https://www.pokepedia.fr/images/9/96/Sprite_Roxanne_RS.png|roxanne.png',
  'https://www.pokepedia.fr/images/6/6b/Sprite_Bastien_RS.png|bastien.png',
  'https://www.pokepedia.fr/images/8/8f/Sprite_Volt%C3%A8re_RS.png|voltere.png',
  'https://www.pokepedia.fr/images/e/e8/Sprite_Adriane_RS.png|adriane.png',
  'https://www.pokepedia.fr/images/6/68/Sprite_Norman_RS.png|norman.png',
  'https://www.pokepedia.fr/images/b/b6/Sprite_Aliz%C3%A9e_RS.png|alizee.png',
  'https://www.pokepedia.fr/images/b/b0/Sprite_L%C3%A9vy_%26_Tatia_RS.png|levy_tatia.png',
  'https://www.pokepedia.fr/images/6/61/Sprite_Juan_E.png|juan.png',
  'https://www.pokepedia.fr/images/0/00/Sprite_Pierrick_Pt.png|pierrick.png',
  'https://www.pokepedia.fr/images/d/da/Sprite_Flo_Pt.png|flo.png',
  'https://www.pokepedia.fr/images/f/f8/Sprite_M%C3%A9lina_Pt.png|melina.png',
  'https://www.pokepedia.fr/images/9/9d/Sprite_Lovis_Pt.png|lovis.png',
  'https://www.pokepedia.fr/images/f/f5/Sprite_Kim%C3%A9ra_Pt.png|kimera.png',
  'https://www.pokepedia.fr/images/a/a4/Sprite_Charles_Pt.png|charles.png',
  'https://www.pokepedia.fr/images/3/30/Sprite_Gladys_Pt.png|gladys.png',
  'https://www.pokepedia.fr/images/9/99/Sprite_Tanguy_Pt.png|tanguy.png'
)
$ok = 0
foreach ($it in $items) {
  $p = $it -split '\|'
  $out = Join-Path $dest $p[1]
  Write-Host ('Telechargement : ' + $p[1])
  try {
    Invoke-WebRequest -Uri $p[0] -OutFile $out -UseBasicParsing -Headers @{ 'User-Agent' = 'Mozilla/5.0' }
    $ok = $ok + 1
  } catch {
    Write-Warning ('Echec : ' + $p[1])
  }
}
Write-Host ''
Write-Host ($ok.ToString() + ' / ' + $items.Count + ' images telechargees dans ' + $dest)
