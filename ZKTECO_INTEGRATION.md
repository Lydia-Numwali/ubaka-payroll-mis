# ZKTeco Live20R Integration Guide

## Scanner Details
- **Model**: ZKTeco Live20R
- **Connection**: USB
- **SDK**: ZKFinger SDK (Python bindings available)

## Integration Architecture

We'll use a **Python Bridge** approach:
```
Frontend → Backend (Node.js) → Python Service → ZKTeco SDK → Scanner
```

This is the most reliable method for ZKTeco scanners on Linux.

## Installation Steps

### Step 1: Install ZKFinger SDK for Linux

```bash
# Navigate to resources/sdk directory
cd resources/sdk

# Download ZKFinger SDK for Linux
# Note: You may need to get this from ZKTeco support or your scanner package
# Common locations:
# - CD that came with scanner
# - ZKTeco website (requires registration)
# - Contact: support@zkteco.com

# The SDK typically includes:
# - libzkfp.so (library file)
# - Python bindings
# - Documentation

# If you have the SDK, extract it:
# tar -xzf zkfinger_sdk_linux.tar.gz
```

### Step 2: Install Python Dependencies

```bash
# Install Python 3 and pip (if not already installed)
sudo apt update
sudo apt install python3 python3-pip python3-venv

# Create virtual environment for the fingerprint service
cd /home/rcaa/workspace/ubaka-payroll-mis
python3 -m venv venv-fingerprint
source venv-fingerprint/bin/activate

# Install required Python packages
pip install flask pyusb pillow numpy
```

### Step 3: Set USB Permissions

```bash
# Check if scanner is detected
lsusb | grep -i zk

# Expected output similar to:
# Bus 001 Device 005: ID 1b55:0120 ZKTeco Live20R

# Create udev rule for scanner access
sudo nano /etc/udev/rules.d/99-zkteco.rules

# Add this line (replace XXXX:YYYY with your device ID from lsusb):
SUBSYSTEM=="usb", ATTR{idVendor}=="1b55", ATTR{idProduct}=="0120", MODE="0666"

# Reload udev rules
sudo udevadm control --reload-rules
sudo udevadm trigger

# Add your user to dialout group
sudo usermod -a -G dialout $USER

# Logout and login for changes to take effect
```

## Implementation Files Created

I'll create the following files:

1. **Python Service** (`fingerprint-service/zkfinger_service.py`)
   - Flask HTTP server
   - ZKFinger SDK integration
   - Template capture and matching

2. **Python Service Startup** (`fingerprint-service/start.sh`)
   - Activates virtual environment
   - Starts Flask server

3. **Updated Backend Service** (`backend/src/services/FingerprintService.ts`)
   - Calls Python service via HTTP
   - Handles responses

4. **Service Manager** (`fingerprint-service/install.sh`)
   - Optional: Install as systemd service

## Testing the Scanner

```bash
# Test if scanner is detected
lsusb | grep -i zk

# Test Python can access USB
python3 -c "import usb.core; print([d for d in usb.core.find(find_all=True)])"
```

## Next Steps

1. Place your ZKFinger SDK files in `resources/sdk/`
2. Run the installation steps above
3. I'll create the Python bridge service
4. Test the integration

---

**Status**: Ready to implement once SDK is available
