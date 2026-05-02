import {
  createInitialState,
  createPiece,
  getCurrentPieceCells,
  getGhostY,
  getPieceCells,
  getRotationCount,
  movePiece,
  restartGame,
  rotatePiece,
  softDrop,
  stepGame,
  togglePause
} from "./game.js";
import {
  chooseAutoMove,
  createAutoPlayState
} from "./auto-play.js";

const TICK_MS = 160;
const boardElement = document.querySelector("#board");
const nextBoardElement = document.querySelector("#nextBoard");
const scoreElement = document.querySelector("#score");
const linesElement = document.querySelector("#lines");
const levelElement = document.querySelector("#level");
const piecesElement = document.querySelector("#pieces");
const statusElement = document.querySelector("#status");
const pauseButton = document.querySelector("#pauseButton");
const restartButton = document.querySelector("#restartButton");
const autoPlayButton = document.querySelector("#autoPlayButton");
const autoStatusElement = document.querySelector("#autoStatus");
const strategyElement = document.querySelector("#strategy");
const controlButtons = document.querySelectorAll("[data-action]");

let state = createInitialState();
let autoPlayEnabled = true;
let autoPlayState = createAutoPlayState();
let autoPlan = null;
let autoPlanPieceKey = null;

function buildGrid(element, cols, rows, className = "cell") {
  element.style.setProperty("--cols", String(cols));
  element.replaceChildren();

  for (let index = 0; index < cols * rows; index += 1) {
    const cell = document.createElement("div");
    cell.className = className;
    cell.dataset.x = String(index % cols);
    cell.dataset.y = String(Math.floor(index / cols));
    element.append(cell);
  }
}

function render() {
  scoreElement.textContent = String(state.score);
  linesElement.textContent = String(state.lines);
  levelElement.textContent = String(state.level);
  piecesElement.textContent = String(state.piecesPlaced);
  statusElement.textContent = getStatusText();
  pauseButton.textContent = state.status === "paused" ? "继续" : "暂停";
  autoPlayButton.textContent = autoPlayEnabled ? "自动驾驶：开" : "自动驾驶：关";
  autoStatusElement.textContent = `AI 决策 ${autoPlayState.decisions} 次`;
  strategyElement.textContent = getStrategyText();

  renderBoard();
  renderNextPiece();
}

function renderBoard() {
  const activeType = state.current?.type || null;
  const activeCells = new Set(getCurrentPieceCells(state).map(toKey));
  const ghostY = getGhostY(state);
  const ghostCells = state.current
    ? new Set(
        getPieceCells({ ...state.current, y: ghostY })
          .map(toKey)
          .filter((key) => !activeCells.has(key))
      )
    : new Set();

  for (const cell of boardElement.children) {
    const x = Number(cell.dataset.x);
    const y = Number(cell.dataset.y);
    const key = toKey({ x, y });
    const lockedType = state.board[y][x];
    const tone = lockedType || (activeCells.has(key) ? activeType : null);

    cell.className = "cell";

    if (ghostCells.has(key)) {
      cell.classList.add("ghost");
      if (activeType) {
        cell.classList.add(`piece-${activeType.toLowerCase()}`);
      }
    }

    if (tone) {
      cell.classList.add("filled", `piece-${tone.toLowerCase()}`);
    }

    if (activeCells.has(key)) {
      cell.classList.add("is-current");
    }
  }
}

function renderNextPiece() {
  const nextType = state.queue[0];
  const nextCells = nextType
    ? new Set(getPieceCells(createPiece(nextType, 0, 0, 0)).map(toKey))
    : new Set();

  for (const cell of nextBoardElement.children) {
    const x = Number(cell.dataset.x);
    const y = Number(cell.dataset.y);
    const key = toKey({ x, y });

    cell.className = "preview-cell";
    if (nextCells.has(key)) {
      cell.classList.add("filled", `piece-${nextType.toLowerCase()}`);
    }
  }
}

function getStatusText() {
  if (state.status === "ready") {
    return autoPlayEnabled
      ? "自动驾驶已接管，正在扫描最稳的落点。"
      : "方向键移动，向上旋转，空格速降。";
  }

  if (state.status === "paused") {
    return "游戏已暂停，按 P 或按钮继续。";
  }

  if (state.status === "game-over") {
    return autoPlayEnabled
      ? "AI 把方块堆到顶了，重开后会继续自动作战。"
      : "堆到天花板了，按回车或点击重开。";
  }

  if (autoPlayEnabled) {
    return state.lastClear > 0
      ? `AI 刚刚清掉 ${state.lastClear} 行，继续压低地形。`
      : "AI 正在优先消行、压低高度、减少空洞。";
  }

  return "手动模式进行中，稳住节奏别留空洞。";
}

function getStrategyText() {
  const plan = autoPlayState.lastPlan;
  if (!autoPlayEnabled || !plan) {
    return "策略面板：关闭自动时，你可以手动接管整局。";
  }

  return `上一手：${plan.type} 方块落在第 ${plan.x + 1} 列，目标旋转 ${plan.rotation + 1}，预估消行 ${plan.cleared}。`;
}

