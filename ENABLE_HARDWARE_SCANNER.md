# 🔧 Enable Real ZKTeco Live20R Hardware Scanner

## Current Status
✅ **Fingerprint Service Running**: Port 5001  
⚠️ **Mode**: MOCK (simulated fingerprints)  
🔌 **Scanner Connected**: Yes (Bus 003 Device 004: ID 1b55:0120)  
📦 **pyzkfp Installed**: Yes  
❌ **Mono Runtime**: Not installed (required for pyzkfp)

---

## Why MOCK Mode?

The `pyzkfp` library is a Python wrapper around ZKTeco's .NET SDK, which requires the Mono runtime (.NET for Linux). Currently, Mono is not installed on your system, so the service runs in MOCK mode for testing.

### MOCK Mode Features:
- ✅ Simulates fingerprint enrollment (3 captures)
- ✅ Simulates fingerprint verification
- ✅ Simulates matching (always returns 92% confidence)
- ✅ All API endpoints work
- ✅ Full system testing possible

---

## Enable Real Hardware Support

### Option 1: Install Mono Runtime (Recommended)

This enables `pyzkfp` to communicate with the ZKTeco Live20R scanner.

```bash
# Install Mono runtime
sudo apt-get update
sudo apt-get install -y mono-complete

# Restart fingerprint service
# (stop current process with Ctrl+C and restart)
cd /home/rcaa/workspace/ubaka-payroll-mis
source venv-fingerprint/bin/activate
python fingerprint-service/zkfinger_service.py
```

**After installation**, the service will automatically:
- Detect the scanner via USB
- Initialize pyzkfp library
- Switch to PRODUCTION mode
- Capture real fingerprints from hardware

### Option 2: Direct USB Communication (Advanced)

For users who want to avoid Mono, implement direct USB communication using `pyusb`. This requires:

1. Reverse-engineering the ZKTeco USB protocol
2. Implementing low-level USB commands
3. Significant development effort

**Not recommended** unless you have specific requirements against using Mono.

---

## Testing Hardware Scanner

After installing Mono and restarting the service:

### 1. Check Service Status
```bash
curl http://127.0.0.1:5001/health
```

Expected output:
```json
{
    "status": "ok",
    "sdk_available": true,
    "sdk_type": "pyzkfp",
    "mode": "PRODUCTION",
    "scanner_initialized": true
}
```

### 2. Test Scanner Connection
```bash
curl http://127.0.0.1:5001/scanner/status
```

Expected output:
```json
{
    "success": true,
    "connected": true,
    "model": "ZKTeco Live20R",
    "sdk_type": "pyzkfp",
    "mode": "PRODUCTION"
}
```

### 3. Test Fingerprint Capture

**Enrollment (3 scans):**
```bash
curl -X POST http://127.0.0.1:5001/scanner/capture/enroll
```

The service will wait for you to place your finger on the scanner 3 times.

**Verification (1 scan):**
```bash
curl -X POST http://127.0.0.1:5001/scanner/capture/verify
```

Place your finger on the scanner once.

---

## Understanding the Workflow

### Enrollment Process (Registration)
1. User clicks "Scan Fingerprint" in registration form
2. Frontend calls backend `/api/fingerprint/capture/enroll`
3. Backend calls fingerprint service `/scanner/capture/enroll`
4. **REAL HARDWARE**: Service prompts user to place finger 3 times
5. Service merges 3 samples into one enrollment template
6. Template (base64) returned to frontend
7. Template stored in database with worker record

### Verification Process (Attendance)
1. User places finger on scanner
2. Frontend calls backend `/api/fingerprint/identify`
3. Backend calls fingerprint service `/scanner/capture/verify`
4. **REAL HARDWARE**: Service captures single fingerprint
5. Service compares against all stored templates
6. Returns matched worker ID if score ≥ 50
7. System records attendance event

---

## System Requirements for Hardware

### USB Permissions
Already configured in `/etc/udev/rules.d/99-zkteco.rules`:
```
SUBSYSTEM=="usb", ATTRS{idVendor}=="1b55", ATTRS{idProduct}=="0120", MODE="0666"
```

### Python Dependencies
Already installed in `venv-fingerprint`:
- flask==3.0.0
- flask-cors==4.0.0
- pyusb==1.2.1
- pillow==10.1.0
- numpy==1.26.2
- pyzkfp==0.1.0 ✅

### Additional Dependency Needed
- **Mono Runtime**: `sudo apt-get install mono-complete`

---

## Troubleshooting

### Scanner Not Detected
```bash
# Check USB connection
lsusb | grep ZKTeco
# Expected: Bus 003 Device 004: ID 1b55:0120 ZKTeco Inc. Live20R

# Check permissions
ls -la /dev/bus/usb/003/004
# Should show mode 0666 (world-readable/writable)
```

### pyzkfp Import Error
```bash
# Verify Mono is installed
mono --version

# If not, install:
sudo apt-get install mono-complete

# Verify pyzkfp installation
source venv-fingerprint/bin/activate
python -c "from pyzkfp import ZKFP2; print('Success')"
```

### Scanner Timeout or No Response
- Ensure no other application is using the scanner
- Unplug and re-plug USB cable
- Check `dmesg | tail` for USB errors
- Try different USB port

### Multiple Devices
If you have multiple scanners:
```python
# In zkfinger_service.py, change:
zkfp.OpenDevice(0)  # First device
zkfp.OpenDevice(1)  # Second device
```

---

## Quick Start Command

To enable hardware support **right now**:

```bash
# 1. Install Mono
sudo apt-get update && sudo apt-get install -y mono-complete

# 2. Stop current service (if running in terminal, press Ctrl+C)

# 3. Restart service
cd /home/rcaa/workspace/ubaka-payroll-mis
source venv-fingerprint/bin/activate
python fingerprint-service/zkfinger_service.py
```

**The service will auto-detect the hardware and switch to PRODUCTION mode!**

---

## Development Notes

### MOCK vs PRODUCTION Mode

| Feature | MOCK Mode | PRODUCTION Mode |
|---------|-----------|-----------------|
| API Endpoints | ✅ All working | ✅ All working |
| Testing | ✅ Full testing | ✅ Full testing |
| Fingerprint Data | 🎭 Simulated | 🔐 Real biometric |
| Worker Registration | ✅ Works | ✅ Works |
| Attendance Recording | ✅ Works | ✅ Works |
| Match Confidence | 92% (fixed) | Variable (real) |
| Hardware Required | ❌ No | ✅ Yes |
| Mono Required | ❌ No | ✅ Yes |

### When to Use Each Mode

**MOCK Mode**: Perfect for:
- Development and testing
- Demo presentations
- Systems without scanner hardware
- CI/CD pipelines
- UI/UX testing

**PRODUCTION Mode**: Required for:
- Actual employee attendance tracking
- Real security verification
- Compliance with biometric policies
- Production deployments

---

## Summary

Your system is **fully functional** in MOCK mode. To enable real hardware:

1. Run: `sudo apt-get install mono-complete`
2. Restart the fingerprint service
3. Done! Hardware will be automatically detected

The choice between MOCK and PRODUCTION mode depends on your testing needs. Both modes provide identical APIs and workflows.

**🎯 Current recommendation**: Continue testing in MOCK mode, then enable hardware when ready for production use.
