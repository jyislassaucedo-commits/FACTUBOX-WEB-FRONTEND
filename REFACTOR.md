# Refactor: pantalla de Emisor → secciones navegables + design system

> **Para Claude Code:** este documento describe un refactor que **ya viene aplicado**
> en el árbol de trabajo. Tu trabajo no es escribirlo desde cero, sino
> **verificarlo, integrarlo y limpiar lo que quedó huérfano**. Sigue la sección
> "Qué debes hacer" al final. No borres archivos que no estén listados aquí.

Fecha: 2026-08-20 · Alcance: `factubox-web-frontend`

---

## 1. Qué problema resuelve

`/emisores/[rfc]` era una sola página con cinco bloques apilados (datos generales,
CSD, series, receptores, diseños PDF), cada uno con su propio `useEffect` +
`fetch` + estado de "Cargando…". Mucha información en un solo lugar, cinco
round-trips en cascada al abrir, y sin forma de llegar directo a "Receptores".

Ahora:

- Cada bloque es **su propia ruta** bajo `/emisores/[rfc]/…`.
- Al entrar a un emisor, el **menú lateral se vuelve contextual**: deja de ser el
  nav global y pasa a ser el de ese emisor (Resumen · Datos generales ·
  Certificado / Series · Receptores · Diseños PDF), con contadores y puntos de
  alerta.
- El item **"Emisores" de la barra superior es un dropdown** que salta directo a
  cualquier sección del emisor abierto.
- Los datos se cargan **en el servidor, una sola vez por navegación**
  (`loadEmisorContext`, memoizado con `cache()` de React). Ya no hay
  "Cargando…" al entrar a cada sección.
- Se agregó una pantalla **Resumen** con checklist de configuración e "higiene de
  catálogos" (detecta series con tipo inválido, receptores sin RFC, duplicados).

---

## 2. Rutas

| Ruta | Archivo | Contenido |
|---|---|---|
| `/emisores/[rfc]` | `src/app/(app)/emisores/[rfc]/page.tsx` | Resumen (nuevo) |
| `/emisores/[rfc]/datos` | `…/datos/page.tsx` | Datos generales |
| `/emisores/[rfc]/csd` | `…/csd/page.tsx` | Certificado de sello digital |
| `/emisores/[rfc]/series` | `…/series/page.tsx` | Series y folios |
| `/emisores/[rfc]/receptores` | `…/receptores/page.tsx` | Receptores |
| `/emisores/[rfc]/disenos` | `…/disenos/page.tsx` | Diseños del PDF |

`src/app/(app)/emisores/[rfc]/layout.tsx` envuelve las seis: carga el contexto,
pinta el hero del emisor + el sidebar contextual y renderiza `children`.

**Ojo:** `/emisores/[rfc]` cambió de significado (antes era el formulario
completo, ahora es el resumen). Cualquier enlace externo sigue funcionando —
aterriza en el resumen, desde donde se llega a todo.

---

## 3. Inventario de archivos

### Nuevos

```
src/components/ui/index.tsx                       primitivas de UI ("use client")
src/components/ui/styles.ts                       helpers de clase SIN "use client"
src/lib/emisorNav.ts                              secciones del emisor + helpers de formato
src/lib/emisorData.ts                             loadEmisorContext() memoizado
src/components/emisores/EmisorHero.tsx            encabezado del emisor + KPIs
src/components/emisores/EmisorNav.tsx             sidebar contextual
src/components/emisores/DatosGeneralesSection.tsx wrapper cliente de EmisorForm
src/app/(app)/emisores/[rfc]/layout.tsx
src/app/(app)/emisores/[rfc]/datos/page.tsx
src/app/(app)/emisores/[rfc]/csd/page.tsx
src/app/(app)/emisores/[rfc]/series/page.tsx
src/app/(app)/emisores/[rfc]/receptores/page.tsx
src/app/(app)/emisores/[rfc]/disenos/page.tsx
```

### Modificados

