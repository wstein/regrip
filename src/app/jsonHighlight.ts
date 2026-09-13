/** Render JSON syntax highlighting with textContent-only nodes. */
export function highlightJson(jsonString: string): DocumentFragment {
  const fragment = document.createDocumentFragment();
  const tokenRegex =
    /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(?:true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?|[{}[\],:]|[^\s{}[\],:]+|\s+)/g;

  let match: RegExpExecArray | null;
  while ((match = tokenRegex.exec(jsonString)) !== null) {
    const token = match[0];
    if (!token) continue;

    if (token.startsWith('"')) {
      if (token.endsWith(':')) {
        const colonIndex = token.lastIndexOf(':');
        const keyPart = token.slice(0, colonIndex).trimEnd();
        const punctPart = token.slice(keyPart.length);
        const keySpan = document.createElement('span');
        keySpan.className = 'json-key';
        keySpan.textContent = keyPart;
        fragment.appendChild(keySpan);

        const colonSpan = document.createElement('span');
        colonSpan.className = 'json-punct';
        colonSpan.textContent = punctPart;
        fragment.appendChild(colonSpan);
      } else {
        const strSpan = document.createElement('span');
        strSpan.className = 'json-string';
        strSpan.textContent = token;
        fragment.appendChild(strSpan);
      }
    } else if (token === 'true' || token === 'false') {
      const boolSpan = document.createElement('span');
      boolSpan.className = 'json-boolean';
      boolSpan.textContent = token;
      fragment.appendChild(boolSpan);
    } else if (token === 'null') {
      const nullSpan = document.createElement('span');
      nullSpan.className = 'json-null';
      nullSpan.textContent = token;
      fragment.appendChild(nullSpan);
    } else if (/^-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?$/.test(token)) {
      const numSpan = document.createElement('span');
      numSpan.className = 'json-number';
      numSpan.textContent = token;
      fragment.appendChild(numSpan);
    } else if (/^[{}[\],:]$/.test(token)) {
      const punctSpan = document.createElement('span');
      punctSpan.className = 'json-punct';
      punctSpan.textContent = token;
      fragment.appendChild(punctSpan);
    } else {
      fragment.appendChild(document.createTextNode(token));
    }
  }
  return fragment;
}
