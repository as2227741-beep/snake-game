const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Responsive sizing
const CELL = 20;
const COLS = 26, ROWS = 26;
canvas.width = COLS * CELL;
canvas.height = ROWS * CELL;

// Game state
let snake, dir, nextDir, food, bonus, score, best, gameLoop, running, paused, frame;
best = parseInt(localStorage.getItem('serpent_best') || '0');
document.getElementById('bestDisplay').textContent = best;

// Speed tiers: ms per frame
const SPEEDS = [140, 115, 95, 78, 62];
let speedTier = 0;

const SCORE_THRESHOLDS = [0, 50, 120, 230, 380];

function initGame() {
  snake = [
    { x: 13, y: 13 },
    { x: 12, y: 13 },
    { x: 11, y: 13 },
  ];
  dir = { x: 1, y: 0 };
  nextDir = { x: 1, y: 0 };
  score = 0;
  frame = 0;
  speedTier = 0;
  bonus = null;
  placeFood();
  updateScore(0);
  updateSpeedDots();
}

function placeFood() {
  let pos;
  do {
    pos = { x: Math.floor(Math.random() * COLS), y: Math.floor(Math.random() * ROWS) };
  } while (snake.some(s => s.x === pos.x && s.y === pos.y));
  food = pos;
  food.pulse = 0;
}

function placeBonusFood() {
  if (bonus) return;
  let pos;
  do {
    pos = { x: Math.floor(Math.random() * COLS), y: Math.floor(Math.random() * ROWS) };
  } while (snake.some(s => s.x === pos.x && s.y === pos.y) || (food.x === pos.x && food.y === pos.y));
  bonus = { ...pos, life: 120, pulse: 0 };
}

function startGame() {
  running = true; paused = false;
  hide('startOverlay'); hide('gameOverOverlay'); hide('pauseOverlay');
  initGame();
  clearInterval(gameLoop);
  gameLoop = setInterval(tick, SPEEDS[speedTier]);
}

function togglePause() {
  if (!running) return;
  paused = !paused;
  if (paused) show('pauseOverlay');
  else hide('pauseOverlay');
}

function endGame() {
  running = false; clearInterval(gameLoop);
  if (score > best) {
    best = score;
    localStorage.setItem('serpent_best', best);
    document.getElementById('bestDisplay').textContent = best;
  }
  document.getElementById('finalScore').innerHTML = `Score: <span>${score}</span>`;
  show('gameOverOverlay');
}

function tick() {
  if (paused) return;
  frame++;
  food.pulse = (food.pulse + 0.12) % (Math.PI * 2);
  if (bonus) { bonus.pulse = (bonus.pulse + 0.15) % (Math.PI * 2); bonus.life--; if (bonus.life <= 0) bonus = null; }

  dir = { ...nextDir };
  const head = { x: (snake[0].x + dir.x + COLS) % COLS, y: (snake[0].y + dir.y + ROWS) % ROWS };

  // Self collision
  if (snake.some(s => s.x === head.x && s.y === head.y)) { endGame(); return; }

  snake.unshift(head);
  let grew = false;

  if (head.x === food.x && head.y === food.y) {
    grew = true;
    score += 10;
    updateScore(score);
    placeFood();
    // Maybe spawn bonus
    if (score % 50 === 0) placeBonusFood();
    // Speed up
    const newTier = SCORE_THRESHOLDS.findLastIndex(t => score >= t);
    if (newTier > speedTier) {
      speedTier = newTier;
      clearInterval(gameLoop);
      gameLoop = setInterval(tick, SPEEDS[speedTier]);
      updateSpeedDots();
    }
  }

  if (bonus && head.x === bonus.x && head.y === bonus.y) {
    grew = true;
    score += 30;
    updateScore(score);
    bonus = null;
  }

  if (!grew) snake.pop();
  draw();
}

