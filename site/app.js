import * as THREE from "./vendor/three.module.min.js";

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const ui = {
  viewer: $("#viewer"),
  sensorButton: $("#sensorButton"),
  recordButton: $("#recordButton"),
  resetButton: $("#resetButton"),
  originButton: $("#originButton"),
  cornerButton: $("#cornerButton"),
  sampleButton: $("#sampleButton"),
  objectButton: $("#objectButton"),
  clearTrailButton: $("#clearTrailButton"),
  applyRoomButton: $("#applyRoomButton"),
  connectButton: $("#connectButton"),
  demoButton: $("#demoButton"),
  exportButton: $("#exportButton"),
  clearLogButton: $("#clearLogButton"),
  objectLabel: $("#objectLabel"),
  wsUrl: $("#wsUrl"),
  roomWidth: $("#roomWidth"),
  roomLength: $("#roomLength"),
  roomHeight: $("#roomHeight"),
  sensorChip: $("#sensorChip"),
  feedChip: $("#feedChip"),
  imuChip: $("#imuChip"),
  recordChip: $("#recordChip"),
  feedDot: $("#feedDot"),
  xReadout: $("#xReadout"),
  yReadout: $("#yReadout"),
  headingReadout: $("#headingReadout"),
  motionReadout: $("#motionReadout"),
  occupancyMetric: $("#occupancyMetric"),
  confidenceMetric: $("#confidenceMetric"),
  sigmaMetric: $("#sigmaMetric"),
  sampleMetric: $("#sampleMetric"),
  trailMetric: $("#trailMetric"),
  objectMetric: $("#objectMetric"),
  imuAx: $("#imuAx"),
  imuAy: $("#imuAy"),
  imuAz: $("#imuAz"),
  imuYaw: $("#imuYaw"),
  lastPassValue: $("#lastPassValue"),
  eventLog: $("#eventLog")
};

document.documentElement.dataset.appBuild = "map-imu-trails-v1";

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function nowMs() {
  return Date.now();
}

function zeros(rows, cols) {
  return Array.from({ length: rows }, () => Array(cols).fill(0));
}

function identity(size, scale = 1) {
  const out = zeros(size, size);
  for (let i = 0; i < size; i += 1) out[i][i] = scale;
  return out;
}

function transpose(a) {
  return a[0].map((_, c) => a.map((row) => row[c]));
}

function matMul(a, b) {
  const out = zeros(a.length, b[0].length);
  for (let r = 0; r < a.length; r += 1) {
    for (let c = 0; c < b[0].length; c += 1) {
      let sum = 0;
      for (let k = 0; k < b.length; k += 1) sum += a[r][k] * b[k][c];
      out[r][c] = sum;
    }
  }
  return out;
}

function matAdd(a, b) {
  return a.map((row, r) => row.map((value, c) => value + b[r][c]));
}

function matSub(a, b) {
  return a.map((row, r) => row.map((value, c) => value - b[r][c]));
}

function matVec(a, x) {
  return a.map((row) => row.reduce((sum, value, index) => sum + value * x[index], 0));
}

function outer(a, b) {
  return a.map((x) => b.map((y) => x * y));
}

class Ekf2D {
  constructor() {
    this.x = [0, 0, 0, 0, 0, 0];
    this.p = identity(6, 0.35);
    this.last = performance.now();
  }

  reset(x = 0, y = 0) {
    this.x = [x, y, 0, 0, 0, 0];
    this.p = identity(6, 0.35);
    this.last = performance.now();
  }

  predict(accelRoom, dt) {
    const ax = clamp(accelRoom.x - this.x[4], -2.5, 2.5);
    const ay = clamp(accelRoom.y - this.x[5], -2.5, 2.5);
    const damping = 0.985;
    const f = identity(6);
    f[0][2] = dt;
    f[1][3] = dt;
    f[0][4] = -0.5 * dt * dt;
    f[1][5] = -0.5 * dt * dt;
    f[2][4] = -dt;
    f[3][5] = -dt;

    this.x[0] += this.x[2] * dt + 0.5 * ax * dt * dt;
    this.x[1] += this.x[3] * dt + 0.5 * ay * dt * dt;
    this.x[2] = (this.x[2] + ax * dt) * damping;
    this.x[3] = (this.x[3] + ay * dt) * damping;

    const q = identity(6, 0);
    q[0][0] = 0.01 * dt;
    q[1][1] = 0.01 * dt;
    q[2][2] = 0.08 * dt;
    q[3][3] = 0.08 * dt;
    q[4][4] = 0.002 * dt;
    q[5][5] = 0.002 * dt;
    this.p = matAdd(matMul(matMul(f, this.p), transpose(f)), q);
  }

  updatePosition(mx, my, variance = 0.12) {
    this.updateLinear([1, 0, 0, 0, 0, 0], mx, variance);
    this.updateLinear([0, 1, 0, 0, 0, 0], my, variance);
  }

  updateLinear(h, z, variance) {
    const ph = matVec(this.p, h);
    const s = h.reduce((sum, value, index) => sum + value * ph[index], 0) + variance;
    const k = ph.map((value) => value / s);
    const y = z - h.reduce((sum, value, index) => sum + value * this.x[index], 0);
    this.x = this.x.map((value, index) => value + k[index] * y);
    const kh = outer(k, h);
    this.p = matMul(matSub(identity(6), kh), this.p);
  }

  updateRange(anchor, range, variance = 0.45) {
    const dx = this.x[0] - anchor.x;
    const dy = this.x[1] - anchor.y;
    const predicted = Math.max(0.05, Math.hypot(dx, dy));
    const h = [dx / predicted, dy / predicted, 0, 0, 0, 0];
    const ph = matVec(this.p, h);
    const s = h.reduce((sum, value, index) => sum + value * ph[index], 0) + variance;
    const k = ph.map((value) => value / s);
    const residual = clamp(range - predicted, -2.5, 2.5);
    this.x = this.x.map((value, index) => value + k[index] * residual);
    const kh = outer(k, h);
    this.p = matMul(matSub(identity(6), kh), this.p);
  }

