const mongoose = require('mongoose');

const QrCodeSchema = new mongoose.Schema({
  qrId: {
    type: String,
    required: true,
    unique: true,
    index: true, // Importante para búsquedas rápidas
  },
  targetUrl: {
    type: String,
    default: '',
  },
  status: {
    type: String,
    enum: ['libre', 'asignado'],
    default: 'libre',
  },
}, {
  timestamps: true // Agrega createdAt y updatedAt
});

// Evitar sobreescritura de modelos en caliente al usar Serverless
module.exports = mongoose.models.QrCode || mongoose.model('QrCode', QrCodeSchema);
