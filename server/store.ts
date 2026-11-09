import type { Express, Request, Response } from "express";
import crypto from "node:crypto";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const ADMIN_USER = process.env.ADMIN_USER;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const ADMIN_SECRET = process.env.ADMIN_SECRET;
const COOKIE_NAME = "tuman_admin";
function sign(value: string) { return crypto.createHmac("sha256", ADMIN_SECRET || "").update(value).digest("hex"); }
function safeEqual(a: string, b: string) { const x = Buffer.from(a), y = Buffer.from(b); return x.length === y.length && crypto.timingSafeEqual(x, y); }
function makeToken() { const exp = String(Date.now() + 7 * 24 * 3600 * 1000); return `${exp}.${sign(exp)}`; }
function validToken(token?: string) { if (!token || !ADMIN_SECRET) return false; const [exp, sig] = token.split("."); return Boolean(exp && sig) && Number(exp) > Date.now() && safeEqual(sig, sign(exp)); }
const demoProducts = [
  { id: 1, name: "عصير برتقال", quantity: 40, price: 750, description: "طازج وخفيف على القلب", image_data: "🍊" },
  { id: 2, name: "كيك شوكولاتة", quantity: 18, price: 2500, description: "قطعة حلوة للقهوة", image_data: "🍰" },
  { id: 3, name: "ماء معدني", quantity: 60, price: 500, description: "نقي ومنعش", image_data: "💧" },
  { id: 4, name: "حليب كامل الدسم", quantity: 24, price: 1500, description: "للفطور وكل يوم", image_data: "🥛" },
  { id: 5, name: "خبز صمون", quantity: 35, price: 1000, description: "طازج يومياً", image_data: "🥖" },
  { id: 6, name: "شيبس بطاطا", quantity: 25, price: 1000, description: "قرمشة خفيفة", image_data: "🥔" },
];

function supabaseReady() { return Boolean(SUPABASE_URL && SUPABASE_KEY); }
async function sb(path: string, init?: RequestInit) {
  if (!supabaseReady()) return null;
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: SUPABASE_KEY!, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json", ...(init?.headers || {}) },
  });
  const text = await response.text();
  if (!response.ok) throw new Error(text || `Supabase ${response.status}`);
  return text ? JSON.parse(text) : null;
}
function adminCookie(req: Request) { return req.headers.cookie?.split(";").map((x) => x.trim()).find((x) => x.startsWith(COOKIE_NAME + "="))?.slice(COOKIE_NAME.length + 1); }
function requireAdmin(req: Request, res: Response) { if (!validToken(adminCookie(req))) { res.status(401).json({ error: "غير مصرح" }); return false; } return true; }
function json(res: Response, value: unknown) { res.setHeader("Cache-Control", "no-store"); res.json(value); }

