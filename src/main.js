import {
  createInitialState,
  restartGame,
  setDirection,
  stepGame,
  togglePause,
  sameCell
} from "./game.js";
import {
  chooseSafeMove,
  createAutoPlayState,
  recordAutoPlayStep
} from "./auto-play.js";

const TICK_MS = 140;
const boardElement = document.querySelector("#board");
const scoreElement = document.querySelector("#score");
const statusElement = document.querySelector("#status");
const pauseButton = document.querySelector("#pauseButton");
const restartButton = document.querySelector("#restartButton");
const autoPlayButton = document.querySelector("#autoPlayButton");
const autoStatusElement = document.querySelector("#autoStatus");
const directionButtons = document.querySelectorAll("[data-direction]");

let state = createInitialState();
let autoPlayEnabled = false;
let autoPlayState = createAutoPlayState(state);

function buildBoard() {
  boardElement.style.setProperty("--cols", String(state.cols));
  boardElement.replaceChildren();

  for (let index = 0; index < state.cols * state.rows; index += 1) {
    const cell = document.createElement("div");
    cell.className = "cell";
    cell.dataset.x = String(index % state.cols);
    cell.dataset.y = String(Math.floor(index / state.cols));
    boardElement.append(cell);
  }
}

function render() {
  scoreElement.textContent = String(state.score);
  statusElement.textContent = getStatusText(state, autoPlayEnabled);
  pauseButton.textContent = state.status === "paused" ? "Resume" : "Pause";
  autoPlayButton.textContent = autoPlayEnabled ? "Auto On" : "Auto Off";
  autoStatusElement.textContent = `Auto: ${autoPlayEnabled ? "On" : "Off"}`;

  for (const cell of boardElement.children) {
    const x = Number(cell.dataset.x);
    const y = Number(cell.dataset.y);
    const isHead = sameCell(state.snake[0], { x, y });
    const isBody = state.snake.slice(1).some((part) => part.x === x && part.y === y);
    const isFood = sameCell(state.food, { x, y });

    cell.className = "cell";
    if (isHead) cell.classList.add("snake-head");
    if (isBody) cell.classList.add("snake-body");
    if (isFood) cell.classList.add("food");
  }
}

function getStatusText(currentState, isAutoPlayEnabled) {
  if (currentState.status === "ready") {
    return isAutoPlayEnabled
      ? "Auto-play is armed and will start on the next tick."
      : "Use arrow keys or WASD to start moving.";
  }

  if (currentState.status === "paused") {
    return "Paused. Press Space or use the button to continue.";
  }

  if (currentState.status === "game-over") {
    return "Game over. Press Enter or Restart to play again.";
  }

  return isAutoPlayEnabled
    ? "Auto-play is steering toward food while favoring safe routes."
    : "Eat food, grow longer, and avoid the walls and yourself.";
}

function handleDirection(direction, options = {}) {
  if (autoPlayEnabled && !options.fromAutoPlay) {
    render();
    return;
  }

  state = setDirection(state, direction);
  render();
}

function handleRestart() {
  state = restartGame(state);
  autoPlayState = createAutoPlayState(state);
  render();
}

function toggleAutoPlay() {
  autoPlayEnabled = !autoPlayEnabled;
  autoPlayState = createAutoPlayState(state);
  render();
}

document.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();
  const directionMap = {
    arrowup: "up",
    w: "up",
    arrowdown: "down",
    s: "down",
    arrowleft: "left",
    a: "left",
    arrowright: "right",
    d: "right"
  };

  if (directionMap[key]) {
    event.preventDefault();
    handleDirection(directionMap[key]);
    return;
  }

  if (key === " ") {
    event.preventDefault();
    state = togglePause(state);
    render();
    return;
  }

  if (key === "enter") {
    event.preventDefault();
    handleRestart();
  }
});

pauseButton.addEventListener("click", () => {
  state = togglePause(state);
  render();
});

restartButton.addEventListener("click", handleRestart);
autoPlayButton.addEventListener("click", toggleAutoPlay);

for (const button of directionButtons) {
  button.addEventListener("click", () => {
    handleDirection(button.dataset.direction);
  });
}

setInterval(() => {
  const previousState = state;
  let appliedDirection = null;

  if (autoPlayEnabled && (state.status === "ready" || state.status === "running")) {
    appliedDirection = chooseSafeMove(state, autoPlayState);
    state = setDirection(state, appliedDirection);
  }

  state = stepGame(state);
  autoPlayState = recordAutoPlayStep(autoPlayState, previousState, state, appliedDirection);
  render();
}, TICK_MS);

buildBoard();
render();
