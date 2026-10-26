'use strict';
// « Image de profil » (26/10): the player picks the picture shown on their card, in the top bar and in the rankings.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { partnerIdFromProfileData } = require('../lib/profile-sync');

const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
const between = (src, from, to) => src.slice(src.indexOf(from), src.indexOf(to, src.indexOf(from)));

function avatarApi(profile, account) {
  const src = read('src/script.07.delegation-party.js');
  const block = between(src, 'const PROFILE_AVATAR_CHOICES', 'function refreshAccountChipAvatar()');
  const box = { innerHTML: '' };
  const calls = [];
  const env = {
    playerProfile: profile,
    connectedAccountUser: account,
    POKEMON_BY_ID: new Map([[937, { id: 937, name: 'Malvalame' }]]),
    getPokemonSprite: (p) => 'sprite-' + p.id + '.png',
    escapeHtml: (s) => String(s),
    saveProfile: () => calls.push('save'),
    renderProfileScreen: () => calls.push('render'),
    refreshAccountChipAvatar: () => calls.push('chip'),
    showToast: () => {},
    document: { getElementById: (id) => (id === 'profile-avatar-choices' ? box : null) },
  };
  const api = Function(...Object.keys(env), block + '; return { profileAvatarOptions, profileAvatarChoice, setProfileAvatarChoice, renderProfileAvatarChoices, accountAvatarSrc };')(...Object.values(env));
  return { ...api, box, calls };
}

test('the choice only holds a picture that exists; otherwise each place keeps its own rule', () => {
  const profile = { favoritePokemonId: 937, avatarPhoto: 'data:image/jpeg;base64,AAA', avatarChoice: '' };
  const api = avatarApi(profile, { avatar: 'https://cdn.discordapp.com/a.png' });
  assert.deepEqual(api.profileAvatarOptions(), { partner: 'sprite-937.png', photo: 'data:image/jpeg;base64,AAA', account: 'https://cdn.discordapp.com/a.png' });
  assert.equal(api.profileAvatarChoice(), '');
  api.setProfileAvatarChoice('account');
  assert.equal(profile.avatarChoice, 'account');
  assert.deepEqual(api.calls, ['save', 'render', 'chip']);
  // A choice whose picture is gone (photo removed, signed out) no longer counts.
  const guest = avatarApi({ favoritePokemonId: 937, avatarPhoto: '', avatarChoice: 'photo' }, null);
  assert.equal(guest.profileAvatarChoice(), '');
  guest.setProfileAvatarChoice('account');
  assert.deepEqual(guest.calls, [], 'nothing to pick without an account');
});

test('the top bar shows the chosen picture, else the account one', () => {
  const user = { avatar: 'https://cdn.discordapp.com/a.png' };
  assert.equal(avatarApi({ favoritePokemonId: 937, avatarChoice: 'partner' }, user).accountAvatarSrc(user), 'sprite-937.png');
  assert.equal(avatarApi({ avatarPhoto: 'data:x', avatarChoice: 'photo' }, user).accountAvatarSrc(user), 'data:x');
  assert.equal(avatarApi({ favoritePokemonId: 937, avatarChoice: '' }, user).accountAvatarSrc(user), user.avatar);
  assert.equal(avatarApi({ favoritePokemonId: 937, avatarChoice: 'account' }, user).accountAvatarSrc(user), user.avatar);
});

test('the picker shows three choices; missing ones are disabled and say why', () => {
  const api = avatarApi({ favoritePokemonId: 937, avatarPhoto: '', avatarChoice: '' }, null);
  api.renderProfileAvatarChoices();
  const html = api.box.innerHTML;
  assert.match(html, /class="profile-avatar-choice is-selected is-pokemon" role="radio" aria-checked="true" data-action="setProfileAvatarChoice" data-args='\["partner"\]'><img src="sprite-937\.png" alt="" \/><b>Mon partenaire<\/b><\/button>/);
  assert.match(html, /data-args='\["photo"\]' disabled>.*<b>Ma photo<\/b><small>Ajoute d’abord une photo<\/small>/);
  assert.match(html, /data-args='\["account"\]' disabled>.*<b>Image du compte<\/b><small>Connecte-toi avec Discord, Google ou Twitch<\/small>/);
  const index = read('index.html');
  assert.match(index, /<div id="profile-avatar-choices" class="profile-avatar-choices" role="radiogroup" aria-labelledby="profile-avatar-label"><\/div>/);
  assert.match(index, /Ta photo n’est visible que par toi\. Dans les classements, les autres joueurs voient ton partenaire ou l’image de ton compte\./);
});

test('the rankings show the account picture when it is the choice; the photo never leaves the player', () => {
  const data = (profile) => ({ profile: JSON.stringify(profile) });
  assert.equal(partnerIdFromProfileData(data({ favoritePokemonId: 937 })), 937);
  assert.equal(partnerIdFromProfileData(data({ favoritePokemonId: 937, avatarChoice: 'partner' })), 937);
  assert.equal(partnerIdFromProfileData(data({ favoritePokemonId: 937, avatarChoice: 'photo' })), 937);
  assert.equal(partnerIdFromProfileData(data({ favoritePokemonId: 937, avatarChoice: 'account' })), null);
});

test('uploading a photo picks it; removing it drops that choice; only known choices are kept', () => {
  const src = read('src/script.07.delegation-party.js');
  assert.match(src, /playerProfile\.avatarPhoto = canvas\.toDataURL\("image\/jpeg", 0\.82\);\n\s+playerProfile\.avatarChoice = "photo";/);
  assert.match(src, /if \(playerProfile\.avatarChoice === "photo"\) playerProfile\.avatarChoice = "";/);
  assert.match(src, /avatarChoice: \["partner", "photo", "account"\]\.includes\(parsed\?\.avatarChoice\) \? parsed\.avatarChoice : "",/);
  // The card: the choice, else the photo, then the partner, then the account picture.
  assert.match(src, /const shown = profileAvatarChoice\(\) \|\| \["photo", "partner", "account"\]\.find\(\(key\) => avatars\[key\]\) \|\| "";/);
});
