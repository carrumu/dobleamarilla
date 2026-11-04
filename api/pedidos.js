// POST /api/pedidos: guarda el pedido que manda la web. Aún no se cobra: primero va el boceto.
import { BRAND, CATALOGO, configurado, db, json, error, sinConfigurar, leerJson, token, lineas, RUTA_SUBIDA, SITE } from "./_lib/comun.js";

const PATRONES = ["lisa", "banda", "aros", "rayas", "mitades", "faja", "corte", "laterales", "tarjetas"];
const HEX = /^#[0-9A-Fa-f]{6}$/;
const txt = (v, max) => String(v ?? "").replace(/[\u0000-\u001f]/g, " ").trim().slice(0, max);

function diseno(d) {
  d = d || {};
  if (d.tipo === "catalogo") {
    const m = CATALOGO.find((x) => x.id === d.modelo);
    const c = Number(d.color);
    if (!m || !Number.isInteger(c) || c < 0 || c >= m.colors.length) throw new Error("El modelo elegido no existe.");
    return { tipo: "catalogo", modelo: m.id, color: c };
  }
  if (d.tipo === "medida") {
    const col = (v, def) => (HEX.test(v || "") ? v.toUpperCase() : def);
    return {
      tipo: "medida", patron: PATRONES.includes(d.patron) ? d.patron : "lisa",
      c1: col(d.c1, "#FFFFFF"), c2: col(d.c2, "#FFFFFF"), c3: col(d.c3, "#FFFFFF"),
      tinta: col(d.tinta, ""), contorno: col(d.contorno, ""), idea: txt(d.idea, 600)
    };
  }
  throw new Error("Elige un modelo del catálogo o tu diseño a medida.");
}

function plantilla(rows) {
  if (!Array.isArray(rows) || !rows.length) throw new Error("Añade al menos un jugador.");
  if (rows.length > 80) throw new Error("Máximo 80 jugadores por pedido. Para más, escríbenos.");
  return rows.map((r) => {
    const talla = BRAND.sizes.includes(r.talla) ? r.talla : null;
    if (!talla) throw new Error("Hay una talla que no existe.");
    return { nombre: txt(r.nombre, 14), dorsal: String(r.dorsal ?? "").replace(/\D/g, "").slice(0, 2), talla, pieza: r.pieza === "shirt" ? "shirt" : "kit" };
  });
}

export async function POST(req) {
  if (!configurado.db) return sinConfigurar();
  let b;
  try { b = await leerJson(req); } catch (e) { return error(e.message); }
  if (b.web) return json({ ok: true }); // campo trampa: solo lo rellenan los bots

  try {
    const c = b.cliente || {};
    const cliente = { nombre: txt(c.nombre, 80), telefono: txt(c.telefono, 24), email: txt(c.email, 120).toLowerCase() };
    if (!cliente.nombre) throw new Error("Falta tu nombre.");
    if (cliente.telefono.replace(/\D/g, "").length < 9) throw new Error("Pon un teléfono con WhatsApp para mandarte el boceto.");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(cliente.email)) throw new Error("El email no parece correcto.");
    const d = diseno(b.diseno), pl = plantilla(b.plantilla);
    const ruta = (v) => (v && RUTA_SUBIDA.test(v) ? v : null);
    const fila = {
      token: token(), cliente, equipo: txt(b.equipo, 28), diseno: d, patrocinador: txt(b.patrocinador, 40),
      escudo: ruta(b.escudo), logo_patrocinador: ruta(b.logo_patrocinador), plantilla: pl,
      ...lineas(pl, d.tipo)
    };
    const { data, error: e } = await db().from("pedidos").insert(fila).select("codigo, token, total_cent").single();
    if (e) throw Object.assign(new Error("No se ha podido guardar el pedido."), { interno: e });
    return json({ codigo: data.codigo, total_cent: data.total_cent, enlace: SITE + "/pedido.html?t=" + data.token });
  } catch (e) {
    if (e.interno) { console.error(e.interno); return error(e.message, 500); }
    return error(e.message);
  }
}
