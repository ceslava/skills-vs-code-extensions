import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { greeting, resolveLocale } from '../core';

const root = join(__dirname, '..', '..');
const json = (p: string) => JSON.parse(readFileSync(join(root, p), 'utf8'));

test('idioma y saludo', () => {
  assert.equal(resolveLocale('auto', 'es-ES'), 'es');
  assert.equal(resolveLocale('auto', 'de'), 'en');
  assert.equal(greeting('es', 'Lucía'), '¡Hola, Lucía!');
  assert.equal(greeting('en', ''), 'Hello, world!');
});

test('cada %clave% de package.json está en los dos package.nls', () => {
  const pkg = JSON.stringify(json('package.json'));
  const en = json('package.nls.json');
  const es = json('package.nls.es.json');
  for (const [, k] of pkg.matchAll(/"%([^%]+)%"/g)) {
    assert.ok(k in en, `package.nls.json: falta ${k}`);
    assert.ok(k in es, `package.nls.es.json: falta ${k}`);
  }
  assert.deepEqual(Object.keys(es).sort(), Object.keys(en).sort());
});

test('cada vscode.l10n.t(...) tiene traducción al español', () => {
  const bundle = json('l10n/bundle.l10n.es.json');
  const src = readFileSync(join(root, 'src', 'extension.ts'), 'utf8');
  for (const [, s] of src.matchAll(/l10n\.t\('([^']+)'/g)) assert.ok(s in bundle, `falta «${s}»`);
});
