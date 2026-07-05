# Implementation Roadmap

This roadmap aims for a credible, consent-first room sensing system.

## Phase 0: Research Reproduction

- Reproduce parsing/visualization with public CSI datasets using CSIKit.
- Run ESP32-CSI-Tool in active AP/STA mode.
- Capture a controlled empty-room baseline.
- Build plots for amplitude, phase, subcarrier variance, and spectrograms.
- Document all hardware, firmware, channel, bandwidth, antenna, and room geometry.

Exit criteria:

- Raw capture files can be parsed repeatably.
- Empty-room baseline and moving-person trace are visibly different.
- Metadata is sufficient for another person to reproduce the experiment.

## Phase 1: Data Contract and Dashboard

- Use `schemas/rf-frame.schema.json` as the normalized frame envelope.
- Build an ingest service that accepts ESP32 CSV, Nexmon pcap/UDP, CSIKit parsed frames, or Wi-BFI output.
- Normalize into frame fields: source, hardware, timestamp, nodes, channels, heatmap, targets, confidence, privacy mode.
- Keep raw data local by default.

Exit criteria:

- One frontend can switch between simulator, ESP32, and replay files.
- Each frame contains source and consent metadata.

## Phase 2: Presence and Motion Zones

- Start with binary presence and motion energy.
- Use per-room baseline subtraction.
- Extract low-dimensional features: subcarrier variance, PCA components, Hampel/running mean filtering, Doppler bands.
- Build a zone map only after repeated controlled captures.

Exit criteria:

- Presence detection validated against simple labeled runs.
- False positives from fans, doors, pets, and AP traffic changes are measured.

## Phase 3: Phone-adjacent Path

Choose one:

### Android RTT

- Build an Android app using Wi-Fi RTT on supported phones.
- Survey compatible APs.
- Fuse RTT with IMU and manual room map.
- Treat this as positioning, not passive sensing.

### Wi-BFI Monitor Capture

- Put a phone on a lab Wi-Fi 5/6 AP that supports explicit beamforming.
- Use a monitor-capable NIC to capture beamforming feedback frames.
- Reconstruct BFI/V matrices using Wi-BFI tooling.
- Compare BFI temporal signatures with ESP32/CSI ground truth.

### Legacy Nexmon Phone

- Use a supported rooted Nexus 5 or Nexus 6P.
- Extract CSI in a controlled lab network only.
- Treat the output as research, not production.

Exit criteria:

- Phone role is explicit: UI, RTT initiator, beamformee, traffic generator, or rooted CSI receiver.
- No claim depends on unavailable app/browser APIs.

## Phase 4: Activity and Vital-sign Experiments

- Respiration: use still subject, known distance/orientation, bandpass around respiration frequencies, and compare against a consented reference sensor.
- Activity: collect balanced data across people, days, room layouts, and device positions.
- Generalization: test leave-one-room, leave-one-person, and leave-one-device splits.

Exit criteria:

- Model reports confidence and unknown states.
- Validation includes negative controls and environment shifts.

## Phase 5: Productization

- Local-first processing.
- Visible sensing indicator.
- Room-level consent management.
- Raw capture retention policy.
- Disable or blur person-like outputs by default.
- Publish hardware bill of materials and limitations.

## Suggested Minimal Stack

- Hardware: 2-4 ESP32-S3 nodes or one AX210/PicoScenes laptop plus AP.
- Backend: Python ingest service.
- Processing: numpy/scipy/scikit-learn first, PyTorch only after baselines.
- Frontend: local web dashboard.
- Data: JSON frame stream plus optional raw capture archive.

## What Not To Build

- A hidden room scanner.
- A browser-only "through wall" claim.
- A phone app that implies it can read CSI when it only reads RSSI.
- A dense-pose demo without reproducible training/evaluation data.

