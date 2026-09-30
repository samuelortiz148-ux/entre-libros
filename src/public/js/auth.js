// =========================================
// Autenticación - Entre Libros
// =========================================

const API_AUTH = '/api/auth';

// Mostrar mensajes en pantalla
function mostrarMensaje(mensaje, tipo = '') {
    const elemento = document.getElementById('auth-message');

    if (!elemento) {
        return;
    }

    elemento.textContent = mensaje;
    elemento.className = `auth-message ${tipo}`;
}


// =========================================
// LOGIN
// =========================================

const loginForm = document.getElementById('login-form');

if (loginForm) {
    loginForm.addEventListener('submit', async (event) => {
        event.preventDefault();

        const correo = document.getElementById('correo').value.trim();
        const contraseña = document.getElementById('contraseña').value;

        mostrarMensaje('Iniciando sesión...');

        try {
            const respuesta = await fetch(`${API_AUTH}/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    correo,
                    contraseña
                })
            });

            const datos = await respuesta.json();

            if (!respuesta.ok) {
                mostrarMensaje(
                    datos.error || 'No se pudo iniciar sesión.',
                    'auth-error'
                );
                return;
            }

            // Guardar los datos de la sesión en el navegador
            sessionStorage.setItem('authToken', datos.token);
            sessionStorage.setItem(
                'usuario',
                JSON.stringify(datos.usuario)
            );

            mostrarMensaje(
                'Inicio de sesión exitoso.',
                'auth-success'
            );

            setTimeout(() => {
                window.location.href = '/index.html';
            }, 800);

        } catch (error) {
            console.error(error);

            mostrarMensaje(
                'No se pudo conectar con el servidor.',
                'auth-error'
            );
        }
    });
}


// =========================================
// REGISTRO
// =========================================

const registerForm = document.getElementById('register-form');

if (registerForm) {
    registerForm.addEventListener('submit', async (event) => {
        event.preventDefault();

        const nombre = document.getElementById('nombre').value.trim();
        const apellido = document.getElementById('apellido').value.trim();
        const correo = document.getElementById('correo').value.trim();
        const contraseña = document.getElementById('contraseña').value;

        mostrarMensaje('Registrando usuario...');

        try {
            const respuesta = await fetch(`${API_AUTH}/register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    nombre,
                    apellido,
                    correo,
                    contraseña
                })
            });

            const datos = await respuesta.json();

            if (!respuesta.ok) {
                mostrarMensaje(
                    datos.error || 'No se pudo registrar el usuario.',
                    'auth-error'
                );
                return;
            }

            mostrarMensaje(
                'Registro exitoso. Ahora puedes iniciar sesión.',
                'auth-success'
            );

            registerForm.reset();

            setTimeout(() => {
                window.location.href = '/login.html';
            }, 1200);

        } catch (error) {
            console.error(error);

            mostrarMensaje(
                'No se pudo conectar con el servidor.',
                'auth-error'
            );
        }
    });
}

