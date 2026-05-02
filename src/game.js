export const PIECE_TYPES = ["I", "O", "T", "S", "Z", "J", "L"];

const NEXT_PREVIEW_COUNT = 3;
const SCORE_TABLE = {
  1: 100,
  2: 300,
  3: 500,
  4: 800
};

const BASE_MATRICES = {
  I: [
    [0, 0, 0, 0],
    [1, 1, 1, 1],
    [0, 0, 0, 0],
    [0, 0, 0, 0]
  ],
  O: [
    [0, 1, 1, 0],
    [0, 1, 1, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0]
  ],
  T: [
    [0, 1, 0, 0],
    [1, 1, 1, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0]
  ],
  S: [
    [0, 1, 1, 0],
    [1, 1, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0]
  ],
  Z: [
    [1, 1, 0, 0],
    [0, 1, 1, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0]
  ],
  J: [
    [1, 0, 0, 0],
    [1, 1, 1, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0]
  ],
  L: [
    [0, 0, 1, 0],
    [1, 1, 1, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0]
  ]
};

export const PIECES = Object.fromEntries(
  PIECE_TYPES.map((type) => [
    type,
    {
      className: `piece-${type.toLowerCase()}`,
      rotations: generateRotations(BASE_MATRICES[type])
    }
  ])
);

export function createInitialState(options = {}) {
  const {
    cols = 10,
    rows = 20,
    rng = Math.random
  } = options;
  const board = createEmptyBoard(rows, cols);
  let queue = [];
  let bag = [];

  ({ queue, bag } = primeQueue(queue, bag, rng, NEXT_PREVIEW_COUNT + 1));

  const currentType = queue[0];
  const current = createPiece(currentType, 0, getSpawnX(cols), 0);

  return {
    cols,
    rows,
    board,
    current,
    queue: queue.slice(1),
    bag,
    score: 0,
    lines: 0,
    level: 1,
    piecesPlaced: 0,
    lastClear: 0,
    status: canPlacePiece(board, current, cols, rows) ? "ready" : "game-over"
  };
}

export function restartGame(state, rng = Math.random) {
  return createInitialState({
    cols: state.cols,
    rows: state.rows,
    rng
  });
}

export function togglePause(state) {
  if (state.status === "game-over" || state.status === "ready") {
    return state;
  }

  return {
    ...state,
    status: state.status === "paused" ? "running" : "paused"
  };
}

export function movePiece(state, dx) {
  return updateCurrentPiece(state, (piece) => ({
    ...piece,
    x: piece.x + dx
  }));
}

export function rotatePiece(state, direction = 1) {
  if (!isPlayable(state)) {
    return state;
  }

  const piece = state.current;
  const rotationCount = getRotationCount(piece.type);
  const nextRotation = (piece.rotation + direction + rotationCount) % rotationCount;
  const kicks = [
    { x: 0, y: 0 },
    { x: -1, y: 0 },
    { x: 1, y: 0 },
    { x: -2, y: 0 },
    { x: 2, y: 0 },
    { x: 0, y: -1 }
  ];

  for (const kick of kicks) {
    const candidate = {
      ...piece,
      rotation: nextRotation,
      x: piece.x + kick.x,
      y: piece.y + kick.y
    };

    if (canPlacePiece(state.board, candidate, state.cols, state.rows)) {
      return {
        ...state,
        current: candidate,
        status: startIfReady(state.status),
        lastClear: 0
      };
    }
  }

  return state;
}

export function softDrop(state, rng = Math.random) {
  return advanceCurrentPiece(state, rng);
}

export function hardDrop(state, rng = Math.random) {
  if (!isPlayable(state)) {
    return state;
  }

  const dropped = dropPiece(state.board, state.current, state.cols, state.rows);
  return lockCurrentPiece(
    {
      ...state,
      current: dropped,
      status: startIfReady(state.status)
    },
    rng
  );
}

export function stepGame(state, rng = Math.random) {
  return advanceCurrentPiece(state, rng);
}

export function createPiece(type, rotation, x, y) {
  return { type, rotation, x, y };
}

export function getRotationCount(type) {
  return PIECES[type].rotations.length;
}

export function getCurrentPieceCells(state) {
  return state.current ? getPieceCells(state.current) : [];
}

export function getPieceCells(piece) {
  const matrix = PIECES[piece.type].rotations[piece.rotation];
  const cells = [];

  for (let row = 0; row < matrix.length; row += 1) {
    for (let col = 0; col < matrix[row].length; col += 1) {
      if (!matrix[row][col]) {
        continue;
      }

      cells.push({
        x: piece.x + col,
        y: piece.y + row
      });
    }
  }

  return cells;
}

export function getGhostY(state) {
  if (!state.current) {
    return 0;
  }

  return dropPiece(state.board, state.current, state.cols, state.rows).y;
}

