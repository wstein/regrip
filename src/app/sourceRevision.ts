export const SOURCE_REPOSITORY_URL = 'https://github.com/wstein/regrip';

export type SourceRevision = Readonly<{
  href: string;
  label: string;
}>;

/** Returns the source revision for a build, falling back to the main branch locally. */
export function sourceRevision(sha: string | undefined): SourceRevision {
  const normalizedSha = sha?.trim();
  if (normalizedSha && /^[0-9a-f]{7,40}$/i.test(normalizedSha)) {
    return {
      href: `${SOURCE_REPOSITORY_URL}/tree/${normalizedSha}`,
      label: `commit ${normalizedSha.slice(0, 7)}`,
    };
  }

  return { href: `${SOURCE_REPOSITORY_URL}/tree/main`, label: 'main branch' };
}
