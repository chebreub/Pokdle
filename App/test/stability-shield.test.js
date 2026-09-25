"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const screenSource = fs.readFileSync(path.join(root, "src/script.07.delegation-party.js"), "utf8");
const index = fs.readFileSync(path.join(root, "index.html"), "utf8");
const style = fs.readFileSync(path.join(root, "style.css"), "utf8");
const home = fs.readFileSync(path.join(root, "home.css"), "utf8");
const mobile = fs.readFileSync(path.join(root, "mobile.css"), "utf8");
const loadedCssFiles = [...index.matchAll(/href="dist\/([\w.-]+)\.min\.css"/g)].map((match) => match[1] + ".css");
const loadedCss = loadedCssFiles.map((file) => fs.readFileSync(path.join(root, file), "utf8")).join("\n");

function visibilityFixture() {
  const start = screenSource.indexOf("function setScreenVisibility(");
  const end = screenSource.indexOf("function hideExtraScreens()", start);
  assert.ok(start >= 0 && end > start, "screen visibility block must exist");
  const source = screenSource.slice(start, end);

  function element(id, hidden) {
    const classes = new Set(hidden ? ["hidden"] : []);
    const styles = new Map();
    const attrs = new Map();
    return {
      id,
      classList: {
        add(name) { classes.add(name); },
        remove(name) { classes.delete(name); },
        contains(name) { return classes.has(name); },
      },
      style: {
        setProperty(name, value, priority) { styles.set(name, { value, priority }); },
        removeProperty(name) { styles.delete(name); },
        getPropertyValue(name) { return styles.get(name)?.value || ""; },
        getPropertyPriority(name) { return styles.get(name)?.priority || ""; },
      },
      setAttribute(name, value) { attrs.set(name, String(value)); },
      removeAttribute(name) { attrs.delete(name); },
      getAttribute(name) { return attrs.has(name) ? attrs.get(name) : null; },
    };
  }

  const elements = new Map([
    ["screen-config", element("screen-config", false)],
    ["screen-game", element("screen-game", true)],
    ["screen-pokedex", element("screen-pokedex", true)],
  ]);
  const context = {
    console: { warn() {} },
    hideMultiplayerWinOverlay() {},
    closeNavDropdowns: undefined,
    document: {
      activeElement: null,
      getElementById(id) { return elements.get(id) || null; },
      querySelectorAll(selector) {
        assert.equal(selector, '[id^="screen-"]');
        return Array.from(elements.values());
      },
    },
    window: { scrollTo() {} },
  };
  vm.createContext(context);
  vm.runInContext(source, context);
  return { context, elements };
}

test("showScreen leaves exactly one screen visible and uses an inline important shield", () => {
  const { context, elements } = visibilityFixture();
  assert.equal(context.showScreen("screen-game"), true);
  for (const [id, el] of elements) {
    if (id === "screen-game") {
      assert.equal(el.classList.contains("hidden"), false);
      assert.equal(el.style.getPropertyValue("display"), "");
      assert.equal(el.getAttribute("aria-hidden"), null);
    } else {
      assert.equal(el.classList.contains("hidden"), true);
      assert.equal(el.style.getPropertyValue("display"), "none");
      assert.equal(el.style.getPropertyPriority("display"), "important");
      assert.equal(el.getAttribute("aria-hidden"), "true");
    }
  }
});

test("an unknown screen never blanks the current screen", () => {
  const { context, elements } = visibilityFixture();
  assert.equal(context.showScreen("screen-missing"), false);
  assert.equal(elements.get("screen-config").classList.contains("hidden"), false);
  assert.equal(elements.get("screen-config").style.getPropertyValue("display"), "");
});

test("all screen ids are unique and only home starts visible", () => {
  const matches = [...index.matchAll(/<[^>]+id="(screen-[^"]+)"[^>]*>/g)];
  const ids = matches.map((match) => match[1]);
  assert.ok(ids.length >= 20, "expected the full Pokédle screen set");
  assert.equal(new Set(ids).size, ids.length, "screen ids must be unique");
  for (const match of matches) {
    const tag = match[0];
    const id = match[1];
    if (id === "screen-config") assert.doesNotMatch(tag, /class="[^"]*\bhidden\b/);
    else assert.match(tag, /class="[^"]*\bhidden\b/, `${id} must start hidden`);
  }
});

test("desktop and mobile primary navigation stay wired to known entry points", () => {
  const desktop = index.slice(index.indexOf('<nav class="global-nav"'), index.indexOf("</nav>", index.indexOf('<nav class="global-nav"')) + 6);
  const mobileNav = index.slice(index.indexOf('<nav id="mobile-tabbar"'), index.indexOf("</nav>", index.indexOf('<nav id="mobile-tabbar"')) + 6);
  for (const action of ["goToConfig", "openAllModesScreen", "openPokedexMode", "openProfileScreen"]) {
    assert.match(screenSource + fs.readFileSync(path.join(root, "src/script.04.jeu-pokedex.js"), "utf8") + fs.readFileSync(path.join(root, "src/script.02.statclash.js"), "utf8"), new RegExp(`function ${action}\\b|window\\.${action}\\s*=`));
  }
  assert.match(desktop, /data-action="openAllModesScreen" data-args='\["solo"\]'/);
  assert.match(desktop, /data-action="openAllModesScreen" data-args='\["friends"\]'/);
  assert.match(desktop, /data-action="openAllModesScreen" data-args='\["explore"\]'/);
  assert.match(mobileNav, /data-action="openAllModesScreen" data-args='\["solo"\]' data-tab="game"/);
  assert.match(mobileNav, /data-action="openAllModesScreen" data-args='\["friends"\]' data-tab="social"/);
});

test("visual layers cannot directly force a bare screen visible with important", () => {
  assert.ok(loadedCssFiles.length >= 8, "the shield must cover the complete stylesheet stack");
  assert.equal(new Set(loadedCssFiles).size, loadedCssFiles.length, "stylesheet entries should be unique");
  const forced = [...loadedCss.matchAll(/#screen-[\w-]+\s*\{[^}]*display\s*:\s*[^;]+!important/gs)].map((m) => m[0]);
  assert.deepEqual(forced, []);
  assert.match(style, /\.hidden\s*\{\s*display:\s*none\s*!important;?\s*\}/);
  assert.match(home, /#screen-config:not\(\.hidden\)\s*\{/);
});
