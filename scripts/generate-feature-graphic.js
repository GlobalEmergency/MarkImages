const { createCanvas } = require("canvas");
const fs = require("fs");
const path = require("path");

const WIDTH = 1024;
const HEIGHT = 500;
const canvas = createCanvas(WIDTH, HEIGHT);
const ctx = canvas.getContext("2d");

// Background gradient (red tones matching DeaMap brand / emergency theme)
const bgGrad = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
bgGrad.addColorStop(0, "#DC2626"); // red-600
bgGrad.addColorStop(0.5, "#B91C1C"); // red-700
bgGrad.addColorStop(1, "#991B1B"); // red-800
ctx.fillStyle = bgGrad;
ctx.fillRect(0, 0, WIDTH, HEIGHT);

// Subtle pattern: circles representing map pins scattered in background
ctx.globalAlpha = 0.06;
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
  // Pin body (teardrop shape using arcs)
  ctx.fillStyle = "#FFFFFF";
  ctx.beginPath();
  ctx.arc(x, y, 18, 0, Math.PI * 2);
  ctx.fill();
  // Pin point
  ctx.beginPath();
  ctx.moveTo(x - 12, y + 10);
  ctx.lineTo(x, y + 35);
  ctx.lineTo(x + 12, y + 10);
  ctx.fill();
}
ctx.globalAlpha = 1;

// Heart + lightning bolt icon (AED symbol) on the left
const iconCenterX = 260;
const iconCenterY = 250;
const heartScale = 2.8;

// Draw heart shape
ctx.fillStyle = "#FFFFFF";
ctx.beginPath();
const hx = iconCenterX;
const hy = iconCenterY - 20;
// Left bump
ctx.moveTo(hx, hy + 20 * heartScale);
ctx.bezierCurveTo(
  hx - 30 * heartScale,
  hy - 10 * heartScale,
  hx - 30 * heartScale,
  hy - 30 * heartScale,
  hx,
  hy - 10 * heartScale
);
// Right bump
ctx.bezierCurveTo(
  hx + 30 * heartScale,
  hy - 30 * heartScale,
  hx + 30 * heartScale,
  hy - 10 * heartScale,
  hx,
  hy + 20 * heartScale
);
ctx.fill();

// Lightning bolt inside the heart (AED symbol)
ctx.fillStyle = "#DC2626";
ctx.beginPath();
const bx = iconCenterX;
const by = iconCenterY - 25;
ctx.moveTo(bx - 8, by - 5);
ctx.lineTo(bx + 15, by - 25);
ctx.lineTo(bx + 5, by - 5);
ctx.lineTo(bx + 8, by - 5);
ctx.lineTo(bx - 15, by + 25);
ctx.lineTo(bx - 5, by - 0);
ctx.closePath();
ctx.fill();

// App name "DeaMap"
ctx.fillStyle = "#FFFFFF";
ctx.font = "bold 88px sans-serif";
ctx.textAlign = "left";
ctx.textBaseline = "middle";
ctx.fillText("DeaMap", 420, 200);

// Tagline
ctx.font = "300 28px sans-serif";
ctx.fillStyle = "rgba(255,255,255,0.9)";
ctx.fillText("Encuentra desfibriladores cerca de ti", 420, 280);

// Secondary line
ctx.font = "300 22px sans-serif";
ctx.fillStyle = "rgba(255,255,255,0.65)";
ctx.fillText("Cada segundo cuenta. Ayuda a salvar vidas.", 420, 330);

// "by Global Emergency" at the bottom
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
