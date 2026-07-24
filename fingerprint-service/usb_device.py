"""
USB discovery for ZKTeco Live20R (vendor 1b55, product 0120).

Tracks bus/address/sysfs path so reconnect after unplug/replug
(or moving to another USB port) can refresh the device schema.
"""

from __future__ import annotations

import glob
import logging
import os
import re
import subprocess
from dataclasses import asdict, dataclass
from typing import Any, Dict, Optional

logger = logging.getLogger('zkfinger_service')

ZKTECO_VENDOR = 0x1B55
ZKTECO_PRODUCT = 0x0120


@dataclass
class UsbDeviceSchema:
    vendor_id: str
    product_id: str
    bus: int
    address: int
    sysfs_path: str
    devnode: str
    serial: str
    identity: str

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

    def same_port(self, other: Optional['UsbDeviceSchema']) -> bool:
        if other is None:
            return False
        return self.identity == other.identity


def _read_text(path: str) -> str:
    try:
        with open(path, 'r', encoding='utf-8', errors='ignore') as f:
            return f.read().strip()
    except OSError:
        return ''


def find_live20r() -> Optional[UsbDeviceSchema]:
    """Locate the Live20R on the USB bus. Prefers pyusb, falls back to sysfs."""
    device = _find_via_pyusb()
    if device:
        return device
    return _find_via_sysfs()


def _find_via_pyusb() -> Optional[UsbDeviceSchema]:
    try:
        import usb.core
        import usb.util
    except ImportError:
        return None

    try:
        dev = usb.core.find(idVendor=ZKTECO_VENDOR, idProduct=ZKTECO_PRODUCT)
        if dev is None:
            return None

        bus = int(dev.bus)
        address = int(dev.address)
        serial = ''
        try:
            serial = usb.util.get_string(dev, dev.iSerialNumber) or ''
        except Exception:
            serial = ''

        # Match sysfs path for stable port tracking (e.g. 3-3 vs 3-4)
        sysfs_path = _sysfs_path_for(bus, address)
        if not sysfs_path:
            sysfs_path = f'usb{bus}/{bus}-{address}'

        port_token = _port_token_from_sysfs(sysfs_path) or f'{bus}-{address}'
        identity = f'{ZKTECO_VENDOR:04x}:{ZKTECO_PRODUCT:04x}@{port_token}#{serial or "noserial"}'

        return UsbDeviceSchema(
            vendor_id=f'{ZKTECO_VENDOR:04x}',
            product_id=f'{ZKTECO_PRODUCT:04x}',
            bus=bus,
            address=address,
            sysfs_path=sysfs_path,
            devnode=f'/dev/bus/usb/{bus:03d}/{address:03d}',
            serial=serial,
            identity=identity,
        )
    except Exception as e:
        logger.debug(f'pyusb discovery failed: {e}')
        return None


def _sysfs_path_for(bus: int, address: int) -> str:
    pattern = f'/sys/bus/usb/devices/{bus}-*'
    for path in glob.glob(pattern):
        if not os.path.isdir(path):
            continue
        try:
            busnum = int(_read_text(os.path.join(path, 'busnum')) or -1)
            devnum = int(_read_text(os.path.join(path, 'devnum')) or -1)
        except ValueError:
            continue
        if busnum == bus and devnum == address:
            return path
    return ''


def _port_token_from_sysfs(sysfs_path: str) -> str:
    base = os.path.basename(sysfs_path.rstrip('/'))
    # e.g. 3-3, 3-1.2 — stable physical port identity
    if re.match(r'^\d+-[\d.]+$', base):
        return base
    return base


def _find_via_sysfs() -> Optional[UsbDeviceSchema]:
    for path in glob.glob('/sys/bus/usb/devices/*'):
        if not os.path.isdir(path):
            continue
        vid = _read_text(os.path.join(path, 'idVendor')).lower()
        pid = _read_text(os.path.join(path, 'idProduct')).lower()
        if vid != f'{ZKTECO_VENDOR:04x}' or pid != f'{ZKTECO_PRODUCT:04x}':
            continue

        try:
            bus = int(_read_text(os.path.join(path, 'busnum')))
            address = int(_read_text(os.path.join(path, 'devnum')))
        except ValueError:
            continue

        serial = _read_text(os.path.join(path, 'serial'))
        port_token = _port_token_from_sysfs(path)
        identity = f'{vid}:{pid}@{port_token}#{serial or "noserial"}'

        return UsbDeviceSchema(
            vendor_id=vid,
            product_id=pid,
            bus=bus,
            address=address,
            sysfs_path=path,
            devnode=f'/dev/bus/usb/{bus:03d}/{address:03d}',
            serial=serial,
            identity=identity,
        )
    return None


def wait_for_live20r(timeout_sec: float = 8.0, poll: float = 0.25) -> Optional[UsbDeviceSchema]:
    """Poll until the scanner appears on USB or timeout."""
    import time
    deadline = time.time() + timeout_sec
    while time.time() < deadline:
        device = find_live20r()
        if device:
            return device
        time.sleep(poll)
    return None


def lsusb_hint() -> str:
    try:
        out = subprocess.run(
            ['lsusb'], capture_output=True, text=True, timeout=3
        ).stdout
        for line in out.splitlines():
            if '1b55:0120' in line.lower() or 'zkteco' in line.lower():
                return line.strip()
    except Exception:
        pass
    return ''
