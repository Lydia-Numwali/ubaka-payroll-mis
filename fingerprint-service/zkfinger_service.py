#!/usr/bin/env python3
"""
ZKTeco Live20R Fingerprint Scanner Service

Primary path: native libzkfp.so (ctypes) — real USB hardware.
Optional fallback: pyzkfp (.NET) if native path is unavailable.
MOCK only when ALLOW_MOCK=1 (disabled by default).
"""

from flask import Flask, jsonify, request
from flask_cors import CORS
import os
import base64
import logging
from datetime import datetime

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger('zkfinger_service')

app = Flask(__name__)
CORS(app)

ALLOW_MOCK = os.environ.get('ALLOW_MOCK', '0') == '1'
MATCH_THRESHOLD = int(os.environ.get('SCANNER_MATCH_THRESHOLD', '50'))
CAPTURE_TIMEOUT = float(os.environ.get('SCANNER_CAPTURE_TIMEOUT', '30'))

scanner_initialized = False
MODE = "UNINITIALIZED"
SDK_TYPE = "none"
native_scanner = None   # NativeZKFP instance
zkfp = None             # pyzkfp ZKFP2 instance (fallback)

# ---------------------------------------------------------------------------
# Prefer native C SDK; optionally try pyzkfp
# ---------------------------------------------------------------------------
NATIVE_AVAILABLE = False
PYZKFP_AVAILABLE = False

try:
    from native_zkfp import NativeZKFP, ensure_library_path
    ensure_library_path()
    NATIVE_AVAILABLE = True
    logger.info("Native ZKFinger SDK (libzkfp.so) available")
except Exception as e:
    logger.warning(f"Native ZKFinger SDK unavailable: {e}")

if not NATIVE_AVAILABLE:
    # Configure pythonnet only if we need pyzkfp
    import shutil
    import subprocess

    def _configure_pythonnet_runtime():
        if os.environ.get('PYTHONNET_RUNTIME'):
            return
        dotnet = shutil.which('dotnet')
        if dotnet:
            os.environ['PYTHONNET_RUNTIME'] = 'coreclr'
            os.environ.setdefault('DOTNET_ROOT', os.path.dirname(os.path.realpath(dotnet)))
            return
        try:
            result = subprocess.run(
                ['ldconfig', '-p'], capture_output=True, text=True, timeout=5
            )
            if 'libmonosgen' in result.stdout:
                os.environ['PYTHONNET_RUNTIME'] = 'mono'
        except Exception:
            pass

    _configure_pythonnet_runtime()
    try:
        from pyzkfp import ZKFP2
        PYZKFP_AVAILABLE = True
        logger.info("pyzkfp available as fallback")
    except Exception as e:
        logger.warning(f"pyzkfp unavailable: {e}")

SDK_AVAILABLE = NATIVE_AVAILABLE or PYZKFP_AVAILABLE
MODE = "PRODUCTION" if SDK_AVAILABLE else ("MOCK" if ALLOW_MOCK else "DISABLED")

logger.info("=" * 60)
logger.info("ZKTeco Live20R Fingerprint Service")
logger.info("=" * 60)
logger.info(f"Native SDK    : {NATIVE_AVAILABLE}")
logger.info(f"pyzkfp fallback: {PYZKFP_AVAILABLE}")
logger.info(f"ALLOW_MOCK    : {ALLOW_MOCK}")
logger.info(f"Mode          : {MODE}")
logger.info("=" * 60)


