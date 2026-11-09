import { spawn } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

export interface RunResult {
  ok: boolean;
  command: string;
  output: string;
}

const MAX = 6000;

/** Ejecuta una orden y devuelve el final de su salida. Sin shell salvo en Windows (npm.cmd). */
export function run(cmd: string, args: string[], cwd: string, timeoutMs = 10 * 60_000): Promise<RunResult> {
  return new Promise((resolve) => {
    const command = [cmd, ...args].join(' ');
    let output = '';
    const env: NodeJS.ProcessEnv = { ...process.env, CI: '1' };
    // Si el servidor corre dentro de `node --test`, el `npm test` de la extensión no debe creerse anidado.
    delete env.NODE_TEST_CONTEXT;
    const child = spawn(cmd, args, { cwd, shell: process.platform === 'win32', env });
    const add = (d: Buffer) => {
      output = (output + d.toString()).slice(-MAX * 2);
    };
    child.stdout.on('data', add);
    child.stderr.on('data', add);
    const timer = setTimeout(() => child.kill(), timeoutMs);
    child.on('error', (e) => {
      clearTimeout(timer);
      resolve({ ok: false, command, output: String(e) });
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ ok: code === 0, command, output: output.slice(-MAX) });
    });
  });
}

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

export async function ensureInstalled(root: string): Promise<RunResult | undefined> {
  if (existsSync(join(root, 'node_modules'))) return undefined;
  const ci = existsSync(join(root, 'package-lock.json'));
  return run(npm, [ci ? 'ci' : 'install', '--no-audit', '--no-fund'], root);
}

/** npm test y, si se pide, las pruebas en un VS Code real (con xvfb-run en Linux sin pantalla). */
export async function runTests(root: string, integration: boolean): Promise<RunResult[]> {
  const results: RunResult[] = [];
  const install = await ensureInstalled(root);
  if (install) {
    results.push(install);
    if (!install.ok) return results;
  }
  results.push(await run(npm, ['test'], root));
  if (integration) {
    const headless = process.platform === 'linux' && !process.env.DISPLAY;
    results.push(
      headless
        ? await run('xvfb-run', ['-a', npm, 'run', 'test:integration'], root)
        : await run(npm, ['run', 'test:integration'], root),
    );
  }
  return results;
}

export async function packageExtension(root: string): Promise<{ results: RunResult[]; vsix?: string }> {
  const results: RunResult[] = [];
  const install = await ensureInstalled(root);
  if (install) {
    results.push(install);
    if (!install.ok) return { results };
  }
  const r = await run(npm, ['run', 'package'], root);
  results.push(r);
  const vsix = readdirSync(root)
    .filter((f) => f.endsWith('.vsix'))
    .map((f) => join(root, f))
    .sort()
    .pop();
  return { results, vsix: r.ok ? vsix : undefined };
}
