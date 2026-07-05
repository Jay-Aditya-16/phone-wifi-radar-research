#!/usr/bin/env python3
"""Emit synthetic RF sensing frames over WebSocket.

This is only a frontend/backend integration tool. It does not read Wi-Fi
hardware, packets, RSSI, CSI, or BFI.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import math
import random
import time
from typing import Any


def heatmap(cols: int, rows: int, target_x: float, target_y: float) -> list[float]:
    values: list[float] = []
    for y in range(rows):
        for x in range(cols):
            nx = (x + 0.5) / cols
            ny = (y + 0.5) / rows
            dx = nx - target_x
            dy = ny - target_y
            pulse = math.exp(-((dx * dx + dy * dy) / 0.012))
            values.append(round(min(1.0, pulse + random.random() * 0.05), 4))
    return values


def make_frame(frame_id: int) -> dict[str, Any]:
    now = time.time()
    x = 0.5 + 0.22 * math.sin(now / 4.0)
    y = 0.5 + 0.16 * math.cos(now / 5.0)
    motion = 0.25 + 0.2 * abs(math.sin(now / 2.3))
    confidence = 0.68 + 0.18 * abs(math.cos(now / 3.7))
    cols = 38
    rows = 26

    return {
        "schema_version": "0.1.0",
        "timestamp_ms": int(now * 1000),
        "source": {
            "kind": "simulator",
            "hardware": "synthetic-room-v0",
            "channel": 36,
            "bandwidth_mhz": 80,
        },
        "privacy": {
            "consent_scope": "lab",
            "identity_free": True,
            "raw_retention": "none",
        },
        "nodes": [
            {"id": "N1", "x": 0.08, "y": 0.13, "rssi_dbm": -48},
            {"id": "N2", "x": 0.92, "y": 0.18, "rssi_dbm": -52},
            {"id": "N3", "x": 0.88, "y": 0.86, "rssi_dbm": -55},
            {"id": "N4", "x": 0.12, "y": 0.82, "rssi_dbm": -50},
        ],
        "targets": [
            {
                "id": "anon-1",
                "x": round(x, 4),
                "y": round(y, 4),
                "confidence": round(confidence, 4),
                "motion": round(motion, 4),
                "label": "anonymous_presence",
            }
        ],
        "heatmap": {
            "cols": cols,
            "rows": rows,
            "values": heatmap(cols, rows, x, y),
        },
        "metrics": {
            "occupancy": 1,
            "confidence": round(confidence, 4),
            "motion": round(motion, 4),
            "noise": 0.14,
            "latency_ms": 18 + frame_id % 7,
        },
        "events": [{"level": "info", "message": "Synthetic RF frame"}] if frame_id == 0 else [],
    }


async def run_server(host: str, port: int, fps: float) -> None:
    try:
        import websockets
    except ImportError as exc:
        raise SystemExit("Install dependency first: python3 -m pip install websockets") from exc

    interval = 1.0 / fps

    async def handler(websocket: Any) -> None:
        frame_id = 0
        while True:
            await websocket.send(json.dumps(make_frame(frame_id), separators=(",", ":")))
            frame_id += 1
            await asyncio.sleep(interval)

    async with websockets.serve(handler, host, port):
        print(f"synthetic RF stream listening on ws://{host}:{port}/scan")
        await asyncio.Future()


def main() -> None:
    parser = argparse.ArgumentParser(description="Synthetic RF sensing WebSocket stream")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=5006)
    parser.add_argument("--fps", type=float, default=10.0)
    args = parser.parse_args()
    asyncio.run(run_server(args.host, args.port, args.fps))


if __name__ == "__main__":
    main()

