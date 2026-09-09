import type { SensorToBody } from '../../domain/SensorToBody.res.mjs';

const axes = new Set(['x', 'y', 'z']);

/** Parse profile syntax such as `x,z,-y,w`; the final `w` is required. */
export function parseSensorToBodyAxisMap(value: string | undefined): SensorToBody | undefined {
  if (!value) return undefined;
  const parts = value.split(',').map((part) => part.trim());
  if (parts.length !== 4 || parts[3] !== 'w') return undefined;
  const components = parts.slice(0, 3).map((part) => {
    const negative = part.startsWith('-');
    const axis = negative ? part.slice(1) : part;
    return axes.has(axis)
      ? { axis: axis.toUpperCase() as 'X' | 'Y' | 'Z', sign: negative ? -1 : 1 }
      : undefined;
  });
  if (components.some((component) => !component)) return undefined;
  const [x, y, z] = components as SensorToBody['x'][];
  if (new Set([x.axis, y.axis, z.axis]).size !== 3) return undefined;
  return { x, y, z };
}
