'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { buildCarModel } from './carModel';
import { useI18n } from '@/lib/i18n';
import type { DamagedPart } from '@/types';

const PARTS = [
  { id: 'hood',               mesh: 'hood',               cam: [ 4.5, 2.5,  0  ], look: [ 1.6,  1.0,  0   ] },
  { id: 'front_bumper',       mesh: 'front_bumper',       cam: [ 5.5, 1.4,  0  ], look: [ 2.3,  0.4,  0   ] },
  { id: 'windshield',         mesh: 'windshield',         cam: [ 3.5, 3.0,  0  ], look: [ 0.78, 1.2,  0   ] },
  { id: 'roof',               mesh: 'roof',               cam: [ 0,   4.5,  2.0], look: [-0.18, 1.38, 0   ] },
  { id: 'rear_windshield',    mesh: 'rear_windshield',    cam: [-3.5, 3.0,  0  ], look: [-0.78, 1.2,  0   ] },
  { id: 'trunk',              mesh: 'trunk',              cam: [-5.0, 2.5,  0  ], look: [-1.6,  1.0,  0   ] },
  { id: 'rear_bumper',        mesh: 'rear_bumper',        cam: [-5.5, 1.4,  0  ], look: [-2.3,  0.4,  0   ] },
  { id: 'front_left_door',    mesh: 'front_left_door',    cam: [ 0.38,1.8, -4.5], look: [ 0.38, 0.68, -0.88] },
  { id: 'rear_left_door',     mesh: 'rear_left_door',     cam: [-0.62,1.8, -4.5], look: [-0.62, 0.68, -0.88] },
  { id: 'front_left_fender',  mesh: 'front_left_fender',  cam: [ 1.55,2.0, -4.5], look: [ 1.55, 0.86, -0.85] },
  { id: 'rear_left_fender',   mesh: 'rear_left_fender',   cam: [-1.55,2.0, -4.5], look: [-1.55, 0.86, -0.85] },
  { id: 'left_mirror',        mesh: 'left_mirror',        cam: [ 0.66,2.2, -3.8], look: [ 0.66, 1.12, -0.88] },
  { id: 'front_left_wheel',   mesh: 'front_left_wheel',   cam: [ 1.58,1.0, -4.5], look: [ 1.58, 0.34, -0.89] },
  { id: 'rear_left_wheel',    mesh: 'rear_left_wheel',    cam: [-1.52,1.0, -4.5], look: [-1.52, 0.34, -0.89] },
  { id: 'front_right_door',   mesh: 'front_right_door',   cam: [ 0.38,1.8,  4.5], look: [ 0.38, 0.68,  0.88] },
  { id: 'rear_right_door',    mesh: 'rear_right_door',    cam: [-0.62,1.8,  4.5], look: [-0.62, 0.68,  0.88] },
  { id: 'front_right_fender', mesh: 'front_right_fender', cam: [ 1.55,2.0,  4.5], look: [ 1.55, 0.86,  0.85] },
  { id: 'rear_right_fender',  mesh: 'rear_right_fender',  cam: [-1.55,2.0,  4.5], look: [-1.55, 0.86,  0.85] },
  { id: 'right_mirror',       mesh: 'right_mirror',       cam: [ 0.66,2.2,  3.8], look: [ 0.66, 1.12,  0.88] },
  { id: 'front_right_wheel',  mesh: 'front_right_wheel',  cam: [ 1.58,1.0,  4.5], look: [ 1.58, 0.34,  0.89] },
  { id: 'rear_right_wheel',   mesh: 'rear_right_wheel',   cam: [-1.52,1.0,  4.5], look: [-1.52, 0.34,  0.89] },
] as const;

const PAINT   = 0x1b3a5c;
const DAMAGED = 0xdd1111;

interface Props {
  value: DamagedPart[];
  onChange: (parts: DamagedPart[]) => void;
  readOnly?: boolean;
}

