import * as THREE from "three";

/** Long-grain laminated wood — reads clearly on screen, less noisy speckle. */
export function createWoodBlockTexture(): THREE.CanvasTexture {
  const w = 512;
  const h = 512;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return new THREE.CanvasTexture(canvas);
  }

  const base = ctx.createLinearGradient(0, 0, 0, h);
  base.addColorStop(0, "#d4b896");
  base.addColorStop(0.2, "#b8956a");
  base.addColorStop(0.45, "#a67c52");
  base.addColorStop(0.7, "#8f6842");
  base.addColorStop(1, "#6d4c30");
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, w, h);

  ctx.globalAlpha = 0.55;
  for (let col = 0; col < 9; col++) {
    const x0 = (col / 9) * w + (Math.random() - 0.5) * 8;
    const g = ctx.createLinearGradient(x0, 0, x0 + 18 + Math.random() * 12, h);
    const t = 0.08 + Math.random() * 0.06;
    g.addColorStop(0, `rgba(40, 26, 14, ${t})`);
    g.addColorStop(0.5, `rgba(255, 220, 180, ${t * 0.35})`);
    g.addColorStop(1, `rgba(35, 22, 12, ${t})`);
    ctx.fillStyle = g;
    ctx.fillRect(x0, 0, 22 + Math.random() * 16, h);
  }
  ctx.globalAlpha = 1;

  ctx.strokeStyle = "rgba(30, 18, 10, 0.18)";
  ctx.lineWidth = 1;
  for (let i = 0; i < 140; i++) {
    let x = Math.random() * w;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    let y = 0;
    while (y < h) {
      y += 3 + Math.random() * 5;
      x += (Math.random() - 0.5) * 1.2;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  ctx.strokeStyle = "rgba(255, 245, 220, 0.06)";
  ctx.lineWidth = 0.7;
  for (let i = 0; i < 60; i++) {
    const x = Math.random() * w;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    for (let y = 0; y < h; y += 12) {
      ctx.lineTo(x + Math.sin(y * 0.02) * 1.5, y);
    }
    ctx.stroke();
  }

  ctx.fillStyle = "rgba(20, 12, 6, 0.04)";
  for (let i = 0; i < 80; i++) {
    const rw = 30 + Math.random() * 90;
    const rh = 2 + Math.random() * 4;
    ctx.fillRect(Math.random() * w, Math.random() * h, rw, rh);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, 1.15);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
