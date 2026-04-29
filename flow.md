# CYK Parser Visualizer - Logic Flow Documentation

## Project Overview

**CYK Parser Visualizer** is an interactive web application that visualizes the **Cocke–Younger–Kasami (CYK) algorithm** for parsing context-free grammars. It provides step-by-step animation of the parsing process, CNF (Chomsky Normal Form) conversion, and parse tree visualization.

**Tech Stack:**
- **Frontend Framework**: React with TanStack Start
- **Styling**: Tailwind CSS with UI components from Shadcn/ui
- **Visualization**: React Flow (for parse tree), Framer Motion (for animations)
- **Routing**: TanStack React Router
- **Build Tool**: Vite
- **Language**: TypeScript

---

## Project Architecture

```
src/
├── lib/
│   ├── cyk.ts           # Core CYK algorithm & CNF conversion logic
│   └── utils.ts         # Utility functions (cn - classname merger)
├── components/
│   ├── CYKTable.tsx     # CYK table visualization component
│   ├── ParseTree.tsx    # Parse tree visualization component
│   └── ui/              # Shadcn/ui components (buttons, cards, inputs, etc.)
├── routes/
│   ├── __root.tsx       # Root layout and 404 component
│   └── index.tsx        # Main application page
├── hooks/
│   └── use-mobile.tsx   # Mobile detection hook
├── router.tsx           # Router configuration
├── routeTree.gen.ts     # Auto-generated route tree
└── styles.css           # Global styles
```

---

## Module-Wise Logic Flow

### 1. **Core Algorithm Module** (`src/lib/cyk.ts`)

This module contains the heart of the application - the CYK algorithm implementation and grammar processing utilities.

#### Data Types Defined:
- **Production**: `{ lhs: string; rhs: string[] }` - A grammar production rule
- **Grammar**: `{ productions: Production[]; start: string }` - Complete grammar
- **CYKCell**: `Set<string>` - Set of non-terminals in a table cell
- **CYKTable**: `CYKCell[][]` - 2D array of cells (main DP table)
- **BackPointer**: Stores derivation information for parse tree reconstruction
- **BackTable**: 2D array of maps storing backpointers
- **ParseTreeNode**: Tree node with id, label, and children
- **CYKStep**: Single step snapshot with row (i), column (j), added non-terminals, and table state
- **CYKResult**: Complete result with acceptance status, table, steps, CNF grammar, tokens, and start symbol

#### Key Functions:

##### 1.1 **`parseGrammar(input: string): Grammar`** (Lines 31-89)
- **Input**: Raw grammar text (e.g., "S -> AB | BC\nA -> BA | a")
- **Process**:
  1. Splits input by newlines and filters comments/empty lines
  2. Parses each production rule using arrows (`->`, `→`, `::=`)
  3. Validates LHS (must be uppercase non-terminals)
  4. Handles alternatives separated by `|`
  5. Parses tokens (handles both space-separated and compact notation)
  6. Sets start symbol (first LHS encountered)
- **Output**: Grammar object with productions and start symbol
- **Error Handling**: Throws descriptive errors for malformed productions

##### 1.2 **`isNonTerminal(sym: string): boolean`** (Lines 91-92)
- **Input**: A symbol string
- **Process**: Checks if symbol matches uppercase pattern `^[A-Z][A-Z0-9_']*$`
- **Output**: Boolean indicating if it's a non-terminal

##### 1.3 **`toCNF(grammar: Grammar): Grammar`** (Lines 94-271)
Converts an arbitrary grammar to **Chomsky Normal Form** through 5 steps:

**Step 1: Add New Start Symbol** (Lines 99-100)
- Creates new start symbol `S0` → original start
- Prevents issues if start symbol appears on RHS

**Step 2: Remove Epsilon Productions** (Lines 102-129)
- Identifies nullable non-terminals (can derive epsilon)
- Generates all combinations of non-epsilon symbols
- Eliminates epsilon production rules
- File location: Lines 102-129

