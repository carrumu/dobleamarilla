// Página del cliente (pedido.html). Se entra con el enlace secreto que le mandamos por WhatsApp y por correo.
// GET  /api/cliente?t=TOKEN                                      -> estado del pedido, boceto, total y su reseña
// POST /api/cliente {t, accion:"pagar"}                          -> enlace de pago de Stripe (solo con el boceto enviado)
// POST /api/cliente {t, accion:"resena", nombre, estrellas, texto} -> guarda su reseña (pedido enviado o entregado)
import { configurado, db, stripe, json, error, sinConfigurar, leerJson, vistaCliente, codigoDiseno, SITE } from "./_lib/comun.js";

const PUEDE_OPINAR = ["enviado", "entregado"];
const txt = (v, max) => String(v ?? "").replace(/[\u0000-\u001f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);

async function buscar(t) {
  if (!t || !/^[A-Za-z0-9_-]{20,40}$/.test(t)) return null;
  const { data } = await db().from("pedidos").select("*").eq("token", t).maybeSingle();
  return data;
}
async function suResena(num) {
  const { data, error: e } = await db().from("resenas").select("nombre, estrellas, texto, aprobada").eq("pedido_num", num).maybeSingle();
  return e ? null : data; // sin tabla todavía: como si no hubiera reseña
}

export async function GET(req) {
  if (!configurado.db) return sinConfigurar();
  const p = await buscar(new URL(req.url).searchParams.get("t"));
  if (!p) return error("No encontramos este pedido. Revisa el enlace.", 404);
  const v = await vistaCliente(p);
  v.puede_opinar = PUEDE_OPINAR.includes(p.estado);
  v.resena = v.puede_opinar ? await suResena(p.num) : null;
  v.nombre_cliente = (p.cliente && p.cliente.nombre) || "";
  return json(v);
}

async function resena(p, b) {
  if (!PUEDE_OPINAR.includes(p.estado)) return error("Podrás opinar cuando te llegue el pedido.", 409);
  const estrellas = Number(b.estrellas);
  if (!Number.isInteger(estrellas) || estrellas < 1 || estrellas > 5) return error("Elige de 1 a 5 estrellas.");
  const texto = txt(b.texto, 600), nombre = txt(b.nombre, 40);
  if (texto.length < 10) return error("Cuéntanos un poco más (mínimo 10 letras).");
  if (!nombre) return error("Pon el nombre con el que quieres que salga.");
  const fila = { pedido_num: p.num, nombre, equipo: txt(p.equipo, 28), estrellas, texto, aprobada: false, creado: new Date().toISOString() };
  const { error: e } = await db().from("resenas").upsert(fila, { onConflict: "pedido_num" });
  if (e) { console.error(e); return error("No se ha podido guardar. Inténtalo más tarde.", 500); }
  return json({ ok: true });
}

async function pagar(p) {
  if (!configurado.pagos) return error("El pago con tarjeta aún no está activado. Escríbenos por WhatsApp.", 503);
  if (p.estado !== "boceto") return error(p.pagado ? "Este pedido ya está pagado." : "Aún no te hemos mandado el boceto.", 409);
  if (!p.total_cent) return error("Aún estamos cerrando el precio contigo por WhatsApp.", 409);

  const nombre = codigoDiseno(p.diseno);
  const volver = SITE + "/pedido.html?t=" + p.token;
  try {
    const s = await stripe().checkout.sessions.create({
      mode: "payment",
      locale: "es",
      customer_email: p.cliente.email || undefined,
      client_reference_id: p.codigo,
      metadata: { pedido: p.codigo },
      payment_intent_data: { metadata: { pedido: p.codigo }, description: "Pedido " + p.codigo + " · " + (p.equipo || "equipo") },
      shipping_address_collection: { allowed_countries: ["ES"] },
      phone_number_collection: { enabled: true },
      line_items: p.lineas.map((l) => ({
        quantity: l.cantidad,
        price_data: { currency: "eur", unit_amount: l.unidad_cent, product_data: { name: l.concepto + " " + nombre, description: "Pedido " + p.codigo + (p.equipo ? " · " + p.equipo : "") + ". Escudo, patrocinador, nombre y dorsal incluidos. Envío incluido." } }
      })),
      success_url: volver + "&pagado=1",
      cancel_url: volver
    });
    await db().from("pedidos").update({ stripe_session: s.id, actualizado: new Date().toISOString() }).eq("num", p.num);
    return json({ url: s.url });
  } catch (e) {
    console.error(e);
    return error("No se ha podido abrir el pago. Inténtalo otra vez o escríbenos.", 502);
  }
}

export async function POST(req) {
  if (!configurado.db) return sinConfigurar();
  let b;
  try { b = await leerJson(req, 4096); } catch (e) { return error(e.message); }
  const p = await buscar(b.t);
  if (!p) return error("No encontramos este pedido.", 404);
  if (b.accion === "resena") return resena(p, b);
  return pagar(p);
}
