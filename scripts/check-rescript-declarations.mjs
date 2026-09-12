import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

function resiFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return resiFiles(path);
    return entry.name.endsWith('.resi') ? [path] : [];
  });
}

const failures = [];
const rescriptTools = join(process.cwd(), 'node_modules', 'rescript', 'cli', 'rescript-tools.js');

function topLevelParameters(parameters) {
  const values = [];
  let depth = 0;
  let current = '';
  for (const character of parameters) {
    if ('([{<'.includes(character)) depth += 1;
    else if (')]}>'.includes(character)) depth -= 1;
    if (character === ',' && depth === 0) {
      if (current.trim()) values.push(current.trim());
      current = '';
    } else {
      current += character;
    }
  }
  if (current.trim()) values.push(current.trim());
  return values;
}

function documentedArity(signature) {
  const colon = signature.indexOf(':');
  if (colon === -1) return undefined;
  const type = signature.slice(colon + 1).trim();
  let depth = 0;
  let arrow = -1;
  for (let index = 0; index < type.length - 1; index += 1) {
    const character = type[index];
    if ('([{<'.includes(character)) depth += 1;
    else if (')]}>'.includes(character)) depth -= 1;
    if (depth === 0 && character === '=' && type[index + 1] === '>') {
      arrow = index;
      break;
    }
  }
  if (arrow === -1) return undefined;
  let input = type.slice(0, arrow).trim();
  if (input === 'unit') return 0;
  if (input.startsWith('(') && input.endsWith(')')) input = input.slice(1, -1);
  return topLevelParameters(input).length;
}

function documentedValues(resiPath, rescriptTools) {
  const output = execFileSync(process.execPath, [rescriptTools, 'doc', resiPath], {
    encoding: 'utf8',
  });
  const document = JSON.parse(output);
  return document.items
    .filter((item) => item.kind === 'value')
    .map((item) => {
      return { name: item.name, arity: documentedArity(item.signature) };
    });
}

function declarationArity(declaration, value) {
  const match = new RegExp(
    `export\\s+function\\s+${value}(?:<[^>]*>)?\\s*\\(([\\s\\S]*?)\\)\\s*:`,
  ).exec(declaration);
  if (!match) return undefined;
  return topLevelParameters(match[1]).length;
}

/** Produce a compilable placeholder for a value missing from a `.res.d.mts` bridge. */
export function missingDeclarationStub({ name, arity }) {
  if (arity === undefined) return `export const ${name}: unknown;`;
  const parameters = Array.from({ length: arity }, (_, index) => `arg${index + 1}: unknown`);
  return `export function ${name}(${parameters.join(', ')}): unknown;`;
}

/** Return declaration-bridge failures for all ReScript interfaces in the repository. */
export function checkRescriptDeclarations(cwd = process.cwd()) {
  const failures = [];
  const rescriptTools = join(cwd, 'node_modules', 'rescript', 'cli', 'rescript-tools.js');
  const sourceRoots = [join(cwd, 'src'), join(cwd, 'packages', 'core', 'src')];

  for (const sourceRoot of sourceRoots) {
    for (const resiPath of resiFiles(sourceRoot)) {
      const declarationPath = resiPath.replace(/\.resi$/, '.res.d.mts');
      let declaration = '';
      try {
        declaration = readFileSync(declarationPath, 'utf8');
      } catch {
        failures.push(`${resiPath}: missing ${declarationPath}`);
        continue;
      }
      for (const { name: value, arity } of documentedValues(resiPath, rescriptTools)) {
        const exported =
          new RegExp(`export\\s+(?:const|function)\\s+${value}\\b`).test(declaration) ||
          new RegExp(`as ${value}[ };]`).test(declaration);
        if (!exported) {
          failures.push(
            `${resiPath}: ${value} is absent from ${declarationPath}\n` +
              `  Add: ${missingDeclarationStub({ name: value, arity })}`,
          );
          continue;
        }
        if (arity !== undefined) {
          const actualArity = declarationArity(declaration, value);
          if (actualArity === undefined) {
            failures.push(
              `${resiPath}: ${value} has ${arity} arguments but is not a function in ${declarationPath}`,
            );
          } else if (actualArity !== arity) {
            failures.push(
              `${resiPath}: ${value} has ${arity} arguments in the ReScript interface but ${actualArity} in ${declarationPath}`,
            );
          }
        }
      }
    }
  }

  return failures;
}

export function main() {
  const failures = checkRescriptDeclarations();
  if (failures.length) throw new Error(`ReScript declaration drift:\n${failures.join('\n')}`);
  console.log('ReScript declaration exports and arities verified via rescript-tools doc.');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
