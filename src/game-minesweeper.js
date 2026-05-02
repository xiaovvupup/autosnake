export function createInitialState(options = {}) {
  const { rows = 10, cols = 10, mines = 14 } = options;
  return {
    rows,
    cols,
    mines,
    board: null,
    flagsUsed: 0,
    revealed: 0,
    steps: 0,
    status: "ready"
  };
}

export function restartGame(state) {
  return createInitialState({
    rows: state.rows,
    cols: state.cols,
    mines: state.mines
  });
}

export function generateBoard(rows, cols, mineCount, safeCell, rng = Math.random) {
  const board = Array.from({ length: rows }, (_, y) =>
    Array.from({ length: cols }, (_, x) => ({
      x,
      y,
      mine: false,
      flagged: false,
      revealed: false,
      adjacent: 0
    }))
  );
  const cells = [];

  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < cols; x += 1) {
      if (Math.abs(x - safeCell.x) <= 1 && Math.abs(y - safeCell.y) <= 1) {
        continue;
      }
      cells.push({ x, y });
    }
  }

  for (let count = 0; count < mineCount && cells.length > 0; count += 1) {
    const index = Math.floor(rng() * cells.length);
    const cell = cells.splice(index, 1)[0];
    board[cell.y][cell.x].mine = true;
  }

  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < cols; x += 1) {
      board[y][x].adjacent = getNeighbors(board, x, y).filter((cell) => cell.mine).length;
    }
  }

  return board;
}

export function revealCell(state, x, y, rng = Math.random) {
  if (state.status === "game-over" || state.status === "victory") {
    return state;
  }

  let board = state.board;
  if (!board) {
    board = generateBoard(state.rows, state.cols, state.mines, { x, y }, rng);
  } else {
    board = cloneBoard(board);
  }

  const target = board[y]?.[x];
  if (!target || target.flagged || target.revealed) {
    return {
      ...state,
      board,
      status: state.status === "ready" ? "running" : state.status
    };
  }

  if (target.mine) {
    target.revealed = true;
    return {
      ...state,
      board,
      status: "game-over"
    };
  }

  const revealedCount = floodReveal(board, x, y);
  const totalRevealed = state.revealed + revealedCount;
  const cleared = totalRevealed === state.rows * state.cols - state.mines;

  return {
    ...state,
    board,
    revealed: totalRevealed,
    steps: state.steps + 1,
    status: cleared ? "victory" : "running"
  };
}

export function toggleFlag(state, x, y, rng = Math.random) {
  if (state.status === "game-over" || state.status === "victory") {
    return state;
  }

  let board = state.board;
  if (!board) {
    board = generateBoard(state.rows, state.cols, state.mines, { x, y }, rng);
  } else {
    board = cloneBoard(board);
  }

  const target = board[y]?.[x];
  if (!target || target.revealed) {
    return {
      ...state,
      board
    };
  }

  target.flagged = !target.flagged;

  return {
    ...state,
    board,
    flagsUsed: state.flagsUsed + (target.flagged ? 1 : -1),
    status: state.status === "ready" ? "running" : state.status
  };
}

export function chooseAutoAction(state) {
  if (!state.board) {
    return {
      type: "reveal",
      x: Math.floor(state.cols / 2),
      y: Math.floor(state.rows / 2)
    };
  }

  for (let y = 0; y < state.rows; y += 1) {
    for (let x = 0; x < state.cols; x += 1) {
      const cell = state.board[y][x];
      if (!cell.revealed || cell.adjacent === 0) {
        continue;
      }

      const neighbors = getNeighbors(state.board, x, y);
      const hidden = neighbors.filter((neighbor) => !neighbor.revealed && !neighbor.flagged);
      const flagged = neighbors.filter((neighbor) => neighbor.flagged).length;

      if (hidden.length === 0) {
        continue;
      }

      if (cell.adjacent === flagged) {
        return {
          type: "reveal",
          x: hidden[0].x,
          y: hidden[0].y
        };
      }

      if (cell.adjacent === flagged + hidden.length) {
        return {
          type: "flag",
          x: hidden[0].x,
          y: hidden[0].y
        };
      }
    }
  }

  const hiddenCells = [];
  const defaultRisk = (state.mines - state.flagsUsed) / Math.max(1, state.rows * state.cols - state.revealed);

  for (let y = 0; y < state.rows; y += 1) {
    for (let x = 0; x < state.cols; x += 1) {
      const cell = state.board[y][x];
      if (cell.revealed || cell.flagged) {
        continue;
      }

      const constraints = getNeighbors(state.board, x, y)
        .filter((neighbor) => neighbor.revealed && neighbor.adjacent > 0)
        .map((neighbor) => {
          const neighbors = getNeighbors(state.board, neighbor.x, neighbor.y);
          const hidden = neighbors.filter((item) => !item.revealed && !item.flagged);
          const flagged = neighbors.filter((item) => item.flagged).length;
          return (neighbor.adjacent - flagged) / Math.max(1, hidden.length);
        });

      const risk = constraints.length > 0
        ? constraints.reduce((sum, value) => sum + value, 0) / constraints.length
        : defaultRisk;

      hiddenCells.push({ x, y, risk });
    }
  }

  hiddenCells.sort((a, b) => a.risk - b.risk || a.y - b.y || a.x - b.x);
  const best = hiddenCells[0];

  return best
    ? {
        type: best.risk >= 0.98 ? "flag" : "reveal",
        x: best.x,
        y: best.y
      }
    : null;
}

function floodReveal(board, startX, startY) {
  const queue = [{ x: startX, y: startY }];
  let revealed = 0;

  while (queue.length > 0) {
    const current = queue.shift();
    const cell = board[current.y]?.[current.x];

    if (!cell || cell.revealed || cell.flagged) {
      continue;
    }

    cell.revealed = true;
    revealed += 1;

    if (cell.adjacent === 0) {
      for (const neighbor of getNeighbors(board, current.x, current.y)) {
        if (!neighbor.revealed && !neighbor.flagged && !neighbor.mine) {
          queue.push({ x: neighbor.x, y: neighbor.y });
        }
      }
    }
  }

  return revealed;
}

function getNeighbors(board, x, y) {
  const neighbors = [];

  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      if (dx === 0 && dy === 0) {
        continue;
      }

      const cell = board[y + dy]?.[x + dx];
      if (cell) {
        neighbors.push(cell);
      }
    }
  }

  return neighbors;
}

function cloneBoard(board) {
  return board.map((row) => row.map((cell) => ({ ...cell })));
}
