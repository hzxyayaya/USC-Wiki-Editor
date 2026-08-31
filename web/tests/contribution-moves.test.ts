import assert from 'node:assert/strict';
import test from 'node:test';
import {
  composeContributionMoves,
  resolveMovedSourcePath,
} from '../src/lib/contributionMoves.js';

test('composes repeated moves back to the original source path', () => {
  const first = composeContributionMoves([], {
    from: 'docs/旧目录/a.md',
    to: 'docs/中间目录/a.md',
  });
  const second = composeContributionMoves(first, {
    from: 'docs/中间目录/a.md',
    to: 'docs/新目录/a.md',
  });

  assert.deepEqual(second, [{
    from: 'docs/旧目录/a.md',
    to: 'docs/新目录/a.md',
  }]);
  assert.equal(resolveMovedSourcePath('docs/新目录/a.md', second), 'docs/旧目录/a.md');
});

test('removes a pending move when an item returns to its original path', () => {
  const moves = composeContributionMoves([
    { from: 'docs/旧目录', to: 'docs/新目录' },
  ], { from: 'docs/新目录', to: 'docs/旧目录' });

  assert.deepEqual(moves, []);
});

test('resolves a file through a moved parent folder', () => {
  assert.equal(resolveMovedSourcePath('docs/新目录/子目录/a.md', [
    { from: 'docs/旧目录', to: 'docs/新目录' },
  ]), 'docs/旧目录/子目录/a.md');
});
