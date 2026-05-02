import {
  chooseAutoAction,
  createInitialState,
  restartGame,
  revealCell,
  toggleFlag
} from "./game-minesweeper.js";

const TICK_MS = 420;
const boardElement = document.querySelector("#board");
const revealedElement = document.querySelector("#revealed");
const flagsElement = document.querySelector("#flags");
const statusElement = document.querySelector("#status");
const autoStatusElement = document.querySelector("#autoStatus");
const strategyElement = document.querySelector("#strategy");
const pauseButton = document.querySelector("#pauseButton");
const restartButton = document.querySelector("#restartButton");
const autoButton = document.querySelector("#autoButton");

let state = createInitialState();
let autoEnabled = true;
let paused = false;

buildBoard();
render();

pauseButton.addEventListener("click", () => {
  paused = !paused;
  render();
});

restartButton.addEventListener("click", () => {
  state = restartGame(state);
  paused = false;
  render();
});

autoButton.addEventListener("click", () => {
  autoEnabled = !autoEnabled;
  render();
});

document.addEventListener("keydown", (event) => {
  if (event.key === " ") {
    event.preventDefault();
    paused = !paused;
    render();
  }
});

setInterval(() => {
  if (paused || state.status === "game-over" || state.status === "victory") {
    return;
  }

  if (autoEnabled) {
    const action = chooseAutoAction(state);
    if (action) {
      state = action.type === "flag"
        ? toggleFlag(state, action.x, action.y)
        : revealCell(state, action.x, action.y);
    }
  }

  render();
}, TICK_MS);

function buildBoard() {
  boardElement.replaceChildren();

  for (let index = 0; index < state.rows * state.cols; index += 1) {
    const cell = document.createElement("button");
    cell.type = "button";
    cell.className = "mine-cell";
    cell.dataset.x = String(index % state.cols);
    cell.dataset.y = String(Math.floor(index / state.cols));
    cell.addEventListener("click", () => {
      if (!autoEnabled && !paused) {
        state = revealCell(state, Number(cell.dataset.x), Number(cell.dataset.y));
        render();
      }
    });
    cell.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      if (!autoEnabled && !paused) {
        state = toggleFlag(state, Number(cell.dataset.x), Number(cell.dataset.y));
        render();
      }
    });
    boardElement.append(cell);
  }
}

function render() {
  revealedElement.textContent = String(state.revealed);
  flagsElement.textContent = `${state.flagsUsed}/${state.mines}`;
  pauseButton.textContent = paused ? "继续" : "暂停";
  autoButton.textContent = autoEnabled ? "自动排雷：开" : "自动排雷：关";
  autoStatusElement.textContent = autoEnabled ? "AI 正在做单步推理" : "手动模式";
  statusElement.textContent = getStatusText();
  strategyElement.textContent = autoEnabled
    ? "策略：先做确定性推理，推不出来时再挑风险最低的格子试探。"
    : "手动时左键翻开、右键插旗。";

  for (const cell of boardElement.children) {
    const x = Number(cell.dataset.x);
    const y = Number(cell.dataset.y);
    const data = state.board?.[y]?.[x];

    if (!data) {
      styleHidden(cell);
      continue;
    }

    if (data.revealed) {
      cell.style.background = data.mine ? "#ff7b7b" : "rgba(255,255,255,0.12)";
      cell.style.color = getNumberColor(data.adjacent);
      cell.textContent = data.mine ? "💣" : data.adjacent === 0 ? "" : String(data.adjacent);
      continue;
    }

    if (data.flagged) {
      cell.style.background = "rgba(255, 209, 125, 0.22)";
      cell.style.color = "#ffd27f";
      cell.textContent = "🚩";
      continue;
    }

    styleHidden(cell);
    if (state.status === "game-over" && data.mine) {
      cell.style.background = "rgba(255, 123, 123, 0.22)";
      cell.style.color = "#ff9ca8";
      cell.textContent = "💣";
    }
  }
}

function styleHidden(cell) {
  cell.style.background = "rgba(255,255,255,0.05)";
  cell.style.color = "#dcecff";
  cell.textContent = "";
}

function getStatusText() {
  if (paused) {
    return "排雷已暂停。";
  }

  if (state.status === "ready") {
    return "自动扫雷会从中心区域开始开图。";
  }

  if (state.status === "victory") {
    return "所有安全格都翻开了，这局已经完成。";
  }

  if (state.status === "game-over") {
    return "踩到雷了，这一步的风险判断没躲过去。";
  }

  return autoEnabled
    ? "AI 正在根据数字关系判断安全格和地雷。"
    : "你可以手动推理，也可以随时重新打开自动模式。";
}

function getNumberColor(value) {
  const palette = {
    1: "#7ceaff",
    2: "#89ffb3",
    3: "#ffc977",
    4: "#ff8aa4",
    5: "#d49bff",
    6: "#8ea0ff",
    7: "#f7fbff",
    8: "#bcd8ff"
  };

  return palette[value] || "#203246";
}
