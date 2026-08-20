const PHP_API_BASE_URL = process.env.PHP_API_BASE_URL;

if (!PHP_API_BASE_URL) {
  throw new Error("Falta la variable de entorno PHP_API_BASE_URL");
}

export type PhpResponse<T = Record<string, unknown>> =
  | ({ Error: "0" } & T)
  | { Error: "1"; DescripError: string };

export async function callPhpApi<T = Record<string, unknown>>(
  path: string,
  body: Record<string, string>
): Promise<PhpResponse<T>> {
  const res = await fetch(`${PHP_API_BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  const data = await res.json();
  return data as PhpResponse<T>;
}

// Los endpoints legacy (no exclusivos de la web) leen $_REQUEST, que no
// entiende un body JSON crudo - necesitan form-urlencoded.
export async function callLegacyPhpApi<T = Record<string, unknown>>(
  path: string,
  body: Record<string, string>
): Promise<PhpResponse<T>> {
  const res = await fetch(`${PHP_API_BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body).toString(),
    cache: "no-store",
  });

  const data = await res.json();
  return data as PhpResponse<T>;
}

// Para endpoints legacy que reciben archivos ($_FILES) ademas de campos de
// texto - reenvia el FormData tal cual, sin tocarlo (fetch en Node arma el
// boundary multipart correcto solo).
export async function callLegacyPhpApiFormData<T = Record<string, unknown>>(
  path: string,
  formData: FormData
): Promise<PhpResponse<T>> {
  const res = await fetch(`${PHP_API_BASE_URL}${path}`, {
    method: "POST",
    body: formData,
    cache: "no-store",
  });

  const data = await res.json();
  return data as PhpResponse<T>;
}
