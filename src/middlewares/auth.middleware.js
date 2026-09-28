const { sesiones } = require('../controllers/auth.controller');

// Tiempo máximo de inactividad: 10 minutos
const TIEMPO_INACTIVIDAD = 10 * 60 * 1000;

// Verificar que exista una sesión válida
const requireAuth = (req, res, next) => {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
        return res.status(401).json({
            error: 'No autenticado'
        });
    }

    const sesion = sesiones.get(token);

    if (!sesion) {
        return res.status(401).json({
            error: 'Sesión inválida o expirada'
        });
    }

    // Comprobar 10 minutos de inactividad
    const tiempoSinActividad = Date.now() - sesion.ultimoAcceso;

    if (tiempoSinActividad >= TIEMPO_INACTIVIDAD) {
        sesiones.delete(token);

        return res.status(401).json({
            error: 'Sesión expirada por inactividad'
        });
    }

    // Actualizar el último acceso
    sesion.ultimoAcceso = Date.now();

    // Guardar el usuario para las siguientes funciones
    req.user = sesion;

    next();
};

// Verificar que el usuario tenga uno de los roles permitidos
const requireRole = (...rolesPermitidos) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                error: 'No autenticado'
            });
        }

        const rolUsuario = String(req.user.rol).toLowerCase();

        const rolesValidos = rolesPermitidos.map((rol) =>
            String(rol).toLowerCase()
        );

        if (!rolesValidos.includes(rolUsuario)) {
            return res.status(403).json({
                error: 'No tienes permisos para realizar esta acción'
            });
        }

        next();
    };
};

module.exports = {
    requireAuth,
    requireRole
};