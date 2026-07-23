"""
Native ZKFinger C SDK bindings via ctypes.

Uses libzkfp.so from the official ZKFinger SDK for Linux (resources/sdk/SDK/lib-x64).
Bypasses pyzkfp / .NET so Live20R works without Mono or coreclr for capture/match.
"""

from __future__ import annotations

import ctypes
import logging
import os
import time
from pathlib import Path
from typing import Optional, Tuple

logger = logging.getLogger('zkfinger_service')

MAX_TEMPLATE_SIZE = 2048
ZKFP_ERR_OK = 0
# -8 = capture failed / no finger present (poll again)
ZKFP_ERR_CAPTURE = -8

_PRELOAD_ORDER = (
    "libusb-0.1.so.4",
    "libsqlite3.so.0",
    "libcrypto.so.0.9.8",
    "libiomp5.so",
    "libidkit.so.2",
    "libzkfinger10.so",
    "libsilkidcap.so",
    "libzkfp.so",
)


def default_sdk_lib_dir() -> Path:
    here = Path(__file__).resolve().parent
    return here.parent / "resources" / "sdk" / "SDK" / "lib-x64"


def ensure_library_path(lib_dir: Optional[Path] = None) -> Path:
    """Prepend SDK lib dir to LD_LIBRARY_PATH and preload shared objects."""
    lib_dir = Path(lib_dir) if lib_dir else default_sdk_lib_dir()
    if not lib_dir.is_dir():
        raise FileNotFoundError(f"ZKFinger SDK lib directory not found: {lib_dir}")

    lib_dir_str = str(lib_dir)
    current = os.environ.get("LD_LIBRARY_PATH", "")
    if lib_dir_str not in current.split(":"):
        os.environ["LD_LIBRARY_PATH"] = (
            f"{lib_dir_str}:{current}" if current else lib_dir_str
        )

    for name in _PRELOAD_ORDER:
        path = lib_dir / name
        if not path.exists():
            if name == "libzkfp.so":
                raise FileNotFoundError(f"Missing required library: {path}")
            logger.warning(f"Optional SDK lib missing: {path}")
            continue
        ctypes.CDLL(str(path), mode=ctypes.RTLD_GLOBAL)

    return lib_dir