```
src/app/globals.css                               design tokens + tema oscuro opt-in
src/components/AppShell.tsx                       nav en la barra superior + dropdown Emisores
src/components/LogoutButton.tsx                   usa <Button>
src/app/(app)/emisores/page.tsx                   lista con búsqueda y badges
src/app/(app)/emisores/[rfc]/page.tsx             ahora es el Resumen
src/app/(app)/emisores/nuevo/page.tsx             envuelto en Card
src/components/emisores/EmisorForm.tsx            + barra de "cambios sin guardar", dropzone de logo
src/components/emisores/CsdSection.tsx            + props de datos del servidor, barra de vigencia
src/components/emisores/SeriesSection.tsx         + búsqueda, filtros, modal, borrado en 2 pasos
src/components/emisores/ConfigPdfSection.tsx      + grid con miniatura del PDF
src/components/receptores/ReceptoresSection.tsx   + búsqueda, filtro por uso CFDI, avatares
```

### Sin tocar (a propósito)

- `src/lib/*` (emisores, series, receptores, configPdf, phpApi, session, timbrado…):
  **la capa de datos no cambió**. Ningún contrato con el backend PHP se movió.
- `src/app/api/**`: las rutas siguen igual. Las secciones las usan para **mutar**
  (POST/DELETE); los GET quedaron sin consumidor dentro de la pantalla del
  emisor pero **no se borran** (los usa la lista de emisores y son útiles para
  depurar).
- `src/components/emisores/ConfigPdfEditor.tsx`, `PdfPreview.tsx`,
  `src/components/receptores/ReceptorFormModal.tsx`: siguen igual. Funcionan,
  pero todavía traen clases `neutral-*` a mano (ver "Pendientes").
- `src/app/(app)/page.tsx` (dashboard), `src/app/(app)/facturas/**`,
  `src/app/login/page.tsx`, `src/components/dashboard/**`: fuera de alcance.

---

## 4. Reglas del design system

`src/app/globals.css` define los tokens y los expone como utilidades de
Tailwind v4 vía `@theme inline`.

| En vez de | Usa |
|---|---|
| `bg-white` | `bg-surface` |
| `bg-neutral-50` | `bg-bg` o `bg-surface-2` |
| `border-neutral-200` | `border-line` (o `border-line-2` para separadores internos) |
| `text-neutral-900` | `text-ink` |
| `text-neutral-600/700` | `text-ink-2` |
| `text-neutral-500` | `text-ink-3` |
| `bg-[var(--brand)]` | `bg-brand` |
| `text-green-700` + `bg-green-50` | `text-ok` + `bg-ok-bg` |
| `text-red-600` + `bg-red-50` | `text-danger` + `bg-danger-bg` |

Estados disponibles como par color/fondo: `ok`, `warn`, `danger`, `info`,
`violet`, `teal`. Extras: `rounded-card`, `shadow-card`, `shadow-raised`,
`shadow-pop`, y la utilidad `focus-brand` para el anillo de foco.

**Ningún componente nuevo debe escribir un color crudo de Tailwind.** Si falta un
token, agrégalo a `globals.css` en `:root`, en `[data-theme="dark"]` y en
`@theme inline` — los tres.

### Trampa importante: `cx()` y `buttonClass()`

`src/components/ui/index.tsx` lleva `"use client"`. Un Server Component **puede
renderizar** sus componentes, pero **no puede invocar** una función exportada
desde él (error en runtime: *"Attempted to call cx() from the server"*).

Por eso los helpers viven en `src/components/ui/styles.ts`, sin directiva:

```ts
// Server Component
import { Card, CardBody } from "@/components/ui";          // componentes: OK
import { buttonClass, cx } from "@/components/ui/styles";   // funciones: desde styles

// Client Component
import { Button, Card, cx, buttonClass } from "@/components/ui"; // todo desde el index
```

---

## 5. Flujo de datos

```
layout.tsx (server)  ─┐
                      ├─> loadEmisorContext(rfc)  ──> getEmisor / getSeries /
page.tsx  (server)   ─┘        [cache() de React]      getReceptores / getConfigPdfs /
                                                        existeCsd   (Promise.all)
        │
        └─> props ──> <SeriesSection series={…} />  (client)
                            │
                            ├─ mutación: fetch a /api/empresas/[rfc]/series (POST|DELETE)
                            └─ luego: router.refresh()  → re-ejecuta el layout y la page
```

- `cache()` dedupe **dentro de un mismo render**: layout y page comparten una sola
  tanda de llamadas al PHP. No persiste entre requests, así que `router.refresh()`
  siempre trae datos frescos.
- Las secciones **no guardan la lista en `useState`**: la reciben por props. Después
  de mutar, `router.refresh()` es la única fuente de verdad. No reintroduzcas
  estado local espejo.

---

## 6. Detalles de comportamiento que hay que preservar

