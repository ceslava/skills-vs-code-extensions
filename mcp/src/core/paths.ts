import { existsSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Carpeta de la skill. En el paquete va en `skill/` (la copia `npm run copy-skill`);
 * en el repositorio, si no se ha copiado, se usa `../skills/extension-vscode`.
 */
export function skillDir(): string {
  const candidates = [
    process.env.FORGE_SKILL_DIR ?? '',
    join(__dirname, '..', 'skill'),
    join(__dirname, '..', '..', 'skill'),
    join(__dirname, '..', '..', 'skills', 'extension-vscode'),
    join(__dirname, '..', '..', '..', 'skills', 'extension-vscode'),
  ].filter(Boolean);
  const found = candidates.find((c) => existsSync(join(c, 'SKILL.md')));
  if (!found) throw new Error('No se encuentra la skill (SKILL.md). / Skill folder not found.');
  return found;
}
