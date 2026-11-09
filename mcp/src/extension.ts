import * as vscode from 'vscode';
import { join } from 'node:path';
import { scaffold } from './core/scaffold';

const SECTION = 'extensionForge';

export interface ForgeApi {
  /** Definiciones MCP que se ofrecen a VS Code (para las pruebas). */
  definitions(): vscode.McpStdioServerDefinition[];
  serverPath: string;
}

export function activate(context: vscode.ExtensionContext): ForgeApi {
  const serverPath = join(context.extensionPath, 'out', 'server.js');
  const changed = new vscode.EventEmitter<void>();

  const definitions = (): vscode.McpStdioServerDefinition[] => {
    const cfg = vscode.workspace.getConfiguration(SECTION);
    const env: Record<string, string> = {
      // process.execPath es el ejecutable de VS Code; con esta variable se comporta como Node.js.
      ELECTRON_RUN_AS_NODE: '1',
      FORGE_AUTHOR: cfg.get<string>('author', ''),
      FORGE_PUBLISHER: cfg.get<string>('publisher', ''),
      FORGE_WORKSPACE: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? '',
    };
    return [new vscode.McpStdioServerDefinition('Extension Forge', process.execPath, [serverPath], env, context.extension.packageJSON.version)];
  };

  context.subscriptions.push(
    changed,
    vscode.lm.registerMcpServerDefinitionProvider('extensionForge.mcp', {
      onDidChangeMcpServerDefinitions: changed.event,
      provideMcpServerDefinitions: () => definitions(),
    }),
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration(SECTION)) changed.fire();
    }),
    vscode.workspace.onDidChangeWorkspaceFolders(() => changed.fire()),
    vscode.commands.registerCommand('extensionForge.copyMcpConfig', () => copyMcpConfig(serverPath)),
    vscode.commands.registerCommand('extensionForge.createExtension', createExtension),
    vscode.commands.registerCommand('extensionForge.setAuthor', setAuthor),
  );
  return { definitions, serverPath };
}

export function deactivate(): void {}

async function setAuthor(): Promise<void> {
  const cfg = vscode.workspace.getConfiguration(SECTION);
  const author = await vscode.window.showInputBox({
    title: vscode.l10n.t('Author of the extensions you create'),
    value: cfg.get<string>('author', ''),
    placeHolder: vscode.l10n.t('e.g. Jane Doe'),
  });
  if (author === undefined) return;
  const publisher = await vscode.window.showInputBox({
    title: vscode.l10n.t('Marketplace publisher id'),
    prompt: vscode.l10n.t('Created at marketplace.visualstudio.com/manage; your GitHub user name works too'),
    value: cfg.get<string>('publisher', ''),
  });
  if (publisher === undefined) return;
  await cfg.update('author', author.trim(), vscode.ConfigurationTarget.Global);
  await cfg.update('publisher', publisher.trim(), vscode.ConfigurationTarget.Global);
  vscode.window.showInformationMessage(vscode.l10n.t('Saved: {0} ({1})', author.trim(), publisher.trim()));
}

/** JSON o orden para conectar el mismo servidor desde otras IAs, fuera de VS Code. */
export function mcpSnippets(serverPath: string, author: string, publisher: string): Record<string, string> {
  const env = { FORGE_AUTHOR: author, FORGE_PUBLISHER: publisher };
  const server = { command: 'node', args: [serverPath], env };
  const json = JSON.stringify({ mcpServers: { 'extension-forge': server } }, null, 2);
  const quoted = serverPath.includes(' ') ? `"${serverPath}"` : serverPath;
  return {
    claudeCode: `claude mcp add extension-forge -e FORGE_AUTHOR="${author}" -e FORGE_PUBLISHER="${publisher}" -- node ${quoted}`,
    claudeDesktop: json,
    cursor: json,
    codex: `[mcp_servers.extension-forge]\ncommand = "node"\nargs = [${JSON.stringify(serverPath)}]\nenv = { FORGE_AUTHOR = ${JSON.stringify(author)}, FORGE_PUBLISHER = ${JSON.stringify(publisher)} }`,
    other: json,
  };
}

