// GET /api/resenas: reseñas aprobadas para la portada. Sin base de datos o sin tabla, lista vacía (la sección no sale).
import { configurado, db } from "./_lib/comun.js";

export async function GET() {
  const vacia = () => new Response(JSON.stringify({ resenas: [] }), { headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
  if (!configurado.db) return vacia();
  const { data, error } = await db().from("resenas").select("nombre, equipo, estrellas, texto, creado").eq("aprobada", true).order("creado", { ascending: false }).limit(12);
  if (error) { console.error(error); return vacia(); }
  return new Response(JSON.stringify({ resenas: data }), {
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "public, max-age=60, s-maxage=300" }
  });
}
