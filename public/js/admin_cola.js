// public/js/admin_cola.js
let listaTecnicos = [];

protegerRuta("admin", async (adminData) => {
  document.getElementById("nombreAdminNav").textContent = `Hola, ${adminData.nombre}`;
  await cargarTecnicos();
  escucharIncidencias();
});

document.getElementById("filtroEstado").addEventListener("change", () => {
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

  const filtro = document.getElementById("filtroEstado").value;
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
              <label class="form-label small fw-semibold mb-1">Asignar Técnico:</label>
              <div class="input-group input-group-sm mb-2">
                <select id="selectTec_${id}" class="form-select">
                  ${opcionesTecnicos}
                </select>
                <button class="btn btn-primary" onclick="asignarTecnico('${id}')">Asignar</button>
              </div>
              <a href="chat.html?incidenciaId=${id}" class="btn btn-sm btn-outline-dark w-100">
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

async function asignarTecnico(incidenciaId) {
  const select = document.getElementById(`selectTec_${incidenciaId}`);
  const tecnicoId = select.value;
  if (!tecnicoId) {
    alert("Selecciona un técnico primero.");
    return;
  }
  const tecnicoNombre = select.options[select.selectedIndex].getAttribute("data-nombre");

  try {
    await db.collection("incidencias").doc(incidenciaId).update({
      tecnicoId: tecnicoId,
      tecnicoNombre: tecnicoNombre,
      estado: "Asignada",
      fechaAsignacion: firebase.firestore.FieldValue.serverTimestamp()
    });
    alert(`Incidencia asignada a ${tecnicoNombre}.`);
  } catch (error) {
    console.error("Error al asignar técnico:", error);
    alert("No se pudo asignar el técnico.");
  }
}