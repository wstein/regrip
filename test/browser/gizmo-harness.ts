import * as THREE from 'three';

import { createOrientationIndicator } from '../../src/adapters/three/orientationIndicator';

const width = 320;
const height = 320;
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setSize(width, height);
renderer.setClearColor(0x08101f);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 10);
camera.position.set(1.8, 1.5, 2.2);
camera.lookAt(0, 0, 0);

const indicator = createOrientationIndicator(true);
indicator.rotation.set(0.18, -0.42, 0.05);
scene.add(indicator);
renderer.render(scene, camera);

document.querySelector('#fixture')?.append(renderer.domElement);

const context = renderer.getContext();
const pixels = new Uint8Array(width * height * 4);
context.readPixels(0, 0, width, height, context.RGBA, context.UNSIGNED_BYTE, pixels);
let red = 0;
let green = 0;
let white = 0;
for (let index = 0; index < pixels.length; index += 4) {
  const [r, g, b] = [pixels[index], pixels[index + 1], pixels[index + 2]];
  if (r > g + 35 && r > b + 35) red += 1;
  if (g > r + 25 && g > b + 15) green += 1;
  if (r > 180 && g > 180 && b > 180) white += 1;
}
renderer.domElement.dataset.axisPixels = JSON.stringify({ red, green, white });
document.documentElement.dataset.ready = 'true';
