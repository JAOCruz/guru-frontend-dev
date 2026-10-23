import * as THREE from "three";

// Gurú's real storefront in La Feria, drawn on canvases for the office building: the white awning sign
// (GURÚ in graphite, SOLUCIONES in blue) and the dark door + shop window with the services.
// (The opening hours on the real door are left out on purpose: the website shows the official ones.)

function canvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

function texture(c: HTMLCanvasElement) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

/** Awning front: white sign, "GURÚ" + quill + "SOLUCIONES" */
export function signTexture() {
  const c = canvas(1024, 160);
  const g = c.getContext("2d")!;
  const bg = g.createLinearGradient(0, 0, 0, 160);
  bg.addColorStop(0, "#f7f8fa");
  bg.addColorStop(1, "#d9dde4");
  g.fillStyle = bg;
  g.fillRect(0, 0, 1024, 160);
  g.textBaseline = "middle";
  // GURÚ: heavy rounded graphite letters with a light rim, like the logo
  g.font = "900 104px 'Arial Rounded MT Bold', 'Arial Black', sans-serif";
  const word = "GURÚ";
  const gw = g.measureText(word).width;
  g.font = "700 64px 'Rockwell Extra Bold', 'Rockwell', Georgia, serif";
  const sw = g.measureText("SOLUCIONES").width;
  const gap = 34;
  let x = (1024 - (gw + gap + sw)) / 2;
  g.font = "900 104px 'Arial Rounded MT Bold', 'Arial Black', sans-serif";
  g.lineJoin = "round";
  g.lineWidth = 10;
  g.strokeStyle = "#ffffff";
  g.strokeText(word, x, 86);
  const fill = g.createLinearGradient(0, 30, 0, 140);
  fill.addColorStop(0, "#6b7078");
  fill.addColorStop(0.5, "#2e3136");
  fill.addColorStop(1, "#4a4e55");
  g.fillStyle = fill;
  g.fillText(word, x, 86);
  // the quill over the Ú
  g.save();
  g.translate(x + gw - 18, 26);
  g.rotate(0.5);
  g.fillStyle = "#1f3dff";
  g.beginPath();
  g.ellipse(0, 0, 7, 20, 0, 0, Math.PI * 2);
  g.fill();
  g.restore();
  x += gw + gap;
  g.font = "700 64px 'Rockwell Extra Bold', 'Rockwell', Georgia, serif";
  g.fillStyle = "#1f3dff";
  g.fillText("SOLUCIONES", x, 90);
  return texture(c);
}

/** Door (left) and shop window (right) under the awning */
export function frontTexture() {
  const W = 1024, H = 768;
  const c = canvas(W, H);
  const g = c.getContext("2d")!;
  g.fillStyle = "#0d0f14"; // black aluminium frame
  g.fillRect(0, 0, W, H);

  // door: dark brown glass with the white logo
  const dx = 28, dy = 28, dw = 400, dh = H - 56;
  const door = g.createLinearGradient(dx, dy, dx + dw, dy + dh);
  door.addColorStop(0, "#3d2c24");
  door.addColorStop(1, "#1b120e");
  g.fillStyle = door;
  g.fillRect(dx, dy, dw, dh);
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.font = "900 78px 'Arial Rounded MT Bold', 'Arial Black', sans-serif";
  g.fillStyle = "#e8e6e1";
  g.fillText("GURÚ", dx + dw / 2, dy + 230);
  g.font = "700 34px 'Rockwell', Georgia, serif";
  g.fillText("SOLUCIONES", dx + dw / 2, dy + 288);
  // push bar
  g.fillStyle = "#9aa0a8";
  g.fillRect(dx + 20, dy + dh * 0.52, dw - 40, 10);

  // shop window: dark glass, scales, services list
  const wx = dx + dw + 28, wy = dy, ww = W - wx - 28, wh = dh;
  const win = g.createLinearGradient(wx, wy, wx, wy + wh);
  win.addColorStop(0, "#1a2140");
  win.addColorStop(1, "#0c1024");
  g.fillStyle = win;
  g.fillRect(wx, wy, ww, wh);
  // scales of justice
  const cx = wx + ww / 2, sy = wy + 92;
  g.strokeStyle = "#e8e6e1";
  g.lineWidth = 6;
  g.beginPath();
  g.moveTo(cx, sy - 40);
  g.lineTo(cx, sy + 40);
  g.moveTo(cx - 70, sy - 20);
  g.lineTo(cx + 70, sy - 20);
  g.stroke();
  for (const s of [-1, 1]) {
    g.beginPath();
    g.moveTo(cx + s * 70, sy - 20);
    g.lineTo(cx + s * 90, sy + 22);
    g.lineTo(cx + s * 50, sy + 22);
    g.closePath();
    g.stroke();
  }
  g.fillRect(cx - 30, sy + 40, 60, 8);
  // services
  g.textAlign = "left";
  g.font = "800 46px 'Arial Narrow', 'Arial Black', sans-serif";
  g.fillStyle = "#ffffff";
  const items = ["COPIAS", "DIGITACIÓN", "IMPRESIONES", "CERTIFICACIONES"];
  items.forEach((t, i) => {
    const y = wy + 190 + i * 60;
    g.fillStyle = "#00c853";
    g.fillRect(wx + 26, y - 12, 22, 22);
    g.fillStyle = "#ffffff";
    g.fillText(t, wx + 64, y);
  });
  return texture(c);
}
