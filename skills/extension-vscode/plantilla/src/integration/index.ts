import * as assert from 'node:assert/strict';
import * as vscode from 'vscode';
import type { Api } from '../extension';

export async function run(): Promise<void> {
  const ext = vscode.extensions.getExtension<Api>('{{publisher}}.{{name}}');
  assert.ok(ext, 'la extensión no está cargada');
  const api = await ext.activate();
  const cfg = vscode.workspace.getConfiguration('{{prefix}}');
  await cfg.update('author', 'Lucía', vscode.ConfigurationTarget.Global);
  await cfg.update('language', 'es', vscode.ConfigurationTarget.Global);
  await vscode.commands.executeCommand('{{prefix}}.hello');
  assert.equal(api.lastMessage(), '¡Hola, Lucía!');
  console.log('Pruebas de integración: todo bien');
}
