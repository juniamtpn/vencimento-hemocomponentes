let cachedToken: { value: string; expiresAt: number } | null = null;

export async function getGraphToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60_000) {
    return cachedToken.value;
  }

  const tenantId = process.env.AZURE_AD_TENANT_ID!;
  const clientId = process.env.AZURE_AD_CLIENT_ID!;
  const clientSecret = process.env.AZURE_AD_CLIENT_SECRET!;

  const res = await fetch(
    `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: clientId,
        client_secret: clientSecret,
        scope: "https://graph.microsoft.com/.default",
      }),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`[Graph] Token error: ${err}`);
  }

  const data = await res.json();
  cachedToken = {
    value: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
  return cachedToken.value;
}

export async function graphFetch(
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  const token = await getGraphToken();
  const url = `https://graph.microsoft.com/v1.0${path}`;
  const reqOptions: RequestInit = {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  };

  let lastError: unknown;
  for (let attempt = 0; attempt <= 2; attempt++) {
    try {
      const res = await fetch(url, reqOptions);
      if (res.ok || res.status < 500) return res; // não retenta 4xx
      lastError = new Error(`[Graph] HTTP ${res.status} em ${path}`);
    } catch (err) {
      lastError = err;
    }
    if (attempt < 2) await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
  }
  throw lastError;
}
