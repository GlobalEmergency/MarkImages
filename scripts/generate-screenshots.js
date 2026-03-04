const { createCanvas } = require("canvas");
const fs = require("fs");
const path = require("path");

const WIDTH = 1080;
const HEIGHT = 1920;

const GREEN_DARK = "#1B5E20";
const GREEN_MID = "#2E7D32";
const GREEN_LIGHT = "#388E3C";
const RED = "#DC2626";
const WHITE = "#FFFFFF";
const GRAY_100 = "#F3F4F6";
const GRAY_200 = "#E5E7EB";
const GRAY_300 = "#D1D5DB";
const GRAY_500 = "#6B7280";
const GRAY_700 = "#374151";
const GRAY_900 = "#111827";
const BLUE = "#3B82F6";

const outputDir = path.join(__dirname, "..", "public", "play-store");
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawPhone(ctx, contentDrawer) {
  // Background
  const bgGrad = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  bgGrad.addColorStop(0, GREEN_MID);
  bgGrad.addColorStop(1, GREEN_DARK);
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Phone frame
  const phoneX = 70;
  const phoneY = 280;
  const phoneW = WIDTH - 140;
  const phoneH = HEIGHT - 460;
  const phoneR = 40;

  // Phone shadow
  ctx.shadowColor = "rgba(0,0,0,0.4)";
  ctx.shadowBlur = 40;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 10;

  // Phone border (dark)
  roundRect(ctx, phoneX - 4, phoneY - 4, phoneW + 8, phoneH + 8, phoneR + 2);
  ctx.fillStyle = "#1a1a1a";
  ctx.fill();

  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  // Phone screen
  roundRect(ctx, phoneX, phoneY, phoneW, phoneH, phoneR);
  ctx.fillStyle = WHITE;
  ctx.fill();
  ctx.save();
  roundRect(ctx, phoneX, phoneY, phoneW, phoneH, phoneR);
  ctx.clip();

  // Draw content inside phone
  contentDrawer(ctx, phoneX, phoneY, phoneW, phoneH);

  ctx.restore();

  // Notch
  const notchW = 200;
  const notchH = 28;
  roundRect(
    ctx,
    phoneX + phoneW / 2 - notchW / 2,
    phoneY,
    notchW,
    notchH,
    14
  );
  ctx.fillStyle = "#1a1a1a";
  ctx.fill();
}

function drawStatusBar(ctx, x, y, w) {
  ctx.fillStyle = GRAY_900;
  ctx.fillRect(x, y, w, 44);
  ctx.fillStyle = WHITE;
  ctx.font = "bold 18px sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("9:41", x + 30, y + 30);
  ctx.textAlign = "right";
  ctx.font = "16px sans-serif";
  ctx.fillText("100%", x + w - 30, y + 30);
}

