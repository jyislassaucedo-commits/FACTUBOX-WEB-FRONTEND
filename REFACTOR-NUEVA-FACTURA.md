# Nueva factura: asistente por pasos + Egreso

> **Para Claude Code:** este trabajo **ya viene aplicado** en el árbol. Tu tarea
> es verificarlo contra el backend real e integrarlo. Va aparte de
> `REFACTOR.md` (pantalla de Emisor) y `REFACTOR-FACTURAS.md` (listado); los
> tres comparten el design system, así que aplica primero los anteriores si
> todavía no lo has hecho.

Fecha: 2026-08-20 · Alcance: `factubox-web-frontend`

---

## 1. Qué cambia

`/facturas/nueva` era un formulario largo de un solo tirón que solo sabía emitir
comprobantes de **Ingreso** a público en general. Ahora es un asistente de cinco
pasos que además emite **Egreso** (nota de crédito):

1. **Tipo** — tarjetas con Ingreso y Egreso activos; Pago, Nómina y Traslado
   visibles pero deshabilitados, con el motivo de por qué todavía no se pueden.
2. **Emisor** — emisor, serie (filtrada por el tipo elegido), folio calculado,
   forma y método de pago. Si el tipo es Egreso, aquí aparece además el bloque
   de CFDI relacionados.
3. **Receptor** — cliente y uso del CFDI, con vista previa de los datos fiscales
   que van a viajar en el comprobante.
4. **Conceptos** — con IVA por concepto e IEPS/retención opcionales.
5. **Revisión** — el comprobante armado, y la lista de lo que falta con un botón
   para saltar directo al paso que lo tiene.

**Validación en vivo:** el indicador de pasos y el panel lateral "Lo que falta"
se recalculan en cada tecla. Los errores en rojo junto a cada campo solo
aparecen una vez que el usuario ya pasó por ese paso — no tiene sentido regañar
por datos que todavía no se le han pedido.

---

## 2. Inventario de archivos

### Nuevos

```
src/lib/facturaNueva.ts                              estado, catálogos y validación pura
src/components/facturas/NuevaFacturaWizard.tsx       orquestador: estado, carga, navegación
src/components/facturas/PasosNuevaFactura.tsx        los 5 pasos + pantalla de resultado
src/components/facturas/ConceptoEditor.tsx           captura de un concepto (reemplaza ConceptoRow)
src/components/facturas/RelacionarFacturaModal.tsx   elegir el CFDI que corrige la nota
src/app/api/facturas/buscar/route.ts                 búsqueda de facturas desde el cliente
```

### Modificados

```
src/lib/timbrado.ts                       + tipoDeComprobante y cfdiRelacionados
src/app/api/facturas/route.ts             valida el tipo y exige relación en Egreso
src/app/(app)/facturas/nueva/page.tsx     ahora es Server Component + monta el asistente
src/components/ui/index.tsx               + <Stepper> y <FieldError>
```

### Queda huérfano

`src/components/facturas/ConceptoRow.tsx` ya no lo importa nadie: lo sustituyó
`ConceptoEditor.tsx`. **Bórralo tú** después de confirmar con `grep -r ConceptoRow src/`
que no queda ninguna referencia.

---

## 3. Cambios en la capa de timbrado

`timbrado.ts` mandaba `TipoDeComprobante: "I"` fijo. Ahora viene del input, y se
agregó `cfdiRelacionados`.

Tres cosas que verifiqué en el PHP antes de escribirlo, y que conviene no
"corregir" sin volver a revisarlas:

**`CfdiRelacionados` tiene que ser un ARREGLO.** `JSON_CFDI40::leerJson()` lo
pasa por `arrayNodoDinamico()`, que solo actúa si el valor es array. La forma
correcta es:

```json
"CfdiRelacionados": [
  { "TipoRelacion": "01", "CfdiRelacionado": [ { "UUID": "..." } ] }
]
```

**El orden del nodo en el XML no depende del orden del JSON.** `xmlCfdi()`
recorre las propiedades de la clase `CFDI40` (`endpoint/lib/CFDI40.php`), que ya
las declara en el orden que exige el schema: `InformacionGlobal`,
`CfdiRelacionados`, `Emisor`, `Receptor`. Por eso el nodo cae en su lugar solo.

