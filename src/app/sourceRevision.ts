export const SOURCE_REPOSITORY_URL = 'https://github.com/wstein/regrip';

export type SourceRevision = Readonly<{
  href: string;
  label: string;
}>;

const CORE_RELEASE_TAG = /^core-v\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

/** Returns the GitHub release or exact source link for a build revision. */
export function sourceRevision(sha: string, releaseTag?: string): SourceRevision {
  const normalizedTag = releaseTag?.trim();
  if (normalizedTag && CORE_RELEASE_TAG.test(normalizedTag)) {
    return {
      href: `${SOURCE_REPOSITORY_URL}/releases/tag/${normalizedTag}`,
      label: `GitHub@${normalizedTag}`,
    };
  }

  const normalizedSha = sha?.trim();
  if (normalizedSha && /^[0-9a-f]{7,40}$/i.test(normalizedSha)) {
    return {
      href: `${SOURCE_REPOSITORY_URL}/tree/${normalizedSha}`,
      label: `GitHub@${normalizedSha.slice(0, 7)}`,
    };
  }

  return { href: SOURCE_REPOSITORY_URL, label: 'GitHub@unknown' };
}
