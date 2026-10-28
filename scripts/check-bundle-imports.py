#!/usr/bin/env python
"""Static import-completeness check for the PyInstaller training sidecar.

TFLiteTraining.spec analyzes only its entry script (desktop_launcher.py); the
app modules (app.py, record_controller.py, ...) ship as *data* files, so
PyInstaller never analyzes their imports. Adding a module or data file
upstream without updating the spec datas therefore builds fine and only
crashes when the Streamlit script first runs — i.e. when a user opens the
training panel in the packaged app.

This check catches that class of bug at build time: every import made by the
shipped app modules must resolve to

  - another module shipped next to them in the bundle root, or
  - a top-level module inside the PYZ archive embedded in the executable, or
  - the Python standard library (sys.stdlib_module_names).

Usage: python scripts/check-bundle-imports.py <dist/TFLiteTraining dir>

Requires PyInstaller (importable) — e.g. the same interpreter that just built
the bundle. Exits non-zero on unresolved imports; imports inside try/except
blocks are reported as warnings only, since they are typically optional or
platform-conditional.
"""

import ast
import sys
from pathlib import Path

from PyInstaller.archive.readers import CArchiveReader

# Never resolvable on disk; always allowed.
SKIP = {"__future__", "__main__", "builtins", "antigravity"}


def collect_imports(tree):
    """Return (hard, guarded) sets of top-level imported module names."""
    hard, guarded = set(), set()

    def names_of(node):
        if isinstance(node, ast.Import):
            return [alias.name for alias in node.names]
        if isinstance(node, ast.ImportFrom) and node.level == 0 and node.module:
            return [node.module]
        return []

    # Imports inside a try block are treated as optional (typically guarded by
    # `except ImportError` with a fallback); everything else must resolve.
    try_scoped = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Try):
            for sub in ast.walk(node):
                if isinstance(sub, (ast.Import, ast.ImportFrom)):
                    try_scoped.add(id(sub))
    for node in ast.walk(tree):
        if isinstance(node, (ast.Import, ast.ImportFrom)):
            sink = guarded if id(node) in try_scoped else hard
            for name in names_of(node):
                sink.add(name.split(".")[0])
    # A module imported both plainly and inside a try block must resolve anyway.
    return hard, guarded - hard


def bundle_available(internal: Path, exe: Path) -> set:
    """Names an import could resolve to inside the frozen bundle."""
    available = {p.stem for p in internal.glob("*.py")}
    # Collected package directories count as importable too (some packages
    # land as real files next to the app modules).
    available |= {p.name for p in internal.iterdir() if p.is_dir()}
    available |= set(sys.stdlib_module_names)

    car = CArchiveReader(str(exe))
    pyz_name = next((n for n in car.toc if n.upper().startswith("PYZ")), None)
    if pyz_name is not None:
        pyz = car.open_embedded_archive(pyz_name)
        available |= {name.split(".")[0] for name in pyz.toc}
    return available


def main() -> int:
    if len(sys.argv) != 2:
        print(f"usage: {sys.argv[0]} <dist/TFLiteTraining dir>", file=sys.stderr)
        return 2
    dist = Path(sys.argv[1])
    internal = dist / "_internal"
    if not internal.is_dir():
        print(f"error: {internal} not found (pass the dist/TFLiteTraining dir)", file=sys.stderr)
        return 2

    app_sources = sorted(internal.glob("*.py"))
    if not app_sources:
        print(f"error: no app modules (*.py) in {internal}", file=sys.stderr)
        return 2

    exe = next(
        (p for p in (dist / "TFLiteTrainingConsole.exe", dist / "TFLiteTrainingConsole",
                     dist / "TFLiteTraining.exe", dist / "TFLiteTraining")
         if p.is_file()),
        None,
    )
    if exe is None:
        print(f"error: no TFLiteTraining(.exe)/TFLiteTrainingConsole(.exe) in {dist}", file=sys.stderr)
        return 2

    available = bundle_available(internal, exe)

    errors, warnings = [], []
    for src in app_sources:
        tree = ast.parse(src.read_text(), filename=str(src))
        hard, guarded = collect_imports(tree)
        for name in sorted(hard - SKIP):
            if name not in available:
                errors.append(f"{src.name}: 'import {name}' resolves to nothing in the bundle")
        for name in sorted(guarded - SKIP):
            if name not in available:
                warnings.append(f"{src.name}: optional import {name!r} missing (try/except-guarded)")

    for warning in warnings:
        print(f"warning: {warning}", file=sys.stderr)
    if errors:
        for error in errors:
            print(f"error: {error}", file=sys.stderr)
        print(
            "\nUnresolved import(s) above. Add the missing module to "
            "TFLiteTraining.spec (datas for app-source modules, hiddenimports "
            "or collect_all for installed packages).",
            file=sys.stderr,
        )
        return 1

    print(
        f"bundle-imports: OK — {len(app_sources)} app modules checked, "
        f"{len(warnings)} guarded import(s) missing (non-fatal)"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
