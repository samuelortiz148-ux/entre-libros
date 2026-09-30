const express = require('express');
const router = express.Router();
const loansController = require('../controllers/loans.controller');

// Definición de endpoints para el módulo de préstamos y devoluciones
router.get('/', loansController.getLoans);
router.post('/', loansController.createLoan);
router.post('/return', loansController.returnBook);
router.post('/returns', loansController.returnBook);

module.exports = router;