let cfg, maskG, maskPixels;
let canopyTop = null;
let targets = [];
let balls = [];
let finished = false;
let showDebug = false;
let streamEnabled = false;
const LERP = (a, b, t) => a + (b - a) * t;
let sceneDone = false;
let fadeAlpha = 0;
const FADE_SPEED = 0.03;
const NEXT_URL = '/next.html';

let video;
let videoReady = false;

let SCENE = 1;

const SCENE1 = {
  spawnJitterFrames: [0, 8] 
};


function defaultConfig() {
  const minDim = Math.min(windowWidth, windowHeight);
  return {
    title: 'points of confusion',
    font: 'futura',
    fontSize: Math.max(48, Math.floor(minDim * 0.14)),
    sampleStep: Math.max(3, Math.floor(minDim / 140)),
    bg: [255, 255, 255],

    strokeAlpha: 255,
    strokeWeight: 0.4,

    gravity: 0.35, 
    restitution: 0.35,
    airDrag: 0.005, 

    seekTurnOnAfterBounce: 1,
    seekForce: 0.06,
    seekDamp: 0.80,
    settleEps: 0.55,

    keeperSizeRange: [3.2, 4.5],
    extraSizeRange:  [4.5, 15.0],

    extraTargetFactor: 1.1,
    extraSpawnPerFrame: 6,

    palette: ['#7EB2DD','#445E93','#A2DABD','#A8DE7E','#FFAE00','#F93943','#FCB0B3','#D5A2DA','#000000'],

    cursorEnabled: true,               
    cursorShowAlways: true,            
    cursorActiveOnDrag: false,          
    cursorStarColor: '#7EB2DD',        
    cursorStarOuterR: 25,              
    cursorStarInnerRatio: 0.55,        
    cursorStarSpikes: 10,               
    cursorStarStrokeAlpha: 255,     
    cursorStarStrokeWeight: 0.7,    
    cursorInfluence: 200,               
    cursorRepelStrength: 1.0,         

    titleBounceRestitution: 0.65, 
    titleBounceFriction: 0.90, 

    canopyBuffer: 20,
    canopyPushoutScale: 2.7,
    canopyPushoutIters: 4,

    canopySoftBuffer: 12,
    canopySoftStrength: 0.12,

    canopyImpactDamp: 0.72,

    starShare: 0.60,
    starSpikesMin: 6,
    starSpikesMax: 10,
    starInnerRatio: 0.6,

    extraMaxAgeFrames: [130, 300],
    extraTricklePerFrame: 4,

    seed: Math.floor(Math.random()*1e9)
  };
}

function setup() {
  pixelDensity(1);
  createCanvas(windowWidth, windowHeight);

  const VIDEO_PATHS = [
    'webm/animation.webm', 
    'webm/animation.webm',     
    'animation.webm'          
  ];
  
  let videoFound = false;
  for (const p of VIDEO_PATHS) {
    try {
      video = createVideo([p]);
      video.hide();
      video.elt.loop = true;
      video.elt.muted = true;
      video.elt.playsInline = true;
      video.attribute('preload', 'auto');
  
      const events = ['loadedmetadata','loadeddata','canplay','canplaythrough','playing'];
      events.forEach(ev => video.elt.addEventListener(ev, () => {
        if (video.elt.readyState >= 2) videoReady = true;
      }));
  
      video.elt.addEventListener('error', e => console.error('Video error for', p, e));
      videoFound = true;
      break;
    } catch (e) {
      console.warn('Could not load', p, e);
    }
  }
  
  if (!videoFound) console.error('No valid video source found in paths:', VIDEO_PATHS);

  resetSketch();
  noCursor();
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  resetSketch();
}

function resetSketch() {
  cfg = defaultConfig();
  randomSeed(cfg.seed);
  noiseSeed(cfg.seed);
  background(cfg.bg);
  finished = false;
  buildMask();
  sampleTargets();
  spawnInitialBalls();
}

function buildMask() {
  maskG = createGraphics(width, height);
  maskG.pixelDensity(1);
  maskG.clear();
  maskG.textAlign(CENTER, CENTER);
  let ts = cfg.fontSize;
  maskG.textSize(ts);
  maskG.textFont(cfg.font);
  maskG.noStroke();
  maskG.fill(0);
  const pad = width * 0.06;
  let tw = maskG.textWidth(cfg.title);
  if (tw > width - pad * 2) {
    ts = ts * (width - pad * 2) / tw;
    maskG.textSize(ts);
  }
  for (let i = 0; i < 5; i++) maskG.text(cfg.title, width/2, height/2);
  maskG.loadPixels();
  maskPixels = maskG.pixels;
  computeCanopyTop();
}

