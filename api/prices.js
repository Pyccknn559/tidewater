// Vercel serverless function: GET /api/prices (public, read-only, no keys)
const COINS = {
  BTC: { cb: "BTC-USD", kr: "XBTUSD" },
  ETH: { cb: "ETH-USD", kr: "ETHUSD" },
  SOL: { cb: "SOL-USD", kr: "SOLUSD" },
  XRP: { cb: "XRP-USD", kr: "XRPUSD" },
  DOGE: { cb: "DOGE-USD", kr: "XDGUSD" },
};

const getJson = async (url) => {
  const r = await fetch(url, { signal: AbortSignal.timeout(5000) });
  if (!r.ok) throw new Error(url + " " + r.status);
  return r.json();
};
const coinbase = async (p) => +(await getJson(`https://api.exchange.coinbase.com/products/${p}/ticker`)).price;
const kraken = async (p) => +Object.values((await getJson(`https://api.kraken.com/0/public/Ticker?pair=${p}`)).result)[0].c[0];

module.exports = async (req, res) => {
  const prices = {};
  await Promise.all(
    Object.entries(COINS).map(async ([sym, m]) => {
      const [a, b] = await Promise.allSettled([coinbase(m.cb), kraken(m.kr)]);
      const cb = a.status === "fulfilled" ? a.value : null;
      const kr = b.status === "fulfilled" ? b.value : null;
      prices[sym] = {
        coinbase: cb,
        kraken: kr,
        gapPct: cb && kr ? (Math.max(cb, kr) / Math.min(cb, kr) - 1) * 100 : null,
      };
    })
  );
  res.setHeader("Cache-Control", "s-maxage=3, stale-while-revalidate=10");
  res.status(200).json({ updated: new Date().toISOString(), prices });
};
