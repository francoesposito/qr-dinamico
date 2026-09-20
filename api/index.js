require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const express = require('express');
const cors = require('cors');
const path = require('path');
const connectDB = require('../config/db');
const QrCode = require('../models/QrCode');

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());
// Servir archivos estáticos para pruebas locales (En Vercel esto se maneja con vercel.json)
app.use(express.static(path.join(__dirname, '../public')));

// Ruta para procesar el escaneo del QR
app.get('/qr/:qrId', async (req, res) => {
  try {
    await connectDB();
    const { qrId } = req.params;

    const qr = await QrCode.findOne({ qrId });

    if (!qr) {
      return res.status(404).send('Código QR no encontrado en el sistema.');
    }

    if (qr.status === 'libre') {
      // Si está libre, redirigimos/servimos la UI de configuración.
      // Le pasamos el ID a través de la URL o simplemente servimos el HTML estático
      // El HTML extraerá el ID de la URL
      return res.sendFile(path.join(__dirname, '../public/index.html'));
    }

    if (qr.status === 'asignado') {
      // Si está asignado, redirigimos a la URL configurada
      return res.redirect(302, qr.targetUrl);
    }
  } catch (error) {
    console.error('Error al procesar el QR:', error);
    res.status(500).send('Error interno del servidor');
  }
});

// Ruta para configurar un QR "libre"
app.post('/api/qr/setup', async (req, res) => {
  try {
    await connectDB();
    const { qrId, targetUrl } = req.body;

    if (!qrId || !targetUrl) {
      return res.status(400).json({ success: false, message: 'Faltan datos requeridos (qrId, targetUrl).' });
    }

    // Validar formato simple de URL
    const urlRegex = /^(http|https):\/\/[^ "]+$/;
    if (!urlRegex.test(targetUrl)) {
      return res.status(400).json({ success: false, message: 'El formato de la URL no es válido.' });
    }

    const qr = await QrCode.findOne({ qrId });

    if (!qr) {
      return res.status(404).json({ success: false, message: 'Código QR no encontrado.' });
    }

    if (qr.status === 'asignado') {
      return res.status(400).json({ success: false, message: 'Este código QR ya está asignado a otra URL.' });
    }

    // Actualizar el documento
    qr.targetUrl = targetUrl;
    qr.status = 'asignado';
    await qr.save();

    return res.json({ success: true, message: 'Código QR configurado exitosamente.' });
  } catch (error) {
    console.error('Error al configurar el QR:', error);
    res.status(500).json({ success: false, message: 'Error interno del servidor.' });
  }
});

// Ruta para generar QRs masivamente (Administrador)
app.post('/api/admin/generate', async (req, res) => {
  try {
    await connectDB();
    const { prefix, count, password } = req.body;

    // Validación de contraseña maestra
    const masterPassword = process.env.ADMIN_PASSWORD;
    if (!masterPassword || password !== masterPassword) {
      return res.status(401).json({ success: false, message: 'Contraseña incorrecta. Acceso denegado.' });
    }

    if (!prefix || !count || count <= 0) {
      return res.status(400).json({ success: false, message: 'Faltan datos requeridos (prefijo, cantidad).' });
    }

    const qrsToInsert = [];
    const generatedUrls = [];
    // Obtenemos el origin dinámicamente de la petición o usamos un fallback para localhost
    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    const host = req.headers.host;
    const origin = `${protocol}://${host}`;

    for (let i = 1; i <= count; i++) {
      // Agregamos ceros a la izquierda (ej: 01, 02)
      const numFormatted = i.toString().padStart(2, '0');
      const newQrId = `${prefix}-${numFormatted}`;
      
      qrsToInsert.push({
        qrId: newQrId,
        targetUrl: '',
        status: 'libre'
      });

      generatedUrls.push(`${origin}/qr/${newQrId}`);
    }

    // Insertar masivamente
    await QrCode.insertMany(qrsToInsert);

    return res.json({ success: true, message: 'QRs generados exitosamente.', urls: generatedUrls });
  } catch (error) {
    console.error('Error al generar QRs:', error);
    // Verificar si es error de clave duplicada
    if (error.code === 11000) {
      return res.status(400).json({ success: false, message: 'Algunos IDs ya existen. Cambia el prefijo.' });
    }
    res.status(500).json({ success: false, message: 'Error interno del servidor.' });
  }
});

// Exportar la app para Vercel
module.exports = app;

// Iniciar servidor solo si no estamos en Vercel (desarrollo local)
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Servidor local corriendo en http://localhost:${PORT}`);
  });
}