function draw() {
  // Clear
  ctx.fillStyle = '#030509';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Subtle grid
  ctx.strokeStyle = 'rgba(0,255,180,0.04)';
  ctx.lineWidth = 0.5;
  for (let x = 0; x <= COLS; x++) { ctx.beginPath(); ctx.moveTo(x*CELL,0); ctx.lineTo(x*CELL,canvas.height); ctx.stroke(); }
  for (let y = 0; y <= ROWS; y++) { ctx.beginPath(); ctx.moveTo(0,y*CELL); ctx.lineTo(canvas.width,y*CELL); ctx.stroke(); }

  // Snake
  snake.forEach((seg, i) => {
    const isHead = i === 0;
    const t = i / snake.length;
    const alpha = 1 - t * 0.55;

    // Glow layers
    if (isHead) {
      ctx.shadowColor = '#00ffb3';
      ctx.shadowBlur = 18;
    } else {
      ctx.shadowColor = '#00ffb3';
      ctx.shadowBlur = 8 * (1 - t * 0.7);
    }

    // Body color gradient head→tail: neon → cyan → dim
    const r1 = [0, 255, 179], r2 = [0, 200, 255], r3 = [0, 100, 80];
    let r, g, b;
    if (t < 0.5) {
      const f = t * 2;
      r = r1[0] + (r2[0]-r1[0])*f; g = r1[1] + (r2[1]-r1[1])*f; b = r1[2] + (r2[2]-r1[2])*f;
    } else {
      const f = (t-0.5)*2;
      r = r2[0] + (r3[0]-r2[0])*f; g = r2[1] + (r3[1]-r2[1])*f; b = r2[2] + (r3[2]-r2[2])*f;
    }
    ctx.fillStyle = `rgba(${r|0},${g|0},${b|0},${alpha})`;

    const pad = isHead ? 1 : 2;
    const radius = isHead ? 5 : 3;
    roundRect(ctx, seg.x*CELL+pad, seg.y*CELL+pad, CELL-pad*2, CELL-pad*2, radius);
    ctx.fill();

    // Head eyes
    if (isHead) {
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#fff';
      const ex = dir.x, ey = dir.y;
      const cx = seg.x*CELL + CELL/2, cy = seg.y*CELL + CELL/2;
      const offX = ey !== 0 ? 4 : 0, offY = ex !== 0 ? 4 : 0;
      const fwdX = ex * 3, fwdY = ey * 3;
      ctx.beginPath(); ctx.arc(cx + fwdX + offX, cy + fwdY + offY, 2, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(cx + fwdX - offX, cy + fwdY - offY, 2, 0, Math.PI*2); ctx.fill();
    }
  });
  ctx.shadowBlur = 0;

  // Food
  const fpulse = Math.sin(food.pulse) * 2;
  const fr = CELL/2 - 2 + fpulse * 0.4;
  const fcx = food.x*CELL + CELL/2, fcy = food.y*CELL + CELL/2;

  // Glow rings
  ctx.shadowColor = '#ffcc00'; ctx.shadowBlur = 20;
  const grad = ctx.createRadialGradient(fcx, fcy, 1, fcx, fcy, fr);
  grad.addColorStop(0, '#fff8cc');
  grad.addColorStop(0.5, '#ffcc00');
  grad.addColorStop(1, 'rgba(255,160,0,0.3)');
  ctx.fillStyle = grad;
  ctx.beginPath(); ctx.arc(fcx, fcy, fr, 0, Math.PI*2); ctx.fill();
  ctx.shadowBlur = 0;

  // Bonus food
  if (bonus) {
    const bp = Math.sin(bonus.pulse) * 2;
    const br = CELL/2 - 2 + bp * 0.5;
    const bcx = bonus.x*CELL + CELL/2, bcy = bonus.y*CELL + CELL/2;
    const lifeAlpha = Math.min(1, bonus.life / 30);

    ctx.shadowColor = '#ff3aff'; ctx.shadowBlur = 24;
    const bgrad = ctx.createRadialGradient(bcx, bcy, 1, bcx, bcy, br);
    bgrad.addColorStop(0, `rgba(255,255,255,${lifeAlpha})`);
    bgrad.addColorStop(0.5, `rgba(255,58,255,${lifeAlpha})`);
    bgrad.addColorStop(1, `rgba(180,0,255,0)`);
    ctx.fillStyle = bgrad;
    ctx.beginPath(); ctx.arc(bcx, bcy, br, 0, Math.PI*2); ctx.fill();

    // Timer ring
    const progress = bonus.life / 120;
    ctx.strokeStyle = `rgba(255,58,255,${lifeAlpha * 0.6})`;
    ctx.lineWidth = 1.5;
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.arc(bcx, bcy, br + 4, -Math.PI/2, -Math.PI/2 + Math.PI*2*progress);
    ctx.stroke();

    ctx.shadowBlur = 0;
  }
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x+r, y);
  ctx.lineTo(x+w-r, y); ctx.arcTo(x+w, y, x+w, y+r, r);
  ctx.lineTo(x+w, y+h-r); ctx.arcTo(x+w, y+h, x+w-r, y+h, r);
  ctx.lineTo(x+r, y+h); ctx.arcTo(x, y+h, x, y+h-r, r);
  ctx.lineTo(x, y+r); ctx.arcTo(x, y, x+r, y, r);
  ctx.closePath();
}

