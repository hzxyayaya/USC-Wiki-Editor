import type { CreateContributionInput } from './github.js';
import {
  assertWritableContributionImagePath,
  assertWritableMarkdownPath,
  assertContributionMovePath,
  isMarkdownPath,
} from './paths.js';

const MAX_FILES = 20;
const MAX_FILE_BYTES = 256 * 1024;
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const MAX_TOTAL_BYTES = 5 * 1024 * 1024;

interface RawContributionInput {
  title?: unknown;
  contributor?: { name?: unknown };
  files?: Array<{ path?: unknown; content?: unknown; encoding?: unknown }>;
  moves?: Array<{ from?: unknown; to?: unknown }>;
  branch?: unknown;
}

export function validateContributionInput(raw: RawContributionInput): CreateContributionInput {
  const title = typeof raw.title === 'string' ? raw.title.trim() : '';
  const contributorName =
    typeof raw.contributor?.name === 'string' ? raw.contributor.name.trim() : '';

  if (!title || title.length > 120) throw new Error('title must contain 1 to 120 characters');
  if (!contributorName || contributorName.length > 80) {
    throw new Error('contributor.name must contain 1 to 80 characters');
  }
  if (!Array.isArray(raw.files) || raw.files.length === 0 || raw.files.length > MAX_FILES) {
    throw new Error(`files must contain 1 to ${MAX_FILES} documents`);
  }

  const seen = new Set<string>();
  let totalBytes = 0;
  const files = raw.files.map((file) => {
    if (typeof file.path !== 'string' || typeof file.content !== 'string') {
      throw new Error('Each file requires string path and content values');
    }
    const markdown = isMarkdownPath(file.path);
    const path = markdown
      ? assertWritableMarkdownPath(file.path)
      : assertWritableContributionImagePath(file.path);
    const key = path.toLowerCase();
    if (seen.has(key)) throw new Error(`Duplicate file path: ${path}`);
    seen.add(key);

    let bytes: number;
    if (markdown) {
      if (file.encoding !== undefined) throw new Error(`Markdown must use UTF-8 content: ${path}`);
      bytes = new TextEncoder().encode(file.content).byteLength;
      if (bytes > MAX_FILE_BYTES) throw new Error(`File exceeds 256 KiB: ${path}`);
    } else {
      if (file.encoding !== 'base64' || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(file.content)) {
        throw new Error(`Image attachment must contain valid base64: ${path}`);
      }
      const padding = file.content.endsWith('==') ? 2 : file.content.endsWith('=') ? 1 : 0;
      bytes = (file.content.length / 4) * 3 - padding;
      if (bytes > MAX_IMAGE_BYTES) throw new Error(`Image exceeds 2 MiB: ${path}`);
    }
    totalBytes += bytes;
    if (totalBytes > MAX_TOTAL_BYTES) throw new Error('Contribution exceeds 5 MiB');
    return { path, content: file.content, ...(markdown ? {} : { encoding: 'base64' as const }) };
  });
  if (!files.some((file) => isMarkdownPath(file.path))) {
    throw new Error('A contribution must include at least one Markdown document');
  }

  const rawMoves = raw.moves ?? [];
  if (!Array.isArray(rawMoves) || rawMoves.length > 100) {
    throw new Error('moves must contain at most 100 items');
  }
  const moveSources = new Set<string>();
  const moveTargets = new Set<string>();
  const moves = rawMoves.map((move) => {
    if (typeof move.from !== 'string' || typeof move.to !== 'string') {
      throw new Error('Each move requires string from and to paths');
    }
    const from = assertContributionMovePath(move.from);
    const to = assertContributionMovePath(move.to);
    if (from === to) throw new Error('Move paths must be different');
    if (to.startsWith(`${from}/`)) throw new Error('A folder cannot be moved inside itself');
    const sourceKey = from.toLowerCase();
    const targetKey = to.toLowerCase();
    if (moveSources.has(sourceKey)) throw new Error(`Duplicate move source: ${from}`);
    if (moveTargets.has(targetKey)) throw new Error(`Duplicate move target: ${to}`);
    for (const source of moveSources) {
      if (source.startsWith(`${sourceKey}/`) || sourceKey.startsWith(`${source}/`)) {
        throw new Error(`Move sources cannot overlap: ${from}`);
      }
    }
    moveSources.add(sourceKey);
    moveTargets.add(targetKey);
    return { from, to };
  });

  let branch: string | undefined;
  if (raw.branch !== undefined) {
    if (typeof raw.branch !== 'string' || !/^contrib\/\d{8}-[a-f0-9]{8}$/.test(raw.branch)) {
      throw new Error('branch must be a contribution branch created by this editor');
    }
    branch = raw.branch;
  }

  return {
    title,
    contributorName,
    files,
    ...(moves.length ? { moves } : {}),
    ...(branch ? { branch } : {}),
  };
}

export function createContributionBranch(
  now: Date = new Date(),
  id: string = crypto.randomUUID(),
): string {
  const date = now.toISOString().slice(0, 10).replaceAll('-', '');
  const safeId = id.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8);
  return `contrib/${date}-${safeId}`;
}
