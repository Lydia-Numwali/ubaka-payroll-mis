# -*- mode: python ; coding: utf-8 -*-
# Build on Windows:
#   pip install pyinstaller -r requirements.txt
#   pyinstaller build_windows.spec
#
# Output: dist/fingerprint-service.exe

block_cipher = None

a = Analysis(
    ['zkfinger_service.py'],
    pathex=[],
    binaries=[],
    datas=[],
    hiddenimports=[
        'flask',
        'flask_cors',
        'usb',
        'usb.core',
        'usb.util',
        'PIL',
        'numpy',
        'native_zkfp',
        'usb_device',
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=['pyzkfp'],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name='fingerprint-service',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
