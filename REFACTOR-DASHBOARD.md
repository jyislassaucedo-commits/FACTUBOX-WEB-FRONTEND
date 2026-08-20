# Tablero de inicio

> **Para Claude Code:** este trabajo **ya viene aplicado** en el árbol. Verifícalo
> contra el backend real e intégralo. Comparte design system con `REFACTOR.md`,
> `REFACTOR-FACTURAS.md` y `REFACTOR-NUEVA-FACTURA.md`; aplícalos primero si
> todavía no lo has hecho.

Fecha: 2026-08-20 · Alcance: `factubox-web-frontend`

---

## 1. El hallazgo que motivó todo

`getReporteUsuarioV2.php` **ya devolvía mucho más de lo que la pantalla usaba**:

| Bloque de la respuesta | ¿Se usaba antes? | Ahora |
|---|---|---|
| `FacturasEjercicio` → `NumFacturas` | sí | sí |
| `FacturasEjercicio` → `TotalFacturas` (**el monto**) | **no** | sí — es el eje del tablero |
| `CanceladosEjercicio` | no | sí |
| `TotalUsadosEjercicio` / `TotalCanceladosEjercicio` (timbres) | no | sí |
| `FacturasPeriodo`, `FacturasDia`, `FacturasUltimo` | no | no (ver más abajo) |

El tablero anterior graficaba **cuántos PDFs generaste**, no **cuánto
facturaste**. El dato de dinero venía en la misma respuesta, sin leerse.

`FacturasPeriodo`, `FacturasDia` y `FacturasUltimo` siguen sin usarse porque
dependen de los rangos `FechaInicial` / `FechaFinal` / `FechaInicialDia`, que en
`reportes.ts` van fijos en un solo día. Se podrían activar pasando rangos reales;
por ahora la actividad reciente sale del detalle, que está acotado y ordenado.

---

## 2. Qué muestra el tablero

**Números principales** — facturado en el corte (con la variación contra el mismo
corte del año anterior), facturas emitidas, ticket promedio y % cancelado.

**Avisos accionables** — solo aparecen si aplican: comprobantes sin confirmar
ante el SAT (con enlace a validarlos en el listado) y concentración de ingreso
cuando un cliente pasa del 50%.

**Gráficas anuales** (del reporte agregado):
- Monto facturado por mes, año actual contra el anterior.
- Vigentes vs canceladas por mes.
- Distribución por tipo de comprobante.

**Bloques del mes** (del detalle):
- Tus clientes más grandes por monto.
- Actividad día por día.
- Forma de pago y método de pago (PUE vs PPD).
- Últimas facturas emitidas.

**Contexto** — timbres usados en timbrado y en cancelación, y reparto por emisor.

---

## 3. Estrategia de datos: híbrida

- Lo **anual** sale de `getReporteUsuarioV2` (dos llamadas: el año elegido y el
  anterior). Son consultas con `GROUP BY`: baratas.
- Lo que el agregado **no puede dar** (quién compra, cómo paga, qué estatus
  tiene cada CFDI) necesita el detalle, y ese se pide de **un solo mes** con
  `getFacturas()`: el mes filtrado, o el más reciente del año con actividad —
  que se deduce del agregado que ya se tiene, sin consulta extra.

La razón es la de siempre: `getFacturasV2.php` no pagina. Traer el detalle de un
año entero sería pesado sin ganar mucho.

En la UI esto está señalado: el bloque del mes lleva su propio encabezado
("Detalle de Ago 2026") y avisa que es el mes más reciente con actividad.

---

## 4. Filtros cruzados

Los filtros viven en la URL (`/?rfc=&anio=&mes=&tipo=`), no en estado de React:

- La vista es compartible y el botón Atrás funciona.
- **Clic en un mes** de la gráfica de montos → filtra todo el tablero por ese mes.
- **Clic en un tipo** en la dona → filtra por ese tipo.
- **Clic en un emisor** en el reparto → filtra por ese emisor.
- Volver a hacer clic en el mismo elemento quita el filtro.

Al refiltrar, el render anterior se sostiene atenuado (`useTransition`): no hay
salto de layout ni parpadeo de esqueleto.

---

## 5. Decisiones de visualización

Se siguió el método de la skill `dataviz` (formas por el trabajo del dato, color
al final, validación ejecutada). Lo que conviene no deshacer:

**La paleta ya estaba validada.** `--series-1..5` en `globals.css` son los cinco
primeros tonos de la paleta de referencia. Se corrió el validador:

```
node scripts/validate_palette.js "#2a78d6,#eb6834,#1baf7a,#eda100,#e87ba4" --mode light
→ ALL CHECKS PASS, con un WARN de contraste
```

