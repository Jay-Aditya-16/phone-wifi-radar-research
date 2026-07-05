# Technical Analysis

## What Wi-Fi Sensing Measures

A Wi-Fi receiver observes a transmitted waveform after it has traveled through multiple paths. Some paths are direct. Others bounce off walls, furniture, people, doors, and devices. The channel response changes when those reflectors move.

In an OFDM Wi-Fi system, the useful sensing signal can be represented as a complex value per subcarrier and antenna pair:

```text
H[k, rx, tx, t] = amplitude[k, rx, tx, t] * exp(j * phase[k, rx, tx, t])
```

Where:

- `k` is subcarrier index.
- `rx` and `tx` are antenna chains.
- `t` is time.
- amplitude and phase are influenced by multipath, hardware, AGC, and noise.

Sensing algorithms usually analyze change:

```text
delta_H = H(t) - baseline_H
```

or features derived from amplitude/phase over time:

- variance across subcarriers
- phase difference between antenna pairs
- Doppler/spectrogram energy
- principal components
- respiration-band periodicity
- beamforming feedback matrix changes

## Why CSI Beats RSSI

RSSI is a scalar summary. It collapses all subcarriers, antenna effects, multipath, and receiver behavior into one coarse number. CSI keeps more structure:

- frequency selectivity across subcarriers
- per-antenna spatial signatures
- phase changes from small path-length changes
- MIMO channel relationships

RSSI can detect gross changes. CSI/BFI can support room-level sensing after calibration.

## Why BFI Is Interesting

802.11ac/ax explicit beamforming lets a beamformee report compressed channel feedback to a beamformer. A phone may produce these reports during normal Wi-Fi communication. A monitor receiver can capture the feedback frames and reconstruct a compressed channel-like representation.

BFI is not identical to raw CSI:

- It is quantized/compressed.
- It reflects the feedback protocol and selected MIMO dimensions.
- It depends on AP/client behavior.
- It may be intermittent.

But it is valuable because it avoids rooting the phone.

## Passive Radar vs Device-free Sensing

These are related but not identical.

Device-free Wi-Fi sensing often uses packet-derived CSI/BFI changes to infer presence, activity, or motion.

Passive radar usually implies a reference signal and surveillance signal, then computes delay-Doppler/range-Doppler relationships. Commodity Wi-Fi has limited bandwidth compared with dedicated radar, and extracting range precisely from Wi-Fi is hard without synchronized signals and low-level access.

The likely progression is:

1. Presence and motion energy.
2. Zone-level localization.
3. Doppler/gesture features.
4. Respiration under controlled conditions.
5. Range-Doppler with SDR or specialized NIC/platform.

## Phone Antenna Effects

Phone antennas are part of the channel. A phone's apparent Wi-Fi behavior changes with:

- orientation
- hand grip
- case
- body proximity
- antenna tuner state
- selected chain or diversity path
- band/channel
- MIMO mode
- AP beamforming state

For cooperative-phone experiments, always log:

- phone model and SKU
- OS version
- Wi-Fi standard/channel/bandwidth
- AP model/configuration
- phone pose
- whether the screen is on
- whether the phone is hand-held, pocketed, or fixed on a stand

## Algorithm Notes

### Baseline subtraction

Capture empty-room baseline first. Human sensing is usually change detection over a stable reference, not absolute interpretation.

### Filtering

Common filters:

- Hampel filter for outliers.
- Running mean or exponential smoothing.
- Lowpass for slow motion.
- Bandpass around respiration rates for still subjects.

### Dimensionality reduction

CSI tensors are high dimensional. PCA/SVD can separate common motion components from noise. Keep antenna-pair and subcarrier metadata because collapsing too early destroys useful structure.

### Calibration

Calibration is not optional:

- phase sanitization
- AGC normalization
- per-device gain alignment
- timestamp alignment
- antenna-chain selection
- environment baseline

### Evaluation

Use splits that expose generalization:

- same room, same person, same day
- same room, different day
- same room, different person
- different room
- different receiver
- different AP

A model that only works on same-room same-day data is a demo, not a product.

## Data Model

The schema in this repo deliberately allows multiple source kinds:

- `csi` for raw/processed channel state information.
- `bfi` for beamforming feedback derived features.
- `rssi` for coarse scans or AP telemetry.
- `rtt` for active ranging.
- `fusion` for combined estimates.
- `simulator` for test streams.

Each frame must carry privacy and source metadata because the same UI can display very different levels of evidential strength.