async function copyMcpConfig(serverPath: string): Promise<void> {
  const cfg = vscode.workspace.getConfiguration(SECTION);
  const snippets = mcpSnippets(serverPath, cfg.get('author', ''), cfg.get('publisher', ''));
  const items: (vscode.QuickPickItem & { key: keyof typeof snippets })[] = [
    { key: 'claudeCode', label: 'Claude Code', detail: vscode.l10n.t('Command to run in a terminal') },
    { key: 'claudeDesktop', label: 'Claude Desktop', detail: vscode.l10n.t('Paste into claude_desktop_config.json') },
    { key: 'cursor', label: 'Cursor', detail: vscode.l10n.t('Paste into .cursor/mcp.json') },
    { key: 'codex', label: 'Codex CLI', detail: vscode.l10n.t('Paste into ~/.codex/config.toml') },
    { key: 'other', label: vscode.l10n.t('Other MCP client'), detail: vscode.l10n.t('Standard mcpServers JSON (needs Node.js)') },
  ];
  const pick = await vscode.window.showQuickPick(items, { title: vscode.l10n.t('Use Extension Forge from another AI') });
  if (!pick) return;
  await vscode.env.clipboard.writeText(snippets[pick.key]);
  vscode.window.showInformationMessage(vscode.l10n.t('{0} configuration copied to the clipboard', pick.label));
}

/** Asistente sin IA: crea la extensión con la plantilla y abre la carpeta. */
async function createExtension(): Promise<void> {
  const cfg = vscode.workspace.getConfiguration(SECTION);
  const ask = (title: string, value = '', validate?: (v: string) => string | undefined) =>
    vscode.window.showInputBox({ title, value, ignoreFocusOut: true, validateInput: validate });
  const parent = await vscode.window.showOpenDialog({
    canSelectFiles: false,
    canSelectFolders: true,
    openLabel: vscode.l10n.t('Create the extension here'),
  });
  if (!parent) return;
  const name = await ask(vscode.l10n.t('Extension id (lowercase and hyphens)'), '', (v) =>
    /^[a-z0-9][a-z0-9-]*$/.test(v) ? undefined : vscode.l10n.t('Only lowercase letters, digits and hyphens'),
  );
  if (!name) return;
  const displayNameEn = await ask(vscode.l10n.t('Name in English'));
  if (!displayNameEn) return;
  const displayNameEs = await ask(vscode.l10n.t('Name in Spanish'), displayNameEn);
  if (!displayNameEs) return;
  const descriptionEn = await ask(vscode.l10n.t('What it does, in English'));
  if (!descriptionEn) return;
  const descriptionEs = await ask(vscode.l10n.t('What it does, in Spanish'));
  if (!descriptionEs) return;
  const author = await ask(vscode.l10n.t('Author'), cfg.get('author', ''));
  if (!author) return;
  const publisher = await ask(vscode.l10n.t('Marketplace publisher id'), cfg.get('publisher', ''));
  if (!publisher) return;
  const destination = vscode.Uri.joinPath(parent[0], name);
  try {
    scaffold({ destination: destination.fsPath, name, displayNameEn, displayNameEs, descriptionEn, descriptionEs, author, publisher });
  } catch (e) {
    vscode.window.showErrorMessage(String((e as Error).message ?? e));
    return;
  }
  const open = vscode.l10n.t('Open folder');
  const answer = await vscode.window.showInformationMessage(
    vscode.l10n.t('Extension created in {0}. Next: npm install && npm test', destination.fsPath),
    open,
  );
  if (answer === open) await vscode.commands.executeCommand('vscode.openFolder', destination, { forceNewWindow: true });
}
