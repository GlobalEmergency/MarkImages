const { createCanvas } = require("canvas");
const fs = require("fs");
const path = require("path");

// iOS App Store: iPhone 14 Pro Max (6.7")
const WIDTH = 1284;
const HEIGHT = 2778;
const SCALE = WIDTH / 1080; // ~1.19x from Android version

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

const outputDir = path.join(__dirname, "..", "public", "app-store");
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

function s(v) { return Math.round(v * SCALE); }

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
  const bgGrad = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  bgGrad.addColorStop(0, GREEN_MID);
  bgGrad.addColorStop(1, GREEN_DARK);
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  const phoneX = s(70);
  const phoneY = s(340);
  const phoneW = WIDTH - s(140);
  const phoneH = HEIGHT - s(560);
  const phoneR = s(44);

  ctx.shadowColor = "rgba(0,0,0,0.4)";
  ctx.shadowBlur = s(40);
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = s(10);

  roundRect(ctx, phoneX - s(4), phoneY - s(4), phoneW + s(8), phoneH + s(8), phoneR + s(2));
  ctx.fillStyle = "#1a1a1a";
  ctx.fill();

  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  roundRect(ctx, phoneX, phoneY, phoneW, phoneH, phoneR);
  ctx.fillStyle = WHITE;
  ctx.fill();
  ctx.save();
  roundRect(ctx, phoneX, phoneY, phoneW, phoneH, phoneR);
  ctx.clip();

  contentDrawer(ctx, phoneX, phoneY, phoneW, phoneH);

  ctx.restore();

  // Dynamic Island (iOS style)
  const diW = s(160);
  const diH = s(36);
  roundRect(ctx, phoneX + phoneW / 2 - diW / 2, phoneY + s(10), diW, diH, diH / 2);
  ctx.fillStyle = "#1a1a1a";
  ctx.fill();
}

function drawStatusBar(ctx, x, y, w) {
  ctx.fillStyle = GRAY_900;
  ctx.fillRect(x, y, w, s(52));
  ctx.fillStyle = WHITE;
  ctx.font = `bold ${s(20)}px sans-serif`;
  ctx.textAlign = "left";
  ctx.fillText("9:41", x + s(34), y + s(35));
  ctx.textAlign = "right";
  ctx.font = `${s(18)}px sans-serif`;
  ctx.fillText("100%", x + w - s(34), y + s(35));
}

