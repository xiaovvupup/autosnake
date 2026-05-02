import {
  PIECES,
  canPlacePiece,
  clearCompleteLines,
  cloneBoard,
  createPiece,
  dropPiece,
  getPieceCells,
  lockPieceOnBoard
} from "./game.js";

export function createAutoPlayState() {
  return {
    decisions: 0,
    lastPlan: null
  };
}

export function chooseAutoMove(state, autoState = createAutoPlayState()) {
  const plan = findBestPlacement(state);

  return {
    plan,
    autoState: {
      decisions: autoState.decisions + 1,
      lastPlan: plan
    }
  };
}

export function findBestPlacement(state) {
  if (!state.current || state.status === "game-over") {
    return null;
  }

  const type = state.current.type;
  const plans = [];

  for (let rotation = 0; rotation < PIECES[type].rotations.length; rotation += 1) {
    const { minX, maxX } = getHorizontalBounds(type, rotation);

    for (let x = -minX; x <= state.cols - 1 - maxX; x += 1) {
      const simulated = simulatePlacement(state, type, rotation, x);
      if (simulated) {
        plans.push(simulated);
      }
    }
  }

  return plans.sort(comparePlans)[0] || null;
}

function simulatePlacement(state, type, rotation, x) {
  const piece = createPiece(type, rotation, x, 0);
  if (!canPlacePiece(state.board, piece, state.cols, state.rows)) {
    return null;
  }

  const landed = dropPiece(state.board, piece, state.cols, state.rows);
  const mergedBoard = lockPieceOnBoard(state.board, landed, state.cols, state.rows);
  const { board, cleared } = clearCompleteLines(mergedBoard, state.cols);
  const heights = getColumnHeights(board);
  const holes = countHoles(board);
  const aggregateHeight = heights.reduce((sum, height) => sum + height, 0);
  const bumpiness = heights
    .slice(1)
    .reduce((sum, height, index) => sum + Math.abs(height - heights[index]), 0);
  const wells = countWells(heights);
  const maxHeight = Math.max(...heights);
  const blocksAboveMid = countCellsAbove(board, Math.floor(state.rows / 2));
  const score =
    cleared * 1400 -
    holes * 160 -
    aggregateHeight * 5 -
    bumpiness * 14 -
    wells * 10 -
    maxHeight * 8 -
    blocksAboveMid * 2;

  return {
    type,
    rotation,
    x,
    y: landed.y,
    cleared,
    holes,
    aggregateHeight,
    bumpiness,
    wells,
    maxHeight,
    score
  };
}

function comparePlans(a, b) {
  if (b.score !== a.score) {
    return b.score - a.score;
  }

  if (b.cleared !== a.cleared) {
    return b.cleared - a.cleared;
  }

  if (a.holes !== b.holes) {
    return a.holes - b.holes;
  }

  if (a.maxHeight !== b.maxHeight) {
    return a.maxHeight - b.maxHeight;
  }

  return a.x - b.x;
}

function getHorizontalBounds(type, rotation) {
  const cells = getPieceCells(createPiece(type, rotation, 0, 0));

  return {
    minX: Math.min(...cells.map((cell) => cell.x)),
    maxX: Math.max(...cells.map((cell) => cell.x))
  };
}

function getColumnHeights(board) {
  const cols = board[0].length;

  return Array.from({ length: cols }, (_, col) => {
    for (let row = 0; row < board.length; row += 1) {
      if (board[row][col] !== null) {
        return board.length - row;
      }
    }

    return 0;
  });
}

function countHoles(board) {
  let holes = 0;

  for (let col = 0; col < board[0].length; col += 1) {
    let seenBlock = false;

    for (let row = 0; row < board.length; row += 1) {
      if (board[row][col] !== null) {
        seenBlock = true;
        continue;
      }

      if (seenBlock) {
        holes += 1;
      }
    }
  }

  return holes;
}

function countWells(heights) {
  let wells = 0;

  for (let index = 0; index < heights.length; index += 1) {
    const left = index === 0 ? heights[index + 1] : heights[index - 1];
    const right = index === heights.length - 1 ? heights[index - 1] : heights[index + 1];
    const depth = Math.min(left, right) - heights[index];

    if (depth > 0) {
      wells += depth;
    }
  }

  return wells;
}

function countCellsAbove(board, thresholdRow) {
  let total = 0;

  for (let row = 0; row < thresholdRow; row += 1) {
    for (const cell of board[row]) {
      if (cell !== null) {
        total += 1;
      }
    }
  }

  return total;
}