  sigma() {
    return Math.sqrt(Math.max(0, this.p[0][0] + this.p[1][1]));
  }
}

const state = {
  mode: "walk",
  room: { width: 5, length: 4, height: 2.7 },
  ekf: new Ekf2D(),
  sensorsOn: false,
  recording: false,
  demo: false,
  ws: null,
  headingDeg: 0,
  accelRoom: { x: 0, y: 0 },
  imu: {
    ax: 0,
    ay: 0,
    az: 0,
    gx: 0,
    gy: 0,
    gz: 0,
    roomAx: 0,
    roomAy: 0,
    magnitude: 0,
    alpha: 0,
    beta: 0,
    gamma: 0,
    lastAt: 0
  },
  motion: 0,
  phoneMotion: 0,
  roomMotion: 0,
  samples: [],
  exportedFrames: [],
  corners: [],
  objects: [],
  targetHistory: [],
  lastPass: null,
  lastTrailRender: 0,
  occupancy: 0,
  confidence: 0,
  heatCols: 28,
  heatRows: 22,
  heat: [],
  path: [],
  targets: [],
  lastDemoAt: 0,
  anchors: [
    { id: "AP1", x: 0.4, y: 0.4, z: 1.4, rssi_dbm: -48 },
    { id: "AP2", x: 4.6, y: 0.5, z: 1.4, rssi_dbm: -54 },
    { id: "AP3", x: 4.4, y: 3.5, z: 1.4, rssi_dbm: -58 }
  ],
  lastFrameTime: performance.now()
};

state.heat = Array.from({ length: state.heatRows }, () => Array(state.heatCols).fill(0));

function addLog(message, level = "info") {
  const item = document.createElement("li");
  item.className = level;
  item.textContent = `${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}  ${message}`;
  ui.eventLog.prepend(item);
  while (ui.eventLog.children.length > 9) ui.eventLog.lastElementChild.remove();
}

function rssiToRange(rssiDbm, txPower = -42, exponent = 2.15) {
  return Math.pow(10, (txPower - rssiDbm) / (10 * exponent));
}

function roomToThree(x, y, z = 0) {
  return new THREE.Vector3(x - state.room.width / 2, z, y - state.room.length / 2);
}

