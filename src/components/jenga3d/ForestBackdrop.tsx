"use client";

import { useLayoutEffect } from "react";
import * as THREE from "three";
import { useTexture } from "@react-three/drei";

const BG_URL = "/images/tower-forest-bg.png";

export function ForestBackdrop() {
  const texture = useTexture(BG_URL);

  useLayoutEffect(() => {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.needsUpdate = true;
  }, [texture]);

  return (
    <mesh
      position={[0, 3.35, -13.5]}
      raycast={() => null}
      renderOrder={-1}
    >
      <planeGeometry args={[30, 17]} />
      <meshBasicMaterial
        map={texture}
        toneMapped={false}
        depthWrite
        depthTest
      />
    </mesh>
  );
}
