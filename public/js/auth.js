// public/js/auth.js

// Iniciar sesión
const formLogin = document.getElementById("formLogin");
if (formLogin) {
  formLogin.addEventListener("submit", async (e) => {
    e.preventDefault();
    const correo = document.getElementById("loginCorreo").value.trim();
    const password = document.getElementById("loginPassword").value;
    const errorDiv = document.getElementById("loginError");
    errorDiv.classList.add("d-none");

    try {
      const cred = await auth.signInWithEmailAndPassword(correo, password);
      const userDoc = await db.collection("usuarios").doc(cred.user.uid).get();

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
    errorDiv.classList.add("d-none");

    try {
      const cred = await auth.createUserWithEmailAndPassword(correo, password);
      await db.collection("usuarios").doc(cred.user.uid).set({
        uid: cred.user.uid,
        nombre: nombre,
        correo: correo,
        departamento: departamento,
        rol: rol,
        fechaCreacion: firebase.firestore.FieldValue.serverTimestamp()
      });

      if (rol === "admin") window.location.href = "admin_cola.html";
      else if (rol === "tecnico") window.location.href = "tecnico_panel.html";
      else window.location.href = "usuario_panel.html";

    } catch (error) {
      errorDiv.textContent = "Error al registrar: " + error.message;
      errorDiv.classList.remove("d-none");
    }
  });
}

// Protección de rutas (disponible para todos los módulos del equipo)
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