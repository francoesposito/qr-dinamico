const mongoose = require('mongoose');
require('dns').setServers(['8.8.8.8', '8.8.4.4']);

// Optimización para Serverless: Mantener la conexión cacheada
let cachedDb = null;

const connectDB = async () => {
  if (cachedDb) {
    console.log('=> Usando conexión existente a la base de datos');
    return Promise.resolve(cachedDb);
  }

  console.log('=> Creando nueva conexión a la base de datos');
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    throw new Error('Por favor define la variable MONGODB_URI en .env.local o en las variables de entorno de Vercel');
  }

  try {
    const db = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000,
    });
    cachedDb = db;
    return cachedDb;
  } catch (error) {
    console.error('Error conectando a MongoDB:', error.message);
    throw error;
  }
};

module.exports = connectDB;
