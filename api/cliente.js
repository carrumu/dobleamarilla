// Página del cliente (pedido.html). Se entra con el enlace secreto que le mandamos por WhatsApp.
// GET  /api/cliente?t=TOKEN          -> estado del pedido, boceto y total
// POST /api/cliente {t, accion:"pagar"} -> enlace de pago de Stripe (solo con el boceto enviado)
import { configurado, db, stripe, json, error, sinConfigurar, leerJson, vistaCliente, codigoDiseno, SITE } from "./_lib/comun.js";

async function buscar(t) {
  if (!t || !/^[A-Za-z0-9_-]{20,40}$/.test(t)) return null;
  const { data } = await db().from("pedidos").select("*").eq("token", t).maybeSingle();
  return data;
}

export async function GET(req) {
  if (!configurado.db) return sinConfigurar();
  const p = await buscar(new URL(req.url).searchParams.get("t"));
  if (!p) return error("No encontramos este pedido. Revisa el enlace.", 404);
  return json(await vistaCliente(p));
}

export async function POST(req) {
  if (!configurado.db) return sinConfigurar();
  if (!configurado.pagos) return error("El pago online aún no está activado. Escríbenos por WhatsApp.", 503);
  let b;
  try { b = await leerJson(req, 1024); } catch (e) { return error(e.message); }
  const p = await buscar(b.t);
  if (!p) return error("No encontramos este pedido.", 404);
  if (p.estado !== "boceto") return error(p.pagado ? "Este pedido ya está pagado." : "Aún no te hemos mandado el boceto.", 409);

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
