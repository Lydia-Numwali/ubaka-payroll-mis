# Windows ZKFinger SDK (Live20R)

Place the official **ZKFinger SDK for Windows** DLLs in this folder before building
a hardware-capable installer.

## Required

At minimum the supervisor looks for:

- `libzkfp.dll`

Also copy any dependent DLLs from the SDK package (names vary by SDK version), for example:

- `zkfinger10.dll`
- `libiomp5md.dll`
- `sqlite3.dll`
- `libusb-1.0.dll`

## Driver

Install the ZKTeco Live20R USB driver from the vendor on each laptop.

## Without DLLs

The all-in-one app still starts: the fingerprint sidecar runs with `ALLOW_MOCK=1`.
UI and payroll work; biometric capture/identify use mock data until DLLs are added
and the app is restarted.
