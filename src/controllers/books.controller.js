const supabase = require('../config/supabase');

// Bloque de codigo para obtener y filtrar libros
const getBooks = async (req, res) => {
  try {
    const { titulo, autor, categoria } = req.query;
    let query = supabase.from('libros').select('*');

    // Solo aplicamos filtro si realmente enviaron un texto válido
    if (titulo && titulo.trim() !== '') {
      query = query.ilike('titulo', `%${titulo.trim()}%`);
    }
    if (autor && autor.trim() !== '') {
      query = query.ilike('autor', `%${autor.trim()}%`);
    }
    if (categoria && categoria.trim() !== '') {
      query = query.ilike('categoria', `%${categoria.trim()}%`);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error de Supabase:', error);
      return res.status(400).json({ error: error.message });
    }

    return res.status(200).json(data || []);
  } catch (err) {
    console.error('Error en el servidor:', err);
    return res.status(500).json({ error: err.message });
  }
};

// Bloque de codigo para crear un nuevo libro
const createBook = async (req, res) => {
  try {
    const { titulo, autor, categoria, editorial, año_publicacion, isbn, cantidad_total } = req.body;

    const { data, error } = await supabase.from('libros').insert([
      {
        titulo,
        autor,
        categoria,
        editorial,
        año_publicacion,
        isbn,
        cantidad_total,
        cantidad_disponible: cantidad_total,
        activo: true
      }
    ]).select();

    if (error) return res.status(400).json({ error: error.message });
    return res.status(201).json(data[0]);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

//Bloque de codigo para editar un libro
const updateBook = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const { data, error } = await supabase
      .from('libros')
      .update(updates)
      .eq('id', id)
      .select();

    if (error) return res.status(400).json({ error: error.message });
    return res.status(200).json(data[0]);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// Bloque de codigo para inactivar un libro
const inactivateBook = async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('libros')
      .update({ activo: false })
      .eq('id', id)
      .select();

    if (error) return res.status(400).json({ error: error.message });
    return res.status(200).json({ mensaje: 'Libro inactivado correctamente', libro: data[0] });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

module.exports = {
  getBooks,
  createBook,
  updateBook,
  inactivateBook
};