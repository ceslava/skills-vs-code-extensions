/**
 * Servidor MCP de Extension Forge. Sirve la skill «extension-vscode» a cualquier IA compatible con MCP
 * (Claude, Copilot, Cursor, Codex…) y le da herramientas para crear, revisar, probar y empaquetar
 * extensiones de VS Code bilingües (inglés y español) con autor.
 *
 * Se arranca con `node out/server.js` (stdio). Variables opcionales: FORGE_AUTHOR y FORGE_PUBLISHER
 * (valores por defecto de create_extension) y FORGE_SKILL_DIR (otra copia de la skill).
 */
import { existsSync, readFileSync, statSync } from 'node:fs';
import { isAbsolute, join, resolve } from 'node:path';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { checkExtension } from './core/checks';
import { skillDir } from './core/paths';
import { RunResult, packageExtension, runTests } from './core/run';
import { scaffold } from './core/scaffold';

export const VERSION = '0.1.0';

const text = (t: string) => ({ content: [{ type: 'text' as const, text: t }] });
const fail = (t: string) => ({ content: [{ type: 'text' as const, text: t }], isError: true });

function guide(): string {
  return readFileSync(join(skillDir(), 'SKILL.md'), 'utf8');
}
function reference(): string {
  return readFileSync(join(skillDir(), 'referencias', 'manifiesto-y-api.md'), 'utf8');
}

/** Rutas relativas se resuelven contra FORGE_WORKSPACE (la carpeta abierta en VS Code) o el directorio actual. */
function abs(p: string): string {
  return isAbsolute(p) ? p : resolve(process.env.FORGE_WORKSPACE || process.cwd(), p);
}

function extensionRoot(p: string): string {
  const root = abs(p);
  if (!existsSync(join(root, 'package.json'))) throw new Error(`No package.json in ${root}`);
  return root;
}

function report(results: RunResult[]): string {
  return results
    .map((r) => `## ${r.ok ? 'OK' : 'FAILED'} · ${r.command}\n\n\`\`\`\n${r.output.trim()}\n\`\`\``)
    .join('\n\n');
}

