/**
 * {{MODULE_DISPLAY}} — this module's transport layer.
 *
 * The base URL comes from this repository's own `.env`
 * (`{{API_BASE_ENV}}`), never from the Shell's. A remote is compiled on its own,
 * so anything it reads from the host environment is either baked in at build
 * time or simply absent — which is why every key is declared in `.env.example`.
 *
 * Authentication headers are injected rather than imported: the module does not
 * depend on the shared UI package to make a request, and the Shell's host
 * adapter supplies the bearer token at construction time.
 */
const BASE_URL = (process.env.{{API_BASE_ENV}} || "").replace(/\/+$/, "");

export function createApiClient({ getHeaders = () => ({}), fetchImpl = fetch } = {}) {
  async function request(path, { method = "GET", body, headers = {} } = {}) {
    const auth = (await getHeaders()) || {};
    const isForm = body instanceof FormData;
    const url = `${BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;

    const init = {
      method,
      credentials: "include",
      headers: {
        ...auth,
        ...headers,
        ...(isForm ? {} : { "Content-Type": "application/json" }),
      },
      body: isForm ? body : body === undefined ? undefined : JSON.stringify(body),
    };

    const response = await fetchImpl(url, init);

    if (!response.ok) {
      throw new Error(`${method} ${url} failed with status ${response.status}`);
    }

    if (response.status === 204) return null;
    return response.json();
  }

  return {
    get: (path) => request(path),
    post: (path, body) => request(path, { method: "POST", body }),
    put: (path, body) => request(path, { method: "PUT", body }),
    remove: (path) => request(path, { method: "DELETE" }),
  };
}

export const api = createApiClient();
