<?php
// Recibe el escudo o el logo del patrocinador desde el configurador y lo guarda en /logos.
// Límites para no llenar el hosting: tamaño por archivo, tipos permitidos,
// subidas por IP y hora, y espacio total de la carpeta.

const MAX_BYTES     = 5 * 1024 * 1024;    // 5 MB por archivo (el navegador ya comprime antes de subir)
const MAX_DIR_BYTES = 500 * 1024 * 1024;  // 500 MB en total en /logos
const MAX_PER_HOUR  = 20;                 // subidas por IP y hora
const ALLOWED = [
  'image/png'       => 'png',
  'image/jpeg'      => 'jpg',
  'image/webp'      => 'webp',
  'application/pdf' => 'pdf',
];

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');

function fail($code, $msg) {
  http_response_code($code);
  echo json_encode(['error' => $msg]);
  exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') fail(405, 'Método no permitido.');

// Solo desde nuestra propia web
$host = $_SERVER['HTTP_HOST'] ?? '';
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if ($origin !== '' && parse_url($origin, PHP_URL_HOST) !== preg_replace('/:\d+$/', '', $host)) fail(403, 'Origen no permitido.');

// Si el archivo supera post_max_size, PHP vacía $_FILES y $_POST
if (empty($_FILES['file'])) fail(413, 'El archivo pesa demasiado. Máximo 5 MB.');
$f = $_FILES['file'];
if ($f['error'] === UPLOAD_ERR_INI_SIZE || $f['error'] === UPLOAD_ERR_FORM_SIZE) fail(413, 'El archivo pesa demasiado. Máximo 5 MB.');
if ($f['error'] !== UPLOAD_ERR_OK || !is_uploaded_file($f['tmp_name'])) fail(400, 'No se ha recibido el archivo.');
if ($f['size'] > MAX_BYTES) fail(413, 'El archivo pesa demasiado. Máximo 5 MB.');

// Tipo real por contenido, no por la extensión que manda el navegador
$mime = (new finfo(FILEINFO_MIME_TYPE))->file($f['tmp_name']);
if (!isset(ALLOWED[$mime])) fail(415, 'Formato no válido. Usa PNG, JPG, WebP o PDF.');
if ($mime !== 'application/pdf' && @getimagesize($f['tmp_name']) === false) fail(415, 'La imagen está dañada.');

$dir = __DIR__ . '/logos';
if (!is_dir($dir) && !mkdir($dir, 0755, true)) fail(500, 'No se puede guardar ahora mismo.');

// Límite por IP: un contador por hora en la carpeta temporal del servidor
$ipKey = hash('sha256', ($_SERVER['REMOTE_ADDR'] ?? '') . date('YmdH'));
$counter = sys_get_temp_dir() . '/da-up-' . $ipKey;
$count = is_file($counter) ? (int) file_get_contents($counter) : 0;
if ($count >= MAX_PER_HOUR) fail(429, 'Demasiadas subidas. Prueba dentro de un rato o mándalo por WhatsApp.');

// Límite de espacio total
$used = 0;
foreach (glob($dir . '/*.{png,jpg,webp,pdf}', GLOB_BRACE) ?: [] as $p) $used += filesize($p);
if ($used + $f['size'] > MAX_DIR_BYTES) fail(507, 'No hay espacio ahora mismo. Mándalo por WhatsApp.');

$kind = in_array($_POST['kind'] ?? '', ['escudo', 'patrocinador'], true) ? $_POST['kind'] : 'logo';
$name = date('Ymd') . '-' . $kind . '-' . bin2hex(random_bytes(8)) . '.' . ALLOWED[$mime];
if (!move_uploaded_file($f['tmp_name'], $dir . '/' . $name)) fail(500, 'No se puede guardar ahora mismo.');
@chmod($dir . '/' . $name, 0644);
file_put_contents($counter, (string) ($count + 1));

$scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
$base = rtrim(str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'])), '/');
echo json_encode(['url' => $scheme . '://' . $host . $base . '/logos/' . $name]);
