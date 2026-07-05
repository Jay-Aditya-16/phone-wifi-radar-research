# Live Phone Website

The runnable phone app lives in `site/`. It is a phone-first 3D RF mapper with:

- phone motion/orientation capture
- a small 2D EKF for phone trajectory
- a Three.js 3D room and RF heatmap
- WebSocket ingest for real CSI/BFI/RTT/RSSI/fusion frames
- JSONL export for MATLAB processing

## What It Can and Cannot Do

It can run on a phone and map the phone's walked path. It can render live person movement if an external RF source sends target or heatmap frames. It cannot make a phone browser read raw Wi-Fi CSI or scan a room like optical LiDAR.

Think of it as an RF sensing cockpit:

- phone-only: dead-reckoned room walk, manual samples, demo heatmap
- phone plus Android RTT/native helper: EKF range fusion
- phone plus ESP32/Nexmon/PicoScenes/Wi-BFI: live RF heat and occupancy

## Run Locally

From the repo root:

```bash
python3 -m http.server 8000 --directory site
```

Open this on the laptop:

```text
http://127.0.0.1:8000
```

Open this on the phone, replacing the IP with your laptop's LAN IP:

```text
http://192.168.1.10:8000
```

Phone motion permissions are more reliable on HTTPS. For field use, publish the `site/` directory with GitHub Pages or another HTTPS host. iOS in particular may refuse motion/orientation permission on plain HTTP.

This repo includes a GitHub Pages workflow for `site/`. After the workflow finishes, the hosted app is expected at:

```text
https://jay-aditya-16.github.io/phone-wifi-radar-research/
```

## Run the Synthetic External Feed

Install the WebSocket dependency:

```bash
python3 -m pip install websockets
```

Start the synthetic feed from the repo root:

```bash
python3 tools/csi_stream_simulator.py --host 0.0.0.0 --port 5006
```

In the phone app, set:

```text
ws://192.168.1.10:5006/scan
```

Then tap `Connect`.

## 3D Map Controls

- Drag with one finger to rotate the room.
- Pinch with two fingers to zoom in or out.
- Move two fingers together to pan or reposition the room in the viewer.
- On desktop, drag with the mouse to rotate, hold Shift and drag to pan, and use the wheel or trackpad scroll to zoom.

## Phone Placement

### Walk Scan

Use this for a full room survey.

1. Hold the phone vertical at chest height.
2. Point the top edge of the phone toward the far wall.
3. Stand at the doorway or a repeatable room reference point.
4. Tap `Start phone sensors`.
5. Tap `Set origin`.
6. Tap `Start scan`.
7. Walk the perimeter slowly.
8. Pause at corners and tap `Mark corner`.
9. Walk parallel lanes through the room, roughly 0.5 m apart.
10. Tap `Add RF sample` at grid points or whenever an external signal changes.
11. Tap `Stop scan`.
12. Tap `Export JSONL` for MATLAB.

This gives a phone trajectory and sample map. Without external RF measurements, it is not a Wi-Fi room scan; it is a phone-motion survey with manual/demo samples.

### Fixed Monitor

Use this for person movement.

1. Place the phone on a wall shelf, tripod, or table edge.
2. Keep it vertical, screen facing the room.
3. Keep it plugged in.
4. Do not move it during monitoring.
5. Connect an external RF feed from ESP32 CSI, Wi-BFI, PicoScenes, Nexmon, SDR, or a native Android RTT/RSSI helper.
6. Ask the person to walk known paths for calibration.
7. Watch the 3D target markers and heatmap.

Phone-only fixed mode cannot sense another person moving. It can only report that the phone itself moved.

### External CSI/BFI Mode

Use this when real RF hardware exists.

Recommended lab setup:

- AP or phone traffic source on a known channel
- monitor receiver or CSI node fixed in the room
- known node positions entered in normalized coordinates
- empty-room baseline
- one person walking labeled paths
- JSON frames sent to the website over WebSocket

The website accepts frames matching `schemas/rf-frame.schema.json`.

## Full Room RF Scan Procedure

1. Draw the room rectangle and set dimensions in meters.
2. Place RF nodes/APs at known positions and record them.
3. Capture 30 to 60 seconds of empty-room baseline.
4. Walk the room perimeter with the phone and mark corners.
5. Walk interior lanes at a steady speed.
6. For each grid point, pause for 2 to 3 seconds.
7. If using external CSI/BFI, keep traffic steady during the walk.
8. Export JSONL.
9. Run MATLAB EKF/offline smoothing.
10. Compare the map against known furniture/person paths.

## WebSocket Frame Tips

Use these fields for live movement:

- `nodes`: RF receiver/AP positions
- `ranges`: RTT/RSSI/model-derived ranges to anchors for EKF updates
- `heatmap`: room RF activity grid
- `targets`: anonymous person estimates
- `metrics`: occupancy, confidence, motion, noise

Coordinates in `nodes` and `targets` are normalized from `0` to `1`. The website scales them to the room dimensions.

## MATLAB Workflow

1. Export JSONL from the website.
2. Open MATLAB.
3. Run:

```matlab
frames = import_rf_jsonl("rf-room-scan.jsonl");
result = ekf_wifi_room_scan(frames);
plot_rf_room_map(result);
```

The MATLAB EKF is intentionally simple and readable. For real work, tune process noise, measurement variance, path-loss parameters, and calibration per device and room.
