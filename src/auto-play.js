import {
  advanceGame,
  DIRECTIONS,
  OPPOSITES,
  isDirectionAllowed
} from "./game.js";

const DIRECTION_ORDER = ["up", "right", "down", "left"];
const HISTORY_LIMIT = 18;
const DIRECTION_HISTORY_LIMIT = 10;
const LOOP_WINDOW = 8;

export function createAutoPlayState(gameState = null) {
  return {
    recentHeads: gameState?.snake?.[0] ? [toKey(gameState.snake[0])] : [],
    recentDirections: [],
    stepsSinceFood: 0,
    lastFoodDistance: gameState?.food ? manhattan(gameState.snake[0], gameState.food) : 0
  };
}

export function buildOccupancyGrid(state, options = {}) {
  const { ignoreHead = true, ignoreTail = false } = options;
  const blocked = new Set();

  state.snake.forEach((cell, index) => {
    if (ignoreHead && index === 0) {
      return;
    }

    if (ignoreTail && index === state.snake.length - 1) {
      return;
    }

    blocked.add(toKey(cell));
  });

  return blocked;
}

export function findShortestPath(options) {
  const {
    cols,
    rows,
    start,
    target,
    blocked,
    preferredDirections = []
  } = options;

  if (!start || !target) {
    return null;
  }

  if (samePosition(start, target)) {
    return [];
  }

  const visited = new Set([toKey(start)]);
  const queue = [{ cell: start, path: [] }];
  const directionOrder = orderDirections(preferredDirections);

  while (queue.length > 0) {
    const current = queue.shift();

    for (const direction of directionOrder) {
      const next = moveCell(current.cell, direction);
      const nextKey = toKey(next);

      if (!isInsideBoard(next, cols, rows) || visited.has(nextKey)) {
        continue;
      }

      if (blocked.has(nextKey) && !samePosition(next, target)) {
        continue;
      }

      const path = [...current.path, direction];
      if (samePosition(next, target)) {
        return path;
      }

      visited.add(nextKey);
      queue.push({ cell: next, path });
    }
  }

  return null;
}

export function simulatePath(state, path) {
  let simulated = { ...state, status: "running" };

  for (const direction of path) {
    simulated = advanceGame(simulated, direction, () => 0);
    if (simulated.status === "game-over") {
      return null;
    }
  }

  return simulated;
}

export function hasPathToTail(state) {
  if (state.status === "game-over" || state.snake.length <= 2) {
    return state.status !== "game-over";
  }

  const head = state.snake[0];
  const tail = state.snake[state.snake.length - 1];
  const blocked = buildOccupancyGrid(state, { ignoreHead: true, ignoreTail: true });

  return Boolean(
    findShortestPath({
      cols: state.cols,
      rows: state.rows,
      start: head,
      target: tail,
      blocked,
      preferredDirections: [state.direction]
    })
  );
}

export function detectLoopRisk(autoState, nextState, direction) {
  const nextKey = toKey(nextState.snake[0]);
  const recentHeads = autoState.recentHeads.slice(-LOOP_WINDOW);
  const recentDirections = autoState.recentDirections.slice(-LOOP_WINDOW);
  const revisitCount = recentHeads.filter((cell) => cell === nextKey).length;
  const oppositePenalty =
    recentDirections.length > 0 && OPPOSITES[recentDirections[recentDirections.length - 1]] === direction
      ? 2
      : 0;
  const uniqueCells = new Set([...recentHeads, nextKey]).size;
  const localLoopPenalty = recentHeads.length >= 4 && uniqueCells <= Math.ceil((recentHeads.length + 1) / 2) ? 2 : 0;
  const distance = nextState.food ? manhattan(nextState.snake[0], nextState.food) : 0;
  const progressPenalty =
    autoState.stepsSinceFood >= 6 && distance >= autoState.lastFoodDistance ? 1 : 0;

  return revisitCount + oppositePenalty + localLoopPenalty + progressPenalty;
}

export function recordAutoPlayStep(autoState, previousState, nextState, direction) {
  const ateFood = nextState.score > previousState.score;
  const nextHeadKey = toKey(nextState.snake[0]);
  const previousHeadKey = toKey(previousState.snake[0]);

  if (
    nextHeadKey === previousHeadKey &&
    nextState.score === previousState.score &&
    nextState.status === previousState.status
  ) {
    return autoState;
  }

  return {
    recentHeads: [...autoState.recentHeads, nextHeadKey].slice(-HISTORY_LIMIT),
    recentDirections: direction
      ? [...autoState.recentDirections, direction].slice(-DIRECTION_HISTORY_LIMIT)
      : autoState.recentDirections.slice(-DIRECTION_HISTORY_LIMIT),
    stepsSinceFood: ateFood ? 0 : autoState.stepsSinceFood + 1,
    lastFoodDistance: nextState.food ? manhattan(nextState.snake[0], nextState.food) : 0
  };
}

