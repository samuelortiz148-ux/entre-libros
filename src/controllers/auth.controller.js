
const crypto = require('crypto');
const supabase = require('../config/supabase');

// Sesiones activas en memoria
const sesiones = new Map();

// Tiempo máximo de inactividad: 10 minutos
const TIEMPO_INACTIVIDAD = 10 * 60 * 1000;

// Normalizar correos para evitar diferencias por espacios o mayúsculas
function normalizarCorreo(correo) {
    return correo.trim().toLowerCase();
}

// Validar formato básico del correo electrónico
function validarCorreo(correo) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo);
}

// Validar contraseña segura
function validarContraseña(contraseña) {
    return (
        typeof contraseña === 'string' &&
        contraseña.length >= 8 &&
        contraseña.length <= 128 &&
        /[a-z]/.test(contraseña) &&
        /[A-Z]/.test(contraseña) &&
        /\d/.test(contraseña)
    );
}

// Generar hash seguro de la contraseña usando scrypt
function hashPassword(password) {
    const salt = crypto.randomBytes(16).toString('hex');

    const hash = crypto
        .scryptSync(password, salt, 64)
        .toString('hex');

    return `${salt}:${hash}`;
}

// Verificar contraseña almacenada
function verifyPassword(password, storedPassword) {
    if (
        typeof password !== 'string' ||
        typeof storedPassword !== 'string' ||
        !storedPassword
    ) {
        return false;
    }

    // Compatibilidad temporal con contraseñas antiguas
    // que todavía estén guardadas sin hash.
    if (!storedPassword.includes(':')) {
        return password === storedPassword;
    }

    const partes = storedPassword.split(':');

    if (partes.length !== 2) {
        return false;
    }

    const [salt, storedHash] = partes;

    if (
        !/^[a-f0-9]{32}$/.test(salt) ||
        !/^[a-f0-9]{128}$/.test(storedHash)
    ) {
        return false;
    }

    const hash = crypto
        .scryptSync(password, salt, 64)
        .toString('hex');

    return crypto.timingSafeEqual(
        Buffer.from(hash, 'hex'),
        Buffer.from(storedHash, 'hex')
    );
}

// Buscar si un correo ya está registrado
async function buscarUsuarioPorCorreo(correo) {
    return await supabase
        .from('usuarios')
        .select('id')
        .eq('correo', correo)
        .maybeSingle();
}

// Crear un usuario con el rol indicado por el backend
async function crearUsuario(datos, rol) {
    const contraseñaHash = hashPassword(datos.contraseña);

    return await supabase
        .from('usuarios')
        .insert([{
            nombre: datos.nombre.trim(),
            apellido: datos.apellido.trim(),
            correo: datos.correo,
            contraseña: contraseñaHash,
            rol
        }])
        .select('id, nombre, apellido, correo, rol')
        .single();
}

