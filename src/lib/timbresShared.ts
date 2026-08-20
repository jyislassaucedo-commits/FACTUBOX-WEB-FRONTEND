/**
 * Tipos y constantes de timbres que también usan los componentes de cliente.
 *
 * Van aparte de `timbres.ts` porque ese módulo importa `session.ts`, que a su
 * vez usa `next/headers`: si un componente `"use client"` importara de ahí —
 * aunque solo fuera el tipo — el bundler arrastraría `next/headers` al paquete
 * del navegador y la compilación falla. Mismo patrón que `facturasShared.ts` y
 * `configPdfShared.ts`.
 */

export type Timbres = {
  disponibles: number;
  utilizados: number;
  cancelados: number;
};

/**
 * Umbral para avisar que el saldo se está acabando.
 *
 * Es un número plano a propósito: el backend no expone el consumo histórico
 * mensual del usuario, así que no hay forma de estimar "te alcanza para N días".
 * Cuando exista ese dato, esto debería volverse relativo al ritmo de emisión.
 */
export const TIMBRES_BAJOS = 20;