**Step 3: Remove Unit Productions** (Lines 131-171)
- Identifies unit productions (A → B where B is non-terminal)
- Replaces them with direct productions (A → ... all productions of B)
- Deduplicates to avoid infinite loops
- File location: Lines 131-171

**Step 4: Replace Terminals in Long Rules** (Lines 173-191)
- For rules with 2+ symbols, replaces terminals with intermediate non-terminals
- Creates new rules like `T_a → a` for each terminal
- File location: Lines 173-191

**Step 5: Binarize Long Rules** (Lines 193-208)
- Converts rules with >2 symbols to binary rules
- Example: `A → BCD` becomes `A → BX1`, `X1 → CD`
- File location: Lines 193-208

**Output**: Grammar in Chomsky Normal Form (all rules are A→BC or A→a or S0→ε)

##### 1.4 **`runCYK(cnf: Grammar, input: string): CYKResult`** (Lines 273-382)
Main CYK algorithm implementation:

- **Initialization** (Lines 275-285):
  - Creates n×n table (n = string length)
  - Creates backpointer table for parse tree reconstruction
  - Handles empty string case

- **Base Case (Length 1)** (Lines 295-306):
  - For each input character, finds all non-terminals that can derive it
  - Fills table[0][j] with these non-terminals
  - Records step for animation
  - File location: Lines 295-306

- **Inductive Case (Length ≥ 2)** (Lines 308-328):
  - For each substring length (2 to n)
  - For each starting position (j)
  - Tries all possible split points (k)
  - Checks if left (table[k-1][j]) and right (table[len-k-1][j+k]) combine
  - Looks for productions A → BC where B in left, C in right
  - Adds A to table[len-1][j] if found
  - Records backpointer for reconstruction
  - File location: Lines 308-328

- **Output**: CYKResult with final table, steps, and acceptance status

**Complexity**: O(n³ · |G|) where n = string length, |G| = number of productions

##### 1.5 **`buildParseTree(result: CYKResult): ParseTreeNode | null`** (Lines 384-420)
- **Input**: CYKResult from runCYK
- **Process**:
  1. If string not accepted, returns null
  2. Recursively builds tree using backpointers
  3. For terminals: creates leaf node
  4. For non-terminals with split: creates node with left and right children
  5. Starts from top-level (n-1, 0) with start symbol
- **Output**: ParseTreeNode forming complete derivation tree

##### 1.6 **`formatGrammar(g: Grammar): string`** (Lines 422-442)
- **Input**: Grammar object
- **Process**:
  1. Groups productions by LHS (non-terminal)
  2. Orders with start symbol first
  3. Formats as readable text (A → B | C | D)
- **Output**: String representation of grammar in CNF

---

### 2. **Main Route Module** (`src/routes/index.tsx`)

The primary user interface and application orchestration.

#### Component: `Index()` (Lines 52-465)

##### State Management (Lines 53-59):
```typescript
grammarText          // User-edited grammar
inputString          // User-edited input string
result              // CYKResult from algorithm
tree                // ParseTreeNode for visualization
error               // Error messages
stepIdx             // Current step for animation (0 to result.steps.length)
playing             // Animation playing state
speed               // Animation speed (milliseconds)
```

##### Key Functions:

###### **`run()`** (Lines 61-76) - Execute Algorithm
1. Parses grammar using `parseGrammar()`
2. Converts to CNF using `toCNF()`
3. Runs CYK using `runCYK()`
4. Builds parse tree using `buildParseTree()`
5. Sets `stepIdx` to fully-filled table
6. Catches errors and displays to user

###### **`reset()`** (Lines 78-87) - Clear All State
- Resets all state variables to initial values
- Used by Reset button

###### **`loadExample()`** (Lines 89-93) - Load Predefined Grammar
- Sets predefined example grammar and string
- Used by "Load Example" button

###### **Animation Loop** (Lines 95-108) - useEffect
- Runs when `playing` is true
- Increments `stepIdx` every `speed` milliseconds
- Stops at end of steps
- Cleanup on unmount/dependency change

