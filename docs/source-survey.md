# Source Survey

This survey separates three things that often get blurred together:

- CSI: per-subcarrier complex channel measurements, usually amplitude and phase.
- BFI/BFA: compressed 802.11ac/ax beamforming feedback that can approximate channel information.
- RSSI/scan/RTT: higher-level phone-accessible signals that are useful but much weaker for passive sensing.

## Open-source Repositories

| Project | Hardware path | What it exposes | Phone relevance | Notes |
| --- | --- | --- | --- | --- |
| ruvnet/RuView | ESP32, simulated Docker, broader edge stack claims | presence, motion, vitals, pose claims | Mostly not phone-native | Useful as an application ambition map. Treat performance claims as claims to verify independently. |
| seemoo-lab/nexmon_csi | Broadcom Wi-Fi chips including Nexus 5 and Nexus 6P, Raspberry Pi Broadcom chips, some routers | OFDM CSI up to 80 MHz on selected frames | This is the strongest phone-specific evidence path, but it requires rooted, supported, older devices and firmware patches. |
| StevenMHernandez/ESP32-CSI-Tool | ESP32 | active station/AP CSI and passive CSI collection | External low-cost sensor; not a phone | Practical route for a room-scan prototype with known limitations. |
| dhalperi/linux-80211n-csitool | Intel IWL5300 Linux driver modifications | 802.11n CSI traces | Laptop/NIC path | Classic baseline, old hardware, still important for datasets and algorithms. |
| Gi-z/CSIKit | Parser/processing library | Reads Atheros, Intel, Nexmon, ESP32, FeitCSI, PicoScenes formats | Glue layer | Valuable for unifying capture formats and building a data pipeline. |
| francescamen/Wi-BFI | Monitor capture of 802.11ac/ax beamforming feedback | BFAs and reconstructed BFI/V matrices | Can monitor phone-to-AP traffic from a separate NIC | Strong phone-adjacent path because the phone can be a normal beamformee while another receiver captures public feedback frames. |
| PicoScenes | QCA9300, Intel IWL5300, Intel AX200/AX210, SDR | CSI and low-level Wi-Fi measurements | Laptop/NIC/SDR path | One of the best research platforms because it exposes more baseband controls. |

## Paper and Dataset Themes

### Classic device-free Wi-Fi sensing

Early work such as WiSee showed that Wi-Fi Doppler and multipath changes can classify gestures across rooms, but required receiver-side signal processing and controlled transmitters/receivers. The important lesson is not "any phone can see through walls"; it is that tiny motion-induced perturbations exist and need carefully accessible PHY measurements.

### CSI-based human sensing

CSI is powerful because it decomposes the channel by subcarrier and antenna pair. Human movement changes multipath phase/amplitude, and those changes can be used for activity recognition, localization, respiration extraction, and pose estimation. DensePose-from-WiFi shows the high-end ML direction: map multi-antenna Wi-Fi amplitude/phase into body-region pose outputs. That is a trained sensing system, not a raw browser feature.

### Modern Wi-Fi feature impact

The "Exposing the CSI" line of work is important because it challenges the easy story that bigger bandwidth alone solves sensing. Its reported findings emphasize that modern Wi-Fi 6 features, MIMO, and spectral resolution interact with sensing performance, and that standardization and environment-independent evaluation remain open problems.

### Platform effects

Recent receiver-effect papers show that CSI from different commercial receivers can tell "different stories" even under matched signals. AGC behavior, nonlinearities, and subcarrier distortions can break cross-device models. This matters directly for phones because phone Wi-Fi chips and antenna layouts are not exposed or stable as research instruments.

### BFI/BFA as a practical compromise

Wi-BFI targets a useful gap: modern 802.11ac/ax clients send beamforming feedback frames in cleartext, and those compressed angles can reconstruct a channel-like representation. This is attractive for phone-adjacent sensing because the phone need not be rooted; a separate monitor receiver can capture feedback while the phone communicates normally with an AP. It is still not a phone website reading the antenna.

### RTT/FTM as active ranging

Android Wi-Fi RTT uses IEEE 802.11mc/az fine timing measurement to estimate distance to compatible APs. It is useful for indoor positioning and cooperative scanning, but it is active ranging, not passive radar, and it requires device support, permissions, Wi-Fi scanning enabled, and compatible responders.

## Research Synthesis

The honest architecture is a layered system:

1. Measurement layer: CSI from sensor hardware, BFI from monitor captures, RTT from phones, RSSI only for coarse fallbacks.
2. Calibration layer: empty-room baseline, per-device gain/phase correction, antenna-pair selection, clock/timestamp alignment.
3. Feature layer: amplitude/phase deltas, Doppler/spectrograms, PCA/SVD denoising, respiration bands, BFI matrix features.
4. Inference layer: presence first, then motion zones, then identity-free activity classes, then more ambitious pose/vitals if enough calibrated data exists.
5. Product layer: consent, room maps, confidence, raw-data retention controls, and clear "unknown" states.

## Hard Constraints

- A normal phone browser cannot access monitor mode, raw packets, CSI, BFI, or Wi-Fi chip firmware.
- Android Wi-Fi scans are throttled and return AP scan results, not continuous phase/amplitude.
- iOS is stricter than Android for Wi-Fi introspection and is not a practical research receiver without private entitlements or hardware paths.
- Antenna placement matters because antenna pairs produce different spatial signatures, but app-level software usually does not know which physical antenna chain produced which hidden PHY measurement.
- Phone hand grip, body loading, orientation, case materials, and antenna tuner state change the RF response.

