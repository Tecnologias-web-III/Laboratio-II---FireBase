const contenedorAsignadas = document.querySelector('#contenedorAsignadas');
const modalGestion = new bootstrap.Modal(document.getElementById('modalGestion'));

const txtIncidenciaId = document.querySelector('#txtIncidenciaId');
const lblTituloIncidencia = document.querySelector('#lblTituloIncidencia');
const lblDescripcionIncidencia = document.querySelector('#lblDescripcionIncidencia');
const txtComentarioBitacora = document.querySelector('#txtComentarioBitacora');
const txtArchivoBitacora = document.querySelector('#txtArchivoBitacora');
const btnGuardarBitacora = document.querySelector('#btnGuardarBitacora');
const historialBitacora = document.querySelector('#historialBitacora');
const txtArchivoSolucion = document.querySelector('#txtArchivoSolucion');
const btnMarcarResuelta = document.querySelector('#btnMarcarResuelta');

let tecnicoActualNombre = "Técnico";
let unsubscribeIncidenciasAsignadas = null;

protegerRuta("tecnico", (tecnicoData) => {
    tecnicoActualNombre = tecnicoData.nombre || "Técnico";
    cargarIncidenciasAsignadas(auth.currentUser.uid);
});

function cargarIncidenciasAsignadas(tecnicoId) {
    if (unsubscribeIncidenciasAsignadas) unsubscribeIncidenciasAsignadas();

    unsubscribeIncidenciasAsignadas = db.collection("incidencias")
      .where("tecnicoId", "==", tecnicoId)
      .where("estado", "==", "Asignada")
      .onSnapshot((querySnapshot) => {
          contenedorAsignadas.innerHTML = "";
          if (querySnapshot.empty) {
              contenedorAsignadas.innerHTML = `<div class="col-12"><p class="text-muted">No tienes averías asignadas actualmente.</p></div>`;
              return;
          }

          querySnapshot.forEach((doc) => {
              const inc = doc.data();
              let card = `
                <div class="col-md-4 mb-3">
                    <div class="card h-100 shadow-sm">
                        <div class="card-body">
                            <h5 class="card-title">${inc.titulo}</h5>
                            <h6 class="card-subtitle mb-2 text-muted">Depto: ${inc.departamento} | Tipo: ${inc.tipo}</h6>
                            <p class="card-text">${inc.descripcion}</p>
                            ${inc.imagenReporteUrl ? `<a href="${inc.imagenReporteUrl}" target="_blank" class="btn btn-sm btn-outline-info mb-2">Ver Foto de Falla</a>` : ''}
                            <br>
                            <button class="btn btn-primary btn-sm w-100 mt-2" onclick="abrirGestion('${doc.id}', '${encodeURIComponent(inc.titulo)}', '${encodeURIComponent(inc.descripcion)}')">Gestionar / Bitácora</button>
                            <a href="chat.html?incidenciaId=${doc.id}" class="btn btn-outline-dark btn-sm w-100 mt-2">Chat con administración</a>
                        </div>
                    </div>
                </div>
              `;
              contenedorAsignadas.innerHTML += card;
          });
      }, (error) => {
          console.error("Error al cargar incidencias: ", error);
          contenedorAsignadas.innerHTML = '<div class="col-12"><div class="alert alert-danger">No se pudieron cargar las averías asignadas.</div></div>';
      });
}

window.abrirGestion = function(id, titulo, descripcion) {
    txtIncidenciaId.value = id;
    lblTituloIncidencia.textContent = decodeURIComponent(titulo);
    lblDescripcionIncidencia.textContent = decodeURIComponent(descripcion);
    txtComentarioBitacora.value = '';
    txtArchivoBitacora.value = '';
    txtArchivoSolucion.value = '';
    
    cargarHistorialBitacora(id);
    modalGestion.show();
}

function cargarHistorialBitacora(incidenciaId) {
    db.collection("bitacora_incidencias")
      .where("incidenciaId", "==", incidenciaId)
      .get()
      .then((querySnapshot) => {
          historialBitacora.innerHTML = "";
          if (querySnapshot.empty) {
              historialBitacora.innerHTML = `<small class="text-muted">No hay registros en la bitácora aún.</small>`;
              return;
          }
          querySnapshot.forEach((doc) => {
              const b = doc.data();
              let fechaStr = b.fecha ? new Date(b.fecha.toDate()).toLocaleString() : '';
              let item = `
                <div class="mb-2 border-bottom pb-1">
                    <strong>${b.tecnicoNombre}</strong> <small class="text-muted">(${fechaStr})</small>:
                    <p class="mb-1">${b.comentario}</p>
                    ${b.imagenUrl ? `<a href="${b.imagenUrl}" target="_blank" class="badge bg-info text-dark">Ver imagen adjunta</a>` : ''}
                </div>
              `;
              historialBitacora.innerHTML += item;
          });
      });
}

