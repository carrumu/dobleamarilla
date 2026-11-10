// Correos automáticos con Resend (https://resend.com). Sin RESEND_API_KEY no se manda nada y el pedido sigue igual.
// Variables en Vercel: RESEND_API_KEY (obligatoria), CORREO_REMITENTE (por defecto "Doble Amarilla <pedidos@dobleeamarilla.com>"),
// CORREO_RESPUESTA (a dónde contestan los clientes, por defecto info@dobleeamarilla.com) y CORREO_AVISOS (a quién avisar de pedidos nuevos).
import { ENV, SITE, codigoDiseno } from "./comun.js";

const REMITENTE = () => ENV.CORREO_REMITENTE || "Doble Amarilla <pedidos@dobleeamarilla.com>";
const RESPUESTA = () => ENV.CORREO_RESPUESTA || "info@dobleeamarilla.com";
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const eur = (c) => (c / 100).toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
export const correoActivo = () => !!ENV.RESEND_API_KEY;

// Plantilla sencilla, legible en cualquier cliente de correo. Sin imágenes externas salvo el logo.
function plantilla({ titulo, parrafos, boton, pie }) {
  const ps = parrafos.map((p) => `<p style="margin:0 0 14px;font-size:16px;line-height:1.5;color:#2b2b29">${p}</p>`).join("");
  const btn = boton ? `<p style="margin:24px 0"><a href="${esc(boton.url)}" style="display:inline-block;background:#111110;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:14px 24px;border-radius:10px">${esc(boton.texto)}</a></p>` : "";
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head><body style="margin:0;background:#f4f4f2;font-family:Arial,Helvetica,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f2;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;padding:32px 28px">
<tr><td><img src="${SITE}/img/logo.png" alt="Doble Amarilla" width="180" height="30" style="display:block;margin:0 0 24px;border:0">
<h1 style="margin:0 0 16px;font-size:24px;line-height:1.2;color:#111110">${esc(titulo)}</h1>${ps}${btn}
<p style="margin:24px 0 0;font-size:13px;line-height:1.5;color:#6b6a65">${pie || "Si tienes cualquier duda, contesta a este correo o escríbenos por WhatsApp al +34 684 315 503."}</p>
</td></tr></table>
<p style="font-size:12px;color:#8a8984;margin:16px 0 0">Doble Amarilla · <a href="${SITE}" style="color:#8a8984">dobleeamarilla.com</a></p>
</td></tr></table></body></html>`;
}

// Envía sin bloquear más de 5 s. Nunca lanza: un fallo de correo no puede romper un pedido.
export async function enviar({ para, asunto, html, texto }) {
  if (!correoActivo() || !para) return false;
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 5000);
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST", signal: ctl.signal,
      headers: { authorization: "Bearer " + ENV.RESEND_API_KEY, "content-type": "application/json" },
      body: JSON.stringify({ from: REMITENTE(), to: [para], reply_to: RESPUESTA(), subject: asunto, html, text: texto })
    });
    if (!r.ok) console.error("Resend", r.status, await r.text());
    return r.ok;
  } catch (e) {
    console.error("Resend", e.message);
    return false;
  } finally { clearTimeout(t); }
}

const enlace = (p) => SITE + "/pedido.html?t=" + p.token;
const nombre = (p) => ((p.cliente && p.cliente.nombre) || "").split(" ")[0] || "equipo";
const deEquipo = (p) => (p.equipo ? " de " + esc(p.equipo) : "");

// Correos al cliente según el momento del pedido
const MENSAJES = {
  recibido: (p) => ({
    asunto: `Hemos recibido tu pedido ${p.codigo}`,
    titulo: `Pedido ${p.codigo} recibido`,
    parrafos: [`Hola, ${esc(nombre(p))}. Tenemos el pedido${deEquipo(p)}: ${esc(codigoDiseno(p.diseno))}, ${p.plantilla.length} jugadores.`,
      "Ahora preparamos tu boceto y te avisamos cuando esté. No pagas nada hasta que lo apruebes."],
    boton: { texto: "Ver mi pedido", url: enlace(p) }
  }),
  boceto: (p) => ({
    asunto: `Tu boceto del pedido ${p.codigo} está listo`,
    titulo: "Tu boceto está listo",
    parrafos: [`Hola, ${esc(nombre(p))}. Ya puedes ver la propuesta de la equipación${deEquipo(p)}.`,
      p.total_cent ? `Si te gusta, apruébala desde el enlace. Total: <b>${eur(p.total_cent)}</b>, envío incluido. Puedes pagar por Bizum, transferencia o tarjeta.`
        : "Si quieres cambiar algo, dínoslo y lo ajustamos."],
    boton: { texto: "Ver el boceto", url: enlace(p) }
  }),
  pagado: (p) => ({
    asunto: `Pago recibido · pedido ${p.codigo}`,
    titulo: "Pago recibido. Gracias.",
    parrafos: [`Hola, ${esc(nombre(p))}. Hemos recibido el pago del pedido ${p.codigo}${p.total_cent ? ` (${eur(p.total_cent)})` : ""}.`,
      "Lo pasamos a fabricación. Te avisamos cuando salga hacia tu casa."],
    boton: { texto: "Ver mi pedido", url: enlace(p) }
  }),
  enviado: (p) => ({
    asunto: `Tu pedido ${p.codigo} va de camino`,
    titulo: "Tu pedido va de camino",
    parrafos: [`Hola, ${esc(nombre(p))}. La equipación${deEquipo(p)} ya ha salido.`,
      p.seguimiento ? `Seguimiento: <b>${esc(p.seguimiento)}</b>` : "Te pasamos el seguimiento en cuanto lo tengamos."],
    boton: { texto: "Ver mi pedido", url: enlace(p) }
  }),
  entregado: (p) => ({
    asunto: `¿Qué tal la equipación${p.equipo ? " del " + p.equipo : ""}?`,
    titulo: "¿Qué os ha parecido?",
    parrafos: [`Hola, ${esc(nombre(p))}. Esperamos que la equipación${deEquipo(p)} os quede genial.`,
      "Nos ayudarías mucho con tu opinión: son dos minutos y la verán otros equipos."],
    boton: { texto: "Dejar mi opinión", url: enlace(p) + "#opinion" }
  })
};

export async function avisarCliente(momento, p) {
  const m = MENSAJES[momento] && MENSAJES[momento](p);
  if (!m || !p.cliente || !p.cliente.email) return false;
  const texto = m.parrafos.map((x) => x.replace(/<[^>]+>/g, "")).join("\n\n") + (m.boton ? "\n\n" + m.boton.texto + ": " + m.boton.url : "");
  return enviar({ para: p.cliente.email, asunto: m.asunto, html: plantilla(m), texto });
}

// Aviso interno a Carlos de un pedido nuevo
export async function avisarTienda(p) {
  const para = ENV.CORREO_AVISOS || RESPUESTA();
  const c = p.cliente || {};
  const lineas = [`${esc(codigoDiseno(p.diseno))} · ${p.plantilla.length} jugadores${p.equipo ? " · " + esc(p.equipo) : ""}`,
    `${esc(c.nombre)} · ${esc(c.telefono)} · ${esc(c.email)}`];
  return enviar({ para, asunto: `Pedido nuevo ${p.codigo}`, html: plantilla({ titulo: `Pedido nuevo ${p.codigo}`, parrafos: lineas, boton: { texto: "Abrir el panel", url: SITE + "/panel.html" }, pie: "Aviso automático de la web." }),
    texto: lineas.join("\n").replace(/&[a-z#0-9]+;/g, "") + "\n\n" + SITE + "/panel.html" });
}

// Botón "Probar correo" del panel: manda un correo de prueba y devuelve el motivo si Resend lo rechaza
export async function correoPrueba() {
  if (!correoActivo()) return { ok: false, motivo: "Falta la variable RESEND_API_KEY en Vercel (y volver a desplegar)." };
  const para = ENV.CORREO_AVISOS || RESPUESTA();
  const html = plantilla({ titulo: "Correo de prueba", parrafos: ["Si lees esto, los correos automáticos de la tienda funcionan.", "Remitente: " + esc(REMITENTE()) + "."], pie: "Prueba lanzada desde el panel." });
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: "Bearer " + ENV.RESEND_API_KEY, "content-type": "application/json" },
      body: JSON.stringify({ from: REMITENTE(), to: [para], reply_to: RESPUESTA(), subject: "Prueba de correo · Doble Amarilla", html, text: "Si lees esto, los correos automáticos funcionan." })
    });
    if (r.ok) return { ok: true, para };
    const j = await r.json().catch(() => ({}));
    return { ok: false, para, motivo: "Resend dice: " + (j.message || r.status) };
  } catch (e) {
    return { ok: false, para, motivo: "No se ha podido conectar con Resend: " + e.message };
  }
}
