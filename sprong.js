/*
  sprong is tennis pong ?
  NO.  It is SPRONG!
 */
const MAX_RADIUS = 300;
const WAVE_SPEED = 1200;
const BALL_BASE = 16;
const BALL_TOSS_PEAK = 56;
const TOSS_MS = 1100;
const SERVE_MIN = 420;
const SERVE_MAX = 980;
const HIT_KEEP = 0.45;
const HIT_IMPULSE = 720;
const HIT_PUSH = 280;
const BALL_MAX_SPEED = 1400;
const BALL_MIN_ACROSS = 260;
const POINT_PAUSE_MS = 900;
const HIT_LOCK_MS = 90;
const TARGET_W_PERC = 0.25;
const GAMES_PER_SET = 3;
const NEON = "#39ff14";
const BALL = "#eeee33";
const BG_COL = "#020805";
const PCOL = ["#2f9bff", "#ff3b3b"];
const PCOL_RGB = ["47,155,255", "255,59,59"];

const RESET_HOLD_MS = 3000;
let resetHoldTimer = 0;

const canvas = document.getElementById("c");
const ctx = canvas.getContext("2d");

var messageText = "";

var state = {
  w: 0,
  h: 0,
  targetW: 0,
  viewW: 0,
  viewH: 0,
  dpr: 1,
  portrait: false,
  mode: "serve",
  server: 0,
  scores: [{p:0,g:0,s:0}, {p:0,g:0,s:0}],
  showGames: 0,
  ball: { x: 0, y: 0, vx: 0, vy: 0, z:0, r: 0, vr:0 },
  tossT: 0,
  waves: [],
  hitLock: 0,
  pauseT: 0,
  scoredBy: -1,
  lastHitter: -1,
  last: 0,
};

function saveState() {
  try {
    localStorage.setItem('state', JSON.stringify(state));
  } catch (e) {
    console.error('saveState failed', e);
  }
}

function loadState() {
  try {
    const raw = localStorage.getItem('state');
    if (raw == null) return;
    state = JSON.parse(raw);
  } catch (e) {
    console.error('loadState failed', e);
  }
}

function resize() {
  const dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
  const viewW = window.innerWidth;
  const viewH = window.innerHeight;
  canvas.width = Math.round(viewW * dpr);
  canvas.height = Math.round(viewH * dpr);
  canvas.style.width = viewW + "px";
  canvas.style.height = viewH + "px";
  const wasPortrait = state.portrait;
  state.viewW = viewW;
  state.viewH = viewH;
  state.dpr = dpr;
  state.portrait = viewH > viewW;
  state.w = Math.max(viewW, viewH);
  state.h = Math.min(viewW, viewH);
  state.targetW = state.w * 0.5 * TARGET_W_PERC;
  if (state.mode === "serve") parkBall();
  else if (wasPortrait !== state.portrait) resetPoint(state.server);
}


function screenToWorld(sx, sy) {
  if (!state.portrait) return { x: sx, y: sy };
  return { x: sy, y: state.h - sx };
}

function sideOf(x) {
  return x < state.w * 0.5 ? 0 : 1;
}

function courtAxisToward(fromSide) {
  return fromSide === 0 ? { x: 1, y: 0 } : { x: -1, y: 0 };
}

function inTargetZone(side, x) {
  const depth = state.w * 0.5 / 3;
  return side === 0 ? x <= depth : x >= state.w - depth;
}

function parkBall() {
  const b = state.ball;
  b.vx = 0;
  b.vy = 0;
  b.size = BALL_BASE;
  b.x = -9999;
  b.y = -9999;
}

function resetPoint(server) {
  state.server = server;
  state.mode = "serve";
  state.tossT = 0;
  state.waves.length = 0;
  state.hitLock = 0;
  state.pauseT = 0;
  state.scoredBy = -1;
  state.lastHitter = -1;
  parkBall();
}

function startToss(x, y) {
  state.mode = "toss";
  state.tossT = 0;
  state.ball.vx = 0;
  state.ball.vy = 0;
  state.ball.x = x;
  state.ball.y = y;
  state.ball.z = 0;
}

function forceAcross(fromSide) {
  const b = state.ball;
  if (fromSide === 0) b.vx = Math.max(BALL_MIN_ACROSS, Math.abs(b.vx));
  else b.vx = -Math.max(BALL_MIN_ACROSS, Math.abs(b.vx));
}

