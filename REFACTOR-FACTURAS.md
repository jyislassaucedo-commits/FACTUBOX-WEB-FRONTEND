# Listado de facturas

> **Para Claude Code:** este documento describe trabajo que **ya viene aplicado**
> en el árbol. Tu tarea es verificarlo contra el backend real e integrarlo, no
> reescribirlo. Va aparte de `REFACTOR.md` (el refactor de la pantalla de
> Emisor) porque son dos cambios independientes; ambos usan el mismo design
> system, así que aplica `REFACTOR.md` primero si todavía no lo has hecho.

Fecha: 2026-08-20 · Alcance: `factubox-web-frontend`

---

## 1. Qué había y qué hay ahora

`/facturas` era un placeholder ("El listado de facturas emitidas llega en una
próxima fase"). Resulta que el backend **ya tenía todo lo necesario** y solo
faltaba el frontend:

| Necesidad | Endpoint PHP que ya existía |
|---|---|
| Listar con filtros | `/maa/mvc/Factura/api/getFacturasV2.php` |
| XML timbrado de una factura | `/maa/mvc/Factura/api/getFacturaTimbV2.php` |
| Cancelar ante el SAT | `/endpoint/apiCancelacionV2.php` |
| PDF | **no existe** — ver sección 5 |

La pantalla ahora tiene: tira de KPIs del periodo, filtros de servidor (rango de
fechas con presets, emisor, tipo de comprobante, estatus SAT), búsqueda y orden
locales, tabla con acciones por fila, panel de detalle construido a partir del
XML, y modal de cancelación.

---

## 2. Inventario de archivos

### Nuevos

```
src/lib/facturas.ts                                capa de datos (servidor)
src/lib/facturasShared.ts                          tipos + catálogo de motivos (cliente-safe)
src/lib/cfdi.ts                                    parser de CFDI 4.0 + formatos (navegador)
src/components/facturas/FacturasSection.tsx        listado, filtros, KPIs, acciones
src/components/facturas/FacturaDetalle.tsx         panel lateral con el CFDI desglosado
src/components/facturas/CancelarFacturaModal.tsx   cancelación ante el SAT
src/app/api/facturas/[uuid]/xml/route.ts           XML por UUID
src/app/api/facturas/[uuid]/cancelar/route.ts      cancelación
src/app/api/facturas/[uuid]/pdf/route.ts           PDF (stub, responde 501)
```

### Modificados

```
src/app/(app)/facturas/page.tsx                    placeholder → listado real
src/components/ui/index.tsx                        + <Drawer> y <CopyButton>
```

Nada más se tocó. `src/app/api/facturas/route.ts` (timbrado) y
`src/app/(app)/facturas/nueva/page.tsx` quedaron igual.

---

## 3. Decisiones y trampas del backend

**No hay paginación ni `LIMIT`.** `searchFacturas()` devuelve todo lo que caiga
en el rango de fechas. Por eso los filtros de servidor viven en la URL
(`/facturas?desde=&hasta=&emisor=&tipo=&estatus=`) y el rango por defecto es el
**mes en curso**. La búsqueda de texto y el orden son locales, sobre lo ya
cargado: no vuelven a pegarle al PHP.

**El rango filtra por `fechareg`, no por `fechaemision`.** Para CFDI timbrados en
línea es casi lo mismo; dejaría de serlo si alguna vez se importan facturas
viejas. Está anotado en `src/lib/facturas.ts`.

**`UseXml` debe ir en `"NO"`.** Con `"SI"` el endpoint adjunta el XML completo de
cada factura y la respuesta pasa de kilobytes a megabytes.

**Cancelación: se usa `apiCancelacionV2.php`, no `setEstatusFacturaV2.php`.** El
segundo solo cambia la columna `estatussat` en la base local sin avisarle al
SAT — sería mentirle al usuario. El bueno consume un timbre de cancelación y
exige que el emisor tenga CSD cargado. `ModoTimbrado` sale de la env
`MODO_TIMBRADO` (default `PRUEBAS`), igual que en `timbrado.ts`.

**`cfdi.ts` usa `DOMParser`: solo corre en el navegador.** No lo importes desde
un Server Component. Busca los nodos por `localName` en vez de por `cfdi:` /
`tfd:` porque el prefijo del namespace lo elige quien genera el XML.

**`facturasShared.ts` existe por la misma razón que `configPdfShared.ts`.** El
modal de cancelación necesita el catálogo `MOTIVOS_CANCELACION`; si lo importara
de `facturas.ts` arrastraría `session.ts` → `next/headers` al bundle del cliente
y el build truena con *"You're importing a module that depends on next/headers"*.

---

## 4. Lo que ve el usuario

- **Fila** → clic abre el panel de detalle.
- **Acciones al pasar el mouse** (o con teclado): copiar UUID, XML, PDF, Cancelar CFDI.
- **Panel de detalle**: totales, emisor y receptor con los catálogos SAT
  resueltos a texto, conceptos con sus impuestos, datos del comprobante y timbre
  fiscal (UUID, certificados y sellos, con "ver completo" porque son cadenas de
  ~340 caracteres). Todo sale del XML; si el XML no carga, cae al resumen de la
  base y lo dice.
- **Cancelación**: pide motivo (catálogo `c_MotivoCancelacion`), exige el UUID
  sustituto cuando el motivo es `01`, y obliga a escribir el folio de la factura
  para confirmar.
- Las facturas canceladas salen con el total tachado y pill roja.

---

## 5. PDF: pendiente a propósito

No hay endpoint que genere el PDF de una factura ya timbrada. Lo que hay es la
tubería completa, lista para cuando exista:

```
botón "PDF" / "Generar PDF"
  → GET /api/facturas/[uuid]/pdf        (src/app/api/facturas/[uuid]/pdf/route.ts)
    → getFacturaPdf(uuid)               (src/lib/facturas.ts)  ← rellenar SOLO esto
```

Hoy `getFacturaPdf` devuelve `Error: "1"` con el motivo, la ruta responde 501 y
la UI muestra ese mensaje en un toast. Cuando el backend lo tenga, basta con
implementar el cuerpo de `getFacturaPdf` (probablemente pasándole el UUID y el
`IdConfigPdf` que ya trae cada factura, y recibiendo el PDF en base64): ni la
ruta ni la UI cambian.

---

## 6. Qué debes hacer (Claude Code)

1. `npm run build` y `npx eslint src` — ambos pasaron aquí con Next 16.3.1 /
   React 19.2.8 / Tailwind 4.
2. `npm run dev` y abre `/facturas` con datos reales. Comprueba que los KPIs
   cuadren con la tabla y que los presets de rango recarguen la consulta.
3. Prueba **descargar XML** de una factura real: el archivo debe abrir como CFDI
   válido y el panel de detalle debe mostrar los mismos importes que la tabla.
4. Verifica los catálogos: forma de pago, método de pago, uso de CFDI y régimen
   deben salir como texto, no como clave.
5. **La cancelación toca producción.** Pruébala primero con `MODO_TIMBRADO=PRUEBAS`
   y una factura de prueba. Confirma que después de cancelar, `router.refresh()`
   trae la fila ya con estatus `Cancelado`.
6. Commit sugerido:
   `feat(facturas): listado con filtros, detalle desde el XML y cancelación ante el SAT`

---

## 7. Pendientes conocidos

- **PDF** (sección 5).
- **Paginación**: si un usuario factura miles al mes, el rango deja de bastar.
  Lo correcto sería agregar `LIMIT`/`OFFSET` y un `ORDER BY F.fechareg DESC` a
  `searchFacturas()` — hoy no tiene ninguno de los dos y el orden lo pone el
  frontend.
- ~~**Consultar estatus en el SAT**~~ — hecho, ver la actualización al final de
  este documento.
- **Cancelación masiva**: `apiCancelacionV2.php` acepta un arreglo `UUIDS`; hoy
  se le manda uno solo. Con selección múltiple en la tabla saldría casi gratis.
- **Descargar el acuse de cancelación**: la respuesta del endpoint lo trae; hoy
  se ignora.
- **Facturas con error**: existe `getFacturasError.php` (intentos de timbrado
  fallidos) y no hay pantalla para eso.

---

# Actualización · Validación de estatus ante el SAT

Fecha: 2026-08-20. Este bloque describe un segundo cambio sobre la misma
pantalla, también **ya aplicado** en el árbol.

## Qué cambia

1. **Se quitó la leyenda** del pie de la tabla ("El rango de fechas es lo que
   acota la consulta…"). El pie ahora solo muestra el conteo y, cuando hay
   selección, un enlace para quitarla.
2. **Validación del estatus real ante el SAT**, en tres alcances:
   - **Todo lo que está en pantalla**: botón "Validar las N en el SAT".
   - **Una selección**: columna de casillas en la tabla (con "seleccionar todo"
     en el encabezado). Con algo marcado, el botón cambia a "Validar N en el SAT".
   - **Una sola factura**: botón "Validar en el SAT" en el panel de detalle, que
     además muestra `EsCancelable`, `EstatusCancelacion` y `CodigoEstatus`.

## Por qué hacía falta

`estatussat` se escribe **una sola vez**, al timbrar, con lo que el SAT
respondiera en ese instante. Si la propagación del SAT venía retrasada, la
factura se queda marcada como `No Encontrado` para siempre aunque hoy esté
vigente. Ahora se puede resincronizar.

## Archivos

### Nuevos
```
src/lib/estatusSat.ts                       consulta por tandas + resumen (cliente)
src/app/api/facturas/estatus/route.ts       lote de consultas al SAT
```

### Modificados
```
src/lib/facturas.ts                         + consultarEstatusSat()
src/components/facturas/FacturasSection.tsx selección, botón, barra de avance, sin leyenda
src/components/facturas/FacturaDetalle.tsx  + botón individual y panel de respuesta
```

## Notas del backend

**`apiEstatusV2.php` ya persiste el resultado.** Internamente llama a
`editEstatusTimbrado()`, que escribe `Estado` en la columna `estatussat`. Por eso
**no** se usa `setEstatusFacturaV2.php` — sería escribir dos veces lo mismo. Tras
cada corrida se llama `router.refresh()` para quedar en sincronía con lo guardado.

**Firma la consulta con el CSD del emisor**, así que un emisor sin certificado no
puede validar nada; el resultado sale como error en esa fila.

**El `TotalCfdi` va con dos decimales.** El SAT compara el total contra el del
comprobante: mandarlo sin formato hace que responda "No Encontrado" aunque la
factura exista.

## Sobre el ritmo de las consultas

Cada validación es una llamada SOAP al SAT de aproximadamente un segundo, y se
procesan **en serie** dentro de la ruta. Por eso:

- La ruta acepta un máximo de **8 facturas por llamada** (`MAX_POR_TANDA`).
- El cliente (`src/lib/estatusSat.ts`) parte la lista en tandas de ese tamaño y
  va reportando el avance con una barra de progreso.
- Si cambias el tope, cámbialo en **los dos lados**: la constante `TANDA` del
  cliente debe coincidir con `MAX_POR_TANDA` de la ruta.

Validar 200 facturas tomará unos minutos. Es una limitación del SAT, no del
código; si llega a estorbar, lo correcto sería moverlo a un job en segundo plano.

## Qué debes verificar

1. `npm run build` y `npx eslint src` — pasaron aquí.
2. Con facturas reales, valida **una sola** desde el detalle y confirma que el
   `Estado` que devuelve el SAT coincide con lo que ves en el portal del SAT.
3. Valida **una selección** y confirma que el estatus queda guardado: recarga la
   página y debe seguir con el valor nuevo (lo persiste el PHP, no el frontend).
4. Prueba con un emisor **sin CSD**: la fila debe reportar el error, no romper
   la corrida completa.
5. Mide cuánto tarda una tanda contra tu PAC/SAT real. Si una tanda de 8 se
   acerca al timeout de tu servidor, baja `MAX_POR_TANDA` y `TANDA` a 4.
