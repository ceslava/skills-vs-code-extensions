#!/usr/bin/env python3
"""Crea una extensión de VS Code bilingüe (inglés y español) a partir de la plantilla de la skill.

Uso:
  python3 crear-extension.py DESTINO --name mi-extension --publisher ceslava --author "Nombre Apellido" \
      --display-es "Mi extensión" --display-en "My extension" \
      --desc-es "Qué hace." --desc-en "What it does." [--prefix miExtension]

Sustituye {{name}}, {{publisher}}, {{author}}, {{prefix}}, {{year}}, {{displayNameEs}}, {{displayNameEn}},
{{descriptionEs}} y {{descriptionEn}} en todos los ficheros. No sobrescribe una carpeta que ya tenga ficheros.
"""
import argparse
import datetime
import json
import re
import shutil
import sys
from pathlib import Path

PLANTILLA = Path(__file__).resolve().parent.parent / "plantilla"


def camel(name: str) -> str:
    partes = re.split(r"[^a-zA-Z0-9]+", name)
    return partes[0].lower() + "".join(p[:1].upper() + p[1:] for p in partes[1:])


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("destino")
    ap.add_argument("--name", required=True, help="identificador npm: minúsculas y guiones")
    ap.add_argument("--publisher", required=True, help="id de editor del Marketplace (o el usuario de GitHub)")
    ap.add_argument("--author", required=True, help="nombre del autor (package.json, LICENSE, README)")
    ap.add_argument("--display-es", required=True)
    ap.add_argument("--display-en", required=True)
    ap.add_argument("--desc-es", required=True)
    ap.add_argument("--desc-en", required=True)
    ap.add_argument("--prefix", help="prefijo de órdenes y ajustes (por defecto, name en camelCase)")
    a = ap.parse_args()

    if not re.fullmatch(r"[a-z0-9][a-z0-9-]*", a.name):
        sys.exit("--name: solo minúsculas, números y guiones")
    destino = Path(a.destino)
    if destino.exists() and any(destino.iterdir()):
        sys.exit(f"{destino} ya existe y no está vacía")

    valores = {
        "name": a.name, "publisher": a.publisher, "author": a.author, "prefix": a.prefix or camel(a.name),
        "year": str(datetime.date.today().year),
        "displayNameEs": a.display_es, "displayNameEn": a.display_en,
        "descriptionEs": a.desc_es, "descriptionEn": a.desc_en,
    }
    shutil.copytree(PLANTILLA, destino, dirs_exist_ok=True)
    for f in destino.rglob("*"):
        if not f.is_file():
            continue
        texto = f.read_text(encoding="utf-8")
        for k, v in valores.items():
            # En JSON el valor va escapado (comillas, barras); en el resto, tal cual.
            v_json = json.dumps(v, ensure_ascii=False)[1:-1]
            texto = texto.replace("{{" + k + "}}", v_json if f.suffix == ".json" else v)
        f.write_text(texto, encoding="utf-8")
    restos = [str(f) for f in destino.rglob("*") if f.is_file() and "{{" in f.read_text(encoding="utf-8")]
    if restos:
        sys.exit("Quedan marcadores sin sustituir en: " + ", ".join(restos))
    print(f"Extensión creada en {destino}. Siguiente paso: cd {destino} && npm install && npm test")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