// ============================================
// SCREENSHOT 1: Map with nearby AEDs
// ============================================
function drawMapScreen(ctx, x, y, w, h) {
  drawStatusBar(ctx, x, y, w);

  const mapGrad = ctx.createLinearGradient(x, y + s(52), x, y + h);
  mapGrad.addColorStop(0, "#E8F5E9");
  mapGrad.addColorStop(0.3, "#C8E6C9");
  mapGrad.addColorStop(0.6, "#E8F5E9");
  mapGrad.addColorStop(1, "#C8E6C9");
  ctx.fillStyle = mapGrad;
  ctx.fillRect(x, y + s(52), w, h - s(52));

  ctx.strokeStyle = "rgba(255,255,255,0.7)";
  ctx.lineWidth = s(2);
  for (let i = 0; i < 10; i++) {
    const sy = y + s(100) + i * s(170);
    ctx.beginPath();
    ctx.moveTo(x, sy);
    ctx.lineTo(x + w, sy + s(40));
    ctx.stroke();
  }
  for (let i = 0; i < 6; i++) {
    const sx = x + s(50) + i * s(200);
    ctx.beginPath();
    ctx.moveTo(sx, y + s(52));
    ctx.lineTo(sx - s(30), y + h);
    ctx.stroke();
  }

  const pins = [
    { px: x + s(450), py: y + s(400), main: true },
    { px: x + s(220), py: y + s(580), main: false },
    { px: x + s(700), py: y + s(320), main: false },
    { px: x + s(380), py: y + s(780), main: false },
    { px: x + s(600), py: y + s(620), main: false },
    { px: x + s(160), py: y + s(280), main: false },
  ];

  for (const pin of pins) {
    const size = pin.main ? 1.5 : 1;
    ctx.fillStyle = "rgba(0,0,0,0.2)";
    ctx.beginPath();
    ctx.ellipse(pin.px, pin.py + s(25) * size, s(14) * size, s(6) * size, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = pin.main ? RED : GREEN_MID;
    ctx.beginPath();
    ctx.arc(pin.px, pin.py - s(14) * size, s(20) * size, Math.PI, 0);
    ctx.lineTo(pin.px, pin.py + s(22) * size);
    ctx.lineTo(pin.px - s(20) * size, pin.py - s(14) * size);
    ctx.fill();

    ctx.fillStyle = WHITE;
    ctx.beginPath();
    ctx.arc(pin.px, pin.py - s(14) * size, s(13) * size, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = pin.main ? RED : GREEN_MID;
    ctx.font = `${s(16) * size}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("\u2665", pin.px, pin.py - s(13) * size);
  }

  // Search bar
  const sbY = y + s(70);
  roundRect(ctx, x + s(22), sbY, w - s(44), s(62), s(31));
  ctx.fillStyle = WHITE;
  ctx.fill();
  ctx.strokeStyle = GRAY_200;
  ctx.lineWidth = 1;
  roundRect(ctx, x + s(22), sbY, w - s(44), s(62), s(31));
  ctx.stroke();

  ctx.fillStyle = GRAY_500;
  ctx.font = `${s(22)}px sans-serif`;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText("Buscar direccion...", x + s(66), sbY + s(31));

  // Geolocation button
  roundRect(ctx, x + w - s(88), sbY + s(78), s(62), s(62), s(31));
  ctx.fillStyle = WHITE;
  ctx.fill();
  ctx.fillStyle = BLUE;
  ctx.font = `${s(30)}px sans-serif`;
  ctx.textAlign = "center";
  ctx.fillText("\u25CE", x + w - s(57), sbY + s(112));

  // Bottom results panel
  const panelY = y + h - s(440);
  roundRect(ctx, x, panelY, w, s(440), s(26));
  ctx.fillStyle = WHITE;
  ctx.fill();

  roundRect(ctx, x + w / 2 - s(32), panelY + s(12), s(64), s(6), s(3));
  ctx.fillStyle = GRAY_300;
  ctx.fill();

  ctx.fillStyle = GRAY_900;
  ctx.font = `bold ${s(24)}px sans-serif`;
  ctx.textAlign = "left";
  ctx.fillText("DEAs cercanos", x + s(26), panelY + s(56));

  const cards = [
    { name: "Centro de Salud San Pablo", dist: "120 m", status: "Verificado" },
    { name: "Estacion de Metro Sol", dist: "340 m", status: "Verificado" },
    { name: "Gimnasio FitLife", dist: "520 m", status: "Pendiente" },
  ];

  cards.forEach((card, i) => {
    const cy = panelY + s(82) + i * s(108);

    roundRect(ctx, x + s(18), cy, w - s(36), s(94), s(14));
    ctx.fillStyle = GRAY_100;
    ctx.fill();

    ctx.fillStyle = GREEN_MID;
    ctx.beginPath();
    ctx.arc(x + s(56), cy + s(47), s(24), 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = WHITE;
    ctx.font = `${s(22)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("\u2665", x + s(56), cy + s(48));

    ctx.textAlign = "left";
    ctx.fillStyle = GRAY_900;
    ctx.font = `bold ${s(21)}px sans-serif`;
    ctx.fillText(card.name, x + s(96), cy + s(34));

    ctx.fillStyle = GRAY_500;
    ctx.font = `${s(18)}px sans-serif`;
    ctx.fillText(card.dist + "  •  " + card.status, x + s(96), cy + s(66));

    roundRect(ctx, x + w - s(110), cy + s(26), s(76), s(40), s(20));
    ctx.fillStyle = GREEN_MID;
    ctx.fill();
    ctx.fillStyle = WHITE;
    ctx.font = `bold ${s(18)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText(card.dist, x + w - s(72), cy + s(49));
  });
}

// ============================================
// SCREENSHOT 2: AED Detail
// ============================================
function drawDetailScreen(ctx, x, y, w, h) {
  drawStatusBar(ctx, x, y, w);

  const imgH = s(400);
  const imgGrad = ctx.createLinearGradient(x, y + s(52), x, y + s(52) + imgH);
  imgGrad.addColorStop(0, "#2D3748");
  imgGrad.addColorStop(1, "#1A202C");
  ctx.fillStyle = imgGrad;
  ctx.fillRect(x, y + s(52), w, imgH);

  ctx.fillStyle = "rgba(255,255,255,0.08)";
  roundRect(ctx, x + w / 2 - s(110), y + s(130), s(220), s(220), s(22));
  ctx.fill();
  ctx.fillStyle = GREEN_MID;
  ctx.font = `${s(110)}px sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("\u2665", x + w / 2, y + s(240));

  ctx.fillStyle = "rgba(255,255,255,0.2)";
  ctx.beginPath();
  ctx.arc(x + s(48), y + s(90), s(24), 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = WHITE;
  ctx.font = `bold ${s(24)}px sans-serif`;
  ctx.fillText("\u2190", x + s(48), y + s(92));

  const contentY = y + s(52) + imgH;
  ctx.fillStyle = WHITE;
  ctx.fillRect(x, contentY, w, h - s(52) - imgH);

  ctx.fillStyle = GRAY_900;
  ctx.font = `bold ${s(30)}px sans-serif`;
  ctx.textAlign = "left";
  ctx.fillText("Centro de Salud San Pablo", x + s(26), contentY + s(50));

  roundRect(ctx, x + s(26), contentY + s(70), s(112), s(34), s(17));
  ctx.fillStyle = "#DEF7EC";
  ctx.fill();
  ctx.fillStyle = GREEN_MID;
  ctx.font = `bold ${s(17)}px sans-serif`;
  ctx.textAlign = "left";
  ctx.fillText("Verificado", x + s(44), contentY + s(92));

  const infoItems = [
    { label: "Direccion", value: "C/ San Pablo 12, Madrid" },
    { label: "Horario", value: "24 horas / 7 dias" },
    { label: "Acceso", value: "Entrada principal, planta baja" },
    { label: "Ultima verificacion", value: "15 febrero 2026" },
    { label: "Contacto", value: "+34 912 345 678" },
  ];

  infoItems.forEach((item, i) => {
    const iy = contentY + s(125) + i * s(86);

    if (i > 0) {
      ctx.fillStyle = GRAY_200;
      ctx.fillRect(x + s(26), iy - s(8), w - s(52), 1);
    }

    ctx.fillStyle = GRAY_500;
    ctx.font = `${s(17)}px sans-serif`;
    ctx.textAlign = "left";
    ctx.fillText(item.label, x + s(26), iy + s(14));

    ctx.fillStyle = GRAY_900;
    ctx.font = `${s(21)}px sans-serif`;
    ctx.fillText(item.value, x + s(26), iy + s(46));
  });

  const btnY = contentY + s(580);
  const btnW = (w - s(72)) / 2;

  roundRect(ctx, x + s(26), btnY, btnW, s(62), s(14));
  ctx.fillStyle = GREEN_MID;
  ctx.fill();
  ctx.fillStyle = WHITE;
  ctx.font = `bold ${s(20)}px sans-serif`;
  ctx.textAlign = "center";
  ctx.fillText("Como llegar", x + s(26) + btnW / 2, btnY + s(36));

  roundRect(ctx, x + s(46) + btnW, btnY, btnW, s(62), s(14));
  ctx.fillStyle = RED;
  ctx.fill();
  ctx.fillStyle = WHITE;
  ctx.font = `bold ${s(20)}px sans-serif`;
  ctx.fillText("Llamar 112", x + s(46) + btnW + btnW / 2, btnY + s(36));
}

// ============================================
// SCREENSHOT 3: Add AED form
// ============================================
function drawAddScreen(ctx, x, y, w, h) {
  drawStatusBar(ctx, x, y, w);

  const headerH = s(120);
  const hdrGrad = ctx.createLinearGradient(x, y + s(52), x, y + s(52) + headerH);
  hdrGrad.addColorStop(0, GREEN_LIGHT);
  hdrGrad.addColorStop(1, GREEN_MID);
  ctx.fillStyle = hdrGrad;
  ctx.fillRect(x, y + s(52), w, headerH);

  ctx.fillStyle = WHITE;
  ctx.font = `bold ${s(28)}px sans-serif`;
  ctx.textAlign = "center";
  ctx.fillText("Anadir nuevo DEA", x + w / 2, y + s(52) + s(44));
  ctx.font = `${s(19)}px sans-serif`;
  ctx.fillStyle = "rgba(255,255,255,0.8)";
  ctx.fillText("Ayuda a completar el mapa", x + w / 2, y + s(52) + s(82));

  const contentY = y + s(52) + headerH;
  ctx.fillStyle = WHITE;
  ctx.fillRect(x, contentY, w, h - s(52) - headerH);

  const fields = [
    { label: "Nombre del DEA *", value: "Farmacia Lopez", filled: true },
    { label: "Calle", value: "Calle Mayor", filled: true },
    { label: "Numero", value: "25", filled: true },
    { label: "Ciudad", value: "Madrid", filled: true },
    { label: "Pais", value: "Espana", filled: false },
    { label: "Observaciones", value: "", placeholder: "Notas adicionales...", filled: false },
  ];

  fields.forEach((field, i) => {
    const fy = contentY + s(34) + i * s(115);

    ctx.fillStyle = GRAY_700;
    ctx.font = `bold ${s(19)}px sans-serif`;
    ctx.textAlign = "left";
    ctx.fillText(field.label, x + s(30), fy + s(22));

    roundRect(ctx, x + s(30), fy + s(36), w - s(60), s(56), s(12));
    ctx.fillStyle = field.filled ? WHITE : GRAY_100;
    ctx.fill();
    ctx.strokeStyle = field.filled ? GREEN_MID : GRAY_300;
    ctx.lineWidth = field.filled ? 2 : 1;
    roundRect(ctx, x + s(30), fy + s(36), w - s(60), s(56), s(12));
    ctx.stroke();

    ctx.fillStyle = field.value ? GRAY_900 : GRAY_500;
    ctx.font = `${s(20)}px sans-serif`;
    ctx.fillText(field.value || field.placeholder || "", x + s(48), fy + s(70));
  });

  const btnY = contentY + s(740);
  roundRect(ctx, x + s(30), btnY, w - s(60), s(62), s(14));
  ctx.fillStyle = GREEN_MID;
  ctx.fill();
  ctx.fillStyle = WHITE;
  ctx.font = `bold ${s(22)}px sans-serif`;
  ctx.textAlign = "center";
  ctx.fillText("Enviar desfibrilador", x + w / 2, btnY + s(36));
}

// ============================================
// SCREENSHOT 4: Organization dashboard
// ============================================
function drawOrgScreen(ctx, x, y, w, h) {
  drawStatusBar(ctx, x, y, w);

  const headerH = s(140);
  const hdrGrad = ctx.createLinearGradient(x, y + s(52), x, y + s(52) + headerH);
  hdrGrad.addColorStop(0, GREEN_LIGHT);
  hdrGrad.addColorStop(1, GREEN_MID);
  ctx.fillStyle = hdrGrad;
  ctx.fillRect(x, y + s(52), w, headerH);

  ctx.fillStyle = WHITE;
  ctx.font = `bold ${s(30)}px sans-serif`;
  ctx.textAlign = "left";
  ctx.fillText("Proteccion Civil Madrid", x + s(30), y + s(52) + s(50));
  ctx.font = `${s(19)}px sans-serif`;
  ctx.fillStyle = "rgba(255,255,255,0.8)";
  ctx.fillText("Panel de organizacion", x + s(30), y + s(52) + s(88));

  const contentY = y + s(52) + headerH;
  ctx.fillStyle = GRAY_100;
  ctx.fillRect(x, contentY, w, h - s(52) - headerH);

  const stats = [
    { value: "47", label: "Total DEAs", color: BLUE },
    { value: "42", label: "Verificados", color: GREEN_MID },
    { value: "5", label: "Pendientes", color: "#F59E0B" },
    { value: "8", label: "Miembros", color: "#8B5CF6" },
  ];

  const cardW = (w - s(80)) / 2;
  const cardH = s(135);

  stats.forEach((stat, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const cx = x + s(26) + col * (cardW + s(28));
    const cy = contentY + s(26) + row * (cardH + s(18));

    roundRect(ctx, cx, cy, cardW, cardH, s(18));
    ctx.fillStyle = WHITE;
    ctx.fill();

    roundRect(ctx, cx, cy, cardW, s(7), s(3));
    ctx.fillStyle = stat.color;
    ctx.fill();

    ctx.fillStyle = stat.color;
    ctx.font = `bold ${s(46)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(stat.value, cx + cardW / 2, cy + s(58));

    ctx.fillStyle = GRAY_500;
    ctx.font = `${s(18)}px sans-serif`;
    ctx.fillText(stat.label, cx + cardW / 2, cy + s(104));
  });

  const actY = contentY + s(26) + 2 * (cardH + s(18)) + s(18);
  roundRect(ctx, x + s(26), actY, w - s(52), s(180), s(18));
  ctx.fillStyle = WHITE;
  ctx.fill();

  ctx.fillStyle = GRAY_900;
  ctx.font = `bold ${s(22)}px sans-serif`;
  ctx.textAlign = "left";
  ctx.fillText("Actividad reciente", x + s(48), actY + s(40));

  const activities = [
    "DEA verificado en Av. Libertad 5",
    "Nuevo miembro: Maria Garcia",
    "DEA anadido en Plaza Mayor 1",
  ];

  activities.forEach((act, i) => {
    const ay = actY + s(66) + i * s(36);
    ctx.fillStyle = GREEN_MID;
    ctx.beginPath();
    ctx.arc(x + s(56), ay + s(5), s(6), 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = GRAY_700;
    ctx.font = `${s(18)}px sans-serif`;
    ctx.fillText(act, x + s(74), ay + s(10));
  });

  const qaY = actY + s(210);
  roundRect(ctx, x + s(26), qaY, w - s(52), s(220), s(18));
  ctx.fillStyle = WHITE;
  ctx.fill();

  ctx.fillStyle = GRAY_900;
  ctx.font = `bold ${s(22)}px sans-serif`;
  ctx.textAlign = "left";
  ctx.fillText("Acciones rapidas", x + s(48), qaY + s(40));

  const actions = [
    { label: "Verificar DEAs pendientes", color: "#F59E0B" },
    { label: "Ver todos los DEAs", color: GREEN_MID },
    { label: "Gestionar equipo", color: "#8B5CF6" },
  ];

  actions.forEach((action, i) => {
    const ay = qaY + s(60) + i * s(54);

    roundRect(ctx, x + s(44), ay, w - s(88), s(44), s(12));
    ctx.fillStyle = GRAY_100;
    ctx.fill();

    ctx.fillStyle = action.color;
    ctx.beginPath();
    ctx.arc(x + s(66), ay + s(22), s(9), 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = GRAY_900;
    ctx.font = `${s(19)}px sans-serif`;
    ctx.textAlign = "left";
    ctx.fillText(action.label, x + s(88), ay + s(28));

    ctx.fillStyle = GRAY_500;
    ctx.font = `${s(22)}px sans-serif`;
    ctx.textAlign = "right";
    ctx.fillText("\u203A", x + w - s(66), ay + s(28));
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

  ctx.fillStyle = WHITE;
  ctx.font = `bold ${s(48)}px sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(screen.title, WIDTH / 2, s(160));

  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.font = `${s(26)}px sans-serif`;
  ctx.fillText("DeaMap", WIDTH / 2, s(220));

  const outputPath = path.join(outputDir, `screenshot-${screen.name}.png`);
  const buffer = canvas.toBuffer("image/png");
  fs.writeFileSync(outputPath, buffer);
  console.log(`${screen.name}: ${(buffer.length / 1024).toFixed(1)} KB`);
});

console.log(`\nAll iOS screenshots saved to: ${outputDir}`);
console.log(`Size: ${WIDTH}x${HEIGHT}px (iPhone 14 Pro Max)`);