function isMaskOn(x, y) {
  const xi = Math.floor(constrain(x, 0, width - 1));
  const yi = Math.floor(constrain(y, 0, height - 1));
  const idx = (yi * width + xi) * 4 + 3;
  return maskPixels && maskPixels[idx] > 10;
}

function maskAlpha(x, y){
  const xi = floor(constrain(x, 0, width-1));
  const yi = floor(constrain(y, 0, height-1));
  const idx = (yi*width + xi)*4 + 3;
  return maskPixels ? maskPixels[idx] : 0;
}

function computeCanopyTop(){
  canopyTop = new Float32Array(width);
  const INF = 1e9;

  for (let x = 0; x < width; x++){
    let top = INF;
    for (let y = 0; y < height; y++){
      const idx = (y*width + x)*4 + 3;
      if (maskPixels[idx] > 10){ top = y; break; }
    }
    canopyTop[x] = top;
  }

  let minX = width, maxX = -1;
  for (let x = 0; x < width; x++){
    if (canopyTop[x] !== INF){ 
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
    }
  }
  if (maxX < 0){
    for (let x = 0; x < width; x++) canopyTop[x] = height;
    return;
  }

  const maxBridge = 28;
  let x = minX;
  while (x <= maxX){
    if (canopyTop[x] !== INF){ x++; continue; }
    let s = x;
    while (x <= maxX && canopyTop[x] === INF) x++;
    let e = x - 1;
    const gapLen = e - s + 1;

    if (gapLen <= maxBridge){
      const leftY  = (s-1 >= minX) ? canopyTop[s-1] : INF;
      const rightY = (e+1 <= maxX) ? canopyTop[e+1] : INF;
      if (leftY !== INF && rightY !== INF){
        for (let i = 0; i < gapLen; i++){
          const t = (i+1) / (gapLen+1);
          canopyTop[s+i] = LERP(leftY, rightY, t);
        }
      } else {
        const fillY = (leftY !== INF) ? leftY : rightY;
        if (fillY !== INF){
          for (let i = 0; i < gapLen; i++) canopyTop[s+i] = fillY;
        }
      }
    }
  }

  for (let i = 0; i < minX; i++) canopyTop[i] = height;
  for (let i = maxX+1; i < width; i++) canopyTop[i] = height;

  const win = 8;
  const smooth = new Float32Array(width);
  for (let i = 0; i < width; i++){
    if (canopyTop[i] === INF || canopyTop[i] >= height){ smooth[i] = height; continue; }
    let sum = 0, cnt = 0;
    for (let k = -win; k <= win; k++){
      const xi = constrain(i + k, 0, width-1);
      const v = canopyTop[xi];
      if (v !== INF && v < height){ sum += v; cnt++; }
    }
    smooth[i] = (cnt > 0) ? sum / cnt : height;
  }
  canopyTop = smooth;
}


function canopyY(x){
  const xi = Math.floor(constrain(x, 0, width-1));
  return canopyTop ? canopyTop[xi] : height;
}
function canopyNormalAt(x){
  const x0 = Math.max(0, Math.floor(x)-1), x1 = Math.min(width-1, Math.floor(x)+1);
  const dy = canopyY(x1) - canopyY(x0);
  let n = createVector(dy, -2);
  if (n.mag() < 1e-3) n.set(0, -1);
  n.normalize();
  return n;
}

function canopyRepel(b){
  const buf  = cfg.canopyBuffer || 0;
  const soft = cfg.canopySoftBuffer || 0;
  const k    = cfg.canopySoftStrength || 0;
  if (soft <= 0 || k <= 0 || !canopyTop) return;

  const yLine = canopyY(b.pos.x);
  if (yLine >= height) return;
  const yHard = yLine - buf;
  const ySoft = yLine - (buf + soft);

  if (b.pos.y >= ySoft && b.pos.y < yHard){
    const n = canopyNormalAt(b.pos.x);
    b.vel.sub(p5.Vector.mult(n, k));
  }
}

