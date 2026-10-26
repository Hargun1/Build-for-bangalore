import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { PropertyBinding } from 'three';
import { ANATOMY as anatomy, organKeys, riskTone } from '../src/components/GlassBody/anatomyLayout.js';

test('male and female views expose their complete region lists', () => {
  assert.equal(organKeys('male').length, 14);
  assert.equal(organKeys('female').length, 17);
  for (const key of ['uterus', 'ovaryL', 'ovaryR']) {
    assert.ok(!organKeys('male').includes(key));
    assert.ok(organKeys('female').includes(key));
  }
});

test('patient left and right are consistent from the front', () => {
  for (const key of ['heart', 'stomach', 'spleen', 'kidneyL', 'ovaryL']) assert.ok(anatomy[key].position[0] > 0, key);
  for (const key of ['liver', 'gallbladder', 'kidneyR', 'ovaryR']) assert.ok(anatomy[key].position[0] < 0, key);
  assert.ok(anatomy.kidneyR.position[1] < anatomy.kidneyL.position[1]);
  assert.ok(anatomy.pancreas.position[2] < anatomy.stomach.position[2]);
  assert.ok(anatomy.kidneyL.position[2] < anatomy.liver.position[2]);
});

test('organs follow the reference body vertical regions', () => {
  const ordered = ['brain', 'thyroid', 'heart', 'liver', 'digestive', 'bladder'];
  for (let i = 1; i < ordered.length; i++) assert.ok(anatomy[ordered[i - 1]].position[1] > anatomy[ordered[i]].position[1]);
  for (const entry of Object.values(anatomy)) assert.ok(entry.position.every(Number.isFinite));
});

test('unknown readings never appear healthy', () => {
  for (const value of [null, undefined, NaN, Infinity, '0']) assert.equal(riskTone(value), 'none');
  assert.equal(riskTone(0), 'good');
  assert.equal(riskTone(.4), 'good');
  assert.equal(riskTone(.5), 'warn');
  assert.equal(riskTone(.8), 'bad');
});

test('referenced assets exist and liver mesh survives loader name sanitization', () => {
  for (const item of Object.values(anatomy)) {
    if (!item.model) continue;
    const file = new URL(`../public/models/${item.model}`, import.meta.url);
    assert.ok(existsSync(file), item.model);
    if (item.part) {
      const bytes = readFileSync(file);
      const gltf = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString());
      const target = PropertyBinding.sanitizeNodeName(item.part);
      assert.ok(gltf.nodes.some(node => node.mesh !== undefined && PropertyBinding.sanitizeNodeName(node.name).includes(target)));
    }
  }
});
