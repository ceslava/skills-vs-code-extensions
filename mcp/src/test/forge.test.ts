import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { scaffold, camel } from '../core/scaffold';
import { checkExtension } from '../core/checks';

const root = join(__dirname, '..', '..');
const tmp = () => mkdtempSync(join(tmpdir(), 'forge-'));
const opts = (destination: string) => ({
  destination, name: 'hola-mundo', publisher: 'ceslava', author: 'Lucía "Lu" Prieto',
  displayNameEs: 'Hola mundo', displayNameEn: 'Hello world', descriptionEs: 'Saluda.', descriptionEn: 'Says hello.',
});
const textOf = (r: any) => (r.content as { text: string }[]).map((c) => c.text).join('\n');

test('camel', () => {
  assert.equal(camel('web-code-stats'), 'webCodeStats');
});

test('scaffold: copia la plantilla, sustituye marcadores y escapa JSON', () => {
  const dest = join(tmp(), 'ext');
  const files = scaffold(opts(dest));
  assert.ok(files.includes('package.json') && files.includes('l10n/bundle.l10n.es.json'));
  const pkg = JSON.parse(readFileSync(join(dest, 'package.json'), 'utf8'));
  assert.equal(pkg.author.name, 'Lucía "Lu" Prieto');
  assert.equal(pkg.contributes.commands[0].command, 'holaMundo.hello');
  assert.throws(() => scaffold(opts(dest)), /not empty/);
  assert.throws(() => scaffold({ ...opts(join(tmp(), 'x')), name: 'Mal Nombre' }), /lowercase/);
});

test('checkExtension: la plantilla no tiene errores y detecta traducciones que faltan', () => {
  const dest = join(tmp(), 'ext');
  scaffold(opts(dest));
  assert.deepEqual(checkExtension(dest).filter((f) => f.level === 'error'), []);
  const nls = join(dest, 'package.nls.es.json');
  const es = JSON.parse(readFileSync(nls, 'utf8'));
  delete es['command.hello'];
  writeFileSync(nls, JSON.stringify(es));
  const src = join(dest, 'src', 'extension.ts');
  writeFileSync(src, readFileSync(src, 'utf8') + "\nvscode.l10n.t('Untranslated text');\n");
  const errors = checkExtension(dest).filter((f) => f.level === 'error').map((f) => f.message).join('\n');
  assert.match(errors, /package\.nls\.es\.json: missing "command\.hello"/);
  assert.match(errors, /bundle\.l10n\.es\.json: missing "Untranslated text"/);
});

test('el manifiesto de Extension Forge está traducido', () => {
  const errors = checkExtension(root).filter((f) => f.level === 'error');
  assert.deepEqual(errors, []);
});

test('servidor MCP: herramientas, recursos, prompt y flujo completo', { timeout: 600_000 }, async () => {
  const work = tmp();
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [join(root, 'out', 'server.js')],
    env: { ...(process.env as Record<string, string>), FORGE_AUTHOR: 'Lucía Prieto', FORGE_PUBLISHER: 'ceslava', FORGE_WORKSPACE: work },
  });
  const client = new Client({ name: 'test', version: '1.0.0' });
  await client.connect(transport);
  try {
    const tools = (await client.listTools()).tools.map((t) => t.name).sort();
    assert.deepEqual(tools, [
      'check_vscode_extension', 'create_vscode_extension', 'get_vscode_extension_guide',
      'package_vscode_extension', 'run_vscode_extension_tests',
    ]);
    const guide = textOf(await client.callTool({ name: 'get_vscode_extension_guide', arguments: {} }));
    assert.match(guide, /Dos idiomas/);
    const ref = textOf(await client.callTool({ name: 'get_vscode_extension_guide', arguments: { topic: 'reference' } }));
    assert.match(ref, /Errores típicos/);
    const resources = (await client.listResources()).resources.map((r) => r.uri).sort();
    assert.deepEqual(resources, ['forge://guide', 'forge://reference']);
    const prompt = await client.getPrompt({ name: 'new_vscode_extension', arguments: { idea: 'count TODO comments' } });
    assert.match(JSON.stringify(prompt.messages), /count TODO comments/);

    // Ruta relativa → se crea dentro de FORGE_WORKSPACE; autor y publisher, de las variables.
    const created = await client.callTool({
      name: 'create_vscode_extension',
      arguments: { destination: 'contador', name: 'contador-todo', displayNameEn: 'TODO Counter', displayNameEs: 'Contador de TODO', descriptionEn: 'Counts TODOs.', descriptionEs: 'Cuenta los TODO.' },
    });
    assert.ok(!created.isError, textOf(created));
    const dest = join(work, 'contador');
    assert.equal(JSON.parse(readFileSync(join(dest, 'package.json'), 'utf8')).author.name, 'Lucía Prieto');

    const check = textOf(await client.callTool({ name: 'check_vscode_extension', arguments: { path: dest } }));
    assert.match(check, /No errors\./);

    const tests = await client.callTool({ name: 'run_vscode_extension_tests', arguments: { path: dest } });
    assert.ok(!tests.isError, textOf(tests));
    assert.match(textOf(tests), /pass 3/);

    const pack = await client.callTool({ name: 'package_vscode_extension', arguments: { path: dest } });
    assert.ok(!pack.isError, textOf(pack));
    assert.ok(existsSync(join(dest, 'contador-todo-0.1.0.vsix')));

    const missing = await client.callTool({ name: 'check_vscode_extension', arguments: { path: join(work, 'no-existe') } });
    assert.ok(missing.isError);
  } finally {
    await client.close();
  }
});
