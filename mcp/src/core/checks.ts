import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

export interface Finding {
  level: 'error' | 'warning' | 'ok';
  message: string;
}

const readJson = (p: string): any => JSON.parse(readFileSync(p, 'utf8'));

function tsFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    // Las pruebas no son interfaz: pueden llevar textos sin traducir a propósito.
    if (statSync(p).isDirectory()) return ['node_modules', 'test', 'integration'].includes(f) ? [] : tsFiles(p);
    return /\.(ts|js)$/.test(f) && !/\.(d|test)\.ts$/.test(f) ? [p] : [];
  });
}

/** Mayor versión «x.y» de un rango semver sencillo (^1.90.0 → [1, 90]). */
function minor(range: string | undefined): [number, number] | undefined {
  const m = /(\d+)\.(\d+)/.exec(range ?? '');
  return m ? [Number(m[1]), Number(m[2])] : undefined;
}

/**
 * Revisión estática de una extensión: manifiesto, traducciones al español, ficheros que pide el
 * Marketplace y seguridad básica del webview. No ejecuta nada.
 */
export function checkExtension(root: string): Finding[] {
  const out: Finding[] = [];
  const err = (message: string) => out.push({ level: 'error', message });
  const warn = (message: string) => out.push({ level: 'warning', message });
  const ok = (message: string) => out.push({ level: 'ok', message });

  const pkgPath = join(root, 'package.json');
  if (!existsSync(pkgPath)) {
    err('package.json not found');
    return out;
  }
  const pkg = readJson(pkgPath);
  const pkgText = readFileSync(pkgPath, 'utf8');

  if (!/^[a-z0-9][a-z0-9-]*$/.test(pkg.name ?? '')) err('"name" must be lowercase letters, digits and hyphens');
  if (!pkg.publisher) err('"publisher" is missing (needed for the Marketplace)');
  if (!pkg.author) warn('"author" is missing');
  if (!pkg.version) err('"version" is missing');
  if (!pkg.main && !pkg.browser) err('"main" (or "browser") is missing');
  const engine = minor(pkg.engines?.vscode);
  if (!engine) err('"engines.vscode" is missing');
  const types = minor(pkg.devDependencies?.['@types/vscode']);
  if (engine && types && (types[0] > engine[0] || (types[0] === engine[0] && types[1] > engine[1]))) {
    err(`@types/vscode (${pkg.devDependencies['@types/vscode']}) is newer than engines.vscode (${pkg.engines.vscode}); vsce will refuse to package`);
  }
  if ((pkg.activationEvents ?? []).includes('*')) warn('"activationEvents": ["*"] slows VS Code down; contributed commands activate the extension by themselves');
  if (!pkg.repository) warn('"repository" is missing (the Marketplace links to it and resolves README images from it)');
  if (!pkg.license) warn('"license" is missing');
  if (!pkg.icon) warn('"icon" is missing (PNG, at least 128×128, recommended for the Marketplace)');
  else if (!pkg.icon.endsWith('.png')) err('"icon" must be a PNG (SVG is not accepted by the Marketplace)');
  else if (!existsSync(join(root, pkg.icon))) err(`icon file ${pkg.icon} not found`);
  for (const f of ['README.md', 'CHANGELOG.md', 'LICENSE']) {
    if (!existsSync(join(root, f)) && !(f === 'LICENSE' && existsSync(join(root, 'LICENSE.md')))) warn(`${f} is missing`);
  }

  // package.json → package.nls.json / package.nls.es.json
  const keys = [...pkgText.matchAll(/"%([^%"]+)%"/g)].map((m) => m[1]);
  const nlsEn = join(root, 'package.nls.json');
  const nlsEs = join(root, 'package.nls.es.json');
  if (keys.length === 0) warn('package.json has no %keys%: manifest strings are not translatable');
  else if (!existsSync(nlsEn)) err('package.nls.json is missing');
  else {
    const en = readJson(nlsEn);
    const es = existsSync(nlsEs) ? readJson(nlsEs) : undefined;
    if (!es) err('package.nls.es.json is missing (Spanish manifest strings)');
    for (const k of keys) {
      if (!(k in en)) err(`package.nls.json: missing "${k}"`);
      if (es && !(k in es)) err(`package.nls.es.json: missing "${k}"`);
    }
    if (es) {
      const extra = Object.keys(en).filter((k) => !(k in es));
      if (extra.length) err(`package.nls.es.json lacks keys present in package.nls.json: ${extra.join(', ')}`);
    }
  }

  // vscode.l10n.t(...) → l10n/bundle.l10n.es.json
  const sources = tsFiles(join(root, 'src'));
  const used = new Set<string>();
  let webview = false;
  for (const f of sources) {
    const t = readFileSync(f, 'utf8');
    for (const m of t.matchAll(/l10n\.t\(\s*(['"`])((?:\\.|(?!\1).)*)\1/g)) used.add(m[2]);
    if (/createWebviewPanel|registerWebviewViewProvider/.test(t)) {
      webview = true;
      if (!/Content-Security-Policy/.test(t)) warn(`${f.slice(root.length + 1)}: webview without a Content-Security-Policy`);
    }
  }
  if (used.size > 0) {
    if (!pkg.l10n) err('package.json: "l10n": "./l10n" is missing but the code uses vscode.l10n.t');
    const bundlePath = join(root, pkg.l10n ?? 'l10n', 'bundle.l10n.es.json');
    if (!existsSync(bundlePath)) err('l10n/bundle.l10n.es.json is missing');
    else {
      const bundle = readJson(bundlePath);
      for (const s of used) if (!(s in bundle)) err(`bundle.l10n.es.json: missing "${s}"`);
    }
  }

  const ignore = existsSync(join(root, '.vscodeignore')) ? readFileSync(join(root, '.vscodeignore'), 'utf8') : '';
  if (!ignore) warn('.vscodeignore is missing: sources and tests would go into the .vsix');
  else if (!/^src\//m.test(ignore)) warn('.vscodeignore does not exclude src/');

  if (out.every((f) => f.level !== 'error')) {
    ok(`Manifest OK; ${keys.length} manifest strings and ${used.size} UI strings translated to Spanish${webview ? '; webview checked' : ''}`);
  }
  return out;
}