**`InformacionGlobal` y el domicilio del receptor genérico son reglas
distintas.** Antes estaban colapsadas en una sola bandera `esPublicoGeneral`.
Al separar Egreso salió el bug: una nota de crédito a público en general dejaba
`DomicilioFiscalReceptor` vacío y el SAT rechaza el CFDI sin ese atributo. Ahora:

- `esRfcGenerico` → `DomicilioFiscalReceptor` = CP del emisor. **Siempre**, sea
  Ingreso o Egreso.
- `llevaInformacionGlobal` = `esRfcGenerico && tipo === "I"`. Solo la factura
  global de ingreso lleva ese nodo.

---

## 4. Reglas de negocio que quedaron codificadas

- **La serie se filtra por tipo.** Un Egreso solo puede usar series `E`. Si el
  emisor no tiene ninguna, el paso lo dice y enlaza a crearla.
- **El Egreso exige al menos un CFDI relacionado**, tanto en la UI como en la
  ruta API. Se puede capturar de dos formas: eligiéndolo del listado de facturas
  timbradas, o pegando el folio fiscal a mano (para facturas viejas, de otro
  sistema, o fuera del rango consultado).
- **Al elegir Egreso se sugiere el uso `G02`** (devoluciones, descuentos o
  bonificaciones) y se avisa si el usuario lo cambia.
- **Un emisor sin CSD bloquea el paso** con enlace directo a subirlo.
- **Un receptor sin régimen fiscal o sin CP bloquea el paso**, con enlace a
  editarlo.
- **La serie se autoselecciona solo si hay exactamente una** del tipo elegido.

---

## 5. Qué debes hacer (Claude Code)

1. `npm run build` y `npx eslint src` — ambos pasaron aquí.
2. Borra `src/components/facturas/ConceptoRow.tsx` tras verificar con grep.
3. `npm run dev` y recorre el asistente con datos reales:
   - Un **Ingreso** a público en general y otro a un receptor real.
   - Un **Egreso**, relacionando la factura de las dos maneras (del listado y
     pegando el UUID).
4. **Antes de timbrar de verdad, revisa el XML generado.** Lo más frágil de todo
   esto es el nodo `CfdiRelacionados`: aquí se validó contra el generador PHP
   leyendo el código, pero **no contra el PAC**. Timbra el primer Egreso con
   `MODO_TIMBRADO=PRUEBAS` y confirma que el XML trae:
   ```xml
   <cfdi:CfdiRelacionados TipoRelacion="01">
     <cfdi:CfdiRelacionado UUID="..."/>
   </cfdi:CfdiRelacionados>
   ```
   entre `cfdi:Comprobante` y `cfdi:Emisor`. Si el PAC lo rechaza, el problema
   está en la forma del JSON, no en la UI: se ajusta solo en `buildDatosJSON()`
   dentro de `src/lib/timbrado.ts`.
5. Verifica también que un Ingreso a público en general **siga llevando**
   `InformacionGlobal` (es la regresión más probable de este cambio).
6. Commit sugerido:
   `feat(facturas): asistente por pasos para nueva factura con soporte de egreso`

---

## 6. Pendientes conocidos

- **Pago, Nómina y Traslado**: las tarjetas ya están, deshabilitadas. Cada una
  necesita su complemento (`Pagos20`, `Nomina12`, carta porte) — el generador
  PHP los soporta, falta armar el JSON y la UI.
- **Descuentos por concepto**: `buildDatosJSON` manda `Descuento: "0.00"` fijo.
- **Moneda**: hardcodeada a MXN con `TipoCambio: "1"`.
- **Borrador persistente**: si el usuario recarga a media captura, pierde todo.
  El estado ya está aislado en un solo objeto (`FacturaBorrador`), así que
  guardarlo sería directo.
- **`validar()` es una función pura** y podría reutilizarse en la ruta API para
  que servidor y cliente validen exactamente lo mismo; hoy la ruta solo revisa
  lo mínimo.