function handleAction(action, options = {}) {
  if (autoPlayEnabled && !options.fromAuto && !["pause", "restart", "toggle-auto"].includes(action)) {
    render();
    return;
  }

  switch (action) {
    case "left":
      state = movePiece(state, -1);
      break;
    case "right":
      state = movePiece(state, 1);
      break;
    case "rotate":
      state = rotatePiece(state, 1);
      break;
    case "rotate-back":
      state = rotatePiece(state, -1);
      break;
    case "down":
      state = softDrop(state);
      break;
    case "drop":
      state = hardDrop(state);
      break;
    case "pause":
      state = togglePause(state);
      break;
    case "restart":
      state = restartGame(state);
      autoPlayState = createAutoPlayState();
      clearAutoPlan();
      break;
    case "toggle-auto":
      autoPlayEnabled = !autoPlayEnabled;
      autoPlayState = createAutoPlayState();
      clearAutoPlan();
      break;
    default:
      break;
  }

  render();
}

document.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();

  if (key === "arrowleft" || key === "a") {
    event.preventDefault();
    handleAction("left");
    return;
  }

  if (key === "arrowright" || key === "d") {
    event.preventDefault();
    handleAction("right");
    return;
  }

  if (key === "arrowdown" || key === "s") {
    event.preventDefault();
    handleAction("down");
    return;
  }

  if (key === "arrowup" || key === "w" || key === "x") {
    event.preventDefault();
    handleAction("rotate");
    return;
  }

  if (key === "q") {
    event.preventDefault();
    handleAction("rotate-back");
    return;
  }

  if (key === " ") {
    event.preventDefault();
    handleAction("drop");
    return;
  }

  if (key === "p") {
    event.preventDefault();
    handleAction("pause");
    return;
  }

  if (key === "enter") {
    event.preventDefault();
    handleAction("restart");
  }
});

pauseButton.addEventListener("click", () => handleAction("pause"));
restartButton.addEventListener("click", () => handleAction("restart"));
autoPlayButton.addEventListener("click", () => handleAction("toggle-auto"));

for (const button of controlButtons) {
  button.addEventListener("click", () => {
    handleAction(button.dataset.action);
  });
}

setInterval(() => {
  if (autoPlayEnabled && (state.status === "ready" || state.status === "running")) {
    state = runAutoTick(state);
  } else {
    state = stepGame(state);
  }

  render();
}, TICK_MS);

buildGrid(boardElement, state.cols, state.rows);
buildGrid(nextBoardElement, 4, 4, "preview-cell");
render();

function toKey(cell) {
  return `${cell.x},${cell.y}`;
}

function runAutoTick(currentState) {
  if (!currentState.current) {
    return currentState;
  }

  ensureAutoPlan(currentState);
  if (!autoPlan) {
    return stepGame(currentState);
  }

  const pieceBefore = getPieceKey(currentState);
  const rotationCount = getRotationCount(currentState.current.type);
  const forwardTurns = (autoPlan.rotation - currentState.current.rotation + rotationCount) % rotationCount;
  const backwardTurns = (currentState.current.rotation - autoPlan.rotation + rotationCount) % rotationCount;

  if (forwardTurns !== 0 || backwardTurns !== 0) {
    const rotated = rotatePiece(currentState, forwardTurns <= backwardTurns ? 1 : -1);
    if (rotated === currentState) {
      clearAutoPlan();
      return softDrop(currentState);
    }

    return clearPlanIfPieceChanged(pieceBefore, rotated);
  }

  if (currentState.current.x < autoPlan.x) {
    const moved = movePiece(currentState, 1);
    if (moved === currentState) {
      clearAutoPlan();
      return softDrop(currentState);
    }

    return clearPlanIfPieceChanged(pieceBefore, moved);
  }

  if (currentState.current.x > autoPlan.x) {
    const moved = movePiece(currentState, -1);
    if (moved === currentState) {
      clearAutoPlan();
      return softDrop(currentState);
    }

    return clearPlanIfPieceChanged(pieceBefore, moved);
  }

  return clearPlanIfPieceChanged(pieceBefore, softDrop(currentState));
}

function ensureAutoPlan(currentState) {
  const pieceKey = getPieceKey(currentState);
  if (autoPlan && autoPlanPieceKey === pieceKey) {
    return;
  }

  const decision = chooseAutoMove(currentState, autoPlayState);
  autoPlayState = decision.autoState;
  autoPlan = decision.plan;
  autoPlanPieceKey = pieceKey;
}

function clearPlanIfPieceChanged(previousPieceKey, nextState) {
  if (getPieceKey(nextState) !== previousPieceKey) {
    clearAutoPlan();
  }

  return nextState;
}

function clearAutoPlan() {
  autoPlan = null;
  autoPlanPieceKey = null;
}

function getPieceKey(currentState) {
  return currentState.current
    ? `${currentState.piecesPlaced}:${currentState.current.type}`
    : "none";
}
