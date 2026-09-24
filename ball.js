/*
  Live ball: motion, hop, spin, trail, the one shot resolver.
  Modes, scoring, waves, and input stay in sprong.js.
 */
const BALL_BASE = 20;
const HIT_RADIUS_MUL = 3;
const BALL_MAX_SPEED = 1400;
const VOLLEY_MIN = 240;
const VOLLEY_MAX_START = 420;
const VOLLEY_STEP = 55;
const SERVE_MUL_LO = 0.5;
const SERVE_MUL_HI = 1.2;
const TOSS_Z = 20;
const ANGLE_SCALE = 0.35;
const MAX_RETURN_ANG = 28 * Math.PI / 180;
const BALL_G = 64;
const VZ_MIN = 6;
const VZ_MAX = 16;
const VR_MIN = 2.4;
const VR_MAX = 14;
const TRAIL_DT = 0.05;
const TRAIL_MAX = 3;

let ballScale = 1;

function ballSetScale(s) {
  ballScale = s > 0.05 ? s : 0.05;
}

function ballSize() {
  return BALL_BASE * ballScale;
}

function ballHitRadius() {
  return HIT_RADIUS_MUL * BALL_BASE * ballScale;
}

function ballVolleyMin() {
  return VOLLEY_MIN * ballScale;
}

function ballVolleyStart() {
  return VOLLEY_MAX_START * ballScale;
}

function ballVolleyStep() {
  return VOLLEY_STEP * ballScale;
}

function ballMaxSpeed() {
  return BALL_MAX_SPEED * ballScale;
}

function ballServeMin() {
  return ballVolleyStart() * SERVE_MUL_LO;
}

function ballServeMax() {
  return ballVolleyStart() * SERVE_MUL_HI;
}

function ballFresh() {
  return {
    x: 0, y: 0, vx: 0, vy: 0,
    z: 0, vz: 0,
    r: 0, vr: 0,
    trail: [], trailT: 0
  };
}

function ballPark(b) {
  b.vx = 0;
  b.vy = 0;
  b.vz = 0;
  b.x = -9999;
  b.y = -9999;
  b.z = 0;
  b.vr = 0;
  b.r = 0;
  b.trail.length = 0;
  b.trailT = 0;
}

function ballBeginToss(b, x, y) {
  b.vx = 0;
  b.vy = 0;
  b.vz = 0;
  b.x = x;
  b.y = y;
  b.z = 0;
  b.r = Math.random() * Math.PI;
  b.vr = 1.2;
  b.trail.length = 0;
  b.trailT = 0;
}

function ballTossZ(t01) {
  const t = t01 < 0 ? 0 : t01 > 1 ? 1 : t01;
  return TOSS_Z * t * (1 - t);
}

function ballServeBoost(z) {
  const peak = TOSS_Z * 0.25;
  const boost = z / peak;
  if (boost < 0) return 0;
  if (boost > 1) return 1;
  return boost;
}

function ballDrawSize(z) {
  return ballScale * (BALL_BASE + Math.pow(z, 2.2));
}

function ballTapPower(b, tapX, tapY) {
  const dist = Math.hypot(b.x - tapX, b.y - tapY);
  const hit = ballHitRadius();
  const sweet = ballSize();
  if (dist > hit) return -1;
  if (dist <= sweet) return 1;
  return 1 - (dist - sweet) / (hit - sweet);
}

function ballLaunch(b, tapX, tapY, fromSide, speed, power) {
  const depth = ballSize();
  const lateral = b.y - tapY;
  let ang = Math.atan2(lateral, depth) * ANGLE_SCALE;
  if (ang > MAX_RETURN_ANG) ang = MAX_RETURN_ANG;
  if (ang < -MAX_RETURN_ANG) ang = -MAX_RETURN_ANG;

  const maxS = ballMaxSpeed();
  if (speed > maxS) speed = maxS;
  if (speed < 1) speed = 1;

  const fwd = fromSide === 0 ? 1 : -1;
  const c = Math.cos(ang);
  const s = Math.sin(ang);
  b.vx = fwd * speed * c;
  b.vy = speed * s;
  b.vr = fwd * (VR_MIN + power * (VR_MAX - VR_MIN));
  b.z = 0;
  b.vz = VZ_MIN + power * (VZ_MAX - VZ_MIN);
  b.trail.length = 0;
  b.trailT = 0;
  b.trail.push({ x: b.x, y: b.y, z: 0 });
}

function ballStep(b, dt) {
  b.x += b.vx * dt;
  b.y += b.vy * dt;
  b.vz -= BALL_G * dt;
  b.z += b.vz * dt;
  if (b.z <= 0) {
    b.z = 0;
    b.vz = 0;
  }
  b.r += b.vr * dt;

  b.trailT += dt;
  if (b.trailT >= TRAIL_DT) {
    b.trailT -= TRAIL_DT;
    b.trail.push({ x: b.x, y: b.y, z: b.z });
    if (b.trail.length > TRAIL_MAX) b.trail.shift();
  }
}
