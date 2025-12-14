const SIZE_CONTROL = { minScale: 0.09, maxScale: 0.15 };

const ASSET_COUNT = 9;      
const PLACEHOLDER_COUNT = 5;  

const PLACEHOLDER_CONTROL = {
  countMultiplier: 2.0,   
  minScale: 0.5,
  maxScale: 0.9
};

const PLACEHOLDER_STYLE = {
  colors: ['#7EB2DD','#445E93','#A2DABD','#A8DE7E','#FFAE00','#F93943','#FCB0B3','#D5A2DA','#000000'],
  strokeWeight: 0.7,
  strokeColor: "#000000"
};

const TEXT_IMG_SCALE = 0.25; 

const ASSETS = [
  "assets/Artboard18.png",
  "assets/Artboard19.png",
  "assets/Artboard20.png",
  "assets/Artboard22.png",
  "assets/Artboard23.png",
  "assets/Artboard24.png",
  "assets/Artboard27.png",
  "assets/Artboard28.png",
  "assets/Artboard29.png",
  "assets/IMG_5631.PNG",
  "assets/IMG_5632.PNG",
  "assets/IMG_5633.PNG",
  "assets/IMG_5634.PNG",
  "assets/IMG_5635.PNG",
  "assets/IMG_5636.PNG",
  "assets/IMG_5637.PNG",
  "assets/IMG_5638.PNG",
  "assets/IMG_5639.PNG",
  "assets/Illustration20 2.PNG",
  "assets/Illustration20 3.PNG",
  "assets/Illustration20 4.PNG",
  "assets/Illustration20 5.PNG",
  "assets/Illustration20 6.PNG",
  "assets/Illustration20 7.PNG",
  "assets/Illustration20 8.PNG",
  "assets/Illustration20 9.PNG",
  "assets/Illustration20 10.PNG",
  "assets/Illustration20 11.PNG",
  "assets/Illustration20 12.PNG",
  "assets/Illustration20 13.PNG",
  "assets/Illustration20 14.PNG",
  "assets/Illustration20 15.PNG",
  "assets/Illustration20 16.PNG",
  "assets/Illustration20 17.PNG",
  "assets/Illustration20 18.PNG",
  "assets/Illustration20 19.PNG",
  "assets/Illustration20 20.PNG",
  "assets/Illustration20 21.PNG",
  "assets/Illustration20 22.PNG",
  "assets/Illustration20 23.PNG",
  "assets/Illustration20 24.PNG",
  "assets/Illustration20 25.PNG",
  "assets/Illustration20 26.PNG",
  "assets/Illustration20 27.PNG",
  "assets/Illustration20 28.PNG",
  "assets/Illustration20.PNG"
];


const ITEMS_PER_BURST = 10;
const APPEAR_DURATION = 600;
const CENTER_RECOIL = 10;
const BASE_SPEED = 4.2;
const SPEED_JITTER = 2.0;
const DRAG = 0.985;
const NOISE_SCALE = 0.0025;
const NOISE_SPEED = 0.002;
const FLOW_FORCE = 0.02;
const FLOAT_MAX_SPEED = 1.6;
const ROT_DRAG = 0.98;
const MAX_SPIN = 0.08;
const BOUNCE_DAMP = 0.6;

const CURSOR_RADIUS = 100;
const CURSOR_FORCE = 25.0;
const CURSOR_FALLOFF = 0.4;

const ANIM_TOTAL_FRAMES = 174;
const ANIM_FPS =31;
const ANIM_SCALE = 0.35;
const ANIM_FADE_DURATION = 800;

let center, sprites = [], fireDots = [], images = [];
let animFrames = [];
let animFrameIndex = 0;
let animFadeAlpha = 0;
let assetsLoading = false;
let scene = "burst";
let textTimer = 0;
let nextAssetIndex = 0;  // remembers which image to use next

function setup() {
  createCanvas(window.innerWidth, window.innerHeight);
  pixelDensity(1);
  center = createVector(width / 2, height / 2);
  safeLoadAssets();

  const testBtn = document.getElementById("testBtn");
  if (testBtn) testBtn.addEventListener("click", () => triggerTextSequence());
  setupSpeech();
}

function windowResized() {
  resizeCanvas(window.innerWidth, window.innerHeight);
  center.set(width / 2, height / 2);
}

