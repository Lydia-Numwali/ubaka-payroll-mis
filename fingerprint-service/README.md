# Fingerprint Service (ZKTeco Live20R)

Real hardware path uses the official ZKFinger C SDK via ctypes:

- **Linux:** `libzkfp.so` in `resources/sdk/SDK/lib-x64/`
- **Windows:** `libzkfp.dll` in `resources/sdk/windows/` (see that folder’s README)

MOCK mode is **off by default** (`ALLOW_MOCK=0`). For the Windows all-in-one installer,
mock is used automatically when DLLs are missing.

## Requirements

1. Live20R connected over USB (`lsusb` shows `1b55:0120` on Linux)
2. Native SDK libraries (Linux `.so` or Windows `.dll` as above)
3. Linux udev rule **or** Windows Live20R driver

## Start

```bash
./fingerprint-service/start.sh
# or
./start-all.sh
```

Windows (dev):

```bat
fingerprint-service\start.cmd
```

## Windows installer binary

```bat
pip install -r requirements.txt pyinstaller
pyinstaller build_windows.spec
```

Produces `dist/fingerprint-service.exe` for `scripts/package-windows.sh`.
See [PACKAGING.md](../PACKAGING.md).

## Verify

```bash
curl http://127.0.0.1:5001/health
# expect: "mode": "PRODUCTION", "sdk_type": "native"
```

## Re-enrollment

Workers enrolled while the service was in MOCK mode have fake templates.
Re-scan each worker’s fingerprint after switching to PRODUCTION so attendance matching works.

## Reconnect after unplug / USB port change

The service tracks the Live20R USB identity (bus, address, sysfs path, serial).
If you unplug and plug it back in (or move ports), it auto-reconnects on the next
scan/status call and updates the USB schema.

Manual reconnect:

```bash
curl -X POST http://127.0.0.1:5001/scanner/reconnect
```
