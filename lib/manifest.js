// Datos de marca y precios. Editar aquí, no en index.html.
window.__BRAND__ = {
  name: "Doble Amarilla",
  siteUrl: "https://www.dobleeamarilla.com",
  contactEmail: "info@dobleeamarilla.com",             // correo para temas legales y de privacidad (sale en las páginas legales)
  instagram: "dobleeamarilla",
  tiktok: "doble.amarilla",
  whatsapp: "34684315503",        // número con prefijo y sin espacios. Vacío = pedido por Instagram
  uploadMaxMB: 5,                 // peso máximo de escudo y logo: tiene que coincidir con el límite del bucket "logos" en Supabase

  // PVP en euros, IVA y envío incluidos (2026-10-26).
  // Catálogo = uno de nuestros diseños con escudo, patrocinador, nombre y dorsal.
  // A medida = diseño hecho desde cero para el equipo.
  prices: {
    kitStd: 26.99,
    kitCustom: 34.99,
    shirtStd: 19.99,
    shirtCustom: 22.99
  },
  // Tallas (2026-11-09): las de la tabla de equipaciones de 1ª división (versión aficionado).
  // La fábrica produce cada talla a esas medidas (matefulfill/size-spec-doble-amarilla.png), sin traducir a otra talla.
  sizes: ["S", "M", "L", "XL", "2XL", "3XL", "4XL"],

  // Fotos reales de equipos con su equipación (sección "Equipos que ya juegan con la suya" de la portada).
  // Subir las fotos a img/reales/ y añadirlas aquí: { src: "img/reales/equipo.webp", alt: "Real Picapiedra con su equipación" }
  realPhotos: []
};
