import * as THREE from 'three';

const axes = [
  // In the cube's right-handed local frame, +X/+Y/+Z point through R/U/F.
  { name: 'r', direction: new THREE.Vector3(1, 0, 0), color: 0xd9493f },
  { name: 'u', direction: new THREE.Vector3(0, 1, 0), color: 0xf4f4f4 },
  { name: 'f', direction: new THREE.Vector3(0, 0, 1), color: 0x4caf67 },
] as const;

function label(axis: string, color: number, position: THREE.Vector3): THREE.Sprite | undefined {
  if (typeof document === 'undefined') return undefined;
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const context = canvas.getContext('2d');
  if (!context) return undefined;
  context.fillStyle = `#${color.toString(16).padStart(6, '0')}`;
  context.font = 'bold 42px Arial';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(axis.toUpperCase(), 32, 34);

  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: new THREE.CanvasTexture(canvas), depthTest: false, depthWrite: false,
  }));
  sprite.name = `orientation-label-${axis}`;
  sprite.position.copy(position);
  sprite.scale.setScalar(0.27);
  sprite.renderOrder = 1001;
  return sprite;
}

function backdrop(): THREE.Sprite | undefined {
  if (typeof document === 'undefined') return undefined;
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const context = canvas.getContext('2d');
  if (!context) return undefined;
  context.beginPath();
  context.arc(64, 64, 60, 0, Math.PI * 2);
  context.fillStyle = 'rgba(5, 10, 22, 0.88)';
  context.fill();
  context.strokeStyle = 'rgba(255, 255, 255, 0.16)';
  context.lineWidth = 2;
  context.stroke();

  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: new THREE.CanvasTexture(canvas), depthTest: false, depthWrite: false,
  }));
  sprite.name = 'orientation-backdrop';
  sprite.scale.setScalar(1.65);
  sprite.renderOrder = 999;
  return sprite;
}

/** A compact, labelled R/U/F triad in cube-local coordinates. */
export function createOrientationIndicator(includeLabels = true): THREE.Group {
  const indicator = new THREE.Group();
  indicator.name = 'orientation-indicator';
  const indicatorBackdrop = backdrop();
  if (indicatorBackdrop) indicator.add(indicatorBackdrop);

  for (const axis of axes) {
    const arrow = new THREE.ArrowHelper(axis.direction, new THREE.Vector3(), 0.72, axis.color, 0.2, 0.12);
    arrow.name = `orientation-axis-${axis.name}`;
    arrow.renderOrder = 1000;
    arrow.traverse(object => {
      const material = (object as THREE.Mesh | THREE.Line).material;
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
