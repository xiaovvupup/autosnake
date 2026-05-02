export const DIRECTIONS = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 }
};

export const OPPOSITES = {
  up: "down",
  down: "up",
  left: "right",
  right: "left"
};

export function createInitialState(options = {}) {
  const {
    cols = 16,
    rows = 16,
    direction = "right",
    rng = Math.random
  } = options;
  const centerX = Math.floor(cols / 2);
  const centerY = Math.floor(rows / 2);
  const snake = [
    { x: centerX, y: centerY },
    { x: centerX - 1, y: centerY },
    { x: centerX - 2, y: centerY }
  ];

  return {
    cols,
    rows,
    snake,
    direction,
    pendingDirection: direction,
    food: placeFood(snake, cols, rows, rng),
    score: 0,
    status: "ready"
  };
}

export function setDirection(state, nextDirection) {
  if (!isDirectionAllowed(state, nextDirection)) {
    return state;
  }

  return {
    ...state,
    pendingDirection: nextDirection,
    status: state.status === "ready" ? "running" : state.status
  };
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

export function stepGame(state, rng = Math.random) {
  if (state.status !== "running" && state.status !== "ready") {
    return state;
  }

  const direction = state.pendingDirection || state.direction;
  return advanceGame(state, direction, rng);
}

export function advanceGame(state, direction, rng = Math.random) {
  if (!DIRECTIONS[direction]) {
    return state;
  }

  const offset = DIRECTIONS[direction];
  const head = state.snake[0];
  const nextHead = { x: head.x + offset.x, y: head.y + offset.y };
  const willEat = sameCell(nextHead, state.food);
  const bodyToCheck = willEat ? state.snake : state.snake.slice(0, -1);

  if (hitsBoundary(nextHead, state.cols, state.rows) || containsCell(bodyToCheck, nextHead)) {
    return {
      ...state,
      direction,
      pendingDirection: direction,
      status: "game-over"
    };
  }

  const nextSnake = [nextHead, ...state.snake];
  if (!willEat) {
    nextSnake.pop();
  }

  return {
    ...state,
    snake: nextSnake,
    direction,
    pendingDirection: direction,
    food: willEat ? placeFood(nextSnake, state.cols, state.rows, rng) : state.food,
    score: willEat ? state.score + 1 : state.score,
    status: "running"
  };
}

export function isDirectionAllowed(state, nextDirection) {
  if (!DIRECTIONS[nextDirection]) {
    return false;
  }

  const currentDirection = state.pendingDirection || state.direction;
  return OPPOSITES[currentDirection] !== nextDirection;
}

export function placeFood(snake, cols, rows, rng = Math.random) {
  const totalCells = cols * rows;
  if (snake.length >= totalCells) {
    return null;
  }

  const startIndex = Math.floor(rng() * totalCells);
  for (let offset = 0; offset < totalCells; offset += 1) {
    const index = (startIndex + offset) % totalCells;
    const cell = { x: index % cols, y: Math.floor(index / cols) };

    if (!containsCell(snake, cell)) {
      return cell;
    }
  }

  return null;
}

export function restartGame(state, rng = Math.random) {
  return createInitialState({
    cols: state.cols,
    rows: state.rows,
    rng
  });
}

export function sameCell(a, b) {
  return Boolean(a && b) && a.x === b.x && a.y === b.y;
}

function containsCell(cells, candidate) {
  return cells.some((cell) => sameCell(cell, candidate));
}

function hitsBoundary(cell, cols, rows) {
  return cell.x < 0 || cell.y < 0 || cell.x >= cols || cell.y >= rows;
}