function updateScore(v) {
  const el = document.getElementById('scoreDisplay');
  el.textContent = v;
  el.classList.remove('bump');
  void el.offsetWidth;
  el.classList.add('bump');
}

function updateSpeedDots() {
  for (let i = 0; i < 5; i++) {
    document.getElementById('dot'+i).classList.toggle('active', i <= speedTier);
  }
}

function show(id) { document.getElementById(id).classList.remove('hidden'); }
function hide(id) { document.getElementById(id).classList.add('hidden'); }

// Keyboard
document.addEventListener('keydown', e => {
  switch(e.key) {
    case 'ArrowUp': case 'w': case 'W':
      if (dir.y !== 1) nextDir = {x:0,y:-1}; e.preventDefault(); break;
    case 'ArrowDown': case 's': case 'S':
      if (dir.y !== -1) nextDir = {x:0,y:1}; e.preventDefault(); break;
    case 'ArrowLeft': case 'a': case 'A':
      if (dir.x !== 1) nextDir = {x:-1,y:0}; e.preventDefault(); break;
    case 'ArrowRight': case 'd': case 'D':
      if (dir.x !== -1) nextDir = {x:1,y:0}; e.preventDefault(); break;
    case 'p': case 'P':
      if (running) togglePause(); break;
    case 'Escape':
      if (running) endGame(); break;
    case 'Enter': case ' ':
      if (!running) startGame(); break;
  }
});

// D-pad
function dpadPress(direction) {
  if (!running) { startGame(); return; }
  switch(direction) {
    case 'UP': if (dir.y !== 1) nextDir = {x:0,y:-1}; break;
    case 'DOWN': if (dir.y !== -1) nextDir = {x:0,y:1}; break;
    case 'LEFT': if (dir.x !== 1) nextDir = {x:-1,y:0}; break;
    case 'RIGHT': if (dir.x !== -1) nextDir = {x:1,y:0}; break;
  }
}

// Swipe support
let touchStartX, touchStartY;
canvas.addEventListener('touchstart', e => {
  touchStartX = e.touches[0].clientX;
  touchStartY = e.touches[0].clientY;
}, { passive: true });
canvas.addEventListener('touchend', e => {
  const dx = e.changedTouches[0].clientX - touchStartX;
  const dy = e.changedTouches[0].clientY - touchStartY;
  if (Math.abs(dx) > Math.abs(dy)) {
    if (dx > 20 && dir.x !== -1) nextDir = {x:1,y:0};
    else if (dx < -20 && dir.x !== 1) nextDir = {x:-1,y:0};
  } else {
    if (dy > 20 && dir.y !== -1) nextDir = {x:0,y:1};
    else if (dy < -20 && dir.y !== 1) nextDir = {x:0,y:-1};
  }
}, { passive: true });

// Initial draw
ctx.fillStyle = '#030509';
ctx.fillRect(0, 0, canvas.width, canvas.height);