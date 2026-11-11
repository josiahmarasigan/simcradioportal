# SIMC Radiology Portal – installable app

This is the app "shell" for the **Siargao Island Medical Center – Radiology Division** portal.
It lets staff install the portal on their phones (Android, iPhone) and computers (Windows, Mac) with the
Radiology Division logo as the app icon. The portal itself still runs on Google Apps Script; this shell just
opens it full screen. No patient data is stored here.

## Files
| File | What it is |
|---|---|
| `index.html` | The app page. **The portal link (`PORTAL_URL`) is at the top** – change it here if the Apps Script deployment link ever changes. |
| `app.js` | Install prompt, loading screen, Messenger/Facebook "open in browser" screen. |
| `manifest.webmanifest` | App name, colours and icons (what phones use when installing). |
| `sw.js` | Service worker – required for installing; keeps the shell available offline. |
| `icons/` | App icons made from the Radiology Division logo. |

## Publish on GitHub Pages (one time)
1. Create a new **public** repository on GitHub, e.g. `simc-radiology`.
2. Upload all files in this folder (keep the `icons` folder).
3. Repository **Settings → Pages → Build and deployment → Source: Deploy from a branch → Branch: `main` / `(root)` → Save**.
4. After about a minute the app is live at `https://<your-github-username>.github.io/simc-radiology/`.
5. In the portal's spreadsheet, CONFIG → `APP_URL` = that address, so "Open in browser" and shared links point to the app.

## Updating
- Edit the files on GitHub (pencil icon) and commit. Changes go live in about a minute.
- After editing `index.html` or `app.js`, also change `VERSION` at the top of `sw.js` (e.g. `simc-shell-v2`) so installed apps pick up the change.
