# Basarnas Layout App

## KML/KMZ NetworkLink via CORS Proxy

Some KML sources (e.g. NetworkLink targets) do not send CORS headers. Browsers will block these requests with a generic "Failed to fetch". This app supports routing NetworkLink fetches through a proxy that appends permissive CORS headers.

### Quick Setup

1) Deploy a Cloudflare Worker (free):

```/dev/null/cloudflare-worker.js#L1-60
export default {
	async fetch(request) {
		const url = new URL(request.url)
		const target = url.searchParams.get('url')
		if (!target) {
			return new Response('Missing url param', { status: 400 })
		}
		try {
			const resp = await fetch(target, { redirect: 'follow' })
			const body = await resp.arrayBuffer()
			const headers = new Headers(resp.headers)
			headers.set('Access-Control-Allow-Origin', '*')
			headers.set('Access-Control-Allow-Methods', 'GET,OPTIONS')
			headers.set('Access-Control-Allow-Headers', '*')
			if (!headers.get('content-type')) headers.set('content-type', 'application/xml')
			return new Response(body, { status: resp.status, headers })
		} catch (e) {
			return new Response(`Proxy fetch failed: ${e.message}`, { status: 502 })
		}
	}
}
```

2) Configure the app to use your proxy by setting a Vite env variable in `.env.local` (create if missing):

```/dev/null/.env.local#L1-2
VITE_KML_PROXY_URL=https://your-worker.example.workers.dev/?url=
```

The app automatically picks up `VITE_KML_PROXY_URL` and routes KML NetworkLink requests through this proxy.

3) Restart the dev server after changing env vars.

### Verification

Test the KML endpoint directly:

```/dev/null/terminal.sh#L1-4
curl -I https://m2prime.aissat.com/api/GE.Today.kml
curl -sI https://m2prime.aissat.com/api/GE.Today.kml | grep -i 'access-control-allow'
```

If no `Access-Control-Allow-Origin` header appears, you must use the proxy in browsers. After setting the env and restarting, upload your KML/KMZ again; NetworkLinks should load successfully.

### Notes

- The uploader surfaces precise errors. If a KML contains only NetworkLinks and external fetches fail, you will see: `KML tidak memiliki fitur lokal dan tidak ada NetworkLink yang berhasil dimuat`.
- If your API requires auth, extend the proxy to forward `Authorization` headers, and add support in the app as needed.
# imsar
# imsar