function capSpeed() {
  const b = state.ball;
  const s = Math.hypot(b.vx, b.vy);
  if (s > BALL_MAX_SPEED) {
    const k = BALL_MAX_SPEED / s;
    b.vx *= k;
    b.vy *= k;
  }
}

function applyHit(tapX, tapY, fromSide, serveBoost) {
  const b = state.ball;
  let dx = b.x - tapX;
  let dy = b.y - tapY;
  let dist = Math.hypot(dx, dy);
  if (dist < 1) dist = 1;
  const tdx = dx / dist;
  const tdy = dy / dist;
  const spd = Math.hypot(b.vx, b.vy);
  let cdx, cdy;
  if (spd > 8) {
    cdx = b.vx / spd;
    cdy = b.vy / spd;
  } else {
    const t = courtAxisToward(fromSide);
    cdx = t.x;
    cdy = t.y;
  }
  const reach = Math.max(0.12, 1 - dist / MAX_RADIUS);
  b.vx = (cdx * spd * HIT_KEEP) + (tdx * HIT_IMPULSE * reach);
  b.vy = (cdy * spd * HIT_KEEP) + (tdy * HIT_IMPULSE * reach);
  const push = HIT_PUSH * reach;
  const toward = courtAxisToward(fromSide);
  b.vx += toward.x * push;
  b.vy += toward.y * push;
  if (serveBoost > 0) {
    const speed = SERVE_MIN + (SERVE_MAX - SERVE_MIN) * serveBoost;
    const s = Math.hypot(b.vx, b.vy);
    const k = speed / Math.max(s, 1);
    b.vx *= Math.max(1, k);
    b.vy *= Math.max(1, k);
  }
  forceAcross(fromSide);
  capSpeed();
  b.size = BALL_BASE;
  state.lastHitter = fromSide;
  state.hitLock = HIT_LOCK_MS;
}

function scoreAgainst(side) {
  const winner = side === 0 ? 1 : 0;
  const winscore = state.scores[winner];
  //game
  winscore.p+=1;
  //set
  if( winscore.p==4 ){
    winscore.g+=1;
    state.scores[0].p=0;
    state.scores[1].p=0;
    state.showGames=1;
  }
  //match
  
  state.mode = "pause";
  messageText = "POINT FOR "+(winner==state.server ? "SERVE" : "RECEIVE");
  setTimeout( ()=>{ messageText="" }, POINT_PAUSE_MS );
  state.pauseT = 0;
  state.scoredBy = winner;
  state.ball.vx = 0;
  state.ball.vy = 0;
  
  saveState();
}

function spawnWave(x, y, side) {
  state.waves.push({ x, y, side, r: 0, prev: 0, hit: false, born: true });
}

function onTap(x, y) {
  if (x < 0 || y < 0 || x > state.w || y > state.h) return;
  const side = sideOf(x);
  if (state.mode === "pause") return;
  if (state.mode === "serve") {
    if (side === state.server && inTargetZone(side,x) ) startToss(x, y);
    return;
  }
  if (state.mode === "toss") {
    if (side === state.server) spawnWave(x, y, side);
    return;
  }
  if (state.mode === "play") spawnWave(x, y, side);
}

function resetDown() {
  clearTimeout(resetHoldTimer);
  resetHoldTimer = setTimeout(() => {
    resetHoldTimer = 0;
    
    state.scores = [{p:0,g:0,s:0}, {p:0,g:0,s:0}]; 
    resetPoint(Math.round(Math.random()));    
    saveState();
    
  }, RESET_HOLD_MS);
}

function resetUp() {
  clearTimeout(resetHoldTimer);
  resetHoldTimer = 0;
}

function bindInput() {
  canvas.addEventListener("pointerdown", (ev) => {
    ev.preventDefault();
    const r = canvas.getBoundingClientRect();
    const p = screenToWorld(ev.clientX - r.left, ev.clientY - r.top);
    if( !inTargetZone(0,p.x) && !inTargetZone(1,p.x) ){
      resetDown();
    }
    onTap(p.x, p.y);
  }, { passive: false });  
  
  canvas.addEventListener('pointerup', () => resetUp());
  canvas.addEventListener('pointercancel', () => resetUp());
  canvas.addEventListener('lostpointercapture', () => resetUp());

  canvas.addEventListener("contextmenu", (ev) => ev.preventDefault());
  window.addEventListener("keydown", (ev) => {
    if (ev.code === "Space") {
      ev.preventDefault();
      onTap(state.ball.x, state.ball.y + 8);
    }
  });
}

