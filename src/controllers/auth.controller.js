const crypto = require('crypto');
const supabase = require('../config/supabase');

// Sesiones activas en memoria
const sesiones = new Map();

// Generar contraseña segura
function hashPassword(password) {
    const salt = crypto.randomBytes(16).toString('hex');

    const hash = crypto
        .scryptSync(password, salt, 64)
        .toString('hex');

    return `${salt}:${hash}`;
}

// Comparar contraseña con una contraseña almacenada
function verifyPassword(password, storedPassword) {
    // Compatibilidad temporal con usuarios antiguos
    // que tengan la contraseña guardada sin hash.
    if (!storedPassword.includes(':')) {
        return password === storedPassword;
    }

    const [salt, storedHash] = storedPassword.split(':');

    const hash = crypto
        .scryptSync(password, salt, 64)
        .toString('hex');

    return crypto.timingSafeEqual(
        Buffer.from(hash, 'hex'),
        Buffer.from(storedHash, 'hex')
    );
}

// REGISTRO
const register = async (req, res) => {
    try {
        const {
            nombre,
            apellido,
            correo,
            contraseña
        } = req.body;

        if (!nombre || !apellido || !correo || !contraseña) {
            return res.status(400).json({
                error: 'Todos los campos son obligatorios'
            });
        }

        // Verificar que el correo no exista
        const { data: usuarioExistente, error: errorBusqueda } =
            await supabase
                .from('usuarios')
                .select('id')
                .eq('correo', correo)
                .maybeSingle();

        if (errorBusqueda) {
            return res.status(500).json({
                error: 'Error al consultar el usuario'
            });
        }

        if (usuarioExistente) {
            return res.status(409).json({
                error: 'El correo ya está registrado'
            });
        }

        // Los usuarios que se registran normalmente serán Cliente.
        const contraseñaHash = hashPassword(contraseña);

        const { data: nuevoUsuario, error } = await supabase
            .from('usuarios')
            .insert([
                {
                    nombre,
                    apellido,
                    correo,
                    contraseña: contraseñaHash,
                    rol: 'Cliente'
                }
            ])
            .select('id, nombre, apellido, correo, rol')
            .single();

        if (error) {
            console.error(error);

            return res.status(500).json({
                error: 'No se pudo registrar el usuario'
            });
        }

        return res.status(201).json({
            mensaje: 'Usuario registrado correctamente',
            usuario: nuevoUsuario
        });

    } catch (error) {
        console.error(error);

        return res.status(500).json({
            error: 'Error interno del servidor'
        });
    }
};

// LOGIN
const login = async (req, res) => {
    try {
        const { correo, contraseña } = req.body;

        if (!correo || !contraseña) {
            return res.status(400).json({
                error: 'Correo y contraseña son obligatorios'
            });
        }

        const { data: usuario, error } = await supabase
            .from('usuarios')
            .select('*')
            .eq('correo', correo)
            .maybeSingle();

        if (error) {
            return res.status(500).json({
                error: 'Error al consultar el usuario'
            });
        }

        if (!usuario) {
            return res.status(401).json({
                error: 'Credenciales inválidas'
            });
        }

        const contraseñaValida = verifyPassword(
            contraseña,
            usuario.contraseña
        );

        if (!contraseñaValida) {
            return res.status(401).json({
                error: 'Credenciales inválidas'
            });
        }

        // Si el usuario antiguo tenía contraseña sin hash,
        // la convertimos a una contraseña segura.
        if (!usuario.contraseña.includes(':')) {
            const nuevaContraseña = hashPassword(contraseña);

            await supabase
                .from('usuarios')
                .update({ contraseña: nuevaContraseña })
                .eq('id', usuario.id);
        }

        // Crear identificador de sesión
        const token = crypto.randomBytes(32).toString('hex');

        sesiones.set(token, {
            id: usuario.id,
            nombre: usuario.nombre,
            apellido: usuario.apellido,
            correo: usuario.correo,
            rol: usuario.rol,
            ultimoAcceso: Date.now()
        });

        return res.status(200).json({
            mensaje: 'Inicio de sesión exitoso',
            token,
            usuario: {
                id: usuario.id,
                nombre: usuario.nombre,
                apellido: usuario.apellido,
                correo: usuario.correo,
                rol: usuario.rol
            }
        });

    } catch (error) {
        console.error(error);

        return res.status(500).json({
            error: 'Error interno del servidor'
        });
    }
};

// LOGOUT
const logout = (req, res) => {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (token) {
        sesiones.delete(token);
    }

    return res.status(200).json({
        mensaje: 'Sesión cerrada correctamente'
    });
};

module.exports = {
    register,
    login,
    logout,
    sesiones
};