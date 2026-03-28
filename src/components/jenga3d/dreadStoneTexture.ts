import * as THREE from "three";

/** Carved stone with visible grain, chips, and cool highlights for readability on dark BGs. */
export function createDreadStoneTexture(): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return new THREE.CanvasTexture(canvas);
  }

  const g = ctx.createLinearGradient(0, 0, size, size);
  g.addColorStop(0, "#2a2428");
  g.addColorStop(0.35, "#3a3238");
  g.addColorStop(0.55, "#2e282d");
  g.addColorStop(1, "#1c181c");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);

  for (let i = 0; i < 2200; i++) {
    const a = 0.04 + Math.random() * 0.12;
    ctx.fillStyle = `rgba(${55 + Math.random() * 40}, ${48 + Math.random() * 35}, ${52 + Math.random() * 30}, ${a})`;
    ctx.fillRect(Math.random() * size, Math.random() * size, 1 + Math.random() * 2, 1 + Math.random() * 2);
  }

  ctx.strokeStyle = "rgba(120, 55, 65, 0.35)";
  ctx.lineWidth = 1.1;
  for (let v = 0; v < 22; v++) {
    ctx.beginPath();
    let x = Math.random() * size;
    let y = Math.random() * size;
    ctx.moveTo(x, y);
    for (let s = 0; s < 12; s++) {
      x += (Math.random() - 0.5) * 28;
      y += (Math.random() - 0.5) * 28;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  ctx.strokeStyle = "rgba(200, 200, 210, 0.12)";
  ctx.lineWidth = 0.6;
  for (let e = 0; e < 45; e++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const len = 8 + Math.random() * 28;
    const ang = Math.random() * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len);
    ctx.stroke();
  }

  ctx.fillStyle = "rgba(0,0,0,0.15)";
  for (let c = 0; c < 35; c++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = 2 + Math.random() * 6;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1.15, 1.15);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
