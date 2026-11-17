// public/js/auth.js

function conTimeout(promesa, ms = 10000) {
  return Promise.race([
    promesa,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Tiempo de espera agotado al conectar con Firestore.")), ms)
    )
  ]);
}

// Iniciar sesión
const formLogin = document.getElementById("formLogin");
if (formLogin) {
  formLogin.addEventListener("submit", async (e) => {
    e.preventDefault();
    const correo = document.getElementById("loginCorreo").value.trim();
    const password = document.getElementById("loginPassword").value;
    const errorDiv = document.getElementById("loginError");
    const btnSubmit = formLogin.querySelector('button[type="submit"]');

    errorDiv.classList.add("d-none");
    btnSubmit.disabled = true;
    btnSubmit.textContent = "Ingresando...";

    try {
      const cred = await auth.signInWithEmailAndPassword(correo, password);
      const userDoc = await conTimeout(db.collection("usuarios").doc(cred.user.uid).get());

      if (!userDoc.exists) {
        throw new Error("El perfil de usuario no existe en Firestore.");
      }

      const rol = userDoc.data().rol;
      if (rol === "admin") window.location.href = "admin_cola.html";
      else if (rol === "tecnico") window.location.href = "tecnico_panel.html";
      else window.location.href = "usuario_panel.html";

    } catch (error) {
      errorDiv.textContent = "Error al iniciar sesión: " + error.message;
      errorDiv.classList.remove("d-none");
      btnSubmit.disabled = false;
      btnSubmit.textContent = "Ingresar";
    }
  });
}

// Registrar nuevo usuario
const formRegistro = document.getElementById("formRegistro");
if (formRegistro) {
  formRegistro.addEventListener("submit", async (e) => {
    e.preventDefault();
    const nombre = document.getElementById("regNombre").value.trim();
    const correo = document.getElementById("regCorreo").value.trim();
    const password = document.getElementById("regPassword").value;
    const departamento = document.getElementById("regDepartamento").value;
    const rol = document.getElementById("regRol").value;
    const errorDiv = document.getElementById("regError");
    const btnSubmit = formRegistro.querySelector('button[type="submit"]');

    errorDiv.classList.add("d-none");
    btnSubmit.disabled = true;
    btnSubmit.textContent = "Registrando...";

    let cred = null;
    try {
      cred = await auth.createUserWithEmailAndPassword(correo, password);
      try {
        await conTimeout(
          db.collection("usuarios").doc(cred.user.uid).set({
            uid: cred.user.uid,
            nombre: nombre,
            correo: correo,
            departamento: departamento,
            rol: rol,
            fechaCreacion: firebase.firestore.FieldValue.serverTimestamp()
          })
        );
      } catch (firestoreError) {
        try {
          await cred.user.delete();
        } catch (rollbackError) {
          console.error("No se pudo eliminar la cuenta creada en Auth:", rollbackError);
        }
        throw new Error("No se pudo guardar en Firestore: " + firestoreError.message);
      }

      alert("¡Cuenta creada exitosamente! Redirigiendo...");

      if (rol === "admin") window.location.href = "admin_cola.html";
      else if (rol === "tecnico") window.location.href = "tecnico_panel.html";
      else window.location.href = "usuario_panel.html";

    } catch (error) {
      errorDiv.textContent = "Error al registrar: " + error.message;
      errorDiv.classList.remove("d-none");
      btnSubmit.disabled = false;
      btnSubmit.textContent = "Registrar Usuario";
    }
  });
}

// Protección de rutas
function protegerRuta(rolPermitido, callbackUsuario) {
  auth.onAuthStateChanged(async (user) => {
    if (!user) {
      window.location.href = "login.html";
      return;
    }
    const doc = await db.collection("usuarios").doc(user.uid).get();
    if (!doc.exists) {
      window.location.href = "login.html";
      return;
    }
    const datosUsuario = doc.data();
    if (rolPermitido && datosUsuario.rol !== rolPermitido) {
      alert("No tienes permisos para acceder a esta vista.");
      window.location.href = "index.html";
      return;
    }
    if (callbackUsuario) callbackUsuario(datosUsuario);
  });
}

function cerrarSesion() {
  auth.signOut().then(() => {
    window.location.href = "login.html";
  });
}