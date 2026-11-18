// public/js/admin_cola.js
let listaTecnicos = [];
const filtroEstado = document.getElementById("filtroEstado");
const filtroInicial = new URLSearchParams(window.location.search).get("filtroEstado");
const modalBitacoraAdmin = bootstrap.Modal.getOrCreateInstance(document.getElementById("modalBitacoraAdmin"));
const contenidoBitacoraAdmin = document.getElementById("contenidoBitacoraAdmin");

if (Array.from(filtroEstado.options).some((opcion) => opcion.value === filtroInicial)) {
  filtroEstado.value = filtroInicial;
}

protegerRuta("admin", async (adminData) => {
  document.getElementById("nombreAdminNav").textContent = `Hola, ${adminData.nombre}`;
  await cargarTecnicos();
  escucharIncidencias();
});

filtroEstado.addEventListener("change", () => {
  const url = new URL(window.location.href);
  url.searchParams.set("filtroEstado", filtroEstado.value);
  window.history.replaceState({}, "", url);
  escucharIncidencias();
});

async function cargarTecnicos() {
  const snap = await db.collection("usuarios").where("rol", "==", "tecnico").get();
  listaTecnicos = [];
  snap.forEach((doc) => {
    listaTecnicos.push({ id: doc.id, ...doc.data() });
  });
}

let unsubscribeIncidencias = null;

function escucharIncidencias() {
  if (unsubscribeIncidencias) unsubscribeIncidencias();

  const filtro = filtroEstado.value;
  let query = db.collection("incidencias");

  if (filtro !== "TODOS") {
    query = query.where("estado", "==", filtro);
  }

  unsubscribeIncidencias = query.onSnapshot((snapshot) => {
    const contenedor = document.getElementById("contenedorIncidencias");
    contenedor.innerHTML = "";

    if (snapshot.empty) {
      contenedor.innerHTML = `<div class="col-12"><div class="alert alert-info">No hay incidencias en este estado.</div></div>`;
      return;
    }

    snapshot.forEach((doc) => {
      const inc = doc.data();
      const id = doc.id;
      const badgeClass = `badge-${inc.estado.toLowerCase()}`;

      let opcionesTecnicos = `<option value="">-- Seleccionar técnico --</option>`;
      listaTecnicos.forEach((tec) => {
        const selected = inc.tecnicoId === tec.uid ? "selected" : "";
        opcionesTecnicos += `<option value="${tec.uid}" data-nombre="${tec.nombre}" ${selected}>${tec.nombre}</option>`;
      });

      const imgHtml = inc.imagenReporteUrl
        ? `<a href="${inc.imagenReporteUrl}" target="_blank" class="btn btn-sm btn-outline-secondary mb-2">Ver foto del daño</a>`
        : "";

      const rechazoHtml = inc.motivoRechazo
        ? `<div class="alert alert-danger py-1 px-2 small mb-2"><strong>Motivo rechazo:</strong> ${inc.motivoRechazo}</div>`
        : "";
      const asignacionHtml = inc.estado === "Cancelada"
        ? `<p class="text-muted small mb-0">El usuario canceló este reporte.</p>`
        : `
          <label class="form-label small fw-semibold mb-1">Asignar Técnico:</label>
          <div class="input-group input-group-sm mb-2">
            <select id="selectTec_${id}" class="form-select">
              ${opcionesTecnicos}
            </select>
            <button class="btn btn-primary" onclick="asignarTecnico('${id}')">Asignar</button>
          </div>
        `;

      const card = `
        <div class="col-12 col-md-6 col-lg-4">
          <div class="card card-custom h-100 p-3">
            <div class="d-flex justify-content-between align-items-start mb-2">
              <span class="badge ${badgeClass}">${inc.estado}</span>
              <span class="badge bg-secondary">${inc.tipo}</span>
            </div>
            <h5 class="card-title fw-bold mb-1">${inc.titulo}</h5>
            <p class="text-muted small mb-2">Depto: <strong>${inc.departamento}</strong> | Reporta: ${inc.usuarioNombre}</p>
            <p class="card-text small">${inc.descripcion}</p>
            ${rechazoHtml}
            <div>${imgHtml}</div>

            <div class="mt-auto pt-2 border-top">
              ${asignacionHtml}
              <button type="button" class="btn btn-sm btn-outline-primary w-100 mb-2" onclick="verBitacora('${id}')">
                Ver bitácora
              </button>
              <a href="chat.html?incidenciaId=${encodeURIComponent(id)}&filtroEstado=${encodeURIComponent(filtroEstado.value)}" class="btn btn-sm btn-outline-dark w-100">
                Abrir Chat de Soporte
              </a>
            </div>
          </div>
        </div>
      `;
      contenedor.innerHTML += card;
    });
  });
}

