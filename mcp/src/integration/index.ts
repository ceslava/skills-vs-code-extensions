/** Dentro de un VS Code real: la extensión se activa, ofrece su servidor MCP y ese servidor responde. */
import * as assert from 'node:assert/strict';
import * as vscode from 'vscode';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import type { ForgeApi } from '../extension';

export async function run(): Promise<void> {
  const ext = vscode.extensions.getExtension<ForgeApi>('ceslava.extension-forge');
  assert.ok(ext, 'la extensión no está cargada');
  const api = await ext.activate();
  const commands = await vscode.commands.getCommands(true);
  for (const c of ['extensionForge.createExtension', 'extensionForge.copyMcpConfig', 'extensionForge.setAuthor']) {
    assert.ok(commands.includes(c), `falta la orden ${c}`);
  }
  await vscode.workspace.getConfiguration('extensionForge').update('author', 'Lucía Prieto', vscode.ConfigurationTarget.Global);
  const [def] = api.definitions();
  assert.equal(def.label, 'Extension Forge');
  assert.equal(def.env.FORGE_AUTHOR, 'Lucía Prieto');

  // Arranca el servidor exactamente como lo haría VS Code (su propio ejecutable como Node.js).
  const transport = new StdioClientTransport({
    command: def.command,
    args: def.args,
    env: { ...(process.env as Record<string, string>), ...(def.env as Record<string, string>) },
  });
  const client = new Client({ name: 'integration', version: '1.0.0' });
  await client.connect(transport);
  const tools = (await client.listTools()).tools.map((t) => t.name);
  await client.close();
  assert.ok(tools.includes('create_vscode_extension'), `herramientas: ${tools.join(', ')}`);
  console.log('Pruebas de integración: todo bien');
}
