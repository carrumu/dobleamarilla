// Código compartido por las funciones de api/. Los archivos con _ delante no son funciones.
// Claves en las variables de entorno de Vercel (ver ../../README.md), nunca en el código: el repositorio es público.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import vm from "node:vm";
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";

// Nombres de variable sin distinguir mayúsculas: en Vercel se dieron de alta en minúsculas
export const ENV = Object.fromEntries(Object.entries(process.env).map(([k, v]) => [k.trim().toUpperCase(), (v || "").trim()]));
// La clave de Supabase se dio de alta también como supabase_private_key
ENV.SUPABASE_SECRET_KEY ||= ENV.SUPABASE_PRIVATE_KEY || "";
export const SITE = (ENV.SITE_URL || "https://www.dobleeamarilla.com").replace(/\/$/, "");

// Precios, tallas y catálogo salen de los mismos archivos que usa la web: un solo sitio donde cambiarlos
function cargar(archivo) {
  const ctx = { window: {} };
  vm.runInNewContext(readFileSync(join(process.cwd(), "lib", archivo), "utf8"), ctx);
  return ctx.window;
}
const W = { ...cargar("manifest.js"), ...cargar("catalogo.js") };
export const BRAND = W.__BRAND__;
export const CATALOGO = W.__CATALOGO__;

export const configurado = {
  db: !!(ENV.SUPABASE_URL && ENV.SUPABASE_SECRET_KEY),
  pagos: !!ENV.STRIPE_SECRET_KEY,
  panel: !!(ENV.ADMIN_PASSWORD && ENV.ADMIN_PASSWORD.length >= 10)
};
let _db, _stripe;
export function db() {
  return _db ||= createClient(ENV.SUPABASE_URL.replace(/\/(rest\/v1)?\/?$/, ""), ENV.SUPABASE_SECRET_KEY.replace(/\s+/g, ""), { auth: { persistSession: false } });
}
export function stripe() { return _stripe ||= new Stripe(ENV.STRIPE_SECRET_KEY); }

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
}
export const error = (msg, status = 400) => json({ error: msg }, status);
export const sinConfigurar = () => error("La tienda online aún no está activada.", 503);

// Solo se aceptan envíos desde nuestra propia web (o sus vistas previas y local). Frena que otra web
// mande pedidos, votos o subidas en nombre de quien la visita.
const ORIGENES = [SITE, "https://www.dobleeamarilla.com", "https://dobleeamarilla.com"];
export function origenPermitido(req) {
  const o = req.headers.get("origin");
  if (!o) return req.headers.get("sec-fetch-site") !== "cross-site";
  return ORIGENES.includes(o) || /^https:\/\/dobleamarilla[a-z0-9-]*\.vercel\.app$/.test(o) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(o);
}

export async function leerJson(req, max = 64 * 1024) {
  if (!origenPermitido(req)) throw new Error("Origen no permitido.");
  const largo = Number(req.headers.get("content-length") || 0);
  if (largo > max) throw new Error("Demasiados datos.");
  const t = await req.text();
  if (t.length > max) throw new Error("Demasiados datos.");
  try { return JSON.parse(t || "{}"); } catch { throw new Error("Datos no válidos."); }
}

export const token = () => randomBytes(18).toString("base64url");

// Límite de intentos por conexión: como mucho "max" veces cada "minutos". Se guarda una huella cifrada de la IP,
// nunca la IP. Tabla y función en backend/limites.sql; si aún no existen, no se limita (la web sigue funcionando).
let avisoLimites = false;
export async function limitar(req, accion, max, minutos) {
  if (!configurado.db) return null;
  const ip = (req.headers.get("x-real-ip") || (req.headers.get("x-forwarded-for") || "").split(",")[0] || "desconocida").trim();
  const huella = createHmac("sha256", "limite:" + ENV.SUPABASE_SECRET_KEY).update(ip).digest("base64url").slice(0, 22);
  return contar(accion + ":" + huella, max, minutos);
}
// Límite total de una acción, venga de donde venga (por si atacan desde muchas IP a la vez)
export async function limitarTotal(accion, max, minutos) {
  if (!configurado.db) return null;
  return contar(accion + ":total", max, minutos);
}
async function contar(clave, max, minutos) {
  try {
    const { data, error: e } = await db().rpc("limite_sumar", { p_clave: clave, p_ventana: Math.floor(Date.now() / (minutos * 60000)) });
    if (e) { if (!avisoLimites) { console.warn("Límites sin activar (backend/limites.sql):", e.message); avisoLimites = true; } return null; }
    if (data > max) return new Response(JSON.stringify({ error: "Demasiados intentos. Espera unos minutos y vuelve a probar." }),
      { status: 429, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "retry-after": String(minutos * 60) } });
  } catch (e) { console.error(e); }
  return null;
}

