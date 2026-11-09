# Extension Forge: Build VS Code Extensions with Any AI (MCP)

*Forja de extensiones: crea extensiones de VS Code con cualquier IA. English below.*

## Español

Extensión de VS Code que trae un **servidor MCP**: cualquier IA compatible con MCP (Claude, GitHub Copilot, Cursor,
Codex…) aprende el método para hacer extensiones de VS Code **bilingües (español e inglés) y con autor**, y tiene
herramientas para crearlas, revisarlas, probarlas y empaquetarlas.

### Herramientas que recibe la IA

| Herramienta | Qué hace |
|---|---|
| `get_vscode_extension_guide` | el método (qué preguntar, reglas de diseño, traducciones, pruebas, publicar) y una chuleta de la API |
| `create_vscode_extension` | crea una extensión que ya compila, pasa sus pruebas y se empaqueta |
| `check_vscode_extension` | revisa el manifiesto, las traducciones al español, los ficheros del Marketplace y la seguridad del webview |
| `run_vscode_extension_tests` | `npm test` y, si se pide, las pruebas en un VS Code real |
| `package_vscode_extension` | genera el `.vsix` (no publica nada) |

Además, el recurso `forge://guide` y el prompt `new_vscode_extension` («quiero una extensión que…»).

### Cómo se usa

1. Instala la extensión y ejecuta **Extension Forge: Indicar autor y publisher**.
2. **En VS Code** (Copilot u otro chat con modo agente): el servidor aparece solo en la lista de servidores MCP.
   Pide «hazme una extensión de VS Code que cuente los TODO del proyecto».
3. **Desde otra IA** (Claude Code, Claude Desktop, Cursor, Codex): **Extension Forge: Usar desde otra IA** copia la
   configuración lista para pegar. Necesita Node.js 20 o posterior. Ejemplo para Claude Code:

   ```bash
   claude mcp add extension-forge -e FORGE_AUTHOR="Tu Nombre" -e FORGE_PUBLISHER=tu-publisher -- node /ruta/a/extension-forge/out/server.js
   ```

4. **Sin IA**: **Extension Forge: Crear una extensión de VS Code (sin IA)** hace las preguntas y crea la carpeta.

### Ajustes

`extensionForge.author` y `extensionForge.publisher`: valores por defecto de las extensiones nuevas.

## English

A VS Code extension that ships an **MCP server**. Any MCP-capable AI (Claude, GitHub Copilot, Cursor, Codex…) gets a
proven method for building **bilingual (English/Spanish) VS Code extensions with an author**, plus tools to create,
check, test and package them.

- **Tools:** `get_vscode_extension_guide`, `create_vscode_extension`, `check_vscode_extension`,
  `run_vscode_extension_tests`, `package_vscode_extension`. Resource `forge://guide`, prompt `new_vscode_extension`.
- **In VS Code** the server is registered automatically (MCP server definition provider).
- **Other AIs:** run **Extension Forge: Use from another AI** to copy a ready-to-paste configuration for Claude Code,
  Claude Desktop, Cursor, Codex or any MCP client (requires Node.js 20+).
- **No AI:** **Extension Forge: Create a VS Code extension (without AI)** runs a short wizard.
- **Settings:** `extensionForge.author`, `extensionForge.publisher`.

Nothing is published to the Marketplace by the tools: packaging stops at the `.vsix`.

## Desarrollo / Development

```bash
npm ci
npm test                              # unidad + cliente MCP real (crea, revisa, prueba y empaqueta una extensión)
xvfb-run -a npm run test:integration  # en un VS Code real (en un escritorio, sin xvfb-run)
npm run package                       # extension-forge-X.Y.Z.vsix
```

La skill se copia de `../skills/extension-vscode` al compilar (`npm run copy-skill`): se mantiene en un solo sitio.
