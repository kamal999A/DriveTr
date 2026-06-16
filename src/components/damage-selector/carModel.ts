// src/components/damage-selector/carModel.ts
//
// Builds the 3-D sedan for the damage selector.
//
// The old model was assembled from flat BoxGeometry blocks, which read as
// "toy blocks" rather than a car. This version builds the body from smooth
// extruded 2-D profiles (THREE.Shape + ExtrudeGeometry with bevels), the same
// technique real stylised car configurators use:
//
//   • one curved side-profile extrusion for the body shell (with real wheel
//     arches cut out of the silhouette)
//   • separate, slightly-proud extruded panels for every clickable part
//     (hood, doors, fenders, bumpers, roof, glass) so the part logic,
//     raycasting and damage-colouring all keep working unchanged
//
// Coordinate system (unchanged from the old model so all the PARTS camera
// positions still frame correctly):  front = +X, left = −Z, ground = y 0.
// Car is ~5.0 units long, ~1.76 wide, roof at ~1.5.

import * as THREE from 'three';

export const PAINT = 0x1b3a5c;

type Register = (name: string, mesh: THREE.Mesh) => void;

// ── Materials ────────────────────────────────────────────────────────────────
function makeMaterials() {
  // Car paint: metallic base + clearcoat. MeshPhysicalMaterial extends
  // MeshStandardMaterial, so refreshColors() (color/emissive/roughness)
  // keeps working on it untouched.
  const paint = () =>
    new THREE.MeshPhysicalMaterial({
      color: PAINT,
      metalness: 0.75,
      roughness: 0.32,
      clearcoat: 1.0,
      clearcoatRoughness: 0.06,
      envMapIntensity: 1.1,
    });

  const glass = () =>
    new THREE.MeshStandardMaterial({
      color: 0x5d7fa6,
      roughness: 0.05,
      metalness: 0.15,
      transparent: true,
      opacity: 0.55,
      envMapIntensity: 1.6,
    });

  const plastic = (c = 0x0e1c2a, r = 0.6) =>
    new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: 0.25, envMapIntensity: 0.7 });

  const chrome = () =>
    new THREE.MeshStandardMaterial({ color: 0xd8dde2, roughness: 0.08, metalness: 0.95, envMapIntensity: 1.4 });

  return { paint, glass, plastic, chrome };
}

// ── Shape helpers ────────────────────────────────────────────────────────────

/** Append a wheel-arch cutout while tracing the bottom edge left→right. */
function archCut(shape: THREE.Shape, cx: number, cy: number, r: number, yBottom: number) {
  const dx = Math.sqrt(r * r - (cy - yBottom) * (cy - yBottom));
  const a = Math.atan2(yBottom - cy, dx); // negative angle of the exit point
  shape.lineTo(cx - dx, yBottom);
  shape.absarc(cx, cy, r, Math.PI - a, a, true); // travel over the top of the wheel
}