1. **`setEmpresaV2` sobrescribe, no hace merge.** Por eso `CsdSection` recibe
   `regimen` y `lugarExp` como props: cuando el usuario acepta la razón social
   sugerida por el certificado, se reenvían tal cual. Si algún día se manda ese
   POST sin esos campos, se borran en la base.
2. **La verdad sobre el CSD es `existeCSDV2`**, no `VigenciaCert` (el backend pone
   una fecha placeholder al crear el emisor aunque no haya certificado). Eso ya
   está resuelto en `loadEmisorContext`.
3. **El trim del RFC del certificado** en `CsdSection` (validarCSDV2 no recorta,
   uploadCertificadoEmpresaV2 sí) se conservó tal cual.
4. **Tipos de serie del SAT: I, E, N, P, T.** Los datos reales traen basura
   heredada (`"0"`, `"R"`). `tipoSerie()` en `emisorNav.ts` los marca como
   inválidos en vez de romper. No los "normalices" en silencio.
5. **`EmisorForm` sigue sirviendo a `/emisores/nuevo`**: con `rfcEditable` muestra
   un botón normal; en edición muestra la barra flotante de "cambios sin
   guardar". No unifiques los dos modos sin revisar ambas pantallas.
6. **Borrado en dos pasos** (`ConfirmButton`): primer clic arma, segundo ejecuta,
   se desarma solo a los 4 s. Aplica a series, receptores y diseños.

---

## 7. Qué debes hacer (Claude Code)

En orden:

1. `npm run build` — debe pasar. Ya pasó aquí con Next 16.3.1 / React 19.2.8 /
   Tailwind 4.
2. `npx eslint src` — debe salir limpio. Ojo con la regla
   `react-hooks/set-state-in-effect` de esta versión: no metas `setState`
   síncrono dentro de un `useEffect`.
3. `npm run dev` y recorre a mano, con un emisor real:
   `/emisores` → `/emisores/<rfc>` → cada una de las cinco secciones.
   Verifica que los contadores del sidebar y los KPIs del hero cuadren con las
   tablas.
4. Prueba las mutaciones de punta a punta contra el PHP real: agregar y borrar
   una serie, agregar y borrar un receptor, guardar datos generales, crear y
   borrar un diseño. Cada una debe actualizar la pantalla **sin recargar**
   (via `router.refresh()`).
5. Confirma que el flujo del CSD sigue intacto: subir un certificado que **no**
   sea de ese RFC debe dar el mensaje de "pertenece a otro RFC" y no persistir.
6. `git add -A && git diff --cached --stat` para ver el alcance real antes de
   commitear. Sugerencia de commit:
   `refactor(emisores): dividir la pantalla del emisor en secciones y agregar design system`

Si algo no compila o una sección se ve rota, **arregla el archivo puntual**; no
revierta el refactor completo.

---

## 8. Pendientes conocidos (no bloquean)

- **Tema oscuro**: los tokens ya existen bajo `[data-theme="dark"]`, pero está
  desactivado a propósito. Para activarlo hay que migrar primero dashboard,
  facturas y login a tokens (hoy tienen `bg-white` / `text-neutral-*` a mano);
  si no, en oscuro se ven texto claro sobre fondo claro. Cuando estén migrados:
  poner `data-theme="dark"` en el `<html>` de `src/app/layout.tsx` (con un
  script inline anti-parpadeo si se quiere recordar la preferencia).
- **Próximo folio real**: hoy la tabla muestra el folio inicial. `getUltimoFolio()`
  ya existe en `src/lib/series.ts`; falta llamarlo por serie (en paralelo, desde
  el server component) para mostrar "siguiente folio = max(último+1, inicio)".
- **Diseño PDF predeterminado**: el backend no tiene el concepto. Si se agrega
  (`ConfigPDF.EsDefault` o similar), la UI ya tiene lugar para la estrella.
- **Editar serie**: `editSerie()` existe en `src/lib/series.ts` pero no hay ruta
  API ni UI. Sería la forma limpia de arreglar las series con tipo inválido sin
  borrarlas.
- **`ConfigPdfEditor`, `PdfPreview` y `ReceptorFormModal`** siguen con clases
  `neutral-*`. Migrarlos a tokens es mecánico (tabla de la sección 4).
- **Contadores de facturas por receptor / por serie**: no hay endpoint hoy;
  serían buenas columnas.