btnGuardarBitacora.addEventListener('click', async () => {
    const comentario = txtComentarioBitacora.value.trim();
    const archivo = txtArchivoBitacora.files[0];
    const incidenciaId = txtIncidenciaId.value;
    const user = auth.currentUser;

    if (!comentario) {
        alert("Por favor escriba un comentario para la bitácora.");
        return;
    }

    let imagenUrl = "";

    try {
        if (!user) throw new Error("Debes iniciar sesión para guardar en la bitácora.");

        if (archivo) {
            if (!supabaseClient) {
                throw new Error("El servicio de almacenamiento no está inicializado.");
            }

            const nombreUnico = `incidencias/bitacora_${Date.now()}_${archivo.name}`;
            const { error: uploadError } = await supabaseClient.storage
                .from(BUCKET_NAME)
                .upload(nombreUnico, archivo, { contentType: archivo.type });

            if (uploadError) throw uploadError;

            const { data: urlData } = supabaseClient.storage
                .from(BUCKET_NAME)
                .getPublicUrl(nombreUnico);
            
            imagenUrl = urlData.publicUrl;
        }

        const incidenciaRef = db.collection("incidencias").doc(incidenciaId);
        const bitacoraRef = db.collection("bitacora_incidencias").doc();
        await db.runTransaction(async (transaccion) => {
            const incidencia = await transaccion.get(incidenciaRef);
            if (!incidencia.exists || incidencia.data().estado !== "Asignada" || incidencia.data().tecnicoId !== user.uid) {
                throw new Error("La incidencia ya no está asignada a este técnico.");
            }

            transaccion.set(bitacoraRef, {
                incidenciaId: incidenciaId,
                tecnicoId: user.uid,
                tecnicoNombre: tecnicoActualNombre,
                comentario: comentario,
                imagenUrl: imagenUrl,
                fecha: firebase.firestore.FieldValue.serverTimestamp()
            });
        });

        alert("Comentario agregado a la bitácora exitosamente.");
        txtComentarioBitacora.value = '';
        txtArchivoBitacora.value = '';
        cargarHistorialBitacora(incidenciaId);

    } catch (error) {
        alert("Error al guardar en la bitácora: " + error.message);
    }
});

btnMarcarResuelta.addEventListener('click', async () => {
    const archivo = txtArchivoSolucion.files[0];
    const incidenciaId = txtIncidenciaId.value;

    if (!archivo) {
        alert("Debe adjuntar la foto del resultado final para marcar como resuelta.");
        return;
    }

    try {
        btnMarcarResuelta.disabled = true;
        btnMarcarResuelta.textContent = "Subiendo y guardando...";

        if (!supabaseClient) {
            throw new Error("El servicio de almacenamiento no está inicializado.");
        }

        const nombreUnico = `incidencias/solucion_${Date.now()}_${archivo.name}`;
        const { error: uploadError } = await supabaseClient.storage
            .from(BUCKET_NAME)
            .upload(nombreUnico, archivo, { contentType: archivo.type });

        if (uploadError) throw uploadError;

        const { data: urlData } = supabaseClient.storage
            .from(BUCKET_NAME)
            .getPublicUrl(nombreUnico);
        
        const imagenSolucionUrl = urlData.publicUrl;

        const incidenciaRef = db.collection("incidencias").doc(incidenciaId);
        await db.runTransaction(async (transaccion) => {
            const incidencia = await transaccion.get(incidenciaRef);
            if (!incidencia.exists || incidencia.data().estado !== "Asignada" || incidencia.data().tecnicoId !== auth.currentUser.uid) {
                throw new Error("La incidencia ya no está asignada a este técnico.");
            }

            transaccion.update(incidenciaRef, {
                estado: "Resuelta",
                imagenSolucionUrl: imagenSolucionUrl,
                fechaResolucion: firebase.firestore.FieldValue.serverTimestamp()
            });
        });

        alert("¡Incidencia marcada como Resuelta exitosamente!");
        modalGestion.hide();
        btnMarcarResuelta.disabled = false;
        btnMarcarResuelta.textContent = "Marcar como Resuelta";

    } catch (error) {
        alert("Error al resolver la incidencia: " + error.message);
        btnMarcarResuelta.disabled = false;
        btnMarcarResuelta.textContent = "Marcar como Resuelta";
    }
});