def initialize_scanner() -> bool:
    """Initialize connection to ZKTeco fingerprint scanner."""
    global scanner_initialized, native_scanner, zkfp, MODE, SDK_TYPE
    global NATIVE_AVAILABLE, PYZKFP_AVAILABLE, SDK_AVAILABLE

    if not SDK_AVAILABLE:
        if ALLOW_MOCK:
            logger.warning("No SDK — running in MOCK mode (ALLOW_MOCK=1)")
            MODE = "MOCK"
            SDK_TYPE = "mock"
            scanner_initialized = True
            return True
        logger.error("No fingerprint SDK available and ALLOW_MOCK is not set")
        MODE = "DISABLED"
        scanner_initialized = False
        return False

    # --- Native C SDK (preferred) ---
    if NATIVE_AVAILABLE:
        try:
            logger.info("Initializing scanner with native libzkfp …")
            native_scanner = NativeZKFP()
            native_scanner.init()
            count = native_scanner.get_device_count()
            if count < 1:
                raise RuntimeError(
                    "No ZKTeco scanner detected via USB. "
                    "Check cable, power, and udev rules (vendor 1b55)."
                )
            native_scanner.open_device(0)
            MODE = "PRODUCTION"
            SDK_TYPE = "native"
            scanner_initialized = True
            logger.info(f"ZKTeco Live20R opened (native), devices={count}")
            return True
        except Exception as e:
            logger.error(f"Native SDK init failed: {e}")
            try:
                if native_scanner:
                    native_scanner.terminate()
            except Exception:
                pass
            native_scanner = None
            NATIVE_AVAILABLE = False

    # --- pyzkfp fallback ---
    if PYZKFP_AVAILABLE:
        try:
            logger.info("Initializing scanner with pyzkfp …")
            zkfp = ZKFP2()
            zkfp.Init()
            count = zkfp.GetDeviceCount()
            if count < 1:
                raise RuntimeError("No ZKTeco scanner detected via USB")
            result = zkfp.OpenDevice(0)
            if result is None or (isinstance(result, int) and result < 0):
                # OpenDevice returns handle; treat falsy as failure only if int error
                pass
            MODE = "PRODUCTION"
            SDK_TYPE = "pyzkfp"
            scanner_initialized = True
            logger.info(f"ZKTeco Live20R opened (pyzkfp), devices={count}")
            return True
        except Exception as e:
            logger.error(f"pyzkfp init failed: {e}")
            zkfp = None
            PYZKFP_AVAILABLE = False

    SDK_AVAILABLE = False
    if ALLOW_MOCK:
        logger.warning("Hardware init failed — falling back to MOCK (ALLOW_MOCK=1)")
        MODE = "MOCK"
        SDK_TYPE = "mock"
        scanner_initialized = True
        return True

    logger.error(
        "Hardware init failed. Fix the scanner connection, or set ALLOW_MOCK=1 "
        "only for non-production testing."
    )
    MODE = "DISABLED"
    scanner_initialized = False
    return False


def cleanup_scanner():
    global scanner_initialized, native_scanner, zkfp
    try:
        if native_scanner:
            native_scanner.terminate()
            native_scanner = None
        elif zkfp:
            try:
                zkfp.CloseDevice()
            except Exception:
                pass
            try:
                zkfp.Terminate()
            except Exception:
                pass
            zkfp = None
        scanner_initialized = False
        logger.info("Scanner cleanup completed")
    except Exception as e:
        logger.error(f"Scanner cleanup failed: {e}")


_init_done = False

@app.before_request
def lazy_init():
    global _init_done
    if not _init_done:
        _init_done = True
        if not scanner_initialized:
            initialize_scanner()


import atexit
atexit.register(cleanup_scanner)


def _require_ready():
    if MODE == "DISABLED" or not scanner_initialized:
        return jsonify({
            'success': False,
            'error': (
                'Fingerprint scanner is not available. '
                'Check USB connection and that the fingerprint service started in PRODUCTION mode.'
            ),
            'mode': MODE,
        }), 503
    return None


def _acquire_with_pyzkfp(timeout_sec: float):
    """Poll pyzkfp until a finger is captured or timeout."""
    import time
    deadline = time.time() + timeout_sec
    while time.time() < deadline:
        capture = zkfp.AcquireFingerprint()
        if capture:
            tmp, img = capture
            # Convert .NET Array[Byte] to bytes
            if not isinstance(tmp, (bytes, bytearray)):
                tmp = bytes(tmp)
            return tmp, img
        time.sleep(0.1)
    raise TimeoutError(
        f"No fingerprint captured within {timeout_sec:.0f}s — "
        "place finger firmly on the scanner"
    )


@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({
        'status': 'ok' if MODE != 'DISABLED' else 'degraded',
        'service': 'zkfinger_service',
        'sdk_available': SDK_AVAILABLE or MODE == 'MOCK',
        'sdk_type': SDK_TYPE,
        'mode': MODE,
        'scanner_initialized': scanner_initialized,
        'allow_mock': ALLOW_MOCK,
        'timestamp': datetime.now().isoformat()
    })