function formatAge(timestamp) {
  if (!timestamp) return "never";
  const seconds = Math.max(0, Math.round((nowMs() - timestamp) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ${seconds % 60}s ago`;
}

function imuSnapshot() {
  return {
    ax: state.imu.ax,
    ay: state.imu.ay,
    az: state.imu.az,
    room_ax: state.imu.roomAx,
    room_ay: state.imu.roomAy,
    magnitude: state.imu.magnitude,
    yaw_deg: state.headingDeg,
    beta_deg: state.imu.beta,
    gamma_deg: state.imu.gamma,
    phone_motion: state.phoneMotion
  };
}

function currentPhonePose() {
  return {
    x: state.ekf.x[0],
    y: state.ekf.x[1],
    z: 0.22,
    heading_deg: state.headingDeg,
    sigma: state.ekf.sigma()
  };
}

function makeLabelSprite(text, color = "#12201b") {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "rgba(255,255,255,0.88)";
  ctx.strokeStyle = "rgba(18,32,27,0.18)";
  ctx.lineWidth = 8;
  ctx.fillRect(12, 18, 488, 84);
  ctx.strokeRect(12, 18, 488, 84);
  ctx.fillStyle = color;
  ctx.font = "bold 42px system-ui, -apple-system, Segoe UI, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(String(text).slice(0, 24), 256, 60);
  const texture = new THREE.CanvasTexture(canvas);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false }));
  sprite.scale.set(0.95, 0.24, 1);
  return sprite;
}

const three = {
  scene: new THREE.Scene(),
  camera: new THREE.PerspectiveCamera(55, 1, 0.05, 100),
  renderer: new THREE.WebGLRenderer({ antialias: true, alpha: false }),
  floor: null,
  heatGroup: new THREE.Group(),
  anchorGroup: new THREE.Group(),
  targetGroup: new THREE.Group(),
  targetTrailGroup: new THREE.Group(),
  objectGroup: new THREE.Group(),
  sampleGroup: new THREE.Group(),
  phoneTrailGroup: new THREE.Group(),
  pathLine: null,
  phoneMesh: null,
  phoneRing: null,
  phoneLabel: null,
  wallGroup: new THREE.Group(),
  angle: Math.PI * 0.28,
  pitch: 0.72,
  distance: 7.5,
  targetX: 0,
  targetZ: 0
};

function cameraDistanceLimits() {
  const diagonal = Math.hypot(state.room.width, state.room.length);
  return {
    min: clamp(diagonal * 0.34, 2.2, 6),
    max: clamp(diagonal * 2.6, 9, 40)
  };
}

function defaultCameraDistance() {
  const diagonal = Math.hypot(state.room.width, state.room.length);
  return clamp(diagonal * 1.15, 5.5, 18);
}

function setCameraDistance(distance) {
  const limits = cameraDistanceLimits();
  three.distance = clamp(distance, limits.min, limits.max);
}

function cameraPanLimit() {
  return Math.hypot(state.room.width, state.room.length) * 0.85;
}

function setCameraTarget(x, z) {
  const limit = cameraPanLimit();
  three.targetX = clamp(x, -limit, limit);
  three.targetZ = clamp(z, -limit, limit);
}

function resetCameraView() {
  setCameraDistance(defaultCameraDistance());
  setCameraTarget(0, 0);
}

function setupThree() {
  three.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  three.renderer.setClearColor(0xdfe8e2, 1);
  ui.viewer.appendChild(three.renderer.domElement);
  three.scene.add(new THREE.HemisphereLight(0xffffff, 0x809080, 2.4));
  const directional = new THREE.DirectionalLight(0xffffff, 1.6);
  directional.position.set(3, 6, 4);
  three.scene.add(directional);
  three.scene.add(three.heatGroup, three.sampleGroup, three.anchorGroup, three.targetTrailGroup, three.targetGroup, three.objectGroup, three.phoneTrailGroup, three.wallGroup);

  three.phoneMesh = new THREE.Mesh(
    new THREE.ConeGeometry(0.12, 0.34, 18),
    new THREE.MeshStandardMaterial({ color: 0x12201b, roughness: 0.35 })
  );
  three.phoneMesh.rotation.x = Math.PI / 2;
  three.scene.add(three.phoneMesh);

  three.phoneRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.22, 0.012, 8, 36),
    new THREE.MeshStandardMaterial({ color: 0x426f9f, emissive: 0x123052, emissiveIntensity: 0.25, transparent: true, opacity: 0.78 })
  );
  three.phoneRing.rotation.x = -Math.PI / 2;
  three.scene.add(three.phoneRing);

  three.phoneLabel = makeLabelSprite("PHONE", "#426f9f");
  three.scene.add(three.phoneLabel);

  resetCameraView();
  rebuildRoom();
  resizeThree();
  requestAnimationFrame(renderLoop);
}

function makeWall(width, height, x, z, y, rotate = false) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(width, height, 0.035),
    new THREE.MeshStandardMaterial({ color: 0x9eb2a7, transparent: true, opacity: 0.25, roughness: 0.6 })
  );
  mesh.position.set(x, height / 2, z);
  if (rotate) mesh.rotation.y = Math.PI / 2;
  mesh.userData.roomWall = true;
  return mesh;
}

function rebuildRoom() {
  if (three.floor) three.scene.remove(three.floor);
  three.wallGroup.clear();
  three.anchorGroup.clear();

  three.floor = new THREE.Mesh(
    new THREE.PlaneGeometry(state.room.width, state.room.length, state.heatCols, state.heatRows),
    new THREE.MeshStandardMaterial({ color: 0xf7faf6, roughness: 0.85 })
  );
  three.floor.rotation.x = -Math.PI / 2;
  three.scene.add(three.floor);

  const grid = new THREE.GridHelper(Math.max(state.room.width, state.room.length), Math.max(state.room.width, state.room.length) * 2, 0x8aa494, 0xc7d7cf);
  grid.name = "room-grid";
  three.wallGroup.add(grid);
  three.wallGroup.add(makeWall(state.room.width, state.room.height, 0, -state.room.length / 2, 0));
  three.wallGroup.add(makeWall(state.room.width, state.room.height, 0, state.room.length / 2, 0));
  three.wallGroup.add(makeWall(state.room.length, state.room.height, -state.room.width / 2, 0, 0, true));
  three.wallGroup.add(makeWall(state.room.length, state.room.height, state.room.width / 2, 0, 0, true));

  for (const anchor of state.anchors) {
    const sphere = new THREE.Mesh(
      new THREE.SphereGeometry(0.11, 20, 12),
      new THREE.MeshStandardMaterial({ color: 0x25745e, roughness: 0.35 })
    );
    sphere.position.copy(roomToThree(anchor.x, anchor.y, anchor.z || 1.2));
    three.anchorGroup.add(sphere);
  }

  rebuildHeat();
  rebuildPath();
  rebuildSamples();
  rebuildObjects();
  rebuildTargetTrail();
}

function colorForHeat(value) {
  const v = clamp(value, 0, 1);
  if (v < 0.5) return new THREE.Color().setRGB(0.25 + v * 0.5, 0.55 + v * 0.3, 0.48);
  return new THREE.Color().setRGB(0.86, 0.55 - (v - 0.5) * 0.3, 0.22);
}

function rebuildHeat() {
  three.heatGroup.clear();
  const cellW = state.room.width / state.heatCols;
  const cellL = state.room.length / state.heatRows;
  for (let y = 0; y < state.heatRows; y += 1) {
    for (let x = 0; x < state.heatCols; x += 1) {
      const value = state.heat[y][x];
      if (value < 0.035) continue;
      const columnHeight = 0.03 + value * state.room.height * 0.52;
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(cellW * 0.9, columnHeight, cellL * 0.9),
        new THREE.MeshStandardMaterial({ color: colorForHeat(value), transparent: true, opacity: 0.24 + value * 0.58, roughness: 0.55 })
      );
      mesh.position.copy(roomToThree((x + 0.5) * cellW, (y + 0.5) * cellL, columnHeight / 2));
      three.heatGroup.add(mesh);
    }
  }
}

function rebuildPath() {
  three.phoneTrailGroup.clear();
  if (state.path.length < 2) return;
  const points = state.path.slice(-260).map((p) => roomToThree(p.x, p.y, 0.04));
  three.pathLine = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(points),
    new THREE.LineBasicMaterial({ color: 0x426f9f, linewidth: 2 })
  );
  three.phoneTrailGroup.add(three.pathLine);

  for (let i = 0; i < state.path.length; i += 10) {
    const point = state.path[i];
    const marker = new THREE.Mesh(
      new THREE.SphereGeometry(0.045, 12, 8),
      new THREE.MeshStandardMaterial({ color: 0x426f9f, transparent: true, opacity: 0.46, roughness: 0.35 })
    );
    marker.position.copy(roomToThree(point.x, point.y, 0.075));
    three.phoneTrailGroup.add(marker);
  }
}

function rebuildSamples() {
  three.sampleGroup.clear();
  for (const sample of state.samples.slice(-180)) {
    const height = 0.12 + sample.strength * 0.62;
    const mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.045, 0.07, height, 14),
      new THREE.MeshStandardMaterial({ color: colorForHeat(sample.strength), transparent: true, opacity: 0.78, roughness: 0.45 })
    );
    mesh.position.copy(roomToThree(sample.x, sample.y, height / 2));
    three.sampleGroup.add(mesh);
  }
}

function rebuildObjects() {
  three.objectGroup.clear();
  for (const object of state.objects) {
    const box = new THREE.Mesh(
      new THREE.BoxGeometry(0.22, 0.22, 0.22),
      new THREE.MeshStandardMaterial({ color: 0xd99a37, emissive: 0x5d3100, emissiveIntensity: 0.18, roughness: 0.42 })
    );
    box.position.copy(roomToThree(object.x, object.y, object.z || 0.32));
    three.objectGroup.add(box);

    const post = new THREE.Mesh(
      new THREE.CylinderGeometry(0.018, 0.018, 0.72, 10),
      new THREE.MeshStandardMaterial({ color: 0xd99a37, transparent: true, opacity: 0.55 })
    );
    post.position.copy(roomToThree(object.x, object.y, 0.36));
    three.objectGroup.add(post);

    const label = makeLabelSprite(object.label || object.id || "object", "#7f551b");
    label.position.copy(roomToThree(object.x, object.y, 0.78));
    three.objectGroup.add(label);
  }
}

function rebuildTargetTrail() {
  three.targetTrailGroup.clear();
  const recent = state.targetHistory.slice(-420);
  const ids = [...new Set(recent.map((point) => point.id))];
  for (const id of ids) {
    const pointsForId = recent.filter((point) => point.id === id);
    if (pointsForId.length > 1) {
      const linePoints = pointsForId.map((point) => roomToThree(point.x, point.y, 0.11));
      three.targetTrailGroup.add(new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(linePoints),
        new THREE.LineBasicMaterial({ color: 0xc95c4a, linewidth: 2 })
      ));
    }

    for (let i = 0; i < pointsForId.length; i += 4) {
      const point = pointsForId[i];
      const age = clamp((nowMs() - point.t) / 60000, 0, 1);
      const marker = new THREE.Mesh(
        new THREE.SphereGeometry(0.045 + point.confidence * 0.035, 12, 8),
        new THREE.MeshStandardMaterial({ color: 0xc95c4a, transparent: true, opacity: 0.24 + (1 - age) * 0.46, roughness: 0.36 })
      );
      marker.position.copy(roomToThree(point.x, point.y, 0.13 + point.confidence * 0.08));
      three.targetTrailGroup.add(marker);
    }

    const latest = pointsForId[pointsForId.length - 1];
    if (latest) {
      const label = makeLabelSprite(`passed ${formatAge(latest.t)}`, "#9f3326");
      label.position.copy(roomToThree(latest.x, latest.y, 0.92));
      three.targetTrailGroup.add(label);
    }
  }
}

function recordTargetHistory(targets) {
  const t = nowMs();
  for (const target of targets) {
    const point = {
      id: target.id || "human",
      x: clamp(target.x * state.room.width, 0, state.room.width),
      y: clamp(target.y * state.room.length, 0, state.room.length),
      confidence: clamp(target.confidence ?? 0.5, 0, 1),
      motion: clamp(target.motion ?? 0.2, 0, 1),
      t
    };
    state.targetHistory.push(point);
    state.lastPass = point;
  }
  const cutoff = t - 10 * 60 * 1000;
  state.targetHistory = state.targetHistory.filter((point) => point.t >= cutoff).slice(-900);
  rebuildTargetTrail();
}

function upsertObject(object) {
  const id = object.id || `object-${state.objects.length + 1}`;
  const existing = state.objects.find((item) => item.id === id);
  const normalized = {
    id,
    label: object.label || id,
    x: clamp(Number(object.x ?? 0), 0, state.room.width),
    y: clamp(Number(object.y ?? 0), 0, state.room.length),
    z: clamp(Number(object.z ?? 0.32), 0.08, state.room.height),
    confidence: clamp(Number(object.confidence ?? 1), 0, 1),
    source: object.source || "manual",
    t: object.t || nowMs()
  };
  if (existing) Object.assign(existing, normalized);
  else state.objects.push(normalized);
}

function markObjectAtPhone() {
  const label = ui.objectLabel.value.trim() || `object ${state.objects.length + 1}`;
  upsertObject({
    id: `manual-${Date.now()}`,
    label,
    x: state.ekf.x[0],
    y: state.ekf.x[1],
    z: 0.32,
    source: "phone-marker"
  });
  rebuildObjects();
  addLog(`Object marked at ${state.ekf.x[0].toFixed(2)}, ${state.ekf.x[1].toFixed(2)}`);
}

function clearTrails() {
  state.targetHistory = [];
  state.lastPass = null;
  three.targetTrailGroup.clear();
  addLog("Human pass trails cleared", "warn");
}

function updateTargets() {
  three.targetGroup.clear();
  for (const target of state.targets.slice(0, 6)) {
    const mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.14, 0.14, 0.72, 24),
      new THREE.MeshStandardMaterial({ color: 0xc95c4a, transparent: true, opacity: 0.58, roughness: 0.4 })
    );
    mesh.position.copy(roomToThree(target.x * state.room.width, target.y * state.room.length, 0.36));
    three.targetGroup.add(mesh);

    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.23 + target.confidence * 0.12, 0.012, 8, 36),
      new THREE.MeshStandardMaterial({ color: 0xc95c4a, transparent: true, opacity: 0.72 })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.copy(roomToThree(target.x * state.room.width, target.y * state.room.length, 0.08));
    three.targetGroup.add(ring);

    const label = makeLabelSprite("HUMAN NOW", "#9f3326");
    label.position.copy(roomToThree(target.x * state.room.width, target.y * state.room.length, 0.98));
    three.targetGroup.add(label);
  }
}

function resizeThree() {
  const rect = ui.viewer.getBoundingClientRect();
  three.camera.aspect = rect.width / Math.max(1, rect.height);
  three.camera.updateProjectionMatrix();
  three.renderer.setSize(rect.width, rect.height, true);
}

function updateCamera() {
  const target = new THREE.Vector3(three.targetX, 0, three.targetZ);
  setCameraDistance(three.distance);
  three.camera.position.set(
    target.x + Math.cos(three.angle) * three.distance,
    three.pitch * three.distance,
    target.z + Math.sin(three.angle) * three.distance
  );
  three.camera.lookAt(target);
  ui.viewer.dataset.cameraAngle = three.angle.toFixed(3);
  ui.viewer.dataset.cameraPitch = three.pitch.toFixed(3);
  ui.viewer.dataset.cameraDistance = three.distance.toFixed(2);
  ui.viewer.dataset.cameraTargetX = three.targetX.toFixed(2);
  ui.viewer.dataset.cameraTargetZ = three.targetZ.toFixed(2);
}

function renderLoop() {
  updateCamera();
  const [x, y] = state.ekf.x;
  const phonePosition = roomToThree(clamp(x, 0, state.room.width), clamp(y, 0, state.room.length), 0.22);
  three.phoneMesh.position.copy(phonePosition);
  three.phoneMesh.rotation.z = -THREE.MathUtils.degToRad(state.headingDeg);
  if (three.phoneRing) three.phoneRing.position.copy(roomToThree(clamp(x, 0, state.room.width), clamp(y, 0, state.room.length), 0.055));
  if (three.phoneLabel) three.phoneLabel.position.copy(roomToThree(clamp(x, 0, state.room.width), clamp(y, 0, state.room.length), 0.58));
  three.renderer.render(three.scene, three.camera);
  requestAnimationFrame(renderLoop);
}

function updateHeatAt(x, y, strength) {
  const gx = clamp(Math.floor((x / state.room.width) * state.heatCols), 0, state.heatCols - 1);
  const gy = clamp(Math.floor((y / state.room.length) * state.heatRows), 0, state.heatRows - 1);
  for (let yy = -2; yy <= 2; yy += 1) {
    for (let xx = -2; xx <= 2; xx += 1) {
      const ix = gx + xx;
      const iy = gy + yy;
      if (ix < 0 || iy < 0 || ix >= state.heatCols || iy >= state.heatRows) continue;
      const falloff = Math.exp(-(xx * xx + yy * yy) / 3);
      state.heat[iy][ix] = clamp(state.heat[iy][ix] * 0.92 + strength * falloff, 0, 1);
    }
  }
}

function addSample(strength = 0.45, source = "manual") {
  const x = clamp(state.ekf.x[0], 0, state.room.width);
  const y = clamp(state.ekf.x[1], 0, state.room.length);
  const sample = { t: nowMs(), x, y, strength, source, motion: state.motion, imu: imuSnapshot() };
  state.samples.push(sample);
  updateHeatAt(x, y, strength);
  rebuildHeat();
  rebuildSamples();
  addLog(`RF sample at ${x.toFixed(2)}, ${y.toFixed(2)} (${source})`);
}

function applyExternalFrame(frame) {
  const enrichedFrame = {
    ...frame,
    phone_pose: frame.phone_pose || currentPhonePose(),
    imu: frame.imu || imuSnapshot()
  };
  state.exportedFrames.push(enrichedFrame);
  if (Array.isArray(frame.nodes) && frame.nodes.length) {
    state.anchors = frame.nodes.map((node, index) => ({
      id: node.id || `N${index + 1}`,
      x: clamp((node.x || 0) * state.room.width, 0, state.room.width),
      y: clamp((node.y || 0) * state.room.length, 0, state.room.length),
      z: node.z || 1.3,
      rssi_dbm: node.rssi_dbm || node.rssi || -55
    }));
    rebuildRoom();
  }

  if (Array.isArray(frame.ranges)) {
    for (const measurement of frame.ranges) {
      const anchor = state.anchors.find((item) => item.id === measurement.nodeId || item.id === measurement.id);
      if (anchor && Number.isFinite(measurement.range_m)) {
        state.ekf.updateRange(anchor, Number(measurement.range_m), Number(measurement.variance || 0.35));
      }
    }
  }

  if (Array.isArray(frame.targets)) {
    state.targets = frame.targets.map((target, index) => ({
      id: target.id || `T${index + 1}`,
      x: clamp(Number(target.x ?? 0.5), 0, 1),
      y: clamp(Number(target.y ?? 0.5), 0, 1),
      confidence: clamp(Number(target.confidence ?? 0.5), 0, 1),
      motion: clamp(Number(target.motion ?? 0.2), 0, 1)
    }));
    recordTargetHistory(state.targets);
    updateTargets();
  }

  if (Array.isArray(frame.objects)) {
    for (const object of frame.objects) {
      upsertObject({
        id: object.id,
        label: object.label || object.id || "object",
        x: clamp(Number(object.x ?? 0.5), 0, 1) * state.room.width,
        y: clamp(Number(object.y ?? 0.5), 0, 1) * state.room.length,
        z: Number(object.z ?? 0.32),
        confidence: object.confidence,
        source: "external"
      });
    }
    rebuildObjects();
  }

  if (frame.heatmap?.values && frame.heatmap.cols && frame.heatmap.rows) {
    for (let y = 0; y < state.heatRows; y += 1) {
      for (let x = 0; x < state.heatCols; x += 1) {
        const sx = Math.floor((x / state.heatCols) * frame.heatmap.cols);
        const sy = Math.floor((y / state.heatRows) * frame.heatmap.rows);
        const value = Number(frame.heatmap.values[sy * frame.heatmap.cols + sx] || 0);
        state.heat[y][x] = clamp(state.heat[y][x] * 0.62 + value * 0.45, 0, 1);
      }
    }
    rebuildHeat();
  }

  if (frame.metrics) {
    state.occupancy = Number(frame.metrics.occupancy ?? state.occupancy);
    state.confidence = clamp(Number(frame.metrics.confidence ?? state.confidence), 0, 1);
    if (Number.isFinite(frame.metrics.motion)) {
      state.roomMotion = clamp(Number(frame.metrics.motion), 0, 1);
      state.motion = Math.max(state.phoneMotion, state.roomMotion);
    }
  }

  if (Array.isArray(frame.events)) {
    for (const event of frame.events) addLog(event.message || "External event", event.level || "info");
  }
}

function syntheticFrame() {
  const t = performance.now() / 1000;
  const tx = 0.5 + Math.sin(t / 3) * 0.22;
  const ty = 0.5 + Math.cos(t / 4) * 0.2;
  const cols = 28;
  const rows = 22;
  const values = [];
  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < cols; x += 1) {
      const nx = (x + 0.5) / cols;
      const ny = (y + 0.5) / rows;
      const d = (nx - tx) ** 2 + (ny - ty) ** 2;
      values.push(clamp(Math.exp(-d / 0.015) + Math.random() * 0.035, 0, 1));
    }
  }
  return {
    schema_version: "0.1.0",
    timestamp_ms: nowMs(),
    source: { kind: "simulator", hardware: "site-demo", channel: 36, bandwidth_mhz: 80 },
    privacy: { consent_scope: "lab", identity_free: true, raw_retention: "none" },
    targets: [{ id: "demo-person", x: tx, y: ty, confidence: 0.78, motion: 0.38, label: "anonymous_presence" }],
    objects: [{ id: "demo-chair", label: "demo object", x: 0.26, y: 0.72, z: 0.34, confidence: 0.7 }],
    heatmap: { cols, rows, values },
    metrics: { occupancy: 1, confidence: 0.78, motion: 0.38, noise: 0.15, latency_ms: 16 },
    events: []
  };
}

async function startSensors() {
  try {
    if (typeof DeviceMotionEvent !== "undefined" && typeof DeviceMotionEvent.requestPermission === "function") {
      const motion = await DeviceMotionEvent.requestPermission();
      if (motion !== "granted") throw new Error("Motion permission denied");
    }
    if (typeof DeviceOrientationEvent !== "undefined" && typeof DeviceOrientationEvent.requestPermission === "function") {
      await DeviceOrientationEvent.requestPermission();
    }
    state.sensorsOn = true;
    ui.sensorChip.textContent = "Sensors live";
    ui.sensorChip.classList.add("live");
    ui.sensorButton.textContent = "Sensors live";
    addLog("Phone motion/orientation sensors started");
  } catch (error) {
    addLog("Sensor permission failed. Use HTTPS, localhost, or browser settings.", "error");
  }
}

function onMotion(event) {
  if (!state.sensorsOn) return;
  const linear = event.acceleration || { x: 0, y: 0, z: 0 };
  const gravity = event.accelerationIncludingGravity || linear;
  const ax = Number(linear.x || 0);
  const ay = Number(linear.y || 0);
  const az = Number(linear.z || 0);
  const gx = Number(gravity.x || 0);
  const gy = Number(gravity.y || 0);
  const gz = Number(gravity.z || 0);
  const heading = THREE.MathUtils.degToRad(state.headingDeg);
  state.accelRoom = {
    x: ax * Math.cos(heading) - ay * Math.sin(heading),
    y: ax * Math.sin(heading) + ay * Math.cos(heading)
  };
  const gravityMagnitude = Math.sqrt(gx * gx + gy * gy + gz * gz);
  const linearMagnitude = Math.sqrt(ax * ax + ay * ay + az * az);
  state.imu = {
    ...state.imu,
    ax,
    ay,
    az,
    gx,
    gy,
    gz,
    roomAx: state.accelRoom.x,
    roomAy: state.accelRoom.y,
    magnitude: gravityMagnitude || linearMagnitude,
    lastAt: nowMs()
  };
  const motionSignal = linearMagnitude > 0.01 ? linearMagnitude * 0.08 : Math.max(0, Math.abs(gravityMagnitude - 9.81)) * 0.045;
  state.phoneMotion = clamp(state.phoneMotion * 0.86 + motionSignal, 0, 1);
  state.motion = Math.max(state.phoneMotion, state.roomMotion);
}

function onOrientation(event) {
  if (!state.sensorsOn) return;
  if (Number.isFinite(event.alpha)) {
    state.headingDeg = (360 - event.alpha) % 360;
    state.imu.alpha = Number(event.alpha);
  }
  if (Number.isFinite(event.beta)) state.imu.beta = Number(event.beta);
  if (Number.isFinite(event.gamma)) state.imu.gamma = Number(event.gamma);
}

function tick() {
  const now = performance.now();
  const dt = clamp((now - state.lastFrameTime) / 1000, 0.01, 0.08);
  state.lastFrameTime = now;
  state.phoneMotion *= state.sensorsOn ? 0.995 : 0.94;
  state.roomMotion *= state.demo || state.ws ? 0.995 : 0.96;
  state.motion = Math.max(state.phoneMotion, state.roomMotion);
  state.ekf.predict(state.accelRoom, dt);
  if (!state.sensorsOn) {
    const holdX = state.ekf.x[0];
    const holdY = state.ekf.x[1];
    state.ekf.updatePosition(holdX, holdY, 0.015);
    state.ekf.updateLinear([0, 0, 1, 0, 0, 0], 0, 0.02);
    state.ekf.updateLinear([0, 0, 0, 1, 0, 0], 0, 0.02);
  } else if (state.phoneMotion < 0.05) {
    state.ekf.updateLinear([0, 0, 1, 0, 0, 0], 0, 0.04);
    state.ekf.updateLinear([0, 0, 0, 1, 0, 0], 0, 0.04);
  }
  state.ekf.x[0] = clamp(state.ekf.x[0], 0, state.room.width);
  state.ekf.x[1] = clamp(state.ekf.x[1], 0, state.room.length);

  if (state.recording) {
    const last = state.path[state.path.length - 1];
    const point = { t: nowMs(), x: state.ekf.x[0], y: state.ekf.x[1], motion: state.motion, phoneMotion: state.phoneMotion, imu: imuSnapshot() };
    const pushed = !last || Math.hypot(last.x - point.x, last.y - point.y) > 0.035;
    if (pushed) {
      state.path.push(point);
      if (state.path.length % 18 === 0) addSample(clamp(0.1 + state.phoneMotion * 0.55, 0.08, 0.55), "phone-motion");
      rebuildPath();
    }
  }

  if (state.demo && now - state.lastDemoAt > 300) {
    state.lastDemoAt = now;
    applyExternalFrame(syntheticFrame());
  }

  if (state.targetHistory.length && now - state.lastTrailRender > 2200) {
    state.lastTrailRender = now;
    rebuildTargetTrail();
  }

  syncUi();
  setTimeout(tick, 50);
}

function syncUi() {
  ui.xReadout.textContent = `${state.ekf.x[0].toFixed(2)} m`;
  ui.yReadout.textContent = `${state.ekf.x[1].toFixed(2)} m`;
  ui.headingReadout.textContent = `${Math.round(state.headingDeg)} deg`;
  ui.motionReadout.textContent = state.motion.toFixed(2);
  ui.occupancyMetric.textContent = String(Math.round(state.occupancy));
  ui.confidenceMetric.textContent = `${Math.round(state.confidence * 100)}%`;
  ui.sigmaMetric.textContent = state.ekf.sigma().toFixed(2);
  ui.sampleMetric.textContent = String(state.samples.length);
  ui.trailMetric.textContent = String(state.targetHistory.length);
  ui.objectMetric.textContent = String(state.objects.length);
  ui.imuAx.textContent = state.imu.ax.toFixed(2);
  ui.imuAy.textContent = state.imu.ay.toFixed(2);
  ui.imuAz.textContent = state.imu.az.toFixed(2);
  ui.imuYaw.textContent = `${Math.round(state.headingDeg)} deg`;
  ui.lastPassValue.textContent = state.lastPass ? `Last pass ${formatAge(state.lastPass.t)} at ${state.lastPass.x.toFixed(1)}, ${state.lastPass.y.toFixed(1)}` : "No pass yet";
  ui.imuChip.textContent = state.imu.lastAt ? `IMU ${formatAge(state.imu.lastAt)}` : "IMU idle";
  ui.imuChip.classList.toggle("live", state.sensorsOn && !!state.imu.lastAt);
  ui.recordChip.textContent = state.recording ? "Recording" : "Idle";
  ui.recordChip.classList.toggle("live", state.recording);
  ui.recordButton.textContent = state.recording ? "Stop scan" : "Start scan";
}

function connectFeed() {
  if (state.ws) {
    state.ws.close();
    state.ws = null;
    return;
  }
  try {
    const ws = new WebSocket(ui.wsUrl.value.trim());
    state.ws = ws;
    ui.feedChip.textContent = "Connecting";
    ui.feedDot.className = "dot";
    ws.addEventListener("open", () => {
      ui.feedChip.textContent = "Feed live";
      ui.feedChip.classList.add("live");
      ui.feedDot.className = "dot live";
      ui.connectButton.textContent = "Disconnect";
      addLog("External RF feed connected");
    });
    ws.addEventListener("message", (event) => {
      try {
        applyExternalFrame(JSON.parse(event.data));
      } catch {
        addLog("Dropped malformed external frame", "warn");
      }
    });
    ws.addEventListener("close", () => {
      state.ws = null;
      ui.feedChip.textContent = "No feed";
      ui.feedChip.classList.remove("live");
      ui.feedDot.className = "dot";
      ui.connectButton.textContent = "Connect";
      addLog("External RF feed closed", "warn");
    });
    ws.addEventListener("error", () => {
      ui.feedDot.className = "dot error";
      addLog("External RF feed error", "error");
    });
  } catch {
    addLog("WebSocket URL rejected", "error");
  }
}

function exportJsonl() {
  const frames = state.exportedFrames.length ? state.exportedFrames : state.samples.map((sample) => ({
    schema_version: "0.1.0",
    timestamp_ms: sample.t,
    source: { kind: "fusion", hardware: "phone-browser-ekf" },
    privacy: { consent_scope: "single_room", identity_free: true, raw_retention: "session" },
    targets: [],
    objects: state.objects.map((object) => ({ id: object.id, label: object.label, x: object.x / state.room.width, y: object.y / state.room.length, z: object.z, confidence: object.confidence })),
    metrics: { occupancy: 0, confidence: 0, motion: sample.motion, noise: 0.5 },
    phone_pose: { x: sample.x, y: sample.y, heading_deg: sample.imu?.yaw_deg, sigma: state.ekf.sigma() },
    imu: sample.imu || imuSnapshot()
  }));
  const blob = new Blob([frames.map((frame) => JSON.stringify(frame)).join("\n")], { type: "application/jsonl" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `rf-room-scan-${Date.now()}.jsonl`;
  link.click();
  URL.revokeObjectURL(url);
}

function resetAll() {
  state.ekf.reset(0, 0);
  state.samples = [];
  state.path = [];
  state.targets = [];
  state.targetHistory = [];
  state.objects = [];
  state.lastPass = null;
  state.lastTrailRender = 0;
  state.exportedFrames = [];
  state.heat = Array.from({ length: state.heatRows }, () => Array(state.heatCols).fill(0));
  state.occupancy = 0;
  state.confidence = 0;
  resetCameraView();
  rebuildRoom();
  updateTargets();
  addLog("Map reset", "warn");
}

$$("[data-mode]").forEach((button) => {
  button.addEventListener("click", () => {
    state.mode = button.dataset.mode;
    $$("[data-mode]").forEach((item) => item.classList.toggle("active", item === button));
    addLog(`${button.textContent.trim()} mode selected`);
  });
});

ui.sensorButton.addEventListener("click", startSensors);
ui.recordButton.addEventListener("click", () => {
  state.recording = !state.recording;
  addLog(state.recording ? "Room scan recording started" : "Room scan recording stopped");
});
ui.resetButton.addEventListener("click", resetAll);
ui.originButton.addEventListener("click", () => {
  state.ekf.reset(0, 0);
  state.path = [{ t: nowMs(), x: 0, y: 0, motion: 0 }];
  rebuildPath();
  addLog("Origin set at doorway");
});
ui.cornerButton.addEventListener("click", () => {
  state.corners.push({ x: state.ekf.x[0], y: state.ekf.x[1] });
  state.ekf.updatePosition(state.ekf.x[0], state.ekf.x[1], 0.05);
  addLog(`Corner ${state.corners.length} marked`);
});
ui.sampleButton.addEventListener("click", () => addSample(0.38 + state.motion * 0.35, "manual"));
ui.objectButton.addEventListener("click", markObjectAtPhone);
ui.clearTrailButton.addEventListener("click", clearTrails);
ui.applyRoomButton.addEventListener("click", () => {
  state.room.width = Number(ui.roomWidth.value) || 5;
  state.room.length = Number(ui.roomLength.value) || 4;
  state.room.height = Number(ui.roomHeight.value) || 2.7;
  resetCameraView();
  rebuildRoom();
  addLog(`Room set to ${state.room.width}m x ${state.room.length}m`);
});
ui.connectButton.addEventListener("click", connectFeed);
ui.demoButton.addEventListener("click", () => {
  state.demo = !state.demo;
  ui.demoButton.textContent = state.demo ? "Stop demo" : "Demo feed";
  ui.feedChip.textContent = state.demo ? "Demo feed" : state.ws ? "Feed live" : "No feed";
  ui.feedChip.classList.toggle("live", state.demo || !!state.ws);
  ui.feedDot.className = state.demo ? "dot live" : "dot";
  addLog(state.demo ? "Synthetic external RF feed enabled" : "Synthetic feed disabled");
});
ui.exportButton.addEventListener("click", exportJsonl);
ui.clearLogButton.addEventListener("click", () => ui.eventLog.replaceChildren());

const cameraGesture = {
  pointers: new Map(),
  mode: "idle",
  startX: 0,
  startY: 0,
  startAngle: 0,
  startPitch: 0,
  startPinchDistance: 0,
  startPinchCenterX: 0,
  startPinchCenterY: 0,
  startCameraDistance: three.distance,
  startTargetX: 0,
  startTargetZ: 0
};

function gesturePoints() {
  return [...cameraGesture.pointers.values()];
}

function pinchDistance(points) {
  if (points.length < 2) return 0;
  return Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
}

function pinchCenter(points) {
  return {
    x: (points[0].x + points[1].x) / 2,
    y: (points[0].y + points[1].y) / 2
  };
}

function panCameraTarget(screenDx, screenDy, startTargetX, startTargetZ) {
  const rect = ui.viewer.getBoundingClientRect();
  const fovRad = THREE.MathUtils.degToRad(three.camera.fov);
  const worldPerPixel = (2 * Math.tan(fovRad / 2) * three.distance) / Math.max(1, rect.height);
  const forward = new THREE.Vector3(-Math.cos(three.angle), 0, -Math.sin(three.angle)).normalize();
  const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();
  const panScale = worldPerPixel * 0.9;
  const panX = (-screenDx * right.x + screenDy * forward.x) * panScale;
  const panZ = (-screenDx * right.z + screenDy * forward.z) * panScale;
  setCameraTarget(startTargetX + panX, startTargetZ + panZ);
}

function startCameraGesture() {
  const points = gesturePoints();
  if (points.length >= 2) {
    const center = pinchCenter(points);
    cameraGesture.mode = "pinch";
    cameraGesture.startPinchDistance = Math.max(1, pinchDistance(points));
    cameraGesture.startPinchCenterX = center.x;
    cameraGesture.startPinchCenterY = center.y;
    cameraGesture.startCameraDistance = three.distance;
    cameraGesture.startTargetX = three.targetX;
    cameraGesture.startTargetZ = three.targetZ;
    return;
  }
  if (points.length === 1) {
    cameraGesture.startX = points[0].x;
    cameraGesture.startY = points[0].y;
    if (points[0].pan) {
      cameraGesture.mode = "pan";
      cameraGesture.startTargetX = three.targetX;
      cameraGesture.startTargetZ = three.targetZ;
      return;
    }
    cameraGesture.mode = "rotate";
    cameraGesture.startAngle = three.angle;
    cameraGesture.startPitch = three.pitch;
    return;
  }
  cameraGesture.mode = "idle";
}

function updateCameraGesture() {
  const points = gesturePoints();
  if (points.length >= 2) {
    if (cameraGesture.mode !== "pinch") startCameraGesture();
    const center = pinchCenter(points);
    const currentDistance = Math.max(1, pinchDistance(points));
    const scale = cameraGesture.startPinchDistance / currentDistance;
    setCameraDistance(cameraGesture.startCameraDistance * scale);
    panCameraTarget(
      center.x - cameraGesture.startPinchCenterX,
      center.y - cameraGesture.startPinchCenterY,
      cameraGesture.startTargetX,
      cameraGesture.startTargetZ
    );
    return;
  }
  if (points.length === 1) {
    if (points[0].pan) {
      if (cameraGesture.mode !== "pan") startCameraGesture();
      panCameraTarget(points[0].x - cameraGesture.startX, points[0].y - cameraGesture.startY, cameraGesture.startTargetX, cameraGesture.startTargetZ);
      return;
    }
    if (cameraGesture.mode !== "rotate") startCameraGesture();
    three.angle = cameraGesture.startAngle + (points[0].x - cameraGesture.startX) * 0.008;
    three.pitch = clamp(cameraGesture.startPitch + (cameraGesture.startY - points[0].y) * 0.004, 0.28, 1.35);
  }
}

function endCameraPointer(event) {
  cameraGesture.pointers.delete(event.pointerId);
  if (ui.viewer.hasPointerCapture?.(event.pointerId)) {
    ui.viewer.releasePointerCapture(event.pointerId);
  }
  ui.viewer.classList.toggle("is-dragging", cameraGesture.pointers.size > 0);
  startCameraGesture();
}

ui.viewer.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  cameraGesture.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY, pan: event.shiftKey || event.altKey });
  ui.viewer.setPointerCapture(event.pointerId);
  ui.viewer.classList.add("is-dragging");
  startCameraGesture();
});

ui.viewer.addEventListener("pointermove", (event) => {
  if (!cameraGesture.pointers.has(event.pointerId)) return;
  event.preventDefault();
  cameraGesture.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY, pan: event.shiftKey || event.altKey });
  updateCameraGesture();
});

ui.viewer.addEventListener("pointerup", endCameraPointer);
ui.viewer.addEventListener("pointercancel", endCameraPointer);
ui.viewer.addEventListener("lostpointercapture", endCameraPointer);
ui.viewer.addEventListener("wheel", (event) => {
  event.preventDefault();
  setCameraDistance(three.distance * Math.exp(event.deltaY * 0.001));
}, { passive: false });
for (const gestureEvent of ["gesturestart", "gesturechange", "gestureend"]) {
  ui.viewer.addEventListener(gestureEvent, (event) => event.preventDefault(), { passive: false });
}

window.addEventListener("resize", resizeThree);
window.addEventListener("devicemotion", onMotion);
window.addEventListener("deviceorientation", onOrientation);

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}

setupThree();
addLog("Phone RF mapper ready");
tick();