class NativeZKFP:
    """Thin wrapper around ZKFPM_* C API."""

    def __init__(self, lib_dir: Optional[Path] = None):
        self.lib_dir = ensure_library_path(lib_dir)
        self._lib = ctypes.CDLL(str(self.lib_dir / "libzkfp.so"))
        self._setup_prototypes()
        self.dev_handle = None
        self.db_handle = None
        self.width = 0
        self.height = 0
        self._img_buf = None

    def _setup_prototypes(self) -> None:
        L = self._lib
        L.ZKFPM_Init.restype = ctypes.c_int
        L.ZKFPM_Terminate.restype = ctypes.c_int
        L.ZKFPM_GetDeviceCount.restype = ctypes.c_int

        L.ZKFPM_OpenDevice.argtypes = [ctypes.c_int]
        L.ZKFPM_OpenDevice.restype = ctypes.c_void_p

        L.ZKFPM_CloseDevice.argtypes = [ctypes.c_void_p]
        L.ZKFPM_CloseDevice.restype = ctypes.c_int

        L.ZKFPM_GetParameters.argtypes = [
            ctypes.c_void_p, ctypes.c_int,
            ctypes.POINTER(ctypes.c_ubyte), ctypes.POINTER(ctypes.c_uint),
        ]
        L.ZKFPM_GetParameters.restype = ctypes.c_int

        L.ZKFPM_AcquireFingerprint.argtypes = [
            ctypes.c_void_p,
            ctypes.POINTER(ctypes.c_ubyte), ctypes.c_uint,
            ctypes.POINTER(ctypes.c_ubyte), ctypes.POINTER(ctypes.c_uint),
        ]
        L.ZKFPM_AcquireFingerprint.restype = ctypes.c_int

        L.ZKFPM_DBInit.restype = ctypes.c_void_p
        L.ZKFPM_DBFree.argtypes = [ctypes.c_void_p]
        L.ZKFPM_DBFree.restype = ctypes.c_int

        L.ZKFPM_DBMerge.argtypes = [
            ctypes.c_void_p,
            ctypes.POINTER(ctypes.c_ubyte),
            ctypes.POINTER(ctypes.c_ubyte),
            ctypes.POINTER(ctypes.c_ubyte),
            ctypes.POINTER(ctypes.c_ubyte),
            ctypes.POINTER(ctypes.c_uint),
        ]
        L.ZKFPM_DBMerge.restype = ctypes.c_int

        L.ZKFPM_DBMatch.argtypes = [
            ctypes.c_void_p,
            ctypes.POINTER(ctypes.c_ubyte), ctypes.c_uint,
            ctypes.POINTER(ctypes.c_ubyte), ctypes.c_uint,
        ]
        L.ZKFPM_DBMatch.restype = ctypes.c_int

    def init(self) -> None:
        ret = self._lib.ZKFPM_Init()
        if ret != ZKFP_ERR_OK:
            raise RuntimeError(f"ZKFPM_Init failed: {ret}")

    def terminate(self) -> None:
        try:
            if self.db_handle:
                self._lib.ZKFPM_DBFree(self.db_handle)
                self.db_handle = None
            if self.dev_handle:
                self._lib.ZKFPM_CloseDevice(self.dev_handle)
                self.dev_handle = None
            self._lib.ZKFPM_Terminate()
        except Exception as e:
            logger.error(f"Native ZKFP terminate error: {e}")

    def get_device_count(self) -> int:
        return int(self._lib.ZKFPM_GetDeviceCount())

    def open_device(self, index: int = 0) -> None:
        handle = self._lib.ZKFPM_OpenDevice(index)
        if not handle:
            raise RuntimeError(f"ZKFPM_OpenDevice({index}) failed")
        self.dev_handle = handle

        self.width = self._get_int_param(1)
        self.height = self._get_int_param(2)
        if self.width <= 0 or self.height <= 0:
            # Safe fallback used by many ZK optical sensors
            self.width, self.height = 256, 360
            logger.warning(
                f"Could not read image size; using {self.width}x{self.height}"
            )

        img_size = self.width * self.height
        self._img_buf = (ctypes.c_ubyte * img_size)()

        self.db_handle = self._lib.ZKFPM_DBInit()
        if not self.db_handle:
            raise RuntimeError("ZKFPM_DBInit failed")

        logger.info(
            f"Opened ZKFinger device {index} "
            f"(image {self.width}x{self.height})"
        )

    def _get_int_param(self, code: int) -> int:
        buf = (ctypes.c_ubyte * 4)()
        size = ctypes.c_uint(4)
        ret = self._lib.ZKFPM_GetParameters(
            self.dev_handle, code, buf, ctypes.byref(size)
        )
        if ret != ZKFP_ERR_OK:
            return 0
        return int.from_bytes(bytes(buf[:4]), byteorder="little", signed=True)

    def acquire_fingerprint(
        self,
        timeout_sec: float = 30.0,
        poll_interval: float = 0.1,
    ) -> Tuple[bytes, bytes]:
        """
        Wait until a finger is placed, then return (template, image).
        Raises TimeoutError if no finger within timeout_sec.
        """
        if not self.dev_handle or self._img_buf is None:
            raise RuntimeError("Device not opened")

        deadline = time.time() + timeout_sec
        tmpl_buf = (ctypes.c_ubyte * MAX_TEMPLATE_SIZE)()
        img_size = self.width * self.height

        while time.time() < deadline:
            tmpl_len = ctypes.c_uint(MAX_TEMPLATE_SIZE)
            ret = self._lib.ZKFPM_AcquireFingerprint(
                self.dev_handle,
                self._img_buf,
                img_size,
                tmpl_buf,
                ctypes.byref(tmpl_len),
            )
            if ret == ZKFP_ERR_OK and tmpl_len.value > 0:
                template = bytes(tmpl_buf[: tmpl_len.value])
                image = bytes(self._img_buf)
                return template, image
            if ret not in (ZKFP_ERR_OK, ZKFP_ERR_CAPTURE):
                # Non-retryable error
                raise RuntimeError(f"ZKFPM_AcquireFingerprint failed: {ret}")
            time.sleep(poll_interval)

        raise TimeoutError(
            f"No fingerprint captured within {timeout_sec:.0f}s — "
            "place finger firmly on the scanner"
        )

    def merge_templates(self, t1: bytes, t2: bytes, t3: bytes) -> bytes:
        if not self.db_handle:
            raise RuntimeError("DB not initialized")

        def as_buf(data: bytes):
            arr = (ctypes.c_ubyte * len(data)).from_buffer_copy(data)
            return arr

        out = (ctypes.c_ubyte * MAX_TEMPLATE_SIZE)()
        out_len = ctypes.c_uint(MAX_TEMPLATE_SIZE)
        ret = self._lib.ZKFPM_DBMerge(
            self.db_handle,
            as_buf(t1), as_buf(t2), as_buf(t3),
            out, ctypes.byref(out_len),
        )
        if ret != ZKFP_ERR_OK or out_len.value == 0:
            raise RuntimeError(f"ZKFPM_DBMerge failed: {ret}")
        return bytes(out[: out_len.value])

    def match(self, template1: bytes, template2: bytes) -> int:
        """Return match score (higher is better). 0 or negative = no match."""
        if not self.db_handle:
            raise RuntimeError("DB not initialized")

        b1 = (ctypes.c_ubyte * len(template1)).from_buffer_copy(template1)
        b2 = (ctypes.c_ubyte * len(template2)).from_buffer_copy(template2)
        score = self._lib.ZKFPM_DBMatch(
            self.db_handle, b1, len(template1), b2, len(template2)
        )
        return int(score)
