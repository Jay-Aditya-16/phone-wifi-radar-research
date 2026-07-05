function plot_rf_room_map(result)
%PLOT_RF_ROOM_MAP Plot EKF path, anchors, and external target observations.

track = result.track;
figure("Name", "RF Room EKF Map");
hold on;
grid on;
axis equal;
xlabel("x (m)");
ylabel("y (m)");
zlabel("confidence / height");
title("Phone RF Room Mapper EKF Output");

plot3(track(:, 1), track(:, 2), zeros(size(track, 1), 1), "b-", "LineWidth", 1.5);
scatter3(track(1, 1), track(1, 2), 0, 60, "g", "filled");
scatter3(track(end, 1), track(end, 2), 0, 60, "r", "filled");

for i = 1:numel(result.anchors)
    scatter3(result.anchors(i).x, result.anchors(i).y, 0.25, 90, "filled", "MarkerFaceColor", [0.1 0.45 0.35]);
    text(result.anchors(i).x, result.anchors(i).y, 0.35, string(result.anchors(i).id));
end

if ~isempty(result.targets)
    scatter3(result.targets(:, 2) * 5, result.targets(:, 3) * 4, result.targets(:, 4), 28, result.targets(:, 4), "filled");
end

legend("EKF phone path", "origin", "final", "anchors/targets", "Location", "best");
view(42, 32);
end
