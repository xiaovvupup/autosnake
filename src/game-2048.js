const DIRECTIONS = ["up", "right", "down", "left"];

export function createInitialState(options = {}) {
  const { size = 4, rng = Math.random } = options;
  let board = createEmptyBoard(size);
  board = spawnRandomTile(board, rng);
  board = spawnRandomTile(board, rng);

  return {
    size,
    board,
    score: 0,
    bestTile: 2,
    moves: 0,
    status: "ready"
  };
}

export function restartGame(state, rng = Math.random) {
  return createInitialState({ size: state.size, rng });
}

export function move(state, direction, rng = Math.random) {
  if (!DIRECTIONS.includes(direction) || state.status === "paused" || state.status === "game-over") {
    return state;
  }

  const transformed = transformBoard(state.board, direction);
  let gained = 0;
  let moved = false;

  const merged = transformed.map((line) => {
    const result = collapseLine(line);
    gained += result.gained;
    if (!arraysEqual(result.line, line)) {
      moved = true;
    }
    return result.line;
  });

  if (!moved) {
    return {
      ...state,
      status: canMove(state.board) ? startIfReady(state.status) : "game-over"
    };
  }

  let board = restoreBoard(merged, direction);
  board = spawnRandomTile(board, rng);

  return {
    ...state,
    board,
    score: state.score + gained,
    bestTile: findBestTile(board),
    moves: state.moves + 1,
    status: canMove(board) ? "running" : "game-over"
  };
}

export function togglePause(state) {
  if (state.status === "ready" || state.status === "game-over") {
    return state;
  }

  return {
    ...state,
    status: state.status === "paused" ? "running" : "paused"
  };
}

export function chooseAutoMove(state) {
  const candidates = DIRECTIONS
    .map((direction) => {
      const simulated = move({ ...state, status: "running" }, direction, () => 0);
      if (boardsEqual(simulated.board, state.board)) {
        return null;
      }

      return {
        direction,
        score: evaluateBoard(simulated.board) + simulated.score - state.score,
        simulated
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score);

  return candidates[0]?.direction || null;
}

export function canMove(board) {
  if (getEmptyCells(board).length > 0) {
    return true;
  }

  for (let row = 0; row < board.length; row += 1) {
    for (let col = 0; col < board[row].length; col += 1) {
      const value = board[row][col];
      if (board[row + 1]?.[col] === value || board[row]?.[col + 1] === value) {
        return true;
      }
    }
  }

  return false;
}

export function collapseLine(line) {
  const compact = line.filter((value) => value !== 0);
  const next = [];
  let gained = 0;

  for (let index = 0; index < compact.length; index += 1) {
    if (compact[index] !== 0 && compact[index] === compact[index + 1]) {
      const merged = compact[index] * 2;
      next.push(merged);
      gained += merged;
      index += 1;
    } else {
      next.push(compact[index]);
    }
  }

  while (next.length < line.length) {
    next.push(0);
  }

  return { line: next, gained };
}

function createEmptyBoard(size) {
  return Array.from({ length: size }, () => Array(size).fill(0));
}

function spawnRandomTile(board, rng) {
  const empty = getEmptyCells(board);
  if (empty.length === 0) {
    return board;
  }

  const selected = empty[Math.floor(rng() * empty.length)];
  const value = rng() < 0.1 ? 4 : 2;
  const next = board.map((row) => row.slice());
  next[selected.y][selected.x] = value;
  return next;
}

function getEmptyCells(board) {
  const cells = [];

  for (let y = 0; y < board.length; y += 1) {
    for (let x = 0; x < board[y].length; x += 1) {
      if (board[y][x] === 0) {
        cells.push({ x, y });
      }
    }
  }

  return cells;
}

function transformBoard(board, direction) {
  const size = board.length;

  if (direction === "left") {
    return board.map((row) => row.slice());
  }

  if (direction === "right") {
    return board.map((row) => row.slice().reverse());
  }

  if (direction === "up") {
    return Array.from({ length: size }, (_, col) =>
      Array.from({ length: size }, (_, row) => board[row][col])
    );
  }

  return Array.from({ length: size }, (_, col) =>
    Array.from({ length: size }, (_, row) => board[size - row - 1][col])
  );
}

function restoreBoard(lines, direction) {
  const size = lines.length;

  if (direction === "left") {
    return lines.map((row) => row.slice());
  }

  if (direction === "right") {
    return lines.map((row) => row.slice().reverse());
  }

  if (direction === "up") {
    return Array.from({ length: size }, (_, row) =>
      Array.from({ length: size }, (_, col) => lines[col][row])
    );
  }

  return Array.from({ length: size }, (_, row) =>
    Array.from({ length: size }, (_, col) => lines[col][size - row - 1])
  );
}

function evaluateBoard(board) {
  const emptyCells = getEmptyCells(board).length;
  const bestTile = findBestTile(board);
  const smoothness = measureSmoothness(board);
  const monotonicity = measureMonotonicity(board);
  const cornerBonus = hasBestTileInCorner(board) ? bestTile * 1.2 : 0;

  return emptyCells * 240 + monotonicity * 14 - smoothness * 2.2 + cornerBonus + bestTile;
}

function findBestTile(board) {
  return Math.max(...board.flat());
}

function measureSmoothness(board) {
  let total = 0;

  for (let row = 0; row < board.length; row += 1) {
    for (let col = 0; col < board.length; col += 1) {
      const value = board[row][col];
      if (value === 0) {
        continue;
      }

      if (board[row]?.[col + 1]) {
        total += Math.abs(Math.log2(value) - Math.log2(board[row][col + 1]));
      }

      if (board[row + 1]?.[col]) {
        total += Math.abs(Math.log2(value) - Math.log2(board[row + 1][col]));
      }
    }
  }

  return total;
}

function measureMonotonicity(board) {
  let total = 0;

  for (const row of board) {
    for (let index = 0; index < row.length - 1; index += 1) {
      total += row[index] >= row[index + 1] ? 1 : -1;
    }
  }

  for (let col = 0; col < board.length; col += 1) {
    for (let row = 0; row < board.length - 1; row += 1) {
      total += board[row][col] >= board[row + 1][col] ? 1 : -1;
    }
  }

  return total;
}

function hasBestTileInCorner(board) {
  const best = findBestTile(board);
  const last = board.length - 1;
  return [board[0][0], board[0][last], board[last][0], board[last][last]].includes(best);
}

function boardsEqual(a, b) {
  return a.every((row, rowIndex) => arraysEqual(row, b[rowIndex]));
}

function arraysEqual(a, b) {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function startIfReady(status) {
  return status === "ready" ? "running" : status;
}
