import { cache } from "react";
import { existeCsd, getEmisor, type EmisorDetalle } from "@/lib/emisores";
import { getSeries, type Serie } from "@/lib/series";
import { getReceptores, type Receptor } from "@/lib/receptores";
import { getConfigPdfs } from "@/lib/configPdf";
import type { ConfigPdfForm } from "@/lib/configPdfShared";

export type EmisorContext = {
  emisor: EmisorDetalle;
  series: Serie[];
  receptores: Receptor[];
  configs: ConfigPdfForm[];
  tieneCsd: boolean;
};

/**
 * Carga todo lo que necesitan el layout del emisor y sus secciones.
 *
 * Va envuelto en `cache()` de React: el layout y la page de una misma
 * navegacion comparten el resultado, asi que el backend PHP recibe una sola
 * tanda de llamadas por render aunque varios componentes pidan lo mismo.
 * El cache vive solo durante ese render (no persiste entre requests), asi que
 * un router.refresh() siempre trae datos frescos.
 */
export const loadEmisorContext = cache(
  async (rfc: string): Promise<EmisorContext | null> => {
    const emisor = await getEmisor(rfc);
    if (!emisor) return null;

    const [series, receptores, configs, tieneCsd] = await Promise.all([
      getSeries(rfc),
      getReceptores(rfc),
      getConfigPdfs(rfc),
      existeCsd(emisor.Token),
    ]);

    return { emisor, series, receptores, configs, tieneCsd };
  }
);
