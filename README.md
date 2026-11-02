# Doble Amarilla

Web de [dobleamarilla.com](https://dobleamarilla.com): equipaciones de fútbol personalizadas para fútbol 7, pachangas y equipos amateur.

Web estática (HTML, CSS y JS sin build). Se sube tal cual al hosting.

- `index.html`: tienda, catálogo, configurador 3D y pedido por WhatsApp.
- `lib/manifest.js`: datos de contacto, precios y tallas.
- `lib/catalogo.js`: modelos y colores del catálogo (generado).
- `upload.php`: subida de escudos y logos (necesita PHP; en un hosting sin PHP el pedido pide los logos por WhatsApp).
- `models/`: modelo 3D de la camiseta, basado en "Soccer Jersey Patterns 3D" de Wearable3D (CC BY 4.0).

Para verla en local: `python -m http.server 8766` en esta carpeta.
