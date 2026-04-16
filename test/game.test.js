import test from "node:test";
import assert from "node:assert/strict";

import {
  advanceGame,
  createInitialState,
  isDirectionAllowed,
  placeFood,
  restartGame,
  setDirection,
  stepGame
} from "../src/game.js";
import {
  buildOccupancyGrid,
  chooseSafeMove,
  createAutoPlayState,
  detectLoopRisk,
  findShortestPath,
  hasPathToTail,
  simulatePath
} from "../src/auto-play.js";

test("snake moves one cell in the current direction", () => {
  const state = createInitialState({ cols: 10, rows: 10, rng: () => 0 });
  const next = stepGame({ ...state, status: "running" });

  assert.deepEqual(next.snake[0], { x: state.snake[0].x + 1, y: state.snake[0].y });
  assert.equal(next.snake.length, state.snake.length);
});

test("snake grows and score increases after eating food", () => {
  const state = {
    ...createInitialState({ cols: 8, rows: 8, rng: () => 0.5 }),
    status: "running",
    food: { x: 5, y: 4 },
    snake: [
      { x: 4, y: 4 },
      { x: 3, y: 4 },
      { x: 2, y: 4 }
    ]
  };

  const next = stepGame(state, () => 0);

  assert.equal(next.score, 1);
  assert.equal(next.snake.length, 4);
  assert.deepEqual(next.snake[0], { x: 5, y: 4 });
  assert.notDeepEqual(next.food, state.food);
});

test("reverse direction input is ignored", () => {
  const state = createInitialState({ cols: 10, rows: 10, rng: () => 0 });
  const next = setDirection(state, "left");

  assert.equal(next.pendingDirection, "right");
});

test("wall collisions end the game", () => {
  const state = {
    ...createInitialState({ cols: 4, rows: 4, rng: () => 0 }),
    status: "running",
    snake: [
      { x: 3, y: 1 },
      { x: 2, y: 1 },
      { x: 1, y: 1 }
    ],
    direction: "right",
    pendingDirection: "right"
  };

  const next = stepGame(state);
  assert.equal(next.status, "game-over");
});

test("self collisions end the game", () => {
  const state = {
    ...createInitialState({ cols: 6, rows: 6, rng: () => 0 }),
    status: "running",
    snake: [
      { x: 2, y: 2 },
      { x: 3, y: 2 },
      { x: 3, y: 3 },
      { x: 2, y: 3 },
      { x: 1, y: 3 },
      { x: 1, y: 2 }
    ],
    direction: "down",
    pendingDirection: "down",
    food: { x: 5, y: 5 }
  };

  const next = stepGame(state);
  assert.equal(next.status, "game-over");
});

test("food placement skips occupied cells deterministically", () => {
  const food = placeFood(
    [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 }
    ],
    3,
    3,
    () => 0
  );

  assert.deepEqual(food, { x: 0, y: 1 });
});

test("shortest path selection finds a direct route to food", () => {
  const state = {
    ...createInitialState({ cols: 5, rows: 5, rng: () => 0 }),
    status: "running",
    snake: [
      { x: 1, y: 1 },
      { x: 0, y: 1 },
      { x: 0, y: 0 }
    ],
    direction: "right",
    pendingDirection: "right",
    food: { x: 3, y: 1 }
  };

  const path = findShortestPath({
    cols: state.cols,
    rows: state.rows,
    start: state.snake[0],
    target: state.food,
    blocked: buildOccupancyGrid(state, { ignoreHead: true, ignoreTail: true }),
    preferredDirections: ["right"]
  });

  assert.deepEqual(path, ["right", "right"]);
  assert.equal(chooseSafeMove(state, createAutoPlayState(state)), "right");
});