function repelFromCursor(b){
  if (!cfg.cursorEnabled) return;
  if (cfg.cursorActiveOnDrag && !mouseIsPressed) return;

  const mx = mouseX, my = mouseY;
  if (mx < -1 || mx > width+1 || my < -1 || my > height+1) return;

  if (b.isKeeper) return;

  const R = cfg.cursorInfluence + b.r;
  const dx = b.pos.x - mx;
  const dy = b.pos.y - my;
  const d2 = dx*dx + dy*dy;
  if (d2 > R*R) return;

  const d = Math.sqrt(d2) || 0.0001;
  const nx = dx / d, ny = dy / d;
  const falloff = 1 - (d / R);
  const k = cfg.cursorRepelStrength * falloff;
  b.vel.x += nx * k;
  b.vel.y += ny * k;
}

function sampleTargets() {
  targets.length = 0;
  const step = cfg.sampleStep;
  let minX = width, minY = height, maxX = 0, maxY = 0;
  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      if (isMaskOn(x, y)) {
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
      }
    }
  }
  minX = Math.max(0, minX - 2*step); minY = Math.max(0, minY - 2*step);
  maxX = Math.min(width,  maxX + 2*step); maxY = Math.min(height, maxY + 2*step);
  for (let y = minY; y < maxY; y += step) {
    for (let x = minX; x < maxX; x += step) {
      if (isMaskOn(x, y)) targets.push({ x: x + random(-0.4, 0.4), y: y + random(-0.4, 0.4) });
    }
  }
  shuffleInPlace(targets);
}

function spawnInitialBalls() {
  balls.length = 0;
  const keeperCount = targets.length;
  const extraTarget = Math.max(20, Math.floor(keeperCount * cfg.extraTargetFactor));
  for (let i = 0; i < keeperCount; i++) {
    const b = makeBall(true, i, cfg.keeperSizeRange);
    b.fillCol = color(random(cfg.palette));
    b.shapeType = 'circle';
    b.spawnDelay = floor(random(SCENE1.spawnJitterFrames[0], SCENE1.spawnJitterFrames[1] + 1));
    balls.push(b);
  }
  if (streamEnabled) {
    for (let i = 0; i < extraTarget; i++) {
      balls.push(makeBall(false, -1, cfg.extraSizeRange));
    }
  }
}

function makeBall(isKeeper, targetIndex, sizeRange) {
  const r = random(sizeRange[0], sizeRange[1]);
  const x = random(-width*0.1, width*1.1);
  const y = -random(30, height*0.9);
  const vy = random(1.2, 3.2);
  return {
    isKeeper,
    targetIndex,
    pos: createVector(x, y),
    vel: createVector(random(-0.8, 0.8), vy),
    acc: createVector(0, 0),
    r,
    bounces: 0,
    seeking: false,
    settled: false,
    fillCol: color(random(cfg.palette)),
    shapeType: (!isKeeper && random() < cfg.starShare) ? 'star' : 'circle',
    starSeed: random(10000),
    age: 0,
    maxAge: floor(random(cfg.extraMaxAgeFrames[0], cfg.extraMaxAgeFrames[1]))
  };
}

function mousePressed() {
  if (SCENE === 2) {
    if (!finished) return;
    if (!playTri || !pointInTri(mouseX, mouseY, playTri.a, playTri.b, playTri.c)) return;
    disperseKeepers();
    streamEnabled = false;
    videoShown = true;
    videoStartMs = millis();
    videoAlpha = 0;
    if (video) {
      videoReady = false;      
      video.time(0);           
      video.elt.muted = true;  
      video.loop();           
    }
    return;
  }
  if (!finished || sceneDone) return;   
  if (!isMouseOverTitle()) return;      
  disperseKeepers();                    
  sceneDone = true;                     
}


function isMouseOverTitle() {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const b of balls) if (b.isKeeper) {
    minX = Math.min(minX, b.pos.x - b.r);
    maxX = Math.max(maxX, b.pos.x + b.r);
    minY = Math.min(minY, b.pos.y - b.r);
    maxY = Math.max(maxY, b.pos.y + b.r);
  }
  return mouseX >= minX && mouseX <= maxX && mouseY >= minY && mouseY <= maxY;
}

