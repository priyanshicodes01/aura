Written for: Priyanshi, deploying without git installed.

# Getting the two links

You need a **GitHub repository link** and a **Vercel deployed link**. Git is not
installed on this laptop and you do not need it. Both of these are done in a browser.

Total time: about 8 minutes.

---

## Part 1 — GitHub repository (4 min)

1. Go to **https://github.com/new**
2. Repository name: `aura` — set it to **Public** (judges must be able to open it)
3. Leave every checkbox **unticked**. Do not add a README, it would conflict with ours.
4. Click **Create repository**
5. On the next page click the link **"uploading an existing file"**
   (it is in the grey box, in the line "…or upload an existing file")
6. Open `C:\Users\user\Desktop\aura` in File Explorer
7. Select **all 13 files** (Ctrl+A) and drag them into the browser window

   You should see all of these listed:
   `index.html` · `styles.css` · `data.js` · `engine.js` · `app.js` · `sw.js`
   · `manifest.webmanifest` · `icon.svg` · `vercel.json` · `README.md` · `DEPLOY.md`
   · `Aura-deck.md` · `DEMO-SCRIPT.md`

8. In the "Commit changes" box type: `Aura — Round 1 and Round 2`
9. Click **Commit changes**

Your repo link is now `https://github.com/priyanshicodes01/aura`

> **If you change a file later:** open the file in GitHub, click the pencil icon,
> paste the new contents, commit. Vercel redeploys on its own within a minute.

---

## Part 2 — Vercel deployed link (4 min)

1. Go to **https://vercel.com/signup**
2. Choose **Continue with GitHub** — this matters, it links the two accounts in one step
3. Authorise Vercel when GitHub asks
4. On the Vercel dashboard click **Add New… → Project**
5. Find `aura` in the repository list and click **Import**
   - If you do not see it, click **Adjust GitHub App Permissions** and grant access
     to the `aura` repo
6. On the configuration screen **change nothing**:
   - Framework Preset: `Other`
   - Build Command: empty
   - Output Directory: empty
   - Root Directory: `./`
7. Click **Deploy**
8. Wait about 30 seconds

Your deployed link is `https://aura-<something>.vercel.app` — copy it from the
**Visit** button.

---

## Part 3 — Two checks before you submit (2 min)

**Check 1 — it loads on a phone.** Open the Vercel link on your phone. The layout
should fill the screen. Try the Ghost Ping slider in Shadow Mode — on a phone it
should actually open your Messages app with the text already written. That is worth
filming.

**Check 2 — the offline claim is true.** On your phone, with the Vercel link already
loaded once, turn on **aeroplane mode** and reload the page. It should still work
completely. This is the single most convincing thing in your Round 2 demo, so verify
it before you record.

---

## Fallback, if Vercel gives you trouble

You have node installed, so you can deploy straight from this folder without GitHub:

```powershell
cd C:\Users\user\Desktop\aura
npx vercel login       # opens a browser, use the GitHub option
npx vercel --prod      # accept all defaults; it prints your URL
```

When it asks "In which directory is your code located?" press Enter.
When it asks about build settings, press Enter for each.

---

## What goes in the submission form

| Field | Value |
|---|---|
| GitHub repository | `https://github.com/priyanshicodes01/aura` |
| Deployed link | your `…vercel.app` URL |
| PPT | `Aura-deck.md` content, pasted into slides |
| Demo video | see `DEMO-SCRIPT.md` |

Add the Vercel URL to the top of `README.md` once you have it — judges look there first.
