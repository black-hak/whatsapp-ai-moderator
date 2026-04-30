const Q = new Map();

export function getRandomDelay() {
  const h = new Date().getHours();
  const madrugada = h >= 22 || h < 7;
  const [min, max] = madrugada ? [300000, 900000] : [60000, 180000];
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function encolarAccion(id, fn) {
  if (Q.has(id)) return;
  const d = getRandomDelay();
  Q.set(id, setTimeout(async () => {
    Q.delete(id);
    try { await fn(); } catch (e) { console.error("[Simon/delay]", e.message); }
  }, d));
  console.log("[Simon] Accion programada en " + (d/60000).toFixed(1) + " min");
}

export function cancelarAccion(id) {
  if (Q.has(id)) { clearTimeout(Q.get(id)); Q.delete(id); }
}
