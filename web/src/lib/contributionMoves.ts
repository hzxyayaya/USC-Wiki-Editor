import { getContributionWorkspace } from './contributionWorkspace';

export interface ContributionMove {
  from: string;
  to: string;
}

const PREFIX = 'uscwiki-editor:moves:';

function storageKey(): string | null {
  const workspace = getContributionWorkspace();
  if (!workspace) return null;
  return `${PREFIX}${workspace.kind === 'existing' ? workspace.review.branch : 'new'}`;
}

export function composeContributionMoves(
  moves: ContributionMove[],
  next: ContributionMove,
): ContributionMove[] {
  const chained = moves.find((move) => move.to === next.from);
  if (!chained) return [...moves.filter((move) => move.from !== next.from), next];
  const rest = moves.filter((move) => move !== chained);
  return chained.from === next.to ? rest : [...rest, { from: chained.from, to: next.to }];
}

export function resolveMovedSourcePath(path: string, moves: ContributionMove[]): string {
  const move = [...moves]
    .sort((a, b) => b.to.length - a.to.length)
    .find((candidate) => path === candidate.to || path.startsWith(`${candidate.to}/`));
  return move ? `${move.from}${path.slice(move.to.length)}` : path;
}

export function loadContributionMoves(): ContributionMove[] {
  const key = storageKey();
  if (!key) return [];
  try {
    const value = JSON.parse(localStorage.getItem(key) ?? '[]') as unknown;
    return Array.isArray(value)
      ? value.filter((move): move is ContributionMove => Boolean(
          move && typeof move === 'object'
          && typeof (move as ContributionMove).from === 'string'
          && typeof (move as ContributionMove).to === 'string',
        ))
      : [];
  } catch {
    return [];
  }
}

export function recordContributionMove(move: ContributionMove): ContributionMove[] {
  const key = storageKey();
  if (!key) throw new Error('请先选择投稿工作区');
  const moves = composeContributionMoves(loadContributionMoves(), move);
  localStorage.setItem(key, JSON.stringify(moves));
  return moves;
}

export function clearContributionMoves(): void {
  const key = storageKey();
  if (key) localStorage.removeItem(key);
}
