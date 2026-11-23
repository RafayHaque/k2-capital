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


## Transactions tab (portfolio v2)

The site now builds everything from one **Transactions** tab: one row per buy or sell. It works out your open positions, average price, first buy date, unrealized gain/loss, and the realized gain/loss on every sell. You never enter a profit by hand.

Headers in row 1 (any order): `date, ticker, name, sector, side, shares, price, currency, fees`

- `side`: BUY or SELL
- `currency`: USD or CAD (blank means USD)
- `fees`: optional, commission in the trade's currency (added to cost on buys, deducted on sells)
- `date`: 2026-01-20 works best
- Canadian stocks: use the Yahoo-style ticker, for example `RY.TO` or `SHOP.TO`
- Type sector names identically every time

Setup:
1. Add a new tab called `Transactions` to your Google Sheet (see `sample-transactions.csv`).
2. File > Share > Publish to web > pick the Transactions tab > CSV > Publish. Copy the link.
3. In Cloudflare, add the variable `TRANSACTIONS_CSV_URL` with that link, then Retry deployment once.

Until `TRANSACTIONS_CSV_URL` is set, the old Holdings tab (`SHEET_CSV_URL`) keeps working and is shown with the new layout.

Optional variable: `USDCAD_RATE` to fix the exchange rate instead of using the automatic daily one.

How numbers are calculated: average cost method; USD converted to CAD at today's rate; Total ROI = (realized + unrealized) divided by the cost of every purchase.


## Performance tab (portfolio worth, returns, graph, leverage)

A second tab, `Performance`, powers the fund-level boxes, the graph and the Leverage box. Add one row per week (or any regular interval) from your IBKR statement:

`date, portfolio_value, net_deposits`

- `portfolio_value`: total account value in CAD (IBKR "Net Liquidation Value"), so it already includes cash, margin and everything else
- `net_deposits`: money added (+) or withdrawn (-) since the previous row, in CAD. Leave 0 if none. The first row is your starting balance and its deposit is ignored.
- Returns are time-weighted: each period's return removes that row's deposit, so adding money never looks like a gain.
- Year to date uses the last row on or before Dec 31 as its starting point.

Setup: add the tab (see `sample-performance.csv`), publish it as CSV (File > Share > Publish to web, pick the tab), and add the Cloudflare variable `PERFORMANCE_CSV_URL`. Then Retry deployment once.

Leverage = market value of current holdings divided by the latest portfolio worth, so keep the Performance tab current.

## Editing the other pages

All edited on GitHub (open the file, pencil icon, Commit changes):
- `site.js`: contact details (email, LinkedIn, Instagram) and the menu. Change once, every page updates.
- `events-data.js`: the events list for the Home and Events pages. Delete the entries marked `sample: true`.
- `about.html`: the `TEAM` list (intro, LinkedIn, photo for each person) and the `PHOTOS` list near the top of the script.
- `education.html`: the TILES framework and the `RESOURCES` list near the top of the script.
- Images: upload team photos to `images/team/` and club photos to `images/club/`.

## Good next steps
- Currency column (CAD/USD) and converting to a single currency
- Pull sector automatically instead of typing it in the sheet
- Performance vs. a benchmark (S&P 500 / TSX) and a value-over-time chart
- Sold positions / realized gains tab
- Custom domain
- Optional admin login with Supabase if the sheet ever becomes limiting

## Disclaimer
Educational only; not investment advice. Free price data can be delayed.