###### **`displayedTable`** Computation (Lines 110-121) - useMemo
- Converts `stepIdx` to table snapshot
- Returns progressively filled table for animation
- stepIdx=0 → empty table
- stepIdx>0 → result.steps[stepIdx-1].table

###### **`highlight`** Computation (Lines 123-130) - useMemo
- Returns cell coordinates (i, j) being processed
- Only when animation is playing
- Used to highlight current cell in CYKTable

###### **`cnfText`** Computation (Lines 132-135) - useMemo
- Formats CNF grammar for display
- Memoized for performance

##### UI Structure (Lines 137-465):

1. **Header** (Lines 140-156):
   - Logo and title
   - "Load Example" button

2. **Input Section** (Lines 158-210):
   - Grammar textarea (left)
   - Input string input (right)
   - Run/Reset buttons
   - Error display
   - CNF display

3. **Result Card** (Lines 212-239):
   - Acceptance status (Accepted/Rejected)
   - Grammar info
   - Input string length badge
   - Green gradient if accepted, red if rejected

4. **CYK Table Section** (Lines 241-315):
   - Table visualization via `CYKTable` component
   - Animation controls:
     - Rewind: Jump to start
     - Step Back: Decrement step
     - Play/Pause: Toggle animation
     - Step Forward: Increment step
     - Fast Forward: Jump to end
   - Speed slider: Adjust animation speed
   - Step counter display
   - Color legend

5. **Parse Tree Section** (Lines 317-325):
   - Parse tree visualization via `ParseTree` component
   - Shows derivation structure if string accepted

6. **Footer** (Lines 327-330):
   - Attribution and complexity info

---

### 3. **CYK Table Visualization** (`src/components/CYKTable.tsx`)

Component that renders the dynamic programming table.

#### Props:
- `tokens`: Input string split into characters
- `table`: 2D array where table[i][j] contains non-terminals (string[][][])
- `highlight`: Current processing cell {i, j} or null
- `startSymbol`: Start symbol of grammar

#### Key Logic (Lines 31-121):

**Table Structure:**
- **Rows**: From i=n-1 (top, length n) down to i=0 (bottom, length 1)
- **Length Label**: Shows substring length for each row
- **Columns**: j=0 to j=n-i (positions in input)

**Cell Rendering** (Lines 62-108):
```
For each cell [i][j]:
├─ Check if empty (no non-terminals)
├─ Check if highlighted (currently processing)
├─ Check if contains start symbol
└─ Apply appropriate styling:
   ├─ Empty: muted background with ∅
   ├─ Filled: green background with non-terminals
   ├─ Highlighted: yellow background with scale animation
   └─ Contains Start Symbol: gradient primary color
```

**Animation** (Lines 91-95):
- Framer Motion: Scale to 1.05 when highlighted
- Smooth 0.2s transition

---

### 4. **Parse Tree Visualization** (`src/components/ParseTree.tsx`)

Component that renders the parse tree using React Flow.

#### Core Functions:

##### **`layout(tree: ParseTreeNode): Layout`** (Lines 25-37)
- **Input**: Parse tree from buildParseTree
- **Process**: Computes layout with tree nodes distributed horizontally
  1. Recursively lays out children
  2. Positions children left-to-right
  3. Centers parent above children
- **Output**: Layout structure with x, width, and children layouts

**Algorithm**:
```
For leaf nodes: width = NODE_W (70px), x = 0

For parent nodes:
├─ Recursively layout all children
├─ Position children consecutively (cursor += child.width + H_GAP)
├─ Calculate totalWidth = cursor - H_GAP
├─ Set node.width = max(totalWidth, NODE_W) for centered parent
└─ Shift children so parent is centered
```

##### **`flatten(l, depth, offsetX, nodes, edges, parentId)`** (Lines 39-80)
- **Input**: Layout object, depth, offset X, accumulators
- **Process**: Converts layout tree to React Flow nodes and edges
  1. Calculates absolute X position: cx = offsetX + l.x + width/2 - NODE_W/2
  2. Creates node with:
     - Unique ID
     - Position {x, y} (y = depth * V_GAP = 70px)
     - Label from tree node
     - Styling (root=gradient, terminal=green, internal=default)
  3. If not root, creates edge from parent to this node
  4. Recursively flattens children

