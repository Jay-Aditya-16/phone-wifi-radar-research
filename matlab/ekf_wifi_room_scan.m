function result = ekf_wifi_room_scan(frames)
%EKF_WIFI_ROOM_SCAN Fuse phone pose and RF range frames into a 2D room track.
%
% result = ekf_wifi_room_scan(frames)
% result = ekf_wifi_room_scan() runs a synthetic demo.

if nargin < 1 || isempty(frames)
    frames = synthetic_frames();
end

state = zeros(6, 1);          % [x y vx vy bax bay]'
P = eye(6) * 0.35;
Qbase = diag([0.01 0.01 0.08 0.08 0.002 0.002]);
lastT = [];

anchors = default_anchors();
track = zeros(numel(frames), 6);
sigma = zeros(numel(frames), 1);
targets = [];
heatmaps = {};

for i = 1:numel(frames)
    frame = frames{i};
    t = double(getfield_or(frame, "timestamp_ms", i * 100));
    if isempty(lastT)
        dt = 0.1;
    else
        dt = max(0.02, min(0.2, (t - lastT) / 1000));
    end
    lastT = t;

    F = eye(6);
    F(1, 3) = dt;
    F(2, 4) = dt;
    F(1, 5) = -0.5 * dt * dt;
    F(2, 6) = -0.5 * dt * dt;
    F(3, 5) = -dt;
    F(4, 6) = -dt;

    state(1) = state(1) + state(3) * dt;
    state(2) = state(2) + state(4) * dt;
    state(3) = state(3) * 0.985;
    state(4) = state(4) * 0.985;
    P = F * P * F' + Qbase * dt;

    if isfield(frame, "nodes")
        anchors = parse_anchors(frame.nodes, anchors);
    end

    if isfield(frame, "phone_pose")
        pose = frame.phone_pose;
        if isfield(pose, "x") && isfield(pose, "y")
            [state, P] = update_linear(state, P, [1 0 0 0 0 0], double(pose.x), 0.12);
            [state, P] = update_linear(state, P, [0 1 0 0 0 0], double(pose.y), 0.12);
        end
    end

    if isfield(frame, "ranges")
        for r = 1:numel(frame.ranges)
            measurement = frame.ranges(r);
            anchor = find_anchor(anchors, string(measurement.nodeId));
            if ~isempty(anchor) && isfield(measurement, "range_m")
                variance = double(getfield_or(measurement, "variance", 0.35));
                [state, P] = update_range(state, P, anchor, double(measurement.range_m), variance);
            end
        end
    end

    if isfield(frame, "targets")
        for k = 1:numel(frame.targets)
            target = frame.targets(k);
            if isfield(target, "x") && isfield(target, "y")
                targets(end + 1, :) = [i, double(target.x), double(target.y), double(getfield_or(target, "confidence", 0.5))]; %#ok<AGROW>
            end
        end
    end

    if isfield(frame, "heatmap")
        heatmaps{end + 1} = frame.heatmap; %#ok<AGROW>
    end

    track(i, :) = state';
    sigma(i) = sqrt(max(0, P(1, 1) + P(2, 2)));
end

result = struct();
result.track = track;
result.sigma = sigma;
result.anchors = anchors;
result.targets = targets;
result.heatmaps = heatmaps;
result.frames = frames;
end

function [state, P] = update_linear(state, P, H, z, R)
H = H(:)';
S = H * P * H' + R;
K = P * H' / S;
residual = z - H * state;
state = state + K * residual;
P = (eye(numel(state)) - K * H) * P;
end

function [state, P] = update_range(state, P, anchor, range, R)
dx = state(1) - anchor.x;
dy = state(2) - anchor.y;
predicted = max(0.05, hypot(dx, dy));
H = [dx / predicted, dy / predicted, 0, 0, 0, 0];
S = H * P * H' + R;
K = P * H' / S;
residual = max(-2.5, min(2.5, range - predicted));
state = state + K * residual;
P = (eye(numel(state)) - K * H) * P;
end

function anchors = default_anchors()
anchors = struct( ...
    "id", {"AP1", "AP2", "AP3"}, ...
    "x", {0.4, 4.6, 4.4}, ...
    "y", {0.4, 0.5, 3.5});
end

function anchors = parse_anchors(nodes, fallback)
anchors = fallback;
for i = 1:numel(nodes)
    node = nodes(i);
    if isfield(node, "id") && isfield(node, "x") && isfield(node, "y")
        anchors(i).id = string(node.id); %#ok<AGROW>
        anchors(i).x = double(node.x) * 5; %#ok<AGROW>
        anchors(i).y = double(node.y) * 4; %#ok<AGROW>
    end
end
end

function anchor = find_anchor(anchors, nodeId)
anchor = [];
for i = 1:numel(anchors)
    if string(anchors(i).id) == nodeId
        anchor = anchors(i);
        return;
    end
end
end

function value = getfield_or(s, field, fallback)
if isfield(s, field)
    value = s.(field);
else
    value = fallback;
end
end

function frames = synthetic_frames()
anchors = default_anchors();
frames = cell(1, 240);
for i = 1:numel(frames)
    t = i / 20;
    x = 2.5 + 1.4 * sin(t / 3);
    y = 2.0 + 1.0 * cos(t / 4);
    ranges = struct([]);
    for a = 1:numel(anchors)
        d = hypot(x - anchors(a).x, y - anchors(a).y) + randn() * 0.12;
        ranges(a).nodeId = anchors(a).id; %#ok<AGROW>
        ranges(a).range_m = max(0.05, d); %#ok<AGROW>
        ranges(a).variance = 0.18; %#ok<AGROW>
        ranges(a).source = "simulator"; %#ok<AGROW>
    end
    frames{i} = struct( ...
        "schema_version", "0.1.0", ...
        "timestamp_ms", i * 50, ...
        "source", struct("kind", "simulator", "hardware", "matlab-demo"), ...
        "privacy", struct("consent_scope", "lab", "identity_free", true), ...
        "ranges", ranges, ...
        "metrics", struct("occupancy", 1, "confidence", 0.8, "motion", 0.4, "noise", 0.15));
end
end

