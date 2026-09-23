import styles from "./login.module.css";

/**
 * Pila isométrica de cajas como la del logo, una por tipo de CFDI, con el
 * cubo blanco del logo arriba. Es decoración: se oculta a lectores de
 * pantalla desde quien la usa.
 */

const LADO = 92; // arista de una caja, en unidades del viewBox
const COS30 = Math.cos(Math.PI / 6);
// Con este origen la pila completa (tres cajas de alto) y la sombra del piso
// caben en el viewBox de 520 x 510 sin cortarse.
const ORIGEN = { x: 250, y: 292 };

/** Proyección isométrica de un punto de la rejilla (x, y, z) al SVG. */
function p(x: number, y: number, z: number): [number, number] {
  return [
    ORIGEN.x + (x - y) * COS30 * LADO,
    ORIGEN.y + (x + y) * 0.5 * LADO - z * LADO,
  ];
}

function puntos(vertices: [number, number, number][]) {
  return vertices
    .map((v) => p(...v).map((n) => n.toFixed(1)).join(","))
    .join(" ");
}

type Caja = { x: number; y: number; z: number; etiqueta?: string; logo?: boolean };

// Orden de pintado: de atrás hacia adelante (x+y+z), y de abajo hacia arriba.
const CAJAS: Caja[] = (
  [
    { x: 0, y: 0, z: 0 },
    { x: 1, y: 0, z: 0 },
    { x: 2, y: 0, z: 0, etiqueta: "Pago" },
    { x: 0, y: 1, z: 0, etiqueta: "Ingreso" },
    { x: 1, y: 1, z: 0, etiqueta: "Egreso" },
    { x: 0, y: 0, z: 1, etiqueta: "Nómina" },
    { x: 1, y: 0, z: 1, etiqueta: "Traslado" },
    { x: 0, y: 0, z: 2, logo: true },
  ] satisfies Caja[]
).sort((a, b) => a.x + a.y + a.z - (b.x + b.y + b.z) || a.z - b.z);

const ROJO = { cara: "#e54730", sombra: "#cc3b26", tapa: "#f07a63" };
const LOGO = { cara: "#ffffff", sombra: "#e3e5ee", tapa: "#d04a46" };

export function PilaCfdi({ className }: { className?: string }) {
  const [pisoX, pisoY] = p(1.5, 1, 0);

  return (
    <svg viewBox="0 0 520 510" className={className} role="presentation">
      <ellipse cx={pisoX} cy={pisoY + 14} rx={230} ry={78} fill="#e5e8ec" opacity={0.7} />
      {CAJAS.map((c, i) => {
        const { x, y, z } = c;
        const color = c.logo ? LOGO : ROJO;
        const [ox, oy] = p(x, y + 1, z + 1);
        return (
          <g
            key={`${x}${y}${z}`}
            className={styles.caja}
            style={{ "--i": i } as React.CSSProperties}
          >
            <polygon
              points={puntos([[x, y, z + 1], [x + 1, y, z + 1], [x + 1, y + 1, z + 1], [x, y + 1, z + 1]])}
              fill={color.tapa}
              stroke="rgb(0 0 0 / 0.08)"
              strokeLinejoin="round"
            />
            <polygon
              points={puntos([[x, y + 1, z], [x + 1, y + 1, z], [x + 1, y + 1, z + 1], [x, y + 1, z + 1]])}
              fill={color.cara}
              stroke="rgb(0 0 0 / 0.08)"
              strokeLinejoin="round"
            />
            <polygon
              points={puntos([[x + 1, y, z], [x + 1, y + 1, z], [x + 1, y + 1, z + 1], [x + 1, y, z + 1]])}
              fill={color.sombra}
              stroke="rgb(0 0 0 / 0.08)"
              strokeLinejoin="round"
            />
            {c.etiqueta && (
              // La cara izquierda corre sobre el eje x: se inclina el texto
              // con la misma matriz para que quede "pintado" en la caja.
              <text
                transform={`matrix(${COS30},0.5,0,1,${ox},${oy})`}
                x={12}
                y={LADO * 0.58}
                fill="#ffffff"
                fontSize={15}
                fontWeight={800}
                style={{ fontFamily: "var(--font-geist-sans), sans-serif" }}
              >
                {c.etiqueta}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
