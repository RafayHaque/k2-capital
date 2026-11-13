# K2 Capital Website

A free, two-page site for the K2 Capital club at Queen's University.

- **Portfolio page** (`index.html`): holdings, buy price, current price, ROI, gain/loss, sector grouping and allocation.
- **About page** (`about.html`): mission, contact and team.
- **Holdings live in a Google Sheet.** Only people you share the sheet with can add or change stocks. No code changes needed.
- **Prices** come from Finnhub through a small serverless function (`functions/api/portfolio.js`), cached for 15 minutes.

Cost: $0 (a custom domain is optional, roughly $15/year).

## How it works

```
Google Sheet (published as CSV) --\
                                   >-- /api/portfolio (Cloudflare function) --> website
Finnhub price API ----------------/
```

The function reads the sheet, fetches a price for each ticker, and returns the merged result. The browser does the ROI math.

## Setup (about 20 minutes)

### 1. Create the Google Sheet
1. Create a new Google Sheet. Copy the headers and rows from `sample-holdings.csv` into it (or File > Import).
2. Columns: `ticker, name, sector, shares, buy_price, buy_date`.
3. Share the sheet with your exec team as **Editors**. Everyone else has no access.
4. Publish a read-only copy for the site: **File > Share > Publish to web**, choose this sheet tab, format **CSV**, click Publish, and copy the link.

> The published CSV link is "anyone with the link can read". That's fine here because the portfolio is public anyway, but don't put anything private in that tab. Only people you've shared the sheet with can *edit* it.

To add a stock, add a row. The site updates within about 15 minutes.

### 2. Get a free price API key
1. Sign up at https://finnhub.io and copy your API key.
2. Check Finnhub's current free-tier coverage. US tickers (AAPL, MSFT) are the safest bet. For Canadian tickers (TSX), verify whether your plan returns prices for them before relying on it. If a price can't be found, that row shows "–" and a warning appears on the page.

### 3. Put the code on GitHub
Create a free GitHub account, make a new repository, and upload everything in this folder.

### 4. Deploy on Cloudflare Pages (free)
1. Sign up at https://pages.cloudflare.com, then **Create a project > Connect to Git** and pick your repo.
2. Build settings: framework preset **None**, build command **blank**, output directory **/** (the repo root).
3. After the first deploy, go to **Settings > Variables and Secrets** and add:
   - `SHEET_CSV_URL`: the published CSV link from step 1
   - `FINNHUB_KEY`: your Finnhub key (mark it as a secret)
4. Redeploy once. Your site is live at `your-project.pages.dev`.

Until the two variables are set, the site shows sample data with a banner so you can see how it looks.

### 5. Customize
- `about.html`: replace the team list (the `TEAM` array in the script at the bottom), the contact details, and the TODO paragraph. For photos, put images in an `images/` folder and set `photo: "images/name.jpg"`.
- `styles.css`: colours are at the top (`--navy`, `--gold`, `--red`).
- Before launch, check with the AMS / your faculty advisor on naming and branding rules, and whether you need Queen's logos approved (this site doesn't use any).

## Good next steps
- Currency column (CAD/USD) and converting to a single currency
- Pull sector automatically instead of typing it in the sheet
- Performance vs. a benchmark (S&P 500 / TSX) and a value-over-time chart
- Sold positions / realized gains tab
- Custom domain
- Optional admin login with Supabase if the sheet ever becomes limiting

## Disclaimer
Educational only; not investment advice. Free price data can be delayed.
