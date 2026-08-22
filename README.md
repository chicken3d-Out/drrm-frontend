# DepEd Leyte DRRM — Frontend

Angular (standalone components) web app for the DepEd Leyte Division DRRM
Monitoring System. Pairs with a separately-deployed Node.js backend (see the
companion `deped-leyte-drrm-backend` repo).

## Local development

```bash
npm install
npm start   # http://localhost:4200, proxies /api and /socket.io to localhost:4000
```

Requires the backend running locally on port 4000 (see its README).

## Deploying to Netlify

1. Before deploying, edit `src/environments/environment.prod.ts` and replace
   the placeholder with your actual deployed Render backend URL:

   ```ts
   export const environment = {
     production: true,
     apiBase: 'https://your-backend.onrender.com',
     socketBase: 'https://your-backend.onrender.com'
   };
   ```

2. Push this repo to GitHub/GitLab and create a new Netlify site from it.
   `netlify.toml` already sets the build command and publish directory:

   ```toml
   [build]
     command = "npm run build"
     publish = "dist/web/browser"
   ```

3. Netlify's SPA redirect (also in `netlify.toml`) sends all routes to
   `index.html` so Angular's client-side routing survives page refreshes and
   deep links.

4. On the backend, set `WEB_ORIGIN` to include this Netlify site's URL so CORS
   and Socket.IO both accept requests from it.

5. Since the frontend calls the backend cross-origin (different domains),
   the browser needs both sides on HTTPS — Netlify and Render both provide
   this by default, so no extra TLS setup is needed.

## Notes

- The dev-time proxy (`proxy.conf.json`) is only used by `npm start` locally;
  in production the app talks directly to `environment.apiBase`, so Netlify
  doesn't need any API proxy configuration.
- Leaflet (not Google Maps) is used for mapping — no API key required.