El WARN obliga a "relieve": tres tonos quedan bajo 3:1 sobre fondo claro, así que
**cada gráfica tiene su interruptor Gráfica / Tabla**. Esa vista de tabla no es un
adorno: cubre el WARN y el requisito de accesibilidad. Si quitas el interruptor,
la paleta deja de cumplir.

**Nada de doble eje.** Monto y conteo nunca comparten plano: son gráficas
distintas o el conteo va al tooltip.

**El color sigue a la entidad, no a su tamaño.** El tipo de comprobante usa
`TIPO_COLOR` en orden fijo del catálogo; filtrar no repinta a los que quedan. El
top de clientes es **una sola serie con un solo color** — nada de rampa
más-oscuro-donde-más-grande, que sería doble codificación.

**Vigente / Cancelado usan los tokens de estado** (`--ok`, `--danger`), no la
paleta categórica: ahí el color sí significa bien/mal. Ambos van con leyenda.

**Una categoría no es una gráfica de barras.** Si "forma de pago" trae un solo
valor, se muestra como dato, no como una barra sola.

**El alto de cada tarjeta incluye la banda del eje**, y la leyenda se dibuja
fuera de la caja de alto fijo — si se mete dentro, queda recortada.

---

## 6. Inventario de archivos

### Nuevos
```
src/lib/dashboardCalculos.ts                    agregaciones puras
src/components/dashboard/ChartCard.tsx          tarjeta + vista de tabla + tooltip + leyenda
src/components/dashboard/DashboardCharts.tsx    las gráficas
src/components/dashboard/DashboardView.tsx      orquestador: filtros, KPIs, avisos
```

### Modificados
```
src/lib/reportes.ts          + canceladas, timbres, año anterior y detalle del mes
src/app/(app)/page.tsx       cliente → Server Component con filtros en la URL
src/app/globals.css          + regla del anillo de foco de Recharts
```

### Quedan huérfanos — bórralos tú tras verificar con grep
```
src/components/dashboard/FilterBar.tsx
src/components/dashboard/StatTile.tsx
src/components/dashboard/MonthlyBarChart.tsx
src/components/dashboard/TipoPieChart.tsx
src/components/dashboard/EmisorBarChart.tsx
src/app/api/dashboard/route.ts      (la página ya no lo consume; sigue compilando)
```

---

## 7. Qué debes verificar

1. `npm run build` y `npx eslint src` — pasaron aquí.
2. Borra los huérfanos de la sección 6 tras confirmar con
   `grep -rn "FilterBar\|StatTile\|MonthlyBarChart\|TipoPieChart\|EmisorBarChart" src/`.
3. Con datos reales, **cuadra el monto**: lo que dice "Facturado en el año" debe
   coincidir con la suma de `TotalFacturas` del reporte. Si no cuadra, el
   problema está en que `TotalFacturas` del backend puede venir con las
   canceladas incluidas — revísalo contra el listado de facturas.
4. Comprueba que **vigentes = emitidas − canceladas** en la gráfica de estatus.
   Ese cálculo asume que `CanceladosEjercicio` es un subconjunto de
   `FacturasEjercicio`; si el backend ya las excluyera, el número saldría bajo.
5. Prueba los filtros cruzados: clic en un mes, en un tipo y en un emisor; y que
   "Limpiar filtros" los quite.
6. Con un año sin datos, el tablero debe verse vacío sin romperse.
7. Commit sugerido:
   `feat(dashboard): tablero con monto facturado, salud fiscal, clientes y filtros cruzados`

---

## 8. Pendientes y siguientes ideas

- **Timbres disponibles**: `DAO_USUARIO_TIMBRE` tiene el saldo, pero no hay
  endpoint que lo exponga. Con uno, el aviso "te quedan N timbres" sería de lo
  más útil del tablero.
- **Detalle de más de un mes**: hoy los bloques de clientes y formas de pago son
  de un mes. Con paginación en `searchFacturas()` podrían cubrir todo el rango.
- **Clientes nuevos vs recurrentes**: necesita comparar contra meses anteriores,
  o sea más detalle del que se trae hoy.
- **CFDI de pago pendientes**: se sabe cuántas PPD hay, pero no cuáles ya tienen
  su complemento. Cruzarlo requeriría leer los complementos de las de tipo P.
- **Modo oscuro**: los tokens `--chart-*` ya tienen valores oscuros, pero la
  paleta de series necesitaría re-validarse contra la superficie oscura antes de
  activarlo (ver `REFACTOR.md`).
