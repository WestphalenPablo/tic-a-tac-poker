export type Commit = { sha: string; subject: string };

/** Commit subjects newer than `current` (list is newest first). If `current` isn't listed, everything is returned. */
export function commitsSince(commits: readonly Commit[], current: string): string[] {
  const i = commits.findIndex((c) => c.sha === current);
  return (i < 0 ? commits : commits.slice(0, i)).map((c) => c.subject);
}
