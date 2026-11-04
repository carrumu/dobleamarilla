# Doble Amarilla

Web de [dobleeamarilla.com](https://dobleeamarilla.com): equipaciones de fútbol personalizadas para fútbol 7, pachangas y equipos amateur.

Web estática (HTML, CSS y JS sin build) en Vercel, más unas funciones en `api/` para pedidos y pagos.

- `index.html`: tienda, catálogo, configurador 3D y formulario de pedido.
- `pedido.html`: página del cliente (boceto, aprobar y pagar). Se entra con el enlace secreto del pedido.
- `panel.html`: panel de pedidos (contraseña en `ADMIN_PASSWORD`).
- `api/`: funciones de Vercel. Guardan los pedidos y los logos en Supabase y cobran con Stripe. Sin las variables de entorno, la web sigue mandando los pedidos por WhatsApp.
- `lib/manifest.js`: datos de contacto, precios y tallas.
- `lib/catalogo.js`: modelos y colores del catálogo (generado).
- `models/`: modelo 3D de la camiseta, basado en "Soccer Jersey Patterns 3D" de Wearable3D (CC BY 4.0).

Para verla en local: `python -m http.server 8766` en esta carpeta.

## Variables de entorno (Vercel > Settings > Environment Variables)

- `SUPABASE_URL`, `SUPABASE_SECRET_KEY`: base de datos y archivos. Esquema en `backend/esquema.sql` (fuera de este repositorio).
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`: cobros. Webhook: `https://www.dobleeamarilla.com/api/stripe-webhook`, eventos `checkout.session.completed` y `checkout.session.async_payment_succeeded`.
- `ADMIN_PASSWORD`: contraseña del panel (10 caracteres o más).
- `MODEL_REFS` (opcional): JSON con la referencia del proveedor de cada modelo, p. ej. `{"DA01":"..."}`. Sale en el panel y en el CSV, nunca en la web.
