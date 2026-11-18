var db = firebase.apps[0].firestore();
var auth = firebase.apps[0].auth();

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

auth.onAuthStateChanged((user) => {
    if (user) {
        db.collection("usuarios").doc(user.uid).get().then((doc) => {
            if (doc.exists) {
                tecnicoActualNombre = doc.data().nombre || "Técnico";
            }
            cargarIncidenciasAsignadas(user.uid);
        });
    }
});

function cargarIncidenciasAsignadas(tecnicoId) {
    db.collection("incidencias")
      .where("tecnicoId", "==", tecnicoId)
      .where("estado", "==", "Asignada")
      .get()
      .then((querySnapshot) => {
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
                        </div>
                    </div>
                </div>
              `;
              contenedorAsignadas.innerHTML += card;
          });
      })
      .catch((error) => {
          console.error("Error al cargar incidencias: ", error);
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
        if (archivo) {
            const nombreUnico = `incidencias/bitacora_${Date.now()}_${archivo.name}`;
            const { error: uploadError } = await supabaseClient.storage
                .from('archivos') // Reemplaza por tu bucket si difiere
                .upload(nombreUnico, archivo, { contentType: archivo.type });

            if (uploadError) throw uploadError;

            const { data: urlData } = supabaseClient.storage
                .from('archivos')
                .getPublicUrl(nombreUnico);
            
            imagenUrl = urlData.publicUrl;
        }

        await db.collection("bitacora_incidencias").add({
            incidenciaId: incidenciaId,
            tecnicoId: user.uid,
            tecnicoNombre: tecnicoActualNombre,
            comentario: comentario,
            imagenUrl: imagenUrl,
            fecha: new Date()
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

        const nombreUnico = `incidencias/solucion_${Date.now()}_${archivo.name}`;
        const { error: uploadError } = await supabaseClient.storage
            .from('archivos')
            .upload(nombreUnico, archivo, { contentType: archivo.type });

        if (uploadError) throw uploadError;

        const { data: urlData } = supabaseClient.storage
            .from('archivos')
            .getPublicUrl(nombreUnico);
        
        const imagenSolucionUrl = urlData.publicUrl;

        await db.collection("incidencias").doc(incidenciaId).update({
            estado: "Resuelta",
            imagenSolucionUrl: imagenSolucionUrl,
            fechaResolucion: new Date()
        });

        alert("¡Incidencia marcada como Resuelta exitosamente!");
        modalGestion.hide();
        btnMarcarResuelta.disabled = false;
        btnMarcarResuelta.textContent = "Marcar como Resuelta";

        cargarIncidenciasAsignadas(auth.currentUser.uid);

    } catch (error) {
        alert("Error al resolver la incidencia: " + error.message);
        btnMarcarResuelta.disabled = false;
        btnMarcarResuelta.textContent = "Marcar como Resuelta";
    }
});