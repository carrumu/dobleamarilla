// Datos de marca y precios. Editar aquí, no en index.html.
window.__BRAND__ = {
  name: "Doble Amarilla",
  siteUrl: "https://www.dobleeamarilla.com",
  contactEmail: "info@dobleeamarilla.com",             // correo para temas legales y de privacidad (sale en las páginas legales)
  instagram: "dobleamarilla_99",
  tiktok: "doble.amarilla",
  whatsapp: "34684315503",        // número con prefijo y sin espacios. Vacío = pedido por Instagram
  uploadEndpoint: "",             // "upload.php" solo en un hosting con PHP (Nominalia). En Vercel, vacío: el logo se ve en la vista previa y se pide por WhatsApp
  uploadMaxMB: 5,                 // tiene que coincidir con MAX_BYTES de upload.php

  // PVP en euros, IVA y envío incluidos (2026-10-26).
  // Catálogo = uno de nuestros diseños con escudo, patrocinador, nombre y dorsal.
  // A medida = diseño hecho desde cero para el equipo.
  prices: {
    kitStd: 26.99,
    kitCustom: 34.99,
    shirtStd: 17.99,
    shirtCustom: 22.99
  },
  sizes: ["3XS", "2XS", "XS", "S", "M", "L", "XL", "2XL", "3XL", "4XL", "5XL"]
};
