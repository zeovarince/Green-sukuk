const COLORS = { ink: 0x12262a, water: 0x0e5a5f, mark: 0xb8450b, broken: 0xa3191f, line: 0xaeb8b1, muted: 0x4b5e59, deep: 0x15846e, mint: 0x15846e };
const MOTION_KEY = "gstp-3d";
const fmt = new Intl.NumberFormat("id-ID");
const fixed = (value, digits = 2) => new Intl.NumberFormat("id-ID", { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value);
const pct = (value) => `${fixed(value * 100)}%`;
const text = (id, value) => { const node = document.getElementById(id); if (node) node.textContent = value; };
const sceneElement = document.querySelector(".scene");
const canvas = document.getElementById("scene-canvas");
const toggleButton = document.getElementById("toggle-3d");
const chapters = [...document.querySelectorAll("[data-scene]")];
const railLinks = [...document.querySelectorAll("[data-rail]")];

let THREE;
let renderer;
let camera;
let scene;
let groups = [];
let activeChapter = 0;
let currentPosition;
let targetPosition;
let animationFrame = 0;
let is3dOn = false;

function setTextValues(curve, cloud, chain, evaluation) {
  text("contract-id", curve.kontrak_id);
  text("curve-gap", fixed(curve.ditandai.selisih_poin));
  text("source-total", fmt.format(cloud.total));
  text("source-anomalies", fmt.format(cloud.anomali));
  text("sample-total", fmt.format(cloud.n_sampel));
  text("source-rate", pct(cloud.proporsi_anomali_sumber));
  text("sample-rate", pct(cloud.proporsi_anomali_sampel));
  text("threshold", fixed(cloud.ambang, 3));
  text("rule-count", fmt.format(cloud.peringatan_aturan_sampel));
  text("score-count", fmt.format(cloud.peringatan_skor_sampel));
  text("hybrid-count", fmt.format(cloud.peringatan_hybrid_sampel));
  text("broken-entry", fmt.format(chain.rusak_pada));
  text("evaluation-seed", String(evaluation.seed_utama));
  text("model-version", evaluation.versi_model);
  text("footer-threshold", fixed(evaluation.ambang.nilai, 3));
  const seeds = evaluation.beberapa_seed;
  text("multi-seed", `Lima seed: F1 hybrid rata-rata ${fixed(seeds.f1_hybrid_rerata, 4)} (simpangan baku ${fixed(seeds.f1_hybrid_sd, 4)}); FAR rata-rata ${pct(seeds.far_hybrid_rerata)}.`);

  const tbody = document.getElementById("evaluation-rows");
  tbody.replaceChildren();
  const rows = [
    ["Aturan saja", evaluation.pengujian.aturan_saja],
    ["Isolation Forest saja", evaluation.pengujian.iforest_saja],
    ["Hybrid", evaluation.pengujian.hybrid],
  ];
  for (const [label, metric] of rows) {
    const row = document.createElement("tr");
    const values = [label, fixed(metric.precision, 4), fixed(metric.recall, 4), fixed(metric.f1, 4), pct(metric.far), fixed(metric.peringatan_per_1000, 2)];
    values.forEach((value, index) => {
      const cell = document.createElement(index === 0 ? "th" : "td");
      if (index === 0) cell.scope = "row";
      cell.textContent = value;
      row.append(cell);
    });
    tbody.append(row);
  }
}

function updatePoster(curve) {
  const x = (u) => 115 + u * 530;
  const y = (value) => 420 - value * 300;
  const pathFor = (key) => curve.titik.map((point, index) => `${index ? "L" : "M"}${x(point.u).toFixed(1)} ${y(point[key]).toFixed(1)}`).join(" ");
  document.getElementById("poster-progress").setAttribute("d", pathFor("progres"));
  document.getElementById("poster-cash").setAttribute("d", pathFor("pencairan"));
  const marker = curve.titik.reduce((nearest, point) => Math.abs(point.u - curve.ditandai.u) < Math.abs(nearest.u - curve.ditandai.u) ? point : nearest, curve.titik[0]);
  const markerX = x(marker.u);
  const progressY = y(marker.progres);
  const cashY = y(marker.pencairan);
  document.getElementById("poster-marker").setAttribute("d", `M${markerX.toFixed(1)} ${Math.min(progressY, cashY).toFixed(1)}V${Math.max(progressY, cashY).toFixed(1)}`);
  document.getElementById("poster-flag").setAttribute("d", `M${(markerX - 9).toFixed(1)} ${(cashY - 4).toFixed(1)}h18l-9 -17z`);
}

function line(points, color, opacity = 1) {
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = new THREE.LineBasicMaterial({ color, transparent: opacity < 1, opacity });
  return new THREE.Line(geometry, material);
}

function pointsObject(points, color, size, maxCount, offsetX = 0) {
  const chosen = points.slice(0, maxCount);
  const values = new Float32Array(chosen.length * 3);
  chosen.forEach((point, index) => {
    values[index * 3] = (point.x - .5) * 4.4 + offsetX;
    values[index * 3 + 1] = (point.y - .5) * 2.25;
    values[index * 3 + 2] = (point.z - .5) * 2.3;
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(values, 3));
  return new THREE.Points(geometry, new THREE.PointsMaterial({ color, size, sizeAttenuation: true }));
}

function makeBrainGroup() {
  const group = new THREE.Group();
  const glyphGeometry = new THREE.TetrahedronGeometry(.026, 0);
  const glyphMaterial = new THREE.MeshBasicMaterial({ color: COLORS.mint });
  const glyphs = new THREE.InstancedMesh(glyphGeometry, glyphMaterial, 1320);
  const dummy = new THREE.Object3D();
  let instance = 0;
  let seed = 287;
  const random = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  const folds = [];

  for (const side of [-1, 1]) {
    const center = new THREE.Vector3(side * .56, .02, 0);
    const radius = new THREE.Vector3(.91, 1.12, .78);
    const surface = (theta, phi, lift = 0) => {
      const ripple = 1 + .035 * Math.sin(phi * 7 + theta * 3) + .024 * Math.sin(phi * 11 - theta * 5);
      const sinTheta = Math.sin(theta) * (1 + lift);
      return new THREE.Vector3(
        center.x + side * radius.x * sinTheta * Math.cos(phi) * ripple,
        center.y + radius.y * Math.cos(theta) * ripple,
        radius.z * sinTheta * Math.sin(phi) * ripple,
      );
    };

    // Thin curved traces make the two lobes read as a folded, brain-like network.
    for (let row = 1; row < 10; row += 1) {
      const theta = row * Math.PI / 10;
      const points = [];
      for (let col = 0; col <= 36; col += 1) points.push(surface(theta + .045 * Math.sin(col * .7 + row), col * Math.PI * 2 / 36, .018));
      folds.push(...points.slice(0, -1).flatMap((point, index) => [point, points[index + 1]]));
    }
    for (let col = 0; col < 14; col += 1) {
      const phi = col * Math.PI * 2 / 14;
      const points = [];
      for (let row = 1; row < 20; row += 1) points.push(surface(row * Math.PI / 20, phi + .045 * Math.sin(row * .8 + col), .023));
      folds.push(...points.slice(0, -1).flatMap((point, index) => [point, points[index + 1]]));
    }

    // Faceted particles follow the surface; a small set of amber glyphs is decorative.
    const perLobe = 660;
    for (let index = 0; index < perLobe; index += 1) {
      const vertical = -1 + 2 * (index + .5) / perLobe;
      const theta = Math.acos(vertical);
      const phi = random() * Math.PI * 2;
      const position = surface(theta, phi, .035);
      dummy.position.copy(position);
      dummy.rotation.set(random() * Math.PI, random() * Math.PI, random() * Math.PI);
      const scale = .52 + random() * 1.05;
      dummy.scale.setScalar(scale);
      dummy.updateMatrix();
      glyphs.setMatrixAt(instance, dummy.matrix);
      const accent = index % 4 === 0 ? COLORS.water : COLORS.mint;
      glyphs.setColorAt(instance, new THREE.Color(accent));
      instance += 1;
    }
  }

  glyphs.instanceMatrix.needsUpdate = true;
  if (glyphs.instanceColor) glyphs.instanceColor.needsUpdate = true;
  group.add(glyphs);
  const traces = new THREE.BufferGeometry().setFromPoints(folds);
  group.add(new THREE.LineSegments(traces, new THREE.LineBasicMaterial({ color: COLORS.water, transparent: true, opacity: .29 })));

  // Quiet orbiting dots add depth without implying a direct model architecture.
  const ambient = [];
  for (let index = 0; index < 190; index += 1) {
    const angle = random() * Math.PI * 2;
    const radius = 1.65 + random() * .75;
    ambient.push(new THREE.Vector3(Math.cos(angle) * radius, (random() - .5) * 3.1, (random() - .5) * 1.7));
  }
  const ambientGeometry = new THREE.BufferGeometry().setFromPoints(ambient);
  group.add(new THREE.Points(ambientGeometry, new THREE.PointsMaterial({ color: COLORS.deep, size: .028, sizeAttenuation: true })));
  group.position.set(1.65, 0, 0);
  return group;
}

function makeSceneData(data) {
  const narrow = matchMedia("(max-width: 760px)").matches;
  const brainGroup = makeBrainGroup();
  const curveGroup = new THREE.Group();
  const progressLine = data.curve.titik.map((point) => new THREE.Vector3((point.u - .5) * 4.7, (point.progres - .5) * 2.55, .12));
  const cashLine = data.curve.titik.map((point) => new THREE.Vector3((point.u - .5) * 4.7, (point.pencairan - .5) * 2.55, -.12));
  curveGroup.add(line([new THREE.Vector3(-2.5, -1.48, 0), new THREE.Vector3(2.5, -1.48, 0)], COLORS.line));
  curveGroup.add(line(progressLine, COLORS.ink), line(cashLine, COLORS.water));
  const marker = data.curve.titik.reduce((nearest, point) => Math.abs(point.u - data.curve.ditandai.u) < Math.abs(nearest.u - data.curve.ditandai.u) ? point : nearest, data.curve.titik[0]);
  const markerX = (marker.u - .5) * 4.7;
  curveGroup.add(line([new THREE.Vector3(markerX, (marker.progres - .5) * 2.55, 0), new THREE.Vector3(markerX, (marker.pencairan - .5) * 2.55, 0)], COLORS.mark));
  const pin = new THREE.Mesh(new THREE.ConeGeometry(.12, .24, 3), new THREE.MeshBasicMaterial({ color: COLORS.mark }));
  pin.position.set(markerX, (marker.pencairan - .5) * 2.55 + .15, 0);
  curveGroup.add(pin);
  curveGroup.position.x = 1.15;

  const cap = matchMedia("(pointer: coarse)").matches ? 2200 : 6000;
  const cloudGroup = new THREE.Group();
  const normal = data.cloud.sampel.filter((point) => point.d === 0);
  const flagged = data.cloud.sampel.filter((point) => point.d === 1);
  cloudGroup.add(pointsObject(normal, COLORS.muted, .036, cap));
  cloudGroup.add(pointsObject(flagged, COLORS.mark, .06, cap));
  cloudGroup.add(line([new THREE.Vector3(-2.45, -1.3, 0), new THREE.Vector3(2.45, -1.3, 0)], COLORS.line));
  cloudGroup.position.x = 1.05;

  const gateGroup = new THREE.Group();
  gateGroup.add(pointsObject(data.cloud.sampel.filter((point) => point.a === 1), COLORS.mark, .055, cap, -.65));
  gateGroup.add(pointsObject(data.cloud.sampel.filter((point) => point.a === 0 && point.d === 1), COLORS.water, .055, cap, .7));
  for (const x of [-1.5, 1.5]) {
    const frame = new THREE.EdgesGeometry(new THREE.BoxGeometry(.12, 2.65, 2.25));
    const segments = new THREE.LineSegments(frame, new THREE.LineBasicMaterial({ color: x < 0 ? COLORS.line : COLORS.water }));
    segments.position.x = x;
    gateGroup.add(segments);
  }
  gateGroup.position.x = 1.1;

  const chainGroup = new THREE.Group();
  const entries = data.chain.entri;
  const chainPositions = entries.map((_, index) => new THREE.Vector3(-2.8 + index * (5.6 / Math.max(entries.length - 1, 1)), Math.sin(index * .44) * .3, 0));
  entries.forEach((entry, index) => {
    if (index < entries.length - 1) {
      const broken = entries[index + 1].seq === data.chain.rusak_pada;
      const connector = line([chainPositions[index], chainPositions[index + 1]], broken ? COLORS.broken : COLORS.water, broken ? .7 : 1);
      if (broken) {
        connector.material.dispose();
        connector.material = new THREE.LineDashedMaterial({ color: COLORS.broken, dashSize: .09, gapSize: .08 });
        connector.computeLineDistances();
      }
      chainGroup.add(connector);
    }
    const block = new THREE.Mesh(new THREE.BoxGeometry(.27, .25, .18), new THREE.MeshBasicMaterial({ color: entry.seq === data.chain.rusak_pada ? COLORS.broken : COLORS.water }));
    block.position.copy(chainPositions[index]);
    chainGroup.add(block);
  });
  chainGroup.position.x = 1.05;

  const resultsGroup = new THREE.Group();
  resultsGroup.add(line([new THREE.Vector3(-2.45, -1.2, 0), new THREE.Vector3(2.45, -1.2, 0)], COLORS.line));
  [data.evaluation.pengujian.aturan_saja, data.evaluation.pengujian.iforest_saja, data.evaluation.pengujian.hybrid].forEach((metric, index) => {
    const height = Math.max(metric.f1 * 2.25, .08);
    const bar = new THREE.Mesh(new THREE.BoxGeometry(.72, height, .5), new THREE.MeshBasicMaterial({ color: index === 2 ? COLORS.deep : COLORS.water }));
    bar.position.set((index - 1) * 1.5, -.6 + height / 2, 0);
    resultsGroup.add(bar);
  });
  resultsGroup.position.x = 1.05;

  const endGroup = new THREE.Group();
  const frame = new THREE.EdgesGeometry(new THREE.BoxGeometry(4.8, 2.9, .08));
  endGroup.add(new THREE.LineSegments(frame, new THREE.LineBasicMaterial({ color: COLORS.ink })));
  endGroup.position.x = 1.05;
  if (narrow) {
    brainGroup.scale.setScalar(.78);
    brainGroup.position.set(.9, 1.15, 0);
    curveGroup.scale.setScalar(.46);
    cloudGroup.scale.setScalar(.5);
    gateGroup.scale.setScalar(.48);
    chainGroup.scale.setScalar(.38);
    resultsGroup.scale.setScalar(.6);
    endGroup.scale.setScalar(.46);
    for (const group of [curveGroup, cloudGroup, gateGroup, chainGroup, resultsGroup, endGroup]) group.position.x = .9;
  }
  groups = [brainGroup, curveGroup, cloudGroup, gateGroup, chainGroup, resultsGroup, endGroup];
  groups.forEach((group) => { group.visible = false; scene.add(group); });
}

function webglAvailable() {
  try {
    const probe = document.createElement("canvas");
    const context = probe.getContext("webgl2") || probe.getContext("webgl");
    const available = Boolean(context);
    context?.getExtension("WEBGL_lose_context")?.loseContext();
    return available;
  } catch { return false; }
}

function scheduleFrame() {
  if (!is3dOn || animationFrame || document.visibilityState !== "visible") return;
  animationFrame = requestAnimationFrame(drawFrame);
}

function drawFrame() {
  animationFrame = 0;
  if (!is3dOn || !renderer) return;
  const destination = targetPosition ?? new THREE.Vector3(.65, 2.6, 7.3);
  currentPosition.lerp(destination, .12);
  camera.position.copy(currentPosition);
  camera.lookAt(.9, 0, 0);
  if (activeChapter === 0 && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
    groups[0].rotation.y = Math.sin(performance.now() * .00024) * .055;
  }
  renderer.render(scene, camera);
  if (currentPosition.distanceToSquared(destination) > .001 || activeChapter === 0 && !matchMedia("(prefers-reduced-motion: reduce)").matches) scheduleFrame();
}

function updateChapter(index) {
  activeChapter = Math.min(6, Math.max(0, index));
  railLinks.forEach((link, linkIndex) => {
    if (linkIndex === activeChapter) link.setAttribute("aria-current", "step");
    else link.removeAttribute("aria-current");
  });
  groups.forEach((group, groupIndex) => { group.visible = groupIndex === activeChapter; });
  const posterIndex = activeChapter === 0 ? 0 : activeChapter === 1 ? 1 : -1;
  document.querySelectorAll("[data-poster]").forEach((poster) => {
    poster.classList.toggle("is-active", Number(poster.dataset.poster) === posterIndex);
  });
  if (!is3dOn) return;
  const poses = [
    [.55, 2.65, 7.5], [.65, 2.55, 7.3], [.72, 2.6, 7.35], [.78, 2.62, 7.3], [.84, 2.7, 7.3], [.9, 2.75, 7.25], [.95, 2.8, 7.2],
  ];
  if (window.innerWidth <= 760) poses[activeChapter] = [.9, 3.15, 9.2];
  targetPosition = new THREE.Vector3(...poses[activeChapter]);
  scheduleFrame();
}

async function enable3d() {
  try {
    if (!THREE) THREE = await import("/vendor/three/three.module.js");
    if (!renderer) {
      scene = new THREE.Scene();
      camera = new THREE.PerspectiveCamera(37, window.innerWidth / window.innerHeight, .1, 60);
      const mobile = matchMedia("(pointer: coarse)").matches;
      renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false, powerPreference: "low-power" });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile ? 1.25 : 1.5));
      renderer.setSize(window.innerWidth, window.innerHeight, false);
      makeSceneData(window.landingData);
      currentPosition = new THREE.Vector3(.55, 2.65, 7.5);
    }
    is3dOn = true;
    sceneElement.classList.add("is-live");
    toggleButton.textContent = "Matikan adegan 3D";
    toggleButton.setAttribute("aria-pressed", "true");
    document.getElementById("scene-status").textContent = "Adegan Three.js · data simulasi";
    updateChapter(activeChapter);
  } catch (error) {
    console.error("Three.js tidak dapat dijalankan", error);
    toggleButton.disabled = true;
    toggleButton.textContent = "Adegan 3D tidak tersedia";
    document.getElementById("scene-status").textContent = "Poster statis · data simulasi";
    is3dOn = false;
  }
}

