# Manifiesto y API de VS Code: chuleta

## package.json (lo imprescindible)

```jsonc
{
  "name": "informe-web",              // minúsculas y guiones; id = publisher.name
  "displayName": "%displayName%",     // %…% → package.nls*.json
  "publisher": "ceslava",
  "author": { "name": "ceslava" },
  "version": "0.1.0",
  "license": "MIT",                   // sin LICENSE, vsce pregunta
  "repository": { "type": "git", "url": "https://github.com/ceslava/informe-vs-code.git" },
  "icon": "images/icon.png",           // PNG de 256 px; el Marketplace no admite SVG
  "galleryBanner": { "color": "#0b4f8a", "theme": "dark" },
  "engines": { "vscode": "^1.90.0" }, // igual o mayor que @types/vscode
  "main": "./out/extension.js",
  "l10n": "./l10n",
  "activationEvents": [],
  "contributes": {
    "commands": [{ "command": "webReport.generate", "title": "%command.generate%", "category": "%category%" }],
    "menus": {
      "explorer/context": [{ "command": "webReport.generate", "when": "explorerResourceIsFolder", "group": "navigation@90" }],
      "commandPalette": [{ "command": "x.interna", "when": "false" }]   // ocultar una orden de la paleta
    },
    "configuration": {
      "title": "%category%",
      "properties": {
        "webReport.css.metrics": {
          "type": "array", "uniqueItems": true,
          "items": { "type": "string", "enum": ["rules", "displayFlex"], "enumDescriptions": ["%m.rules%", "%m.flex%"] },
          "default": ["rules"],
          "markdownDescription": "%config.css.metrics%",
          "order": 3
        }
      }
    },
    "keybindings": [{ "command": "webReport.generate", "key": "ctrl+alt+r", "mac": "cmd+alt+r" }]
  }
}
```

- `markdownDescription` admite `código` y **negrita** en la página de ajustes; `order` fija el orden.
- El `when` usa claves de contexto: `explorerResourceIsFolder`, `resourceExtname == .css`, `editorLangId == html`.

## API que más se usa

```ts
vscode.commands.registerCommand(id, (uri?: vscode.Uri) => …)        // en context.subscriptions
vscode.workspace.getConfiguration('webReport').get<string[]>('css.metrics', porDefecto)
cfg.update('author', valor, vscode.ConfigurationTarget.Global | Workspace)
vscode.workspace.onDidChangeConfiguration((e) => e.affectsConfiguration('webReport'))
vscode.workspace.findFiles(new vscode.RelativePattern(carpeta, '**/*.css'), exclude, max, token)
new TextDecoder().decode(await vscode.workspace.fs.readFile(uri))
await vscode.workspace.fs.writeFile(uri, new TextEncoder().encode(texto))
vscode.window.showQuickPick(items, { canPickMany: true })            // items con picked y separadores (QuickPickItemKind.Separator)
vscode.window.showInputBox({ title, prompt, value, validateInput })
vscode.window.showSaveDialog({ defaultUri, filters: { Markdown: ['md'] } })
vscode.window.withProgress({ location: ProgressLocation.Notification, cancellable: true }, async (progress, token) => …)
vscode.window.createWebviewPanel(id, título, ViewColumn.Active, { enableScripts: true, localResourceRoots: [] })
vscode.workspace.openTextDocument({ language: 'markdown', content })  // documento sin guardar
vscode.languages.createDiagnosticCollection('x')                       // avisos en «Problemas»
vscode.window.createOutputChannel('X', { log: true })                  // registro
vscode.env.language, vscode.env.clipboard.writeText(texto)
```

## Webview

```ts
panel.webview.html = `<!doctype html><html lang="${locale}"><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${panel.webview.cspSource} 'nonce-${n}'; script-src 'nonce-${n}';">
<style nonce="${n}">…var(--vscode-foreground)…</style></head><body>…
<script nonce="${n}">const vscode = acquireVsCodeApi(); … vscode.postMessage({ type: 'save' });</script></body></html>`;
panel.webview.onDidReceiveMessage((msg) => …);
```

- Para cargar ficheros de la extensión: `localResourceRoots: [Uri.joinPath(context.extensionUri, 'media')]` y
  `panel.webview.asWebviewUri(...)`.
- Reutiliza un único panel (`panel.reveal()`) y límpialo en `onDidDispose`.
- El mismo HTML puede servir como fichero autónomo si los colores llevan valor de respaldo:
  `var(--vscode-foreground, #1d1d1f)`.

## Dependencias en tiempo de ejecución (esbuild)

Si la extensión necesita paquetes de npm, empaquétala en un solo fichero:

```bash
npm i -D esbuild
npx esbuild src/extension.ts --bundle --platform=node --format=cjs --external:vscode --outfile=out/extension.js --minify
```

y en `vscode:prepublish` usa esa orden. Sigue empaquetando con `vsce package --no-dependencies`.

## Errores típicos

| Síntoma | Causa |
|---|---|
| «command 'x' not found» | la orden no está en `contributes.commands` o falta compilar (`out/` viejo) |
| Los `%clave%` salen tal cual | falta la clave en `package.nls.json` |
| Ajuste sin efecto | se leyó la configuración antes de `update` (vuelve a llamar a `getConfiguration`) |
| Webview en blanco | la CSP bloquea un script sin `nonce` o un estilo externo |
| `TS1259 … esModuleInterop` en los tests | añade `"esModuleInterop": true` al `tsconfig.json` |
| `node --test out/test/` falla sin decir por qué | en Node 22 pasa los ficheros: `node --test out/test/*.test.js` |
| test-electron no arranca en Linux sin pantalla | lánzalo con `xvfb-run -a` |
| vsce: «engines.vscode … @types/vscode» | `@types/vscode` no puede ser mayor que `engines.vscode` |
