const supabase = require('../config/supabase');

exports.getSummary = async (req, res) => {
  try {
    res.json({
      success: true,
      message: 'Módulo de reportes listo'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};