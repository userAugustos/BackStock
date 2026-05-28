import type { Run } from '@back-stock/api/runs';

export interface RunTreeNode {
  run: Run;
  /** Lineage depth from the root (root = 0). */
  depth: number;
  /** Parent run id, or null for the root. */
  parentId: string | null;
  /** Children ordered by fork point then creation time. */
  children: RunTreeNode[];
}

export interface RunTreeRow {
  run: Run;
  depth: number;
  parentId: string | null;
  /** Flat index of the parent row (for SVG edge anchoring); -1 for the root. */
  parentIndex: number;
  isLast: boolean;
}

function sortChildren(a: RunTreeNode, b: RunTreeNode): number {
  const seqA = a.run.fork_event_seq ?? -1;
  const seqB = b.run.fork_event_seq ?? -1;
  if (seqA !== seqB) return seqA - seqB;
  return a.run.created_at.localeCompare(b.run.created_at);
}

/**
 * Build a parent→children forest from a flat run list. A run with
 * `parent_run_id === null` is a root (the trunk); branches attach to their
 * parent. Orphans (parent missing from the set) are treated as additional roots
 * so nothing is silently dropped.
 */
function buildRunForest(runs: Run[]): RunTreeNode[] {
  const nodes = new Map<string, RunTreeNode>();
  for (const run of runs) {
    nodes.set(run.id, { run, depth: 0, parentId: run.parent_run_id, children: [] });
  }

  const roots: RunTreeNode[] = [];
  for (const node of nodes.values()) {
    const parent = node.parentId ? nodes.get(node.parentId) : undefined;
    if (parent) {
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }

  const assignDepth = (node: RunTreeNode, depth: number): void => {
    node.depth = depth;
    node.children.sort(sortChildren);
    for (const child of node.children) assignDepth(child, depth + 1);
  };

  roots.sort((a, b) => a.run.created_at.localeCompare(b.run.created_at));
  for (const root of roots) assignDepth(root, 0);

  return roots;
}

/** Flatten the forest to a draw order (pre-order DFS) with parent-row anchors. */
function flattenRunForest(roots: RunTreeNode[]): RunTreeRow[] {
  const rows: RunTreeRow[] = [];
  const indexById = new Map<string, number>();

  const visit = (node: RunTreeNode): void => {
    const parentIndex = node.parentId ? (indexById.get(node.parentId) ?? -1) : -1;
    const row: RunTreeRow = {
      run: node.run,
      depth: node.depth,
      parentId: node.parentId,
      parentIndex,
      isLast: false,
    };
    indexById.set(node.run.id, rows.length);
    rows.push(row);
    for (const child of node.children) visit(child);
  };

  for (const root of roots) visit(root);

  const lastChildByParent = new Map<string | null, number>();
  rows.forEach((row, idx) => lastChildByParent.set(row.parentId, idx));
  rows.forEach((row, idx) => {
    row.isLast = lastChildByParent.get(row.parentId) === idx;
  });

  return rows;
}

export function buildRunTreeRows(runs: Run[]): RunTreeRow[] {
  return flattenRunForest(buildRunForest(runs));
}
