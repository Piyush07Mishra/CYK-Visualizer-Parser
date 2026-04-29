import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  parseGrammar,
  toCNF,
  runCYK,
  buildParseTree,
  formatGrammar,
  type CYKResult,
  type ParseTreeNode,
} from "@/lib/cyk";
import { CYKTable } from "@/components/CYKTable";
import { ParseTree } from "@/components/ParseTree";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import {
  Play,
  RotateCcw,
  Sparkles,
  CheckCircle2,
  XCircle,
  StepForward,
  Pause,
  Rewind,
  FastForward,
} from "lucide-react";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "CYK Parser Visualizer — Visualize the Cocke–Younger–Kasami Algorithm" },
      {
        name: "description",
        content:
          "Interactive CYK parser visualizer with step-by-step animation, CNF conversion, parse tree, and grammar editor.",
      },
      { property: "og:title", content: "CYK Parser Visualizer" },
      {
        property: "og:description",
        content:
          "Visualize the CYK parsing algorithm step-by-step with parse trees and CNF conversion.",
      },
    ],
  }),
});

const EXAMPLE_GRAMMAR = `S -> AB | BC
A -> BA | a
B -> CC | b
C -> AB | a`;
const EXAMPLE_STRING = "baaba";

function Index() {
  const [grammarText, setGrammarText] = useState(EXAMPLE_GRAMMAR);
  const [inputString, setInputString] = useState(EXAMPLE_STRING);
  const [result, setResult] = useState<CYKResult | null>(null);
  const [tree, setTree] = useState<ParseTreeNode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stepIdx, setStepIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(600); // ms
  const timerRef = useRef<number | null>(null);

  const run = () => {
    setError(null);
    setPlaying(false);
    try {
      const grammar = parseGrammar(grammarText);
      const cnf = toCNF(grammar);
      const res = runCYK(cnf, inputString);
      setResult(res);
      setTree(buildParseTree(res));
      setStepIdx(res.steps.length); // show fully filled by default
    } catch (e: any) {
      setResult(null);
      setTree(null);
      setError(e.message ?? "Failed to parse grammar");
    }
  };

  const reset = () => {
    setPlaying(false);
    setResult(null);
    setTree(null);
    setError(null);
    setStepIdx(0);
    setGrammarText("");
    setInputString("");
  };

  const loadExample = () => {
    setGrammarText(EXAMPLE_GRAMMAR);
    setInputString(EXAMPLE_STRING);
    setError(null);
  };

  // Animation loop
  useEffect(() => {
    if (!playing || !result) return;
    if (stepIdx >= result.steps.length) {
      setPlaying(false);
      return;
    }
    timerRef.current = window.setTimeout(() => {
      setStepIdx((s) => s + 1);
    }, speed);
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [playing, stepIdx, speed, result]);

  const displayedTable = useMemo(() => {
    if (!result) return [] as string[][][];
    if (stepIdx === 0) {
      const n = result.tokens.length;
      return Array.from({ length: n }, () =>
        Array.from({ length: n }, () => [] as string[])
      );
    }
    const i = Math.min(stepIdx - 1, result.steps.length - 1);
    return result.steps[i].table;
  }, [result, stepIdx]);

  const highlight = useMemo(() => {
    if (!result || !playing || stepIdx === 0 || stepIdx > result.steps.length)
      return null;
    const s = result.steps[stepIdx - 1];
    return { i: s.i, j: s.j };
  }, [result, playing, stepIdx]);

  const cnfText = useMemo(
    () => (result ? formatGrammar(result.cnf) : ""),
    [result]
  );

  const isAtEnd = result ? stepIdx >= result.steps.length : false;

  return (
    <div
      className="min-h-screen"
      style={{ background: "var(--gradient-subtle)" }}
    >
      {/* Header */}
      <header className="border-b bg-background/60 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center"
              style={{ background: "var(--gradient-primary)" }}
            >
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">
                CYK Parser Visualizer
              </h1>
              <p className="text-xs text-muted-foreground">
                Cocke–Younger–Kasami algorithm with step-by-step animation
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={loadExample}>
            <Sparkles className="w-4 h-4 mr-2" />
            Load Example
          </Button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        {/* Input section */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card className="p-6 shadow-sm">
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="grammar" className="text-sm font-semibold">
                  Context-Free Grammar
                </Label>
                <p className="text-xs text-muted-foreground">
                  Use <code className="bg-muted px-1 rounded">→</code> or{" "}
                  <code className="bg-muted px-1 rounded">-&gt;</code>. Uppercase
                  letters are non-terminals. Use <code className="bg-muted px-1 rounded">|</code> for alternatives.
                </p>
                <Textarea
                  id="grammar"
                  value={grammarText}
                  onChange={(e) => setGrammarText(e.target.value)}
                  rows={8}
                  placeholder={"S -> AB | BC\nA -> BA | a"}
                  className="font-mono text-sm"
                />
              </div>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="input" className="text-sm font-semibold">
                    Input String
                  </Label>
                  <Input
                    id="input"
                    value={inputString}
                    onChange={(e) => setInputString(e.target.value)}
                    placeholder="baaba"
                    className="font-mono"
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={run}
                    className="flex-1"
                    style={{ background: "var(--gradient-primary)" }}
                  >
                    <Play className="w-4 h-4 mr-2" />
                    Run CYK Algorithm
                  </Button>
                  <Button variant="outline" onClick={reset}>
                    <RotateCcw className="w-4 h-4 mr-2" />
                    Reset
                  </Button>
                </div>
                {error && (
                  <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    {error}
                  </div>
                )}
                {result && (
                  <div className="rounded-md border bg-muted/40 p-3">
                    <div className="text-xs font-semibold text-muted-foreground mb-1">
                      Grammar in CNF
                    </div>
                    <pre className="text-xs font-mono whitespace-pre-wrap leading-relaxed">
                      {cnfText}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          </Card>
        </motion.div>

        {/* Result */}
        {result && (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <Card
              className="p-6 shadow-sm flex items-center justify-between gap-4"
              style={
                result.accepted
                  ? { background: "var(--gradient-primary)", color: "white" }
                  : undefined
              }
            >
              <div className="flex items-center gap-4">
                {result.accepted ? (
                  <CheckCircle2 className="w-10 h-10" />
                ) : (
                  <XCircle className="w-10 h-10 text-destructive" />
                )}
                <div>
                  <div className="text-2xl font-bold tracking-tight">
                    {result.accepted ? "Accepted" : "Rejected"}
                  </div>
                  <div
                    className={
                      result.accepted
                        ? "text-sm opacity-90"
                        : "text-sm text-muted-foreground"
                    }
                  >
                    {result.accepted
                      ? `Start symbol "${result.startSymbol}" derives "${inputString}"`
                      : `String cannot be derived from start symbol "${result.startSymbol}"`}
                  </div>
                </div>
              </div>
              <Badge
                variant="outline"
                className={
                  result.accepted
                    ? "bg-white/20 text-white border-white/30"
                    : ""
                }
              >
                |w| = {result.tokens.length}
              </Badge>
            </Card>
          </motion.div>
        )}

        {/* CYK Table */}
        {result && (
          <Card className="p-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
              <div>
                <h2 className="text-lg font-semibold">CYK Table</h2>
                <p className="text-xs text-muted-foreground">
                  Bottom-up dynamic programming · row = substring length
                </p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setPlaying(false);
                    setStepIdx(0);
                  }}
                >
                  <Rewind className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setPlaying(false);
                    setStepIdx((s) => Math.max(0, s - 1));
                  }}
                  disabled={stepIdx === 0}
                >
                  <StepForward className="w-4 h-4 rotate-180" />
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    if (isAtEnd) {
                      setStepIdx(0);
                      setPlaying(true);
                    } else {
                      setPlaying((p) => !p);
                    }
                  }}
                  style={{ background: "var(--gradient-primary)" }}
                >
                  {playing ? (
                    <Pause className="w-4 h-4" />
                  ) : (
                    <Play className="w-4 h-4" />
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setPlaying(false);
                    setStepIdx((s) =>
                      Math.min(result.steps.length, s + 1)
                    );
                  }}
                  disabled={stepIdx >= result.steps.length}
                >
                  <StepForward className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setPlaying(false);
                    setStepIdx(result.steps.length);
                  }}
                >
                  <FastForward className="w-4 h-4" />
                </Button>
                <div className="flex items-center gap-2 ml-2 min-w-[140px]">
                  <span className="text-xs text-muted-foreground">Speed</span>
                  <Slider
                    value={[1200 - speed]}
                    min={100}
                    max={1100}
                    step={50}
                    onValueChange={(v) => setSpeed(1200 - v[0])}
                    className="w-24"
                  />
                </div>
              </div>
            </div>
            <div className="text-xs text-muted-foreground mb-3">
              Step {Math.min(stepIdx, result.steps.length)} /{" "}
              {result.steps.length}
            </div>
            <CYKTable
              tokens={result.tokens}
              table={displayedTable}
              highlight={highlight}
              startSymbol={result.startSymbol}
            />
            <div className="flex flex-wrap gap-4 mt-4 text-xs text-muted-foreground">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-muted border" />
                Empty
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-warning/40 border border-warning" />
                Processing
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-success/20 border border-success/40" />
                Filled
              </div>
              <div className="flex items-center gap-2">
                <div
                  className="w-4 h-4 rounded border"
                  style={{ background: "var(--gradient-primary)" }}
                />
                Contains start symbol
              </div>
            </div>
          </Card>
        )}

        {/* Parse tree */}
        {result && (
          <Card className="p-6 shadow-sm">
            <div className="mb-4">
              <h2 className="text-lg font-semibold">Parse Tree</h2>
              <p className="text-xs text-muted-foreground">
                Reconstructed from backpointers (drag to pan, scroll to zoom)
              </p>
            </div>
            <ParseTree tree={tree} />
          </Card>
        )}

        {/* Footer */}
        <footer className="text-center text-xs text-muted-foreground py-4">
          Built with React, TanStack Start, and React Flow · CYK runs in{" "}
          <code>O(n³ · |G|)</code>
        </footer>
      </main>
    </div>
  );
}
