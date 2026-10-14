
const express = require('express');

const {
    register,
    registerAdmin,
    login,
    logout
} = require('../controllers/auth.controller');

const {
    requireAuth,
    requireRole
} = require('../middlewares/auth.middleware');

const router = express.Router();

// Registro público: solo crea usuarios Cliente
router.post('/register', register);

// Inicio de sesión
router.post('/login', login);

// Cierre de sesión
router.post('/logout', logout);

// Consultar el usuario de la sesión actual
router.get('/me', requireAuth, (req, res) => {
    return res.status(200).json({
        usuario: req.user
    });
});

// Crear administradores: requiere una sesión de Administrador
router.post(
    '/register-admin',
    requireAuth,
    requireRole('Administrador'),
    registerAdmin
);

module.exports = router;