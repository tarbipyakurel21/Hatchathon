"use client";

import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { VideoTrack, VideoFrameAnnotation } from "@/lib/videoTypes";
import { X, Box, RotateCcw, Eye, Sun, Sparkles } from "lucide-react";

interface ThreeSurgicalViewerProps {
  isOpen: boolean;
  onClose: () => void;
  videoElement: HTMLVideoElement | null;
  tracks: VideoTrack[];
  frameAnnotations: VideoFrameAnnotation[];
}

export const ThreeSurgicalViewer: React.FC<ThreeSurgicalViewerProps> = ({
  isOpen,
  onClose,
  videoElement,
  tracks,
  frameAnnotations,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [wireframe, setWireframe] = useState<boolean>(false);
  const [autoRotate, setAutoRotate] = useState<boolean>(true);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const animFrameIdRef = useRef<number | null>(null);
  const meshGroupRef = useRef<THREE.Group | null>(null);

  useEffect(() => {
    if (!isOpen || !mountRef.current) return;

    const width = mountRef.current.clientWidth || 600;
    const height = mountRef.current.clientHeight || 450;

    // 1. Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#070b13");
    sceneRef.current = scene;

    // 2. Camera
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(0, -25, 45);
    camera.lookAt(0, 0, 0);

    // 3. Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    rendererRef.current = renderer;

    mountRef.current.innerHTML = "";
    mountRef.current.appendChild(renderer.domElement);

    // 4. Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);

    const surgicalSpotlight = new THREE.SpotLight(0x22d3ee, 2.5);
    surgicalSpotlight.position.set(20, 30, 40);
    surgicalSpotlight.castShadow = true;
    scene.add(surgicalSpotlight);

    const warmLamp = new THREE.DirectionalLight(0xffeedd, 1.2);
    warmLamp.position.set(-20, -20, 30);
    scene.add(warmLamp);

    // 5. Mesh Group (holds 3D anatomical plane & extruded object meshes)
    const meshGroup = new THREE.Group();
    scene.add(meshGroup);
    meshGroupRef.current = meshGroup;

    // 6. 3D Cavity Base Plane with video texture
    let videoTexture: THREE.VideoTexture | THREE.CanvasTexture | null = null;
    if (videoElement && videoElement.readyState >= 2) {
      videoTexture = new THREE.VideoTexture(videoElement);
      videoTexture.minFilter = THREE.LinearFilter;
      videoTexture.magFilter = THREE.LinearFilter;
    }

    const planeGeo = new THREE.PlaneGeometry(36, 20.25, 32, 32);
    const planeMat = new THREE.MeshStandardMaterial({
      map: videoTexture,
      color: videoTexture ? 0xffffff : 0x1e293b,
      roughness: 0.5,
      metalness: 0.1,
      wireframe: false,
    });
    const basePlane = new THREE.Mesh(planeGeo, planeMat);
    meshGroup.add(basePlane);

    // 7. Extrude 3D segmented surgical objects from polygons
    const trackMap = new Map(tracks.map((t) => [t.track_id, t]));

    frameAnnotations.forEach((ann) => {
      if (!ann.polygon || ann.polygon.length < 3) return;
      const track = trackMap.get(ann.track_id);
      const colorHex = track?.color || "#06B6D4";

      // Convert video pixel coords [0..640, 0..360] to 3D plane coords [-18..18, -10.125..10.125]
      const shape = new THREE.Shape();
      const normalizeX = (px: number) => (px / 640) * 36 - 18;
      const normalizeY = (py: number) => -((py / 360) * 20.25 - 10.125);

      ann.polygon.forEach(([px, py], i) => {
        const x3d = normalizeX(px);
        const y3d = normalizeY(py);
        if (i === 0) shape.moveTo(x3d, y3d);
        else shape.lineTo(x3d, y3d);
      });
      shape.closePath();

      // Extrude height based on category
      const depth = track?.category === "instrument" ? 2.5 : 1.2;
      const extrudeSettings = {
        depth,
        bevelEnabled: true,
        bevelSegments: 2,
        steps: 1,
        bevelSize: 0.15,
        bevelThickness: 0.15,
      };

      const extrudeGeo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
      const extrudeMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(colorHex),
        roughness: 0.3,
        metalness: track?.category === "instrument" ? 0.7 : 0.2,
        transparent: true,
        opacity: 0.85,
        wireframe,
      });

      const objMesh = new THREE.Mesh(extrudeGeo, extrudeMat);
      objMesh.position.z = 0.1;
      meshGroup.add(objMesh);
    });

    // 8. Animation loop (Smooth continuous Orbit & subtle rotation)
    let rotationAngle = 0;
    const animate = () => {
      animFrameIdRef.current = requestAnimationFrame(animate);

      if (autoRotate && meshGroupRef.current) {
        rotationAngle += 0.005;
        meshGroupRef.current.rotation.z = Math.sin(rotationAngle) * 0.12;
        meshGroupRef.current.rotation.y = Math.sin(rotationAngle * 0.8) * 0.25;
      }

      renderer.render(scene, camera);
    };
    animate();

    // Resize handler
    const handleResize = () => {
      if (!mountRef.current || !rendererRef.current) return;
      const nw = mountRef.current.clientWidth;
      const nh = mountRef.current.clientHeight;
      camera.aspect = nw / nh;
      camera.updateProjectionMatrix();
      rendererRef.current.setSize(nw, nh);
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      if (animFrameIdRef.current) cancelAnimationFrame(animFrameIdRef.current);
      if (rendererRef.current && rendererRef.current.domElement) {
        rendererRef.current.domElement.remove();
        rendererRef.current.dispose();
      }
    };
  }, [isOpen, videoElement, tracks, frameAnnotations, autoRotate, wireframe]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-4xl bg-zinc-950 border border-zinc-800 rounded-xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/60">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded bg-zinc-800 border border-zinc-700/60 flex items-center justify-center">
              <Box className="w-4 h-4 text-zinc-300" />
            </div>
            <div>
              <h3 className="text-xs font-semibold text-zinc-100 flex items-center gap-2">
                3D Volumetric Mesh & Depth Reconstruction
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-400 border border-zinc-700/60 font-mono">
                  Three.js WebGL
                </span>
              </h3>
              <p className="text-[11px] text-zinc-400">
                Extruded 3D anatomical volume & instruments from SAM 2 Tiny video masks
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setWireframe(!wireframe)}
              title="Toggle Wireframe Mode"
              className={`px-2 py-1 rounded text-xs border font-medium transition ${
                wireframe
                  ? "bg-zinc-100 text-zinc-950 border-zinc-100 font-semibold"
                  : "bg-zinc-900 border-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-800"
              }`}
            >
              Wireframe
            </button>
            <button
              onClick={() => setAutoRotate(!autoRotate)}
              title="Toggle Auto Rotation"
              className={`px-2 py-1 rounded text-xs border font-medium transition ${
                autoRotate
                  ? "bg-zinc-800 text-zinc-100 border-zinc-700"
                  : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800"
              }`}
            >
              Orbit
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded text-zinc-400 hover:text-white hover:bg-zinc-800 transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 3D WebGL Canvas Viewport */}
        <div ref={mountRef} className="w-full h-[480px] bg-zinc-950 relative cursor-grab active:cursor-grabbing" />

        {/* Footer controls & telemetry */}
        <div className="px-4 py-2 border-t border-zinc-800 bg-zinc-900/60 flex items-center justify-between text-xs text-zinc-400 font-mono">
          <div className="flex items-center gap-4">
            <span>
              Segmented Objects: <b className="text-zinc-200">{frameAnnotations.length}</b>
            </span>
            <span>
              Active Tracks: <b className="text-zinc-200">{tracks.length}</b>
            </span>
          </div>
          <span className="text-[11px] text-zinc-500">
            Click & drag to rotate • Scroll to zoom
          </span>
        </div>
      </div>
    </div>
  );
};