export function createServer(): McpServer {
  const server = new McpServer({ name: 'extension-forge', version: VERSION });

  server.registerTool(
    'get_vscode_extension_guide',
    {
      title: 'VS Code extension guide',
      description:
        'Returns the method for building VS Code extensions (in Spanish): what to ask the user, design rules, the three translation layers (English and Spanish), how to test and how to publish. Call it first when asked to create or change a VS Code extension. topic="reference" returns a cheat sheet of package.json, the VS Code API, webviews and common errors.',
      inputSchema: { topic: z.enum(['guide', 'reference']).optional().describe('guide (default) or reference') },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ topic }) => text(topic === 'reference' ? reference() : guide()),
  );

  server.registerTool(
    'create_vscode_extension',
    {
      title: 'Create a VS Code extension',
      description:
        'Creates a new bilingual (English/Spanish) VS Code extension in TypeScript from the template: sample command, author and language settings, translations, Node tests, a real-VS Code integration test, F5 launch config and packaging script. Then replace the sample command with the real feature, following the guide.',
      inputSchema: {
        destination: z.string().describe('Folder to create (absolute, or relative to the open workspace). Must not exist or be empty.'),
        name: z.string().describe('npm/Marketplace id: lowercase letters, digits and hyphens, e.g. web-code-stats'),
        displayNameEn: z.string().describe('Display name in English'),
        displayNameEs: z.string().describe('Display name in Spanish'),
        descriptionEn: z.string().describe('One-sentence description in English'),
        descriptionEs: z.string().describe('One-sentence description in Spanish'),
        author: z.string().optional().describe('Author name (defaults to the FORGE_AUTHOR setting)'),
        publisher: z.string().optional().describe('Marketplace publisher id (defaults to the FORGE_PUBLISHER setting)'),
        prefix: z.string().optional().describe('Prefix for command and setting ids (defaults to name in camelCase)'),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async (a) => {
      const author = a.author || process.env.FORGE_AUTHOR || '';
      const publisher = a.publisher || process.env.FORGE_PUBLISHER || '';
      if (!author || !publisher) {
        return fail('Ask the user for the author name and the Marketplace publisher id (or set them in the Extension Forge settings), then call again.');
      }
      try {
        const destination = abs(a.destination);
        const files = scaffold({ ...a, destination, author, publisher });
        return text(
          `Created ${destination} (${files.length} files):\n${files.map((f) => `- ${f}`).join('\n')}\n\n` +
            'Next: run_vscode_extension_tests on it (installs dependencies the first time), then implement the feature in src/core.ts (pure logic) and src/extension.ts (VS Code wiring), keeping every visible string in both languages.',
        );
      } catch (e) {
        return fail(String((e as Error).message ?? e));
      }
    },
  );

  server.registerTool(
    'check_vscode_extension',
    {
      title: 'Check a VS Code extension',
      description:
        'Static review of an extension folder without running anything: manifest fields, engines vs @types/vscode, Spanish translations of package.json (%keys%) and of vscode.l10n.t strings, Marketplace files (icon, README, CHANGELOG, LICENSE, repository), .vscodeignore and webview CSP.',
      inputSchema: { path: z.string().describe('Extension folder (contains package.json)') },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ path }) => {
      try {
        const findings = checkExtension(extensionRoot(path));
        const icon = { error: '✗', warning: '!', ok: '✓' } as const;
        const errors = findings.filter((f) => f.level === 'error').length;
        return text(
          `${errors === 0 ? 'No errors.' : `${errors} error(s).`}\n\n` + findings.map((f) => `${icon[f.level]} ${f.message}`).join('\n'),
        );
      } catch (e) {
        return fail(String((e as Error).message ?? e));
      }
    },
  );

  server.registerTool(
    'run_vscode_extension_tests',
    {
      title: 'Run the extension tests',
      description:
        'Installs dependencies if needed and runs `npm test`; with integration=true also runs the tests inside a real VS Code (downloads it the first time; uses xvfb-run on Linux without a display). Returns the end of the output.',
      inputSchema: {
        path: z.string().describe('Extension folder'),
        integration: z.boolean().optional().describe('Also run the tests in a real VS Code (slower)'),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
    },
    async ({ path, integration }) => {
      try {
        const results = await runTests(extensionRoot(path), integration ?? false);
        const ok = results.every((r) => r.ok);
        return { ...text(`${ok ? 'All tests passed.' : 'Some steps failed.'}\n\n${report(results)}`), isError: !ok };
      } catch (e) {
        return fail(String((e as Error).message ?? e));
      }
    },
  );

  server.registerTool(
    'package_vscode_extension',
    {
      title: 'Package the extension (.vsix)',
      description:
        'Runs `npm run package` (vsce) and returns the path of the .vsix, ready to install (Extensions → … → Install from VSIX) or upload to the Marketplace. Does not publish anything.',
      inputSchema: { path: z.string().describe('Extension folder') },
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
    },
    async ({ path }) => {
      try {
        const { results, vsix } = await packageExtension(extensionRoot(path));
        if (!vsix) return fail(`Packaging failed.\n\n${report(results)}`);
        const kb = Math.round(statSync(vsix).size / 1024);
        return text(`Packaged: ${vsix} (${kb} KB)\n\n${report(results)}`);
      } catch (e) {
        return fail(String((e as Error).message ?? e));
      }
    },
  );

  server.registerResource(
    'vscode-extension-guide',
    'forge://guide',
    { title: 'VS Code extension guide', description: 'Method for building bilingual VS Code extensions', mimeType: 'text/markdown' },
    async (uri) => ({ contents: [{ uri: uri.href, mimeType: 'text/markdown', text: guide() }] }),
  );
  server.registerResource(
    'vscode-extension-reference',
    'forge://reference',
    { title: 'VS Code manifest and API cheat sheet', mimeType: 'text/markdown' },
    async (uri) => ({ contents: [{ uri: uri.href, mimeType: 'text/markdown', text: reference() }] }),
  );

  server.registerPrompt(
    'new_vscode_extension',
    {
      title: 'New VS Code extension',
      description: 'Start building a VS Code extension from an idea, following the Extension Forge method.',
      argsSchema: { idea: z.string().describe('What the extension should do') },
    },
    ({ idea }) => ({
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text:
              `I want a VS Code extension: ${idea}\n\n` +
              'Use the Extension Forge tools: read get_vscode_extension_guide first, ask me only what you cannot infer (author, publisher, name, where to create it), ' +
              'create it with create_vscode_extension, implement it with every visible text in English and Spanish, then check_vscode_extension, ' +
              'run_vscode_extension_tests (with integration) and package_vscode_extension. Do not publish to the Marketplace.',
          },
        },
      ],
    }),
  );

  return server;
}

if (require.main === module) {
  createServer()
    .connect(new StdioServerTransport())
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
