#!/usr/bin/env python3
"""VeloTrack native messaging host.

Reads real byte counters of the active Windows network adapter once per second
and streams bytes/sec to the extension over Chrome's native messaging protocol
(4-byte native-endian length prefix + UTF-8 JSON, over stdin/stdout).

The host only ever *sends* measurements; it never executes anything it receives.
"""
import json, os, socket, struct, sys, threading, time

try:
    import psutil
except ImportError:
    psutil = None

if os.name == "nt":
    import msvcrt
    msvcrt.setmode(sys.stdin.fileno(), os.O_BINARY)
    msvcrt.setmode(sys.stdout.fileno(), os.O_BINARY)


def send(obj):
    data = json.dumps(obj, separators=(",", ":")).encode("utf-8")
    try:
        sys.stdout.buffer.write(struct.pack("=I", len(data)) + data)
        sys.stdout.buffer.flush()
    except (OSError, ValueError):
        os._exit(0)  # browser closed the pipe


def watch_stdin():
    """Exit as soon as the browser disconnects (stdin EOF). Input is discarded."""
    stdin = sys.stdin.buffer
    while True:
        hdr = stdin.read(4)
        if len(hdr) < 4:
            os._exit(0)
        (n,) = struct.unpack("=I", hdr)
        if n > 1024 * 1024:
            os._exit(1)
        stdin.read(n)


def local_ip():
    """IP of the interface the OS would use for internet traffic (no packet is sent)."""
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("1.1.1.1", 53))
        return s.getsockname()[0]
    except OSError:
        return None
    finally:
        s.close()


def adapter_for_ip(ip):
    for name, addrs in psutil.net_if_addrs().items():
        for a in addrs:
            if a.family == socket.AF_INET and a.address == ip:
                return name
    return None


def classify(name):
    n = name.lower()
    if any(k in n for k in ("wi-fi", "wifi", "wireless", "wlan", "802.11")):
        return "Wi-Fi"
    if any(k in n for k in ("vpn", "tap", "tun", "wireguard", "tailscale")):
        return "VPN"
    return "Ethernet"


def main():
    threading.Thread(target=watch_stdin, daemon=True).start()

    if psutil is None:
        while True:
            send({"t": "error", "message": "Python package 'psutil' is missing. Run: python -m pip install psutil"})
            time.sleep(2)

    cached_ip, cached_name = None, None
    prev = None  # (adapter, rx, tx, monotonic_time)

    while True:
        t0 = time.monotonic()
        try:
            ip = local_ip()
            if ip and ip != cached_ip:
                cached_ip, cached_name = ip, adapter_for_ip(ip)
            name = cached_name if ip else None

            stats = psutil.net_if_stats().get(name) if name else None
            io = psutil.net_io_counters(pernic=True).get(name) if name else None

            if not ip or not name or stats is None or not stats.isup or io is None:
                prev = None
                send({"t": "sample", "online": False})
            else:
                now = time.monotonic()
                if (prev and prev[0] == name and now > prev[3]
                        and io.bytes_recv >= prev[1] and io.bytes_sent >= prev[2]):
                    dt = now - prev[3]
                    send({
                        "t": "sample", "online": True,
                        "down": round((io.bytes_recv - prev[1]) / dt),
                        "up": round((io.bytes_sent - prev[2]) / dt),
                        "adapter": name, "type": classify(name),
                    })
                prev = (name, io.bytes_recv, io.bytes_sent, now)
        except Exception as e:  # keep running; tell the extension
            prev = None
            send({"t": "error", "message": f"Helper error: {e}"})

        time.sleep(max(0.05, 1.0 - (time.monotonic() - t0)))


if __name__ == "__main__":
    main()
