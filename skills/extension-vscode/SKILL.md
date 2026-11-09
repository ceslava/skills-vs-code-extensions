---
name: extension-vscode
description: Crea, amplía, prueba y empaqueta extensiones de Visual Studio Code en TypeScript, bilingües (español e inglés) y con autor configurable. Úsala siempre que alguien pida una extensión, un plugin o un complemento para VS Code (órdenes de la paleta, ajustes, paneles webview, menús del explorador, análisis de ficheros del proyecto, informes), quiera traducir una extensión, generar el .vsix o publicarla, aunque no diga «skill».
---

# Extensiones de VS Code (bilingües y con autor)

Método para hacer extensiones de VS Code que funcionan a la primera, se prueban sin abrir VS Code a mano y salen
en español e inglés. Ejemplo completo y probado: https://github.com/ceslava/informe-vs-code (informe de HTML, CSS y
JS con métricas a elegir; publicable en el Marketplace). Plantilla mínima: `plantilla/` (la copia `scripts/crear-extension.py`).

## 1. Antes de escribir código, aclara

Pregunta solo lo que no se deduzca de la petición (si se deduce, decide y dilo):

- **Autor** (`author.name`, LICENSE, README) y **publisher** (id del Marketplace; si no tiene, el usuario de GitHub).
  Si la extensión genera algo (informes, ficheros), el autor de *eso* es además un ajuste `<prefijo>.author`
  con su orden «Indicar el autor».
- **Nombre** (`name` en minúsculas y guiones) y nombre visible en los dos idiomas.
- **Qué hace**: órdenes, ajustes, dónde se ve el resultado (notificación, panel webview, documento, fichero).
- **Dónde vive**: lo mejor es un repositorio propio para cada extensión (el Marketplace enlaza a él y saca de él las
  imágenes del README, así que tiene que ser público). Si el usuario no lo dice, pregúntalo.

## 2. Crear el esqueleto

```bash
python3 <carpeta-de-esta-skill>/scripts/crear-extension.py <destino> \
  --name <name> --publisher <publisher> --author "<Autor>" \
  --display-es "<Nombre>" --display-en "<Name>" --desc-es "<Qué hace.>" --desc-en "<What it does.>"
cd <destino> && npm install && npm test
```

Sale una extensión que ya compila, pasa sus pruebas y se empaqueta: orden de ejemplo, ajustes `author` y
`language`, traducciones, pruebas en Node y en un VS Code real, `launch.json` para F5. Después se sustituye la
orden de ejemplo por la que pide el usuario.

## 3. Reglas de diseño

1. **Lógica pura aparte.** Todo lo que no necesita VS Code (analizar, calcular, generar texto o HTML) va en módulos
   sin `import 'vscode'`, y `extension.ts` solo conecta: lee ajustes, busca ficheros, muestra resultados. Así se
   prueba con `node --test` en segundos.
2. **Las listas, en un solo sitio.** Si hay listas (métricas, opciones), defínelas una vez en TypeScript y que
   el `enum` de `package.json`, el selector y la salida salgan de ahí. Un test comprueba que `package.json` no se
   desincroniza (ver `src/test/analyzers.test.ts` en informe-vs-code).
3. **Que el usuario elija.** Ajustes de tipo `array` con `items.enum` y `uniqueItems` para elegir qué se hace, más
   una orden con `showQuickPick({ canPickMany: true })` que marque lo actual y guarde en el espacio de trabajo
   (`ConfigurationTarget.Workspace` si hay carpeta abierta; si no, `Global`). Lista vacía = no hacer esa parte.
4. **Activación:** `"activationEvents": []`. Desde VS Code 1.74 las órdenes, menús y vistas declarados en
   `contributes` activan la extensión solos; no uses `"*"`.
5. **Sin dependencias en tiempo de ejecución** si se puede (solo `devDependencies`): el `.vsix` pesa poco y se
   empaqueta con `--no-dependencies`. Si hacen falta, empaqueta con esbuild (ver `referencias/manifiesto-y-api.md`).
6. **Ficheros del proyecto:** `workspace.findFiles(new RelativePattern(carpeta, glob), exclude, max, token)` y
   `workspace.fs.readFile` (vale también en remoto y en vscode.dev), no `fs` de Node. Excluye `node_modules`,
   `dist`, `out`, `build` y minificados; trabaja dentro de `withProgress({ cancellable: true })`.