// ============================================
// SCREENSHOT 1: Map with nearby AEDs
// ============================================
function drawMapScreen(ctx, x, y, w, h) {
  // Status bar
  drawStatusBar(ctx, x, y, w);

  // Map background (green tones simulating a map)
  const mapGrad = ctx.createLinearGradient(x, y + 44, x, y + h);
  mapGrad.addColorStop(0, "#E8F5E9");
  mapGrad.addColorStop(0.3, "#C8E6C9");
  mapGrad.addColorStop(0.6, "#E8F5E9");
  mapGrad.addColorStop(1, "#C8E6C9");
  ctx.fillStyle = mapGrad;
  ctx.fillRect(x, y + 44, w, h - 44);

  // Fake street grid
  ctx.strokeStyle = "rgba(255,255,255,0.7)";
  ctx.lineWidth = 2;
  for (let i = 0; i < 8; i++) {
    const sy = y + 100 + i * 150;
    ctx.beginPath();
    ctx.moveTo(x, sy);
    ctx.lineTo(x + w, sy + 40);
    ctx.stroke();
  }
  for (let i = 0; i < 5; i++) {
    const sx = x + 50 + i * 200;
    ctx.beginPath();
    ctx.moveTo(sx, y + 44);
    ctx.lineTo(sx - 30, y + h);
    ctx.stroke();
  }

  // Map pins (AED markers)
  const pins = [
    { px: x + 420, py: y + 350, main: true },
    { px: x + 200, py: y + 500, main: false },
    { px: x + 650, py: y + 280, main: false },
    { px: x + 350, py: y + 700, main: false },
    { px: x + 550, py: y + 550, main: false },
    { px: x + 150, py: y + 250, main: false },
  ];

  for (const pin of pins) {
    const size = pin.main ? 1.5 : 1;
    // Pin shadow
    ctx.fillStyle = "rgba(0,0,0,0.2)";
    ctx.beginPath();
    ctx.ellipse(pin.px, pin.py + 25 * size, 12 * size, 5 * size, 0, 0, Math.PI * 2);
    ctx.fill();

    // Pin body
    ctx.fillStyle = pin.main ? RED : GREEN_MID;
    ctx.beginPath();
    ctx.arc(pin.px, pin.py - 12 * size, 18 * size, Math.PI, 0);
    ctx.lineTo(pin.px, pin.py + 20 * size);
    ctx.lineTo(pin.px - 18 * size, pin.py - 12 * size);
    ctx.fill();

    // White circle
    ctx.fillStyle = WHITE;
    ctx.beginPath();
    ctx.arc(pin.px, pin.py - 12 * size, 12 * size, 0, Math.PI * 2);
    ctx.fill();

    // Heart icon inside
    ctx.fillStyle = pin.main ? RED : GREEN_MID;
    ctx.font = `${14 * size}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("\u2665", pin.px, pin.py - 11 * size);
  }

  // Search bar at top
  const sbY = y + 60;
  roundRect(ctx, x + 20, sbY, w - 40, 56, 28);
  ctx.fillStyle = WHITE;
  ctx.fill();
  ctx.strokeStyle = GRAY_200;
  ctx.lineWidth = 1;
  roundRect(ctx, x + 20, sbY, w - 40, 56, 28);
  ctx.stroke();

  ctx.fillStyle = GRAY_500;
  ctx.font = "20px sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText("Buscar direccion...", x + 60, sbY + 28);

  // Geolocation button
  roundRect(ctx, x + w - 80, sbY + 70, 56, 56, 28);
  ctx.fillStyle = WHITE;
  ctx.fill();
  ctx.fillStyle = BLUE;
  ctx.font = "28px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("\u25CE", x + w - 52, sbY + 100);

  // Bottom results panel
  const panelY = y + h - 380;
  roundRect(ctx, x, panelY, w, 380, 24);
  ctx.fillStyle = WHITE;
  ctx.fill();

  // Drag handle
  roundRect(ctx, x + w / 2 - 30, panelY + 10, 60, 5, 3);
  ctx.fillStyle = GRAY_300;
  ctx.fill();

  // Title
  ctx.fillStyle = GRAY_900;
  ctx.font = "bold 22px sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("DEAs cercanos", x + 24, panelY + 50);

  // AED result cards
  const cards = [
    { name: "Centro de Salud San Pablo", dist: "120 m", status: "Verificado" },
    { name: "Estacion de Metro Sol", dist: "340 m", status: "Verificado" },
    { name: "Gimnasio FitLife", dist: "520 m", status: "Pendiente" },
  ];

  cards.forEach((card, i) => {
    const cy = panelY + 75 + i * 95;

    roundRect(ctx, x + 16, cy, w - 32, 82, 12);
    ctx.fillStyle = GRAY_100;
    ctx.fill();

    // Green circle icon
    ctx.fillStyle = GREEN_MID;
    ctx.beginPath();
    ctx.arc(x + 52, cy + 41, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = WHITE;
    ctx.font = "20px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("\u2665", x + 52, cy + 42);

    // Text
    ctx.textAlign = "left";
    ctx.fillStyle = GRAY_900;
    ctx.font = "bold 19px sans-serif";
    ctx.fillText(card.name, x + 86, cy + 30);

    ctx.fillStyle = GRAY_500;
    ctx.font = "16px sans-serif";
    ctx.fillText(card.dist + "  •  " + card.status, x + 86, cy + 58);

    // Distance badge
    roundRect(ctx, x + w - 100, cy + 22, 68, 36, 18);
    ctx.fillStyle = GREEN_MID;
    ctx.fill();
    ctx.fillStyle = WHITE;
    ctx.font = "bold 16px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(card.dist, x + w - 66, cy + 43);
  });
}

// ============================================
// SCREENSHOT 2: AED Detail
// ============================================
function drawDetailScreen(ctx, x, y, w, h) {
  drawStatusBar(ctx, x, y, w);

  // Image area (dark with gradient)
  const imgH = 350;
  const imgGrad = ctx.createLinearGradient(x, y + 44, x, y + 44 + imgH);
  imgGrad.addColorStop(0, "#2D3748");
  imgGrad.addColorStop(1, "#1A202C");
  ctx.fillStyle = imgGrad;
  ctx.fillRect(x, y + 44, w, imgH);

  // Fake AED device illustration
  ctx.fillStyle = "rgba(255,255,255,0.08)";
  roundRect(ctx, x + w / 2 - 100, y + 120, 200, 200, 20);
  ctx.fill();
  ctx.fillStyle = GREEN_MID;
  ctx.font = "100px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("\u2665", x + w / 2, y + 220);

  // Back button
  ctx.fillStyle = "rgba(255,255,255,0.2)";
  ctx.beginPath();
  ctx.arc(x + 44, y + 80, 22, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = WHITE;
  ctx.font = "bold 22px sans-serif";
  ctx.fillText("\u2190", x + 44, y + 82);

  // Content area
  const contentY = y + 44 + imgH;
  ctx.fillStyle = WHITE;
  ctx.fillRect(x, contentY, w, h - 44 - imgH);

  // Title
  ctx.fillStyle = GRAY_900;
  ctx.font = "bold 28px sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("Centro de Salud San Pablo", x + 24, contentY + 45);

  // Status badge
  roundRect(ctx, x + 24, contentY + 62, 100, 30, 15);
  ctx.fillStyle = "#DEF7EC";
  ctx.fill();
  ctx.fillStyle = GREEN_MID;
  ctx.font = "bold 15px sans-serif";
  ctx.fillText("Verificado", x + 42, contentY + 80);

  // Info cards
  const infoItems = [
    { icon: "\uD83D\uDCCD", label: "Direccion", value: "C/ San Pablo 12, Madrid" },
    { icon: "\uD83D\uDD52", label: "Horario", value: "24 horas / 7 dias" },
    { icon: "\u2139", label: "Acceso", value: "Entrada principal, planta baja" },
    { icon: "\uD83D\uDCC5", label: "Ultima verificacion", value: "15 febrero 2026" },
    { icon: "\uD83D\uDCDE", label: "Contacto", value: "+34 912 345 678" },
  ];

  infoItems.forEach((item, i) => {
    const iy = contentY + 110 + i * 75;

    // Separator
    if (i > 0) {
      ctx.fillStyle = GRAY_200;
      ctx.fillRect(x + 24, iy - 8, w - 48, 1);
    }

    ctx.fillStyle = GRAY_500;
    ctx.font = "15px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(item.label, x + 24, iy + 12);

    ctx.fillStyle = GRAY_900;
    ctx.font = "19px sans-serif";
    ctx.fillText(item.value, x + 24, iy + 40);
  });

  // Action buttons at bottom
  const btnY = contentY + 510;

  // Directions button
  roundRect(ctx, x + 24, btnY, w / 2 - 36, 56, 12);
  ctx.fillStyle = GREEN_MID;
  ctx.fill();
  ctx.fillStyle = WHITE;
  ctx.font = "bold 18px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("Como llegar", x + 24 + (w / 2 - 36) / 2, btnY + 32);

  // Call 112 button
  roundRect(ctx, x + w / 2 + 12, btnY, w / 2 - 36, 56, 12);
  ctx.fillStyle = RED;
  ctx.fill();
  ctx.fillStyle = WHITE;
  ctx.font = "bold 18px sans-serif";
  ctx.fillText("Llamar 112", x + w / 2 + 12 + (w / 2 - 36) / 2, btnY + 32);
}

// ============================================
// SCREENSHOT 3: Add AED form
// ============================================
function drawAddScreen(ctx, x, y, w, h) {
  drawStatusBar(ctx, x, y, w);

  // Header
  const headerH = 110;
  const hdrGrad = ctx.createLinearGradient(x, y + 44, x, y + 44 + headerH);
  hdrGrad.addColorStop(0, GREEN_LIGHT);
  hdrGrad.addColorStop(1, GREEN_MID);
  ctx.fillStyle = hdrGrad;
  ctx.fillRect(x, y + 44, w, headerH);

  ctx.fillStyle = WHITE;
  ctx.font = "bold 26px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("Anadir nuevo DEA", x + w / 2, y + 44 + 40);
  ctx.font = "17px sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.8)";
  ctx.fillText("Ayuda a completar el mapa", x + w / 2, y + 44 + 75);

  // Content
  const contentY = y + 44 + headerH;
  ctx.fillStyle = WHITE;
  ctx.fillRect(x, contentY, w, h - 44 - headerH);

  // Form fields
  const fields = [
    { label: "Nombre del DEA *", placeholder: "Ej: Centro de Salud...", filled: true, value: "Farmacia Lopez" },
    { label: "Calle", placeholder: "Nombre de la calle", filled: true, value: "Calle Mayor" },
    { label: "Numero", placeholder: "Numero", filled: true, value: "25" },
    { label: "Ciudad", placeholder: "Ciudad", filled: true, value: "Madrid" },
    { label: "Pais", placeholder: "Pais", filled: false, value: "Espana" },
    { label: "Observaciones", placeholder: "Notas adicionales...", filled: false, value: "" },
  ];

  fields.forEach((field, i) => {
    const fy = contentY + 30 + i * 100;

    ctx.fillStyle = GRAY_700;
    ctx.font = "bold 17px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(field.label, x + 28, fy + 20);

    // Input field
    roundRect(ctx, x + 28, fy + 32, w - 56, 50, 10);
    ctx.fillStyle = field.filled ? WHITE : GRAY_100;
    ctx.fill();
    ctx.strokeStyle = field.filled ? GREEN_MID : GRAY_300;
    ctx.lineWidth = field.filled ? 2 : 1;
    roundRect(ctx, x + 28, fy + 32, w - 56, 50, 10);
    ctx.stroke();

    ctx.fillStyle = field.value ? GRAY_900 : GRAY_500;
    ctx.font = "18px sans-serif";
    ctx.fillText(field.value || field.placeholder, x + 44, fy + 62);
  });

  // Submit button
  const btnY = contentY + 640;
  roundRect(ctx, x + 28, btnY, w - 56, 56, 12);
  ctx.fillStyle = GREEN_MID;
  ctx.fill();
  ctx.fillStyle = WHITE;
  ctx.font = "bold 20px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("Enviar desfibrilador", x + w / 2, btnY + 33);
}

// ============================================
// SCREENSHOT 4: Organization dashboard
// ============================================
function drawOrgScreen(ctx, x, y, w, h) {
  drawStatusBar(ctx, x, y, w);

  // Header
  const headerH = 130;
  const hdrGrad = ctx.createLinearGradient(x, y + 44, x, y + 44 + headerH);
  hdrGrad.addColorStop(0, GREEN_LIGHT);
  hdrGrad.addColorStop(1, GREEN_MID);
  ctx.fillStyle = hdrGrad;
  ctx.fillRect(x, y + 44, w, headerH);

  ctx.fillStyle = WHITE;
  ctx.font = "bold 28px sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("Proteccion Civil Madrid", x + 28, y + 44 + 45);
  ctx.font = "17px sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.8)";
  ctx.fillText("Panel de organizacion", x + 28, y + 44 + 80);

  // Content
  const contentY = y + 44 + headerH;
  ctx.fillStyle = GRAY_100;
  ctx.fillRect(x, contentY, w, h - 44 - headerH);

  // Stats cards (2x2 grid)
  const stats = [
    { value: "47", label: "Total DEAs", color: BLUE },
    { value: "42", label: "Verificados", color: GREEN_MID },
    { value: "5", label: "Pendientes", color: "#F59E0B" },
    { value: "8", label: "Miembros", color: "#8B5CF6" },
  ];

  const cardW = (w - 72) / 2;
  const cardH = 120;

  stats.forEach((stat, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const cx = x + 24 + col * (cardW + 24);
    const cy = contentY + 24 + row * (cardH + 16);

    roundRect(ctx, cx, cy, cardW, cardH, 16);
    ctx.fillStyle = WHITE;
    ctx.fill();

    // Color bar at top
    roundRect(ctx, cx, cy, cardW, 6, 3);
    ctx.fillStyle = stat.color;
    ctx.fill();

    ctx.fillStyle = stat.color;
    ctx.font = "bold 42px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(stat.value, cx + cardW / 2, cy + 52);

    ctx.fillStyle = GRAY_500;
    ctx.font = "16px sans-serif";
    ctx.fillText(stat.label, cx + cardW / 2, cy + 92);
  });

  // Activity section
  const actY = contentY + 24 + 2 * (cardH + 16) + 16;
  roundRect(ctx, x + 24, actY, w - 48, 160, 16);
  ctx.fillStyle = WHITE;
  ctx.fill();

  ctx.fillStyle = GRAY_900;
  ctx.font = "bold 20px sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("Actividad reciente", x + 44, actY + 36);

  const activities = [
    "DEA verificado en Av. Libertad 5",
    "Nuevo miembro: Maria Garcia",
    "DEA anadido en Plaza Mayor 1",
  ];

  activities.forEach((act, i) => {
    const ay = actY + 60 + i * 32;
    ctx.fillStyle = GREEN_MID;
    ctx.beginPath();
    ctx.arc(x + 52, ay + 4, 5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = GRAY_700;
    ctx.font = "16px sans-serif";
    ctx.fillText(act, x + 68, ay + 9);
  });

  // Quick actions
  const qaY = actY + 190;
  roundRect(ctx, x + 24, qaY, w - 48, 200, 16);
  ctx.fillStyle = WHITE;
  ctx.fill();

  ctx.fillStyle = GRAY_900;
  ctx.font = "bold 20px sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("Acciones rapidas", x + 44, qaY + 36);

  const actions = [
    { label: "Verificar DEAs pendientes", color: "#F59E0B" },
    { label: "Ver todos los DEAs", color: GREEN_MID },
    { label: "Gestionar equipo", color: "#8B5CF6" },
  ];

  actions.forEach((action, i) => {
    const ay = qaY + 55 + i * 48;

    roundRect(ctx, x + 40, ay, w - 80, 40, 10);
    ctx.fillStyle = GRAY_100;
    ctx.fill();

    ctx.fillStyle = action.color;
    ctx.beginPath();
    ctx.arc(x + 60, ay + 20, 8, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = GRAY_900;
    ctx.font = "17px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(action.label, x + 80, ay + 25);

    ctx.fillStyle = GRAY_500;
    ctx.font = "20px sans-serif";
    ctx.textAlign = "right";
    ctx.fillText("\u203A", x + w - 60, ay + 25);
  });
}

// ============================================
// Generate all screenshots
// ============================================
const screens = [
  { name: "01-mapa", draw: drawMapScreen, title: "Encuentra DEAs cerca de ti" },
  { name: "02-detalle", draw: drawDetailScreen, title: "Informacion completa del DEA" },
  { name: "03-anadir", draw: drawAddScreen, title: "Anade desfibriladores al mapa" },
  { name: "04-organizacion", draw: drawOrgScreen, title: "Gestiona tu organizacion" },
];

screens.forEach((screen) => {
  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext("2d");

  drawPhone(ctx, screen.draw);

  // Title text above phone
  ctx.fillStyle = WHITE;
  ctx.font = "bold 44px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(screen.title, WIDTH / 2, 140);

  // Subtitle
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.font = "24px sans-serif";
  ctx.fillText("DeaMap", WIDTH / 2, 195);

  const outputPath = path.join(outputDir, `screenshot-${screen.name}.png`);
  const buffer = canvas.toBuffer("image/png");
  fs.writeFileSync(outputPath, buffer);
  console.log(`${screen.name}: ${(buffer.length / 1024).toFixed(1)} KB`);
});

console.log(`\nAll screenshots saved to: ${outputDir}`);
console.log(`Size: ${WIDTH}x${HEIGHT}px (9:16 ratio)`);
