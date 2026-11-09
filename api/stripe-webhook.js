// POST /api/stripe-webhook: Stripe avisa aquí cuando un pago se completa. Marca el pedido como pagado y guarda la dirección de envío.
// En Stripe: Desarrolladores > Webhooks > añadir este endpoint con los eventos checkout.session.completed y checkout.session.async_payment_succeeded.
import { ENV, configurado, db, stripe, json, error } from "./_lib/comun.js";
import { avisarCliente } from "./_lib/correo.js";

export async function POST(req) {
  if (!configurado.db || !configurado.pagos || !ENV.STRIPE_WEBHOOK_SECRET) return error("Sin configurar", 503);
  const cuerpo = await req.text();
  let ev;
  try {
    ev = await stripe().webhooks.constructEventAsync(cuerpo, req.headers.get("stripe-signature"), ENV.STRIPE_WEBHOOK_SECRET);
  } catch (e) {
    return error("Firma no válida", 400);
  }
  if (ev.type !== "checkout.session.completed" && ev.type !== "checkout.session.async_payment_succeeded") return json({ ok: true });
  const s = ev.data.object;
  if (s.payment_status !== "paid" || !s.metadata || !s.metadata.pedido) return json({ ok: true });

  const det = (s.collected_information && s.collected_information.shipping_details) || s.shipping_details || {};
  const cd = s.customer_details || {};
  const envio = {
    nombre: det.name || cd.name || "", telefono: cd.phone || "", email: cd.email || "",
    direccion: det.address || cd.address || null
  };
  const { data: hechos, error: e } = await db().from("pedidos")
    .update({ estado: "pagado", pagado: new Date().toISOString(), envio, stripe_session: s.id, actualizado: new Date().toISOString() })
    .eq("codigo", s.metadata.pedido).in("estado", ["nuevo", "boceto"]).select("*");
  if (e) { console.error(e); return error("No se ha podido guardar", 500); } // Stripe lo reintenta
  if (hechos && hechos[0]) await avisarCliente("pagado", hechos[0]); // solo la primera vez: los reintentos ya no cambian nada
  return json({ ok: true });
}
