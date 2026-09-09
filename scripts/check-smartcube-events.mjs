import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const typesPath = join(
  process.cwd(),
  'node_modules/smartcube-web-bluetooth/src/smartcube/types.ts',
);
const source = readFileSync(typesPath, 'utf8');
const expected = JSON.parse(
  readFileSync(new URL('../src/session/handledSmartCubeEventTypes.json', import.meta.url), 'utf8'),
);

const union = source.match(
  /type SmartCubeEventMessage\s*=\s*([\s\S]*?);\s*\n\s*type SmartCubeEvent\b/,
);
if (!union) throw new Error(`Unable to locate SmartCubeEventMessage in ${typesPath}`);

const eventDefinitions = [...union[1].matchAll(/SmartCube(\w+)Event/g)].map((match) => match[0]);
const actual = eventDefinitions
  .map((name) => {
    const definition = source.match(new RegExp(`type ${name}\\s*=\\s*\\{([\\s\\S]*?)\\n\\};`));
    const type = definition?.[1].match(/type:\s*"([A-Z_]+)"/);
    if (!type) throw new Error(`Unable to find discriminant for ${name} in ${typesPath}`);
    return type[1];
  })
  .sort();
const snapshot = [...expected].sort();

if (JSON.stringify(actual) !== JSON.stringify(snapshot)) {
  throw new Error(
    `Unhandled smartcube event type change.\nExpected: ${snapshot.join(', ')}\nInstalled: ${actual.join(', ')}\nUpdate src/session/handledSmartCubeEventTypes.json and the session event handling deliberately.`,
  );
}

console.log(`Smartcube event types verified: ${actual.join(', ')}`);
