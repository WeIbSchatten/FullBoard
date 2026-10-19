#!/usr/bin/env python3
"""Drive the installed We1ssBoard APK on an emulator against a real panel.

Signs in with the panel token, opens every tab and the main settings screens,
saves a screenshot of each, and fails on a crash or a JS error in logcat.
"""
import os
import re
import subprocess
import sys
import time
import xml.etree.ElementTree as ET

PKG = "com.we1bschatten.we1ssboard"
OUT = os.environ.get("SMOKE_OUT", "smoke")
PANEL = os.environ["PANEL_URL"]
TOKEN = os.environ["PANEL_TOKEN"]
os.makedirs(OUT, exist_ok=True)


def adb(*args, capture=True):
    return subprocess.run(["adb", *args], check=False, capture_output=capture, text=True).stdout


def nodes():
    raw = subprocess.run(["adb", "exec-out", "uiautomator", "dump", "/dev/tty"], capture_output=True, text=True).stdout
    raw = raw[raw.find("<?xml"): raw.rfind(">") + 1]
    out = []
    for n in ET.fromstring(raw).iter("node"):
        m = re.match(r"\[(\d+),(\d+)\]\[(\d+),(\d+)\]", n.get("bounds", ""))
        if m:
            x1, y1, x2, y2 = map(int, m.groups())
            out.append({"text": n.get("text", ""), "desc": n.get("content-desc", ""), "cls": n.get("class", ""), "x": (x1 + x2) // 2, "y": (y1 + y2) // 2})
    return out


def tap(n):
    adb("shell", "input", "tap", str(n["x"]), str(n["y"]))


def find(label, lowest=False):
    for _ in range(4):
        hits = [n for n in nodes() if label in (n["text"], n["desc"])]
        if hits:
            return max(hits, key=lambda n: n["y"]) if lowest else hits[0]
        adb("shell", "input", "swipe", "500", "1500", "500", "600", "300")
        time.sleep(1)
    return None


def shot(name):
    with open(os.path.join(OUT, f"{name}.png"), "wb") as f:
        f.write(subprocess.run(["adb", "exec-out", "screencap", "-p"], capture_output=True).stdout)


def alive(step):
    if not adb("shell", "pidof", PKG).strip():
        fail(f"app is not running after: {step}")


def fail(msg):
    log = adb("logcat", "-d")
    open(os.path.join(OUT, "logcat.txt"), "w").write(log)
    print("FAIL:", msg)
    for line in log.splitlines():
        if re.search(r"FATAL EXCEPTION|AndroidRuntime|ReactNativeJS", line):
            print(line)
    sys.exit(1)


adb("logcat", "-c")
adb("shell", "monkey", "-p", PKG, "-c", "android.intent.category.LAUNCHER", "1")
time.sleep(15)
alive("launch")
shot("01-login")

fields = [n for n in nodes() if n["cls"] == "android.widget.EditText"]
if len(fields) < 2:
    fail("login form not found")
for field, value in ((fields[0], PANEL), (fields[1], TOKEN)):
    tap(field)
    adb("shell", "input", "text", value)
adb("shell", "input", "keyevent", "111")
connect = find("Connect", lowest=True)
if not connect:
    fail("Connect button not found")
tap(connect)
time.sleep(10)
alive("sign in")
shot("02-overview")
if find("Connect", lowest=True) and not find("Overview", lowest=True):
    fail("still on the login screen after Connect")

for i, tab in enumerate(["Clients", "Connections", "Nodes", "Settings"], start=3):
    n = find(tab, lowest=True)
    if not n:
        fail(f"tab {tab} not found")
    tap(n)
    time.sleep(5)
    alive(f"tab {tab}")
    shot(f"{i:02d}-{tab.lower()}")

for i, item in enumerate(["General", "Telegram Bot", "Subscription", "Admin credentials", "API Token", "Xray Updates", "Logs"], start=10):
    n = find(item)
    if not n:
        fail(f"settings item {item} not found")
    tap(n)
    time.sleep(6)
    alive(f"settings {item}")
    shot(f"{i:02d}-{item.lower().replace(' ', '-')}")
    adb("shell", "input", "keyevent", "4")
    time.sleep(2)

log = adb("logcat", "-d")
open(os.path.join(OUT, "logcat.txt"), "w").write(log)
errors = [l for l in log.splitlines() if re.search(r"FATAL EXCEPTION|ReactNativeJS.*(Error|Invariant|TypeError)", l)]
if errors:
    print("\n".join(errors[:40]))
    sys.exit(1)
print("smoke ok")
