import test from "node:test";
import assert from "node:assert/strict";

import {
  canPlacePiece,
  clearCompleteLines,
  createInitialState,
  createPiece,
  hardDrop,
  movePiece,
  rotatePiece,
  softDrop,
  stepGame
} from "../src/game.js";
import {
  chooseAutoMove,
  createAutoPlayState,
  findBestPlacement
} from "../src/auto-play.js";

test("initial state creates a live piece and three preview pieces", () => {
  const state = createInitialState({ cols: 10, rows: 20, rng: () => 0 });

  assert.ok(state.current);
  assert.equal(state.queue.length, 3);
  assert.equal(state.status, "ready");
});

test("soft drop moves the current piece down one row", () => {
  const state = createInitialState({ cols: 10, rows: 20, rng: () => 0 });
  const next = softDrop(state);

  assert.equal(next.current.y, state.current.y + 1);
  assert.equal(next.status, "running");
});

test("rotation keeps the piece playable with simple wall kicks", () => {
  const state = {
    ...createInitialState({ cols: 10, rows: 20, rng: () => 0 }),
    current: createPiece("L", 0, 0, 0),
    status: "running"
  };

  const rotated = rotatePiece(state, 1);

  assert.equal(canPlacePiece(rotated.board, rotated.current, rotated.cols, rotated.rows), true);
});

test("hard drop locks a piece, clears a line, and awards score", () => {
  const state = {
    ...createInitialState({ cols: 10, rows: 20, rng: () => 0 }),
    board: Array.from({ length: 20 }, (_, row) =>
      row === 19
        ? [null, null, null, null, "O", "O", "O", "O", "O", "O"]
        : Array(10).fill(null)
    ),
    current: createPiece("I", 0, 0, 18),
    queue: ["T", "S", "Z"],
    bag: ["J", "L", "O"],
    status: "running"
  };

  const next = hardDrop(state, () => 0);

  assert.equal(next.lines, 1);
  assert.equal(next.score, 100);
  assert.equal(next.piecesPlaced, 1);
  assert.equal(next.board[19].every((cell) => cell === null), true);
});

test("clearing lines inserts empty rows back at the top", () => {
  const board = [
    ["I", "I", "I", "I"],
    [null, null, null, null],
    ["O", "O", "O", "O"],
    [null, "T", null, null]
  ];

  const cleared = clearCompleteLines(board, 4);

  assert.equal(cleared.cleared, 2);
  assert.deepEqual(cleared.board[0], [null, null, null, null]);
  assert.deepEqual(cleared.board[1], [null, null, null, null]);
});

test("auto-play finds the line-clearing horizontal placement", () => {
  const state = {
    ...createInitialState({ cols: 10, rows: 20, rng: () => 0 }),
    board: Array.from({ length: 20 }, (_, row) =>
      row === 19
        ? [null, null, null, null, "O", "O", "O", "O", "O", "O"]
        : Array(10).fill(null)
    ),
    current: createPiece("I", 0, 3, 0),
    status: "running"
  };

  const plan = findBestPlacement(state);

  assert.ok(plan);
  assert.equal(plan.cleared, 1);
  assert.equal(Math.abs(plan.x), 0);
});

test("auto-play decision metadata records the latest plan", () => {
  const state = createInitialState({ cols: 10, rows: 20, rng: () => 0 });
  const decision = chooseAutoMove(state, createAutoPlayState());

  assert.ok(decision.plan);
  assert.equal(decision.autoState.decisions, 1);
  assert.deepEqual(decision.autoState.lastPlan, decision.plan);
});