// Archivos: los logos los sube el cliente antes de que exista el pedido, en tmp/
export const MIMES = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "application/pdf": "pdf" };
export const RUTA_SUBIDA = /^tmp\/[A-Za-z0-9_-]{24}\.(png|jpg|webp|pdf)$/;
export async function urlFirmada(bucket, ruta, segundos = 3600) {
  if (!ruta) return null;
  const { data } = await db().storage.from(bucket).createSignedUrl(ruta, segundos);
  return data ? data.signedUrl : null;
}

// Precio: siempre calculado aquí, nunca el que manda el navegador
export function precio(pieza, tipo) {
  const P = BRAND.prices;
  return P[(pieza === "kit" ? "kit" : "shirt") + (tipo === "medida" ? "Custom" : "Std")];
}
export const cent = (eur) => Math.round(eur * 100);
// Diseño a medida: mínimo de camisetas y precio que se cierra por WhatsApp (lo pone Carlos en el panel)
export const MINIMO_MEDIDA = 10;
// Pedido mínimo para cualquier pedido, de catálogo o a medida (proveedor, 2026-11-09)
export const MINIMO_PEDIDO = 10;
// Precio por unidad en céntimos; sin precios (a medida recién pedido) las líneas van sin importe y el total a 0
export function lineas(plantilla, tipo, precios) {
  const kits = plantilla.filter((r) => r.pieza === "kit").length, camis = plantilla.length - kits;
  const pk = precios ? precios.kit : tipo === "medida" ? null : cent(precio("kit", tipo));
  const ps = precios ? precios.camiseta : tipo === "medida" ? null : cent(precio("shirt", tipo));
  const L = [];
  if (kits) L.push({ concepto: "Equipación completa", cantidad: kits, unidad_cent: pk });
  if (camis) L.push({ concepto: "Camiseta sola", cantidad: camis, unidad_cent: ps });
  return { lineas: L, total_cent: L.some((l) => l.unidad_cent == null) ? 0 : L.reduce((s, l) => s + l.cantidad * l.unidad_cent, 0) };
}

export function codigoDiseno(d) {
  if (d.tipo !== "catalogo") return "A medida";
  const m = CATALOGO.find((x) => x.id === d.modelo);
  return m ? m.name + "-" + (d.color + 1) : d.modelo;
}

// Lo que ve el cliente de su pedido (sin notas internas ni datos de pago)
export async function vistaCliente(p) {
  return {
    codigo: p.codigo, estado: p.estado, creado: p.creado, equipo: p.equipo, diseno: codigoDiseno(p.diseno),
    tipo: p.diseno.tipo, precio_pendiente: !p.total_cent, patrocinador: p.patrocinador, plantilla: p.plantilla, lineas: p.lineas, total_cent: p.total_cent,
    boceto: await urlFirmada("bocetos", p.boceto), boceto_pdf: !!(p.boceto && p.boceto.endsWith(".pdf")),
    pagado: p.pagado, seguimiento: p.seguimiento, whatsapp: BRAND.whatsapp
  };
}

// Panel: sesión firmada con la contraseña, caduca a las 8 horas. Cambiar ADMIN_PASSWORD cierra todas las sesiones
const firmar = (s) => createHmac("sha256", "panel:" + ENV.ADMIN_PASSWORD).update(s).digest("base64url");
export function crearSesion() {
  const exp = String(Date.now() + 8 * 3600 * 1000);
  return exp + "." + firmar(exp);
}
export function sesionValida(req) {
  if (!configurado.panel) return false;
  const t = (req.headers.get("authorization") || "").replace(/^Bearer /, "");
  const [exp, sig] = t.split(".");
  if (!/^\d{13}$/.test(exp || "") || !sig || +exp < Date.now() || +exp > Date.now() + 8 * 3600 * 1000) return false;
  const a = Buffer.from(sig), b = Buffer.from(firmar(exp));
  return a.length === b.length && timingSafeEqual(a, b);
}
export function claveCorrecta(clave) {
  const a = createHmac("sha256", "k").update(String(clave || "")).digest();
  const b = createHmac("sha256", "k").update(ENV.ADMIN_PASSWORD).digest();
  return timingSafeEqual(a, b);
}

// Referencias del proveedor por código (DA01 -> ref). Solo en la variable de entorno MODEL_REFS: no se publican
export function refsProveedor() {
  try { return JSON.parse(ENV.MODEL_REFS || "{}"); } catch { return {}; }
}
