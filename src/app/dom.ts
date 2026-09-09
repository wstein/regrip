/** Resolve a required app element with one consistent failure message. */
export function byId<T extends HTMLElement = HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!(element instanceof HTMLElement)) throw new Error(`Missing element #${id}`);
  return element as T;
}
