import { cpSync, existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { skillDir } from './paths';

export interface ScaffoldOptions {
  destination: string;
  name: string;
  publisher: string;
  author: string;
  displayNameEs: string;
  displayNameEn: string;
  descriptionEs: string;
  descriptionEn: string;
  prefix?: string;
}

export function camel(name: string): string {
  const parts = name.split(/[^a-zA-Z0-9]+/).filter(Boolean);
  return parts[0].toLowerCase() + parts.slice(1).map((p) => p[0].toUpperCase() + p.slice(1)).join('');
}

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

/** Copia la plantilla de la skill y sustituye los {{marcadores}}. Devuelve los ficheros creados. */
export function scaffold(o: ScaffoldOptions): string[] {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(o.name)) {
    throw new Error('name: only lowercase letters, digits and hyphens / solo minúsculas, números y guiones');
  }
  if (!o.publisher.trim()) throw new Error('publisher is required / falta el publisher');
  if (!o.author.trim()) throw new Error('author is required / falta el autor');
  if (existsSync(o.destination) && readdirSync(o.destination).length > 0) {
    throw new Error(`${o.destination} already exists and is not empty / ya existe y no está vacía`);
  }
  const values: Record<string, string> = {
    name: o.name,
    publisher: o.publisher.trim(),
    author: o.author.trim(),
    prefix: o.prefix || camel(o.name),
    year: String(new Date().getFullYear()),
    displayNameEs: o.displayNameEs,
    displayNameEn: o.displayNameEn,
    descriptionEs: o.descriptionEs,
    descriptionEn: o.descriptionEn,
  };
  cpSync(join(skillDir(), 'plantilla'), o.destination, { recursive: true });
  const files = walk(o.destination);
  for (const f of files) {
    let text = readFileSync(f, 'utf8');
    for (const [k, v] of Object.entries(values)) {
      // En JSON, el valor va escapado (comillas, barras).
      const value = f.endsWith('.json') ? JSON.stringify(v).slice(1, -1) : v;
      text = text.split(`{{${k}}}`).join(value);
    }
    if (text.includes('{{')) throw new Error(`Unreplaced placeholder in ${f}`);
    writeFileSync(f, text);
  }
  return files.map((f) => relative(o.destination, f).split('\\').join('/')).sort();
}
