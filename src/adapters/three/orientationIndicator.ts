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
  canvas.width = 64;
  canvas.height = 64;
  const context = canvas.getContext('2d');
  if (!context) return undefined;
  context.fillStyle = '#ffffff';
  context.font = 'bold 42px Arial';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(axis.toUpperCase(), 32, 34);

  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: new THREE.CanvasTexture(canvas), color, depthTest: false, depthWrite: false,
  }));
  sprite.name = `orientation-label-${axis}`;
  sprite.position.copy(position);
  sprite.scale.setScalar(0.27);
  sprite.renderOrder = 1001;
  return sprite;
}

/** A compact, labelled R/U/F triad in cube-local coordinates. */
export function createOrientationIndicator(includeLabels = true): THREE.Group {
  const indicator = new THREE.Group();
  indicator.name = 'orientation-indicator';

  for (const axis of axes) {
    const arrow = new THREE.ArrowHelper(axis.direction, new THREE.Vector3(), 0.72, axis.color, 0.2, 0.12);
    arrow.name = `orientation-axis-${axis.name}`;
    arrow.renderOrder = 1000;
    arrow.traverse(object => {
      const material = (object as THREE.Mesh | THREE.Line).material as ColorMaterial | ColorMaterial[];
      if (material) {
        const materials = Array.isArray(material) ? material : [material];
        materials.forEach(value => {
          value.depthTest = false;
          value.depthWrite = false;
        });
      }
    });
    indicator.add(arrow);
    if (includeLabels) {
      const axisLabel = label(axis.name, axis.color, axis.direction.clone().multiplyScalar(0.92));
      if (axisLabel) indicator.add(axisLabel);
    }
  }
  return indicator;
}

/** Recolor logical R/U/F axes to match their current physical facelets. */
export function setOrientationIndicatorColors(indicator: THREE.Group, colors: OrientationIndicatorColors): void {
  for (const axis of axes) {
    const color = colors[axis.name];
    indicator.getObjectByName(`orientation-axis-${axis.name}`)?.traverse(object => {
      const material = (object as THREE.Mesh | THREE.Line).material as ColorMaterial | ColorMaterial[];
      if (!material) return;
      (Array.isArray(material) ? material : [material]).forEach(value => value.color?.setHex(color));
    });
    const axisLabel = indicator.getObjectByName(`orientation-label-${axis.name}`);
    if (axisLabel instanceof THREE.Sprite) axisLabel.material.color.setHex(color);
  }
}