7. **Webviews seguros:** CSP con `default-src 'none'`, scripts y estilos con `nonce`, `localResourceRoots: []` si
   no se cargan ficheros, todo el texto escapado, colores con variables `--vscode-*` (siguen el tema). Botones →
   `postMessage` → `onDidReceiveMessage`. Nada de CDN.
8. **Clic derecho en carpetas:** `menus.explorer/context` con `"when": "explorerResourceIsFolder"`; la orden recibe
   el `Uri` como primer argumento.
9. **API para pruebas:** que `activate()` devuelva un objeto pequeño (p. ej. `lastReport()`) para que las pruebas de
   integración comprueben el resultado sin leer el webview.

## 4. Dos idiomas (siempre los dos)

Hay tres capas; cada texto visible va en una de ellas:

| Qué | Dónde | Cómo |
|---|---|---|
| Lo de `package.json` (nombre, descripción, títulos de órdenes, descripciones de ajustes y de cada valor del `enum`) | `package.nls.json` (inglés) y `package.nls.es.json` | `"%clave%"` en `package.json` |
| Mensajes, títulos de diálogos, botones | `l10n/bundle.l10n.es.json` (con la frase en inglés como clave) | `vscode.l10n.t('Report saved to {0}', ruta)` y `"l10n": "./l10n"` en `package.json` |
| Lo que la extensión **genera** (informes, ficheros) | diccionario propio `{ en, es }` en un módulo puro | ajuste `<prefijo>.language`: `auto` (sigue a `vscode.env.language`), `en`, `es` |

La tercera capa es aparte para que el usuario pueda tener VS Code en un idioma y el informe en otro, y para
probarla sin VS Code. Las pruebas de la plantilla comprueban que cada `%clave%` y cada `l10n.t(...)` tiene su
traducción: no las quites. Español con «tú», sin anglicismos innecesarios.

## 5. Probar (las tres cosas, siempre)

```bash
npm test                              # lógica pura, manifiesto y traducciones
xvfb-run -a npm run test:integration  # VS Code real descargado por @vscode/test-electron (sin xvfb-run en un escritorio)
npm run package                       # .vsix; lee los avisos de vsce
```

- La prueba de integración usa `--user-data-dir` temporal y `--disable-extensions`, cambia ajustes, ejecuta las
  órdenes con `executeCommand` y comprueba lo que devuelve la API. Necesita llegar a `update.code.visualstudio.com`.
- Prueba los dos idiomas cambiando el ajuste `language`; la interfaz en español (`--locale=es`) necesita el paquete
  de idioma, así que esa parte se cubre con los tests de traducciones.
- Para casos raros del análisis (cadenas, comentarios, plantillas, expresiones regulares), una tabla de casos en el
  test, como en informe-vs-code.
- Si hay salida visual (HTML), haz una captura en Chromium y mírala antes de darla por buena.
- Para el usuario: F5 en VS Code abre una ventana con la extensión cargada (`.vscode/launch.json`).

## 6. Empaquetar, instalar y publicar

- `npm run package` → `<name>-<versión>.vsix`. Se instala con `code --install-extension fichero.vsix` o desde
  Extensiones → `…` → *Instalar desde VSIX*. El `.vsix` no se sube al repo (`.gitignore`).
- `.vscodeignore` deja fuera `src`, tests, mapas y `node_modules`; revisa la lista de ficheros que imprime vsce.
- Publicar (`vsce publish`, Open VSX con `ovsx publish`) es una acción hacia fuera: **solo si el usuario lo pide**,
  y necesita su token (no lo pidas por el chat). Antes, versión nueva en `package.json` y entrada en `CHANGELOG.md`.

## 7. Al terminar

- README bilingüe con qué hace, órdenes, ajustes con un ejemplo de `settings.json` y cómo desarrollar.
- Si el repositorio tiene reglas de documentación (`AGENTS.md`, `CLAUDE.md`, bitácora), síguelas en el mismo commit.
- Para el Marketplace: `icon` (PNG de 256 px), `galleryBanner`, `repository`, `bugs`, capturas en el README y una
  guía `PUBLICAR.md`; en informe-vs-code están los flujos de GitHub Actions para probar y publicar con una etiqueta.
- Di al usuario cómo instalar el `.vsix` y qué no se ha podido probar.

Más detalle (manifiesto, API, webview, esbuild, errores típicos): `referencias/manifiesto-y-api.md`.