export default function CarDamageSelector({ value, onChange, readOnly = false }: Props) {
  const { t } = useI18n();
  const dm = t.damage;

  // Three.js refs — never change after init
  const mountRef    = useRef<HTMLDivElement>(null);
  const cameraRef   = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const meshMapRef  = useRef<Map<string, THREE.Mesh>>(new Map());
  const frameRef    = useRef<number>(0);
  const flyRef      = useRef<number | null>(null);

  // Keep latest value accessible inside rAF without re-running effects
  const valueRef = useRef(value);
  valueRef.current = value;

  const [hovered, setHovered] = useState<string | null>(null);
  const [toast,   setToast]   = useState<string | null>(null);

  const getLabel = useCallback((id: string) =>
    ((dm.parts_list as Record<string, string>)[id] ?? id), [dm]);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2000);
  }, []);

  // ── Colour all meshes based on current damaged set ────────────────────────
  const refreshColors = useCallback((damagedSet: Set<string>) => {
    meshMapRef.current.forEach((mesh, name) => {
      const mat = mesh.material as THREE.MeshStandardMaterial;
      if (!mat?.color) return;
      const part = PARTS.find(p => p.mesh === name);
      if (!part) return;
      const isDmg    = damagedSet.has(part.id);
      const isGlass  = name === 'windshield' || name === 'rear_windshield';
      const isWheel  = name.includes('wheel');
      if (isDmg) {
        mat.color.setHex(DAMAGED);
        mat.emissive?.setHex(0x880000);
        mat.emissiveIntensity = 0.7;
        mat.roughness = 0.65;
      } else {
        mat.color.setHex(isGlass ? 0x5d7fa6 : isWheel ? 0x131313 : PAINT);
        mat.emissive?.setHex(0x000000);
        mat.emissiveIntensity = 0;
        mat.roughness = isWheel ? 0.95 : isGlass ? 0.05 : 0.32;
      }
      mat.needsUpdate = true;
    });
  }, []);

  // Run refreshColors every time value changes
  useEffect(() => {
    refreshColors(new Set(value.map(p => p.id)));
  }, [value, refreshColors]);

  // ── Camera fly-to ─────────────────────────────────────────────────────────
  // Uses ONLY refs — no closures over React state, completely stable
  const flyTo = useCallback((id: string) => {
    const part = PARTS.find(p => p.id === id);
    const cam  = cameraRef.current;
    const ctrl = controlsRef.current;
    if (!part || !cam || !ctrl) return;

    if (flyRef.current !== null) cancelAnimationFrame(flyRef.current);

    const startPos    = cam.position.clone();
    const startTarget = ctrl.target.clone();
    const endPos      = new THREE.Vector3(part.cam[0], part.cam[1], part.cam[2]);
    const endTarget   = new THREE.Vector3(part.look[0], part.look[1], part.look[2]);

    ctrl.autoRotate = false;

    const startTime = performance.now();
    const duration  = 800;

    const tick = () => {
      const elapsed = performance.now() - startTime;
      const t       = Math.min(elapsed / duration, 1);
      // ease-out cubic
      const e = 1 - Math.pow(1 - t, 3);

      cam.position.lerpVectors(startPos, endPos, e);
      ctrl.target.lerpVectors(startTarget, endTarget, e);
      // Sync OrbitControls internal state without its physics
      ctrl.update();

      if (t < 1) {
        flyRef.current = requestAnimationFrame(tick);
      } else {
        cam.position.copy(endPos);
        ctrl.target.copy(endTarget);
        ctrl.update();
        flyRef.current = null;
      }
    };

    flyRef.current = requestAnimationFrame(tick);
  }, []);

  // ── Build the 3-D car ─────────────────────────────────────────────────────
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const W = mount.clientWidth  || 600;
    const H = mount.clientHeight || 520;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0d1117);
    scene.fog = new THREE.Fog(0x0d1117, 18, 35);

    // Camera
    const camera = new THREE.PerspectiveCamera(38, W / H, 0.1, 100);
    camera.position.set(6.5, 3.8, 6.5);
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(W, H);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type    = THREE.PCFSoftShadowMap;
    renderer.toneMapping       = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 2.0;
    renderer.outputColorSpace  = THREE.SRGBColorSpace;
    mount.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Controls — damping ON, but we'll call update() every frame regardless
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping  = true;
    controls.dampingFactor  = 0.08;
    controls.minDistance    = 3;
    controls.maxDistance    = 18;
    controls.maxPolarAngle  = Math.PI / 2.05;
    controls.target.set(0, 0.7, 0);
    controls.autoRotate     = true;
    controls.autoRotateSpeed = 0.7;
    controls.update();
    controlsRef.current = controls;
    controls.addEventListener('start', () => { controls.autoRotate = false; });

    // Lights
    scene.add(new THREE.AmbientLight(0xffffff, 2.5));
    const key = new THREE.DirectionalLight(0xffffff, 4.0);
    key.position.set(5, 9, 5);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.near   =  0.5; key.shadow.camera.far    = 22;
    key.shadow.camera.left   = -6;   key.shadow.camera.right  =  6;
    key.shadow.camera.top    =  6;   key.shadow.camera.bottom = -6;
    key.shadow.bias = -0.001;
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xffffff, 2.0); fill.position.set(-6, 4, -4); scene.add(fill);
    const rim  = new THREE.DirectionalLight(0xffffff, 1.5); rim.position.set(-3, 3,  8); scene.add(rim);
    const front = new THREE.DirectionalLight(0xffffff, 1.5); front.position.set(8, 2, 0); scene.add(front);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x334466, 1.5));

    // ── Environment reflections ──
    const pmrem = new THREE.PMREMGenerator(renderer);
    pmrem.compileEquirectangularShader();
    const envRT = pmrem.fromScene(new RoomEnvironment(), 0.04);
    scene.environment = envRT.texture;
    pmrem.dispose();

    // ── Build the car (smooth extruded-profile model in carModel.ts) ──
    const meshMap = meshMapRef.current;
    meshMap.clear();
    const root = buildCarModel(meshMap);
    scene.add(root);

    // Floor
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(24,18), new THREE.MeshStandardMaterial({ color:0x0a0e14, roughness:0.06, metalness:0.88 }));
    floor.rotation.x = -Math.PI/2; floor.receiveShadow = true; scene.add(floor);

    // Shadow blob
    const blob = new THREE.Shape(); blob.ellipse(0,0,2.5,1.0,0,Math.PI*2);
    const shadowMesh = new THREE.Mesh(new THREE.ShapeGeometry(blob), new THREE.MeshBasicMaterial({ color:0x000000, transparent:true, opacity:0.35, depthWrite:false }));
    shadowMesh.rotation.x = -Math.PI/2; shadowMesh.position.y = 0.001; scene.add(shadowMesh);

    // Apply initial colors from valueRef
    refreshColors(new Set(valueRef.current.map(p => p.id)));

    // Render loop — always call controls.update() so damping works
    const animate = () => {
      frameRef.current = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // Resize
    const onResize = () => {
      if (!mount) return;
      const w = mount.clientWidth, h = mount.clientHeight;
      camera.aspect = w / h; camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', onResize);

    return () => {
      if (flyRef.current !== null) cancelAnimationFrame(flyRef.current);
      cancelAnimationFrame(frameRef.current);
      controls.dispose();
      renderer.dispose();
      meshMap.clear();
      window.removeEventListener('resize', onResize);
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
    };
  }, []); // run exactly once

  // ── Toggle damage ─────────────────────────────────────────────────────────
  const toggle = useCallback((id: string) => {
    if (readOnly) return;
    const label = getLabel(id);
    const isDmg = valueRef.current.some(p => p.id === id);
    if (isDmg) {
      onChange(valueRef.current.filter(p => p.id !== id));
      showToast(`✓ ${label} removed`);
    } else {
      onChange([...valueRef.current, { id, label, x: 0, y: 0 }]);
      showToast(`⚠ ${label} marked as damaged`);
    }
    flyTo(id);
  }, [readOnly, onChange, getLabel, showToast, flyTo]);

  // ── 3D click ──────────────────────────────────────────────────────────────
  const downPos = useRef<{x:number;y:number}|null>(null);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    downPos.current = { x: e.clientX, y: e.clientY };
  }, []);

  const getHitPart = useCallback((e: React.MouseEvent) => {
    const el = mountRef.current; const cam = cameraRef.current;
    if (!el || !cam) return null;
    const r = el.getBoundingClientRect();
    const mouse = new THREE.Vector2(((e.clientX-r.left)/r.width)*2-1,-((e.clientY-r.top)/r.height)*2+1);
    const ray = new THREE.Raycaster(); ray.setFromCamera(mouse, cam);
    // Only test named meshes directly — not their LineSegments children
    const hits = ray.intersectObjects([...meshMapRef.current.values()], false);
    for (const hit of hits) {
      const p = PARTS.find(p => p.mesh === hit.object.name);
      if (p) return { part: p, el };
    }
    return null;
  }, []);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    const el = mountRef.current;
    if (!el) return;
    const result = getHitPart(e);
    if (result) {
      setHovered(result.part.id);
      el.style.cursor = readOnly ? 'default' : 'pointer';
    } else {
      setHovered(null);
      el.style.cursor = 'grab';
    }
  }, [readOnly, getHitPart]);

  const onClick = useCallback((e: React.MouseEvent) => {
    const d = downPos.current;
    if (!d || Math.hypot(e.clientX-d.x,e.clientY-d.y) > 5) return;
    const result = getHitPart(e);
    if (result) toggle(result.part.id);
  }, [toggle, getHitPart]);

  const damagedIds = new Set(value.map(p => p.id));

  return (
    <div className="ds-root">
      {!readOnly && value.length > 0 && (
        <div className="ds-hdr">
          <div className="ds-hdr-left" />
          <button className="ds-clear-btn" onClick={() => onChange([])}>Clear all</button>
        </div>
      )}

      <div className="ds-body">
        <div className="ds-canvas-wrap">
          <div ref={mountRef} className="ds-canvas" onMouseDown={onMouseDown} onMouseMove={onMouseMove} onClick={onClick} />
          {hovered && (
            <div className="ds-hover-label">
              {getLabel(hovered)}
              {damagedIds.has(hovered) && <span className="ds-dmg-tag">DAMAGED</span>}
            </div>
          )}
        </div>

        <div className="ds-panel">
          <div className="ds-panel-top">
            <span className="ds-panel-label">{dm.parts}</span>
            {value.length > 0 && <span className="ds-badge">{value.length} {dm.damaged}</span>}
          </div>
          <div className="ds-list">
            {PARTS.map(part => {
              const isDmg = damagedIds.has(part.id);
              const isHov = hovered === part.id;
              return (
                <button
                  key={part.id}
                  className={`ds-item${isDmg?' dmg':''}${isHov?' hov':''}`}
                  onClick={() => toggle(part.id)}
                  onMouseEnter={() => setHovered(part.id)}
                  onMouseLeave={() => setHovered(null)}
                >
                  <span className={`ds-dot${isDmg?' red':''}`} />
                  <span className="ds-item-label">{getLabel(part.id)}</span>
                  <span className="ds-item-act">{isDmg ? '✕' : '+'}</span>
                </button>
              );
            })}
          </div>
          {value.length > 0 && (
            <div className="ds-dmg-list">
              <div className="ds-dmg-title">⚠ Damaged Parts</div>
              {value.map(p => (
                <div key={p.id} className="ds-dmg-row">
                  <span className="ds-dot red sm" />
                  <span className="ds-dmg-name">{getLabel(p.id)}</span>
                  {!readOnly && <button className="ds-dmg-rm" onClick={() => toggle(p.id)}>✕</button>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {toast && <div className="ds-toast">{toast}</div>}

      <style jsx>{`
        .ds-root{background:#fff;border-radius:14px;overflow:hidden;border:2px solid #ae050a;font-family:'Inter',system-ui,sans-serif;box-shadow:0 8px 32px rgba(0,0,0,.08)}
        .ds-hdr{display:flex;align-items:center;justify-content:flex-end;padding:14px 18px;background:#fff;border-bottom:1px solid #f0c0c0;gap:12px}
        .ds-hdr-left{display:flex;align-items:center;gap:12px}
        .ds-clear-btn{padding:6px 14px;border-radius:6px;border:1px solid #ae050a;background:none;color:#ae050a;font-size:12px;font-weight:600;cursor:pointer;transition:all .15s;white-space:nowrap}
        .ds-clear-btn:hover{background:#ae050a;color:#fff}
        .ds-body{display:flex;height:520px}
        .ds-canvas-wrap{flex:1;position:relative;min-width:0;overflow:hidden}
        .ds-canvas{width:100%;height:100%;cursor:grab;touch-action:none;display:block}
        .ds-canvas:active{cursor:grabbing}
        .ds-hover-label{position:absolute;bottom:12px;left:50%;transform:translateX(-50%);background:rgba(9,14,22,.9);backdrop-filter:blur(8px);color:#a0c0e0;padding:5px 14px;border-radius:99px;font-size:12px;font-weight:600;pointer-events:none;border:1px solid rgba(255,255,255,.07);display:flex;align-items:center;gap:8px;white-space:nowrap}
        .ds-dmg-tag{background:#ae050a;color:#fff;padding:1px 6px;border-radius:3px;font-size:9px;font-weight:800}
        .ds-panel{width:220px;flex-shrink:0;background:#fff;border-left:2px solid #ae050a;display:flex;flex-direction:column;overflow:hidden}
        .ds-panel-top{padding:10px 12px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #f0c0c0;flex-shrink:0}
        .ds-panel-label{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:#ae050a}
        .ds-badge{background:#ae050a;color:#fff;font-size:9px;padding:2px 7px;border-radius:99px;font-weight:700}
        .ds-list{flex:1;overflow-y:auto;padding:4px;display:flex;flex-direction:column;gap:1px}
        .ds-list::-webkit-scrollbar{width:3px}
        .ds-list::-webkit-scrollbar-thumb{background:#f0c0c0;border-radius:2px}
        .ds-item{display:flex;align-items:center;gap:7px;padding:7px 9px;border-radius:6px;background:none;border:1px solid transparent;cursor:pointer;text-align:left;width:100%;font-size:12px;color:#444;transition:all .12s}
        .ds-item:hover,.ds-item.hov{background:#fff5f5;border-color:#f0c0c0;color:#1a1a1a}
        .ds-item.dmg{background:#ffeaea;border-color:#f0a0a0;color:#ae050a;font-weight:600}
        .ds-item-label{flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .ds-item-act{font-size:13px;font-weight:700;opacity:.4;transition:opacity .12s;flex-shrink:0}
        .ds-item:hover .ds-item-act,.ds-item.hov .ds-item-act{opacity:1}
        .ds-item.dmg .ds-item-act{color:#ae050a;opacity:.85}
        .ds-dot{width:7px;height:7px;border-radius:50%;background:#ddd;flex-shrink:0;transition:all .15s}
        .ds-dot.red{background:#ae050a;box-shadow:0 0 6px rgba(174,5,10,.5)}
        .ds-dot.sm{width:5px;height:5px}
        .ds-dmg-list{border-top:1px solid #f0c0c0;padding:8px 10px;max-height:140px;overflow-y:auto;flex-shrink:0}
        .ds-dmg-title{font-size:10px;font-weight:700;color:#ae050a;text-transform:uppercase;letter-spacing:.8px;margin-bottom:6px}
        .ds-dmg-row{display:flex;align-items:center;gap:6px;font-size:11px;color:#ae050a;padding:2px 0}
        .ds-dmg-name{flex:1}
        .ds-dmg-rm{background:none;border:none;color:#ae050a;cursor:pointer;font-size:11px;padding:1px 4px;border-radius:3px;opacity:.6;transition:opacity .12s}
        .ds-dmg-rm:hover{opacity:1}
        .ds-toast{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);padding:10px 22px;border-radius:10px;font-size:13px;font-weight:600;z-index:10000;pointer-events:none;white-space:nowrap;animation:toastIn .22s ease;box-shadow:0 6px 24px rgba(0,0,0,.18);background:#fff;border-left:3px solid #ae050a;color:#ae050a}
        @keyframes toastIn{from{opacity:0;transform:translateX(-50%) translateY(10px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}
        @media(max-width:640px){.ds-body{flex-direction:column;height:auto}.ds-canvas-wrap{height:300px}.ds-panel{width:100%;border-left:none;border-top:2px solid #ae050a;height:220px}}
      `}</style>
    </div>
  );
}
