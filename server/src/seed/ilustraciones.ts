/**
 * Ilustraciones vectoriales simples para los datos de ejemplo.
 * Son genéricas e inventadas: no representan personas ni lugares reales.
 */
const W = 1600,
  H = 900;

function aclarar(hex: string, f: number) {
  const c = hex.replace("#", "");
  return (
    "#" +
    [0, 2, 4]
      .map((i) => Math.round(parseInt(c.slice(i, i + 2), 16) + (255 - parseInt(c.slice(i, i + 2), 16)) * f))
      .map((x) => x.toString(16).padStart(2, "0"))
      .join("")
  );
}

function casas(y: number, color: string, n = 9, sem = 1) {
  let s = "";
  let x = -20;
  for (let i = 0; i < n; i++) {
    const w = 140 + ((i * 37 * sem) % 90);
    const h = 120 + ((i * 53 * sem) % 140);
    s += `<rect x="${x}" y="${y - h}" width="${w}" height="${h}" fill="${color}"/>`;
    s += `<polygon points="${x - 8},${y - h} ${x + w / 2},${y - h - 60} ${x + w + 8},${y - h}" fill="${color}"/>`;
    for (let k = 0; k < 2; k++) s += `<rect x="${x + 22 + k * (w / 2 - 6)}" y="${y - h + 34}" width="34" height="34" rx="4" fill="#fff" opacity=".55"/>`;
    x += w + 26;
  }
  return s;
}

type Motivo = "calles" | "agua" | "luz" | "comercio" | "salud" | "jovenes" | "transporte" | "ambiente" | "seguridad";

