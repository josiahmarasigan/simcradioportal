# SIMC Radiology Portal (GitHub Pages)

The portal's screens live here. Logins, patient lists and results come from the Google Apps Script web app
(the `/exec` link written near the top of `index.html` as `window.PORTAL_API`) through its `doPost` function.
Nothing from Google is shown inside a frame, so phones signed in to several Google accounts work.

## Updating
1. Paste the new **Index.html** from Apps Script over `index.html` here (same content).
2. In `sw.js`, change `VERSION` (e.g. `simc-portal-v3`) so installed apps pick it up quickly.
3. Commit. GitHub Pages republishes in about a minute.

## Apps Script side
* Deploy → Manage deployments → edit the existing deployment → **Who has access: Anyone** → Version: New version → Deploy.
  (Keep the same deployment so the `/exec` link stays the same. If you make a NEW deployment, paste its link into `index.html`.)
* In the CONFIG sheet, set **APP_URL** to this site's address.