function disperseKeepers() {
  if (typeof streamEnabled !== 'undefined') streamEnabled = false;

  for (const b of balls) if (b.isKeeper) {
    b.seeking = false;     
    b.settled = false;
    const a = random(TWO_PI);
    const s = random(2, 5); 
    b.vel.set(cos(a) * s, sin(a) * s - 0.6);
    b.acc.set(0, 0);       
  }
}

function draw() {
  if (SCENE === 2) { drawScene2(); return; }  
  background(cfg.bg);
  const floorY = height - 12;
  let settledCount = 0;
  for (let i = 0; i < balls.length; i++) {
    const b = balls[i];
    if (b.spawnDelay && b.spawnDelay > 0) { b.spawnDelay--; drawDot(b); continue; }
    if (b.settled) {
      settledCount++;
      drawDot(b);
      continue;
    }
    if (!b.seeking) {
      b.vel.mult(1 - cfg.airDrag);
      b.acc.y += cfg.gravity;
    } else {
      const t = targets[b.targetIndex];
      const to = createVector(t.x - b.pos.x, t.y - b.pos.y);
      b.acc.add(to.mult(cfg.seekForce));
      b.vel.mult(cfg.seekDamp);
    }
    repelFromCursor(b);
    b.vel.add(b.acc);
    if (!b.isKeeper) canopyRepel(b);
    b.pos.add(b.vel);
    b.acc.mult(0);
    if (!b.isKeeper) b.age++;
    if (!b.seeking && b.pos.y + b.r > floorY) {
      b.pos.y = floorY - b.r;
      b.vel.y *= -cfg.restitution;
      b.vel.x *= 0.9;
      b.bounces++;
      if (b.isKeeper && b.bounces >= cfg.seekTurnOnAfterBounce) b.seeking = true;
    }
    if (!b.isKeeper && !b.locked && b.pos.y - b.r > height + 40) {
      respawnExtra(b);
      drawDot(b);
      continue;
    }
    if (finished && !b.isKeeper && b.age > b.maxAge) {
      respawnExtra(b);
      drawDot(b);
      continue;
    }
    if (!b.isKeeper && frameCount > 201.5) canopyBounce(b);
    if (b.isKeeper && b.seeking) {
      const t = targets[b.targetIndex];
      const d = dist(b.pos.x, b.pos.y, t.x, t.y);
      if (d < cfg.settleEps && b.vel.mag() < 0.18) {
        b.settled = true;
        b.pos.set(t.x, t.y);
      }
    }
    drawDot(b);
  }
  if (!finished && targets.length > 0 && settledCount >= targets.length) {
    finished = true;
    streamEnabled = true; 
  }
  
  const keeperCount = targets.length;
  const targetExtras = Math.max(20, Math.floor(keeperCount * cfg.extraTargetFactor));
  let extrasAlive = 0;
  for (const b of balls) if (!b.isKeeper) extrasAlive++;
  if (streamEnabled) {
    const need = targetExtras - extrasAlive;
    for (let i = 0; i < Math.min(need, cfg.extraSpawnPerFrame); i++) {
      balls.push(makeBall(false, -1, cfg.extraSizeRange));
    }
  }
  
  if (finished && cfg.extraTricklePerFrame > 0) {
    let forced = 0;
    for (let i = 0; i < balls.length && forced < cfg.extraTricklePerFrame; i++) {
      const b = balls[i];
      if (!b.isKeeper && !b.locked && !b.settled) { 
        respawnExtra(b);
        forced++;
      }
    }
  }
  if (showDebug) drawHUD(settledCount, targetExtras, extrasAlive);
if (sceneDone) {
  fadeAlpha = min(1, fadeAlpha + FADE_SPEED);
  noStroke(); fill(255, 255 * fadeAlpha);
  rect(0, 0, width, height);
  if (fadeAlpha >= 1) {
    SCENE = 2;
    initScene2();
    sceneDone = false;
    fadeAlpha = 0;
    return;
  }
}

  drawCursorStar(mouseX, mouseY);
}

function drawDot(b) {
  stroke(0, cfg.strokeAlpha);
  strokeWeight(cfg.strokeWeight);
  fill(b.fillCol);
  if (b.shapeType === 'circle') {
    circle(b.pos.x, b.pos.y, b.r * 2);
  } else {
    const spikes = Math.floor(random(cfg.starSpikesMin, cfg.starSpikesMax + 1));
    const innerR = b.r * cfg.starInnerRatio;
    blobbyStar(b.pos.x, b.pos.y, b.r, innerR, spikes, b.starSeed);
  }
}

