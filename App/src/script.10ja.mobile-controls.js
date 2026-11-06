// MOB-03: keep the three secondary Pokémon pickers usable with a phone keyboard.
// Size only on focus/viewport resize, never on each letter or viewport scroll.
const mobilePickerControls = [
  { input: 'party-guess', list: 'party-guess-ac', action: '#party-submit-btn' },
  { input: 'multiplayer-guess-input', list: 'multiplayer-guess-ac', action: '#multiplayer-live-box [data-action="submitMultiplayerGuess"]' },
  { input: 'challenge-input', list: 'challenge-ac', action: null }
];
let mobilePickerFrame = 0;
function fitMobilePickerControls() {
  mobilePickerFrame = 0;
  if (!window.matchMedia('(max-width: 640px)').matches) {
    for (const config of mobilePickerControls) document.getElementById(config.list)?.style.removeProperty('--mobile-picker-height');
    return;
  }
  const config = mobilePickerControls.find(item => document.activeElement?.id === item.input);
  if (!config) return;
  const input = document.getElementById(config.input), list = document.getElementById(config.list);
  if (!input || !list || !input.getClientRects().length || input.disabled) return;
  const viewport = window.visualViewport;
  // This picker sits at the document end. Reserve the keyboard's occluded
  // space before measuring, so shrinking its list cannot clamp scrollY.
  if (config.input === 'challenge-input') {
    input.closest('#challenge-panel')?.style.setProperty('--mobile-picker-inset',
      Math.max(0, window.innerHeight - (viewport?.height || window.innerHeight) - (viewport?.offsetTop || 0)) + 'px');
  }
  let top = (viewport?.offsetTop || 0) + 12;
  let bottom = (viewport?.offsetTop || 0) + (viewport?.height || window.innerHeight) - 12;
  const header = document.querySelector('body > header');
  if (header && ['fixed', 'sticky'].includes(getComputedStyle(header).position)) top = Math.max(top, header.getBoundingClientRect().bottom + 8);
  const nav = document.getElementById('mobile-tabbar');
  if (nav && !document.body.classList.contains('mobile-keyboard-open') && nav.getBoundingClientRect().top > top) bottom = Math.min(bottom, nav.getBoundingClientRect().top - 8);
  const field = input.getBoundingClientRect();
  const listBox = list.getBoundingClientRect();
  const gap = parseFloat(getComputedStyle(list).marginTop) || 7;
  const action = config.action && document.querySelector(config.action);
  // Measure the tail independently of the list's current height. This also
  // accounts for the Duel grid's padding/gap without changing either layout.
  const tail = action && action.getClientRects().length
    ? Math.max(0, action.getBoundingClientRect().bottom - field.bottom - (listBox.height ? listBox.height + gap : 0)) : 0;
  const desired = field.bottom + gap + 238 + tail;
  const delta = field.top < top ? field.top - top : desired > bottom ? Math.min(field.top - top, desired - bottom) : 0;
  if (Math.abs(delta) > 1) window.scrollBy({ top: Math.round(delta), behavior: 'instant' });
  // Use the actual position after scrolling (the document may have hit its end).
  const room = bottom - input.getBoundingClientRect().bottom - gap - tail;
  list.style.setProperty('--mobile-picker-height', Math.max(0, Math.min(238, room)) + 'px');
}
function scheduleMobilePickerControls() {
  if (mobilePickerFrame) cancelAnimationFrame(mobilePickerFrame);
  mobilePickerFrame = requestAnimationFrame(fitMobilePickerControls);
}
window.addEventListener('resize', scheduleMobilePickerControls);
window.visualViewport?.addEventListener('resize', scheduleMobilePickerControls);
document.addEventListener('focusin', event => {
  if (mobilePickerControls.some(item => item.input === event.target.id)) scheduleMobilePickerControls();
});
// Keep focus until the tap reaches its submit handler. Otherwise blur closes
// the keyboard layout on pointerdown and moves the button away before click.
document.addEventListener('pointerdown', event => {
  if (!window.matchMedia('(max-width: 640px)').matches) return;
  const config = mobilePickerControls.find(item => item.input === document.activeElement?.id);
  if (config?.action && event.target.closest(config.action)) event.preventDefault();
});
