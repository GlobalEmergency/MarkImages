const { createCanvas, loadImage } = require("canvas");
const fs = require("fs");
const path = require("path");

const WIDTH = 1024;
const HEIGHT = 500;
const canvas = createCanvas(WIDTH, HEIGHT);
const ctx = canvas.getContext("2d");

// Brand colors from logo: green background, red pin, white heart, green bolt
const GREEN_DARK = "#1B5E20";
const GREEN_MID = "#2E7D32";
const GREEN_LIGHT = "#388E3C";
const RED_PIN = "#DC2626";
const WHITE = "#FFFFFF";

// Background gradient (green tones matching DeaMap logo)
const bgGrad = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
bgGrad.addColorStop(0, GREEN_LIGHT);
bgGrad.addColorStop(0.5, GREEN_MID);
bgGrad.addColorStop(1, GREEN_DARK);
ctx.fillStyle = bgGrad;
ctx.fillRect(0, 0, WIDTH, HEIGHT);

// Subtle pattern: map pin shapes scattered in background
ctx.globalAlpha = 0.07;
const pinPositions = [
  [80, 90],
  [200, 380],
  [350, 120],
  [500, 420],
  [650, 80],
  [780, 340],
  [900, 150],
  [950, 400],
  [120, 250],
  [420, 280],
  [700, 220],
  [830, 450],
  [60, 430],
  [280, 50],
  [580, 350],
];
for (const [x, y] of pinPositions) {
  ctx.fillStyle = WHITE;
  ctx.beginPath();
  ctx.arc(x, y, 18, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x - 12, y + 10);
  ctx.lineTo(x, y + 35);
  ctx.lineTo(x + 12, y + 10);
  ctx.fill();
}
ctx.globalAlpha = 1;

// --- Map pin icon (matching the logo) ---
const pinCenterX = 230;
const pinCenterY = 220;

// Red pin body (teardrop)
ctx.fillStyle = RED_PIN;
ctx.beginPath();
// Circle top of pin
ctx.arc(pinCenterX, pinCenterY - 15, 55, Math.PI, 0);
// Point at bottom
ctx.lineTo(pinCenterX, pinCenterY + 75);
ctx.lineTo(pinCenterX - 55, pinCenterY - 15);
ctx.fill();

// Add slight red gradient/shadow to pin
const pinGrad = ctx.createLinearGradient(
  pinCenterX - 55,
  pinCenterY - 70,
  pinCenterX + 55,
  pinCenterY + 75
);
pinGrad.addColorStop(0, "rgba(255,255,255,0.15)");
pinGrad.addColorStop(0.5, "rgba(0,0,0,0)");
pinGrad.addColorStop(1, "rgba(0,0,0,0.15)");
ctx.fillStyle = pinGrad;
ctx.beginPath();
ctx.arc(pinCenterX, pinCenterY - 15, 55, Math.PI, 0);
ctx.lineTo(pinCenterX, pinCenterY + 75);
ctx.lineTo(pinCenterX - 55, pinCenterY - 15);
ctx.fill();

// White circle inside pin
ctx.fillStyle = WHITE;
ctx.beginPath();
ctx.arc(pinCenterX, pinCenterY - 15, 38, 0, Math.PI * 2);
ctx.fill();

// Heart shape inside white circle
const heartX = pinCenterX;
const heartY = pinCenterY - 20;
const hs = 1.1;

ctx.fillStyle = GREEN_MID;
ctx.beginPath();
ctx.moveTo(heartX, heartY + 18 * hs);
ctx.bezierCurveTo(
  heartX - 22 * hs,
  heartY - 2 * hs,
  heartX - 22 * hs,
  heartY - 18 * hs,
  heartX,
  heartY - 6 * hs
);
ctx.bezierCurveTo(
  heartX + 22 * hs,
  heartY - 18 * hs,
  heartX + 22 * hs,
  heartY - 2 * hs,
  heartX,
  heartY + 18 * hs
);
ctx.fill();

// Lightning bolt inside heart (green on white, like the logo)
ctx.fillStyle = WHITE;
ctx.beginPath();
const bx = heartX;
const by = heartY + 2;
ctx.moveTo(bx + 2, by - 14);
ctx.lineTo(bx - 6, by + 1);
ctx.lineTo(bx - 1, by + 1);
ctx.lineTo(bx - 2, by + 14);
ctx.lineTo(bx + 6, by - 1);
ctx.lineTo(bx + 1, by - 1);
ctx.closePath();
ctx.fill();

// --- Text ---

// App name "DeaMap"
ctx.fillStyle = WHITE;
ctx.font = "bold 88px sans-serif";
ctx.textAlign = "left";
ctx.textBaseline = "middle";
ctx.fillText("DeaMap", 380, 195);

// Tagline
ctx.font = "300 28px sans-serif";
ctx.fillStyle = "rgba(255,255,255,0.92)";
ctx.fillText("Encuentra desfibriladores cerca de ti", 380, 275);

// Secondary line
ctx.font = "300 22px sans-serif";
ctx.fillStyle = "rgba(255,255,255,0.65)";
ctx.fillText("Cada segundo cuenta. Ayuda a salvar vidas.", 380, 325);

// "Global Emergency" at the bottom
ctx.font = "300 16px sans-serif";
ctx.fillStyle = "rgba(255,255,255,0.45)";
ctx.textAlign = "center";
ctx.fillText("Global Emergency", WIDTH / 2, HEIGHT - 30);

// Save
const outputDir = path.join(__dirname, "..", "public", "play-store");
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}
const outputPath = path.join(outputDir, "feature-graphic.png");
const buffer = canvas.toBuffer("image/png");
fs.writeFileSync(outputPath, buffer);
console.log(`Feature graphic saved to: ${outputPath}`);
console.log(
  `Size: ${WIDTH}x${HEIGHT}px, ${(buffer.length / 1024).toFixed(1)} KB`
);
