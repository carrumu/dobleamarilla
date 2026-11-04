// POST /api/subida {mime}: devuelve una URL firmada para subir un logo directamente al almacenamiento
// (así el archivo no pasa por la función y no choca con su límite de tamaño). El bucket limita peso y tipos.
import { configurado, db, json, error, sinConfigurar, leerJson, token, MIMES } from "./_lib/comun.js";

export async function POST(req) {
  if (!configurado.db) return sinConfigurar();
  let b;
  try { b = await leerJson(req, 1024); } catch (e) { return error(e.message); }
  const ext = MIMES[b.mime];
  if (!ext) return error("Formato no admitido. Usa PNG, JPG, WebP o PDF.");
  const ruta = "tmp/" + token().slice(0, 24) + "." + ext;
  const { data, error: e } = await db().storage.from("logos").createSignedUploadUrl(ruta);
  if (e) { console.error(e); return error("No se ha podido preparar la subida.", 500); }
  return json({ ruta, url: data.signedUrl });
}
