// CYK algorithm + CFG to CNF conversion utilities

export type Production = { lhs: string; rhs: string[] };
export type Grammar = { productions: Production[]; start: string };
export type CYKCell = Set<string>;
export type CYKTable = CYKCell[][];
export type BackPointer = {
  nt: string;
  // either terminal production
  terminal?: string;
  // or split into two
  split?: { k: number; left: string; right: string };
};
// table of backpointers per cell, keyed by non-terminal
export type BackTable = Map<string, BackPointer>[][];

export type ParseTreeNode = {
  id: string;
  label: string;
  children: ParseTreeNode[];
};

const ARROWS = /->|→|::=/;
const PRODUCTION_RE = /^\s*([A-Z][A-Z0-9_']*)\s*(?:->|→|::=)\s*(.+)$/;
const IMPLICIT_RE = /^\s*([A-Z][A-Z0-9_']*)\s+(.+)$/;

export function parseGrammar(input: string): Grammar {
  const lines = input
    .split(/\n+/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"));

  if (lines.length === 0) throw new Error("Grammar is empty");

  const productions: Production[] = [];
  let start: string | null = null;

  for (const line of lines) {
    const match = line.match(PRODUCTION_RE);
    const implicitMatch = !match ? line.match(IMPLICIT_RE) : null;

    let lhs: string;
    let rhsRaw: string;

    if (match) {
      lhs = match[1];
      rhsRaw = match[2];
    } else if (implicitMatch) {
      lhs = implicitMatch[1];
      rhsRaw = implicitMatch[2];
    } else {
      throw new Error(
        `Invalid production line: "${line}". Use ">" or "→" between the LHS and RHS, or write "S AB" as shorthand.`
      );
    }

    if (!lhs) throw new Error(`Missing LHS in line: "${line}"`);
    if (!/^[A-Z][A-Z0-9_']*$/.test(lhs)) {
      throw new Error(`LHS "${lhs}" must be an uppercase non-terminal`);
    }

    if (!start) start = lhs;

    rhsRaw = rhsRaw.trim();
    if (!rhsRaw.includes("|") && rhsRaw.includes(" ")) {
      rhsRaw = rhsRaw.split(/\s+/).filter(Boolean).join(" | ");
    }

    const alternatives = rhsRaw.split("|").map((a) => a.trim());

    for (const alt of alternatives) {
      if (alt === "" || alt === "ε" || alt === "epsilon") {
        productions.push({ lhs, rhs: [] });
        continue;
      }

      const tokens: string[] = [];

      if (alt.includes(" ")) {
        // If user writes tokens with spaces, respect them.
        // Example: A B  or  A1 B2
        tokens.push(...alt.split(/\s+/).filter(Boolean));
      } else {
        // If user writes compact style like AB, split uppercase symbols one by one.
        // Lowercase / terminals remain single-character terminals.
        // Examples:
        //   AB  -> ["A", "B"]
        //   a   -> ["a"]
        //   BA  -> ["B", "A"]
        for (const ch of alt) {
          tokens.push(ch);
        }
      }

      productions.push({ lhs, rhs: tokens });
    }
  }

  return { productions, start: start! };
}

function isNonTerminal(sym: string) {
  return /^[A-Z][A-Z0-9_']*$/.test(sym);
}

export function toCNF(grammar: Grammar): Grammar {
  let prods = grammar.productions.map((p) => ({ lhs: p.lhs, rhs: [...p.rhs] }));
  const start = grammar.start;

  // Step 1: Add new start symbol
  const newStart = "S0";
  prods.unshift({ lhs: newStart, rhs: [start] });

  // Step 2: Remove epsilon productions
  const nullable = new Set<string>();
  let changed = true;
  while (changed) {
    changed = false;
    for (const p of prods) {
      if (nullable.has(p.lhs)) continue;
      if (p.rhs.length === 0 || p.rhs.every((s) => nullable.has(s))) {
        nullable.add(p.lhs);
        changed = true;
      }
    }
  }

  const newProds: Production[] = [];
  for (const p of prods) {
    if (p.rhs.length === 0) continue; // drop epsilon (we'll handle start specially)

    // Generate all combinations omitting nullable symbols
    const positions: number[] = [];
    p.rhs.forEach((s, idx) => {
      if (nullable.has(s)) positions.push(idx);
    });

    const subsets = 1 << positions.length;
    for (let mask = 0; mask < subsets; mask++) {
      const omit = new Set<number>();
      for (let b = 0; b < positions.length; b++) {
        if (mask & (1 << b)) omit.add(positions[b]);
      }
      const rhs = p.rhs.filter((_, idx) => !omit.has(idx));
      if (rhs.length === 0) continue;
      newProds.push({ lhs: p.lhs, rhs });
    }
  }

  prods = newProds;
  if (nullable.has(start)) {
    prods.push({ lhs: newStart, rhs: [] });
  }

  // Step 3: Remove unit productions
  const dedupe = (ps: Production[]) => {
    const seen = new Set<string>();
    return ps.filter((p) => {
      const k = p.lhs + "→" + p.rhs.join(",");
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  };

  prods = dedupe(prods);

  let unitChanged = true;
  while (unitChanged) {
    unitChanged = false;
    const next: Production[] = [];

    for (const p of prods) {
      if (p.rhs.length === 1 && isNonTerminal(p.rhs[0])) {
        const target = p.rhs[0];
        for (const q of prods) {
          if (q.lhs === target) {
            if (q.rhs.length === 1 && q.rhs[0] === p.lhs) continue;
            next.push({ lhs: p.lhs, rhs: [...q.rhs] });
          }
        }
      } else {
        next.push(p);
      }
    }

    const before = prods.length;
    prods = dedupe(next);
    if (prods.length !== before) unitChanged = true;

    if (!prods.some((p) => p.rhs.length === 1 && isNonTerminal(p.rhs[0]))) {
      unitChanged = false;
    }
  }

  // Step 4: Replace terminals in long rules with new non-terminals
  const termMap = new Map<string, string>();
  const getTermNT = (t: string) => {
    if (!termMap.has(t)) {
      termMap.set(t, `T_${t.charCodeAt(0)}`);
    }
    return termMap.get(t)!;
  };

  const stage4: Production[] = [];
  for (const p of prods) {
    if (p.rhs.length >= 2) {
      const newRhs = p.rhs.map((s) => {
        if (!isNonTerminal(s)) return getTermNT(s);
        return s;
      });
      stage4.push({ lhs: p.lhs, rhs: newRhs });
    } else {
      stage4.push(p);
    }
  }

  termMap.forEach((nt, t) => {
    stage4.push({ lhs: nt, rhs: [t] });
  });
  prods = stage4;

  // Step 5: Binarize rules with > 2 symbols
  let binCounter = 0;
  const binarized: Production[] = [];
  for (const p of prods) {
    if (p.rhs.length <= 2) {
      binarized.push(p);
      continue;
    }

    const symbols = [...p.rhs];
    let currentLhs = p.lhs;

    while (symbols.length > 2) {
      const newNT = `X${binCounter++}`;
      binarized.push({ lhs: currentLhs, rhs: [symbols[0], newNT] });
      symbols.shift();
      currentLhs = newNT;
    }

    binarized.push({ lhs: currentLhs, rhs: symbols });
  }

  return { productions: dedupe(binarized), start: newStart };
}

export type CYKStep = {
  i: number; // row (length - 1)
  j: number; // start position
  added: string[];
  table: string[][][]; // snapshot table[i][j] = array of NTs
};

export type CYKResult = {
  accepted: boolean;
  table: CYKTable;
  back: BackTable;
  steps: CYKStep[];
  cnf: Grammar;
  tokens: string[];
  startSymbol: string;
};

export function runCYK(cnf: Grammar, input: string): CYKResult {
  const tokens = input.split("");
  const n = tokens.length;

  const table: CYKTable = Array.from({ length: n }, () =>
    Array.from({ length: n }, () => new Set<string>())
  );

  const back: BackTable = Array.from({ length: n }, () =>
    Array.from({ length: n }, () => new Map())
  );

  const steps: CYKStep[] = [];

  if (n === 0) {
    const acceptsEmpty = cnf.productions.some((p) => p.lhs === cnf.start && p.rhs.length === 0);
    return {
      accepted: acceptsEmpty,
      table,
      back,
      steps,
      cnf,
      tokens,
      startSymbol: cnf.start,
    };
  }

  const snapshot = (): string[][][] =>
    table.map((row) => row.map((cell) => Array.from(cell)));

  // Length 1
  for (let j = 0; j < n; j++) {
    const added: string[] = [];
    for (const p of cnf.productions) {
      if (p.rhs.length === 1 && p.rhs[0] === tokens[j]) {
        if (!table[0][j].has(p.lhs)) {
          table[0][j].add(p.lhs);
          back[0][j].set(p.lhs, { nt: p.lhs, terminal: tokens[j] });
          added.push(p.lhs);
        }
      }
    }
    steps.push({ i: 0, j, added, table: snapshot() });
  }

  // Length >= 2
  for (let len = 2; len <= n; len++) {
    for (let j = 0; j <= n - len; j++) {
      const added: string[] = [];
      for (let k = 1; k < len; k++) {
        const left = table[k - 1][j];
        const right = table[len - k - 1][j + k];
        if (left.size === 0 || right.size === 0) continue;

        for (const p of cnf.productions) {
          if (p.rhs.length !== 2) continue;
          if (left.has(p.rhs[0]) && right.has(p.rhs[1])) {
            if (!table[len - 1][j].has(p.lhs)) {
              table[len - 1][j].add(p.lhs);
              back[len - 1][j].set(p.lhs, {
                nt: p.lhs,
                split: { k, left: p.rhs[0], right: p.rhs[1] },
              });
              added.push(p.lhs);
            }
          }
        }
      }
      steps.push({ i: len - 1, j, added, table: snapshot() });
    }
  }

  const accepted = table[n - 1][0].has(cnf.start);
  return {
    accepted,
    table,
    back,
    steps,
    cnf,
    tokens,
    startSymbol: cnf.start,
  };
}

let nodeIdCounter = 0;
function nid() {
  return `n${nodeIdCounter++}`;
}

export function buildParseTree(result: CYKResult): ParseTreeNode | null {
  if (!result.accepted) return null;

  nodeIdCounter = 0;
  const { back, tokens, startSymbol } = result;
  const n = tokens.length;
  if (n === 0) return null;

  const build = (i: number, j: number, nt: string): ParseTreeNode => {
    const bp = back[i][j].get(nt);
    const node: ParseTreeNode = { id: nid(), label: nt, children: [] };

    if (!bp) return node;

    if (bp.terminal !== undefined) {
      node.children.push({ id: nid(), label: bp.terminal, children: [] });
      return node;
    }

    if (bp.split) {
      const { k, left, right } = bp.split;
      const leftNode = build(k - 1, j, left);
      const rightNode = build(i - k, j + k, right);
      node.children.push(leftNode, rightNode);
    }

    return node;
  };

  return build(n - 1, 0, startSymbol);
}

export function formatGrammar(g: Grammar): string {
  // Group productions by LHS
  const map = new Map<string, string[][]>();
  for (const p of g.productions) {
    if (!map.has(p.lhs)) map.set(p.lhs, []);
    map.get(p.lhs)!.push(p.rhs);
  }

  const lines: string[] = [];

  // Ensure start symbol comes first
  const ordered = [g.start, ...Array.from(map.keys()).filter((k) => k !== g.start)];

  for (const lhs of ordered) {
    const rhss = map.get(lhs);
    if (!rhss) continue;

    const rhsStr = rhss
      .map((r) => (r.length === 0 ? "ε" : r.join(" ")))
      .join(" | ");

    lines.push(`${lhs} → ${rhsStr}`);
  }

  return lines.join("\n");
}