export function canPlacePiece(board, piece, cols, rows) {
  return getPieceCells(piece).every((cell) => {
    if (cell.x < 0 || cell.y < 0 || cell.x >= cols || cell.y >= rows) {
      return false;
    }

    return board[cell.y][cell.x] === null;
  });
}

export function dropPiece(board, piece, cols, rows) {
  let dropped = { ...piece };

  while (canPlacePiece(board, { ...dropped, y: dropped.y + 1 }, cols, rows)) {
    dropped = {
      ...dropped,
      y: dropped.y + 1
    };
  }

  return dropped;
}

export function lockPieceOnBoard(board, piece, cols, rows) {
  const nextBoard = cloneBoard(board);

  for (const cell of getPieceCells(piece)) {
    if (cell.x < 0 || cell.y < 0 || cell.x >= cols || cell.y >= rows) {
      continue;
    }

    nextBoard[cell.y][cell.x] = piece.type;
  }

  return nextBoard;
}

export function clearCompleteLines(board, cols) {
  const rowsToKeep = board.filter((row) => row.some((cell) => cell === null));
  const cleared = board.length - rowsToKeep.length;

  while (rowsToKeep.length < board.length) {
    rowsToKeep.unshift(Array(cols).fill(null));
  }

  return {
    board: rowsToKeep,
    cleared
  };
}

export function cloneBoard(board) {
  return board.map((row) => row.slice());
}

function createEmptyBoard(rows, cols) {
  return Array.from({ length: rows }, () => Array(cols).fill(null));
}

function advanceCurrentPiece(state, rng) {
  if (!isPlayable(state)) {
    return state;
  }

  const moved = {
    ...state.current,
    y: state.current.y + 1
  };

  if (canPlacePiece(state.board, moved, state.cols, state.rows)) {
    return {
      ...state,
      current: moved,
      status: startIfReady(state.status),
      lastClear: 0
    };
  }

  return lockCurrentPiece(
    {
      ...state,
      status: startIfReady(state.status)
    },
    rng
  );
}

function updateCurrentPiece(state, updater) {
  if (!isPlayable(state)) {
    return state;
  }

  const candidate = updater(state.current);
  if (!canPlacePiece(state.board, candidate, state.cols, state.rows)) {
    return state;
  }

  return {
    ...state,
    current: candidate,
    status: startIfReady(state.status),
    lastClear: 0
  };
}

function lockCurrentPiece(state, rng) {
  const mergedBoard = lockPieceOnBoard(state.board, state.current, state.cols, state.rows);
  const { board, cleared } = clearCompleteLines(mergedBoard, state.cols);
  const lines = state.lines + cleared;
  const level = 1 + Math.floor(lines / 10);
  const nextScore = state.score + (SCORE_TABLE[cleared] || 0) * level;
  const piecesPlaced = state.piecesPlaced + 1;

  let queue = state.queue.slice();
  let bag = state.bag.slice();
  ({ queue, bag } = primeQueue(queue, bag, rng, 1));

  const nextType = queue[0];
  queue = queue.slice(1);
  ({ queue, bag } = primeQueue(queue, bag, rng, NEXT_PREVIEW_COUNT));

  const current = createPiece(nextType, 0, getSpawnX(state.cols), 0);
  const status = canPlacePiece(board, current, state.cols, state.rows) ? "running" : "game-over";

  return {
    ...state,
    board,
    current,
    queue,
    bag,
    score: nextScore,
    lines,
    level,
    piecesPlaced,
    lastClear: cleared,
    status
  };
}

function primeQueue(queue, bag, rng, minimumSize) {
  let nextQueue = queue.slice();
  let nextBag = bag.slice();

  while (nextQueue.length < minimumSize) {
    if (nextBag.length === 0) {
      nextBag = shuffle(PIECE_TYPES, rng);
    }

    nextQueue.push(nextBag[0]);
    nextBag = nextBag.slice(1);
  }

  return {
    queue: nextQueue,
    bag: nextBag
  };
}

function shuffle(items, rng) {
  const next = items.slice();

  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(rng() * (index + 1));
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
  }

  return next;
}

function getSpawnX(cols) {
  return Math.floor(cols / 2) - 2;
}

function isPlayable(state) {
  return Boolean(state.current) && state.status !== "paused" && state.status !== "game-over";
}

function startIfReady(status) {
  return status === "ready" ? "running" : status;
}

function rotateMatrix(matrix) {
  const size = matrix.length;

  return Array.from({ length: size }, (_, row) =>
    Array.from({ length: size }, (_, col) => matrix[size - col - 1][row])
  );
}

function generateRotations(matrix) {
  const rotations = [];
  const seen = new Set();
  let current = matrix;

  for (let step = 0; step < 4; step += 1) {
    const key = current.map((row) => row.join("")).join("/");
    if (!seen.has(key)) {
      seen.add(key);
      rotations.push(current);
    }

    current = rotateMatrix(current);
  }

  return rotations;
}