**Styling**:
- Root node: Primary gradient background, white text
- Terminal (leaf): Light green background
- Internal nodes: Card background, default text
- All nodes: Monospace font, height=40px, width=70px

##### **`ParseTree` Component** (Lines 100-131)
- **Props**: tree (ParseTreeNode | null)
- **Process**: 
  1. useMemo: Calls layout() then flatten() to generate nodes and edges
  2. Renders ReactFlow with:
     - Nodes and edges from flatten
     - fitView enabled with 0.2 padding
     - Nodes non-draggable, non-connectable
     - Background grid pattern
     - Controls (zoom, pan)
- **Output**: Interactive tree visualization

**Interaction**:
- Scroll to zoom
- Click+drag to pan
- Controls for fit view

---

### 5. **Root Route Layout** (`src/routes/__root.tsx`)

Application shell and 404 page.

#### Functions:

##### **`NotFoundComponent()`** (Lines 7-26)
- Renders 404 error page
- Shows error message and link back to home

##### **`RootShell({ children })`** (Lines 53-62)
- HTML structure with head and body
- Renders `HeadContent` for SSR
- Renders children routes
- Renders `Scripts` for hydration

##### **`RootComponent()`** (Lines 64-66)
- Renders `Outlet` for nested routes
- Child routes render here

#### Metadata (Lines 33-51):
- Character set: UTF-8
- Viewport settings for responsive design
- Title and description
- Open Graph and Twitter metadata
- CSS import (appCss)

---

### 6. **Utility Functions** (`src/lib/utils.ts`)

Provides common utility function:

#### **`cn(...inputs: ClassValue[]): string`** (Lines 3-5)
- Combines clsx and tailwind-merge
- **Purpose**: Merge Tailwind classes intelligently
- **Usage**: Avoid conflicting Tailwind utilities
- **Example**: `cn("px-2", "px-4")` → `"px-4"` (merge wins)

---

## Complete Data Flow

### Flow Diagram: User Input → Parsing → Visualization

```
1. USER INPUT PHASE
   ├─ User enters grammar in textarea (CYKTable.tsx)
   ├─ User enters input string in input field
   └─ User clicks "Run CYK Algorithm" button

2. PARSING PHASE (index.tsx → run())
   ├─ parseGrammar(grammarText) [cyk.ts:31-89]
   │  └─ Output: Grammar object
   ├─ toCNF(grammar) [cyk.ts:94-271]
   │  └─ Output: Grammar in Chomsky Normal Form
   └─ State updated: result = null, error cleared

3. ALGORITHM EXECUTION PHASE (index.tsx → run())
   ├─ runCYK(cnf, inputString) [cyk.ts:273-382]
   │  ├─ Initialize n×n table and backpointers [cyk.ts:275-285]
   │  ├─ Base case: Fill table[0][j] [cyk.ts:295-306]
   │  ├─ Inductive: Fill table[i][j] for i>0 [cyk.ts:308-328]
   │  └─ Output: CYKResult with steps
   └─ State updated: result = CYKResult, stepIdx = result.steps.length

4. PARSE TREE CONSTRUCTION (index.tsx → run())
   ├─ buildParseTree(result) [cyk.ts:384-420]
   └─ Output: ParseTreeNode (if accepted) or null

5. DISPLAY FORMATTING (index.tsx)
   ├─ cnfText = formatGrammar(result.cnf) [cyk.ts:422-442]
   └─ State updated: tree = ParseTreeNode

6. UI RENDERING
   ├─ Result card displays acceptance status [index.tsx:212-239]
   ├─ CNF displayed in formatted text box [index.tsx:198-204]
   ├─ CYK Table shows full state [index.tsx:241-315]
   │  └─ Table[i][j] populated from result.table
   └─ Parse tree rendered [index.tsx:317-325]
      └─ Tree structure visualized via React Flow

7. ANIMATION PHASE (OPTIONAL)
   ├─ User clicks Play button
   ├─ Animation loop triggered [index.tsx:95-108]
   │  ├─ setPlaying(true)
   │  └─ setStepIdx increments every 'speed' milliseconds
   ├─ displayedTable computed from stepIdx [index.tsx:110-121]
   ├─ highlight computed for current cell [index.tsx:123-130]
   ├─ CYKTable re-renders with:
   │  ├─ Progressively filled table
   │  ├─ Current cell highlighted
   │  └─ Smooth animations
   └─ Animation stops at result.steps.length

8. USER CONTROLS
   ├─ Rewind: stepIdx = 0
   ├─ Step Back: stepIdx--
   ├─ Play/Pause: playing = !playing
   ├─ Step Forward: stepIdx++
   ├─ Fast Forward: stepIdx = result.steps.length
   ├─ Speed Slider: speed (milliseconds per step)
   └─ Reset: All state cleared
```

