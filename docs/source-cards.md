# Source Cards

Each card answers: what is the source, what should we reuse, what is the trap, and how it changes the phone strategy.

## Repositories

### RuView

Use it for product imagination: room states, edge nodes, local dashboards, smart-home integration, and the idea that sensing should become semantic rather than just plotting raw CSI. Do not treat broad claims as proven without reproducing the exact hardware, model, dataset, and evaluation protocol.

Useful pieces:

- Application taxonomy: presence, motion, vitals, room activity.
- Edge-first posture.
- Simulated-data mode as a demo pattern.

Trap:

- A polished demo surface can hide unresolved hardware and model assumptions.
- Phone browser feasibility is not solved by a dashboard.

Phone implication:

- The phone should initially be UI/controller or cooperative client, not the sensing receiver.

### Nexmon CSI

Nexmon CSI is the most relevant project for "phone Wi-Fi antenna as receiver" because it lists Broadcom chips used in Nexus 5 and Nexus 6P and patches firmware to emit CSI from OFDM frames.

Useful pieces:

- CSI extraction on specific phone-era Broadcom chips.
- UDP/pcap style capture pipeline.
- Per-core/spatial-stream metadata.
- Strong proof that phone Wi-Fi chips can physically observe CSI when firmware allows it.

Trap:

- Supported phones are old and specific.
- Requires root, exact firmware, and driver/firmware patching.
- Not a Play Store or browser path.

Phone implication:

- A "real phone CSI" research branch should target a supported legacy device, not a modern locked phone.

### ESP32 CSI Tool

ESP32 CSI Tool is the best low-cost path for repeatable room experiments. It includes active AP/station modes and passive collection.

Useful pieces:

- Cheap dedicated RF nodes.
- Active and passive modes.
- CSV pipeline that is easy to parse.
- Good match for baseline presence/motion experiments.

Trap:

- ESP32 CSI is not equivalent to modern phone Wi-Fi MIMO CSI.
- Timing and synchronization are limited.

Phone implication:

- Use ESP32 as external sensing infrastructure and the phone as controller/calibration UI.

### Linux 802.11n CSI Tool

This is the canonical Intel IWL5300 CSI baseline. It anchors much of the older CSI literature.

Useful pieces:

- Mature research baseline.
- Known data format and algorithm ecosystem.
- Many datasets and examples.

Trap:

- Old 802.11n hardware and kernel assumptions.
- Not representative of Wi-Fi 6/7 phone behavior.

Phone implication:

- Use for algorithm validation, not final phone feasibility.

### CSIKit

CSIKit is a unification layer for parsing many CSI formats.

Useful pieces:

- One Python interface over Atheros, Intel, Nexmon, ESP32, FeitCSI, and PicoScenes data.
- Basic filters and visualization.
- Good ingest adapter candidate.

Trap:

- Parser output cannot fix inconsistent hardware calibration.

Phone implication:

- Use CSIKit to normalize a mixed-source backend while tracking source metadata aggressively.

### Wi-BFI

Wi-BFI extracts 802.11ac/ax beamforming feedback angles and reconstructs BFI/V matrices.

Useful pieces:

- Phone can remain a normal client.
- External monitor hardware captures feedback frames.
- Works with modern beamforming traffic in principle.

Trap:

- Depends on AP/client beamforming behavior, traffic, monitor capture quality, and standard-specific decoding.
- BFI is compressed feedback, not identical to raw CSI.

Phone implication:

- This is the most realistic "modern phone participates without root" sensing branch.

### PicoScenes

PicoScenes is a research-grade platform for low-level Wi-Fi sensing across QCA9300, Intel NICs, and SDR.

Useful pieces:

- Low-level control.
- Modern NIC support through compatible setups.
- SDR path for more radar-like experiments.

Trap:

- More setup complexity.
- The phone is usually an observed client or cooperating transmitter, not the instrument.

Phone implication:

- Use it when the goal is serious research rather than a cheap demo.

## Papers and Research Threads

### WiSee

Core lesson: whole-home gesture sensing from Wi-Fi is possible under carefully designed receiver processing and signal assumptions. It is not evidence that an arbitrary phone app can sense through walls.

Use:

- Doppler framing.
- Gesture-trigger concept.
- Through-wall signal propagation caveats.

### DensePose From WiFi

Core lesson: high-end pose estimation can be learned from Wi-Fi amplitude/phase, but only with multi-antenna data and trained models.

Use:

- Ambitious ML target.
- Warning that pose claims need labels, architecture, and evaluation.

### PicoScenes paper

Core lesson: baseband details and hardware control matter. CSI distortion, bandwidth, and receiver behavior can dominate results.

Use:

- Calibration requirements.
- Hardware-selection criteria.

### Exposing the CSI

Core lesson: modern Wi-Fi features do not automatically solve sensing. MIMO and spectral resolution can be more important than simply wider bandwidth; generalization remains hard.

Use:

- Evaluation protocol.
- Modern Wi-Fi 6 caution.

### Wi-BFI

Core lesson: beamforming feedback is a viable public side channel for channel-like information in modern Wi-Fi.

Use:

- Phone-adjacent capture architecture.
- BFI/V-matrix feature path.

### Android RTT/FTM research

Core lesson: phones can do active ranging with compatible APs, useful for indoor mapping and fusion, but not passive radar.

Use:

- Phone-native path with permissions.
- Map calibration and AP localization.

### Receiver-effect studies

Core lesson: two receivers may produce different CSI from the same signal. Calibration and receiver metadata are not optional.

Use:

- Cross-device validation.
- AGC and subcarrier distortion handling.

