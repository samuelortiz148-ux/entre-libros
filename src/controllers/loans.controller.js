const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// 1. Solicitud de nuevo préstamo (Con validación de bloqueos y stock)
exports.createLoan = async (req, res) => {
    try {
        const { usuario_id, libro_id } = req.body;

        if (!usuario_id || !libro_id) {
            return res.status(400).json({ message: 'Usuario y libro son requeridos' });
        }

        const uId = parseInt(usuario_id);
        const lId = parseInt(libro_id);

        // A. Validar si el usuario tiene SANCIONES PENDIENTES
        const { data: sanciones, error: errSanciones } = await supabase
            .from('sanciones')
            .select('*')
            .eq('usuario_id', uId);

        const sancionesPendientes = (sanciones || []).filter(
            s => s.estado && s.estado.trim().toUpperCase() === 'PENDIENTE'
        );

        if (sancionesPendientes.length > 0) {
            return res.status(403).json({ 
                message: `El usuario tiene ${sancionesPendientes.length} sanción(es) pendiente(s) de pago. No puede solicitar préstamos.` 
            });
        }

        // B. Validar si el usuario tiene PRÉSTAMOS VENCIDOS no devueltos
        const { data: prestamosActivos, error: errPrestamos } = await supabase
            .from('prestamos')
            .select('*')
            .eq('usuario_id', uId)
            .eq('estado', 'PRESTADO');

        const hoy = new Date();
        const prestamoVencido = (prestamosActivos || []).find(p => {
            const fechaLimiteRaw = p.fecha_devolucion_prevista || p.fecha_limite;
            return fechaLimiteRaw && new Date(fechaLimiteRaw) < hoy;
        });

        if (prestamoVencido) {
            return res.status(403).json({ 
                message: 'El usuario tiene préstamos vencidos sin devolver. Debe ponerse al día antes de solicitar otro libro.' 
            });
        }

        // C. Verificar si el libro existe y tiene stock
        const { data: libro, error: errorLibro } = await supabase
            .from('libros')
            .select('*')
            .eq('id', lId)
            .maybeSingle();

        if (errorLibro || !libro) {
            return res.status(404).json({ message: 'El libro solicitado no existe en la base de datos.' });
        }

        const stock = libro.unidades_disponibles !== undefined ? libro.unidades_disponibles : 1;
        if (stock <= 0) {
            return res.status(400).json({ message: 'El libro no tiene unidades disponibles para préstamo.' });
        }

        // D. Fechas de préstamo (15 días de plazo)
        const fechaPrestamo = new Date();
        const fechaLimite = new Date();
        fechaLimite.setDate(fechaPrestamo.getDate() + 15);

        // E. Registrar préstamo (Formateado en ISO string)
        const { data: nuevoPrestamo, error: errorPrestamo } = await supabase
            .from('prestamos')
            .insert([
                {
                    usuario_id: uId,
                    libro_id: lId,
                    fecha_prestamo: fechaPrestamo.toISOString(),
                    fecha_limite: fechaLimite.toISOString(),
                    fecha_devolucion_prevista: fechaLimite.toISOString(),
                    estado: 'PRESTADO'
                }
            ])
            .select();

        if (errorPrestamo) {
            console.error('Error al insertar préstamo:', errorPrestamo);
            return res.status(400).json({ message: `Error Supabase: ${errorPrestamo.message}` });
        }

        // F. Descontar 1 unidad del stock
        if (libro.unidades_disponibles !== undefined) {
            await supabase
                .from('libros')
                .update({ unidades_disponibles: stock - 1 })
                .eq('id', lId);
        }

        return res.status(201).json({
            message: 'Préstamo registrado exitosamente',
            prestamo: nuevoPrestamo ? nuevoPrestamo[0] : null
        });

    } catch (error) {
        console.error('Error en createLoan:', error);
        return res.status(500).json({ message: error.message || 'Error interno del servidor' });
    }
};

// 2. Registro de Devoluciones (/api/returns)
exports.returnBook = async (req, res) => {
    try {
        const { prestamo_id } = req.body;

        if (!prestamo_id) {
            return res.status(400).json({ message: 'El ID de préstamo es requerido' });
        }

        const pId = parseInt(prestamo_id);

        // A. Consultar préstamo activo
        const { data: prestamo, error: errorPrestamo } = await supabase
            .from('prestamos')
            .select('*')
            .eq('id', pId)
            .maybeSingle();

        if (errorPrestamo || !prestamo) {
            return res.status(404).json({ message: 'El préstamo especificado no existe.' });
        }

        if (prestamo.estado === 'DEVUELTO') {
            return res.status(400).json({ message: 'Este préstamo ya fue devuelto anteriormente.' });
        }

        const fechaDevolucion = new Date();

        // B. Actualizar préstamo a DEVUELTO
        const { data: prestamoActualizado, error: errorUpdate } = await supabase
            .from('prestamos')
            .update({
                fecha_devolucion: fechaDevolucion.toISOString(),
                estado: 'DEVUELTO'
            })
            .eq('id', pId)
            .select();

        if (errorUpdate) throw errorUpdate;

        // C. Reintegrar stock (+1)
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

        // D. Lógica de Sanciones por Mora
        const fechaLimite = new Date(prestamo.fecha_devolucion_prevista || prestamo.fecha_limite);
        let mensajeMora = '';
        let sancionGenerada = null;

        if (fechaDevolucion > fechaLimite) {
            const diferenciaMs = fechaDevolucion - fechaLimite;
            const diasRetraso = Math.ceil(diferenciaMs / (1000 * 60 * 60 * 24));
            const TARIFA_POR_DIA = 2000; // $2.000 COP por día
            const montoMora = diasRetraso * TARIFA_POR_DIA;

            // Insertar sanción
            const { data: sancionData } = await supabase
                .from('sanciones')
                .insert([
                    {
                        usuario_id: prestamo.usuario_id,
                        prestamo_id: prestamo.id,
                        monto: montoMora,
                        motivo: `Devolución con ${diasRetraso} día(s) de mora`,
                        estado: 'PENDIENTE'
                    }
                ])
                .select();

            sancionGenerada = sancionData ? sancionData[0] : null;
            mensajeMora = ` ¡Atención! Devolución fuera de plazo. Se generó una sanción de $${montoMora} por ${diasRetraso} día(s) de mora.`;
        }

        return res.status(200).json({
            message: `Devolución registrada con éxito.${mensajeMora}`,
            prestamo: prestamoActualizado[0],
            sancion: sancionGenerada
        });

    } catch (error) {
        console.error('Error en returnBook:', error);
        return res.status(500).json({ message: error.message || 'Error al procesar la devolución' });
    }
};

// 3. Listar préstamos (/api/loans)
exports.getLoans = async (req, res) => {
    try {
        const { data: prestamos, error } = await supabase
            .from('prestamos')
            .select('*')
            .order('id', { ascending: false });

        if (error || !prestamos || prestamos.length === 0) {
            return res.status(200).json([]);
        }

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
        return res.status(200).json([]);
    }
};