function extrude(
  shape: THREE.Shape,
  depth: number,
  bevel: number,
  material: THREE.Material,
  opts: { curveSegments?: number; bevelSegments?: number } = {},
) {
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelOffset: -bevel * 0.4,
    bevelSegments: opts.bevelSegments ?? 4,
    curveSegments: opts.curveSegments ?? 24,
  });
  geo.translate(0, 0, -depth / 2); // centre on z = 0
  const mesh = new THREE.Mesh(geo, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/** Rounded-corner rectangle (for door / fender panels). */
function roundedRect(x0: number, y0: number, x1: number, y1: number, r: number) {
  const s = new THREE.Shape();
  s.moveTo(x0 + r, y0);
  s.lineTo(x1 - r, y0);
  s.quadraticCurveTo(x1, y0, x1, y0 + r);
  s.lineTo(x1, y1 - r);
  s.quadraticCurveTo(x1, y1, x1 - r, y1);
  s.lineTo(x0 + r, y1);
  s.quadraticCurveTo(x0, y1, x0, y1 - r);
  s.lineTo(x0, y0 + r);
  s.quadraticCurveTo(x0, y0, x0 + r, y0);
  return s;
}

// ── Model ────────────────────────────────────────────────────────────────────
export function buildCarModel(meshMap: Map<string, THREE.Mesh>): THREE.Group {
  const root = new THREE.Group();
  const M = makeMaterials();

  const register: Register = (name, mesh) => {
    mesh.name = name;
    meshMap.set(name, mesh);
  };

  const FRONT_AXLE = 1.58;
  const REAR_AXLE = -1.52;
  const WHEEL_Y = 0.34;

  // ── Body shell (single smooth side-profile extrusion) ──
  {
    const s = new THREE.Shape();
    s.moveTo(2.36, 0.16);                              // front lower lip
    s.quadraticCurveTo(2.56, 0.20, 2.57, 0.45);        // bumper face (near vertical)
    s.quadraticCurveTo(2.56, 0.64, 2.40, 0.76);        // nose top curve
    s.quadraticCurveTo(1.62, 0.95, 0.92, 1.03);        // hood line
    s.quadraticCurveTo(-0.10, 1.12, -1.05, 1.06);      // beltline arc under cabin
    s.quadraticCurveTo(-1.80, 1.00, -2.16, 0.92);      // trunk deck
    s.quadraticCurveTo(-2.49, 0.87, -2.50, 0.55);      // Kamm tail face
    s.quadraticCurveTo(-2.50, 0.26, -2.34, 0.16);      // rear lower lip
    // bottom edge, rear → front, with the two wheel arches
    archCut(s, REAR_AXLE, 0.30, 0.465, 0.16);
    archCut(s, FRONT_AXLE, 0.30, 0.465, 0.16);
    s.lineTo(2.36, 0.16);

    const body = extrude(s, 1.46, 0.09, M.paint(), { curveSegments: 36, bevelSegments: 5 });
    root.add(body);
  }

  // ── Rocker sill (dark side-skirt band along the bottom) ──
  {
    const sill = new THREE.Mesh(new THREE.BoxGeometry(2.00, 0.09, 1.66), M.plastic(0x080d14, 0.8));
    sill.position.set(0.03, 0.14, 0);
    root.add(sill);
  }

  // ── Greenhouse ──
  // Side glass band (the whole cabin side is glass; pillars overlay it)
  {
    const s = new THREE.Shape();
    s.moveTo(0.88, 1.02);
    s.lineTo(0.42, 1.40);
    s.quadraticCurveTo(-0.22, 1.50, -0.92, 1.39);
    s.lineTo(-1.48, 1.02);
    s.lineTo(0.88, 1.02);
    const dlo = extrude(s, 1.24, 0.02, M.glass());
    root.add(dlo);
  }

  // Windshield (clickable)
  {
    const s = new THREE.Shape();
    s.moveTo(0.92, 1.01);
    s.lineTo(0.40, 1.445);
    s.lineTo(0.54, 1.468);
    s.lineTo(1.06, 1.03);
    s.lineTo(0.92, 1.01);
    const ws = extrude(s, 1.14, 0.04, M.glass());
    register('windshield', ws);
    root.add(ws);
  }

  // Roof (clickable, painted)
  {
    const s = new THREE.Shape();
    s.moveTo(0.48, 1.40);
    s.quadraticCurveTo(-0.22, 1.505, -0.90, 1.40);
    s.lineTo(-0.95, 1.462);
    s.quadraticCurveTo(-0.22, 1.567, 0.53, 1.462);
    s.lineTo(0.48, 1.40);
    const roof = extrude(s, 1.16, 0.05, M.paint());
    register('roof', roof);
    root.add(roof);
  }

  // Rear windshield (clickable)
  {
    const s = new THREE.Shape();
    s.moveTo(-0.90, 1.40);
    s.lineTo(-1.52, 1.005);
    s.lineTo(-1.66, 1.025);
    s.lineTo(-1.04, 1.44);
    s.lineTo(-0.90, 1.40);
    const rw = extrude(s, 1.14, 0.04, M.glass());
    register('rear_windshield', rw);
    root.add(rw);
  }

  // Pillars (painted strips laid over the glass band, both sides)
  {
    const pillar = (
      len: number, x: number, y: number, angle: number, thick = 0.085,
    ) => {
      for (const sz of [-1, 1]) {
        const p = new THREE.Mesh(new THREE.BoxGeometry(len, thick, 0.05), M.paint());
        p.position.set(x, y, sz * 0.645);
        p.rotation.z = angle;
        p.castShadow = true;
        root.add(p);
      }
    };
    pillar(0.66, 0.66, 1.215, Math.atan2(0.38, -0.46) - Math.PI); // A-pillar
    pillar(0.46, -0.20, 1.225, Math.PI / 2 - 0.06, 0.07);          // B-pillar
    pillar(0.86, -1.19, 1.21, Math.atan2(0.385, 0.58), 0.115);     // C-pillar
  }

  // ── Hood (clickable, sits proud between the fenders — real shutline) ──
  {
    const s = new THREE.Shape();
    s.moveTo(2.34, 0.80);
    s.quadraticCurveTo(1.60, 0.975, 0.92, 1.045);
    s.lineTo(0.92, 1.095);
    s.quadraticCurveTo(1.60, 1.025, 2.34, 0.85);
    s.lineTo(2.34, 0.80);
    const hood = extrude(s, 1.36, 0.05, M.paint(), { curveSegments: 24 });
    register('hood', hood);
    root.add(hood);
  }

  // ── Trunk lid (clickable) ──
  {
    const s = new THREE.Shape();
    s.moveTo(-1.02, 1.045);
    s.quadraticCurveTo(-1.80, 0.99, -2.22, 0.90);
    s.lineTo(-2.22, 0.955);
    s.quadraticCurveTo(-1.80, 1.045, -1.02, 1.10);
    s.lineTo(-1.02, 1.045);
    const trunk = extrude(s, 1.36, 0.05, M.paint());
    register('trunk', trunk);
    root.add(trunk);
  }

  // ── Bumpers (clickable, wrap the nose / tail slightly wider than the body) ──
  {
    const fb = new THREE.Shape();
    fb.moveTo(2.42, 0.13);
    fb.quadraticCurveTo(2.62, 0.18, 2.63, 0.45);
    fb.quadraticCurveTo(2.62, 0.60, 2.50, 0.70);
    fb.lineTo(2.45, 0.645);
    fb.quadraticCurveTo(2.56, 0.56, 2.56, 0.45);
    fb.quadraticCurveTo(2.55, 0.22, 2.37, 0.18);
    fb.lineTo(2.42, 0.13);
    const front = extrude(fb, 1.62, 0.02, M.paint());
    register('front_bumper', front);
    root.add(front);

    const rb = new THREE.Shape();
    rb.moveTo(-2.34, 0.10);
    rb.quadraticCurveTo(-2.54, 0.155, -2.54, 0.42);
    rb.quadraticCurveTo(-2.54, 0.60, -2.41, 0.70);
    rb.lineTo(-2.36, 0.645);
    rb.quadraticCurveTo(-2.47, 0.565, -2.47, 0.42);
    rb.quadraticCurveTo(-2.47, 0.195, -2.29, 0.155);
    rb.lineTo(-2.34, 0.10);
    const rear = extrude(rb, 1.62, 0.02, M.plastic(0x14181f, 0.55));
    register('rear_bumper', rear);
    root.add(rear);
  }

  // ── Side panels: doors + fenders (clickable, proud of the body side) ──
  {
    // The flat region of the body side ends around |z| ≈ 0.79 before the
    // bevel rounds off — panels sit just proud of that for a visible shutline.
    const PANEL_Z = 0.815;
    const PANEL_DEPTH = 0.012;

    const sidePanel = (shape: THREE.Shape, name: string, side: 1 | -1) => {
      const mesh = extrude(shape, PANEL_DEPTH, 0.034, M.paint(), { curveSegments: 32, bevelSegments: 7 });
      mesh.position.z = side * PANEL_Z;
      register(name, mesh);
      root.add(mesh);
    };

    // Doors — rounded rectangles up to the beltline
    const frontDoor = roundedRect(-0.16, 0.21, 1.04, 0.99, 0.13);
    const rearDoor = roundedRect(-1.18, 0.21, -0.22, 0.99, 0.13);

    // Fenders — rounded rectangles with the wheel arch carved out
    const fenderShape = (x0: number, x1: number, cx: number) => {
      const r = 0.46, cy = 0.30, yb = 0.21, corner = 0.12;
      const dx = Math.sqrt(r * r - (cy - yb) * (cy - yb));
      const a = Math.atan2(yb - cy, dx);
      const s = new THREE.Shape();
      s.moveTo(x0 + corner, yb);
      s.lineTo(cx - dx, yb);
      s.absarc(cx, cy, r, Math.PI - a, a, true);
      s.lineTo(x1 - corner, yb);
      s.quadraticCurveTo(x1, yb, x1, yb + corner);
      s.lineTo(x1, 0.93 - corner);
      s.quadraticCurveTo(x1, 0.93, x1 - corner, 0.93);
      s.lineTo(x0 + corner, 0.93);
      s.quadraticCurveTo(x0, 0.93, x0, 0.93 - corner);
      s.lineTo(x0, yb + corner);
      s.quadraticCurveTo(x0, yb, x0 + corner, yb);
      return s;
    };
    const frontFender = fenderShape(1.08, 2.20, FRONT_AXLE);
    const rearFender = fenderShape(-2.24, -1.10, REAR_AXLE);

    sidePanel(frontDoor, 'front_left_door', -1);
    sidePanel(frontDoor.clone(), 'front_right_door', 1);
    sidePanel(rearDoor, 'rear_left_door', -1);
    sidePanel(rearDoor.clone(), 'rear_right_door', 1);
    sidePanel(frontFender, 'front_left_fender', -1);
    sidePanel(frontFender.clone(), 'front_right_fender', 1);
    sidePanel(rearFender, 'rear_left_fender', -1);
    sidePanel(rearFender.clone(), 'rear_right_fender', 1);
  }

  // ── Door handles ──
  {
    const handleGeo = new THREE.CapsuleGeometry(0.018, 0.13, 4, 10);
    for (const [px, side] of [[0.62, -1], [0.62, 1], [-0.40, -1], [-0.40, 1]] as [number, number][]) {
      const h = new THREE.Mesh(handleGeo, M.chrome());
      h.rotation.z = Math.PI / 2;
      h.position.set(px, 0.885, side * 0.86);
      root.add(h);
    }
  }

  // ── Mirrors (clickable) ──
  {
    for (const [side, name] of [[-1, 'left_mirror'], [1, 'right_mirror']] as [number, string][]) {
      // stalk
      const stalk = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.045, 0.30), M.paint());
      stalk.position.set(0.72, 1.06, side * 0.80);
      stalk.castShadow = true;
      root.add(stalk);
      // housing — rounded capsule shell
      const housing = new THREE.Mesh(new THREE.SphereGeometry(0.085, 18, 14), M.paint());
      housing.scale.set(1.15, 0.62, 1.45);
      housing.position.set(0.70, 1.10, side * 0.945);
      housing.castShadow = true;
      register(name, housing);
      root.add(housing);
    }
  }

  // ── Grille + lower intake ──
  {
    const grille = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.205, 0.74), M.plastic(0x05090e, 0.85));
    grille.position.set(2.605, 0.46, 0);
    root.add(grille);
    // horizontal chrome slats
    for (const gy of [0.41, 0.47, 0.53]) {
      const slat = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.014, 0.70), M.chrome());
      slat.position.set(2.635, gy, 0);
      root.add(slat);
    }
    const intake = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.13, 1.20), M.plastic(0x05090e, 0.9));
    intake.position.set(2.56, 0.175, 0);
    root.add(intake);
    const rearValance = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.12, 1.20), M.plastic(0x05090e, 0.9));
    rearValance.position.set(-2.50, 0.17, 0);
    root.add(rearValance);
  }

  // ── Headlights (slim wedges hugging the nose corners) ──
  {
    const lensMat = new THREE.MeshStandardMaterial({
      color: 0xeef4ff, roughness: 0.05, metalness: 0.1,
      emissive: 0xcfe0ff, emissiveIntensity: 0.35,
    });
    const drlMat = new THREE.MeshStandardMaterial({
      color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 2.2, roughness: 0,
    });
    for (const side of [-1, 1]) {
      const housing = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.075, 0.42), M.plastic(0x0a0f16, 0.3));
      housing.position.set(2.525, 0.655, side * 0.485);
      housing.rotation.y = -side * 0.20;
      root.add(housing);

      const lens = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.048, 0.38), lensMat);
      lens.position.set(2.563, 0.655, side * 0.482);
      lens.rotation.y = -side * 0.20;
      root.add(lens);

      const drl = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.013, 0.40), drlMat);
      drl.position.set(2.567, 0.692, side * 0.485);
      drl.rotation.y = -side * 0.20;
      root.add(drl);
    }
  }

  // ── Tail lights + full-width light bar ──
  {
    const tailMat = new THREE.MeshStandardMaterial({
      color: 0xbb0000, roughness: 0.12, emissive: 0x880000, emissiveIntensity: 0.7,
    });
    const barMat = new THREE.MeshStandardMaterial({
      color: 0xff2200, emissive: 0xff1a00, emissiveIntensity: 1.6, roughness: 0.05,
    });
    for (const side of [-1, 1]) {
      const tl = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.10, 0.40), tailMat);
      tl.position.set(-2.46, 0.80, side * 0.56);
      tl.rotation.y = side * 0.22;
      root.add(tl);
    }
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.04, 1.26), barMat);
    bar.position.set(-2.49, 0.815, 0);
    root.add(bar);
  }

  // ── License plates ──
  {
    const plateMat = new THREE.MeshStandardMaterial({ color: 0xe8e8e8, roughness: 0.5, metalness: 0.05 });
    const fp = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.115, 0.46), plateMat);
    fp.position.set(2.625, 0.31, 0);
    root.add(fp);
    const rp = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.115, 0.46), plateMat);
    rp.position.set(-2.575, 0.33, 0);
    root.add(rp);
  }

  // ── Wheels (clickable tread + torus shoulders + alloy rim) ──
  {
    const tireMat = new THREE.MeshStandardMaterial({ color: 0x131313, roughness: 0.95, metalness: 0 });
    const rimMat = new THREE.MeshStandardMaterial({ color: 0xd4d8dd, roughness: 0.10, metalness: 0.95, envMapIntensity: 1.4 });
    const spokeMat = new THREE.MeshStandardMaterial({ color: 0xc4c9cf, roughness: 0.14, metalness: 0.92 });
    const capMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.4, metalness: 0.7 });
    const discMat = new THREE.MeshStandardMaterial({ color: 0x707070, roughness: 0.45, metalness: 0.85 });
    const calMat = new THREE.MeshStandardMaterial({ color: 0xcc1100, roughness: 0.3, metalness: 0.5 });

    const treadGeo = new THREE.CylinderGeometry(0.345, 0.345, 0.20, 40);
    const shoulderGeo = new THREE.TorusGeometry(0.27, 0.082, 14, 40);
    const rimGeo = new THREE.CylinderGeometry(0.235, 0.235, 0.165, 32);
    const spokeGeo = new THREE.BoxGeometry(0.052, 0.185, 0.030);
    const capGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.175, 16);
    const discGeo = new THREE.CylinderGeometry(0.165, 0.165, 0.018, 28);

    for (const wp of [
      { x: FRONT_AXLE, side: -1, name: 'front_left_wheel' },
      { x: FRONT_AXLE, side: 1, name: 'front_right_wheel' },
      { x: REAR_AXLE, side: -1, name: 'rear_left_wheel' },
      { x: REAR_AXLE, side: 1, name: 'rear_right_wheel' },
    ] as const) {
      const wg = new THREE.Group();
      wg.position.set(wp.x, WHEEL_Y, wp.side * 0.74);

      // Tread — the clickable mesh (full disc, easy raycast target)
      const tread = new THREE.Mesh(treadGeo, tireMat);
      tread.rotation.x = Math.PI / 2;
      tread.castShadow = true;
      register(wp.name, tread);
      wg.add(tread);

      // Rounded shoulders
      const shoulder = new THREE.Mesh(shoulderGeo, tireMat);
      wg.add(shoulder);

      // Dark rim barrel (recessed) — gives the bright spokes contrast
      const barrel = new THREE.Mesh(rimGeo, M.plastic(0x14161a, 0.6));
      barrel.rotation.x = Math.PI / 2;
      barrel.position.z = wp.side * -0.01;
      wg.add(barrel);
      // Bright rim lip
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.235, 0.018, 10, 36), rimMat);
      rim.position.z = wp.side * 0.085;
      wg.add(rim);

      // 5 spokes
      for (let sp = 0; sp < 5; sp++) {
        const a = (sp / 5) * Math.PI * 2;
        const spoke = new THREE.Mesh(spokeGeo, spokeMat);
        spoke.position.set(Math.cos(a) * 0.105, Math.sin(a) * 0.105, wp.side * 0.085);
        spoke.rotation.z = a + Math.PI / 2;
        wg.add(spoke);
      }

      // Centre cap
      const cap = new THREE.Mesh(capGeo, capMat);
      cap.rotation.x = Math.PI / 2;
      cap.position.z = wp.side * 0.02;
      wg.add(cap);

      // Brake disc + caliper behind the spokes
      const disc = new THREE.Mesh(discGeo, discMat);
      disc.rotation.x = Math.PI / 2;
      disc.position.z = wp.side * -0.04;
      wg.add(disc);
      const cal = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.11, 0.05), calMat);
      cal.position.set(0, 0.16, wp.side * -0.02);
      wg.add(cal);

      root.add(wg);
    }
  }

  // ── Exhaust tips ──
  {
    const exGeo = new THREE.CylinderGeometry(0.032, 0.036, 0.10, 18);
    for (const pz of [-0.40, 0.40]) {
      const ex = new THREE.Mesh(exGeo, M.chrome());
      ex.rotation.z = Math.PI / 2;
      ex.position.set(-2.46, 0.17, pz);
      root.add(ex);
    }
  }

  // ── Shark-fin antenna ──
  {
    const fin = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.10, 10), M.plastic(0x0a0f16, 0.4));
    fin.scale.set(2.4, 1, 0.7);
    fin.position.set(-0.78, 1.52, 0);
    root.add(fin);
  }

  return root;
}
