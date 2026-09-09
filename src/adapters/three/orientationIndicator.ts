import * as THREE from 'three';

type ColorMaterial = THREE.Material & { color?: THREE.Color };

const axes = [
  // In the cube's right-handed local frame, +X/+Y/+Z point through R/U/F.
  { name: 'r', direction: new THREE.Vector3(1, 0, 0), color: 0xd9493f },
  { name: 'u', direction: new THREE.Vector3(0, 1, 0), color: 0xf4f4f4 },
  { name: 'f', direction: new THREE.Vector3(0, 0, 1), color: 0x4caf67 },
] as const;

export type OrientationIndicatorColors = Record<(typeof axes)[number]['name'], number>;

function label(axis: string, color: number, position: THREE.Vector3): THREE.Sprite | undefined {
  if (typeof document === 'undefined') return undefined;
  const canvas = document.createElement('canvas');
  canvas.width = 96;
  canvas.height = 96;
  const context = canvas.getContext('2d');
  if (!context) return undefined;
  context.fillStyle = '#ffffff';
  context.font = 'bold 54px Arial';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(axis.toUpperCase(), 48, 50);

  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: new THREE.CanvasTexture(canvas),
      color,
      depthTest: false,
      depthWrite: false,
    }),
  );
  sprite.name = `orientation-label-${axis}`;
  sprite.position.copy(position);
  sprite.scale.setScalar(0.34);
  sprite.renderOrder = 1001;
  return sprite;
}

/** A compact, labelled R/U/F triad in cube-local coordinates. */
export function createOrientationIndicator(includeLabels = true): THREE.Group {
  const indicator = new THREE.Group();
  indicator.name = 'orientation-indicator';

  for (const axis of axes) {
    // LineBasicMaterial width is ignored by WebGL on most platforms. Model
    // each arrow with meshes so all three axes stay legible at any DPI.
    const arrow = new THREE.Group();
    arrow.name = `orientation-axis-${axis.name}`;
    const material = new THREE.MeshBasicMaterial({
      color: axis.color,
      depthTest: false,
      depthWrite: false,
    });
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.62, 10), material);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.2, 10), material);
    const rotation = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      axis.direction,
    );
    shaft.quaternion.copy(rotation);
    tip.quaternion.copy(rotation);
    shaft.position.copy(axis.direction).multiplyScalar(0.31);
    tip.position.copy(axis.direction).multiplyScalar(0.69);
    shaft.renderOrder = 1000;
    tip.renderOrder = 1000;
    arrow.add(shaft, tip);
    arrow.traverse((object) => {
      const material = (object as THREE.Mesh | THREE.Line).material as
        ColorMaterial | ColorMaterial[];
      if (material) {
        const materials = Array.isArray(material) ? material : [material];
        materials.forEach((value) => {
          value.depthTest = false;
          value.depthWrite = false;
        });
      }
    });
    indicator.add(arrow);
    if (includeLabels) {
      const axisLabel = label(axis.name, axis.color, axis.direction.clone().multiplyScalar(0.98));
      if (axisLabel) indicator.add(axisLabel);
    }
  }
  return indicator;
}

/** Recolor logical R/U/F axes to match their current physical facelets. */
export function setOrientationIndicatorColors(
  indicator: THREE.Group,
  colors: OrientationIndicatorColors,
): void {
  for (const axis of axes) {
    const color = colors[axis.name];
    indicator.getObjectByName(`orientation-axis-${axis.name}`)?.traverse((object) => {
      const material = (object as THREE.Mesh | THREE.Line).material as
        ColorMaterial | ColorMaterial[];
      if (!material) return;
      (Array.isArray(material) ? material : [material]).forEach((value) =>
        value.color?.setHex(color),
      );
    });
    const axisLabel = indicator.getObjectByName(`orientation-label-${axis.name}`);
    if (axisLabel instanceof THREE.Sprite) axisLabel.material.color.setHex(color);
  }
}