export function chooseSafeMove(state, autoState) {
  const currentDirection = state.pendingDirection || state.direction;
  const preferredDirections = [currentDirection];
  let rejectedFoodDirection = null;
  const foodPath = state.food
    ? findShortestPath({
        cols: state.cols,
        rows: state.rows,
        start: state.snake[0],
        target: state.food,
        blocked: buildOccupancyGrid(state, { ignoreHead: true, ignoreTail: true }),
        preferredDirections
      })
    : null;

  if (foodPath && foodPath.length > 0) {
    const foodState = simulatePath(state, foodPath);
    if (foodState && hasPathToTail(foodState)) {
      return foodPath[0];
    }

    rejectedFoodDirection = foodPath[0];
  }

  const candidates = orderDirections(preferredDirections)
    .filter((direction) => isDirectionAllowed(state, direction))
    .map((direction) => {
      const nextState = advanceGame({ ...state, status: "running" }, direction, () => 0);
      if (nextState.status === "game-over") {
        return null;
      }

      const pathToTail = nextState.snake.length <= 2
        ? []
        : findShortestPath({
            cols: nextState.cols,
            rows: nextState.rows,
            start: nextState.snake[0],
            target: nextState.snake[nextState.snake.length - 1],
            blocked: buildOccupancyGrid(nextState, { ignoreHead: true, ignoreTail: true }),
            preferredDirections: [direction]
          });
      const loopRisk = detectLoopRisk(autoState, nextState, direction);
      const reachableCells = countReachableCells(nextState);
      const nextFoodPath = nextState.food
        ? findShortestPath({
            cols: nextState.cols,
            rows: nextState.rows,
            start: nextState.snake[0],
            target: nextState.food,
            blocked: buildOccupancyGrid(nextState, { ignoreHead: true, ignoreTail: true }),
            preferredDirections: [direction]
          })
        : null;
      const distance = nextState.food ? manhattan(nextState.snake[0], nextState.food) : 0;
      const safe = Boolean(pathToTail);
      const score =
        (safe ? 1000 : 0) +
        reachableCells * 4 +
        (pathToTail ? Math.min(pathToTail.length, 24) : 0) +
        (nextFoodPath ? 30 - Math.min(nextFoodPath.length, 30) : 0) -
        distance * 2 -
        loopRisk * 15 -
        (direction === rejectedFoodDirection ? 200 : 0);

      return { direction, score, safe };
    })
    .filter(Boolean);

  const safestCandidate =
    candidates
      .filter((candidate) => candidate.safe)
      .sort(compareCandidates)[0] ||
    candidates.sort(compareCandidates)[0];

  return safestCandidate?.direction || currentDirection;
}

function countReachableCells(state) {
  const blocked = buildOccupancyGrid(state, { ignoreHead: true, ignoreTail: true });
  const visited = new Set([toKey(state.snake[0])]);
  const queue = [state.snake[0]];

  while (queue.length > 0) {
    const cell = queue.shift();

    for (const direction of DIRECTION_ORDER) {
      const next = moveCell(cell, direction);
      const nextKey = toKey(next);

      if (!isInsideBoard(next, state.cols, state.rows) || visited.has(nextKey) || blocked.has(nextKey)) {
        continue;
      }

      visited.add(nextKey);
      queue.push(next);
    }
  }

  return visited.size;
}

function compareCandidates(a, b) {
  if (b.score !== a.score) {
    return b.score - a.score;
  }

  return DIRECTION_ORDER.indexOf(a.direction) - DIRECTION_ORDER.indexOf(b.direction);
}

function orderDirections(preferredDirections) {
  const seen = new Set();
  const ordered = [];

  for (const direction of [...preferredDirections, ...DIRECTION_ORDER]) {
    if (DIRECTIONS[direction] && !seen.has(direction)) {
      seen.add(direction);
      ordered.push(direction);
    }
  }

  return ordered;
}

function moveCell(cell, direction) {
  return {
    x: cell.x + DIRECTIONS[direction].x,
    y: cell.y + DIRECTIONS[direction].y
  };
}

function isInsideBoard(cell, cols, rows) {
  return cell.x >= 0 && cell.y >= 0 && cell.x < cols && cell.y < rows;
}

function samePosition(a, b) {
  return a.x === b.x && a.y === b.y;
}

function manhattan(a, b) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function toKey(cell) {
  return `${cell.x},${cell.y}`;
}