function waveTouchesBall(w) {
  const b = state.ball;
  const dist = Math.hypot(b.x - w.x, b.y - w.y);
  const pad = b.size * 0.5;
  return w.prev <= dist + pad && w.r >= dist - pad && dist <= MAX_RADIUS + pad;
}

function updateWaves(dt) {
  const lock = state.hitLock > 0;
  for (let i = state.waves.length - 1; i >= 0; i--) {
    const w = state.waves[i];
    w.prev = w.r;
    if (w.born) w.born = false;
    else w.r += WAVE_SPEED * dt;
    if (!w.hit && !lock) {
      if (state.mode === "toss" && w.side === state.server && waveTouchesBall(w)) {
        w.hit = true;
        applyHit(w.x, w.y, w.side, state.ball.z);
        state.mode = "play";
      } else if (state.mode === "play" && waveTouchesBall(w)) {
        w.hit = true;
        applyHit(w.x, w.y, w.side, 0);
      }
    }
    if (w.r >= MAX_RADIUS) state.waves.splice(i, 1);
  }
}

function updateBall(dt) {
  const b = state.ball;
  const w = state.w, h = state.h;
  const half = b.size * 0.5;
  b.x += b.vx * dt;
  b.y += b.vy * dt;
  const missSide = state.lastHitter < 0 ? state.server : state.lastHitter;
  if (b.x + half < 0) scoreAgainst(0);
  else if (b.x - half > w) scoreAgainst(1);
  else if (b.y + half < 0 || b.y - half > h) scoreAgainst(missSide);
  
  state.ball.z = Math.max( 0, state.ball.z-.1 );
}

function update(dt) {
  const ms = dt * 1000;
  if (state.hitLock > 0) state.hitLock -= ms;
  if (state.mode === "toss") {
    state.tossT += ms;
    const t = Math.max(0, Math.min(1, state.tossT / TOSS_MS));
    state.ball.z = 4 * t * (1 - t);      
    if (state.tossT >= TOSS_MS) {
      state.mode = "serve";
      state.tossT = 0;
      state.waves.length = 0;
      parkBall();
    }
  } else if (state.mode === "play") {
    updateBall(dt);
  } else if (state.mode === "pause") {
    state.pauseT += ms;
    if (state.pauseT >= POINT_PAUSE_MS) resetPoint(state.scoredBy);
  }
  updateWaves(dt);
}

function beginDraw() {
  const dpr = state.dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (state.portrait) {
    ctx.translate(state.viewW, 0);
    ctx.rotate(Math.PI / 2);
  }
  
  ctx.fillStyle = BG_COL;
  ctx.fillRect(0, 0, state.w, state.h);
}

function drawTargetZones() {
  const w = state.w, h = state.h, depth = state.targetW;    
  const live = state.mode === "play" || state.mode === "toss";
  const g0 = live && inTargetZone(0, state.ball.x);
  const g1 = live && inTargetZone(1, state.ball.x);
  ctx.save();
  ctx.fillStyle = "rgba(" + PCOL_RGB[0] + "," + (g0 ? "0.20" : "0.10") + ")";
  ctx.fillRect(0, 0, depth, h);
  ctx.fillStyle = "rgba(" + PCOL_RGB[1] + "," + (g1 ? "0.20" : "0.10") + ")";
  ctx.fillRect(w - depth, 0, depth, h);
  ctx.lineWidth = 2;
  ctx.setLineDash([10, 8]);
  ctx.strokeStyle = "rgba(" + PCOL_RGB[0] + ",0.45)";
  ctx.beginPath();
  ctx.moveTo(depth, 0);
  ctx.lineTo(depth, h);
  ctx.stroke();
  ctx.strokeStyle = "rgba(" + PCOL_RGB[1] + ",0.45)";
  ctx.beginPath();
  ctx.moveTo(w - depth, 0);
  ctx.lineTo(w - depth, h);
  ctx.stroke();
  ctx.restore();
}

function drawNet() {
  ctx.save();
  ctx.strokeStyle = NEON;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(state.w * 0.5, 0);
  ctx.lineTo(state.w * 0.5, state.h);
  ctx.stroke();
  ctx.globalAlpha = 0.2; 
  ctx.moveTo(0, state.h*0.5);
  ctx.lineTo(state.w, state.h*0.5);
  ctx.stroke();
  ctx.restore();
}

