import type { EpisodeResult } from "@evowalker/sim";
import { useEffect, useRef } from "react";
import * as THREE from "three";

interface ChampionSceneProps {
  readonly episode: EpisodeResult | null;
  readonly playbackSpeed: number;
  readonly replayToken: number;
}

const BODY_IDS = [
  "torso",
  "front-left-upper-leg",
  "front-left-lower-leg",
  "front-right-upper-leg",
  "front-right-lower-leg",
  "rear-left-upper-leg",
  "rear-left-lower-leg",
  "rear-right-upper-leg",
  "rear-right-lower-leg",
] as const;

interface RenderBody {
  readonly group: THREE.Group;
  readonly geometries: readonly THREE.BufferGeometry[];
  readonly material: THREE.MeshPhysicalMaterial;
}

function makeBody(id: string): RenderBody {
  const group = new THREE.Group();
  const material = new THREE.MeshPhysicalMaterial({
    color: id === "torso" ? 0xd6b36a : 0x58cbb7,
    roughness: 0.28,
    metalness: 0.44,
    clearcoat: 0.42,
    clearcoatRoughness: 0.35,
  });
  const lower = id.endsWith("lower-leg");
  const geometry =
    id === "torso"
      ? new THREE.BoxGeometry(1.12, 0.44, 0.68, 3, 2, 2)
      : new THREE.CapsuleGeometry(
          lower ? 0.08 : 0.085,
          lower ? 0.38 : 0.4,
          8,
          16,
        );
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
  const geometries: THREE.BufferGeometry[] = [geometry];
  if (lower) {
    const footGeometry = new THREE.BoxGeometry(0.36, 0.11, 0.22);
    const foot = new THREE.Mesh(footGeometry, material);
    foot.position.set(0.09, -0.22, 0);
    foot.castShadow = true;
    foot.receiveShadow = true;
    group.add(foot);
    geometries.push(footGeometry);
  }
  return { group, geometries, material };
}

