# Fingerprint Service (ZKTeco Live20R)

Real hardware path uses the official **ZKFinger SDK for Linux** (`libzkfp.so`) via ctypes.
MOCK mode is **off by default** (`ALLOW_MOCK=0`).

## Requirements

1. Live20R connected over USB (`lsusb` shows `1b55:0120`)
2. Native SDK libraries in `resources/sdk/SDK/lib-x64/` (especially `libzkfp.so`)
3. udev rule: `/etc/udev/rules.d/99-zkteco.rules` (vendor `1b55`, product `0120`)

## Start

```bash
./fingerprint-service/start.sh
# or
./start-all.sh
```

Verify:

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
