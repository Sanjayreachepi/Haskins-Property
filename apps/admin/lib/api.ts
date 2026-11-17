export async function api(url: string, method = "GET", body?: unknown) {
  const path = url.startsWith("auth/") ? "admin/" + url : url;
  const response = await fetch("/api/" + path, {
    method,
    credentials: "include",
    headers:
      body instanceof FormData ? {} : { "Content-Type": "application/json" },
    body:
      body === undefined
        ? undefined
        : body instanceof FormData
          ? body
          : JSON.stringify(body),
  });
  let result;
  try {
    result = await response.json();
  } catch {
    throw Object.assign(
      Error(
        response.ok
          ? "The server returned an invalid response. Please try again."
          : `Unable to complete the request (HTTP ${response.status}). Please try again or contact support.`,
      ),
      { status: response.status },
    );
  }
  if (!response.ok)
    throw Object.assign(Error(result?.message || "Request failed"), {
      status: response.status,
    });
  return result;
}
