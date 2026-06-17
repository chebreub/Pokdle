# Telecharge les sprites du Conseil 4 (gen 1-5) vers App\img\trainers\
$ErrorActionPreference = 'Continue'
$dest = 'App\img\trainers'
New-Item -ItemType Directory -Force -Path $dest | Out-Null
$items = @(
  'https://www.pokepedia.fr/images/3/36/Sprite_Olga_RFVF.png|c4_1_olga.png',
  'https://www.pokepedia.fr/images/2/20/Sprite_Aldo_RFVF.png|c4_1_aldo.png',
  'https://www.pokepedia.fr/images/f/f1/Sprite_Agatha_RFVF.png|c4_1_agatha.png',
  'https://www.pokepedia.fr/images/f/f5/Sprite_Peter_RFVF.png|c4_1_peter.png',
  'https://www.pokepedia.fr/images/f/fc/Sprite_Cl%C3%A9ment_HGSS.png|c4_2_clement.png',
  'https://www.pokepedia.fr/images/3/3d/Sprite_Koga_HGSS.png|c4_2_koga.png',
  'https://www.pokepedia.fr/images/3/3b/Sprite_Aldo_HGSS.png|c4_2_aldo.png',
  'https://www.pokepedia.fr/images/e/e1/Sprite_Marion_HGSS.png|c4_2_marion.png',
  'https://www.pokepedia.fr/images/9/9c/Sprite_Damien_RS.png|c4_3_damien.png',
  'https://www.pokepedia.fr/images/b/b8/Sprite_Spectra_RS.png|c4_3_spectra.png',
  'https://www.pokepedia.fr/images/4/44/Sprite_Glacia_RS.png|c4_3_glacia.png',
  'https://www.pokepedia.fr/images/2/2f/Sprite_Aragon_RS.png|c4_3_aragon.png',
  'https://www.pokepedia.fr/images/0/02/Sprite_Aaron_DP.png|c4_4_aaron.png',
  'https://www.pokepedia.fr/images/e/e7/Sprite_Terry_DP.png|c4_4_terry.png',
  'https://www.pokepedia.fr/images/8/86/Sprite_Adrien_DP.png|c4_4_adrien.png',
  'https://www.pokepedia.fr/images/1/15/Sprite_Lucio_DP.png|c4_4_lucio.png',
  'https://www.pokepedia.fr/images/7/7d/Sprite_Anis_NB.png|c4_5_anis.png',
  'https://www.pokepedia.fr/images/f/f7/Sprite_Pieris_NB.png|c4_5_pieris.png',
  'https://www.pokepedia.fr/images/9/9d/Sprite_Percila_NB.png|c4_5_percila.png',
  'https://www.pokepedia.fr/images/5/57/Sprite_Kunz_NB.png|c4_5_kunz.png'
)
$ok=0
foreach ($it in $items) {
  $p = $it -split '\|'
  $out = Join-Path $dest $p[1]
  Write-Host ('Telechargement : ' + $p[1])
  try { Invoke-WebRequest -Uri $p[0] -OutFile $out -UseBasicParsing -Headers @{ 'User-Agent' = 'Mozilla/5.0' }; $ok=$ok+1 }
  catch { Write-Warning ('Echec : ' + $p[1]) }
}
Write-Host ($ok.ToString() + ' / ' + $items.Count + ' images Conseil 4 telechargees')
