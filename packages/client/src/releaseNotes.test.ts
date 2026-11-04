import { describe, expect, it } from 'vitest';
import { commitsSince } from './releaseNotes';

const log = [{ sha: 'c', subject: 'C' }, { sha: 'b', subject: 'B' }, { sha: 'a', subject: 'A' }];

describe('commitsSince', () => {
  it('lists commits newer than the running build', () => expect(commitsSince(log, 'a')).toEqual(['C', 'B']));
  it('is empty when the build is already the newest', () => expect(commitsSince(log, 'c')).toEqual([]));
  it('returns everything when the build is not in the list', () => expect(commitsSince(log, 'zzz')).toEqual(['C', 'B', 'A']));
  it('handles an empty list', () => expect(commitsSince([], 'a')).toEqual([]));
});
