# Phone Wi-Fi Antenna and Radio Notes

This file is a public-source reverse-engineering model of how a phone participates in Wi-Fi sensing. It is not a teardown of one specific phone model.

## What Is Inside the Phone

Modern phones typically contain:

- One or more Wi-Fi/Bluetooth/GNSS combo chips or integrated connectivity blocks.
- RF front-end components: filters, power amplifiers, low-noise amplifiers, switches, diplexers/triplexers, antenna tuners, and matching networks.
- Internal antennas formed as flex circuits, stamped metal, laser direct structured parts, or metal-frame segments.
- Multiple antenna feeds for diversity, MIMO, band coverage, and coexistence.
- A baseband/MAC/PHY firmware layer that estimates channels internally for communication.

The key point: the radio already estimates channel information for demodulation and MIMO/beamforming, but consumer operating systems hide those low-level measurements from apps.

## Common Antenna Forms

Phone antennas must be compact, broadband or multiband, and tolerant of the user's hand and head. Public RF literature repeatedly points to internal compact structures such as IFA/PIFA and printed/microstrip variants:

- IFA/PIFA uses a shortened radiator near a ground plane, grounded at one end and fed at an intermediate point.
- The phone chassis and PCB ground are not passive bystanders; they are part of the antenna system.
- Tuning/matching components shift resonance and maintain efficiency across bands and environmental loading.
- Multiple antenna elements provide diversity and MIMO observations, but spacing is limited by phone size.

For Wi-Fi sensing, each antenna chain is a different spatial viewpoint. More independent antenna observations usually help, but phone geometry constrains independence.

## Where Antennas Tend to Be Placed

Public teardowns and repair ecosystems show that phones distribute antennas around edges, top/bottom modules, flex cables, speaker/charging assemblies, and frame breaks. The model-level rule is:

- Keep radiators near non-metal windows, frame gaps, or dielectric covers.
- Separate antennas as far as possible within the handset to improve diversity and MIMO decorrelation.
- Avoid placing radiators where the user's hand always shorts or detunes them.
- Use the metal frame/ground/chassis as a designed part of the radiator and counterpoise.

There is no universal "the Wi-Fi antenna is here" rule. Placement is per model, per band, and per SKU. Public FCC internal photos, SAR/exposure exhibits, repair guides, and teardown photos are the right evidence sources when building a model-specific map.

## How Wi-Fi Antennas Function in Sensing Terms

In communication mode, a Wi-Fi receiver:

1. Receives OFDM symbols through one or more RF chains.
2. Estimates channel response from preambles/pilots.
3. Uses channel estimates for equalization, MIMO separation, rate control, beamforming feedback, and packet decoding.
4. Exposes only high-level results to the OS unless firmware/driver hooks exist.

In sensing mode, the useful data is the channel variation over time:

- Static room: stable multipath baseline.
- Person moves: path amplitudes/phases shift.
- Breathing: small periodic phase/amplitude changes.
- Gesture: short Doppler/temporal signature.
- Moved object: changed baseline and reflection structure.

This is why CSI/BFI is valuable and RSSI is weak. RSSI compresses the channel into a coarse scalar; CSI/BFI preserves subcarrier and antenna-pair structure.

## Phone-Specific Constraints

### Browser

The browser may expose connection type/effective bandwidth through the Network Information API on some browsers. That is not Wi-Fi RF telemetry. It is network adaptation metadata.

### Android Native App

Android can expose scan results and Wi-Fi RTT on supported devices with permissions. Scans are throttled and coarse. RTT gives active distance estimates to compatible responders. Neither path gives passive CSI.

### iOS Native App

iOS heavily restricts Wi-Fi details. App-store-safe iOS is not a realistic path for CSI or monitor-mode sensing.

### Rooted/firmware path

Nexmon CSI proves that selected Broadcom phone-era chips can be patched to output CSI, including Nexus 5 and Nexus 6P. This is not a general phone solution:

- It depends on exact chip and firmware versions.
- It needs root/firmware patching.
- It is fragile across OS updates and device generations.
- It is not deployable as a normal public web app.

### Phone as beamformee

A modern phone can still be useful as a normal Wi-Fi client. In 802.11ac/ax networks, the phone may send beamforming feedback to the AP. A separate monitor NIC can capture those feedback frames and reconstruct a channel-like representation with Wi-BFI-style tooling. This is one of the most realistic phone-adjacent passive paths.

## Reverse-engineering Checklist for a Specific Phone

Use this when moving from generic notes to a real target phone model:

1. Identify exact model and regional SKU.
2. Locate FCC ID or equivalent regulatory filing.
3. Download internal photos, SAR report, RF exposure report, and antenna location exhibits where public.
4. Cross-check with repair guide/teardown imagery.
5. Identify Wi-Fi/Bluetooth chip or connectivity block from board markings and teardown notes.
6. Map antenna feed points, coax/flex routes, frame breaks, and dielectric windows.
7. Compare claimed Wi-Fi capabilities: 1x1, 2x2, 6E/7, MLO, beamforming, RTT.
8. Validate only with consent and non-destructive RF measurements: AP logs, RTT API, monitor capture of your own lab network, or near-field scan in a shielded/controlled setup.
9. Do not assume app-level access to chain-level samples unless you have driver/firmware evidence.

## Practical Model

For system design, model the phone as one of these roles:

- UI/controller: safe, easy, web-capable.
- Cooperative transmitter: generates traffic that external receivers can sense.
- RTT initiator: active range measurements to known APs.
- Beamformee: creates BFI/BFA frames captured by external monitor hardware.
- Rooted legacy CSI receiver: research-only, device-specific.
- Raw passive radar receiver: not realistic for normal phones.

