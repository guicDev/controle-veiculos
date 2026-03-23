const canvas = document.getElementById("assinaturaCanvas");
const ctx = canvas.getContext("2d");

let desenhando = false;

function ajustarCanvas() {
  const ratio = window.devicePixelRatio || 1;

  const larguraVisual = canvas.offsetWidth || 500;
  const alturaVisual = canvas.offsetHeight || 180;

  canvas.width = larguraVisual * ratio;
  canvas.height = alturaVisual * ratio;

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.scale(ratio, ratio);

  ctx.lineWidth = 2;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = "#000";
}

ajustarCanvas();
window.addEventListener("resize", ajustarCanvas);

canvas.addEventListener("pointerdown", (e) => {
  desenhando = true;
  canvas.setPointerCapture(e.pointerId);

  const rect = canvas.getBoundingClientRect();
  ctx.beginPath();
  ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
});

canvas.addEventListener("pointermove", (e) => {
  if (!desenhando) return;

  const rect = canvas.getBoundingClientRect();
  ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
  ctx.stroke();
});

canvas.addEventListener("pointerup", () => {
  desenhando = false;
});

canvas.addEventListener("pointercancel", () => {
  desenhando = false;
});

canvas.addEventListener("touchstart", (e) => e.preventDefault(), { passive: false });
canvas.addEventListener("touchmove", (e) => e.preventDefault(), { passive: false });

function limparAssinatura() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function obterAssinaturaBase64() {
  return canvas.toDataURL("image/png");
}