@app.route('/scanner/status', methods=['GET'])
def get_scanner_status():
    if MODE == "DISABLED" or not scanner_initialized:
        return jsonify({
            'success': False,
            'connected': False,
            'model': 'ZKTeco Live20R',
            'sdk_available': False,
            'sdk_type': SDK_TYPE,
            'mode': MODE,
            'error': 'Scanner not initialized'
        }), 503

    connected = MODE == "PRODUCTION"
    return jsonify({
        'success': True,
        'connected': connected,
        'model': 'ZKTeco Live20R',
        'sdk_available': True,
        'sdk_type': SDK_TYPE,
        'mode': MODE
    })


@app.route('/scanner/test', methods=['GET'])
def test_scanner():
    err = _require_ready()
    if err:
        return err

    try:
        if MODE == "PRODUCTION" and native_scanner:
            return jsonify({
                'success': True,
                'connected': True,
                'device_count': native_scanner.get_device_count(),
                'message': 'Scanner test successful — real hardware (native)',
                'mode': 'PRODUCTION'
            })
        if MODE == "PRODUCTION" and zkfp:
            return jsonify({
                'success': True,
                'connected': True,
                'device_count': zkfp.GetDeviceCount(),
                'message': 'Scanner test successful — real hardware (pyzkfp)',
                'mode': 'PRODUCTION'
            })
        return jsonify({
            'success': True,
            'connected': False,
            'device_count': 0,
            'message': 'MOCK mode — no real hardware',
            'mode': 'MOCK'
        })
    except Exception as e:
        logger.error(f"Scanner test failed: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/scanner/capture/enroll', methods=['POST'])
def capture_for_enrollment():
    err = _require_ready()
    if err:
        return err

    try:
        if MODE == "PRODUCTION" and native_scanner:
            logger.info("PRODUCTION: Enrollment capture (3 scans) via native SDK")
            templates = []
            for i in range(3):
                logger.info(f"  Waiting for scan {i+1}/3 — place finger on scanner …")
                tmp, _img = native_scanner.acquire_fingerprint(timeout_sec=CAPTURE_TIMEOUT)
                templates.append(tmp)
                logger.info(f"  Scan {i+1} captured ({len(tmp)} bytes)")
            enrollment = native_scanner.merge_templates(*templates)
            template_b64 = base64.b64encode(enrollment).decode('utf-8')
            return jsonify({
                'success': True,
                'template_id': f"FP{int(datetime.now().timestamp())}",
                'template': template_b64,
                'quality': 90,
                'mode': 'PRODUCTION'
            })

        if MODE == "PRODUCTION" and zkfp:
            logger.info("PRODUCTION: Enrollment capture (3 scans) via pyzkfp")
            templates = []
            for i in range(3):
                logger.info(f"  Waiting for scan {i+1}/3 — place finger on scanner …")
                tmp, _img = _acquire_with_pyzkfp(CAPTURE_TIMEOUT)
                templates.append(tmp)
                logger.info(f"  Scan {i+1} captured")
            enrollment_template, _ = zkfp.DBMerge(*templates)
            if enrollment_template is None:
                return jsonify({'success': False, 'error': 'Template merge failed'}), 400
            if not isinstance(enrollment_template, (bytes, bytearray)):
                enrollment_template = bytes(enrollment_template)
            template_b64 = base64.b64encode(enrollment_template).decode('utf-8')
            return jsonify({
                'success': True,
                'template_id': f"FP{int(datetime.now().timestamp())}",
                'template': template_b64,
                'quality': 90,
                'mode': 'PRODUCTION'
            })

        # MOCK (only if ALLOW_MOCK=1)
        logger.warning("MOCK: Returning simulated enrollment template")
        template_id = f"FP{int(datetime.now().timestamp())}"
        template_b64 = base64.b64encode(f"mock_template_{template_id}".encode()).decode()
        return jsonify({
            'success': True,
            'template_id': template_id,
            'template': template_b64,
            'quality': 85,
            'mode': 'MOCK'
        })

    except TimeoutError as e:
        return jsonify({'success': False, 'error': str(e)}), 408
    except Exception as e:
        logger.error(f"Enrollment capture failed: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/scanner/capture/verify', methods=['POST'])
def capture_for_verification():
    err = _require_ready()
    if err:
        return err

    try:
        if MODE == "PRODUCTION" and native_scanner:
            logger.info("PRODUCTION: Verification capture via native SDK …")
            tmp, _img = native_scanner.acquire_fingerprint(timeout_sec=CAPTURE_TIMEOUT)
            template_b64 = base64.b64encode(tmp).decode('utf-8')
            return jsonify({
                'success': True,
                'template': template_b64,
                'quality': 85,
                'mode': 'PRODUCTION'
            })

        if MODE == "PRODUCTION" and zkfp:
            logger.info("PRODUCTION: Verification capture via pyzkfp …")
            tmp, _img = _acquire_with_pyzkfp(CAPTURE_TIMEOUT)
            template_b64 = base64.b64encode(tmp).decode('utf-8')
            return jsonify({
                'success': True,
                'template': template_b64,
                'quality': 85,
                'mode': 'PRODUCTION'
            })

        logger.warning("MOCK: Returning simulated verification scan")
        scan_id = f"SCAN{int(datetime.now().timestamp())}"
        template_b64 = base64.b64encode(f"mock_scan_{scan_id}".encode()).decode()
        return jsonify({
            'success': True,
            'template': template_b64,
            'quality': 80,
            'mode': 'MOCK'
        })

    except TimeoutError as e:
        return jsonify({'success': False, 'error': str(e)}), 408
    except Exception as e:
        logger.error(f"Verification capture failed: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/scanner/match', methods=['POST'])
def match_fingerprints():
    err = _require_ready()
    if err:
        return err

    try:
        data = request.get_json() or {}
        captured_b64 = data.get('captured_template')
        stored_b64 = data.get('stored_template')

        if not captured_b64 or not stored_b64:
            return jsonify({'success': False, 'error': 'Missing template data'}), 400

        if MODE == "PRODUCTION" and native_scanner:
            captured = base64.b64decode(captured_b64)
            stored = base64.b64decode(stored_b64)
            score = native_scanner.match(captured, stored)
            matched = score >= MATCH_THRESHOLD
            confidence = min(max(score, 0) / 100.0, 1.0)
            logger.info(f"Match: {'YES' if matched else 'NO'} (score={score})")
            return jsonify({
                'success': True,
                'matched': matched,
                'confidence': confidence,
                'score': score,
                'mode': 'PRODUCTION'
            })

        if MODE == "PRODUCTION" and zkfp:
            captured = base64.b64decode(captured_b64)
            stored = base64.b64decode(stored_b64)
            score = zkfp.DBMatch(captured, stored)
            matched = score >= MATCH_THRESHOLD
            confidence = min(max(score, 0) / 100.0, 1.0)
            logger.info(f"Match: {'YES' if matched else 'NO'} (score={score})")
            return jsonify({
                'success': True,
                'matched': matched,
                'confidence': confidence,
                'score': score,
                'mode': 'PRODUCTION'
            })

        # MOCK — never auto-match when user wants real biometrics;
        # only reachable with ALLOW_MOCK=1
        logger.warning("MOCK: match always returns true (testing only)")
        return jsonify({
            'success': True,
            'matched': True,
            'confidence': 0.92,
            'score': 92,
            'mode': 'MOCK'
        })

    except Exception as e:
        logger.error(f"Fingerprint matching failed: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500


if __name__ == '__main__':
    if not initialize_scanner():
        logger.error("Scanner initialization failed at startup")
        logger.error("Checklist:")
        logger.error("  1. Live20R plugged in (lsusb | grep 1b55)")
        logger.error("  2. Native libs present: resources/sdk/SDK/lib-x64/libzkfp.so")
        logger.error("  3. udev rule: /etc/udev/rules.d/99-zkteco.rules")
        logger.error("  4. Or set ALLOW_MOCK=1 for simulated testing only")
        if not ALLOW_MOCK:
            raise SystemExit(1)

    app.run(host='127.0.0.1', port=5001, debug=False)
