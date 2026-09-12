export const SOURCE_REPOSITORY_URL = 'https://github.com/wstein/regrip';

export type SourceRevision = Readonly<{
  href: string;
  label: string;
}>;

/** Returns the exact GitHub source link for a build revision. */
export function sourceRevision(sha: string): SourceRevision {
  const normalizedSha = sha?.trim();
  if (normalizedSha && /^[0-9a-f]{7,40}$/i.test(normalizedSha)) {
    return {
      href: `${SOURCE_REPOSITORY_URL}/tree/${normalizedSha}`,
      label: `GitHub@${normalizedSha.slice(0, 7)}`,
    };
  }

  return { href: SOURCE_REPOSITORY_URL, label: 'GitHub@unknown' };
}
