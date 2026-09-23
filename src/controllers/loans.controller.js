const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// 1. Solicitud de nuevo préstamo
exports.createLoan = async (req, res) => {
    try {
        const { usuario_id, libro_id } = req.body;

        if (!usuario_id || !libro_id) {
            return res.status(400).json({ message: 'Usuario y libro son requeridos' });
        }

        // Verificar si el libro existe
        const { data: libro, error: errorLibro } = await supabase
            .from('libros')
            .select('*')
            .eq('id', parseInt(libro_id))
            .maybeSingle();

        if (errorLibro) {
            console.error('Error al consultar libro:', errorLibro);
            return res.status(500).json({ message: `Error en tabla libros: ${errorLibro.message}` });
        }

        if (!libro) {
            return res.status(404).json({ message: 'El libro solicitado no existe en la base de datos.' });
        }

        const stock = libro.unidades_disponibles !== undefined ? libro.unidades_disponibles : 1;
        if (stock <= 0) {
            return res.status(400).json({ message: 'El libro no tiene unidades disponibles para préstamo.' });
        }

        // Fechas
        const fechaPrestamo = new Date();
        const fechaLimite = new Date();
        fechaLimite.setDate(fechaPrestamo.getDate() + 15);

        // Registrar préstamo con los nombres de columna esperados por la BD
        const { data: nuevoPrestamo, error: errorPrestamo } = await supabase
            .from('prestamos')
            .insert([
                {
                    usuario_id: parseInt(usuario_id),
                    libro_id: parseInt(libro_id),
                    fecha_prestamo: fechaPrestamo,
                    fecha_limite: fechaLimite,
                    fecha_devolucion_prevista: fechaLimite,
                    estado: 'PRESTADO'
                }
            ])
            .select();

        if (errorPrestamo) {
            console.error('--- ERROR DETALLADO SUPABASE PRESTAMO ---', errorPrestamo);
            return res.status(400).json({ message: `Supabase Error: ${errorPrestamo.message}` });
        }

        // Descontar 1 unidad
        if (libro.unidades_disponibles !== undefined) {
            await supabase
                .from('libros')
                .update({ unidades_disponibles: stock - 1 })
                .eq('id', parseInt(libro_id));
        }

        return res.status(201).json({
            message: 'Préstamo registrado exitosamente',
            prestamo: nuevoPrestamo ? nuevoPrestamo[0] : null
        });

    } catch (error) {
        console.error('--- ERROR EN CATCH DE CREATE LOAN ---', error);
        return res.status(500).json({ 
            message: error.message || 'Error interno del servidor' 
        });
    }
};

// 2. Devolución de libro
exports.returnBook = async (req, res) => {
    try {
        const { prestamo_id } = req.body;

        if (!prestamo_id) {
            return res.status(400).json({ message: 'ID de préstamo es requerido' });
        }

        const { data: prestamo, error: errorPrestamo } = await supabase
            .from('prestamos')
            .select('*')
            .eq('id', parseInt(prestamo_id))
            .maybeSingle();

        if (errorPrestamo || !prestamo) {
            return res.status(404).json({ message: 'El préstamo no existe' });
        }

        const { data: prestamoActualizado, error: errorUpdate } = await supabase
            .from('prestamos')
            .update({
                fecha_devolucion: new Date(),
                estado: 'DEVUELTO'
            })
            .eq('id', parseInt(prestamo_id))
            .select();

        if (errorUpdate) throw errorUpdate;

        // Reintegrar stock (+1)
        const { data: libro } = await supabase
            .from('libros')
            .select('unidades_disponibles')
            .eq('id', prestamo.libro_id)
            .maybeSingle();

        if (libro && libro.unidades_disponibles !== undefined) {
            await supabase
                .from('libros')
                .update({ unidades_disponibles: libro.unidades_disponibles + 1 })
                .eq('id', prestamo.libro_id);
        }

        return res.status(200).json({
            message: 'Devolución registrada con éxito.',
            prestamo: prestamoActualizado[0]
        });

    } catch (error) {
        console.error('Error en returnBook:', error);
        return res.status(500).json({ message: error.message || 'Error al procesar devolución' });
    }
};

// 3. Listar préstamos
exports.getLoans = async (req, res) => {
    try {
        const { data: prestamos, error } = await supabase
            .from('prestamos')
            .select('*')
            .order('id', { ascending: false });

        if (error) {
            console.error('Error consultando préstamos:', error);
            return res.status(200).json([]);
        }

        if (!prestamos || prestamos.length === 0) {
            return res.status(200).json([]);
        }

        // Obtener nombres para mapear sin requerir Foreign Keys estrictas
        const { data: usuarios } = await supabase.from('usuarios').select('id, nombre');
        const { data: libros } = await supabase.from('libros').select('id, titulo');

        const uMap = new Map((usuarios || []).map(u => [u.id, u]));
        const lMap = new Map((libros || []).map(l => [l.id, l]));

        const resultado = prestamos.map(p => ({
            ...p,
            usuarios: uMap.get(p.usuario_id) || { nombre: `Usuario #${p.usuario_id}` },
            libros: lMap.get(p.libro_id) || { titulo: `Libro #${p.libro_id}` }
        }));

        return res.status(200).json(resultado);
    } catch (error) {
        console.error('Error en getLoans:', error);
        return res.status(200).json([]);
    }
};