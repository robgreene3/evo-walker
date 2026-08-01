import type { EpisodeResult } from "@evowalker/sim";
import { useEffect, useRef } from "react";
import * as THREE from "three";

interface ChampionSceneProps {
  readonly episode: EpisodeResult | null;
  readonly playbackSpeed: number;
  readonly replayToken: number;
}

const BODY_DIMENSIONS: Readonly<
  Record<string, readonly [number, number, number]>
> = {
  torso: [0.6, 0.48, 0.44],
  "left-upper-leg": [0.18, 0.6, 0.18],
  "right-upper-leg": [0.18, 0.6, 0.18],
  "left-lower-leg": [0.17, 0.56, 0.17],
  "right-lower-leg": [0.17, 0.56, 0.17],
};

export function ChampionScene({
  episode,
  playbackSpeed,
  replayToken,
}: ChampionSceneProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (container === null) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x081019);
    scene.fog = new THREE.Fog(0x081019, 7, 15);
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
    let yaw = 0.68;
    let pitch = 0.28;
    let distance = 5.4;
    const cameraTarget = new THREE.Vector3(0, 0.82, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.append(renderer.domElement);

    scene.add(new THREE.HemisphereLight(0xb9e6ff, 0x172619, 2.4));
    const key = new THREE.DirectionalLight(0xffffff, 3.2);
    key.position.set(3, 5, 4);
    scene.add(key);

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(30, 12),
      new THREE.MeshStandardMaterial({ color: 0x0d1b22, roughness: 0.92 }),
    );
    ground.rotation.x = -Math.PI / 2;
    scene.add(ground);
    const grid = new THREE.GridHelper(30, 60, 0x2d9b86, 0x17353a);
    grid.position.y = 0.004;
    scene.add(grid);

    const creature = new THREE.Group();
    scene.add(creature);
    const meshes = new Map<
      string,
      THREE.Mesh<THREE.BoxGeometry, THREE.MeshStandardMaterial>
    >();
    for (const [id, dimensions] of Object.entries(BODY_DIMENSIONS)) {
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(...dimensions),
        new THREE.MeshStandardMaterial({
          color: id === "torso" ? 0xffc857 : 0x55d6be,
          roughness: 0.36,
          metalness: 0.08,
        }),
      );
      mesh.castShadow = true;
      creature.add(mesh);
      meshes.set(id, mesh);
    }

    const updateCamera = () => {
      const horizontal = Math.cos(pitch) * distance;
      camera.position.set(
        cameraTarget.x + Math.sin(yaw) * horizontal,
        cameraTarget.y + Math.sin(pitch) * distance,
        cameraTarget.z + Math.cos(yaw) * horizontal,
      );
      camera.lookAt(cameraTarget);
    };
    updateCamera();

    const resize = () => {
      const width = Math.max(1, container.clientWidth);
      const height = Math.max(1, container.clientHeight);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);
    resize();

    let pointerId: number | null = null;
    let pointerX = 0;
    let pointerY = 0;
    const pointerDown = (event: PointerEvent) => {
      pointerId = event.pointerId;
      pointerX = event.clientX;
      pointerY = event.clientY;
      renderer.domElement.setPointerCapture(event.pointerId);
    };
    const pointerMove = (event: PointerEvent) => {
      if (pointerId !== event.pointerId) return;
      yaw -= (event.clientX - pointerX) * 0.008;
      pitch = THREE.MathUtils.clamp(
        pitch + (event.clientY - pointerY) * 0.006,
        -0.08,
        1.05,
      );
      pointerX = event.clientX;
      pointerY = event.clientY;
      updateCamera();
    };
    const pointerUp = (event: PointerEvent) => {
      if (pointerId === event.pointerId) pointerId = null;
    };
    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      distance = THREE.MathUtils.clamp(distance + event.deltaY * 0.006, 2.8, 9);
      updateCamera();
    };
    const keyDown = (event: KeyboardEvent) => {
      const cameraKeys = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"];
      if (!cameraKeys.includes(event.key)) return;
      event.preventDefault();
      if (event.key === "ArrowLeft") yaw -= 0.12;
      if (event.key === "ArrowRight") yaw += 0.12;
      if (event.key === "ArrowUp") pitch = Math.min(1.05, pitch + 0.1);
      if (event.key === "ArrowDown") pitch = Math.max(-0.08, pitch - 0.1);
      updateCamera();
    };
    const canvas = renderer.domElement;
    canvas.tabIndex = 0;
    canvas.setAttribute(
      "aria-label",
      "Champion replay. Drag or use arrow keys to rotate the camera; scroll to zoom.",
    );
    canvas.addEventListener("pointerdown", pointerDown);
    canvas.addEventListener("pointermove", pointerMove);
    canvas.addEventListener("pointerup", pointerUp);
    canvas.addEventListener("pointercancel", pointerUp);
    canvas.addEventListener("wheel", wheel, { passive: false });
    canvas.addEventListener("keydown", keyDown);

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const startedAt = performance.now();
    let animationFrame = 0;
    const draw = (time: number) => {
      const frames = episode?.frames ?? [];
      if (frames.length > 0) {
        const duration = episode?.elapsedSeconds ?? 0;
        const elapsed = reduceMotion
          ? duration
          : (((time - startedAt) / 1000) * playbackSpeed) %
            Math.max(duration, 0.001);
        const frame =
          frames.find(({ elapsedSeconds }) => elapsedSeconds >= elapsed) ??
          frames.at(-1);
        for (const body of frame?.bodies ?? []) {
          const mesh = meshes.get(body.id);
          if (mesh === undefined) continue;
          mesh.position.set(
            body.translation.x,
            body.translation.y,
            body.translation.z,
          );
          mesh.quaternion.set(
            body.rotation.x,
            body.rotation.y,
            body.rotation.z,
            body.rotation.w,
          );
        }
        const torso = frame?.bodies.find(({ id }) => id === "torso");
        if (torso !== undefined) {
          cameraTarget.x = torso.translation.x;
          updateCamera();
        }
      }
      renderer.render(scene, camera);
      animationFrame = requestAnimationFrame(draw);
    };
    animationFrame = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
      canvas.removeEventListener("pointerdown", pointerDown);
      canvas.removeEventListener("pointermove", pointerMove);
      canvas.removeEventListener("pointerup", pointerUp);
      canvas.removeEventListener("pointercancel", pointerUp);
      canvas.removeEventListener("wheel", wheel);
      canvas.removeEventListener("keydown", keyDown);
      for (const mesh of meshes.values()) {
        mesh.geometry.dispose();
        mesh.material.dispose();
      }
      ground.geometry.dispose();
      ground.material.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [episode, playbackSpeed, replayToken]);

  return (
    <div className="scene-shell" ref={containerRef}>
      {episode === null ? (
        <div className="scene-empty">
          <span>No champion yet</span>
          <small>Start an experiment to evaluate generation zero.</small>
        </div>
      ) : null}
    </div>
  );
}
