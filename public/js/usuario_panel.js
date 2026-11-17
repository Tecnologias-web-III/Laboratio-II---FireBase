let usuarioActual = null;
let unsubscribeIncidencias = null;

protegerRuta("usuario", (datosUsuario) => {
  usuarioActual = datosUsuario;
  document.getElementById("nombreUsuarioNav").textContent = `Hola, ${datosUsuario.nombre}`;
  document.getElementById("departamento").value = datosUsuario.departamento || "";
  escucharMisIncidencias();
});

document.getElementById("formIncidencia").addEventListener("submit", reportarIncidencia);
document.getElementById("filtroEstadoUsuario").addEventListener("change", escucharMisIncidencias);
document.getElementById("btnConfirmarRechazo").addEventListener("click", confirmarRechazo);

async function reportarIncidencia(event) {
  event.preventDefault();

  if (!usuarioActual) return;

  const form = event.currentTarget;
  const boton = document.getElementById("btnEnviarIncidencia");
  const errorDiv = document.getElementById("formIncidenciaError");
  const successDiv = document.getElementById("formIncidenciaSuccess");
  const foto = document.getElementById("fotoReporte").files[0];

  errorDiv.classList.add("d-none");
  successDiv.classList.add("d-none");

  if (!foto) {
    mostrarErrorIncidencia("Debe adjuntar una foto del dano.");
    return;
  }

  if (!foto.type.startsWith("image/")) {
    mostrarErrorIncidencia("El archivo seleccionado debe ser una imagen.");
    return;
  }

  if (foto.size > 10 * 1024 * 1024) {
    mostrarErrorIncidencia("La imagen no puede superar los 10 MB.");
    return;
  }

  boton.disabled = true;
  boton.textContent = "Subiendo foto...";

  try {
    const imagenReporteUrl = await subirImagenIncidencia(foto);

    await db.collection("incidencias").add({
      titulo: document.getElementById("titulo").value.trim(),
      descripcion: document.getElementById("descripcion").value.trim(),
      tipo: document.getElementById("tipo").value,
      departamento: usuarioActual.departamento || document.getElementById("departamento").value,
      estado: "Pendiente",
      usuarioId: usuarioActual.uid || auth.currentUser.uid,
      usuarioNombre: usuarioActual.nombre,
      tecnicoId: "",
      tecnicoNombre: "",
      fechaReporte: firebase.firestore.FieldValue.serverTimestamp(),
      fechaAsignacion: null,
      fechaResolucion: null,
      imagenReporteUrl: imagenReporteUrl,
      imagenSolucionUrl: "",
      conformidad: "",
      motivoRechazo: ""
    });

    form.reset();
    document.getElementById("departamento").value = usuarioActual.departamento || "";
    successDiv.textContent = "Averia reportada correctamente.";
    successDiv.classList.remove("d-none");
  } catch (error) {
    console.error("Error al crear la incidencia:", error);
    mostrarErrorIncidencia("No se pudo registrar la averia. Intente nuevamente.");
  } finally {
    boton.disabled = false;
    boton.textContent = "Enviar reporte";
  }
}

function mostrarErrorIncidencia(mensaje) {
  const errorDiv = document.getElementById("formIncidenciaError");
  errorDiv.textContent = mensaje;
  errorDiv.classList.remove("d-none");
}

function escucharMisIncidencias() {
  if (!usuarioActual) return;
  if (unsubscribeIncidencias) unsubscribeIncidencias();

  const filtro = document.getElementById("filtroEstadoUsuario").value;
  let consulta = db.collection("incidencias").where(
    "usuarioId",
    "==",
    usuarioActual.uid || auth.currentUser.uid
  );

  unsubscribeIncidencias = consulta.onSnapshot(
    (snapshot) => {
      let incidencias = [];
      snapshot.forEach((doc) => {
        incidencias.push({ id: doc.id, ...doc.data() });
      });

      if (filtro !== "TODOS") {
        incidencias = incidencias.filter((incidencia) => incidencia.estado === filtro);
      }

      incidencias.sort((a, b) => {
        const fechaA = a.fechaReporte?.toMillis?.() || 0;
        const fechaB = b.fechaReporte?.toMillis?.() || 0;
        return fechaB - fechaA;
      });

      renderizarIncidencias(incidencias);
    },
    (error) => {
      console.error("Error consultando incidencias:", error);
      document.getElementById("contenedorMisIncidencias").innerHTML =
        '<div class="col-12"><div class="alert alert-danger">No se pudieron cargar las averias.</div></div>';
    }
  );
}

