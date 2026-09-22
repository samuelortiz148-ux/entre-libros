const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares globales
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir archivos estáticos del Frontend
app.use(express.static(path.join(__dirname, 'src/public')));

// Rutas de las APIs
app.use('/api/auth', require('./src/routes/auth.routes'));
app.use('/api/books', require('./src/routes/books.routes'));
app.use('/api/loans', require('./src/routes/loans.routes'));
app.use('/api/reports', require('./src/routes/reports.routes'));

// Iniciar servidor
app.listen(PORT, () => {
console.log(`🚀 Servidor Entre Libros ejecutándose en http://localhost:${PORT}`);
});