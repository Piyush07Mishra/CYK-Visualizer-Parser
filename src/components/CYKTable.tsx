import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface Props {
  tokens: string[];
  table: string[][][]; // table[i][j] = NTs
  highlight?: { i: number; j: number } | null;
  startSymbol: string;
}

export function CYKTable({ tokens, table, highlight, startSymbol }: Props) {
  const n = tokens.length;
  if (n === 0) {
    return (
      <div className="text-sm text-muted-foreground italic">
        Enter a string to see the CYK table.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <div className="inline-block min-w-full">
        {/* Header: input string */}
        <div className="flex gap-1 mb-2 ml-12">
          {tokens.map((t, idx) => (
            <div
              key={idx}
              className="w-20 h-8 flex items-center justify-center font-mono text-sm font-semibold text-primary"
            >
              {t}
            </div>
          ))}
        </div>

        {/* Rows: from i = n-1 (top, length n) down to i = 0 (bottom, length 1) */}
        {Array.from({ length: n }, (_, rowIdx) => {
          // We render with the longest substring at the top
          const i = n - 1 - rowIdx;
          const len = i + 1;
          return (
            <div key={i} className="flex gap-1 mb-1 items-center">
              <div className="w-10 text-xs text-muted-foreground font-mono text-right pr-2">
                {len}
              </div>
              {Array.from({ length: n - i }, (_, j) => {
                const cell = table[i]?.[j] ?? [];
                const isHighlighted =
                  highlight && highlight.i === i && highlight.j === j;
                const isEmpty = cell.length === 0;
                const isTopCell = i === n - 1 && j === 0;
                const hasStart = isTopCell && cell.includes(startSymbol);

                return (
                  <motion.div
                    key={`${i}-${j}`}
                    initial={false}
                    animate={{
                      scale: isHighlighted ? 1.05 : 1,
                    }}
                    transition={{ duration: 0.2 }}
                    className={cn(
                      "w-20 min-h-14 rounded-md border flex flex-wrap items-center justify-center gap-1 p-1 text-xs font-mono transition-colors",
                      isHighlighted &&
                        "bg-warning/30 border-warning shadow-elegant",
                      !isHighlighted &&
                        isEmpty &&
                        "bg-muted/50 border-border text-muted-foreground",
                      !isHighlighted &&
                        !isEmpty &&
                        !hasStart &&
                        "bg-success/15 border-success/40 text-success-foreground",
                      hasStart &&
                        "bg-gradient-to-br from-primary to-primary-glow border-primary text-primary-foreground shadow-elegant"
                    )}
                    style={
                      hasStart
                        ? { background: "var(--gradient-primary)" }
                        : undefined
                    }
                  >
                    {isEmpty ? (
                      <span className="opacity-40">∅</span>
                    ) : (
                      cell.map((nt) => (
                        <span
                          key={nt}
                          className={cn(
                            "px-1.5 py-0.5 rounded text-[11px] font-semibold",
                            hasStart
                              ? "bg-white/20 text-white"
                              : "bg-success/30 text-success-foreground"
                          )}
                          style={
                            !hasStart
                              ? { color: "oklch(0.35 0.15 150)" }
                              : undefined
                          }
                        >
                          {nt}
                        </span>
                      ))
                    )}
                  </motion.div>
                );
              })}
            </div>
          );
        })}

        {/* Bottom legend */}
        <div className="flex gap-1 mt-2 ml-12">
          {tokens.map((_, idx) => (
            <div
              key={idx}
              className="w-20 h-6 flex items-center justify-center text-[10px] text-muted-foreground font-mono"
            >
              pos {idx}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}