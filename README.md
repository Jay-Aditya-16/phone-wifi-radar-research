# Phone Wi-Fi Radar Research

Research notes and implementation planning for phone-adjacent Wi-Fi sensing, passive radar, and room scanning.

This repo exists because a normal website cannot turn a phone into a Wi-Fi radar. Browser APIs expose only coarse network state, and phone operating systems do not expose raw Wi-Fi channel state information (CSI), per-subcarrier phase, beamforming feedback, or monitor-mode packet streams to ordinary apps. Useful Wi-Fi sensing requires one of these paths:

1. External CSI hardware such as ESP32-S3/C6, Intel 5300, QCA9300, AX200/AX210, SDR, or a CSI-capable access point.
2. Firmware/driver-level access on specific older devices, for example Nexmon CSI on rooted Nexus-era Broadcom phones.
3. Beamforming feedback information (BFI/BFA) sniffing from 802.11ac/ax traffic using a monitor receiver.
4. Android Wi-Fi RTT/FTM for active ranging to compatible APs, not passive radar.
5. RSSI/scan based heuristics, which are coarse and throttled.

The repo is documentation-first. The included simulator and schema are for UI/backend integration tests only; they do not claim to extract real phone CSI.

## Repo Map

- `docs/source-survey.md` - annotated survey of open-source tools and papers.
- `docs/source-cards.md` - per-source notes on what to use, avoid, or verify.
- `docs/technical-analysis.md` - sensing signal model and algorithmic implications.
- `docs/live-phone-website.md` - how to run and use the phone web app.
- `docs/phone-wifi-antenna-and-radio.md` - phone antenna/radio reverse-engineering notes from public sources and RF principles.
- `docs/feasibility-matrix.md` - what works from browser, native app, rooted device, external hardware, and AP/NIC paths.
- `docs/implementation-roadmap.md` - realistic build roadmap for a consent-first room-sensing system.
- `docs/ethics-and-safety.md` - deployment rules and red lines.
- `docs/references.md` - sources with URLs.
- `schemas/rf-frame.schema.json` - normalized frame format for live CSI/BFI/RSSI/simulator data.
- `examples/rf-frame.example.json` - example frame.
- `tools/csi_stream_simulator.py` - local synthetic WebSocket stream for frontends.
- `site/` - live phone web app with EKF trajectory fusion and a 3D RF room map.
- `matlab/` - MATLAB import, EKF, and plotting scripts.

## Bottom Line

The phone can be part of a sensing system, but not as a magical passive-radar receiver from a normal web page. The strongest phone-adjacent strategy is:

1. Use the phone as a cooperative moving transmitter/target or as an app UI.
2. Use AP-side, ESP32, SDR, or NIC-side capture for CSI/BFI.
3. Fuse phone IMU/RTT data only when the user explicitly consents.
4. Train/calibrate per room, because Wi-Fi sensing generalization across rooms and receivers remains a hard research problem.

## Live Phone Website

```bash
python3 -m http.server 8000 --directory site
```

Open `http://127.0.0.1:8000` on your computer or `http://<your-laptop-ip>:8000` on your phone. For reliable phone motion permissions, host the site on HTTPS, for example GitHub Pages.

The included GitHub Pages workflow deploys `site/` to `https://jay-aditya-16.github.io/phone-wifi-radar-research/` after pushes to `main`.

Full usage notes are in `docs/live-phone-website.md`.

## Quick Simulator

```bash
python3 tools/csi_stream_simulator.py --host 127.0.0.1 --port 5006
```

It emits synthetic frames compatible with `schemas/rf-frame.schema.json`.

## Non-goals

- No instructions for covert surveillance.
- No exploitation of phone basebands, locked bootloaders, or app-store bypasses.
- No claim that RSSI or browser network APIs can infer dense pose or through-wall occupancy.
