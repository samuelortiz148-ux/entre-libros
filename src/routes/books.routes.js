const express = require('express');
const router = express.Router();
const {
  getBooks,
  createBook,
  updateBook,
  inactivateBook
} = require('../controllers/books.controller');

// Endpoints para la gestión de libros
router.get('/', getBooks);                     
router.post('/', createBook);                  
router.put('/:id', updateBook);               
router.patch('/:id/inactivate', inactivateBook); 

module.exports = router;

