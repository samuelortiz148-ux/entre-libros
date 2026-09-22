const express = require('express');
const router = express.Router();
const reportsController = require('../controllers/reports.controller');

router.get('/summary', reportsController.getSummary);

module.exports = router;