// REGISTRO PÚBLICO: siempre crea usuarios Cliente
const register = async (req, res) => {
    try {
        const { nombre, apellido, correo, contraseña } = req.body;

        if (
            typeof nombre !== 'string' ||
            typeof apellido !== 'string' ||
            typeof correo !== 'string' ||
            typeof contraseña !== 'string' ||
            !nombre.trim() ||
            !apellido.trim() ||
            !correo.trim() ||
            !contraseña
        ) {
            return res.status(400).json({
                error: 'Todos los campos son obligatorios'
            });
        }

        const correoNormalizado = normalizarCorreo(correo);

        if (!validarCorreo(correoNormalizado)) {
            return res.status(400).json({
                error: 'El formato del correo electrónico no es válido'
            });
        }

        if (!validarContraseña(contraseña)) {
            return res.status(400).json({
                error: 'La contraseña debe tener entre 8 y 128 caracteres, incluyendo mayúscula, minúscula y número'
            });
        }

        const { data: usuarioExistente, error: errorBusqueda } =
            await buscarUsuarioPorCorreo(correoNormalizado);

        if (errorBusqueda) {
            console.error(errorBusqueda);

            return res.status(500).json({
                error: 'Error al consultar el usuario'
            });
        }

        if (usuarioExistente) {
            return res.status(409).json({
                error: 'El correo ya está registrado'
            });
        }

        const { data: nuevoUsuario, error } = await crearUsuario({
            nombre,
            apellido,
            correo: correoNormalizado,
            contraseña
        }, 'Cliente');

        if (error) {
            console.error(error);

            // Manejar también una posible restricción UNIQUE en la BD
            if (error.code === '23505') {
                return res.status(409).json({
                    error: 'El correo ya está registrado'
                });
            }

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

// CREAR ADMINISTRADOR: debe protegerse en las rutas con
// requireAuth y requireRole('Administrador').
const registerAdmin = async (req, res) => {
    try {
        const { nombre, apellido, correo, contraseña } = req.body;

        if (
            typeof nombre !== 'string' ||
            typeof apellido !== 'string' ||
            typeof correo !== 'string' ||
            typeof contraseña !== 'string' ||
            !nombre.trim() ||
            !apellido.trim() ||
            !correo.trim() ||
            !contraseña
        ) {
            return res.status(400).json({
                error: 'Todos los campos son obligatorios'
            });
        }

        const correoNormalizado = normalizarCorreo(correo);

        if (!validarCorreo(correoNormalizado)) {
            return res.status(400).json({
                error: 'El formato del correo electrónico no es válido'
            });
        }

        if (!validarContraseña(contraseña)) {
            return res.status(400).json({
                error: 'La contraseña debe tener entre 8 y 128 caracteres, incluyendo mayúscula, minúscula y número'
            });
        }

        const { data: usuarioExistente, error: errorBusqueda } =
            await buscarUsuarioPorCorreo(correoNormalizado);

        if (errorBusqueda) {
            console.error(errorBusqueda);

            return res.status(500).json({
                error: 'Error al consultar el usuario'
            });
        }

        if (usuarioExistente) {
            return res.status(409).json({
                error: 'El correo ya está registrado'
            });
        }

        // El rol se decide en el backend, nunca desde el formulario.
        const { data: nuevoUsuario, error } = await crearUsuario({
            nombre,
            apellido,
            correo: correoNormalizado,
            contraseña
        }, 'Administrador');

        if (error) {
            console.error(error);

            if (error.code === '23505') {
                return res.status(409).json({
                    error: 'El correo ya está registrado'
                });
            }

            return res.status(500).json({
                error: 'No se pudo crear el administrador'
            });
        }

        return res.status(201).json({
            mensaje: 'Administrador creado correctamente',
            usuario: nuevoUsuario
        });

    } catch (error) {
        console.error(error);

        return res.status(500).json({
            error: 'Error interno del servidor'
        });
    }
};

// INICIO DE SESIÓN
const login = async (req, res) => {
    try {
        const { correo, contraseña } = req.body;

        if (
            typeof correo !== 'string' ||
            typeof contraseña !== 'string' ||
            !correo.trim() ||
            !contraseña
        ) {
            return res.status(400).json({
                error: 'Correo y contraseña son obligatorios'
            });
        }

        const correoNormalizado = normalizarCorreo(correo);

        if (!validarCorreo(correoNormalizado)) {
            return res.status(400).json({
                error: 'El formato del correo electrónico no es válido'
            });
        }

        const { data: usuario, error } = await supabase
            .from('usuarios')
            .select('*')
            .eq('correo', correoNormalizado)
            .maybeSingle();

        if (error) {
            console.error(error);

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

        // Migrar contraseñas antiguas en texto plano al hash scrypt.
        if (!usuario.contraseña.includes(':')) {
            const nuevaContraseña = hashPassword(contraseña);

            const { error: errorActualizacion } = await supabase
                .from('usuarios')
                .update({ contraseña: nuevaContraseña })
                .eq('id', usuario.id);

            if (errorActualizacion) {
                console.error(
                    'No se pudo actualizar el hash de la contraseña:',
                    errorActualizacion
                );

                return res.status(500).json({
                    error: 'No se pudo actualizar la seguridad de la cuenta'
                });
            }
        }

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

// CERRAR SESIÓN
const logout = (req, res) => {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (token) {
        sesiones.delete(token);
    }

    return res.status(200).json({
        mensaje: 'Sesión cerrada correctamente'
    });
};

// Exportar funciones para las rutas
module.exports = {
    register,
    registerAdmin,
    login,
    logout,
    sesiones,
    TIEMPO_INACTIVIDAD
};