function blobbyStar(cx, cy, rOuter, rInner, spikes, seed) {
  beginShape();
  const steps = 72;
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * TWO_PI;
    const s = (sin(t * spikes) + 1) * 0.5;
    const wobble = 0.04 * sin((t * spikes * 1.7) + seed);
    const r = LERP(rInner, rOuter, s) * (1 + wobble);
    vertex(cx + cos(t) * r, cy + sin(t) * r);
  }
  endShape(CLOSE);
}

function drawCursorStar(mx, my){
  if (!cfg.cursorEnabled) return;
  if (!cfg.cursorShowAlways && !mouseIsPressed) return;

  push();
  const a = (cfg.cursorStarStrokeAlpha != null) ? cfg.cursorStarStrokeAlpha : cfg.strokeAlpha;
  const w = (cfg.cursorStarStrokeWeight != null) ? cfg.cursorStarStrokeWeight : cfg.strokeWeight;
  stroke(0, a);
  strokeWeight(w);
  fill(cfg.cursorStarColor);
  const rOuter = cfg.cursorStarOuterR;
  const rInner = rOuter * cfg.cursorStarInnerRatio;
  const spikes = cfg.cursorStarSpikes;
  blobbyStar(mx, my, rOuter, rInner, spikes, 777);
  pop();
}

function canopyBounce(b){
  const buf = cfg.canopyBuffer || 0;
  if (!canopyTop) return;

  const yLine = canopyY(b.pos.x);
  if (yLine >= height) return;
  const yHard = yLine - buf;
  if (b.pos.y < yHard) return;

  const n = canopyNormalAt(b.pos.x);

  const vn = b.vel.dot(n);
  if (vn < 0){
    const e  = cfg.titleBounceRestitution;
    const tf = cfg.titleBounceFriction;
    b.vel.sub(p5.Vector.mult(n, (1 + e) * vn)); 
    const t = b.vel.copy().sub(p5.Vector.mult(n, b.vel.dot(n))); 
    b.vel = p5.Vector.add(p5.Vector.mult(n, b.vel.dot(n)), p5.Vector.mult(t, tf));
    if (cfg.canopyImpactDamp) b.vel.mult(cfg.canopyImpactDamp); 
  }

  const push = (cfg.canopyPushoutScale || 2.2) * b.r;
  const iters = (cfg.canopyPushoutIters || 4);
  for (let i=0; i<iters && b.pos.y >= yHard; i++){
    b.pos.add(p5.Vector.mult(n, push));
  }
}


function respawnExtra(b) {
  b.pos.set(random(-width*0.1, width*1.1), -random(20, 200));
  b.vel.set(random(-0.8, 0.8), random(1.2, 3.2));
  b.acc.set(0, 0);
  b.bounces = 0;
  b.fillCol = color(random(cfg.palette));
  b.shapeType = (random() < cfg.starShare) ? 'star' : 'circle';
  b.starSeed = random(10000);
  b.age = 0;
  b.maxAge = floor(random(cfg.extraMaxAgeFrames[0], cfg.extraMaxAgeFrames[1]));
}

