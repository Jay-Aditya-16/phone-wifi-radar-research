# Ethics and Safety

Wi-Fi sensing can reveal presence, motion, routines, sleep, health proxies, and room occupancy without cameras. That makes it privacy-sensitive even when no image is captured.

## Rules

1. Use only in spaces where occupants know sensing is active.
2. Show a visible sensing indicator.
3. Prefer room-level anonymous outputs over identity or pose.
4. Keep raw CSI/BFI local unless explicit consent says otherwise.
5. Minimize retention; delete raw captures when experiments finish.
6. Never deploy through-wall sensing against non-consenting spaces.
7. Treat health/vital outputs as experimental unless clinically validated.
8. Document hardware, power, channel, and collection context.

## Red Lines

- Covert occupancy detection.
- Tracking named individuals without consent.
- Collecting from neighboring homes or offices.
- Publishing raw captures that include MAC addresses without sanitization.
- Bypassing phone OS protections to collect data from unwilling users.

## Safer Defaults

- Anonymous blobs, not skeletons.
- Confidence intervals and "unknown" state.
- Local-only dashboard.
- Explicit calibration mode with people out of the room.
- Per-room opt-in and easy stop button.