export function ilustracion(m: Motivo, color: string): string {
  const fondo = aclarar(color, 0.82);
  const medio = aclarar(color, 0.45);
  let extra = "";
  switch (m) {
    case "calles":
      extra = `<rect x="0" y="640" width="${W}" height="260" fill="#4a4a48"/>${Array.from({ length: 9 }, (_, i) => `<rect x="${i * 190 + 30}" y="760" width="110" height="16" rx="8" fill="#f5d547"/>`).join("")}
      <ellipse cx="820" cy="720" rx="120" ry="30" fill="#2d2d2b"/><polygon points="1180,640 1240,520 1300,640" fill="#f97316"/><rect x="1196" y="590" width="88" height="14" fill="#fff"/>`;
      break;
    case "agua":
      extra = `${[0, 1, 2, 3].map((i) => `<path d="M0 ${660 + i * 60} Q 200 ${620 + i * 60} 400 ${660 + i * 60} T 800 ${660 + i * 60} T 1200 ${660 + i * 60} T 1600 ${660 + i * 60} V 900 H 0Z" fill="${color}" opacity="${0.35 + i * 0.15}"/>`).join("")}
      ${Array.from({ length: 40 }, (_, i) => `<line x1="${(i * 97) % W}" y1="${(i * 53) % 400}" x2="${((i * 97) % W) - 20}" y2="${((i * 53) % 400) + 60}" stroke="${color}" stroke-width="6" stroke-linecap="round" opacity=".5"/>`).join("")}`;
      break;
    case "luz":
      extra = `<rect x="0" y="0" width="${W}" height="${H}" fill="#1d2a3a" opacity=".85"/>${[300, 800, 1300].map((x) => `<rect x="${x - 8}" y="250" width="16" height="560" fill="#2f3b4b"/><path d="M${x - 8} 260 q 0 -40 60 -40 h 60" stroke="#2f3b4b" stroke-width="16" fill="none"/><circle cx="${x + 120}" cy="236" r="26" fill="#ffe27a"/><polygon points="${x + 96},250 ${x + 144},250 ${x + 330},820 ${x - 90},820" fill="#ffe27a" opacity=".22"/>`).join("")}
      <rect x="0" y="820" width="${W}" height="80" fill="#2e7d32"/>`;
      break;
    case "comercio":
      extra = `${[0, 1, 2].map((i) => `<rect x="${140 + i * 470}" y="330" width="400" height="460" fill="${medio}"/><rect x="${160 + i * 470}" y="470" width="360" height="200" fill="#fff" opacity=".7"/>${Array.from({ length: 6 }, (_, k) => `<path d="M${140 + i * 470 + k * 67} 330 h67 v70 a33.5 33.5 0 0 1 -67 0z" fill="${k % 2 ? "#fff" : color}"/>`).join("")}`).join("")}`;
      break;
    case "salud":
      extra = `<rect x="460" y="260" width="680" height="540" rx="24" fill="#fff"/><rect x="740" y="340" width="120" height="320" rx="16" fill="${color}"/><rect x="640" y="440" width="320" height="120" rx="16" fill="${color}"/>`;
      break;
    case "jovenes":
      extra = `<circle cx="800" cy="560" r="170" fill="#fff"/><path d="M630 560 h340 M800 390 v340 M680 440 q120 120 240 0 M680 680 q120 -120 240 0" stroke="${color}" stroke-width="14" fill="none"/>`;
      break;
    case "transporte":
      extra = `<rect x="0" y="720" width="${W}" height="180" fill="#4a4a48"/><rect x="380" y="410" width="840" height="320" rx="40" fill="${color}"/>${[0, 1, 2, 3, 4].map((i) => `<rect x="${430 + i * 150}" y="460" width="120" height="110" rx="12" fill="#fff" opacity=".8"/>`).join("")}<circle cx="540" cy="740" r="58" fill="#222"/><circle cx="1060" cy="740" r="58" fill="#222"/>`;
      break;
    case "ambiente":
      extra = `${[0, 1, 2].map((i) => `<rect x="${430 + i * 270}" y="460" width="200" height="340" rx="20" fill="${["#2e7d32", "#1565c0", "#f9a825"][i]}"/><rect x="${410 + i * 270}" y="430" width="240" height="44" rx="12" fill="${["#1b5e20", "#0d47a1", "#f57f17"][i]}"/>`).join("")}
      <circle cx="260" cy="520" r="120" fill="#43a047"/><rect x="248" y="560" width="24" height="240" fill="#6d4c41"/><circle cx="1360" cy="500" r="140" fill="#43a047"/><rect x="1346" y="560" width="28" height="240" fill="#6d4c41"/>`;
      break;
    case "seguridad":
      extra = `<path d="M800 230 l260 100 v170 c0 170 -120 260 -260 320 c-140 -60 -260 -150 -260 -320 v-170z" fill="#fff"/><path d="M700 520 l70 70 l140 -150" stroke="${color}" stroke-width="34" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
      break;
  }
  const fondoCasas = m === "luz" || m === "salud" || m === "jovenes" || m === "seguridad" ? casas(820, medio, 10, 2) : casas(700, medio, 10, 3);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<rect width="${W}" height="${H}" fill="${fondo}"/><circle cx="1320" cy="170" r="90" fill="#fff" opacity=".6"/>
${m === "comercio" || m === "transporte" || m === "ambiente" ? casas(820, aclarar(color, 0.62), 10, 5) : fondoCasas}${extra}</svg>`;
}

/** Retrato ilustrado y anónimo (silueta), para no usar la foto de una persona real. */
export function retrato(pri: string, sec: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="900" viewBox="0 0 900 900">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${aclarar(pri, 0.25)}"/><stop offset="1" stop-color="${pri}"/></linearGradient></defs>
<rect width="900" height="900" fill="url(#g)"/><circle cx="700" cy="200" r="120" fill="${sec}" opacity=".85"/>
<path d="M170 900 c0 -200 120 -300 280 -300 s280 100 280 300z" fill="#fff" opacity=".92"/>
<circle cx="450" cy="400" r="160" fill="#fff" opacity=".95"/>
<path d="M290 380 c0 -150 80 -220 170 -220 c110 0 160 90 160 200 c-40 -70 -120 -100 -200 -100 c-60 0 -100 40 -130 120z" fill="${aclarar(pri, -0.2)}" opacity=".55"/>
</svg>`;
}

export function portada(pri: string, sec: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<rect width="${W}" height="${H}" fill="${aclarar(pri, 0.3)}"/>
<circle cx="1180" cy="260" r="150" fill="${sec}" opacity=".9"/>
<path d="M0 560 C 300 470 520 600 820 520 S 1350 430 1600 520 V900 H0Z" fill="${aclarar(pri, 0.15)}"/>
${casas(760, aclarar(pri, 0.05), 11, 7)}
<path d="M0 760 C 400 700 900 820 1600 740 V900 H0Z" fill="${pri}"/>
</svg>`;
}
