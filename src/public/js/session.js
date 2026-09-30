// =========================================
// Control de sesión - Entre Libros
// =========================================

const TIEMPO_INACTIVIDAD = 10 * 60 * 1000;

let temporizadorInactividad = null;


// =========================================
// CERRAR SESIÓN POR INACTIVIDAD
// =========================================

async function cerrarSesionPorInactividad() {
    const token = sessionStorage.getItem('authToken');

    if (!token) {
        return;
    }

    try {
        await fetch('/api/auth/logout', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
    } catch (error) {
        console.error('Error al cerrar la sesión:', error);
    }

    sessionStorage.removeItem('authToken');
    sessionStorage.removeItem('usuario');

    window.location.href = '/login.html?expirada=1';
}


// =========================================
// REINICIAR TEMPORIZADOR
// =========================================

function reiniciarTemporizador() {
    const token = sessionStorage.getItem('authToken');

    if (!token) {
        return;
    }

    clearTimeout(temporizadorInactividad);

    temporizadorInactividad = setTimeout(
        cerrarSesionPorInactividad,
        TIEMPO_INACTIVIDAD
    );
}


// =========================================
// DETECTAR ACTIVIDAD DEL USUARIO
// =========================================

const eventosActividad = [
    'click',
    'keydown',
    'mousemove',
    'scroll',
    'touchstart'
];

eventosActividad.forEach((evento) => {
    document.addEventListener(
        evento,
        reiniciarTemporizador
    );
});


// =========================================
// INICIAR CONTROL DE SESIÓN
// =========================================

if (sessionStorage.getItem('authToken')) {
    reiniciarTemporizador();
}