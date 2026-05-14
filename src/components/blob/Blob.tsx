import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { HSB } from '../../lib/color';
import { hsbToRgb } from '../../lib/color';
import type { ShrinkStyle } from '../../store/gameStore';
import {
  BLOB_DEFAULTS,
  COLLAPSE_SCALE,
  easeShrink,
  shrinkScale,
  surfaceParams,
} from '../../lib/shrink';

export interface ShrinkState {
  /** 0..1 — the Memorize timer expressed as the blob's shrink. */
  progress: number;
  style: ShrinkStyle;
}

interface BlobProps {
  color: HSB;
  shrink?: ShrinkState | null;
  onCollapseComplete?: () => void;
  className?: string;
}

// Collapse timeline (ms).
const COLLAPSE_DURATION = 250;
const FLASH_DURATION = 350;
const HELD_BEAT = 150;

const GEOMETRY_DETAIL = 48;
const BLOB_RADIUS = 1.4;

interface MeshProps {
  color: HSB;
  shrink?: ShrinkState | null;
  collapsing: boolean;
}

function BlobMesh({ color, shrink, collapsing }: MeshProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const matRef = useRef<THREE.MeshPhysicalMaterial>(null);
  const collapseStart = useRef<number | null>(null);

  // High-subdivision icosphere. Built once; disposed on unmount.
  const geometry = useMemo(
    () => new THREE.IcosahedronGeometry(BLOB_RADIUS, GEOMETRY_DETAIL),
    [],
  );

  // Original undeformed positions — the deformation is applied fresh each frame.
  const basePositions = useMemo(
    () => Float32Array.from(geometry.attributes.position.array),
    [geometry],
  );

  useEffect(() => {
    return () => {
      geometry.dispose();
    };
  }, [geometry]);

  useFrame((state) => {
    const mesh = meshRef.current;
    const mat = matRef.current;
    if (!mesh || !mat) return;

    const t = state.clock.elapsedTime * 0.8;

    const eased = shrink ? easeShrink(Math.min(1, shrink.progress)) : 0;
    const style = shrink?.style ?? 'densify';
    const surface = shrink
      ? surfaceParams(style, eased)
      : { ...BLOB_DEFAULTS };

    // --- Vertex displacement along normals (the "blob" motion) ---
    const pos = mesh.geometry.attributes.position as THREE.BufferAttribute;
    const arr = pos.array as Float32Array;
    const { amount, freq } = surface;
    for (let i = 0; i < arr.length; i += 3) {
      const ox = basePositions[i];
      const oy = basePositions[i + 1];
      const oz = basePositions[i + 2];
      // For an origin-centered icosphere the vertex normal is the
      // normalized position.
      const len = Math.sqrt(ox * ox + oy * oy + oz * oz) || 1;
      const nx = ox / len;
      const ny = oy / len;
      const nz = oz / len;
      const offset =
        amount *
        Math.sin(nx * freq + t) *
        Math.cos(ny * freq + t * 0.8) *
        Math.sin(nz * freq + t * 1.2);
      arr[i] = ox + nx * offset;
      arr[i + 1] = oy + ny * offset;
      arr[i + 2] = oz + nz * offset;
    }
    pos.needsUpdate = true;
    mesh.geometry.computeVertexNormals();

    // --- Material surface response ---
    mat.clearcoat = surface.clearcoat;
    mat.roughness = surface.roughness;

    // --- Rotation ---
    mesh.rotation.y = t * 0.25;
    mesh.rotation.x = Math.sin(t * 0.2) * 0.1;

    // --- Scale: shrink, then collapse-to-point ---
    let scale = shrink ? shrinkScale(eased) : 1.0;
    if (collapsing) {
      if (collapseStart.current === null) {
        collapseStart.current = state.clock.elapsedTime;
      }
      const elapsed =
        (state.clock.elapsedTime - collapseStart.current) * 1000;
      const from = shrinkScale(easeShrink(1));
      const k = Math.min(1, elapsed / COLLAPSE_DURATION);
      // ease-in
      const eIn = k * k;
      scale = from + (COLLAPSE_SCALE - from) * eIn;
    }
    mesh.scale.setScalar(scale);
  });

  const [r, g, b] = hsbToRgb(color.h, color.s, color.b);

  return (
    <mesh ref={meshRef} geometry={geometry}>
      <meshPhysicalMaterial
        ref={matRef}
        color={new THREE.Color(r, g, b)}
        roughness={BLOB_DEFAULTS.roughness}
        metalness={0.0}
        clearcoat={BLOB_DEFAULTS.clearcoat}
        clearcoatRoughness={0.1}
      />
    </mesh>
  );
}

/**
 * The hero element. A glossy, gently deforming icosphere in the given color.
 * Pass `shrink` to drive the Memorize-phase shrink + collapse; `onCollapseComplete`
 * fires once the collapse + light flash + held beat have finished.
 */
export function Blob({
  color,
  shrink = null,
  onCollapseComplete,
  className = '',
}: BlobProps) {
  const [collapsing, setCollapsing] = useState(false);
  const [flash, setFlash] = useState(false);
  const completed = useRef(false);

  // Kick off the collapse sequence once the shrink reaches its end.
  useEffect(() => {
    if (!shrink || collapsing) return;
    if (shrink.progress < 1) return;
    setCollapsing(true);
  }, [shrink, collapsing]);

  useEffect(() => {
    if (!collapsing) return;
    // Flash blooms from the blob's center as it collapses.
    setFlash(true);
    const flashOff = setTimeout(() => setFlash(false), FLASH_DURATION);
    // Collapse + flash, then a held beat of empty stage, then transition.
    const done = setTimeout(() => {
      if (completed.current) return;
      completed.current = true;
      onCollapseComplete?.();
    }, FLASH_DURATION + HELD_BEAT);
    return () => {
      clearTimeout(flashOff);
      clearTimeout(done);
    };
  }, [collapsing, onCollapseComplete]);

  return (
    <div className={`relative ${className}`}>
      <Canvas
        camera={{ position: [0, 0, 5], fov: 45 }}
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true }}
      >
        <ambientLight intensity={0.22} />
        <directionalLight
          intensity={1.85}
          position={[3, 4, 5]}
          color={'#ffffff'}
        />
        <directionalLight
          intensity={0.6}
          position={[-3, -2, 3]}
          color={'#ffccaa'}
        />
        <BlobMesh color={color} shrink={shrink} collapsing={collapsing} />
      </Canvas>

      {/* Soft light bloom — premium, not an explosion. Peak opacity ~0.5. */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 h-1/2 w-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          background:
            'radial-gradient(circle, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0.4) 30%, transparent 70%)',
          opacity: flash ? 0.5 : 0,
          transform: `translate(-50%, -50%) scale(${flash ? 1.8 : 0.2})`,
          transition: flash
            ? `opacity ${FLASH_DURATION}ms ease-out, transform ${FLASH_DURATION}ms ease-out`
            : `opacity 120ms ease-out`,
        }}
      />
    </div>
  );
}
