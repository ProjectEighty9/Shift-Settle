// A real 3D toy RC pickup for the hero, built in code with Three.js (no model files).
// It drives laps of the floor under the buttons: parked beside the teddy, away along the near
// lane, a U-turn, back along the far lane, another U-turn, and parked again.
//
// Only loaded on wide screens that are not phones / slow connections / data-saver; everywhere
// else the light SVG truck in the page keeps doing the same trip.

const hero = document.getElementById('hero-copy');
const mount = hero && hero.querySelector('.rc3d');
const wideQuery = matchMedia('(min-width:1180px)');
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const query = new URLSearchParams(location.search);
const frozenAt = query.has('rc3dtime') ? parseFloat(query.get('rc3dtime')) : null; // test hook: render one frame at t seconds

let started = false;

// data-saver, slow connections and very low-memory phones keep the light SVG truck
function isHeavy() {
  const conn = navigator.connection || {};
  return !!conn.saveData
    || /(^|-)(2g|3g)$/.test(conn.effectiveType || '')
    || !!(navigator.deviceMemory && navigator.deviceMemory <= 2);
}
const lowEnd = matchMedia('(pointer: coarse)').matches; // phones and tablets: lighter shadows, smaller pixel ratio

function maybeStart() {
  if (started || !mount || isHeavy()) return;
  started = true;
  const go = () => start().catch((err) => {
    console.error('RC truck 3D failed, keeping the SVG truck:', err);
    hero.classList.remove('has-3d');
  });
  if (window.requestIdleCallback) requestIdleCallback(go, { timeout: 2500 }); else setTimeout(go, 600);
}
maybeStart();