function renderizarIncidencias(incidencias) {
  const contenedor = document.getElementById("contenedorMisIncidencias");
  contenedor.innerHTML = "";

  if (incidencias.length === 0) {
    contenedor.innerHTML =
      '<div class="col-12"><div class="alert alert-info">No hay averias para mostrar.</div></div>';
    return;
  }

  incidencias.forEach((incidencia) => {
    const fechaReporte = formatearFecha(incidencia.fechaReporte);
    const fechaAsignacion = incidencia.fechaAsignacion
      ? formatearFecha(incidencia.fechaAsignacion)
      : "Pendiente de asignacion";
    const fechaResolucion = incidencia.fechaResolucion
      ? formatearFecha(incidencia.fechaResolucion)
      : "";

    const imagenReporte = incidencia.imagenReporteUrl
      ? `<a href="${escaparHtml(incidencia.imagenReporteUrl)}" target="_blank" rel="noopener" class="btn btn-sm btn-outline-secondary">Ver foto del dano</a>`
      : "";
    const imagenSolucion = incidencia.imagenSolucionUrl
      ? `<a href="${escaparHtml(incidencia.imagenSolucionUrl)}" target="_blank" rel="noopener" class="btn btn-sm btn-outline-success">Ver foto de la solucion</a>`
      : "";

    let acciones = "";
    if (incidencia.estado === "Resuelta") {
      acciones = `
        <div class="d-grid d-md-flex gap-2 mt-3">
          <button type="button" class="btn btn-success" onclick="aceptarSolucion('${incidencia.id}')">
            Aceptar solucion
          </button>
          <button type="button" class="btn btn-outline-danger" onclick="abrirRechazo('${incidencia.id}')">
            Rechazar solucion
          </button>
        </div>
      `;
    }

    const motivoRechazo = incidencia.motivoRechazo
      ? `<div class="alert alert-danger py-2 small mt-2 mb-0"><strong>Motivo:</strong> ${escaparHtml(incidencia.motivoRechazo)}</div>`
      : "";

    const tecnico = incidencia.tecnicoNombre || "Aun no asignado";
    const badgeClass = obtenerClaseEstado(incidencia.estado);

    contenedor.innerHTML += `
      <div class="col-12 col-md-6 col-lg-4">
        <article class="card card-custom h-100 p-3">
          <div class="d-flex justify-content-between align-items-start gap-2 mb-2">
            <span class="badge ${badgeClass}">${escaparHtml(incidencia.estado)}</span>
            <span class="badge bg-secondary">${escaparHtml(incidencia.tipo)}</span>
          </div>
          <h5 class="fw-bold mb-1">${escaparHtml(incidencia.titulo)}</h5>
          <p class="text-muted small mb-2">
            Departamento: ${escaparHtml(incidencia.departamento)}
          </p>
          <p class="small">${escaparHtml(incidencia.descripcion)}</p>
          <div class="small mb-2">
            <div><strong>Tecnico:</strong> ${escaparHtml(tecnico)}</div>
            <div><strong>Reportada:</strong> ${escaparHtml(fechaReporte)}</div>
            <div><strong>Asignada:</strong> ${escaparHtml(fechaAsignacion)}</div>
            ${fechaResolucion ? `<div><strong>Resuelta:</strong> ${escaparHtml(fechaResolucion)}</div>` : ""}
          </div>
          <div class="d-flex flex-wrap gap-2 mb-2">
            ${imagenReporte}
            ${imagenSolucion}
          </div>
          ${motivoRechazo}
          ${acciones}
        </article>
      </div>
    `;
  });
}

async function aceptarSolucion(incidenciaId) {
  if (!confirm("Confirma que la solucion fue aceptada satisfactoriamente?")) return;

  try {
    await db.collection("incidencias").doc(incidenciaId).update({
      estado: "Cerrada",
      conformidad: "Aceptada",
      motivoRechazo: ""
    });
  } catch (error) {
    console.error("Error al aceptar la solucion:", error);
    alert("No se pudo aceptar la solucion.");
  }
}

function abrirRechazo(incidenciaId) {
  document.getElementById("incidenciaRechazoId").value = incidenciaId;
  document.getElementById("motivoRechazo").value = "";
  document.getElementById("rechazoError").classList.add("d-none");
  bootstrap.Modal.getOrCreateInstance(document.getElementById("modalRechazo")).show();
}

async function confirmarRechazo() {
  const incidenciaId = document.getElementById("incidenciaRechazoId").value;
  const motivo = document.getElementById("motivoRechazo").value.trim();
  const errorDiv = document.getElementById("rechazoError");

  if (motivo.length < 10) {
    errorDiv.textContent = "Ingrese al menos 10 caracteres explicando el rechazo.";
    errorDiv.classList.remove("d-none");
    return;
  }

  const boton = document.getElementById("btnConfirmarRechazo");
  boton.disabled = true;

  try {
    await db.collection("incidencias").doc(incidenciaId).update({
      estado: "Rechazada",
      conformidad: "Rechazada",
      motivoRechazo: motivo
    });
    bootstrap.Modal.getOrCreateInstance(document.getElementById("modalRechazo")).hide();
  } catch (error) {
    console.error("Error al rechazar la solucion:", error);
    errorDiv.textContent = "No se pudo registrar el rechazo.";
    errorDiv.classList.remove("d-none");
  } finally {
    boton.disabled = false;
  }
}

function formatearFecha(timestamp) {
  if (!timestamp) return "Sin fecha";
  const fecha = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  if (Number.isNaN(fecha.getTime())) return "Sin fecha";
  return fecha.toLocaleString("es-CR", {
    dateStyle: "medium",
    timeStyle: "short"
  });
}

function obtenerClaseEstado(estado) {
  const clasesPermitidas = {
    Pendiente: "badge-pendiente",
    Asignada: "badge-asignada",
    Resuelta: "badge-resuelta",
    Cerrada: "badge-cerrada",
    Rechazada: "badge-rechazada"
  };

  return clasesPermitidas[estado] || "bg-secondary";
}

function escaparHtml(valor) {
  return String(valor ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