---

## Algorithm Flow: CYK Algorithm Execution

### Detailed Step-by-Step Process

**Input**: CNF Grammar G, Input string w = c₁c₂...cₙ

### Phase 1: Base Case (Length 1) [cyk.ts:295-306]

```
For j = 0 to n-1:
    For each production A → cⱼ:
        table[0][j].add(A)
        back[0][j][A] = {terminal: cⱼ}
        steps.push({i: 0, j: j, added: [A], ...})
```

**Example** (Grammar: S→AB|BC, A→BA|a, B→CC|b, C→AB|a; String: "baaba"):
- j=0, token='b': table[0][0] = {B} (from B→b)
- j=1, token='a': table[0][1] = {A, C} (from A→a, C→a)
- j=2, token='a': table[0][2] = {A, C}
- j=3, token='b': table[0][3] = {B}
- j=4, token='a': table[0][4] = {A, C}

### Phase 2: Inductive Case (Length ≥ 2) [cyk.ts:308-328]

```
For len = 2 to n:
    For j = 0 to n-len:
        For k = 1 to len-1:
            left = table[k-1][j]
            right = table[len-k-1][j+k]
            For each production A → BC:
                If B ∈ left AND C ∈ right:
                    table[len-1][j].add(A)
                    back[len-1][j][A] = {split: {k, B, C}}
                    steps.push(...)
```

**Why this works**:
- table[i][j] contains non-terminals that derive substring w[j:j+i+1]
- For longer substrings, we try all split points
- If left part derives w[j:j+k] and right part derives w[j+k:j+len], and we have A→BC, then A derives entire substring

### Phase 3: Acceptance Test

```
If table[n-1][0].contains(start_symbol):
    ACCEPT
Else:
    REJECT
```

---

## Parse Tree Reconstruction Flow

### How Backpointers Enable Parse Tree Building

**Backpointer Storage** [cyk.ts:273-275]:
```typescript
back[i][j].set(nt, {
    nt: nt,
    terminal?: terminal,           // if A→a
    split?: {k, left, right}       // if A→BC with split at k
})
```

### Build Process [cyk.ts:384-420]

```
buildParseTree(result):
    Start at back[n-1][0][start_symbol]
    
    build(i, j, nt):
        node = {id, label: nt, children: []}
        bp = back[i][j][nt]
        
        If bp.terminal exists:
            node.children.push({label: terminal})
        
        If bp.split exists:
            left_node = build(k-1, j, left_nt)
            right_node = build(i-k, j+k, right_nt)
            node.children = [left_node, right_node]
        
        Return node

Output: Complete ParseTreeNode tree
```

**Visual Result**:
- Root: Start symbol
- Internal nodes: Non-terminals from productions
- Leaf nodes: Input terminals (characters)
- Edges: Derivation relationships

---

## UI Event Flow

