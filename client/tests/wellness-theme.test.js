import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CHART, tooltipStyle } from "../src/utils/chartTheme.js";

const css = readFileSync(new URL("../src/styles/ui.css", import.meta.url), "utf8");
const tokens = Object.fromEntries([...css.matchAll(/(--ui-[a-z-]+):\s*(#[a-f0-9]{6})/g)].map((m) => [m[1], m[2]]));
const luminance = (hex) => {
  const channels = hex.slice(1).match(/../g).map((c) => parseInt(c, 16) / 255)
    .map((v) => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
};
const contrast = (a, b) => {
  const levels = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (levels[0] + 0.05) / (levels[1] + 0.05);
};

test("wellness theme uses light native controls and matching chart surfaces", () => {
  assert.match(css, /color-scheme:\s*light/);
  assert.ok(luminance(tokens["--ui-bg"]) > 0.85);
  assert.equal(CHART.surface, tokens["--ui-surface"]);
  assert.equal(tooltipStyle.itemStyle.color, tokens["--ui-text"]);
});

test("text stays readable on the white and pastel surfaces", () => {
  for (const surface of ["--ui-bg", "--ui-surface", "--ui-mint", "--ui-blue", "--ui-lilac", "--ui-rose", "--ui-peach"]) {
    for (const text of ["--ui-text", "--ui-text-dim", "--ui-text-faint"]) {
      assert.ok(contrast(tokens[text], tokens[surface]) >= 4.5, `${text} on ${surface} needs 4.5:1 contrast`);
    }
  }
});

test("primary controls and clinical status labels retain text contrast", () => {
  for (const token of ["--ui-accent", "--ui-good", "--ui-warn", "--ui-bad"]) {
    assert.ok(contrast(tokens[token], "#ffffff") >= 4.5, `${token} needs 4.5:1 contrast`);
  }
});
