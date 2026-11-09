// Interactive 3D scene: the Shift & Settle van, back doors open, parked in a storage unit.
// Everything is built from boxes and cylinders in code, so there are no model files to download.

const host = document.getElementById('unit3d');

if (host) {
  const start = () => build(host).catch((err) => {
    console.error('3D scene failed:', err);
    host.classList.add('is-failed');
    host.querySelector('.scene-status').textContent = 'The 3D view is not available on this device.';
  });
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) { io.disconnect(); start(); }
    }, { rootMargin: '500px' });
    io.observe(host);
  } else {
    start();
  }
}

async function build(host) {
  const THREE = await import('three');
  const { OrbitControls } = await import('three/addons/controls/OrbitControls.js');
  try { await document.fonts.load('900 80px Archivo'); } catch (e) { /* the fallback font is fine */ }

  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const INK = 0x17181d;

  // ---------- renderer, scene, camera ----------
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const canvas = renderer.domElement;
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', 'A 3D view of the Shift and Settle van in a storage unit, back doors open, with a trolley of boxes beside it. Drag to look around.');
  host.insertBefore(canvas, host.firstChild);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(INK);
  scene.fog = new THREE.Fog(INK, 18, 38);

  const camera = new THREE.PerspectiveCamera(40, 16 / 9, 0.1, 80);
  camera.position.set(5.2, 3.0, 7.4);

  const controls = new OrbitControls(camera, canvas);
  controls.target.set(0, 1.3, 0.4);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.enablePan = false;
  controls.enableZoom = false;
  controls.minDistance = 4.5;
  controls.maxDistance = 15;
  controls.minPolarAngle = 0.35;
  controls.maxPolarAngle = 1.48;
  controls.autoRotateSpeed = 0.55;
  canvas.style.touchAction = 'pan-y';

  // ---------- small helpers ----------
  const rng = (seed) => () => {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const mat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0, ...o });
  const cache = {};
  const M = (color, o = {}) => (cache[color + JSON.stringify(o)] ??= mat(color, o));

  const canvasTexture = (w, h, draw, rx = 1, ry = 1, repeat = true) => {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry); }
    return t;
  };

  // A box centred on (x, y, z). `material` can be an array of six for per-face colours.
  const box = (w, h, d, material, x = 0, y = 0, z = 0, parent = scene, shadows = true) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    m.position.set(x, y, z);
    m.castShadow = shadows;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  };

  const cyl = (rTop, rBottom, h, material, x, y, z, parent = scene, seg = 20) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBottom, h, seg), material);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  };

  const cardboard = ['#c4965f', '#b98b5a', '#a97c4d', '#d1a46f', '#bd9160'];
  const carton = (w, h, d, color, parent, x, y, z, ry = 0) => {
    const g = new THREE.Group();
    box(w, h, d, M(color, { roughness: 0.92 }), 0, 0, 0, g);
    box(0.07, h + 0.006, d + 0.006, M('#e9d9b0', { roughness: 0.6 }), 0, 0, 0, g, false);
    g.position.set(x, y, z);
    g.rotation.y = ry;
    parent.add(g);
    return g;
  };

  // ---------- materials ----------
  const paint = M('#f4f5f7', { roughness: 0.42, metalness: 0.08 });
  const inner = M('#cdd0d6', { roughness: 0.85 });
  const yellow = M('#ffc21a', { roughness: 0.5 });
  const darkBand = M('#33363e', { roughness: 0.7 });
  const glass = M('#1d2430', { roughness: 0.12, metalness: 0.4 });
  const steel = M('#2b2d33', { roughness: 0.55, metalness: 0.5 });
  const rubber = M('#15161a', { roughness: 0.95 });
  const alloy = M('#c9ccd2', { roughness: 0.35, metalness: 0.6 });
  const plywood = M('#b99768', { roughness: 0.9 });
  const glow = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff3d1, emissiveIntensity: 2.2 });

  // ---------- room ----------
  const floorTex = canvasTexture(512, 512, (ctx, w, h) => {
    const r = rng(7);
    ctx.fillStyle = '#4c4f57'; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 9000; i++) {
      ctx.fillStyle = r() > 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.07)';
      ctx.fillRect(r() * w, r() * h, 1 + r() * 2, 1 + r() * 2);
    }
    ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, w - 1, h - 1);
  }, 5, 5);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(10.4, 9.4), new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.9 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, 0, 0.3);
  floor.receiveShadow = true;
  scene.add(floor);

  const wallTex = canvasTexture(256, 64, (ctx, w, h) => {
    ctx.fillStyle = '#6d717b'; ctx.fillRect(0, 0, w, h);
    const n = 8;
    for (let i = 0; i < n; i++) {
      const g = ctx.createLinearGradient(i * (w / n), 0, (i + 1) * (w / n), 0);
      g.addColorStop(0, 'rgba(255,255,255,0.16)');
      g.addColorStop(0.5, 'rgba(0,0,0,0.0)');
      g.addColorStop(1, 'rgba(0,0,0,0.22)');
      ctx.fillStyle = g; ctx.fillRect(i * (w / n), 0, w / n, h);
    }
  }, 11, 1);
  const backWall = new THREE.Mesh(new THREE.PlaneGeometry(10.4, 3.4), new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.75, metalness: 0.15 }));
  backWall.position.set(0, 1.7, -4.4);
  backWall.receiveShadow = true;
  scene.add(backWall);
  const sideTex = wallTex.clone();
  sideTex.needsUpdate = true;
  sideTex.repeat.set(10, 1);
  const leftWall = new THREE.Mesh(new THREE.PlaneGeometry(9.4, 3.4), new THREE.MeshStandardMaterial({ map: sideTex, roughness: 0.75, metalness: 0.15 }));
  leftWall.rotation.y = Math.PI / 2;
  leftWall.position.set(-5.2, 1.7, 0.3);
  leftWall.receiveShadow = true;
  scene.add(leftWall);

  box(10.4, 0.16, 0.08, M('#25272d'), 0, 0.08, -4.36, scene, false);
  box(0.08, 0.16, 9.4, M('#25272d'), -5.16, 0.08, 0.3, scene, false);

  // unit number sign
  const signTex = canvasTexture(512, 192, (ctx, w, h) => {
    ctx.fillStyle = '#ffc21a'; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#17181d'; ctx.lineWidth = 14; ctx.strokeRect(12, 12, w - 24, h - 24);
    ctx.fillStyle = '#17181d'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = '900 104px Archivo, Arial, sans-serif';
    ctx.fillText('UNIT 14', w / 2, h / 2 + 6);
  }, 1, 1, false);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.525), new THREE.MeshStandardMaterial({ map: signTex, roughness: 0.5 }));
  sign.position.set(0, 2.85, -4.36);
  scene.add(sign);

  // floor markings round the van's bay
  const line = M('#ffc21a', { roughness: 0.6 });
  box(0.1, 0.006, 7.2, line, -1.7, 0.004, 0.1, scene, false);
  box(0.1, 0.006, 7.2, line, 1.7, 0.004, 0.1, scene, false);
  box(3.5, 0.006, 0.1, line, 0, 0.004, 3.7, scene, false);

  // ceiling beams and strip lights
  [-2.4, 0.9, 4.0].forEach((z) => box(10.4, 0.2, 0.2, M('#25272d'), 0, 3.45, z, scene, false));
  [-1.0, 2.2].forEach((z) => {
    box(2.0, 0.07, 0.2, glow, 0, 3.0, z, scene, false);
    [-0.8, 0.8].forEach((x) => cyl(0.01, 0.01, 0.45, steel, x, 3.23, z, scene, 6));
  });

  // ---------- lights ----------
  scene.add(new THREE.HemisphereLight(0xdfe6ff, 0x3a3f4a, 0.85));
  const sun = new THREE.DirectionalLight(0xffffff, 1.35);
  sun.position.set(5, 9, 6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, near: 0.5, far: 30 });
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.03;
  scene.add(sun);
  [[0, 2.7, -1.0], [0, 2.7, 2.2]].forEach(([x, y, z]) => {
    const p = new THREE.PointLight(0xffeccb, 16, 11, 2);
    p.position.set(x, y, z);
    scene.add(p);
  });

  // ---------- the van ----------
  const van = new THREE.Group();
  van.position.set(0, 0, -0.3);
  scene.add(van);

  const wallPanel = (side) => {
    const faces = side < 0 ? [inner, paint, paint, paint, paint, paint] : [paint, inner, paint, paint, paint, paint];
    box(0.06, 2.0, 3.0, faces, side * 0.97, 1.5, 0.6, van);
  };
  wallPanel(-1); wallPanel(1);
  box(2.0, 0.06, 3.0, [paint, paint, paint, inner, paint, paint], 0, 2.47, 0.6, van);
  box(1.94, 0.06, 3.0, [inner, inner, plywood, M('#2b2d33'), inner, inner], 0, 0.53, 0.6, van);
  box(2.0, 2.0, 1.4, paint, 0, 1.5, -1.6, van);               // cab
  box(1.96, 0.9, 0.8, paint, 0, 0.95, -2.7, van);              // bonnet
  box(2.0, 0.24, 0.2, darkBand, 0, 0.42, -3.12, van);          // front bumper
  box(1.0, 0.34, 0.03, M('#0e0f12'), 0, 0.95, -3.11, van);     // grille
  [-1, 1].forEach((s) => {
    box(0.34, 0.17, 0.05, new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xdfe8ff, emissiveIntensity: 1.2 }), s * 0.72, 1.1, -3.1, van, false);
    box(0.04, 0.78, 1.05, glass, s * 1.01, 1.95, -1.55, van);  // cab side windows
    box(0.05, 0.05, 0.22, steel, s * 1.025, 1.6, -0.95, van);  // door handles
    box(0.1, 0.45, 0.05, new THREE.MeshStandardMaterial({ color: 0xc02a2a, emissive: 0xff2a2a, emissiveIntensity: 0.6 }), s * 0.93, 1.05, 2.13, van, false); // tail lights
  });
  box(1.8, 0.86, 0.04, glass, 0, 1.95, -2.31, van);            // windscreen
  box(2.0, 0.22, 0.2, darkBand, 0, 0.4, 2.2, van);             // rear bumper
  box(0.5, 0.13, 0.02, M('#f6e27a'), 0, 0.46, 2.311, van, false); // number plate

  // body bands
  [-1, 1].forEach((s) => {
    box(0.02, 0.28, 4.4, yellow, s * 1.011, 1.2, -0.1, van, false);
    box(0.02, 0.25, 4.4, darkBand, s * 1.011, 0.65, -0.1, van, false);
  });

  // livery
  const liveryTex = canvasTexture(1680, 540, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.save();
    ctx.translate(190, 190); ctx.rotate(-0.14);
    ctx.fillStyle = '#ffc21a';
    ctx.beginPath(); ctx.roundRect(-120, -120, 240, 240, 40); ctx.fill();
    ctx.fillStyle = '#17181d'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = '900 190px Archivo, Arial, sans-serif';
    ctx.fillText('&', 0, 14);
    ctx.restore();
    ctx.fillStyle = '#17181d'; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.font = '900 150px Archivo, Arial, sans-serif';
    ctx.fillText('Shift & Settle', 360, 210);
    ctx.font = '800 66px Archivo, Arial, sans-serif';
    ctx.fillText('We shift it. You settle in.', 364, 330);
    ctx.font = '700 52px Archivo, Arial, sans-serif';
    ctx.fillStyle = '#4a4d55';
    ctx.fillText('Houses · Offices · Shops · Art', 364, 420);
    ctx.textAlign = 'right';
    ctx.fillText('shiftandsettle.co.uk', w - 40, 500);
  }, 1, 1, false);
  [-1, 1].forEach((s) => {
    const p = new THREE.Mesh(
      new THREE.PlaneGeometry(2.85, 0.916),
      new THREE.MeshStandardMaterial({ map: liveryTex, transparent: true, roughness: 0.5, polygonOffset: true, polygonOffsetFactor: -2 })
    );
    p.rotation.y = s * Math.PI / 2;
    p.position.set(s * 1.0125, 1.9, 0.6);
    van.add(p);
  });

  // wheels
  [-1.9, 1.3].forEach((z) => [-1, 1].forEach((s) => {
    const w = new THREE.Group();
    w.position.set(s * 1.0, 0.4, z);
    w.rotation.z = Math.PI / 2;
    cyl(0.4, 0.4, 0.3, rubber, 0, 0, 0, w, 28);
    cyl(0.23, 0.23, 0.32, alloy, 0, 0, 0, w, 20);
    cyl(0.09, 0.09, 0.34, steel, 0, 0, 0, w, 12);
    van.add(w);
    const arch = cyl(0.47, 0.47, 0.03, M('#0e0f12'), s * 1.0, 0.4, z, van, 28);
    arch.rotation.z = Math.PI / 2;
    arch.castShadow = false;
  }));

  // rear doors, swung wide open
  [-1, 1].forEach((s) => {
    const hinge = new THREE.Group();
    hinge.position.set(s * 1.0, 0, 2.1);
    hinge.rotation.y = s * 1.8;
    const door = new THREE.Group();
    door.position.x = -s * 0.485;
    hinge.add(door);
    box(0.97, 1.92, 0.06, paint, 0, 1.51, 0, door);
    box(0.97, 0.28, 0.07, yellow, 0, 1.2, 0, door, false);
    box(0.5, 0.5, 0.07, glass, 0, 1.95, 0, door, false);
    box(0.05, 0.2, 0.1, steel, -s * 0.38, 1.5, 0.04, door, false);
    van.add(hinge);
  });

  // what's already loaded inside
  const load = new THREE.Group();
  van.add(load);
  carton(0.8, 0.6, 0.6, cardboard[0], load, -0.5, 0.86, -0.45);
  carton(0.7, 0.5, 0.55, cardboard[1], load, -0.5, 1.41, -0.45, 0.08);
  carton(0.8, 0.6, 0.6, cardboard[3], load, 0.45, 0.86, -0.45);
  carton(0.6, 0.55, 0.5, cardboard[2], load, 0.45, 1.43, -0.45, -0.1);
  carton(0.75, 0.55, 0.6, cardboard[4], load, 0.45, 0.83, 0.25);
  box(0.9, 0.45, 0.7, M('#4b5260', { roughness: 0.95 }), -0.45, 0.78, 0.35, load);  // blanket-wrapped piece
  box(0.92, 0.03, 0.12, yellow, -0.45, 1.01, 0.35, load, false);                     // strap
  const vanLight = new THREE.PointLight(0xfff0d6, 1.4, 4.5, 2);
  vanLight.position.set(0, 2.2, 0.8);
  van.add(vanLight);

  // ---------- sack truck with boxes, beside the back door ----------
  const truck = new THREE.Group();
  truck.position.set(2.1, 0, 3.0);
  truck.rotation.y = -0.45;
  scene.add(truck);
  [-0.2, 0.2].forEach((x) => box(0.04, 1.3, 0.04, steel, x, 0.75, 0.02, truck));
  [0.35, 0.8].forEach((y) => box(0.44, 0.035, 0.035, steel, 0, y, 0.02, truck));
  const grip = cyl(0.022, 0.022, 0.5, yellow, 0, 1.4, 0.02, truck, 12);
  grip.rotation.z = Math.PI / 2;
  [-0.2, 0.2].forEach((x) => box(0.04, 0.04, 0.04, steel, x, 1.4, 0.02, truck));
  box(0.44, 0.025, 0.36, steel, 0, 0.04, -0.17, truck);                                // toe plate
  [-0.27, 0.27].forEach((x) => {
    const wh = cyl(0.11, 0.11, 0.06, rubber, x, 0.11, 0.04, truck, 20);
    wh.rotation.z = Math.PI / 2;
  });
  carton(0.5, 0.4, 0.4, cardboard[0], truck, 0, 0.265, -0.2);
  carton(0.46, 0.36, 0.36, cardboard[3], truck, 0.01, 0.645, -0.2, 0.05);
  carton(0.4, 0.3, 0.32, cardboard[2], truck, -0.01, 0.975, -0.2, -0.06);
  box(0.035, 1.08, 0.01, yellow, 0, 0.62, -0.41, truck, false);                        // strap

  // flat four-wheel dolly with moving blankets, on the other side
  const dolly = new THREE.Group();
  dolly.position.set(-2.5, 0, 3.2);
  dolly.rotation.y = 0.35;
  scene.add(dolly);
  box(1.0, 0.07, 0.62, M('#6a4a2b', { roughness: 0.9 }), 0, 0.2, 0, dolly);
  [[-0.42, -0.25], [0.42, -0.25], [-0.42, 0.25], [0.42, 0.25]].forEach(([x, z]) => {
    const c = cyl(0.06, 0.06, 0.05, rubber, x, 0.08, z, dolly, 14);
    c.rotation.z = Math.PI / 2;
  });
  box(0.9, 0.12, 0.54, M('#4b5260', { roughness: 0.95 }), 0, 0.29, 0, dolly);
  box(0.9, 0.1, 0.54, M('#b86a2d', { roughness: 0.95 }), 0.02, 0.4, 0, dolly);
  box(0.9, 0.1, 0.54, M('#4b5260', { roughness: 0.95 }), -0.02, 0.5, 0, dolly);

  // ---------- shelving along the back wall ----------
  const r = rng(21);
  const shelfBay = (x0) => {
    const seg = 1.7, z = -4.05;
    [0, 1, 2].forEach((i) => [-0.29, 0.29].forEach((dz) => box(0.07, 2.6, 0.07, steel, x0 + i * seg, 1.3, z + dz)));
    [0.1, 0.85, 1.6, 2.35].forEach((top) => {
      [0, 1].forEach((i) => {
        const sx = x0 + i * seg;
        box(seg - 0.07, 0.07, 0.6, yellow, sx + seg / 2, top - 0.035, z);
        let cursor = sx + 0.1;
        while (cursor < sx + seg - 0.35) {
          if (r() < 0.12) { cursor += 0.3; continue; }
          const w = 0.25 + r() * 0.3, h = 0.2 + r() * 0.38, d = 0.3 + r() * 0.24;
          if (cursor + w > sx + seg - 0.08) break;
          const k = r();
          const px = cursor + w / 2, py = top + h / 2, pz = z + (r() - 0.5) * 0.06;
          if (k < 0.18) {
            box(w, h, d, M('#3b3e46', { roughness: 0.6 }), px, py, pz);
            box(w + 0.02, 0.04, d + 0.02, M('#5a5e69', { roughness: 0.6 }), px, py + h / 2 + 0.02, pz);
          } else if (k < 0.34) {
            box(w, h, d, M('#e6e7ea', { roughness: 0.85 }), px, py, pz);
            box(0.06, h + 0.006, d + 0.006, M('#ffc21a'), px, py, pz, scene, false);
          } else {
            carton(w, h, d, cardboard[Math.floor(r() * cardboard.length)], scene, px, py, pz);
          }
          cursor += w + 0.03 + r() * 0.08;
        }
      });
    });
  };
  shelfBay(1.5);
  shelfBay(-4.9);

  // fire extinguisher by the sign
  cyl(0.08, 0.08, 0.45, M('#c02a2a', { roughness: 0.4 }), -1.15, 1.15, -4.3);
  cyl(0.03, 0.03, 0.1, steel, -1.15, 1.42, -4.3, scene, 10);

  // ---------- clutter along the left wall ----------
  const mattress = box(0.18, 1.9, 1.0, M('#e8e4da', { roughness: 0.95 }), -4.9, 0.96, 1.6);
  mattress.rotation.z = 0.1;
  box(0.2, 0.04, 1.02, yellow, -4.88, 0.9, 1.6, scene, false).rotation.z = 0.1;
  const carpet = cyl(0.17, 0.17, 2.0, M('#7a4b3a', { roughness: 1 }), -4.85, 1.0, 2.55);
  carpet.rotation.z = 0.08;
  const sofa = new THREE.Group();
  sofa.position.set(-4.0, 0, 3.0);
  sofa.rotation.y = 0.06;
  scene.add(sofa);
  const blanket = M('#4b5260', { roughness: 0.95 });
  box(0.95, 0.45, 1.9, blanket, 0, 0.3, 0, sofa);
  box(0.26, 0.6, 1.9, blanket, -0.35, 0.75, 0, sofa);
  box(0.95, 0.5, 0.22, blanket, 0, 0.55, -0.84, sofa);
  box(0.95, 0.5, 0.22, blanket, 0, 0.55, 0.84, sofa);
  [-0.4, 0.4].forEach((z) => box(0.99, 0.5, 0.045, M('#2b2d33'), 0, 0.33, z, sofa, false));
  const broomStick = cyl(0.015, 0.015, 1.55, M('#a0805a'), -5.02, 0.78, -0.7, scene, 8);
  broomStick.rotation.z = 0.06;
  box(0.06, 0.05, 0.32, M('#2b2d33'), -4.93, 0.04, -0.7);

  // ---------- pallet stack and tubs on the right ----------
  const pallet = new THREE.Group();
  pallet.position.set(3.7, 0, 2.2);
  pallet.rotation.y = 0.12;
  scene.add(pallet);
  const wood = M('#a98558', { roughness: 0.95 });
  [-0.4, 0, 0.4].forEach((x) => [-0.4, 0, 0.4].forEach((z) => box(0.14, 0.1, 0.14, wood, x, 0.07, z, pallet)));
  [-0.45, -0.22, 0, 0.22, 0.45].forEach((z) => box(1.2, 0.025, 0.14, wood, 0, 0.14, z, pallet));
  [-0.4, 0, 0.4].forEach((x) => box(0.14, 0.025, 1.2, wood, x, 0.0125, 0, pallet));
  carton(0.55, 0.45, 0.5, cardboard[0], pallet, -0.3, 0.39, -0.25);
  carton(0.55, 0.45, 0.5, cardboard[1], pallet, 0.3, 0.39, -0.25, 0.04);
  carton(0.55, 0.45, 0.5, cardboard[4], pallet, -0.3, 0.39, 0.3);
  carton(0.55, 0.45, 0.5, cardboard[2], pallet, 0.3, 0.39, 0.3, -0.05);
  carton(0.5, 0.4, 0.5, cardboard[3], pallet, -0.28, 0.82, -0.25, 0.1);
  carton(0.5, 0.4, 0.5, cardboard[0], pallet, 0.3, 0.82, 0.3, -0.08);
  const wrap = box(1.22, 1.0, 1.22, new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.1, roughness: 0.2, depthWrite: false }), 0, 0.64, 0, pallet, false);
  wrap.receiveShadow = false;

  [[3.1, 3.9, 0.1], [3.15, 3.9, -0.15]].forEach(([x, z, ry], i) => {
    box(0.6, 0.38, 0.4, M('#3b3e46', { roughness: 0.6 }), x, 0.19 + i * 0.4, z).rotation.y = ry;
    box(0.62, 0.04, 0.42, M('#5a5e69', { roughness: 0.6 }), x, 0.4 + i * 0.4, z).rotation.y = ry;
  });

  // ---------- controls, resize, loop ----------
  const fit = () => {
    const w = host.clientWidth, h = host.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(Math.max(0.364, 0.647 / camera.aspect)));
    camera.updateProjectionMatrix();
  };
  fit();
  new ResizeObserver(fit).observe(host);

  const setSpin = (on) => { controls.autoRotate = on && !reduceMotion; };
  let resume = 0;
  controls.addEventListener('start', () => { setSpin(false); clearTimeout(resume); });
  controls.addEventListener('end', () => { resume = setTimeout(() => setSpin(true), 4000); });
  setSpin(true);

  host.querySelectorAll('[data-zoom]').forEach((btn) => btn.addEventListener('click', () => {
    const offset = camera.position.clone().sub(controls.target);
    const len = THREE.MathUtils.clamp(offset.length() * (btn.dataset.zoom === 'in' ? 0.8 : 1.25), controls.minDistance, controls.maxDistance);
    camera.position.copy(controls.target).add(offset.setLength(len));
  }));

  let ready = false;
  const frame = () => {
    controls.update();
    renderer.render(scene, camera);
    if (!ready) { ready = true; host.classList.add('is-ready'); }
  };
  if ('IntersectionObserver' in window) {
    new IntersectionObserver((entries) => {
      renderer.setAnimationLoop(entries.some((e) => e.isIntersecting) ? frame : null);
    }).observe(host);
  } else {
    renderer.setAnimationLoop(frame);
  }
}
