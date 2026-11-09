import * as vscode from 'vscode';
import { greeting, resolveLocale } from './core';

export interface Api {
  lastMessage(): string | undefined;
}

let last: string | undefined;

export function activate(context: vscode.ExtensionContext): Api {
  context.subscriptions.push(
    vscode.commands.registerCommand('{{prefix}}.hello', () => {
      const cfg = vscode.workspace.getConfiguration('{{prefix}}');
      const locale = resolveLocale(cfg.get('language', 'auto'), vscode.env.language);
      last = greeting(locale, cfg.get('author', ''));
      vscode.window.showInformationMessage(last);
      if (!cfg.get('author', '')) {
        // Textos de la interfaz: vscode.l10n.t con la frase en inglés como clave (l10n/bundle.l10n.es.json).
        const open = vscode.l10n.t('Open settings');
        vscode.window
          .showWarningMessage(vscode.l10n.t('Set your name in the {0} setting', '{{prefix}}.author'), open)
          .then((a) => a === open && vscode.commands.executeCommand('workbench.action.openSettings', '{{prefix}}.author'));
      }
    }),
  );
  return { lastMessage: () => last };
}

export function deactivate(): void {}
