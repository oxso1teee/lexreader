#!/usr/bin/env python3
"""Полная сборка dist/: токены+компоненты → экраны → галерея → справочник.
Запуск (из корня репозитория): npm run design:build"""
import pathlib, subprocess, sys
T = pathlib.Path(__file__).resolve().parent
for step in ("build_ds.py", "build_screens.py", "build_gallery.py", "build_system_page.py"):
    print(f"▸ {step}")
    subprocess.run([sys.executable, str(T / step)], check=True)
print("✓ dist/ собран")