function disable3d() {
  is3dOn = false;
  if (animationFrame) cancelAnimationFrame(animationFrame);
  animationFrame = 0;
  sceneElement.classList.remove("is-live");
  toggleButton.textContent = "Aktifkan adegan 3D";
  toggleButton.setAttribute("aria-pressed", "false");
  document.getElementById("scene-status").textContent = "Poster statis · data simulasi";
}

function findChapter() {
  const midpoint = window.innerHeight * .52;
  let nearest = 0;
  let distance = Infinity;
  chapters.forEach((chapter, index) => {
    const rect = chapter.getBoundingClientRect();
    const current = Math.abs((rect.top + Math.min(rect.height, window.innerHeight) / 2) - midpoint);
    if (current < distance) { nearest = index; distance = current; }
  });
  updateChapter(nearest);
}

window.addEventListener("scroll", findChapter, { passive: true });
window.addEventListener("resize", () => {
  if (!renderer) return;
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  scheduleFrame();
});
document.addEventListener("visibilitychange", scheduleFrame);
toggleButton.addEventListener("click", () => {
  if (is3dOn) {
    try { localStorage.setItem(MOTION_KEY, "mati"); } catch { /* Pengaturan sesi tetap berlaku. */ }
    disable3d();
  } else {
    try { localStorage.removeItem(MOTION_KEY); } catch { /* Pengaturan sesi tetap berlaku. */ }
    enable3d();
  }
});

