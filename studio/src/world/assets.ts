import {useEffect, useState} from 'react';
import * as THREE from 'three';
import {RGBELoader} from 'three/examples/jsm/loaders/RGBELoader.js';
import {GLTFLoader, GLTF} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {continueRender, delayRender, staticFile} from 'remotion';

const cache = new Map<string, Promise<any>>();
const once = <T,>(key: string, make: () => Promise<T>): Promise<T> => {
  if (!cache.has(key)) cache.set(key, make());
  return cache.get(key)!;
};

/** Load anything async while holding the Remotion frame until it is ready. */
export function useAsync<T>(key: string, make: () => Promise<T>): T | null {
  const [v, setV] = useState<T | null>(null);
  const [h] = useState(() => delayRender(`asset ${key}`, {timeoutInMilliseconds: 120000}));
  useEffect(() => {
    once(key, make).then((x) => {
      setV(x);
      continueRender(h);
    });
  }, [key]);
  return v;
}

export type PBR = {map: THREE.Texture; normalMap: THREE.Texture; roughnessMap: THREE.Texture};

const texLoader = new THREE.TextureLoader();
const loadTex = (url: string, srgb: boolean) =>
  texLoader.loadAsync(url).then((t) => {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 8;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    return t;
  });

/** Poly Haven PBR set (diffuse / normal / roughness) */
export const usePBR = (name: string): PBR | null =>
  useAsync(`pbr:${name}`, async () => {
    const base = `ph/tex/${name}`;
    const [map, normalMap, roughnessMap] = await Promise.all([
      loadTex(staticFile(`${base}/diff.jpg`), true),
      loadTex(staticFile(`${base}/nor.jpg`), false),
      loadTex(staticFile(`${base}/rough.jpg`), false),
    ]);
    return {map, normalMap, roughnessMap};
  });

/** Material from a PBR set with its own repeat (clones textures so repeats don't clash). */
export const pbrMat = (p: PBR | null, rx: number, ry: number, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) => {
  if (!p) return new THREE.MeshStandardMaterial({color: '#555'});
  const c = (t: THREE.Texture) => {
    const n = t.clone();
    n.repeat.set(rx, ry);
    n.needsUpdate = true;
    return n;
  };
  return new THREE.MeshStandardMaterial({map: c(p.map), normalMap: c(p.normalMap), roughnessMap: c(p.roughnessMap), roughness: 1, metalness: 0, ...extra});
};

export const useHDRI = (name: string) =>
  useAsync(`hdri:${name}`, () =>
    new RGBELoader().loadAsync(staticFile(`ph/hdri/${name}.hdr`)).then((t) => {
      t.mapping = THREE.EquirectangularReflectionMapping;
      return t;
    }),
  );

export const usePHModel = (name: string): GLTF | null =>
  useAsync(`model:${name}`, () => new GLTFLoader().loadAsync(staticFile(`ph/models/${name}/${name}.gltf`)));
