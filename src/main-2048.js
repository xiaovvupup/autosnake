import {
  chooseAutoMove,
  createInitialState,
  move,
  restartGame,
  togglePause
} from "./game-2048.js";

const TICK_MS = 680;
const boardElement = document.querySelector("#board");
const scoreElement = document.querySelector("#score");
const bestTileElement = document.querySelector("#bestTile");
const movesElement = document.querySelector("#moves");
const statusElement = document.querySelector("#status");
const autoStatusElement = document.querySelector("#autoStatus");
const strategyElement = document.querySelector("#strategy");
const pauseButton = document.querySelector("#pauseButton");
const restartButton = document.querySelector("#restartButton");
const autoButton = document.querySelector("#autoButton");

let state = createInitialState();
let autoEnabled = true;

buildBoard();
render();

document.addEventListener("keydown", (event) => {
  const directionMap = {
    arrowup: "up",
    arrowright: "right",
    arrowdown: "down",
    arrowleft: "left"
  };
  const key = event.key.toLowerCase();

  if (directionMap[key]) {
    event.preventDefault();
    if (!autoEnabled) {
      state = move(state, directionMap[key]);
      render();
    }
    return;
  }

  if (key === " ") {
    event.preventDefault();
    state = togglePause(state);
    render();
  }
});

pauseButton.addEventListener("click", () => {
  state = togglePause(state);
  render();
});

restartButton.addEventListener("click", () => {
  state = restartGame(state);
  render();
});

autoButton.addEventListener("click", () => {
  autoEnabled = !autoEnabled;
  render();
});

setInterval(() => {
  if (autoEnabled && (state.status === "ready" || state.status === "running")) {
    const direction = chooseAutoMove(state);
    state = direction ? move(state, direction) : { ...state, status: "game-over" };
  }

  render();
}, TICK_MS);

function buildBoard() {
  boardElement.replaceChildren();

  for (let index = 0; index < 16; index += 1) {
    const cell = document.createElement("div");
    cell.className = "tile";
    boardElement.append(cell);
  }
}

function render() {
  scoreElement.textContent = String(state.score);
  bestTileElement.textContent = String(state.bestTile);
  movesElement.textContent = String(state.moves);
  pauseButton.textContent = state.status === "paused" ? "继续" : "暂停";
  autoButton.textContent = autoEnabled ? "自动合成：开" : "自动合成：关";
  autoStatusElement.textContent = autoEnabled ? "AI 持续评估四个方向" : "已切到手动模式";
  statusElement.textContent = getStatusText();
  strategyElement.textContent = autoEnabled
    ? "策略：优先保留空格、维持单调大数角落，并避免把大数字打散。"
    : "手动时建议让大数字尽量待在角落。";

  for (let index = 0; index < boardElement.children.length; index += 1) {
    const cell = boardElement.children[index];
    const value = state.board[Math.floor(index / 4)][index % 4];
    cell.textContent = value === 0 ? "" : String(value);
    cell.style.background = getTileBackground(value);
    cell.style.color = value >= 8 ? "#f7fbff" : "#203246";
  }
}

function getStatusText() {
  if (state.status === "ready") {
    return "自动 2048 已就位，马上开始连锁合成。";
  }

  if (state.status === "paused") {
    return "已暂停，按空格或按钮继续。";
  }

  if (state.status === "game-over") {
    return `棋盘卡死了，最终最大数字是 ${state.bestTile}。`;
  }

  return autoEnabled
    ? "AI 正在计算最稳的滑动方向。"
    : "你可以手动接管，看看能不能合出更大的数字。";
}

function getTileBackground(value) {
  const palette = {
    0: "rgba(255,255,255,0.06)",
    2: "linear-gradient(180deg, #e5f4ff, #cde4f5)",
    4: "linear-gradient(180deg, #d2f0ff, #9fdfff)",
    8: "linear-gradient(180deg, #ffcf7f, #ff9b42)",
    16: "linear-gradient(180deg, #ffb07f, #ff7b59)",
    32: "linear-gradient(180deg, #ff8aa5, #ff607c)",
    64: "linear-gradient(180deg, #ff7cf0, #d65cff)",
    128: "linear-gradient(180deg, #94c8ff, #6a89ff)",
    256: "linear-gradient(180deg, #8ff6d2, #43d9a1)",
    512: "linear-gradient(180deg, #7ef4ff, #38bdf8)",
    1024: "linear-gradient(180deg, #ffe480, #ffca39)",
    2048: "linear-gradient(180deg, #fff29a, #ffe34d)"
  };

  return palette[value] || "linear-gradient(180deg, #ffffff, #d6e5ff)";
}
