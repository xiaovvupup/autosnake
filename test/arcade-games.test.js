import test from "node:test";
import assert from "node:assert/strict";

import {
  collapseLine,
  createInitialState as create2048State,
  move as move2048
} from "../src/game-2048.js";
import {
  createInitialState as createBrickState,
  predictLandingX,
  stepGame as stepBrick
} from "../src/game-brick-breaker.js";
import {
  chooseAutoAction,
  createInitialState as createMineState,
  generateBoard,
  revealCell
} from "../src/game-minesweeper.js";

test("2048 collapse merges adjacent values once per move", () => {
  const result = collapseLine([2, 2, 4, 4]);

  assert.deepEqual(result.line, [4, 8, 0, 0]);
  assert.equal(result.gained, 12);
});

test("2048 move updates score and board when a merge happens", () => {
  const state = {
    ...create2048State(),
    board: [
      [2, 2, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0]
    ],
    score: 0,
    status: "running"
  };

  const next = move2048(state, "left", () => 0);

  assert.equal(next.score, 4);
  assert.equal(next.board[0][0], 4);
});

test("brick breaker predicts a landing position inside the board", () => {
  const state = createBrickState();
  const landingX = predictLandingX({
    ...state,
    ball: {
      ...state.ball,
      x: 120,
      y: 200,
      vx: 4,
      vy: 5
    }
  });

  assert.equal(landingX >= 0 && landingX <= state.width, true);
});

test("brick breaker destroys a brick on collision", () => {
  const state = createBrickState();
  const next = stepBrick({
    ...state,
    status: "running",
    ball: {
      ...state.ball,
      x: 40,
      y: 74,
      vx: 0,
      vy: -2
    }
  });

  assert.equal(next.destroyed, 1);
  assert.equal(next.score, 100);
});

test("minesweeper board generation keeps the first click safe", () => {
  const board = generateBoard(10, 10, 14, { x: 5, y: 5 }, () => 0);

  assert.equal(board[5][5].mine, false);
  assert.equal(board[4][4].mine, false);
  assert.equal(board[6][6].mine, false);
});

test("minesweeper auto action can identify a forced flag", () => {
  const state = {
    ...createMineState({ rows: 2, cols: 2, mines: 1 }),
    board: [
      [
        { x: 0, y: 0, mine: false, flagged: false, revealed: true, adjacent: 1 },
        { x: 1, y: 0, mine: true, flagged: false, revealed: false, adjacent: 0 }
      ],
      [
        { x: 0, y: 1, mine: false, flagged: false, revealed: true, adjacent: 1 },
        { x: 1, y: 1, mine: false, flagged: false, revealed: true, adjacent: 1 }
      ]
    ],
    status: "running",
    flagsUsed: 0,
    revealed: 3
  };

  assert.deepEqual(chooseAutoAction(state), { type: "flag", x: 1, y: 0 });
});

test("minesweeper reveal cell starts the board and reveals at least one tile", () => {
  const next = revealCell(createMineState(), 5, 5, () => 0);

  assert.ok(next.board);
  assert.equal(next.revealed > 0, true);
});
