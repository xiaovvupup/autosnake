import {
  createInitialState,
  movePaddleToward,
  nudgePaddle,
  predictLandingX,
  restartGame,
  stepGame,
  togglePause
} from "./game-brick-breaker.js";

const TICK_MS = 30;
const canvas = document.querySelector("#board");
const context = canvas.getContext("2d");
const scoreElement = document.querySelector("#score");
const livesElement = document.querySelector("#lives");
const clearedElement = document.querySelector("#cleared");
const statusElement = document.querySelector("#status");
const autoStatusElement = document.querySelector("#autoStatus");
const strategyElement = document.querySelector("#strategy");
const pauseButton = document.querySelector("#pauseButton");
const restartButton = document.querySelector("#restartButton");
const autoButton = document.querySelector("#autoButton");

let state = createInitialState();
let autoEnabled = true;
canvas.width = state.width;
canvas.height = state.height;
render();

document.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();

  if ((key === "arrowleft" || key === "a") && !autoEnabled) {
    event.preventDefault();
    state = nudgePaddle(state, -32);
    render();
  }

  if ((key === "arrowright" || key === "d") && !autoEnabled) {
    event.preventDefault();
    state = nudgePaddle(state, 32);
    render();
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
  state = restartGame();
  render();
});

autoButton.addEventListener("click", () => {
  autoEnabled = !autoEnabled;
  render();
});

setInterval(() => {
  if (autoEnabled && (state.status === "ready" || state.status === "running")) {
    state = movePaddleToward(state, predictLandingX(state));
  }

  state = stepGame(state);
  render();
}, TICK_MS);

function render() {
  scoreElement.textContent = String(state.score);
  livesElement.textContent = String(state.lives);
  clearedElement.textContent = `${state.destroyed}/${state.rows * state.cols}`;
  pauseButton.textContent = state.status === "paused" ? "继续" : "暂停";
  autoButton.textContent = autoEnabled ? "自动挡板：开" : "自动挡板：关";
  autoStatusElement.textContent = autoEnabled ? "AI 预测落点中" : "手动模式";
  statusElement.textContent = getStatusText();
  strategyElement.textContent = autoEnabled
    ? "策略：预测小球落点后提前移动挡板，尽量把球重新送回密集砖区。"
    : "手动模式下，把球尽量往还没清空的区域弹。";

  draw();
}

function draw() {
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#0d1b2d";
  context.fillRect(0, 0, canvas.width, canvas.height);

  drawBricks();

  context.fillStyle = "#7eeed5";
  context.fillRect(state.paddle.x, state.paddle.y, state.paddle.width, state.paddle.height);

  context.beginPath();
  context.arc(state.ball.x, state.ball.y, state.ball.radius, 0, Math.PI * 2);
  context.fillStyle = "#ffd27f";
  context.fill();

  for (let lane = 0; lane < canvas.width; lane += 48) {
    context.fillStyle = "rgba(255,255,255,0.02)";
    context.fillRect(lane, 0, 2, canvas.height);
  }
}

function drawBricks() {
  const brickWidth = (state.width - 48) / state.cols;
  const brickHeight = 28;
  const topOffset = 60;
  const palette = ["#7ceaff", "#89ffb3", "#ffc977", "#ff8aa4", "#8ea0ff"];

  for (let row = 0; row < state.rows; row += 1) {
    for (let col = 0; col < state.cols; col += 1) {
      const brick = state.bricks[row][col];
      if (!brick.alive) {
        continue;
      }

      context.fillStyle = palette[brick.colorIndex];
      context.fillRect(24 + col * brickWidth, topOffset + row * (brickHeight + 10), brickWidth - 8, brickHeight);
    }
  }
}

function getStatusText() {
  if (state.status === "ready") {
    return "自动挡板已经就位，砖墙马上开拆。";
  }

  if (state.status === "paused") {
    return "已暂停，按空格或按钮继续。";
  }

  if (state.status === "victory") {
    return "砖块全部清空，AI 这一局完美通关。";
  }

  if (state.status === "game-over") {
    return "小球掉出场外，三条命已经用完。";
  }

  return autoEnabled
    ? "AI 正在预测小球的下一次落点。"
    : "手动模式下左右移动挡板接球。";
}
