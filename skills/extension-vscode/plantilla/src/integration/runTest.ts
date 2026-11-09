import { join } from 'node:path';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { runTests } from '@vscode/test-electron';

const root = join(__dirname, '..', '..');
runTests({
  extensionDevelopmentPath: root,
  extensionTestsPath: join(__dirname, 'index'),
  launchArgs: [
    '--disable-extensions',
    '--disable-workspace-trust',
    `--user-data-dir=${mkdtempSync(join(tmpdir(), 'vscode-test-'))}`,
  ],
}).catch((err) => {
  console.error(err);
  process.exit(1);
});
