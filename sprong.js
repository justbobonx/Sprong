(() => {
  const MAX_RADIUS = 350;
  const WAVE_SPEED = 1100;
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
  const WALL_RESTITUTION = 0.98;
  const POINT_PAUSE_MS = 900;
  const HIT_LOCK_MS = 90;
  const NEON = "#39ff14";
  const NEON_DIM = "rgba(57,255,20,0.22)";
  const BG0 = "#020805";
  const BG1 = "#04140a";

  const canvas = document.getElementById("c");
  const ctx = canvas.getContext("2d");

  const state = {
    w: 0,
    h: 0,
    dpr: 1,
    landscape: true,
    mode: "serve", // serve | toss | play | pause
    server: 0,     // 0 = left/top, 1 = right/bottom
    scores: [0, 0],
    ball: { x: 0, y: 0, vx: 0, vy: 0, size: BALL_BASE },
    tossT: 0,
    waves: [],
    hitLock: 0,
    pauseT: 0,
    scoredBy: -1,
    last: 0,
  };

  function resize() {
    const dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const wasLandscape = state.landscape;
    state.w = w;
    state.h = h;
    state.dpr = dpr;
    state.landscape = w >= h;
    if (state.mode !== "play") parkBall();
    else if (wasLandscape !== state.landscape) resetPoint(state.server);
  }

  function mid() {
    return state.landscape ? state.w * 0.5 : state.h * 0.5;
  }

  function sideOf(x, y) {
    return state.landscape ? (x < state.w * 0.5 ? 0 : 1) : (y < state.h * 0.5 ? 0 : 1);
  }

  function ballSide() {
    return sideOf(state.ball.x, state.ball.y);
  }

  function courtAxisToward(fromSide) {
    if (state.landscape) return fromSide === 0 ? { x: 1, y: 0 } : { x: -1, y: 0 };
    return fromSide === 0 ? { x: 0, y: 1 } : { x: 0, y: -1 };
  }

  function parkBall() {
    const w = state.w, h = state.h;
    const b = state.ball;
    b.vx = 0;
    b.vy = 0;
    b.size = BALL_BASE;
    if (state.landscape) {
      b.y = h * 0.5;
      b.x = state.server === 0 ? w * 0.22 : w * 0.78;
    } else {
      b.x = w * 0.5;
      b.y = state.server === 0 ? h * 0.22 : h * 0.78;
    }
  }

  function resetPoint(server) {
    state.server = server;
    state.mode = "serve";
    state.tossT = 0;
    state.waves.length = 0;
    state.hitLock = 0;
    state.pauseT = 0;
    state.scoredBy = -1;
    parkBall();
  }

  function startToss() {
    state.mode = "toss";
    state.tossT = 0;
    state.ball.vx = 0;
    state.ball.vy = 0;
  }

  function tossHeight() {
    const t = Math.max(0, Math.min(1, state.tossT / TOSS_MS));
    return 4 * t * (1 - t);
  }

  function applyServe(tapX, tapY) {
    const b = state.ball;
    const peak = tossHeight();
    const speed = SERVE_MIN + (SERVE_MAX - SERVE_MIN) * peak;
    const toward = courtAxisToward(state.server);
    let dx = b.x - tapX;
    let dy = b.y - tapY;
    let dist = Math.hypot(dx, dy);
    if (dist < 1) {
      dx = toward.x;
      dy = toward.y;
      dist = 1;
    }
    const tdx = dx / dist;
    const tdy = dy / dist;
    // current dir is the toss "up" encoded as size; serve multiplies toss dir (toward other side)
    // with tap-to-ball dir. closer tap + higher toss = faster.
    const reach = Math.max(0, 1 - dist / MAX_RADIUS);
    b.vx = toward.x * speed + tdx * speed * (0.35 + 0.4 * reach);
    b.vy = toward.y * speed + tdy * speed * (0.35 + 0.4 * reach);
    forceAcross(state.server);
    capSpeed();
    b.size = BALL_BASE;
    state.mode = "play";
    state.hitLock = HIT_LOCK_MS;
  }

  function forceAcross(fromSide) {
    const b = state.ball;
    if (state.landscape) {
      if (fromSide === 0) b.vx = Math.max(BALL_MIN_ACROSS, Math.abs(b.vx));
      else b.vx = -Math.max(BALL_MIN_ACROSS, Math.abs(b.vx));
    } else {
      if (fromSide === 0) b.vy = Math.max(BALL_MIN_ACROSS, Math.abs(b.vy));
      else b.vy = -Math.max(BALL_MIN_ACROSS, Math.abs(b.vy));
    }
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

  function applyHit(tapX, tapY, fromSide) {
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
    // current dir * tap dir * reach, then push back across
    b.vx = (cdx * spd * HIT_KEEP) + (tdx * HIT_IMPULSE * reach);
    b.vy = (cdy * spd * HIT_KEEP) + (tdy * HIT_IMPULSE * reach);
    const push = HIT_PUSH * reach;
    const toward = courtAxisToward(fromSide);
    b.vx += toward.x * push;
    b.vy += toward.y * push;
    forceAcross(fromSide);
    capSpeed();
    state.hitLock = HIT_LOCK_MS;
  }

  function scoreOut(againstSide) {
    const winner = againstSide === 0 ? 1 : 0;
    state.scores[winner] += 1;
    state.mode = "pause";
    state.pauseT = 0;
    state.scoredBy = winner;
    state.ball.vx = 0;
    state.ball.vy = 0;
  }

  function spawnWave(x, y, side) {
    state.waves.push({
      x, y, side,
      r: 0,
      prev: 0,
      hit: false,
    });
  }

  function onTap(x, y) {
    if (x < 0 || y < 0 || x > state.w || y > state.h) return;
    const side = sideOf(x, y);
    spawnWave(x, y, side);

    if (state.mode === "pause") return;

    if (state.mode === "serve") {
      if (side === state.server) startToss();
      return;
    }

    if (state.mode === "toss") {
      if (side === state.server) applyServe(x, y);
    }
  }

  function bindInput() {
    const pos = (ev) => {
      const r = canvas.getBoundingClientRect();
      return { x: ev.clientX - r.left, y: ev.clientY - r.top };
    };

    canvas.addEventListener("pointerdown", (ev) => {
      ev.preventDefault();
      const p = pos(ev);
      onTap(p.x, p.y);
    }, { passive: false });

    canvas.addEventListener("contextmenu", (ev) => ev.preventDefault());
    window.addEventListener("keydown", (ev) => {
      if (ev.code === "Space") {
        ev.preventDefault();
        onTap(state.ball.x, state.ball.y + 8);
      }
    });
  }

  function updateWaves(dt) {
    const b = state.ball;
    const lock = state.hitLock > 0;
    for (let i = state.waves.length - 1; i >= 0; i--) {
      const w = state.waves[i];
      w.prev = w.r;
      w.r += WAVE_SPEED * dt;
      if (!w.hit && !lock && state.mode === "play") {
        const dist = Math.hypot(b.x - w.x, b.y - w.y);
        const pad = b.size * 0.5;
        if (w.prev <= dist + pad && w.r >= dist - pad && dist <= MAX_RADIUS + pad) {
          w.hit = true;
          applyHit(w.x, w.y, w.side);
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

    if (state.landscape) {
      if (b.y - half < 0) { b.y = half; b.vy = Math.abs(b.vy) * WALL_RESTITUTION; }
      else if (b.y + half > h) { b.y = h - half; b.vy = -Math.abs(b.vy) * WALL_RESTITUTION; }
      if (b.x + half < 0) scoreOut(0);
      else if (b.x - half > w) scoreOut(1);
    } else {
      if (b.x - half < 0) { b.x = half; b.vx = Math.abs(b.vx) * WALL_RESTITUTION; }
      else if (b.x + half > w) { b.x = w - half; b.vx = -Math.abs(b.vx) * WALL_RESTITUTION; }
      if (b.y + half < 0) scoreOut(0);
      else if (b.y - half > h) scoreOut(1);
    }
  }

  function update(dt) {
    const ms = dt * 1000;
    if (state.hitLock > 0) state.hitLock -= ms;

    if (state.mode === "toss") {
      state.tossT += ms;
      const hgt = tossHeight();
      state.ball.size = BALL_BASE + (BALL_TOSS_PEAK - BALL_BASE) * hgt;
      if (state.tossT >= TOSS_MS) {
        state.mode = "serve";
        state.tossT = 0;
        state.ball.size = BALL_BASE;
      }
    } else if (state.mode === "play") {
      updateBall(dt);
    } else if (state.mode === "pause") {
      state.pauseT += ms;
      if (state.pauseT >= POINT_PAUSE_MS) resetPoint(state.scoredBy);
    }

    updateWaves(dt);
  }

  function fillBg() {
    const w = state.w, h = state.h;
    const g = ctx.createRadialGradient(w * 0.5, h * 0.5, Math.min(w, h) * 0.15, w * 0.5, h * 0.5, Math.max(w, h) * 0.7);
    g.addColorStop(0, BG1);
    g.addColorStop(1, BG0);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }

  function drawNet() {
    ctx.save();
    ctx.strokeStyle = NEON;
    ctx.shadowColor = NEON;
    ctx.shadowBlur = 18;
    ctx.lineWidth = 3;
    ctx.beginPath();
    if (state.landscape) {
      const x = state.w * 0.5;
      ctx.moveTo(x, 0);
      ctx.lineTo(x, state.h);
    } else {
      const y = state.h * 0.5;
      ctx.moveTo(0, y);
      ctx.lineTo(state.w, y);
    }
    ctx.stroke();
    ctx.restore();
  }

  function drawChevron() {
    if (state.mode === "play") return;
    const w = state.w, h = state.h;
    const s = Math.min(w, h);
    const arm = s * 0.11;
    const thick = Math.max(8, s * 0.018);
    let cx, cy, ang;
    if (state.landscape) {
      cx = w * 0.5;
      cy = h * 0.5;
      ang = state.server === 0 ? Math.PI : 0;
    } else {
      cx = w * 0.5;
      cy = h * 0.5;
      ang = state.server === 0 ? -Math.PI * 0.5 : Math.PI * 0.5;
    }

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(ang);
    ctx.strokeStyle = NEON;
    ctx.fillStyle = NEON;
    ctx.shadowColor = NEON;
    ctx.shadowBlur = 22;
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

  function drawScores() {
    const w = state.w, h = state.h;
    const font = Math.max(28, Math.min(w, h) * 0.09);
    ctx.save();
    ctx.fillStyle = NEON_DIM;
    ctx.shadowColor = NEON;
    ctx.shadowBlur = 12;
    ctx.font = "700 " + font + "px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    if (state.landscape) {
      ctx.fillText(String(state.scores[0]), w * 0.25, h * 0.12);
      ctx.fillText(String(state.scores[1]), w * 0.75, h * 0.12);
    } else {
      ctx.fillText(String(state.scores[0]), w * 0.12, h * 0.25);
      ctx.fillText(String(state.scores[1]), w * 0.12, h * 0.75);
    }
    ctx.restore();
  }

  function drawWaves() {
    ctx.save();
    ctx.lineCap = "round";
    for (const w of state.waves) {
      const t = w.r / MAX_RADIUS;
      const a = Math.max(0, 1 - t);
      ctx.strokeStyle = "rgba(57,255,20," + (0.85 * a).toFixed(3) + ")";
      ctx.shadowColor = NEON;
      ctx.shadowBlur = 16 * a;
      ctx.lineWidth = Math.max(1.5, 7 * (1 - t * 0.7));
      ctx.beginPath();
      ctx.arc(w.x, w.y, w.r, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawBall() {
    const b = state.ball;
    const s = b.size;
    ctx.save();
    ctx.fillStyle = NEON;
    ctx.shadowColor = NEON;
    ctx.shadowBlur = 20 + (s - BALL_BASE) * 0.4;
    ctx.fillRect(b.x - s * 0.5, b.y - s * 0.5, s, s);
    ctx.restore();
  }

  function drawHint() {
    if (state.mode === "play" || state.mode === "pause") return;
    const w = state.w, h = state.h;
    ctx.save();
    ctx.fillStyle = "rgba(57,255,20,0.35)";
    ctx.font = "600 " + Math.max(12, Math.min(w, h) * 0.028) + "px ui-sans-serif, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const msg = state.mode === "toss" ? "TAP TO SERVE" : "SERVER TAP TO TOSS";
    if (state.landscape) ctx.fillText(msg, w * 0.5, h * 0.88);
    else ctx.fillText(msg, w * 0.5, h * 0.96);
    ctx.restore();
  }

  function draw() {
    fillBg();
    drawNet();
    drawScores();
    drawChevron();
    drawWaves();
    drawBall();
    drawHint();
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
  requestAnimationFrame(frame);
})();
