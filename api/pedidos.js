// POST /api/pedidos: guarda el pedido que manda la web. Aún no se cobra: primero va el boceto.
import { BRAND, CATALOGO, configurado, db, json, error, sinConfigurar, leerJson, token, lineas, RUTA_SUBIDA, SITE, MINIMO_MEDIDA, MINIMO_PEDIDO, limitar, limitarTotal } from "./_lib/comun.js";
import { avisarCliente, avisarTienda } from "./_lib/correo.js";

const PATRONES = ["lisa", "banda", "aros", "rayas", "mitades", "faja", "corte", "laterales", "tarjetas"];
const HEX = /^#[0-9A-Fa-f]{6}$/;
const POS_PATRO = ["pecho", "espalda", "manga-izq", "manga-der"];
const txt = (v, max) => String(v ?? "").replace(/[\u0000-\u001f]/g, " ").trim().slice(0, max);

function diseno(d) {
  d = d || {};
  if (d.tipo === "catalogo") {
    const m = CATALOGO.find((x) => x.id === d.modelo);
    const c = Number(d.color);
    if (!m || !Number.isInteger(c) || c < 0 || c >= m.colors.length) throw new Error("El modelo elegido no existe.");
    return { tipo: "catalogo", modelo: m.id, color: c, patrocinador_pos: POS_PATRO.includes(d.patrocinador_pos) ? d.patrocinador_pos : "pecho" };
  }
  if (d.tipo === "medida") {
    const col = (v, def) => (HEX.test(v || "") ? v.toUpperCase() : def);
    return {
      tipo: "medida", patron: PATRONES.includes(d.patron) ? d.patron : "lisa",
      c1: col(d.c1, "#FFFFFF"), c2: col(d.c2, "#FFFFFF"), c3: col(d.c3, "#FFFFFF"),
      tinta: col(d.tinta, ""), contorno: col(d.contorno, ""), idea: txt(d.idea, 600),
      patrocinador_pos: POS_PATRO.includes(d.patrocinador_pos) ? d.patrocinador_pos : "pecho"
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
  // 5 pedidos por hora por conexión y 60 al día en total
  const l = (await limitar(req, "pedido", 5, 60)) || (await limitarTotal("pedido", 60, 1440)); if (l) return l;

  try {
    const c = b.cliente || {};
    const cliente = { nombre: txt(c.nombre, 80), telefono: txt(c.telefono, 24), email: txt(c.email, 120).toLowerCase() };
    if (!cliente.nombre) throw new Error("Falta tu nombre.");
    if (cliente.telefono.replace(/\D/g, "").length < 9) throw new Error("Pon un teléfono con WhatsApp para mandarte el boceto.");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(cliente.email)) throw new Error("El email no parece correcto.");
    const d = diseno(b.diseno), pl = plantilla(b.plantilla);
    if (pl.length < MINIMO_PEDIDO) throw new Error("El pedido mínimo es de " + MINIMO_PEDIDO + " camisetas.");
    if (d.tipo === "medida" && pl.length < MINIMO_MEDIDA) throw new Error("El diseño a medida es a partir de " + MINIMO_MEDIDA + " camisetas.");
    const ruta = (v) => (v && RUTA_SUBIDA.test(v) ? v : null);
    // Segundo patrocinador (opcional): va dentro de "diseno" para no tocar la tabla
    const p2 = b.patrocinador2;
    if (p2 && typeof p2 === "object" && (txt(p2.texto, 40) || ruta(p2.logo))) {
      d.patrocinador2 = { texto: txt(p2.texto, 40), pos: POS_PATRO.includes(p2.pos) && p2.pos !== d.patrocinador_pos ? p2.pos : POS_PATRO.find((x) => x !== d.patrocinador_pos), logo: ruta(p2.logo) };
    }
    const fila = {
      token: token(), cliente, equipo: txt(b.equipo, 28), diseno: d, patrocinador: txt(b.patrocinador, 40),
      escudo: ruta(b.escudo), logo_patrocinador: ruta(b.logo_patrocinador), plantilla: pl,
      ...lineas(pl, d.tipo)
    };
    const { data, error: e } = await db().from("pedidos").insert(fila).select("codigo, token, total_cent").single();
    if (e) throw Object.assign(new Error("No se ha podido guardar el pedido."), { interno: e });
    const p = { ...fila, codigo: data.codigo };
    await Promise.all([avisarCliente("recibido", p), avisarTienda(p)]);
    return json({ codigo: data.codigo, total_cent: data.total_cent, enlace: SITE + "/pedido.html?t=" + data.token });
  } catch (e) {
    if (e.interno) { console.error(e.interno); return error(e.message, 500); }
    return error(e.message);
  }
}