async function loadLandingData() {
  const base = "/landing-data/";
  const names = ["kurva_contoh", "awan_transaksi", "rantai_contoh", "evaluasi"];
  const [curve, cloud, chain, evaluation] = await Promise.all(names.map((name) => fetch(`${base}${name}.json`).then((response) => {
    if (!response.ok) throw new Error(`Gagal memuat ${name}.json`);
    return response.json();
  })));
  if (!curve.simulasi || !cloud.simulasi || !chain.simulasi || evaluation.tersedia !== true) throw new Error("Data landing tidak memenuhi penanda simulasi.");
  return { curve, cloud, chain, evaluation };
}

loadLandingData().then((data) => {
  window.landingData = data;
  updatePoster(data.curve);
  setTextValues(data.curve, data.cloud, data.chain, data.evaluation);
  findChapter();
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const saveData = Boolean(navigator.connection?.saveData);
  let manuallyDisabled = false;
  try { manuallyDisabled = localStorage.getItem(MOTION_KEY) === "mati"; } catch { /* Penyimpanan browser opsional. */ }
  if (!webglAvailable()) {
    toggleButton.disabled = true;
    toggleButton.hidden = true;
    document.getElementById("scene-status").textContent = "Poster statis · data simulasi";
  } else {
    toggleButton.hidden = false;
    toggleButton.disabled = false;
    if (reducedMotion || saveData || manuallyDisabled) {
      toggleButton.textContent = reducedMotion ? "Aktifkan adegan 3D secara manual" : "Aktifkan adegan 3D";
    } else {
      enable3d();
    }
  }
}).catch((error) => {
  console.error("Data landing tidak dapat dimuat", error);
  document.getElementById("scene-status").textContent = "Poster statis · data simulasi lokal";
  toggleButton.disabled = true;
  toggleButton.textContent = "Data adegan tidak tersedia";
});