function shuffleInPlace(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(random(i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

function drawHUD(settled, targetExtras, extrasAlive) {
  noStroke(); fill(0, 120);
  rect(10, 10, 280, 80, 8);
  fill(255); textSize(12); textAlign(LEFT, TOP);
  text(
    `keepers: ${targets.length}\n` +
    `settled: ${settled}${finished ? ' (done)' : ''}\n` +
    `extras: ${extrasAlive}/${targetExtras}\n` +
    `R:reset  D:debug`,
    18, 16
  );
}

function keyPressed() {
  if (key === 'R' || key === 'r') resetSketch();
  else if (key === 'D' || key === 'd') showDebug = !showDebug;
}

let videoShown = false; 
let videoStartMs = 0;
let videoAlpha = 0;
let playTri = null;         
let PLAY_SIZE_FACTOR = 0.26; 

const SCENE2 = {
  keeperSizeRange: [3.2, 9.0],   
  keeperCountScale: 1.0,         
  gravity: 0.0,                  
  restitution: 0.0,              
  airDrag: 0.005,                
  spawnJitterFrames: [0, 8],     
  keeperStarShare: 0.3,          
  noFloor: true,                 

  splatterDurationFrames: 42,    
  splatterSpeed: [2.0, 6.0],     
  splatterDamp: 0.94             
};

const SCENE2_VIDEO = {
  delayMs: 500,  
  fadeMs: 800    
};

function initScene2(){
  finished = false;
  streamEnabled = false;
  balls.length = 0;
  targets.length = 0;
  background(255);

  buildPlayMaskTriangle();
  sampleTargets();

  shuffleInPlace(targets);
  if (SCENE2.keeperCountScale !== 1.0) {
    const desired = Math.max(3, Math.floor(targets.length * SCENE2.keeperCountScale));
    targets = targets.slice(0, desired);
  }

  const keeperCount = targets.length;
  const cx = width * 0.5, cy = height * 0.52; 
  for (let i = 0; i < keeperCount; i++) {
    const b = makeBall(true, i, SCENE2.keeperSizeRange);
    b.fillCol = color(random(cfg.palette));
    b.shapeType = (random() < (SCENE2.keeperStarShare || 0)) ? 'star' : 'circle';
    if (b.shapeType === 'star') b.starSeed = random(10000);

    b.pos.set(cx, cy);
    const ang = random(TWO_PI);
    const spd = random(SCENE2.splatterSpeed[0], SCENE2.splatterSpeed[1]);
    b.vel.set(Math.cos(ang) * spd, Math.sin(ang) * spd);
    b.acc.set(0, 0);

    b.phase = 'burst';
    b.spawnDelay = floor(random(SCENE2.spawnJitterFrames[0], SCENE2.spawnJitterFrames[1] + 1));
    b.seekStart = frameCount + SCENE2.splatterDurationFrames + b.spawnDelay;

    balls.push(b);
  }
}


function buildPlayMaskTriangle(){
  maskG = createGraphics(width, height);
  maskG.pixelDensity(1);
  maskG.clear();
  maskG.noStroke();
  maskG.fill(0);
  const s = Math.min(width, height) * PLAY_SIZE_FACTOR;
  const cx = width * 0.5, cy = height * 0.52;
  const ax = cx - s*0.60, ay = cy - s*0.80;
  const bx = cx - s*0.60, by = cy + s*0.80;
  const cxp = cx + s*0.90, cyp = cy;
  for (let i=0;i<3;i++) maskG.triangle(ax, ay, bx, by, cxp, cyp); 
  maskG.loadPixels();
  maskPixels = maskG.pixels;
  playTri = { a:{x:ax,y:ay}, b:{x:bx,y:by}, c:{x:cxp,y:cyp} };
  computeCanopyTop();
}

function drawScene2(){
  background(cfg.bg);
  const floorY = height - 12;
  const g  = (SCENE2.gravity     == null ? cfg.gravity     : SCENE2.gravity);
  const ad = (SCENE2.airDrag     == null ? cfg.airDrag     : SCENE2.airDrag);
  const rs = (SCENE2.restitution == null ? cfg.restitution : SCENE2.restitution);
  let settledCount = 0;

  for (let i = 0; i < balls.length; i++) {
    const b = balls[i];

    if (b.spawnDelay && b.spawnDelay > 0) { b.spawnDelay--; drawDot(b); continue; }

    if (b.phase === 'burst') {
      b.vel.mult(SCENE2.splatterDamp);
      b.pos.add(b.vel);
      b.pos.x += random(-0.2, 0.2);
      b.pos.y += random(-0.2, 0.2);
      if (frameCount >= (b.seekStart || 0)) {
        b.phase = 'seek';
        b.seeking = true;
      }
      drawDot(b);
      continue;
    }

    if (b.settled) { settledCount++; drawDot(b); continue; }

    if (!b.seeking) {
      b.vel.mult(1 - ad);
      b.acc.y += g;
    } else {
      const t = targets[b.targetIndex];
      const to = createVector(t.x - b.pos.x, t.y - b.pos.y);
      b.acc.add(to.mult(cfg.seekForce));
      b.vel.mult(cfg.seekDamp);
    }

    repelFromCursor(b);
    b.vel.add(b.acc);
    b.pos.add(b.vel);
    b.acc.mult(0);

    if (!SCENE2.noFloor && !b.seeking && b.pos.y + b.r > floorY) {
      b.pos.y = floorY - b.r;
      b.vel.y *= -rs;
      b.vel.x *= 0.9;
      b.bounces++;
      if (b.isKeeper && b.bounces >= cfg.seekTurnOnAfterBounce) b.seeking = true;
    }

    if (b.isKeeper && b.seeking) {
      const t = targets[b.targetIndex];
      const d = dist(b.pos.x, b.pos.y, t.x, t.y);
      if (d < cfg.settleEps && b.vel.mag() < 0.18) {
        b.settled = true;
        b.pos.set(t.x, t.y);
      }
    }

    drawDot(b);
  }

  if (!finished && targets.length > 0 && settledCount >= targets.length) {
    finished = true;
    streamEnabled = false;
  }

  if (videoShown) {
    const elapsed = millis() - videoStartMs;
    if (elapsed >= SCENE2_VIDEO.delayMs) {
      const p = (elapsed - SCENE2_VIDEO.delayMs) / Math.max(1, SCENE2_VIDEO.fadeMs);
      videoAlpha = constrain(p, 0, 1);
    }
    drawVideoPlaceholder(videoAlpha);
  }

  drawCursorStar(mouseX, mouseY);
  if (showDebug) drawScene2Panel();
}


function drawScene2Panel(){
  push();
  noStroke(); fill(0, 120);
  const w = 280, h = 92; rect(10, 10, w, h, 8);
  fill(255); textSize(12); textAlign(LEFT, TOP);
  const g  = (SCENE2.gravity     == null ? cfg.gravity     : SCENE2.gravity);
  const rs = (SCENE2.restitution == null ? cfg.restitution : SCENE2.restitution);
  const ad = (SCENE2.airDrag     == null ? cfg.airDrag     : SCENE2.airDrag);
  text(
    `Scene2 controls: edit in code
`+
    `keepers scale: ${SCENE2.keeperCountScale.toFixed(2)}
`+
    `size range: [${SCENE2.keeperSizeRange[0].toFixed(1)}, ${SCENE2.keeperSizeRange[1].toFixed(1)}]
`+
    `gravity: ${g.toFixed(2)}  restitution: ${rs.toFixed(2)}  drag: ${ad.toFixed(3)}
`+
    `spawn jitter: [${SCENE2.spawnJitterFrames[0]}, ${SCENE2.spawnJitterFrames[1]}]
`+
    `star keepers: ${(SCENE2.keeperStarShare*100).toFixed(0)}%`
    , 18, 16);
  pop();
}

function drawVideoPlaceholder(alpha = 1){
   if (alpha === undefined) alpha = 1;
   const A = 255 * constrain(alpha, 0, 1);
 
   const targetAspect = 16 / 9;
   const canvasAspect = width / height;
 
   let vw, vh;
   if (canvasAspect >= targetAspect) {     
     vh = height;
     vw = vh * targetAspect;
   } else {                               
     vw = width;
     vh = vw / targetAspect;
   }
   const vx = (width - vw) * 0.5;
   const vy = (height - vh) * 0.5;
 
   push();
   noStroke();
   fill(255, videoReady ? A : min(A, 180));
   rect(0, 0, width, height);
   pop();
 
   if (video && videoReady) {
     tint(255, A);
     image(video, vx, vy, vw, vh);
     noTint();
   } else {
     push();
     fill(255, min(A, 180));
     textAlign(CENTER, CENTER);
     textSize(14);
     text('loading video…', width/2, height/2 + vh*0.35);
     pop();
   } 
}
function pointInTri(px, py, A, B, C){
  const v0x = C.x - A.x, v0y = C.y - A.y;
  const v1x = B.x - A.x, v1y = B.y - A.y;
  const v2x = px - A.x, v2y = py - A.y;
  const dot00 = v0x*v0x + v0y*v0y;
  const dot01 = v0x*v1x + v0y*v1y;
  const dot02 = v0x*v2x + v0y*v2y;
  const dot11 = v1x*v1x + v1y*v1y;
  const dot12 = v1x*v2x + v1y*v2y;
  const invDen = 1 / (dot00*dot11 - dot01*dot01 + 1e-9);
  const u = (dot11*dot02 - dot01*dot12) * invDen;
  const v = (dot00*dot12 - dot01*dot02) * invDen;
  return (u >= 0) && (v >= 0) && (u+v <= 1);
}