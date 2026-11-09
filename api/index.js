// server/vercel-entry.ts
import express from "express";

// server/store.ts
import crypto from "node:crypto";
var SUPABASE_URL = process.env.SUPABASE_URL;
var SUPABASE_KEY = process.env.SUPABASE_KEY;
var ADMIN_USER = process.env.ADMIN_USER;
var ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
var ADMIN_SECRET = process.env.ADMIN_SECRET;
var COOKIE_NAME = "tuman_admin";
function sign(value) {
  return crypto.createHmac("sha256", ADMIN_SECRET || "").update(value).digest("hex");
}
function safeEqual(a, b) {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}
function makeToken() {
  const exp = String(Date.now() + 7 * 24 * 3600 * 1e3);
  return `${exp}.${sign(exp)}`;
}
function validToken(token) {
  if (!token || !ADMIN_SECRET) return false;
  const [exp, sig] = token.split(".");
  return Boolean(exp && sig) && Number(exp) > Date.now() && safeEqual(sig, sign(exp));
}
var demoProducts = [
  { id: 1, name: "\u0639\u0635\u064A\u0631 \u0628\u0631\u062A\u0642\u0627\u0644", quantity: 40, price: 750, description: "\u0637\u0627\u0632\u062C \u0648\u062E\u0641\u064A\u0641 \u0639\u0644\u0649 \u0627\u0644\u0642\u0644\u0628", image_data: "\u{1F34A}" },
  { id: 2, name: "\u0643\u064A\u0643 \u0634\u0648\u0643\u0648\u0644\u0627\u062A\u0629", quantity: 18, price: 2500, description: "\u0642\u0637\u0639\u0629 \u062D\u0644\u0648\u0629 \u0644\u0644\u0642\u0647\u0648\u0629", image_data: "\u{1F370}" },
  { id: 3, name: "\u0645\u0627\u0621 \u0645\u0639\u062F\u0646\u064A", quantity: 60, price: 500, description: "\u0646\u0642\u064A \u0648\u0645\u0646\u0639\u0634", image_data: "\u{1F4A7}" },
  { id: 4, name: "\u062D\u0644\u064A\u0628 \u0643\u0627\u0645\u0644 \u0627\u0644\u062F\u0633\u0645", quantity: 24, price: 1500, description: "\u0644\u0644\u0641\u0637\u0648\u0631 \u0648\u0643\u0644 \u064A\u0648\u0645", image_data: "\u{1F95B}" },
  { id: 5, name: "\u062E\u0628\u0632 \u0635\u0645\u0648\u0646", quantity: 35, price: 1e3, description: "\u0637\u0627\u0632\u062C \u064A\u0648\u0645\u064A\u0627\u064B", image_data: "\u{1F956}" },
  { id: 6, name: "\u0634\u064A\u0628\u0633 \u0628\u0637\u0627\u0637\u0627", quantity: 25, price: 1e3, description: "\u0642\u0631\u0645\u0634\u0629 \u062E\u0641\u064A\u0641\u0629", image_data: "\u{1F954}" }
];
function supabaseReady() {
  return Boolean(SUPABASE_URL && SUPABASE_KEY);
}
async function sb(path, init) {
  if (!supabaseReady()) return null;
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json", ...init?.headers || {} }
  });
  const text = await response.text();
  if (!response.ok) throw new Error(text || `Supabase ${response.status}`);
  return text ? JSON.parse(text) : null;
}
function adminCookie(req) {
  return req.headers.cookie?.split(";").map((x) => x.trim()).find((x) => x.startsWith(COOKIE_NAME + "="))?.slice(COOKIE_NAME.length + 1);
}
function requireAdmin(req, res) {
  if (!validToken(adminCookie(req))) {
    res.status(401).json({ error: "\u063A\u064A\u0631 \u0645\u0635\u0631\u062D" });
    return false;
  }
  return true;
}
function json(res, value) {
  res.setHeader("Cache-Control", "no-store");
  res.json(value);
}
function registerStoreRoutes(app2) {
  app2.get("/api/store/products", async (_req, res) => {
    try {
      const result = await sb("products?select=*&order=created_at.desc");
      json(res, Array.isArray(result) && result.length ? result : demoProducts);
    } catch {
      json(res, demoProducts);
    }
  });
  app2.get("/api/store/reviews", async (_req, res) => {
    try {
      json(res, await sb("reviews?approved=eq.true&select=*&order=created_at.desc") ?? []);
    } catch {
      json(res, []);
    }
  });
  app2.post("/api/store/reviews", async (req, res) => {
    try {
      const { name, rating, comment } = req.body;
      if (!name || !comment) return res.status(400).json({ error: "\u064A\u0631\u062C\u0649 \u0643\u062A\u0627\u0628\u0629 \u0627\u0644\u0627\u0633\u0645 \u0648\u0627\u0644\u0631\u0623\u064A" });
      await sb("reviews", { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify({ name, rating: Number(rating) || 5, comment, approved: false }) });
      json(res, { ok: true });
    } catch {
      res.status(500).json({ error: "\u062A\u0639\u0630\u0631 \u062D\u0641\u0638 \u0627\u0644\u0631\u0623\u064A" });
    }
  });
  app2.post("/api/store/admin/login", (req, res) => {
    const { username, password } = req.body;
    if (ADMIN_USER && ADMIN_PASSWORD && ADMIN_SECRET && typeof username === "string" && typeof password === "string" && safeEqual(username, ADMIN_USER) && safeEqual(password, ADMIN_PASSWORD)) {
      res.setHeader("Set-Cookie", `${COOKIE_NAME}=${makeToken()}; Path=/; Max-Age=604800; SameSite=Lax; Secure; HttpOnly`);
      return json(res, { ok: true });
    }
    return res.status(401).json({ error: "\u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u062F\u062E\u0648\u0644 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629" });
  });
  app2.post("/api/store/admin/logout", (_req, res) => {
    res.setHeader("Set-Cookie", "tuman_admin=; Max-Age=0; Path=/; SameSite=None; Secure; HttpOnly");
    json(res, { ok: true });
  });
  app2.get("/api/store/admin/session", (req, res) => json(res, { ok: validToken(adminCookie(req)) }));
  app2.get("/api/store/admin/reviews", async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      json(res, await sb("reviews?select=*&order=created_at.desc") ?? []);
    } catch {
      res.status(500).json({ error: "\u062A\u0639\u0630\u0631 \u062C\u0644\u0628 \u0627\u0644\u0622\u0631\u0627\u0621" });
    }
  });
  app2.patch("/api/store/admin/reviews/:id", async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      await sb(`reviews?id=eq.${encodeURIComponent(req.params.id)}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ approved: Boolean(req.body.approved) }) });
      json(res, { ok: true });
    } catch {
      res.status(500).json({ error: "\u062A\u0639\u0630\u0631 \u062A\u0639\u062F\u064A\u0644 \u0627\u0644\u0631\u0623\u064A" });
    }
  });
  app2.delete("/api/store/admin/reviews/:id", async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      await sb(`reviews?id=eq.${encodeURIComponent(req.params.id)}`, { method: "DELETE" });
      json(res, { ok: true });
    } catch {
      res.status(500).json({ error: "\u062A\u0639\u0630\u0631 \u062D\u0630\u0641 \u0627\u0644\u0631\u0623\u064A" });
    }
  });
  app2.post("/api/store/admin/products", async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      const body = { name: req.body.name, quantity: Number(req.body.quantity), price: Number(req.body.price), description: req.body.description || null, image_data: req.body.image_data || null };
      if (!body.name || body.quantity < 0 || body.price < 0) return res.status(400).json({ error: "\u062A\u062D\u0642\u0642 \u0645\u0646 \u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0645\u0646\u062A\u062C" });
      const result = await sb("products", { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify(body) });
      json(res, result?.[0] ?? body);
    } catch {
      res.status(500).json({ error: "\u062A\u0639\u0630\u0631 \u0625\u0636\u0627\u0641\u0629 \u0627\u0644\u0645\u0646\u062A\u062C" });
    }
  });
  app2.patch("/api/store/admin/products/:id", async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      const body = { name: req.body.name, quantity: Number(req.body.quantity), price: Number(req.body.price), description: req.body.description || null, image_data: req.body.image_data || null };
      const result = await sb(`products?id=eq.${encodeURIComponent(req.params.id)}`, { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify(body) });
      json(res, result?.[0] ?? body);
    } catch {
      res.status(500).json({ error: "\u062A\u0639\u0630\u0631 \u062A\u0639\u062F\u064A\u0644 \u0627\u0644\u0645\u0646\u062A\u062C" });
    }
  });
  app2.delete("/api/store/admin/products/:id", async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      await sb(`products?id=eq.${encodeURIComponent(req.params.id)}`, { method: "DELETE" });
      json(res, { ok: true });
    } catch {
      res.status(500).json({ error: "\u062A\u0639\u0630\u0631 \u062D\u0630\u0641 \u0627\u0644\u0645\u0646\u062A\u062C" });
    }
  });
  app2.post("/api/store/orders", async (req, res) => {
    try {
      const { customer, items } = req.body;
      if (!customer?.name || !customer.phone || !customer.area || !customer.location || !customer.landmark || !items?.length) return res.status(400).json({ error: "\u0623\u0643\u0645\u0644 \u0645\u0639\u0644\u0648\u0645\u0627\u062A \u0627\u0644\u0637\u0644\u0628" });
      if (!["\u0627\u0644\u0645\u0631\u0628\u062F \u0627\u0644\u0642\u062F\u064A\u0645", "\u0627\u0644\u0645\u0631\u0628\u062F \u0627\u0644\u062C\u062F\u064A\u062F", "\u062D\u064A \u0627\u0644\u0642\u0627\u0626\u062F"].includes(customer.area)) return res.status(400).json({ error: "\u0627\u0644\u062A\u0648\u0635\u064A\u0644 \u0645\u062A\u0627\u062D \u0644\u0644\u0645\u0646\u0627\u0637\u0642 \u0627\u0644\u0645\u062D\u062F\u062F\u0629 \u0641\u0642\u0637" });
      const products = await sb(`products?id=in.(${items.map((i) => i.id).join(",")})&select=id,name,quantity,price`) ?? [];
      for (const item of items) {
        const product = products.find((p) => Number(p.id) === Number(item.id));
        if (!product || Number(product.quantity) < Number(item.quantity)) return res.status(409).json({ error: `\u0627\u0644\u0643\u0645\u064A\u0629 \u063A\u064A\u0631 \u0645\u062A\u0648\u0641\u0631\u0629: ${item.name}` });
      }
      const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
      const delivery = total > 7e3 ? 0 : 1e3;
      const order = (await sb("orders", { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify({ customer_name: customer.name, phone: customer.phone, area: customer.area, location: customer.location, landmark: customer.landmark, total, delivery_fee: delivery }) }))?.[0];
      for (const item of items) {
        await sb(`products?id=eq.${item.id}&quantity=gte.${item.quantity}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ quantity: Math.max(0, (products.find((p) => Number(p.id) === Number(item.id))?.quantity ?? item.quantity) - item.quantity), updated_at: (/* @__PURE__ */ new Date()).toISOString() }) });
        await sb("order_items", { method: "POST", body: JSON.stringify({ order_id: order?.id, product_id: item.id, product_name: item.name, quantity: item.quantity, price: item.price }) });
      }
      json(res, { ok: true, order: { ...order, items, total, delivery_fee: delivery }, receipt_id: crypto.randomUUID() });
    } catch {
      res.status(500).json({ error: "\u062A\u0639\u0630\u0631 \u062A\u062B\u0628\u064A\u062A \u0627\u0644\u0637\u0644\u0628 \u062D\u0627\u0644\u064A\u0627\u064B" });
    }
  });
}

// server/_core/publicConfig.ts
function publicPlatformConfig(env = process.env) {
  return {
    projectId: env.MANUS_PROJECT_ID ?? "",
    oauthPortalUrl: env.MANUS_OAUTH_PORTAL_URL ?? "",
    apiUrl: env.MANUS_API_URL ?? "",
    apiBrowserKey: env.MANUS_API_BROWSER_KEY ?? ""
  };
}
function publicPlatformScript(env = process.env) {
  const json2 = JSON.stringify(publicPlatformConfig(env)).replaceAll("<", "\\u003c");
  return `window.__MANUS_CONFIG__=${json2};`;
}

// server/vercel-entry.ts
var app = express();
app.use(express.json({ limit: "4mb" }));
app.get("/api/health", (_req, res) => res.json({ status: "ok" }));
app.get("/api/platform/config.js", (_req, res) => {
  res.set("Cache-Control", "no-store").type("application/javascript").send(publicPlatformScript());
});
registerStoreRoutes(app);
var vercel_entry_default = app;
export {
  vercel_entry_default as default
};