function drawChevron() {
  if (state.mode !== "serve") return;
  const w = state.w, h = state.h;
  const s = Math.min(w, h);
  const arm = s * 0.11;
  const thick = Math.max(8, s * 0.018);
  const cx = state.server === 0 ? w * 0.18 : w * 0.82;
  const cy = h * 0.5;
  const ang = state.server === 1 ? Math.PI : 0;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(ang);
  ctx.strokeStyle = NEON;
  ctx.lineWidth = thick;
  ctx.lineCap = "square";
  ctx.lineJoin = "miter";
  ctx.beginPath();
  ctx.moveTo(-arm * 0.15, -arm * 0.85);
  ctx.lineTo(arm * 1.05, 0);
  ctx.lineTo(-arm * 0.15, arm * 0.85);
  ctx.stroke();
  ctx.restore();
}

const POINT_SCORE_FORMAT = ["0", "15","30","40"];

function drawScores() {
  const w = state.w;
  const h = state.h;
  const targetW = state.targetW;
  const woffset = targetW / 2;
  const hoffset = h * 0.07;
  const font = Math.max(28, Math.min(w, h) * 0.12);
  const scores = state.scores;

  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "700 " + font + "px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";

  ctx.fillStyle = "rgba(" + PCOL_RGB[0] + ",0.55)";
  ctx.fillText(POINT_SCORE_FORMAT[scores[0].p], woffset, hoffset);

  ctx.fillStyle = "rgba(" + PCOL_RGB[1] + ",0.55)";  
  ctx.fillText(POINT_SCORE_FORMAT[scores[1].p], w - woffset, hoffset);

  const boxH = 10;
  const gamesW = targetW * .7;
  const gamesX = (targetW - gamesW) / 2;
  const slotW = gamesW / GAMES_PER_SET;
  const pad = Math.max(8, Math.min(8, slotW * 0.18));
  const boxW = slotW - pad * 2;
  const gamesY = hoffset + font * 0.42 + boxH * 0.5;

  ctx.lineWidth = 1.5;
  for (let i = 0; i < 2; i++) {
    const won = scores[i].g;
    const areaLeft = i === 0 ? gamesX: w - gamesW-gamesX;
    ctx.strokeStyle = PCOL[i];
    ctx.fillStyle = "rgba(" + PCOL_RGB[i] + ",0.55)";
    for (let g = 0; g < GAMES_PER_SET; g++) {
      const x = areaLeft + g * slotW + pad;
      const y = gamesY - boxH / 2;
      ctx.beginPath();
      ctx.rect(x, y, boxW, boxH);
      if (g < won) ctx.fill();
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawWaves() {	
  ctx.save();
  ctx.lineCap = "round";
  for (const w of state.waves) {
    const t = Math.max(0, Math.min(1, w.r / MAX_RADIUS));
    const a = (1 - t) * (1 - t);
    if (a < 0.02) continue;
    ctx.strokeStyle = "rgba(" + PCOL_RGB[w.side] + "," + (0.95 * a).toFixed(3) + ")";
    ctx.lineWidth = Math.max(1.2, 10 * (1 - t));
    ctx.beginPath();
    ctx.arc(w.x, w.y, Math.max(0.5, w.r), 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

function drawBall() {
  if (state.mode === "serve") return;
  const b = state.ball;
  const s = BALL_BASE + (BALL_TOSS_PEAK - BALL_BASE) * state.ball.z;
  ctx.save();
  ctx.fillStyle = BALL;
  ctx.fillRect(b.x - s * 0.5, b.y - s * 0.5, s, s);
  ctx.restore();
}

function drawMessage() {
  if (messageText === "") return;
  ctx.save();
  ctx.fillStyle = "rgba(57,255,20,0.35)";
  ctx.font = "600 " + Math.max(20, Math.min(state.w, state.h) * 0.1) + "px ui-sans-serif, system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(messageText, state.w * 0.5, state.h * 0.75);
  ctx.restore();
}

function draw() {
  beginDraw();
  drawTargetZones();
  drawNet();
  drawScores();
  drawChevron();
  drawWaves();
  drawBall();
  drawMessage();
}

function frame(now) {
  if (!state.last) state.last = now;
  let dt = (now - state.last) / 1000;
  state.last = now;
  if (dt > 0.05) dt = 0.05;
  update(dt);
  draw();
  requestAnimationFrame(frame);
}

window.addEventListener("resize", resize);
window.addEventListener("orientationchange", () => setTimeout(resize, 80));
resize();
resetPoint(0);
bindInput();

loadState();
const startServer = state.scoredBy >=0 ? state.scoredBy : Math.round(Math.random());
resetPoint(startServer);

requestAnimationFrame(frame);

