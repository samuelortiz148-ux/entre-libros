const express = require('express');

const {
    register,
    login,
    logout
} = require('../controllers/auth.controller');

const router = express.Router();

// Registro
router.post('/register', register);

// Inicio de sesión
router.post('/login', login);

// Cierre de sesión
router.post('/logout', logout);

module.exports = router;