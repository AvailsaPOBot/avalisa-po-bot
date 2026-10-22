// Floating obsidian-glass rule slab for the homepage hero.
// Loaded with a dynamic import() after first paint, so three.js never sits in the startup bundle.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

export const HUD_LINE = 'MARTINGALE · STEP CAP 3 · MIN PAYOUT 80% · DEMO 10 LEFT';

const SLAB_W = 3.2;
const SLAB_H = 2.0;
const RIM = 0.09;

function roundedRectShape(width, height, radius) {
  const shape = new THREE.Shape();
  const x = -width / 2;
  const y = -height / 2;
  shape.moveTo(x + radius, y);
  shape.lineTo(x + width - radius, y);
  shape.quadraticCurveTo(x + width, y, x + width, y + radius);
  shape.lineTo(x + width, y + height - radius);
  shape.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  shape.lineTo(x + radius, y + height);
  shape.quadraticCurveTo(x, y + height, x, y + height - radius);
  shape.lineTo(x, y + radius);
  shape.quadraticCurveTo(x, y, x + radius, y);
  return shape;
}

async function fontsReady() {
  if (!document.fonts?.load) return;
  const wait = Promise.all([
    document.fonts.load('800 96px "Plus Jakarta Sans"'),
    document.fonts.load('500 30px "JetBrains Mono"'),
  ]).catch(() => {});
  await Promise.race([wait, new Promise((resolve) => setTimeout(resolve, 1500))]);
}