```
USER ACTIONS
│
├─ Type Grammar → setGrammarText()
├─ Type Input String → setInputString()
├─ Click "Load Example" → loadExample()
├─ Click "Run CYK Algorithm" → run() [executes algorithm]
│  ├─ Parse grammar
│  ├─ Convert to CNF
│  ├─ Run CYK
│  ├─ Build parse tree
│  └─ Update all state
│
├─ Click "Play" → setPlaying(true)
│  └─ Animation loop triggers [95-108]
│
├─ Click "Pause" → setPlaying(false)
├─ Click "Step Back" → setStepIdx(stepIdx - 1)
├─ Click "Step Forward" → setStepIdx(stepIdx + 1)
├─ Click "Rewind" → setStepIdx(0)
├─ Click "Fast Forward" → setStepIdx(result.steps.length)
├─ Drag Speed Slider → setSpeed(newSpeed)
├─ Click "Reset" → reset()
│
└─ In ParseTree:
   ├─ Scroll → zoom in/out
   ├─ Click+drag → pan around
   └─ Fit View → auto-center
```

---

## Error Handling

**Error Cases** [index.tsx:64-76]:

1. **Invalid Grammar**:
   - Missing arrow symbols
   - Invalid non-terminal names
   - Malformed productions
   - Caught by parseGrammar() → thrown error → caught in run() → setError()

2. **Empty Grammar**:
   - No productions defined
   - Caught and displayed in error state

3. **Display**:
   - Error shown in red box [index.tsx:200-203]
   - User can fix and re-run

---

## Performance Characteristics

| Component | Complexity | Notes |
|-----------|-----------|-------|
| parseGrammar | O(P) | P = number of production rules |
| toCNF | O(P²) | Worst case with multiple transformations |
| runCYK | O(n³ · P) | n = string length, main algorithm complexity |
| buildParseTree | O(n) | Linear tree traversal |
| formatGrammar | O(P) | Linear in productions |
| **Total** | **O(n³ · P)** | Dominated by runCYK |

---

## Key Design Patterns

### 1. **Memoization** (index.tsx)
```typescript
const displayedTable = useMemo(() => { ... }, [result, stepIdx])
const highlight = useMemo(() => { ... }, [result, playing, stepIdx])
const cnfText = useMemo(() => { ... }, [result])
```
- Prevents unnecessary recalculations
- Updates only when dependencies change

### 2. **useEffect for Animation** (index.tsx:95-108)
```typescript
useEffect(() => {
    if (!playing || !result) return
    timerRef.current = window.setTimeout(() => {
        setStepIdx(s => s + 1)
    }, speed)
    return () => clearTimeout(timerRef.current)
}, [playing, stepIdx, speed, result])
```
- Animation loop with controlled timing
- Proper cleanup to prevent memory leaks

### 3. **Step-by-Step Algorithm Tracking** (cyk.ts:273-328)
```typescript
const steps: CYKStep[] = []
// ... inside algorithm ...
steps.push({i, j, added, table: snapshot()})
```
- Records each algorithm step for animation
- Snapshots table state for playback

### 4. **Backpointers for Tree Reconstruction** (cyk.ts:384-420)
- Enables efficient parse tree building
- Stores minimal derivation info at each cell
- O(n) reconstruction time

---

## Summary

The CYK Parser Visualizer combines:
1. **Core Algorithm** (cyk.ts): CYK parsing and CNF conversion
2. **Main Interface** (index.tsx): Grammar input, execution control, result display
3. **Visualizations**: 
   - CYK Table (CYKTable.tsx): Dynamic programming table
   - Parse Tree (ParseTree.tsx): Derivation structure
4. **Animation**: Step-by-step playback with controls
5. **Error Handling**: User-friendly error messages

**Key Files by Responsibility**:
- **Algorithm Logic**: `src/lib/cyk.ts`
- **UI & State Management**: `src/routes/index.tsx`
- **Table Visualization**: `src/components/CYKTable.tsx`
- **Tree Visualization**: `src/components/ParseTree.tsx`
- **Application Shell**: `src/routes/__root.tsx`
- **Utilities**: `src/lib/utils.ts`
