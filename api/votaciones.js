// Votación del equipo (votar.html). Tablas en backend/votaciones.sql.
// POST /api/votaciones {accion:"crear", opciones:["m04-5","m12-4"], equipo}      -> {id}
// GET  /api/votaciones?id=ID&votante=CLAVE                                        -> opciones, recuento, quién ha votado y su voto
// POST /api/votaciones {accion:"votar", id, opcion, votante, nombre}              -> recuento actualizado
import { configurado, db, json, error, leerJson, token, CATALOGO, limitar, limitarTotal } from "./_lib/comun.js";

const txt = (v, max) => String(v ?? "").replace(/[\u0000-\u001f<>]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
const ID = /^[A-Za-z0-9_-]{20,40}$/, VOTANTE = /^[A-Za-z0-9_-]{16,40}$/;
const MAX_VOTOS = 60;
const noDisponible = () => error("Las votaciones aún no están activadas. Compartid las equipaciones por WhatsApp mientras tanto.", 503);

// "m04-5" -> existe en el catálogo
function opcionValida(o) {
  const m = /^(m\d\d)-(\d{1,2})$/.exec(String(o || ""));
  if (!m) return false;
  const mod = CATALOGO.find((x) => x.id === m[1]);
  return !!mod && +m[2] >= 1 && +m[2] <= mod.colors.length;
}

async function estado(id, votante) {
  const { data: v, error: e1 } = await db().from("votaciones").select("id, equipo, opciones, creado").eq("id", id).maybeSingle();
  if (e1) { console.error(e1); return { fallo: noDisponible() }; }
  if (!v) return { fallo: error("No encontramos esta votación. Revisa el enlace.", 404) };
  const { data: votos, error: e2 } = await db().from("votos").select("votante, nombre, opcion, creado").eq("votacion_id", id).order("creado");
  if (e2) { console.error(e2); return { fallo: noDisponible() }; }
  const recuento = Object.fromEntries(v.opciones.map((o) => [o, { votos: 0, nombres: [] }]));
  for (const x of votos) if (recuento[x.opcion]) { recuento[x.opcion].votos++; if (x.nombre) recuento[x.opcion].nombres.push(x.nombre); }
  const mio = votos.find((x) => x.votante === votante);
  return { datos: { id: v.id, equipo: v.equipo, opciones: v.opciones, recuento, total: votos.length, mi_voto: mio ? mio.opcion : null, mi_nombre: mio ? mio.nombre : "" } };
}

export async function GET(req) {
  if (!configurado.db) return noDisponible();
  const q = new URL(req.url).searchParams, id = q.get("id") || "", votante = q.get("votante") || "";
  if (!ID.test(id)) return error("Enlace de votación no válido.", 404);
  const l = await limitar(req, "ver-votacion", 120, 15); if (l) return l;
  const r = await estado(id, VOTANTE.test(votante) ? votante : "");
  return r.fallo || json(r.datos);
}

export async function POST(req) {
  if (!configurado.db) return noDisponible();
  let b;
  try { b = await leerJson(req, 4096); } catch (e) { return error(e.message); }

  if (b.accion === "crear") {
    const l = (await limitar(req, "votacion", 10, 60)) || (await limitarTotal("votacion", 300, 1440)); if (l) return l;
    const opciones = [...new Set((Array.isArray(b.opciones) ? b.opciones : []).map(String))].filter(opcionValida).slice(0, 4);
    if (opciones.length < 2) return error("Elige al menos 2 equipaciones para votar.");
    const fila = { id: token(), equipo: txt(b.equipo, 40), opciones };
    const { error: e } = await db().from("votaciones").insert(fila);
    if (e) { console.error(e); return noDisponible(); }
    return json({ id: fila.id });
  }

  if (b.accion === "votar") {
    const l = await limitar(req, "voto", 60, 60); if (l) return l;
    const id = String(b.id || ""), votante = String(b.votante || ""), opcion = String(b.opcion || "");
    if (!ID.test(id) || !VOTANTE.test(votante)) return error("Datos no válidos.");
    const r = await estado(id, votante);
    if (r.fallo) return r.fallo;
    if (!r.datos.opciones.includes(opcion)) return error("Esa equipación no está en la votación.");
    if (!r.datos.mi_voto && r.datos.total >= MAX_VOTOS) return error("Esta votación ya está completa.", 409);
    const { error: e } = await db().from("votos").upsert({ votacion_id: id, votante, nombre: txt(b.nombre, 30), opcion, creado: new Date().toISOString() }, { onConflict: "votacion_id,votante" });
    if (e) { console.error(e); return error("No se ha podido guardar el voto. Inténtalo otra vez.", 500); }
    const r2 = await estado(id, votante);
    return r2.fallo || json(r2.datos);
  }

  return error("Acción no válida.");
}
