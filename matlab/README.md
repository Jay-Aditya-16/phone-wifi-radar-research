# MATLAB EKF Workflow

These MATLAB scripts process exported JSONL frames from the phone website.

```matlab
frames = import_rf_jsonl("rf-room-scan.jsonl");
result = ekf_wifi_room_scan(frames);
plot_rf_room_map(result);
```

If you call `ekf_wifi_room_scan()` without frames, it runs a synthetic range-fusion demo.

The EKF state is:

```text
[x, y, vx, vy, ax_bias, ay_bias]'
```

Supported measurements:

- `phone_pose.x`, `phone_pose.y`
- `ranges(i).nodeId`, `ranges(i).range_m`, `ranges(i).variance`
- `targets(i).x`, `targets(i).y` for plotting external movement
- `heatmap` for RF activity visualization

This is not a substitute for hardware calibration. It is a readable starting point for fusing phone dead reckoning with RTT/RSSI/CSI/BFI-derived measurements.