window.verBitacora = async function(incidenciaId) {
  contenidoBitacoraAdmin.innerHTML = '<p class="text-muted mb-0">Cargando bitácora...</p>';
  modalBitacoraAdmin.show();

  try {
    const snapshot = await db.collection("bitacora_incidencias")
      .where("incidenciaId", "==", incidenciaId)
      .get();
    const registros = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    registros.sort((a, b) => obtenerMilisegundosBitacora(a.fecha) - obtenerMilisegundosBitacora(b.fecha) || a.id.localeCompare(b.id));
    contenidoBitacoraAdmin.replaceChildren();

    if (registros.length === 0) {
      contenidoBitacoraAdmin.innerHTML = '<p class="text-muted mb-0">Esta incidencia todavía no tiene registros en la bitácora.</p>';
      return;
    }

    registros.forEach((registro) => {
      const entrada = document.createElement("article");
      entrada.className = "border-bottom pb-3 mb-3";

      const encabezado = document.createElement("p");
      encabezado.className = "mb-1";
      const tecnico = document.createElement("strong");
      tecnico.textContent = registro.tecnicoNombre || "Técnico";
      const fecha = document.createElement("small");
      fecha.className = "text-muted ms-2";
      fecha.textContent = registro.fecha?.toDate
        ? registro.fecha.toDate().toLocaleString("es-CR")
        : "Fecha no disponible";
      encabezado.append(tecnico, fecha);

      const comentario = document.createElement("p");
      comentario.className = "mb-2";
      comentario.style.whiteSpace = "pre-wrap";
      comentario.textContent = registro.comentario || "";
      entrada.append(encabezado, comentario);

      if (registro.imagenUrl) {
        const enlaceImagen = document.createElement("a");
        enlaceImagen.href = registro.imagenUrl;
        enlaceImagen.target = "_blank";
        enlaceImagen.rel = "noopener noreferrer";

        const imagen = document.createElement("img");
        imagen.src = registro.imagenUrl;
        imagen.alt = "Evidencia adjunta a la bitácora";
        imagen.className = "img-fluid rounded";
        imagen.style.maxHeight = "300px";
        enlaceImagen.appendChild(imagen);
        entrada.appendChild(enlaceImagen);
      }

      contenidoBitacoraAdmin.appendChild(entrada);
    });
  } catch (error) {
    console.error("Error al cargar la bitácora para administración:", error);
    contenidoBitacoraAdmin.innerHTML = '<div class="alert alert-danger mb-0">No se pudo cargar la bitácora. Intenta nuevamente.</div>';
  }
};

function obtenerMilisegundosBitacora(fecha) {
  if (fecha?.toMillis) return fecha.toMillis();
  if (fecha instanceof Date) return fecha.getTime();
  return 0;
}

async function asignarTecnico(incidenciaId) {
  const select = document.getElementById(`selectTec_${incidenciaId}`);
  const tecnicoId = select.value;
  if (!tecnicoId) {
    alert("Selecciona un técnico primero.");
    return;
  }
  const tecnicoNombre = select.options[select.selectedIndex].getAttribute("data-nombre");

  try {
    const incidenciaRef = db.collection("incidencias").doc(incidenciaId);
    await db.runTransaction(async (transaccion) => {
      const incidencia = await transaccion.get(incidenciaRef);
      if (!incidencia.exists) throw new Error("La incidencia ya no existe.");
      if (incidencia.data().estado === "Cancelada") {
        throw new Error("No se puede asignar una incidencia cancelada.");
      }

      transaccion.update(incidenciaRef, {
        tecnicoId: tecnicoId,
        tecnicoNombre: tecnicoNombre,
        estado: "Asignada",
        fechaAsignacion: firebase.firestore.FieldValue.serverTimestamp()
      });
    });
    alert(`Incidencia asignada a ${tecnicoNombre}.`);
  } catch (error) {
    console.error("Error al asignar técnico:", error);
    alert("No se pudo asignar el técnico: " + error.message);
  }
}