function draw() {
  background(255);

  const mouse = createVector(mouseX, mouseY);
  for (let s of sprites) {
    const d = dist(s.pos.x, s.pos.y, mouse.x, mouse.y);
    if (d < CURSOR_RADIUS) {
      const dir = p5.Vector.sub(s.pos, mouse).normalize();
      const strength = CURSOR_FORCE * Math.pow(1 - d / CURSOR_RADIUS, CURSOR_FALLOFF);
      s.vel.add(dir.mult(strength));
    }
    s.update();
    s.draw();
  }

  for (let f of fireDots) { f.update(); f.draw(); }

  if (scene === "text" && animFrames.length > 0) {
    const frameInterval = int(60 / ANIM_FPS);
    if (frameCount % frameInterval === 0) {
      animFrameIndex = (animFrameIndex + 1) % animFrames.length;
    }

    const elapsed = millis() - textTimer;
    animFadeAlpha = constrain(map(elapsed, 0, ANIM_FADE_DURATION, 0, 255), 0, 255);

    const img = animFrames[animFrameIndex];
    if (img) {
      const aspect = img.width / img.height;
      const drawW = width * ANIM_SCALE;
      const drawH = drawW / aspect;
      push();
      imageMode(CENTER);
      tint(255, animFadeAlpha);
      image(img, width / 2, height / 2, drawW, drawH);
      pop();
    }
  }

  debugHUD();
}

class BurstItem {
  constructor(img, isPlaceholder = false, minScaleOverride = null, maxScaleOverride = null) {
    this.img = img || null;
    this.isPlaceholder = isPlaceholder;
    this.color = random(PLACEHOLDER_STYLE.colors);
    this.pos = center.copy().add(p5.Vector.random2D().mult(random(-CENTER_RECOIL, CENTER_RECOIL)));
    const dir = p5.Vector.random2D();
    const speed = BASE_SPEED + random(-SPEED_JITTER, SPEED_JITTER);
    this.vel = dir.mult(speed);
    this.rot = random(-MAX_SPIN, MAX_SPIN);
    this.ang = random(TWO_PI);

    if (minScaleOverride && maxScaleOverride) {
      this.scaleBase = random(minScaleOverride, maxScaleOverride);
    } else if (isPlaceholder) {
      this.scaleBase = random(PLACEHOLDER_CONTROL.minScale, PLACEHOLDER_CONTROL.maxScale);
    } else {
      this.scaleBase = random(SIZE_CONTROL.minScale, SIZE_CONTROL.maxScale);
    }

    this.t0 = millis();
    this.alpha = 0;
    this.sAppear = 0.6;
    this.noiseSeed = random(1000);
    if (this.img && this.img.width) {
      this.boundW = (this.img.width / 2) * this.scaleBase;
      this.boundH = (this.img.height / 2) * this.scaleBase;
    } else {
      this.boundW = this.boundH = 16 * this.scaleBase;
    }
  }

  update() {
    const age = millis() - this.t0;
    const appearT = constrain(age / APPEAR_DURATION, 0, 1);
    const ease = easeOutBack(appearT);
    this.alpha = 255 * ease;
    this.scale = this.scaleBase * lerp(this.sAppear, 1, ease);
  
    if (appearT >= 1) {
      if (age < 800) {
        const burstForce = p5.Vector.sub(this.pos, center).normalize().mult(0.4);
        this.vel.add(burstForce);
      }
  
      const t = frameCount * NOISE_SPEED;
      const theta = noise(this.noiseSeed + t, this.pos.x * NOISE_SCALE, this.pos.y * NOISE_SCALE) * TWO_PI * 2.0;
      const flow = p5.Vector.fromAngle(theta).mult(FLOW_FORCE * 1.0);
      this.vel.add(flow);
  
      const wander = p5.Vector.random2D().mult(0.05);
      this.vel.add(wander);
  
      if (this.vel.mag() > FLOAT_MAX_SPEED * 1.3) this.vel.mult(0.97);
    }
  
    this.pos.add(this.vel);
    this.ang += this.rot;
    this.vel.mult(DRAG * 0.992);
    this.rot *= ROT_DRAG;
    this.keepInBounds();
  }
  
  

  keepInBounds() {
    const w = width, h = height;
    const rw = this.boundW * this.scale, rh = this.boundH * this.scale;
    if (this.pos.x - rw < 0) { this.pos.x = rw; this.vel.x = abs(this.vel.x) * BOUNCE_DAMP; }
    if (this.pos.x + rw > w) { this.pos.x = w - rw; this.vel.x = -abs(this.vel.x) * BOUNCE_DAMP; }
    if (this.pos.y - rh < 0) { this.pos.y = rh; this.vel.y = abs(this.vel.y) * BOUNCE_DAMP; }
    if (this.pos.y + rh > h) { this.pos.y = h - rh; this.vel.y = -abs(this.vel.y) * BOUNCE_DAMP; }
  }

