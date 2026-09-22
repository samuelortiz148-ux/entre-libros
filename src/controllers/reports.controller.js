const supabase = require('../config/supabase');

exports.getSummary = async (req, res) => {
  try {
    // 1. Obtener total de libros
    const { count: totalBooks, error: booksError } = await supabase
      .from('libros')
      .select('*', { count: 'exact', head: true });

    if (booksError) throw booksError;

    // 2. Obtener total de usuarios
    const { count: totalUsers, error: usersError } = await supabase
      .from('usuarios')
      .select('*', { count: 'exact', head: true });

    if (usersError) throw usersError;

    // 3. Obtener préstamos
    const { count: activeLoans, error: loansError } = await supabase
      .from('prestamos')
      .select('*', { count: 'exact', head: true });

    if (loansError) throw loansError;

    res.json({
      success: true,
      data: {
        totalBooks: totalBooks || 0,
        totalUsers: totalUsers || 0,
        activeLoans: activeLoans || 0
      }
    });

  } catch (error) {
    console.error('Error al obtener reporte:', error.message);
    res.status(500).json({
      success: false,
      message: 'Error al consultar las estadísticas',
      error: error.message
    });
  }
};