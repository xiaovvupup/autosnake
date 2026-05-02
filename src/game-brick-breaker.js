export function createInitialState() {
  const rows = 6;
  const cols = 10;
  const width = 480;
  const height = 640;
  const bricks = Array.from({ length: rows }, (_, row) =>
    Array.from({ length: cols }, (_, col) => ({
      alive: true,
      colorIndex: (row + col) % 5
    }))
  );

  return {
    width,
    height,
    rows,
    cols,
    bricks,
    paddle: {
      x: width / 2 - 56,
      y: height - 56,
      width: 112,
      height: 16
    },
    ball: {
      x: width / 2,
      y: height - 90,
      vx: 4,
      vy: -5,
      radius: 9
    },
    score: 0,
    lives: 3,
    destroyed: 0,
    status: "ready"
  };
}

export function restartGame() {
  return createInitialState();
}

export function togglePause(state) {
  if (state.status === "ready" || state.status === "game-over" || state.status === "victory") {
    return state;
  }

  return {
    ...state,
    status: state.status === "paused" ? "running" : "paused"
  };
}

export function movePaddleToward(state, targetX) {
  const clamped = clamp(targetX - state.paddle.width / 2, 0, state.width - state.paddle.width);
  return {
    ...state,
    paddle: {
      ...state.paddle,
      x: clamped
    }
  };
}

export function nudgePaddle(state, delta) {
  return movePaddleToward(state, state.paddle.x + state.paddle.width / 2 + delta);
}

export function predictLandingX(state) {
  const paddleY = state.paddle.y;
  const ball = { ...state.ball };

  if (ball.vy <= 0) {
    return ball.x;
  }

  while (ball.y < paddleY) {
    ball.x += ball.vx;
    ball.y += ball.vy;

    if (ball.x - ball.radius <= 0 || ball.x + ball.radius >= state.width) {
      ball.vx *= -1;
      ball.x = clamp(ball.x, ball.radius, state.width - ball.radius);
    }
  }

  return clamp(ball.x, ball.radius, state.width - ball.radius);
}

export function stepGame(state) {
  if (state.status === "paused" || state.status === "game-over" || state.status === "victory") {
    return state;
  }

  const status = state.status === "ready" ? "running" : state.status;
  let ball = {
    ...state.ball,
    x: state.ball.x + state.ball.vx,
    y: state.ball.y + state.ball.vy
  };
  let next = { ...state, status, ball };

  if (ball.x - ball.radius <= 0 || ball.x + ball.radius >= state.width) {
    ball = {
      ...ball,
      x: clamp(ball.x, ball.radius, state.width - ball.radius),
      vx: -ball.vx
    };
    next = { ...next, ball };
  }

  if (ball.y - ball.radius <= 0) {
    ball = {
      ...ball,
      y: ball.radius,
      vy: Math.abs(ball.vy)
    };
    next = { ...next, ball };
  }

  if (intersectsRect(ball, state.paddle) && ball.vy > 0) {
    const offset = (ball.x - (state.paddle.x + state.paddle.width / 2)) / (state.paddle.width / 2);
    ball = {
      ...ball,
      y: state.paddle.y - ball.radius,
      vx: offset * 6,
      vy: -Math.max(4.2, Math.abs(ball.vy))
    };
    next = { ...next, ball };
  }

  const collision = findBrickCollision(next);
  if (collision) {
    const bricks = cloneBricks(state.bricks);
    bricks[collision.row][collision.col].alive = false;
    ball = {
      ...next.ball,
      vy: -next.ball.vy
    };
    next = {
      ...next,
      bricks,
      ball,
      score: state.score + 100,
      destroyed: state.destroyed + 1
    };
  }

  if (next.destroyed === state.rows * state.cols) {
    return {
      ...next,
      status: "victory"
    };
  }

  if (next.ball.y - next.ball.radius > state.height) {
    if (state.lives <= 1) {
      return {
        ...next,
        lives: 0,
        status: "game-over"
      };
    }

    return {
      ...next,
      lives: state.lives - 1,
      ball: resetBall(state),
      status: "running"
    };
  }

  return next;
}

function resetBall(state) {
  return {
    x: state.width / 2,
    y: state.height - 90,
    vx: 4,
    vy: -5,
    radius: state.ball.radius
  };
}

function findBrickCollision(state) {
  const brickWidth = (state.width - 48) / state.cols;
  const brickHeight = 28;
  const topOffset = 60;

  for (let row = 0; row < state.rows; row += 1) {
    for (let col = 0; col < state.cols; col += 1) {
      if (!state.bricks[row][col].alive) {
        continue;
      }

      const rect = {
        x: 24 + col * brickWidth,
        y: topOffset + row * (brickHeight + 10),
        width: brickWidth - 8,
        height: brickHeight
      };

      if (intersectsRect(state.ball, rect)) {
        return { row, col };
      }
    }
  }

  return null;
}

function intersectsRect(ball, rect) {
  const nearestX = clamp(ball.x, rect.x, rect.x + rect.width);
  const nearestY = clamp(ball.y, rect.y, rect.y + rect.height);
  const dx = ball.x - nearestX;
  const dy = ball.y - nearestY;
  return dx * dx + dy * dy <= ball.radius * ball.radius;
}

function cloneBricks(bricks) {
  return bricks.map((row) => row.map((cell) => ({ ...cell })));
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}
