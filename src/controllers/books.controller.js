const supabase = require('../config/supabase');

// Bloque de código para obtener y filtrar libros
const getBooks = async (req, res) => {
  try {
    const { titulo, autor, categoria } = req.query;
    let query = supabase.from('libros').select('*');

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

// Bloque de código para crear un nuevo libro (incluye sinopsis y validación de límite de stock)
const createBook = async (req, res) => {
  try {
    const { titulo, autor, categoria, editorial, año_publicacion, isbn, cantidad_total, sinopsis } = req.body;

    // Validación de límite de stock para nuevos lotes
    if (cantidad_total !== undefined && (cantidad_total < 0 || cantidad_total > 500)) {
      return res.status(400).json({ error: 'La cantidad total debe estar entre 0 y 500 ejemplares.' });
    }

    const { data, error } = await supabase.from('libros').insert([
      {
        titulo,
        autor,
        categoria,
        editorial,
        año_publicacion,
        isbn,
        sinopsis: sinopsis || 'Sin descripción disponible.',
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

// Bloque de código para editar UNICAMENTE la cantidad/stock de un libro
const updateBook = async (req, res) => {
  try {
    const { id } = req.params;
    const { cantidad_total } = req.body; // Se ignora título, autor, ISBN u otros campos enviados

    // Validación de cantidad recibida
    if (cantidad_total === undefined || isNaN(cantidad_total) || cantidad_total < 0) {
      return res.status(400).json({ error: 'Debe ingresar una cantidad válida igual o mayor a 0.' });
    }

    // Validación de límite máximo por libro
    if (cantidad_total > 500) {
      return res.status(400).json({ error: 'No se permite registrar más de 500 ejemplares por libro.' });
    }

    // Actualiza únicamente la columna cantidad_total (y sincroniza cantidad_disponible)
    const { data, error } = await supabase
      .from('libros')
      .update({ 
        cantidad_total: Number(cantidad_total),
        cantidad_disponible: Number(cantidad_total)
      })
      .eq('id', id)
      .select();

    if (error) return res.status(400).json({ error: error.message });
    return res.status(200).json({ mensaje: 'Cantidad del libro actualizada correctamente', libro: data[0] });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// Bloque de código para inactivar un libro
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