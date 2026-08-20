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