async function start() {
  const [THREE, { RoundedBoxGeometry }, { RoomEnvironment }] = await Promise.all([
    import('three'),
    import('three/addons/geometries/RoundedBoxGeometry.js'),
    import('three/addons/environments/RoomEnvironment.js')
  ]);
  try { await document.fonts.load('900 64px Archivo'); } catch (e) { /* fallback font is fine */ }

  // ---------- renderer, scene, camera ----------
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' });
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.78;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  mount.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.6;

  const camera = new THREE.PerspectiveCamera(20, 3.3, 0.1, 40);
  const camPos = new THREE.Vector3(0, 2.5, 4.7);
  const camTarget = new THREE.Vector3(0, 0.28, 0.05);
  camera.position.copy(camPos);
  camera.lookAt(camTarget);

  // Wide screens: the canvas sits beside the text and the lap is framed as designed (3 units either side).
  // Phones and tablets: the canvas spans the crates' row, so the lap is centred and the truck keeps a
  // steady size on screen (about 75px long) whatever the width.
  function fit() {
    const w = mount.clientWidth, h = mount.clientHeight;
    if (!w || !h) return false;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, lowEnd ? 1.75 : 2));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    const wide = wideQuery.matches;
    const halfWidth = wide ? 3.0 : Math.max(2.3, Math.min(3.2, w * 0.0074));
    const shiftX = wide ? 0 : -0.52;
    camPos.x = shiftX; camTarget.x = shiftX;
    camera.position.copy(camPos);
    camera.lookAt(camTarget);
    const dist = camPos.distanceTo(camTarget);
    camera.fov = 2 * Math.atan((halfWidth / camera.aspect) / dist) * 180 / Math.PI;
    camera.updateProjectionMatrix();
    return true;
  }

  // ---------- lights ----------
  scene.add(new THREE.HemisphereLight(0xdde6ff, 0x4a3a24, 0.4));
  const sun = new THREE.DirectionalLight(0xffe3a8, 2.1);
  sun.position.set(-2.6, 4.4, 2.6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(lowEnd ? 1024 : 2048, lowEnd ? 1024 : 2048);
  Object.assign(sun.shadow.camera, { left: -4.5, right: 4.5, top: 3.5, bottom: -3.5, near: 0.5, far: 14 });
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.02;
  scene.add(sun);

  // soft shadow on the page (the canvas stays transparent everywhere else)
  const catcher = new THREE.Mesh(new THREE.PlaneGeometry(16, 8), new THREE.ShadowMaterial({ opacity: 0.5 }));
  catcher.rotation.x = -Math.PI / 2;
  catcher.position.y = 0.001;
  catcher.receiveShadow = true;
  scene.add(catcher);

  // ---------- materials ----------
  const paint = new THREE.MeshPhysicalMaterial({ color: 0xf7b200, roughness: 0.34, metalness: 0.05, clearcoat: 1, clearcoatRoughness: 0.14 });
  const plastic = new THREE.MeshStandardMaterial({ color: 0x23252c, roughness: 0.55, metalness: 0.1 });
  const liner = new THREE.MeshStandardMaterial({ color: 0x15161a, roughness: 0.9, metalness: 0 });
  const rubber = new THREE.MeshStandardMaterial({ color: 0x101114, roughness: 0.92, metalness: 0 });
  const metal = new THREE.MeshStandardMaterial({ color: 0xa4a9b5, roughness: 0.32, metalness: 0.95 });
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x08131c, roughness: 0.03, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 2.2 });
  const lamp = new THREE.MeshStandardMaterial({ color: 0xfff3c4, emissive: 0xffe9a0, emissiveIntensity: 2.2, roughness: 0.3 });
  const tail = new THREE.MeshStandardMaterial({ color: 0xd93a3f, emissive: 0xff2a2a, emissiveIntensity: 1.4, roughness: 0.4 });
  const amber = new THREE.MeshStandardMaterial({ color: 0xffa21a, emissive: 0xff9a00, emissiveIntensity: 1.2, roughness: 0.4 });

  const shadowed = (m) => { m.castShadow = true; m.receiveShadow = true; return m; };
  const rbox = (w, h, d, mat, r = 0.02, seg = 3) => shadowed(new THREE.Mesh(
    new RoundedBoxGeometry(w, h, d, seg, Math.min(r, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001)), mat));
  const cyl = (rt, rb, h, mat, seg = 20) => shadowed(new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat));

  // ---------- wheel ----------
  const WHEEL_R = 0.19;
  function makeWheel() {
    const spin = new THREE.Group();
    // tyre: lathe profile revolved round the axle (axle = z)
    const prof = [[0.105, -0.07], [0.165, -0.07], [0.182, -0.062], [0.19, -0.045], [0.192, 0], [0.19, 0.045], [0.182, 0.062], [0.165, 0.07], [0.105, 0.07]]
      .map(([r, y]) => new THREE.Vector2(r, y));
    const tyreGeo = new THREE.LatheGeometry(prof, 40);
    tyreGeo.rotateX(Math.PI / 2);
    spin.add(shadowed(new THREE.Mesh(tyreGeo, rubber)));
    // chunky tread blocks
    const blockGeo = new RoundedBoxGeometry(0.05, 0.03, 0.12, 2, 0.01);
    const N = 22;
    const blocks = new THREE.InstancedMesh(blockGeo, rubber, N);
    const d = new THREE.Object3D();
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2;
      d.position.set(Math.cos(a) * 0.197, Math.sin(a) * 0.197, 0);
      d.rotation.set(0, 0, a);
      d.updateMatrix();
      blocks.setMatrixAt(i, d.matrix);
    }
    blocks.castShadow = true;
    spin.add(blocks);
    // rim: dark disc, silver star, yellow hub
    const disc = cyl(0.1, 0.1, 0.1, liner, 28); disc.rotation.x = Math.PI / 2; spin.add(disc);
    for (let i = 0; i < 5; i++) {
      const spoke = rbox(0.2, 0.03, 0.115, metal, 0.01, 2);
      spoke.rotation.z = (i / 5) * Math.PI;
      spin.add(spoke);
    }
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.103, 0.011, 8, 28), metal);
    ring.position.z = 0.05; spin.add(ring);
    const ring2 = ring.clone(); ring2.position.z = -0.05; spin.add(ring2);
    const hub = cyl(0.04, 0.04, 0.13, paint, 20); hub.rotation.x = Math.PI / 2; spin.add(hub);
    return spin;
  }

  // ---------- brand decal texture ----------
  function decal(flip) {
    const c = document.createElement('canvas');
    c.width = 512; c.height = 128;
    const x = c.getContext('2d');
    x.fillStyle = '#17181d';
    x.font = '900 62px Archivo, Arial, sans-serif';
    x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText('SHIFT & SETTLE', 256, 66);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.1), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
    if (flip) m.rotation.y = Math.PI;
    return m;
  }

  // ---------- the truck (forward = +x, up = +y, right-hand side = +z) ----------
  const WB_FRONT = 0.36, WB_REAR = -0.34, TRACK = 0.345;
  const truck = new THREE.Group();
  const body = new THREE.Group();
  truck.add(body);

  // chassis, tub, axles, shocks
  const chassis = rbox(0.98, 0.06, 0.34, plastic, 0.02); chassis.position.set(0, 0.215, 0); body.add(chassis);
  const tub = rbox(1.06, 0.09, 0.5, plastic, 0.03); tub.position.set(0, 0.3, 0); body.add(tub);
  for (const ax of [WB_FRONT, WB_REAR]) {
    const axle = cyl(0.018, 0.018, 0.76, metal, 12); axle.rotation.x = Math.PI / 2; axle.position.set(ax, WHEEL_R, 0); body.add(axle);
    for (const s of [-1, 1]) {
      const shock = cyl(0.014, 0.014, 0.14, metal, 10); shock.position.set(ax, 0.27, s * 0.235); shock.rotation.x = s * 0.5; body.add(shock);
      const spring = new THREE.Mesh(new THREE.TorusGeometry(0.024, 0.006, 6, 14), paint);
      spring.rotation.x = Math.PI / 2; spring.position.set(ax, 0.265, s * 0.235); body.add(spring);
    }
  }

  // hood and grille, bumpers, lights
  const hood = rbox(0.44, 0.13, 0.5, paint, 0.045, 4); hood.position.set(0.3, 0.405, 0); body.add(hood);
  const grille = rbox(0.02, 0.085, 0.34, liner, 0.008, 2); grille.position.set(0.52, 0.385, 0); body.add(grille);
  const fbumper = rbox(0.06, 0.05, 0.56, plastic, 0.02); fbumper.position.set(0.55, 0.285, 0); body.add(fbumper);
  const rbumper = rbox(0.05, 0.05, 0.54, plastic, 0.02); rbumper.position.set(-0.55, 0.285, 0); body.add(rbumper);
  for (const s of [-1, 1]) {
    const hl = rbox(0.016, 0.04, 0.07, lamp, 0.01, 2); hl.position.set(0.522, 0.43, s * 0.19); body.add(hl);
    const ind = rbox(0.014, 0.025, 0.04, amber, 0.008, 2); ind.position.set(0.522, 0.375, s * 0.225); body.add(ind);
    const tl = rbox(0.016, 0.05, 0.055, tail, 0.01, 2); tl.position.set(-0.535, 0.42, s * 0.2); body.add(tl);
    const mirror = rbox(0.03, 0.05, 0.02, plastic, 0.008, 2); mirror.position.set(0.17, 0.6, s * 0.265); body.add(mirror);
    const arm = rbox(0.015, 0.015, 0.04, plastic, 0.005, 2); arm.position.set(0.165, 0.585, s * 0.245); body.add(arm);
  }

  // cab (extruded side profile) with a roof light bar
  const cabShape = new THREE.Shape();
  cabShape.moveTo(-0.07, 0.35);
  cabShape.lineTo(-0.07, 0.65);
  cabShape.quadraticCurveTo(-0.065, 0.745, 0.02, 0.745);
  cabShape.lineTo(0.11, 0.745);
  cabShape.lineTo(0.25, 0.5);
  cabShape.lineTo(0.25, 0.35);
  cabShape.closePath();
  const cabGeo = new THREE.ExtrudeGeometry(cabShape, { depth: 0.44, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.015, bevelSegments: 4, curveSegments: 10 });
  cabGeo.translate(0, 0, -0.22);
  body.add(shadowed(new THREE.Mesh(cabGeo, paint)));

  const winShape = new THREE.Shape();
  winShape.moveTo(-0.045, 0.52); winShape.lineTo(-0.045, 0.655); winShape.lineTo(-0.012, 0.705);
  winShape.lineTo(0.092, 0.705); winShape.lineTo(0.188, 0.525); winShape.closePath();
  const winGeo = new THREE.ExtrudeGeometry(winShape, { depth: 0.492, bevelEnabled: false });
  winGeo.translate(0, 0, -0.246);
  body.add(new THREE.Mesh(winGeo, glass));
  // windscreen: the cab's front slope runs (0.11,0.745) -> (0.25,0.5) and the bevel pushes the paint
  // about 0.015 further out, so the glass sits 0.022 out along the slope's normal to stay in front of it
  const shield = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.225, 0.42), glass);
  shield.position.set(0.201, 0.63, 0); shield.rotation.z = 0.5195; body.add(shield);
  // a soft sky reflection streak across the glass
  const glintCanvas = document.createElement('canvas');
  glintCanvas.width = glintCanvas.height = 128;
  const gx = glintCanvas.getContext('2d');
  const glintGrad = gx.createLinearGradient(0, 0, 128, 128);
  glintGrad.addColorStop(0, 'rgba(255,255,255,0)');
  glintGrad.addColorStop(0.3, 'rgba(255,255,255,0)');
  glintGrad.addColorStop(0.42, 'rgba(190,225,255,.55)');
  glintGrad.addColorStop(0.5, 'rgba(255,255,255,.12)');
  glintGrad.addColorStop(0.58, 'rgba(190,225,255,.35)');
  glintGrad.addColorStop(0.7, 'rgba(255,255,255,0)');
  glintGrad.addColorStop(1, 'rgba(255,255,255,0)');
  gx.fillStyle = glintGrad; gx.fillRect(0, 0, 128, 128);
  const glint = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.225),
    new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(glintCanvas), transparent: true, depthWrite: false, opacity: 0.8 }));
  glint.rotation.y = Math.PI / 2; glint.position.x = 0.0035;
  shield.add(glint);
  // dark A-pillars and a header strip frame the glass
  for (const s of [-1, 1]) {
    const pillar = rbox(0.012, 0.25, 0.022, plastic, 0.004, 2);
    pillar.position.set(0.2, 0.632, s * 0.212); pillar.rotation.z = 0.5195; body.add(pillar);
  }
  const header = rbox(0.016, 0.014, 0.43, plastic, 0.004, 2);
  header.position.set(0.126, 0.745, 0); header.rotation.z = 0.5195; body.add(header);
  const rear = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.12, 0.34), glass);
  rear.position.set(-0.098, 0.6, 0); body.add(rear);

  const bar = rbox(0.06, 0.028, 0.36, plastic, 0.01, 2); bar.position.set(0.075, 0.77, 0); body.add(bar);
  for (let i = 0; i < 4; i++) {
    const l = rbox(0.012, 0.02, 0.05, lamp, 0.006, 2); l.position.set(0.108, 0.772, -0.135 + i * 0.09); body.add(l);
  }

  // open bed
  const floor = rbox(0.46, 0.012, 0.46, liner, 0.004, 2); floor.position.set(-0.32, 0.358, 0); body.add(floor);
  for (const s of [-1, 1]) {
    const wall = rbox(0.5, 0.15, 0.028, paint, 0.012, 3); wall.position.set(-0.3, 0.43, s * 0.236); body.add(wall);
    const d = decal(s < 0); d.position.set(-0.3, 0.43, s * (0.236 + 0.0155)); body.add(d);
  }
  const front = rbox(0.028, 0.15, 0.5, paint, 0.012, 3); front.position.set(-0.088, 0.43, 0); body.add(front);
  const gate = rbox(0.028, 0.15, 0.5, paint, 0.012, 3); gate.position.set(-0.535, 0.43, 0); body.add(gate);

  // aerial: a springy whip with a yellow ball on the end
  const aerial = new THREE.Group();
  aerial.position.set(-0.16, 0.375, 0.2);
  const abase = cyl(0.016, 0.02, 0.03, plastic, 12); abase.position.y = 0.015; aerial.add(abase);
  const whip = cyl(0.0035, 0.0035, 0.56, metal, 6); whip.position.y = 0.3; aerial.add(whip);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.018, 12, 10), paint); knob.position.y = 0.58; aerial.add(knob);
  body.add(aerial);

  // wheels stay on the ground (not part of the swaying body)
  const wheels = [];
  const frontPivots = [];
  for (const [x, z, front] of [[WB_FRONT, TRACK, true], [WB_FRONT, -TRACK, true], [WB_REAR, TRACK, false], [WB_REAR, -TRACK, false]]) {
    const pivot = new THREE.Group();
    pivot.position.set(x, WHEEL_R, z);
    const spin = makeWheel();
    pivot.add(spin);
    truck.add(pivot);
    wheels.push(spin);
    if (front) frontPivots.push(pivot);
  }
  scene.add(truck);

  // a soft dark patch under the truck so the tyres sit on the page
  const blobCanvas = document.createElement('canvas');
  blobCanvas.width = blobCanvas.height = 128;
  const bx = blobCanvas.getContext('2d');
  const grad = bx.createRadialGradient(64, 64, 4, 64, 64, 62);
  grad.addColorStop(0, 'rgba(0,0,0,.65)'); grad.addColorStop(1, 'rgba(0,0,0,0)');
  bx.fillStyle = grad; bx.fillRect(0, 0, 128, 128);
  const blob = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.95), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(blobCanvas), transparent: true, depthWrite: false }));
  blob.rotation.x = -Math.PI / 2;
  blob.position.y = 0.004;
  truck.add(blob);

  // ---------- the lap: a racetrack (near lane out, U-turn, far lane back, U-turn) ----------
  const X_PARK = 0.81, X_FAR = -1.85, Z_NEAR = 0.5, Z_FAR = -0.5, R = 0.5;
  const LEG = X_PARK - X_FAR, ARC = Math.PI * R, LAP = 2 * LEG + 2 * ARC;
  function pathAt(s) {
    s = ((s % LAP) + LAP) % LAP;
    if (s < LEG) return { x: X_PARK - s, z: Z_NEAR, tx: -1, tz: 0 };
    s -= LEG;
    if (s < ARC) { const f = s / R; return { x: X_FAR - R * Math.sin(f), z: R * Math.cos(f), tx: -Math.cos(f), tz: -Math.sin(f) }; }
    s -= ARC;
    if (s < LEG) return { x: X_FAR + s, z: Z_FAR, tx: 1, tz: 0 };
    s -= LEG;
    const f = s / R;
    return { x: X_PARK + R * Math.sin(f), z: -R * Math.cos(f), tx: Math.cos(f), tz: Math.sin(f) };
  }
  const yawOf = (p) => Math.atan2(-p.tz, p.tx);
  const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  const CYCLE = 16, DWELL = 2.5; // seconds: parked for 2.5, then one lap
  let cumPrev = 0, vel = 0, velPrev = 0, steer = 0, spinAngle = 0, aA = 0, aV = 0, aB = 0, aW = 0;

  function update(t, dt) {
    const cycles = Math.floor(t / CYCLE);
    const tc = t - cycles * CYCLE;
    const u = clamp((tc - DWELL) / (CYCLE - DWELL), 0, 1);
    const e = u * u * (3 - 2 * u);
    const s = e * LAP;
    const cum = cycles * LAP + s;

    const p = pathAt(s);
    const yaw = yawOf(p);
    const p2 = pathAt(s + 0.02);
    const curv = wrapAngle(yawOf(p2) - yaw) / 0.02; // + = turning left
    truck.position.set(p.x, 0, p.z);
    truck.rotation.y = yaw;

    const step = cum - cumPrev;
    cumPrev = cum;
    if (dt > 0) {
      const raw = step / dt;
      vel += (raw - vel) * Math.min(1, dt * 10);
    }
    const acc = dt > 0 ? (vel - velPrev) / dt : 0;
    velPrev = vel;

    const steerTarget = clamp(Math.atan(0.7 * curv), -0.5, 0.5) * (Math.abs(vel) > 0.02 ? 1 : 0);
    steer += (steerTarget - steer) * Math.min(1, (dt || 0.016) * 7);
    frontPivots.forEach((pv) => { pv.rotation.y = steer; });
    spinAngle -= step / WHEEL_R;
    wheels.forEach((w) => { w.rotation.z = spinAngle; });

    const moving = Math.min(1, Math.abs(vel) * 3);
    body.rotation.x = clamp(vel * vel * curv * 0.03, -0.06, 0.06);
    body.rotation.z = clamp(acc * 0.012, -0.05, 0.05);
    body.position.y = Math.sin(t * 38) * 0.0025 * moving;

    // aerial: damped spring pushed about by accelerating and cornering
    if (dt > 0) {
      const fa = -acc * 1.1, fl = -vel * vel * curv * 0.9;
      aV += (-60 * aA - 4 * aV + fa * 30) * dt; aA += aV * dt;
      aW += (-60 * aB - 4 * aW + fl * 30) * dt; aB += aW * dt;
    }
    aerial.rotation.z = clamp(aA, -0.35, 0.35);
    aerial.rotation.x = clamp(aB, -0.35, 0.35);
  }

  // ---------- run ----------
  let raf = 0, last = 0, t = 0, onScreen = true;
  const draw = () => renderer.render(scene, camera);
  function frame(now) {
    raf = requestAnimationFrame(frame);
    if (!onScreen || document.hidden || !fit.ok) { last = now; return; }
    const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
    last = now;
    t += dt;
    update(t, dt);
    draw();
  }
  fit.ok = fit();
  new ResizeObserver(() => { fit.ok = fit(); }).observe(mount);
  new IntersectionObserver((entries) => { onScreen = entries.some((e) => e.isIntersecting); }).observe(mount);

  if (frozenAt !== null && !Number.isNaN(frozenAt)) {
    update(frozenAt, 0);
    if (fit.ok) draw();
  } else if (reduceMotion) {
    update(0, 0);
    if (fit.ok) draw();
  } else {
    requestAnimationFrame((now) => { last = now; frame(now); });
  }
  // swap the SVG stand-in for the 3D truck once there is a first picture
  requestAnimationFrame(() => requestAnimationFrame(() => { if (fit.ok) hero.classList.add('has-3d'); }));
}