  draw() {
    push();
    translate(this.pos.x, this.pos.y);
    rotate(this.ang);
    scale(this.scale);
    tint(255, this.alpha);
    if (this.img && this.img.width && !this.isPlaceholder) {
      imageMode(CENTER);
      image(this.img, 0, 0);
    } else {
      strokeWeight(PLACEHOLDER_STYLE.strokeWeight);
      stroke(PLACEHOLDER_STYLE.strokeColor);
      fill(this.color + hex(floor(this.alpha), 2));
      circle(0, 0, 32);
    }
    pop();
  }
}

class FireDot {
  constructor(x,y){
    this.pos=createVector(x,y);
    this.vel=p5.Vector.random2D().mult(random(2,6));
    this.alpha=255;
    this.size=random(2,5);
  }
  update(){
    this.pos.add(this.vel);
    this.vel.mult(0.96);
    this.alpha-=6;
  }
  draw(){
    if(this.alpha<=0)return;
    noStroke();
    fill(0,this.alpha);
    circle(this.pos.x,this.pos.y,this.size);
  }
}

function triggerBurst() {
  if (images.length > 0) {
    const count = min(ASSET_COUNT, images.length);
  
    for (let i = 0; i < count; i++) {
      const idx = nextAssetIndex % images.length;   // wraps around
      sprites.push(new BurstItem(images[idx], false));
      nextAssetIndex++;
    }
  }
  

  for (let i = 0; i < PLACEHOLDER_COUNT; i++) {
    sprites.push(new BurstItem(null, true, PLACEHOLDER_CONTROL.minScale, PLACEHOLDER_CONTROL.maxScale));
  }

  for (let i = 0; i < 20; i++) fireDots.push(new FireDot(center.x, center.y));
}

function triggerTextSequence(){
  triggerBurst();
  scene = "text";
  animFrameIndex = 0;
  textTimer = millis();
  animFadeAlpha = 0;
}

function easeOutBack(x){
  const c1=1.70158,c3=c1+1;
  return 1+c3*Math.pow(x-1,3)+c1*Math.pow(x-1,2);
}

function z3(n){ return String(n).padStart(3,'0'); }

function safeLoadAssets(){
  if(assetsLoading)return;
  assetsLoading=true;
  const loaders=[...ASSETS.map(p=>new Promise(res=>loadImage(p,img=>res(img),()=>res(null))))];
  Promise.all(loaders).then(imgs=>{
    images=imgs.filter(Boolean);
    console.log("Loaded burst PNGs:", images.length, "/", ASSETS.length);
    const animPromises = [];
    const animMissing = [];
    for (let i = 1; i <= ANIM_TOTAL_FRAMES; i++) {
      const num = z3(i);
      const path = `assets/frame_${num}.png`;
      animPromises.push(new Promise((res)=>{
        loadImage(path, img=>res({ok:true,img,path}), ()=>{animMissing.push(path); res({ok:false,img:null,path});});
      }));
    }
    Promise.all(animPromises).then(results=>{
      animFrames = results.filter(r=>r.ok).map(r=>r.img);
      console.log("Loaded animation frames:", animFrames.length, "/", ANIM_TOTAL_FRAMES);
      if (animMissing.length) console.warn("Missing frames (first 10):", animMissing.slice(0,10));
      assetsLoading=false;
    });
  });
}

let recognition=null,listening=false;
function setupSpeech(){
  const SpeechRecognition=window.SpeechRecognition||window.webkitSpeechRecognition;
  const toggleBtn=document.getElementById("toggleBtn");
  if(!SpeechRecognition){if(toggleBtn)toggleBtn.disabled=true;return;}
  recognition=new SpeechRecognition();
  recognition.lang="en-US";
  recognition.continuous=true;
  recognition.interimResults=true;
  recognition.onresult=e=>{
    let transcript="";
    for(let i=e.resultIndex;i<e.results.length;i++) transcript+=e.results[i][0].transcript+" ";
    const norm=transcript.toLowerCase();
    if(matchesTrigger(norm)) setTimeout(triggerTextSequence,500);
  };
  if(toggleBtn){toggleBtn.addEventListener("click",()=>{if(!listening){recognition.start();listening=true;}else{recognition.stop();listening=false;}});}
}
function matchesTrigger(text){
  const triggers=["i'm confused","im confused","i am confused","ich bin verwirrt","bin verwirrt","verwirrt"];
  return triggers.some(t=>text.includes(t));
}

function debugHUD(){
  push();
  noStroke();
  fill(0,120);
  textAlign(LEFT,TOP);
  textSize(12);
  const lines=[`scene: ${scene}`,`burst sprites: ${sprites.length}`,`frames loaded: ${animFrames.length}/${ANIM_TOTAL_FRAMES}`,`say: \"I'm confused\" or click Test burst`];
  text(lines.join('\n'),10,10);
  pop();
}