test("unsafe food path is rejected in favor of a survivable move", () => {
  const state = {
    cols: 5,
    rows: 5,
    snake: [
      { x: 1, y: 1 },
      { x: 0, y: 1 },
      { x: 0, y: 2 },
      { x: 1, y: 2 },
      { x: 2, y: 2 },
      { x: 2, y: 1 },
      { x: 2, y: 0 },
      { x: 1, y: 0 }
    ],
    direction: "right",
    pendingDirection: "right",
    food: { x: 0, y: 0 },
    score: 0,
    status: "running"
  };

  const blocked = buildOccupancyGrid(state, { ignoreHead: true, ignoreTail: true });
  const path = findShortestPath({
    cols: state.cols,
    rows: state.rows,
    start: state.snake[0],
    target: state.food,
    blocked,
    preferredDirections: ["up", "left", "right"]
  });
  const simulated = simulatePath(state, path);
  const direction = chooseSafeMove(state, createAutoPlayState(state));
  const next = advanceGame(state, direction, () => 0);

  assert.deepEqual(path, ["up", "left"]);
  assert.equal(hasPathToTail(simulated), false);
  assert.equal(direction, "up");
  assert.equal(next.status, "running");
  assert.equal(hasPathToTail(next), true);
});

test("fallback chooses a safe move when no usable food route is available", () => {
  const blockedPath = findShortestPath({
    cols: 4,
    rows: 4,
    start: { x: 0, y: 1 },
    target: { x: 3, y: 1 },
    blocked: new Set(["1,0", "1,1", "1,2", "1,3", "2,0", "2,1", "2,2", "2,3"]),
    preferredDirections: ["right"]
  });
  const state = {
    cols: 4,
    rows: 4,
    snake: [
      { x: 1, y: 1 },
      { x: 1, y: 2 },
      { x: 0, y: 2 },
      { x: 0, y: 1 }
    ],
    direction: "up",
    pendingDirection: "up",
    food: null,
    score: 0,
    status: "running"
  };

  const direction = chooseSafeMove(state, createAutoPlayState(state));
  const next = advanceGame(state, direction, () => 0);

  assert.equal(blockedPath, null);
  assert.equal(["up", "right", "left"].includes(direction), true);
  assert.equal(next.status, "running");
  assert.equal(hasPathToTail(next), true);
});

test("loop-risk detection penalizes short repeated cycles", () => {
  const autoState = {
    recentHeads: ["1,1", "2,1", "1,1", "2,1", "1,1", "2,1"],
    recentDirections: ["right", "left", "right", "left", "right"],
    stepsSinceFood: 8,
    lastFoodDistance: 2
  };
  const loopyState = {
    ...createInitialState({ cols: 5, rows: 5, rng: () => 0 }),
    snake: [
      { x: 2, y: 1 },
      { x: 2, y: 2 },
      { x: 1, y: 2 }
    ],
    food: { x: 4, y: 4 }
  };
  const freshState = {
    ...loopyState,
    snake: [
      { x: 3, y: 1 },
      { x: 2, y: 1 },
      { x: 2, y: 2 }
    ]
  };

  assert.ok(detectLoopRisk(autoState, loopyState, "left") > detectLoopRisk(autoState, freshState, "right"));
});

test("restart resets auto-play state cleanly", () => {
  const initial = createInitialState({ cols: 6, rows: 6, rng: () => 0 });
  const turned = setDirection(initial, "down");
  const moved = stepGame(turned);
  const autoState = createAutoPlayState(moved);
  const updatedAutoState = {
    ...autoState,
    recentHeads: [...autoState.recentHeads, "9,9"],
    recentDirections: ["down", "down"],
    stepsSinceFood: 5,
    lastFoodDistance: 12
  };
  const restarted = restartGame(moved, () => 0);
  const resetAutoState = createAutoPlayState(restarted);

  assert.equal(isDirectionAllowed(restarted, "left"), false);
  assert.equal(updatedAutoState.stepsSinceFood > resetAutoState.stepsSinceFood, true);
  assert.deepEqual(resetAutoState.recentHeads, [`${restarted.snake[0].x},${restarted.snake[0].y}`]);
  assert.deepEqual(resetAutoState.recentDirections, []);
});