// Crisp HUD drawn once onto a canvas and used as a texture on the slab face.
function drawHud() {
  const canvas = document.createElement('canvas');
  canvas.width = 1600;
  canvas.height = 1000;
  const ctx = canvas.getContext('2d');
  const mono = '"JetBrains Mono", ui-monospace, monospace';
  const display = '"Plus Jakarta Sans", system-ui, sans-serif';
  const gold = '#C9A46C';
  const ivory = '#F5EFE6';
  const pad = 96;

  const sheen = ctx.createLinearGradient(0, 0, 0, 1000);
  sheen.addColorStop(0, 'rgba(255,240,210,0.07)');
  sheen.addColorStop(0.45, 'rgba(255,240,210,0.0)');
  ctx.fillStyle = sheen;
  ctx.fillRect(0, 0, 1600, 1000);

  const spaced = (px) => { if ('letterSpacing' in ctx) ctx.letterSpacing = px; };

  // Header: status dot + label, brand on the right.
  ctx.save();
  ctx.shadowColor = 'rgba(46,196,134,0.9)';
  ctx.shadowBlur = 28;
  ctx.fillStyle = '#2EC486';
  ctx.beginPath();
  ctx.arc(pad + 12, 132, 13, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.textBaseline = 'middle';
  ctx.font = `500 40px ${mono}`;
  spaced('5px');
  ctx.fillStyle = '#8FE3BE';
  ctx.fillText('READY ON DEMO', pad + 48, 134);
  ctx.textAlign = 'right';
  ctx.fillStyle = gold;
  ctx.fillText('AVALISA · RULE PANEL', 1600 - pad, 134);
  ctx.textAlign = 'left';

  const hairline = (x1, y1, x2, y2, alpha = 0.34) => {
    ctx.strokeStyle = `rgba(201,164,108,${alpha})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  };
  hairline(pad, 196, 1600 - pad, 196);

  const cells = [
    ['MODE', 'Martingale'],
    ['STEP CAP', '3'],
    ['MIN PAYOUT', '80%'],
    ['DEMO', '10 left'],
  ];
  const colW = (1600 - pad * 2) / 2;
  cells.forEach(([label, value], index) => {
    const col = index % 2;
    const row = Math.floor(index / 2);
    const x = pad + col * colW + (col ? 56 : 0);
    const y = 268 + row * 300;
    ctx.font = `500 38px ${mono}`;
    spaced('6px');
    ctx.fillStyle = gold;
    ctx.fillText(label, x, y);
    spaced('-3px');
    let size = 132;
    ctx.font = `800 ${size}px ${display}`;
    while (size > 72 && ctx.measureText(value).width > colW - 90) {
      size -= 4;
      ctx.font = `800 ${size}px ${display}`;
    }
    ctx.fillStyle = ivory;
    ctx.fillText(value, x - 4, y + 132);
  });
  hairline(pad + colW, 236, pad + colW, 790, 0.22);
  hairline(pad, 520, 1600 - pad, 520, 0.22);
  hairline(pad, 836, 1600 - pad, 836);

  ctx.font = `500 31px ${mono}`;
  spaced('3px');
  ctx.fillStyle = 'rgba(245,239,230,0.62)';
  ctx.fillText(HUD_LINE, pad, 902);
  return canvas;
}

function dustSprite() {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  const glow = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  glow.addColorStop(0, 'rgba(255,240,205,1)');
  glow.addColorStop(0.35, 'rgba(223,192,142,0.55)');
  glow.addColorStop(1, 'rgba(223,192,142,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, 64, 64);
  return canvas;
}

/**
 * Mounts the slab into `host`. Resolves to a dispose() function.
 * Rendering pauses whenever the host is off-screen or the tab is hidden.
 */
export async function mountSlab(host, { onReady } = {}) {
  await fontsReady();

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  renderer.setClearColor(0x000000, 0);
  const canvas = renderer.domElement;
  canvas.setAttribute('aria-hidden', 'true');
  host.appendChild(canvas);

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const envTexture = pmrem.fromScene(room, 0.04).texture;
  scene.environment = envTexture;
  room.dispose?.();

  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 60);
  camera.position.set(0, 0, 7.1);

  scene.add(new THREE.HemisphereLight(0xfff3dc, 0x090807, 0.9));
  const key = new THREE.DirectionalLight(0xffe6ba, 2.6);
  key.position.set(4, 6, 5);
  scene.add(key);
  const rim = new THREE.PointLight(0x2ec486, 0.9, 10);
  rim.position.set(-3.5, -1.5, -1.5);
  scene.add(rim);
  const back = new THREE.DirectionalLight(0xc9a46c, 2.0);
  back.position.set(0, 3, -5);
  scene.add(back);

  const disposables = [];
  const keep = (thing) => { disposables.push(thing); return thing; };

  const slab = new THREE.Group();
  scene.add(slab);

  // Brushed champagne-gold bezel: a rounded ring with a bevelled edge.
  const outer = roundedRectShape(SLAB_W, SLAB_H, 0.2);
  outer.holes.push(roundedRectShape(SLAB_W - RIM * 2, SLAB_H - RIM * 2, 0.13));
  const bezelGeometry = keep(new THREE.ExtrudeGeometry(outer, {
    depth: 0.12, bevelEnabled: true, bevelThickness: 0.025, bevelSize: 0.022, bevelSegments: 4, curveSegments: 18,
  }));
  bezelGeometry.translate(0, 0, -0.06);
  const goldMaterial = keep(new THREE.MeshPhysicalMaterial({
    color: 0xb48c52, metalness: 1, roughness: 0.24, anisotropy: 0.8, anisotropyRotation: Math.PI / 2, clearcoat: 0.4, clearcoatRoughness: 0.18, envMapIntensity: 1.1,
  }));
  slab.add(new THREE.Mesh(bezelGeometry, goldMaterial));

  // Obsidian glass body.
  const glassGeometry = keep(new RoundedBoxGeometry(SLAB_W - RIM * 2 + 0.02, SLAB_H - RIM * 2 + 0.02, 0.1, 5, 0.05));
  const glassMaterial = keep(new THREE.MeshPhysicalMaterial({
    color: 0x16120e, metalness: 0, roughness: 0.15, transmission: 0.45, thickness: 0.5, ior: 1.5,
    clearcoat: 1, clearcoatRoughness: 0.06, specularIntensity: 1, envMapIntensity: 1.35,
    attenuationColor: new THREE.Color(0x2a2016), attenuationDistance: 0.9,
  }));
  slab.add(new THREE.Mesh(glassGeometry, glassMaterial));

  // HUD face.
  const hudTexture = keep(new THREE.CanvasTexture(drawHud()));
  hudTexture.colorSpace = THREE.SRGBColorSpace;
  hudTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();
  const hudGeometry = keep(new THREE.PlaneGeometry(SLAB_W - RIM * 2 - 0.08, (SLAB_W - RIM * 2 - 0.08) / 1.6));
  const hudMaterial = keep(new THREE.MeshBasicMaterial({ map: hudTexture, transparent: true, toneMapped: false, depthWrite: false }));
  const hud = new THREE.Mesh(hudGeometry, hudMaterial);
  hud.position.z = 0.056;
  slab.add(hud);

  // ~150 slow gold dust motes.
  const COUNT = 150;
  const positions = new Float32Array(COUNT * 3);
  const drift = new Float32Array(COUNT * 2);
  for (let i = 0; i < COUNT; i += 1) {
    positions[i * 3] = (Math.random() - 0.5) * 7.5;
    positions[i * 3 + 1] = (Math.random() - 0.5) * 5;
    positions[i * 3 + 2] = -2.5 + Math.random() * 4;
    drift[i * 2] = 0.04 + Math.random() * 0.08;
    drift[i * 2 + 1] = Math.random() * Math.PI * 2;
  }
  const dustGeometry = keep(new THREE.BufferGeometry());
  dustGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const dustTexture = keep(new THREE.CanvasTexture(dustSprite()));
  const dustMaterial = keep(new THREE.PointsMaterial({
    color: 0xdfc08e, map: dustTexture, size: 0.07, sizeAttenuation: true, transparent: true, opacity: 0.7,
    depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  const dust = new THREE.Points(dustGeometry, dustMaterial);
  scene.add(dust);

  // Sizing.
  const resize = () => {
    const width = Math.max(1, host.clientWidth);
    const height = Math.max(1, host.clientHeight);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };
  resize();
  const resizeObserver = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
  resizeObserver?.observe(host);

  // Pointer parallax.
  const mouse = { tx: 0, ty: 0, x: 0, y: 0 };
  const onPointer = (event) => {
    mouse.tx = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.ty = (event.clientY / window.innerHeight) * 2 - 1;
  };
  window.addEventListener('pointermove', onPointer, { passive: true });

  // Run only while visible.
  let onScreen = true;
  let frame = 0;
  let last = performance.now();
  let elapsed = 0;
  let readySent = false;

  const render = (now) => {
    frame = 0;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    elapsed += dt;
    const follow = 1 - Math.exp(-dt * 4);
    mouse.x += (mouse.tx - mouse.x) * follow;
    mouse.y += (mouse.ty - mouse.y) * follow;

    slab.position.y = Math.sin(elapsed * 0.7) * 0.08;
    slab.rotation.y = -0.4 + mouse.x * 0.24 + Math.sin(elapsed * 0.35) * 0.03;
    slab.rotation.x = 0.12 + mouse.y * 0.14;
    slab.rotation.z = -0.05 + Math.sin(elapsed * 0.5) * 0.015;
    key.position.set(4 + mouse.x * 2.5, 6 - mouse.y * 2, 5);

    const p = dustGeometry.attributes.position.array;
    for (let i = 0; i < COUNT; i += 1) {
      p[i * 3 + 1] += drift[i * 2] * dt;
      p[i * 3] += Math.sin(elapsed * 0.4 + drift[i * 2 + 1]) * 0.0015;
      if (p[i * 3 + 1] > 2.6) p[i * 3 + 1] = -2.6;
    }
    dustGeometry.attributes.position.needsUpdate = true;
    dust.rotation.y = mouse.x * 0.06;

    renderer.render(scene, camera);
    if (!readySent) {
      readySent = true;
      onReady?.();
    }
    schedule();
  };
  const schedule = () => {
    if (frame || !onScreen || document.hidden) return;
    frame = requestAnimationFrame(render);
  };
  const stop = () => { if (frame) cancelAnimationFrame(frame); frame = 0; };

  const intersection = typeof IntersectionObserver !== 'undefined'
    ? new IntersectionObserver(([entry]) => {
      onScreen = entry.isIntersecting;
      if (onScreen) { last = performance.now(); schedule(); } else stop();
    })
    : null;
  intersection?.observe(host);
  const onVisibility = () => {
    if (document.hidden) stop();
    else { last = performance.now(); schedule(); }
  };
  document.addEventListener('visibilitychange', onVisibility);
  schedule();

  return function dispose() {
    stop();
    intersection?.disconnect();
    resizeObserver?.disconnect();
    window.removeEventListener('pointermove', onPointer);
    document.removeEventListener('visibilitychange', onVisibility);
    disposables.forEach((thing) => thing.dispose());
    envTexture.dispose();
    pmrem.dispose();
    renderer.dispose();
    renderer.forceContextLoss?.();
    canvas.remove();
  };
}
