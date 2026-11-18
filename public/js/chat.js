const incidenciaId = new URLSearchParams(window.location.search).get("incidenciaId");
const tituloIncidencia = document.getElementById("tituloIncidencia");
const estadoChat = document.getElementById("estadoChat");
const mensajesChat = document.getElementById("mensajesChat");
const formMensaje = document.getElementById("formMensaje");
const textoMensaje = document.getElementById("textoMensaje");
const btnEnviarMensaje = document.getElementById("btnEnviarMensaje");

let incidenciaActual = null;
let usuarioChat = null;

auth.onAuthStateChanged(async (user) => {
  if (!user) {
    window.location.href = "login.html";
    return;
  }

  try {
    const usuarioDoc = await db.collection("usuarios").doc(user.uid).get();
    if (!usuarioDoc.exists) {
      window.location.href = "login.html";
      return;
    }

    usuarioChat = { ...usuarioDoc.data(), uid: user.uid };
    if (!["admin", "tecnico"].includes(usuarioChat.rol)) {
      window.location.href = "usuario_panel.html";
      return;
    }

    const filtroAdmin = new URLSearchParams(window.location.search).get("filtroEstado");
    const panelHref = usuarioChat.rol === "admin"
      ? `admin_cola.html${filtroAdmin ? `?filtroEstado=${encodeURIComponent(filtroAdmin)}` : ""}`
      : "tecnico_panel.html";
    document.getElementById("enlacePanel").href = panelHref;
    document.getElementById("volverPanel").href = panelHref;

    if (!incidenciaId) {
      mostrarErrorChat("No se indicó una incidencia para abrir el chat.");
      return;
    }

    const incidenciaDoc = await db.collection("incidencias").doc(incidenciaId).get();
    if (!incidenciaDoc.exists) {
      mostrarErrorChat("La incidencia solicitada no existe.");
      return;
    }

    incidenciaActual = { id: incidenciaDoc.id, ...incidenciaDoc.data() };
    if (usuarioChat.rol === "tecnico" && incidenciaActual.tecnicoId !== user.uid) {
      mostrarErrorChat("Solo el técnico asignado puede acceder a este chat.");
      return;
    }

    prepararChat();
  } catch (error) {
    console.error("Error al abrir el chat:", error);
    mostrarErrorChat("No se pudo cargar el chat. Intenta nuevamente.");
  }
});

formMensaje.addEventListener("submit", async (event) => {
  event.preventDefault();
  const contenido = textoMensaje.value.trim();
  if (!contenido || !incidenciaActual || !usuarioChat) return;

  btnEnviarMensaje.disabled = true;
  textoMensaje.disabled = true;
  mostrarEstadoChat("Enviando...", "muted");

  try {
    await db.collection("chats").doc(incidenciaActual.id).collection("mensajes").add({
      contenido,
      autorId: usuarioChat.uid,
      autorNombre: usuarioChat.nombre || usuarioChat.correo || "Usuario",
      autorRol: usuarioChat.rol,
      fecha: firebase.firestore.FieldValue.serverTimestamp()
    });
    textoMensaje.value = "";
    textoMensaje.focus();
    mostrarEstadoChat("", "muted");
  } catch (error) {
    console.error("Error al enviar el mensaje:", error);
    mostrarEstadoChat("No se pudo enviar el mensaje: " + error.message, "danger");
  } finally {
    btnEnviarMensaje.disabled = !incidenciaActual;
    textoMensaje.disabled = !incidenciaActual;
  }
});

function prepararChat() {
  tituloIncidencia.textContent = `${incidenciaActual.titulo || "Incidencia"} · ${incidenciaActual.estado || ""}`;
  document.getElementById("idIncidencia").textContent = `ID de conversación: ${incidenciaActual.id}`;
  textoMensaje.disabled = false;
  btnEnviarMensaje.disabled = false;

  db.collection("chats")
    .doc(incidenciaActual.id)
    .collection("mensajes")
    .onSnapshot((snapshot) => {
      mensajesChat.replaceChildren();
      if (snapshot.empty) {
        const vacio = document.createElement("p");
        vacio.className = "text-muted mb-0";
        vacio.textContent = "Todavía no hay mensajes. Inicia la conversación.";
        mensajesChat.appendChild(vacio);
        return;
      }

      const mensajes = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        pendiente: doc.metadata.hasPendingWrites
      }));
      mensajes.sort((a, b) => obtenerMilisegundos(a.fecha) - obtenerMilisegundos(b.fecha) || a.id.localeCompare(b.id));

      mensajes.forEach((mensaje) => {
        const fila = document.createElement("div");
        fila.className = `mb-3 ${mensaje.autorId === usuarioChat.uid ? "text-end" : ""}`;

        const autor = document.createElement("strong");
        autor.textContent = mensaje.autorNombre || "Usuario";
        const rol = document.createElement("span");
        rol.className = "text-muted small ms-2";
        rol.textContent = mensaje.autorRol === "admin" ? "Admin" : "Técnico";
        const texto = document.createElement("p");
        texto.className = "mb-0";
        texto.textContent = mensaje.contenido || "";
        const fecha = document.createElement("small");
        fecha.className = "text-muted";
        fecha.textContent = mensaje.fecha?.toDate
          ? mensaje.fecha.toDate().toLocaleString("es-CR")
          : mensaje.pendiente ? "Enviando..." : "Fecha no disponible";

        fila.append(autor, rol);
        if (mensaje.contenido) fila.appendChild(texto);
        fila.appendChild(fecha);
        mensajesChat.appendChild(fila);
      });

      mensajesChat.scrollTop = mensajesChat.scrollHeight;
    }, (error) => {
      console.error("Error al escuchar mensajes del chat:", error);
      mostrarErrorChat("No se pudieron cargar los mensajes.");
    });
}

function obtenerMilisegundos(fecha) {
    if (fecha?.toMillis) return fecha.toMillis();
    if (fecha instanceof Date) return fecha.getTime();
    return 0;
}

function mostrarEstadoChat(mensaje, color) {
  estadoChat.textContent = mensaje;
  estadoChat.className = `small text-${color} mb-2`;
}

function mostrarErrorChat(mensaje) {
  tituloIncidencia.textContent = "Chat no disponible";
  estadoChat.textContent = mensaje;
  estadoChat.className = "alert alert-danger py-2 mb-2";
  textoMensaje.disabled = true;
  btnEnviarMensaje.disabled = true;
  mensajesChat.replaceChildren();
}