export function registerStoreRoutes(app: Express) {
  app.get("/api/store/products", async (_req, res) => { try { const result = await sb("products?select=*&order=created_at.desc"); json(res, Array.isArray(result) && result.length ? result : demoProducts); } catch { json(res, demoProducts); } });
  app.get("/api/store/reviews", async (_req, res) => { try { json(res, (await sb("reviews?approved=eq.true&select=*&order=created_at.desc")) ?? []); } catch { json(res, []); } });
  app.post("/api/store/reviews", async (req, res) => { try { const { name, rating, comment } = req.body; if (!name || !comment) return res.status(400).json({ error: "يرجى كتابة الاسم والرأي" }); await sb("reviews", { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify({ name, rating: Number(rating) || 5, comment, approved: false }) }); json(res, { ok: true }); } catch { res.status(500).json({ error: "تعذر حفظ الرأي" }); } });
  app.post("/api/store/admin/login", (req, res) => { const { username, password } = req.body; if (ADMIN_USER && ADMIN_PASSWORD && ADMIN_SECRET && typeof username === "string" && typeof password === "string" && safeEqual(username, ADMIN_USER) && safeEqual(password, ADMIN_PASSWORD)) { res.setHeader("Set-Cookie", `${COOKIE_NAME}=${makeToken()}; Path=/; Max-Age=604800; SameSite=Lax; Secure; HttpOnly`); return json(res, { ok: true }); } return res.status(401).json({ error: "بيانات الدخول غير صحيحة" }); });
  app.post("/api/store/admin/logout", (_req, res) => { res.setHeader("Set-Cookie", "tuman_admin=; Max-Age=0; Path=/; SameSite=None; Secure; HttpOnly"); json(res, { ok: true }); });
  app.get("/api/store/admin/session", (req, res) => json(res, { ok: validToken(adminCookie(req)) }));
  app.get("/api/store/admin/reviews", async (req, res) => { if (!requireAdmin(req, res)) return; try { json(res, (await sb("reviews?select=*&order=created_at.desc")) ?? []); } catch { res.status(500).json({ error: "تعذر جلب الآراء" }); } });
  app.patch("/api/store/admin/reviews/:id", async (req, res) => { if (!requireAdmin(req, res)) return; try { await sb(`reviews?id=eq.${encodeURIComponent(req.params.id)}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ approved: Boolean(req.body.approved) }) }); json(res, { ok: true }); } catch { res.status(500).json({ error: "تعذر تعديل الرأي" }); } });
  app.delete("/api/store/admin/reviews/:id", async (req, res) => { if (!requireAdmin(req, res)) return; try { await sb(`reviews?id=eq.${encodeURIComponent(req.params.id)}`, { method: "DELETE" }); json(res, { ok: true }); } catch { res.status(500).json({ error: "تعذر حذف الرأي" }); } });
  app.post("/api/store/admin/products", async (req, res) => { if (!requireAdmin(req, res)) return; try { const body = { name: req.body.name, quantity: Number(req.body.quantity), price: Number(req.body.price), description: req.body.description || null, image_data: req.body.image_data || null }; if (!body.name || body.quantity < 0 || body.price < 0) return res.status(400).json({ error: "تحقق من بيانات المنتج" }); const result = await sb("products", { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify(body) }); json(res, result?.[0] ?? body); } catch { res.status(500).json({ error: "تعذر إضافة المنتج" }); } });
  app.patch("/api/store/admin/products/:id", async (req, res) => { if (!requireAdmin(req, res)) return; try { const body = { name: req.body.name, quantity: Number(req.body.quantity), price: Number(req.body.price), description: req.body.description || null, image_data: req.body.image_data || null }; const result = await sb(`products?id=eq.${encodeURIComponent(req.params.id)}`, { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify(body) }); json(res, result?.[0] ?? body); } catch { res.status(500).json({ error: "تعذر تعديل المنتج" }); } });
  app.delete("/api/store/admin/products/:id", async (req, res) => { if (!requireAdmin(req, res)) return; try { await sb(`products?id=eq.${encodeURIComponent(req.params.id)}`, { method: "DELETE" }); json(res, { ok: true }); } catch { res.status(500).json({ error: "تعذر حذف المنتج" }); } });
  app.post("/api/store/orders", async (req, res) => {
    try {
      const { customer, items } = req.body as { customer: { name: string; phone: string; area: string; location: string; landmark: string }; items: { id: number; name: string; quantity: number; price: number }[] };
      if (!customer?.name || !customer.phone || !customer.area || !customer.location || !customer.landmark || !items?.length) return res.status(400).json({ error: "أكمل معلومات الطلب" });
      if (!["المربد القديم", "المربد الجديد", "حي القائد"].includes(customer.area)) return res.status(400).json({ error: "التوصيل متاح للمناطق المحددة فقط" });
      const products = (await sb(`products?id=in.(${items.map((i) => i.id).join(",")})&select=id,name,quantity,price`)) ?? [];
      for (const item of items) { const product = products.find((p: any) => Number(p.id) === Number(item.id)); if (!product || Number(product.quantity) < Number(item.quantity)) return res.status(409).json({ error: `الكمية غير متوفرة: ${item.name}` }); }
      const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0); const delivery = total > 7000 ? 0 : 1000;
      const order = (await sb("orders", { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify({ customer_name: customer.name, phone: customer.phone, area: customer.area, location: customer.location, landmark: customer.landmark, total, delivery_fee: delivery }) }))?.[0];
      for (const item of items) { await sb(`products?id=eq.${item.id}&quantity=gte.${item.quantity}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ quantity: Math.max(0, (products.find((p: any) => Number(p.id) === Number(item.id))?.quantity ?? item.quantity) - item.quantity), updated_at: new Date().toISOString() }) }); await sb("order_items", { method: "POST", body: JSON.stringify({ order_id: order?.id, product_id: item.id, product_name: item.name, quantity: item.quantity, price: item.price }) }); }
      json(res, { ok: true, order: { ...order, items, total, delivery_fee: delivery }, receipt_id: crypto.randomUUID() });
    } catch { res.status(500).json({ error: "تعذر تثبيت الطلب حالياً" }); }
  });
}
