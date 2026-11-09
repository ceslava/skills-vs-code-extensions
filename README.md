# Skills para crear extensiones de VS Code

Skill de Claude Code para hacer extensiones de Visual Studio Code en TypeScript que salen **en español e inglés**,
con **autor configurable**, probadas en Node y en un VS Code real, y listas para el Marketplace.

Ejemplo hecho con ella: [informe-vs-code](https://github.com/ceslava/informe-vs-code), un informe de los ficheros
HTML, CSS y JavaScript del proyecto con métricas a elegir.

## Qué hay

```
skills/extension-vscode/
├── SKILL.md                      método: qué preguntar, reglas de diseño, traducciones, pruebas, publicar
├── referencias/manifiesto-y-api.md  chuleta de package.json, la API, webviews, esbuild y errores típicos
├── scripts/crear-extension.py    crea una extensión nueva a partir de la plantilla
└── plantilla/                    extensión mínima que ya compila, pasa sus pruebas y se empaqueta
```

## Instalar

Como plugin de Claude Code:

```
/plugin marketplace add ceslava/skills-vs-code-extensions
```

```
/plugin install vs-code-extensions@ceslava-skills
```

O copiando la carpeta de la skill en tus skills personales (o en `.claude/skills/` de un proyecto):

```bash
git clone https://github.com/ceslava/skills-vs-code-extensions && cp -r skills-vs-code-extensions/skills/extension-vscode ~/.claude/skills/
```

Después basta con pedir «hazme una extensión de VS Code que…»; también se puede llamar con `/extension-vscode`.

## Usar la plantilla sin Claude

```bash
python3 skills/extension-vscode/scripts/crear-extension.py ../mi-extension \
  --name mi-extension --publisher tu-publisher --author "Tu Nombre" \
  --display-es "Mi extensión" --display-en "My extension" \
  --desc-es "Qué hace." --desc-en "What it does."
```

```bash
cd ../mi-extension && npm install && npm test
```

Pruebas en un VS Code real con `npm run test:integration` (en Linux sin pantalla, `xvfb-run -a npm run test:integration`)
y paquete `.vsix` con `npm run package`.

## Licencia

MIT