export function ChampionScene({
  episode,
  playbackSpeed,
  replayToken,
}: ChampionSceneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const activeEpisodeRef = useRef<EpisodeResult | null>(episode);
  const queuedEpisodeRef = useRef<EpisodeResult | null>(episode);
  const playbackSpeedRef = useRef(playbackSpeed);
  const startedAtRef = useRef(0);
  const lastLoopRef = useRef(0);

  useEffect(() => {
    queuedEpisodeRef.current = episode;
    if (activeEpisodeRef.current === null || episode === null) {
      activeEpisodeRef.current = episode;
      startedAtRef.current = performance.now();
      lastLoopRef.current = 0;
    }
  }, [episode]);

  useEffect(() => {
    playbackSpeedRef.current = playbackSpeed;
  }, [playbackSpeed]);

  useEffect(() => {
    activeEpisodeRef.current = queuedEpisodeRef.current;
    startedAtRef.current = performance.now();
    lastLoopRef.current = 0;
  }, [replayToken]);

  useEffect(() => {
    const container = containerRef.current;
    if (container === null) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x071016);
    scene.fog = new THREE.FogExp2(0x071016, 0.055);
    const camera = new THREE.PerspectiveCamera(37, 1, 0.1, 100);
    let yaw = 0.72;
    let pitch = 0.3;
    let distance = 5.8;
    const cameraTarget = new THREE.Vector3(0, 0.78, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.append(renderer.domElement);

    scene.add(new THREE.HemisphereLight(0xaadbd7, 0x151d18, 2.1));
    const key = new THREE.DirectionalLight(0xffedcb, 4.2);
    key.position.set(4, 7, 5);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0x4fd7d0, 2.1);
    rim.position.set(-4, 2, -5);
    scene.add(rim);

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(40, 16),
      new THREE.MeshStandardMaterial({
        color: 0x0b191e,
        roughness: 0.88,
        metalness: 0.05,
      }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);
    const grid = new THREE.GridHelper(40, 80, 0x4b9f91, 0x17383a);
    grid.position.y = 0.006;
    scene.add(grid);

    const meshes = new Map<string, THREE.Group>();
    const bodyGeometries: THREE.BufferGeometry[] = [];
    const bodyMaterials: THREE.MeshPhysicalMaterial[] = [];
    for (const id of BODY_IDS) {
      const body = makeBody(id);
      scene.add(body.group);
      meshes.set(id, body.group);
      bodyGeometries.push(...body.geometries);
      bodyMaterials.push(body.material);
    }

    const trailPositions = new Float32Array(180 * 3);
    const trailGeometry = new THREE.BufferGeometry();
    const trailAttribute = new THREE.BufferAttribute(trailPositions, 3);
    trailGeometry.setAttribute("position", trailAttribute);
    trailGeometry.setDrawRange(0, 0);
    const trail = new THREE.Line(
      trailGeometry,
      new THREE.LineBasicMaterial({
        color: 0x55d6be,
        transparent: true,
        opacity: 0.55,
      }),
    );
    scene.add(trail);
    const trailPoints: THREE.Vector3[] = [];

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
      distance = THREE.MathUtils.clamp(distance + event.deltaY * 0.006, 3, 10);
      updateCamera();
    };
    const keyDown = (event: KeyboardEvent) => {
      if (
        !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)
      )
        return;
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
    let animationFrame = 0;
    const draw = (time: number) => {
      let active = activeEpisodeRef.current;
      if (active !== null && active.frames.length > 0) {
        const duration = Math.max(active.elapsedSeconds, 0.001);
        let rawElapsed =
          ((time - startedAtRef.current) / 1000) * playbackSpeedRef.current;
        const loop = Math.floor(rawElapsed / duration);
        if (loop > lastLoopRef.current && queuedEpisodeRef.current !== active) {
          activeEpisodeRef.current = queuedEpisodeRef.current;
          active = activeEpisodeRef.current;
          startedAtRef.current = time;
          lastLoopRef.current = 0;
          rawElapsed = 0;
          trailPoints.length = 0;
        } else {
          lastLoopRef.current = loop;
        }
        if (active !== null) {
          const elapsed = reduceMotion
            ? active.elapsedSeconds
            : rawElapsed % duration;
          const frame =
            active.frames.find(
              ({ elapsedSeconds }) => elapsedSeconds >= elapsed,
            ) ?? active.frames.at(-1);
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
            cameraTarget.x += (torso.translation.x - cameraTarget.x) * 0.08;
            cameraTarget.z += (torso.translation.z - cameraTarget.z) * 0.08;
            updateCamera();
            if (
              !reduceMotion &&
              (trailPoints
                .at(-1)
                ?.distanceToSquared(
                  new THREE.Vector3(
                    torso.translation.x,
                    0.025,
                    torso.translation.z,
                  ),
                ) ?? 1) > 0.0025
            ) {
              trailPoints.push(
                new THREE.Vector3(
                  torso.translation.x,
                  0.025,
                  torso.translation.z,
                ),
              );
              if (trailPoints.length > 180) trailPoints.shift();
              trailPoints.forEach((point, index) =>
                point.toArray(trailPositions, index * 3),
              );
              trailAttribute.needsUpdate = true;
              trailGeometry.setDrawRange(0, trailPoints.length);
            }
          }
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
      bodyGeometries.forEach((geometry) => {
        geometry.dispose();
      });
      bodyMaterials.forEach((material) => {
        material.dispose();
      });
      ground.geometry.dispose();
      ground.material.dispose();
      trailGeometry.dispose();
      (trail.material as THREE.Material).dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return (
    <div className="scene-shell" ref={containerRef}>
      {episode === null ? (
        <div className="scene-empty">
          <span>No viable champion yet</span>
          <small>Begin evolution to evaluate the founder archive.</small>
        </div>
      ) : null}
    </div>
  );
}
