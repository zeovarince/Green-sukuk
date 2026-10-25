"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { LandingData, CloudPoint } from "@/lib/landing/data";
import { posisiKamera } from "@/lib/landing/kamera";
import { PALET_LANDING } from "@/lib/landing/palet";
import type { Group } from "three";

const WARNA = PALET_LANDING;

function garis(points: THREE.Vector3[], color: string, opacity = 1) {
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = new THREE.LineBasicMaterial({ color, transparent: opacity < 1, opacity });
  return new THREE.Line(geometry, material);
}

function Polyline({ points, color, opacity = 1 }: { points: THREE.Vector3[]; color: string; opacity?: number }) {
  const object = useMemo(() => garis(points, color, opacity), [points, color, opacity]);
  useEffect(() => () => { object.geometry.dispose(); object.material.dispose(); }, [object]);
  return <primitive object={object} dispose={null} />;
}

function awanObject(points: CloudPoint[], maxPoints: number, markedOnly = false) {
  const marked = points.filter((point) => point.d === 1);
  const normal = points.filter((point) => point.d === 0);
  const chosen = markedOnly ? marked.slice(0, maxPoints) : normal.slice(0, maxPoints);
  const positions = new Float32Array(chosen.length * 3);
  chosen.forEach((point, index) => {
    positions[index * 3] = (point.x - 0.5) * 4.4;
    positions[index * 3 + 1] = (point.y - 0.5) * 2.25;
    positions[index * 3 + 2] = (point.z - 0.5) * 2.3;
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({
    color: markedOnly ? WARNA.patok : WARNA.redup,
    size: markedOnly ? 0.055 : 0.035,
    sizeAttenuation: true,
  });
  return new THREE.Points(geometry, material);
}

function TitikAwan({ points, maxPoints, markedOnly = false }: { points: CloudPoint[]; maxPoints: number; markedOnly?: boolean }) {
  const cloud = useMemo(() => awanObject(points, maxPoints, markedOnly), [points, maxPoints, markedOnly]);
  useEffect(() => () => { cloud.geometry.dispose(); cloud.material.dispose(); }, [cloud]);
  return <primitive object={cloud} dispose={null} />;
}

function KotakKawat({ position, size, color = WARNA.tinta }: { position: [number, number, number]; size: [number, number, number]; color?: string }) {
  const [width, height, depth] = size;
  const object = useMemo(() => {
    const geometry = new THREE.EdgesGeometry(new THREE.BoxGeometry(width, height, depth));
    const material = new THREE.LineBasicMaterial({ color });
    return new THREE.LineSegments(geometry, material);
  }, [width, height, depth, color]);
  useEffect(() => () => { object.geometry.dispose(); object.material.dispose(); }, [object]);
  return <primitive object={object} position={position} dispose={null} />;
}

function Kurva({ data }: { data: LandingData["curve"] }) {
  const progress = useMemo(() => data.titik.map((point) => new THREE.Vector3((point.u - 0.5) * 4.7, (point.progres - 0.5) * 2.55, 0.12)), [data]);
  const cash = useMemo(() => data.titik.map((point) => new THREE.Vector3((point.u - 0.5) * 4.7, (point.pencairan - 0.5) * 2.55, -0.12)), [data]);
  const flagged = data.titik.reduce((nearest, point) => Math.abs(point.u - data.ditandai.u) < Math.abs(nearest.u - data.ditandai.u) ? point : nearest, data.titik[0]);
  const markX = (flagged.u - 0.5) * 4.7;
  const top = (flagged.pencairan - 0.5) * 2.55;
  const bottom = (flagged.progres - 0.5) * 2.55;
  return <group position={[1.3, 0, 0]}>
    <Polyline points={[new THREE.Vector3(-2.4, -1.42, 0), new THREE.Vector3(2.4, -1.42, 0)]} color={WARNA.garis} />
    <Polyline points={[new THREE.Vector3(-2.4, -1.42, 0), new THREE.Vector3(-2.4, 1.42, 0)]} color={WARNA.garis} />
    <Polyline points={progress} color={WARNA.tinta} />
    <Polyline points={cash} color={WARNA.air} />
    <Polyline points={[new THREE.Vector3(markX, Math.min(top, bottom), 0), new THREE.Vector3(markX, Math.max(top, bottom), 0)]} color={WARNA.patok} />
    <mesh position={[markX, top + 0.12, 0]}><coneGeometry args={[0.12, 0.2, 3]} /><meshBasicMaterial color={WARNA.patok} /></mesh>
  </group>;
}

function Rantai({ data }: { data: LandingData["chain"] }) {
  const positions = useMemo(() => data.entri.map((entry, index) => new THREE.Vector3(-2.75 + index * (5.5 / (data.entri.length - 1)), Math.sin(index * 0.44) * 0.3, 0)), [data.entri]);
  const linkObjects = useMemo(() => data.entri.slice(0, -1).map((entry, index) => garis([positions[index], positions[index + 1]], data.entri[index + 1].seq === data.rusak_pada ? WARNA.rusak : WARNA.air)), [data.entri, data.rusak_pada, positions]);
  useEffect(() => () => linkObjects.forEach((object) => { object.geometry.dispose(); object.material.dispose(); }), [linkObjects]);
  return <group position={[1.15, 0, 0]}>
    {linkObjects.map((object, index) => <primitive key={index} object={object} dispose={null} />)}
    {data.entri.map((entry, index) => <mesh key={entry.seq} position={positions[index].toArray()}>
      <boxGeometry args={[0.28, 0.26, 0.18]} />
      <meshBasicMaterial color={entry.seq === data.rusak_pada ? WARNA.rusak : WARNA.air} />
    </mesh>)}
  </group>;
}

function Hasil({ data }: { data: LandingData["evaluation"] }) {
  const rows = [
    { key: "aturan_saja", label: "Aturan", metric: data.pengujian.aturan_saja },
    { key: "iforest_saja", label: "IF", metric: data.pengujian.iforest_saja },
    { key: "hybrid", label: "Hybrid", metric: data.pengujian.hybrid },
  ];
  return <group position={[1.15, -0.3, 0]}>
    <Polyline points={[new THREE.Vector3(-2.4, -1.15, 0), new THREE.Vector3(2.4, -1.15, 0)]} color={WARNA.garis} />
    {rows.map(({ key, metric }, index) => {
      const height = Math.max(metric.f1 * 2.35, 0.08);
      const x = (index - 1) * 1.45;
      return <mesh key={key} position={[x, -1.15 + height / 2, 0]}>
        <boxGeometry args={[0.72, height, 0.55]} />
        <meshBasicMaterial color={WARNA.air} />
      </mesh>;
    })}
  </group>;
}

function JadwalkanRender({ active, progress }: { active: boolean; progress: number }) {
  const invalidate = useThree((state) => state.invalidate);
  useEffect(() => { if (active) invalidate(); }, [active, progress, invalidate]);
  return null;
}

function BingkaiAkhir() {
  return <group position={[1.3, 0, 0]}>
    <KotakKawat position={[0, 0, 0]} size={[4.8, 2.75, 0.08]} />
    <Polyline points={[new THREE.Vector3(-2.15, -0.35, 0.06), new THREE.Vector3(2.15, -0.35, 0.06)]} color={WARNA.garis} />
    <Polyline points={[new THREE.Vector3(-2.15, -0.82, 0.06), new THREE.Vector3(0.35, -0.82, 0.06)]} color={WARNA.garis} />
    <Polyline points={[new THREE.Vector3(-2.15, 0.84, 0.06), new THREE.Vector3(2.15, 0.84, 0.06)]} color={WARNA.air} />
  </group>;
}

function SceneContent({ data, progress, maxPoints }: { data: LandingData; progress: number; maxPoints: number }) {
  const curveRef = useRef<Group>(null);
  const cloudRef = useRef<Group>(null);
  const gateRef = useRef<Group>(null);
  const chainRef = useRef<Group>(null);
  const resultsRef = useRef<Group>(null);
  const endRef = useRef<Group>(null);
  const refs = [curveRef, cloudRef, gateRef, chainRef, resultsRef, endRef];

  const samplePoints = useMemo(() => data.cloud.sampel.slice(0, maxPoints), [data.cloud.sampel, maxPoints]);
  const rulePoints = useMemo(() => data.cloud.sampel.filter((point) => point.a === 1).slice(0, maxPoints), [data.cloud.sampel, maxPoints]);
  const flaggedPoints = useMemo(() => data.cloud.sampel.filter((point) => point.d === 1).slice(0, maxPoints), [data.cloud.sampel, maxPoints]);
  const scorePoints = useMemo(() => data.cloud.sampel.filter((point) => point.a === 0 && point.d === 1).slice(0, maxPoints), [data.cloud.sampel, maxPoints]);

  useFrame(({ camera }) => {
    const active = progress < 0.34 ? 0 : progress < 0.54 ? 1 : progress < 0.7 ? 2 : progress < 0.84 ? 3 : progress < 0.94 ? 4 : 5;
    refs.forEach((ref, index) => { if (ref.current) ref.current.visible = index === active; });
    const pose = posisiKamera(progress);
    camera.position.set(...pose.posisi);
    camera.lookAt(...pose.sasaran);
  });

  return <>
    <group ref={curveRef}><Kurva data={data.curve} /></group>
    <group ref={cloudRef} position={[1.2, 0, 0]}>
      <Polyline points={[new THREE.Vector3(-2.35, -1.3, 0), new THREE.Vector3(2.35, -1.3, 0)]} color={WARNA.garis} />
      <TitikAwan points={samplePoints} maxPoints={maxPoints} />
      <TitikAwan points={flaggedPoints} maxPoints={maxPoints} markedOnly />
    </group>
    <group ref={gateRef} position={[1.15, 0, 0]}>
      <KotakKawat position={[-1.5, 0, 0]} size={[0.1, 2.5, 2.2]} />
      <KotakKawat position={[1.5, 0, 0]} size={[0.1, 2.5, 2.2]} />
      <TitikAwan points={rulePoints} maxPoints={maxPoints} markedOnly />
      <group position={[0.55, 0, 0]}><TitikAwan points={scorePoints} maxPoints={maxPoints} markedOnly /></group>
      <Polyline points={[new THREE.Vector3(-1.5, -1.4, 0), new THREE.Vector3(-1.5, 1.4, 0)]} color={WARNA.garis} />
      <Polyline points={[new THREE.Vector3(1.5, -1.4, 0), new THREE.Vector3(1.5, 1.4, 0)]} color={WARNA.air} />
    </group>
    <group ref={chainRef}><Rantai data={data.chain} /></group>
    <group ref={resultsRef}><Hasil data={data.evaluation} /></group>
    <group ref={endRef}><BingkaiAkhir /></group>
  </>;
}

export default function ThreeScene({
  data,
  progress,
  maxPoints,
  dpr,
  active,
  onReady,
}: {
  data: LandingData;
  progress: number;
  maxPoints: number;
  dpr: number;
  active: boolean;
  onReady: () => void;
}) {
  return (
    <Canvas
      aria-hidden="true"
      frameloop={active ? "demand" : "never"}
      dpr={dpr}
      camera={{ position: [0.6, 2.7, 7.5], fov: 36, near: 0.1, far: 50 }}
      gl={{ alpha: true, antialias: false, powerPreference: "low-power" }}
      onCreated={({ invalidate }) => { onReady(); invalidate(); }}
    >
      <JadwalkanRender active={active} progress={progress} />
      <SceneContent data={data} progress={progress} maxPoints={maxPoints} />
    </Canvas>
  );
}
