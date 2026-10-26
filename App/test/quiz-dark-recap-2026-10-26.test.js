'use strict';
// The Quiz end card in the dark theme: its header was dark text on a dark card (audit of 25/10).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const css = fs.readFileSync(path.join(__dirname, '..', 'game-feel.css'), 'utf8');

test('in the dark theme, the end card header reads light on its dark background', () => {
  assert.match(css, /#pokdle-app\.design-refresh\.theme-dark #quiz-box \.quiz-end-heading :is\(h3, \.quiz-end-scoreline strong\) \{color:#eef5ff;\}/);
  assert.match(css, /#pokdle-app\.design-refresh\.theme-dark #quiz-box \.quiz-end-heading :is\(\.quiz-end-kicker, \.quiz-end-scoreline span\) \{color:#aebfda;\}/);
});

test('good answers in the recap use a green that passes 4.5:1 on their pale background', () => {
  const green = css.match(/#pokdle-app #quiz-box \.quiz-history-item\.ok \{color:#([0-9a-f]{6});\}/)[1];
  const lum = (hex) => {
    const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
      .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const [a, b] = [lum(green), lum('eef9f3')];
  assert.ok((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05) >= 4.5);
});
