// POST /api/admin {accion, ...}: todo lo del panel (panel.html). Menos la entrada, pide la sesión firmada.
import { configurado, db, json, error, sinConfigurar, leerJson, crearSesion, sesionValida, claveCorrecta,
  urlFirmada, codigoDiseno, refsProveedor, token, MIMES, SITE } from "./_lib/comun.js";

const ESTADOS = ["nuevo", "boceto", "pagado", "fabricacion", "enviado", "entregado", "cancelado"];
const ahora = () => new Date().toISOString();

const acciones = {
  async entrar(b) {
    await new Promise((r) => setTimeout(r, 400)); // frena a quien pruebe contraseñas
    if (!claveCorrecta(b.clave)) return error("Contraseña incorrecta.", 401);
    return json({ sesion: crearSesion() });
  },

  async lista(b) {
    let q = db().from("pedidos").select("num, codigo, creado, estado, equipo, cliente, diseno, total_cent, plantilla, pagado").order("num", { ascending: false }).limit(300);
    if (ESTADOS.includes(b.estado)) q = q.eq("estado", b.estado);
    const { data, error: e } = await q;
    if (e) throw e;
    return json({ pedidos: data.map((p) => ({ ...p, diseno: codigoDiseno(p.diseno), jugadores: p.plantilla.length, plantilla: undefined })) });
  },

  async ver(b) {
    const { data: p, error: e } = await db().from("pedidos").select("*").eq("codigo", b.codigo).single();
    if (e) throw e;
    const [escudo, patro, boceto] = await Promise.all([
      urlFirmada("logos", p.escudo, 86400), urlFirmada("logos", p.logo_patrocinador, 86400), urlFirmada("bocetos", p.boceto, 86400)
    ]);
    const cod = codigoDiseno(p.diseno);
    return json({ ...p, codigo_diseno: cod, ref_proveedor: refsProveedor()[cod.split("-")[0]] || "",
      archivos: { escudo, patrocinador: patro, boceto }, enlace_cliente: SITE + "/pedido.html?t=" + p.token });
  },

  async guardar(b) {
    const cambios = { actualizado: ahora() };
    if (b.estado !== undefined) { if (!ESTADOS.includes(b.estado)) return error("Estado no válido."); cambios.estado = b.estado; }
    if (b.seguimiento !== undefined) cambios.seguimiento = String(b.seguimiento).slice(0, 300);
    if (b.notas !== undefined) cambios.notas = String(b.notas).slice(0, 4000);
    const { error: e } = await db().from("pedidos").update(cambios).eq("codigo", b.codigo);
    if (e) throw e;
    return json({ ok: true });
  },

  // Boceto: primero se pide la URL para subirlo, luego se confirma y el pedido pasa a "boceto"
  async subirBoceto(b) {
    const ext = MIMES[b.mime];
    if (!ext) return error("Usa PNG, JPG, WebP o PDF.");
    const ruta = b.codigo + "/" + token().slice(0, 10) + "." + ext;
    const { data, error: e } = await db().storage.from("bocetos").createSignedUploadUrl(ruta);
    if (e) throw e;
    return json({ ruta, url: data.signedUrl });
  },
  async confirmarBoceto(b) {
    if (!/^P\d{4,}\/[A-Za-z0-9_-]{10}\.(png|jpg|webp|pdf)$/.test(b.ruta || "") || !b.ruta.startsWith(b.codigo + "/")) return error("Archivo no válido.");
    const { data: p } = await db().from("pedidos").select("estado").eq("codigo", b.codigo).single();
    const cambios = { boceto: b.ruta, actualizado: ahora() };
    if (p && p.estado === "nuevo") cambios.estado = "boceto";
    const { error: e } = await db().from("pedidos").update(cambios).eq("codigo", b.codigo);
    if (e) throw e;
    return json({ ok: true });
  },

  // Para pasar a MateFulfill: una fila por jugador con el envío y los enlaces a los logos (válidos 7 días)
  async exportar(b) {
    let q = db().from("pedidos").select("*").order("num");
    q = b.codigo ? q.eq("codigo", b.codigo) : q.eq("estado", "pagado");
    const { data, error: e } = await q;
    if (e) throw e;
    const refs = refsProveedor(), filas = [];
    for (const p of data) {
      const cod = codigoDiseno(p.diseno), d = p.envio || {}, a = d.direccion || {};
      const [escudo, patro] = await Promise.all([urlFirmada("logos", p.escudo, 7 * 86400), urlFirmada("logos", p.logo_patrocinador, 7 * 86400)]);
      const medida = p.diseno.tipo === "medida" ? [p.diseno.patron, p.diseno.c1, p.diseno.c2, p.diseno.c3].join(" ") : "";
      p.plantilla.forEach((j, i) => filas.push({
        pedido: p.codigo, equipo: p.equipo, modelo: cod, ref: refs[cod.split("-")[0]] || "", diseno_medida: medida,
        jugador: i + 1, nombre: j.nombre, dorsal: j.dorsal, talla: j.talla, pieza: j.pieza === "kit" ? "camiseta+pantalon" : "camiseta",
        patrocinador: p.patrocinador, escudo: escudo || "", logo_patrocinador: patro || "",
        envio_nombre: d.nombre || p.cliente.nombre, envio_telefono: d.telefono || p.cliente.telefono,
        direccion: [a.line1, a.line2].filter(Boolean).join(", "), cp: a.postal_code || "", ciudad: a.city || "", provincia: a.state || "", pais: a.country || ""
      }));
    }
    return json({ filas });
  }
};

export async function POST(req) {
  if (!configurado.db || !configurado.panel) return sinConfigurar();
  let b;
  try { b = await leerJson(req); } catch (e) { return error(e.message); }
  const fn = Object.hasOwn(acciones, b.accion) && acciones[b.accion];
  if (!fn) return error("Acción desconocida.");
  if (b.accion !== "entrar" && !sesionValida(req)) return error("Sesión caducada. Vuelve a entrar.", 401);
  try { return await fn(b); } catch (e) { console.error(e); return error("Error del servidor. Inténtalo otra vez.", 500); }
}
