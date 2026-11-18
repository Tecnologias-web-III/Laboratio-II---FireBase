const formReportes = document.getElementById("formReportes");
const filtrosReportes = document.getElementById("filtrosReportes");
const estadoReportes = document.getElementById("estadoReportes");
const resultadosReportes = document.getElementById("resultadosReportes");
const errorGraficos = document.getElementById("errorGraficos");
const tiposServicio = ["Hardware", "Software", "Otros"];
const formatoPorcentaje = new Intl.NumberFormat("es-CR", {
  style: "percent",
  maximumFractionDigits: 1
});
const formatoFechaReporte = new Intl.DateTimeFormat("es-CR", {
  timeZone: "America/Costa_Rica",
  dateStyle: "short",
  timeStyle: "medium"
});
let datosReportes = null;
let graficosListos = false;

protegerRuta("admin", (adminData) => {
  document.getElementById("nombreAdminNav").textContent = "Hola, " + adminData.nombre;
  cargarReportes();
});

formReportes.addEventListener("submit", (evento) => {
  evento.preventDefault();
  cargarReportes();
});

if (window.google?.charts) {
  google.charts.load("current", { packages: ["corechart"], language: "es" })
    .then(() => {
      graficosListos = true;
      dibujarGraficos();
    })
    .catch(() => errorGraficos.classList.remove("d-none"));
} else {
  errorGraficos.classList.remove("d-none");
}

async function cargarReportes() {
  const desde = document.getElementById("fechaDesde").value;
  const hasta = document.getElementById("fechaHasta").value;
  datosReportes = null;
  resultadosReportes.classList.add("d-none");
  estadoReportes.className = "text-muted";

  if (desde && hasta && desde > hasta) {
    mostrarErrorReporte("La fecha inicial debe ser anterior o igual a la fecha final.");
    return;
  }

  filtrosReportes.disabled = true;
  estadoReportes.textContent = "Cargando incidencias…";
  try {
    let consulta = db.collection("incidencias");
    if (desde) {
      consulta = consulta.where("fechaReporte", ">=", new Date(desde + "T00:00:00-06:00"));
    }
    if (hasta) {
      const inicioUltimoDia = Date.parse(hasta + "T00:00:00-06:00");
      consulta = consulta.where("fechaReporte", "<", new Date(inicioUltimoDia + 86400000));
    }

    const snapshot = await conTimeout(consulta.get());
    if (snapshot.empty) {
      estadoReportes.textContent = "No hay incidencias para el período seleccionado.";
      return;
    }

    datosReportes = calcularReportes(snapshot.docs.map((doc) => doc.data()));
    mostrarTablas(datosReportes);
    estadoReportes.textContent = snapshot.size === 1
      ? "1 incidencia en el período."
      : snapshot.size + " incidencias en el período.";
    resultadosReportes.classList.remove("d-none");
    dibujarGraficos();
  } catch (error) {
    console.error("Error al consultar los reportes:", error);
    mostrarErrorReporte("No se pudieron cargar las incidencias. Intente nuevamente.");
  } finally {
    filtrosReportes.disabled = false;
  }
}

function mostrarErrorReporte(mensaje) {
  estadoReportes.className = "alert alert-danger";
  estadoReportes.textContent = mensaje;
}

function calcularReportes(incidencias) {
  const departamentos = new Map();
  const tecnicos = new Map();
  const servicios = [0, 0, 0];
  const detalle = [];

  incidencias.forEach((incidencia) => {
    const indiceTipo = tiposServicio.indexOf(incidencia.tipo);
    const tipo = indiceTipo === -1 ? 2 : indiceTipo;
    const departamento = incidencia.departamento?.trim() || "Sin departamento";
    const conteos = departamentos.get(departamento) || [0, 0, 0];
    servicios[tipo]++;
    conteos[tipo]++;
    departamentos.set(departamento, conteos);

    if (!incidencia.tecnicoId && !incidencia.tecnicoNombre) return;

    const nombre = incidencia.tecnicoNombre || "Técnico " + incidencia.tecnicoId;
    const clave = incidencia.tecnicoId || nombre;
    if (!tecnicos.has(clave)) {
      tecnicos.set(clave, { nombre, sumas: [0, 0], casos: [0, 0] });
    }
    const tecnico = tecnicos.get(clave);
    const reporte = obtenerMilisegundos(incidencia.fechaReporte);
    const asignacion = obtenerMilisegundos(incidencia.fechaAsignacion);
    const resolucion = obtenerMilisegundos(incidencia.fechaResolucion);
    const espera = calcularDuracion(reporte, asignacion);
    const finalizada = ["Resuelta", "Cerrada"].includes(incidencia.estado);
    const atencion = finalizada ? calcularDuracion(asignacion, resolucion) : null;

    if (tipo < 2 && atencion !== null) {
      tecnico.sumas[tipo] += atencion;
      tecnico.casos[tipo]++;
    }
    detalle.push({ incidencia, nombre, reporte, asignacion, resolucion, espera, atencion });
  });

  return {
    total: incidencias.length,
    servicios,
    departamentos: [...departamentos].sort(([a], [b]) => a.localeCompare(b, "es-CR")),
    tecnicos: [...tecnicos.values()]
      .sort((a, b) => a.nombre.localeCompare(b.nombre, "es-CR"))
      .map(({ nombre, sumas, casos }) => ({
        nombre,
        promedios: sumas.map((suma, i) => casos[i] ? suma / casos[i] : null)
      })),
    detalle: detalle.sort((a, b) =>
      a.nombre.localeCompare(b.nombre, "es-CR") || (b.reporte ?? 0) - (a.reporte ?? 0)
    )
  };
}

function obtenerMilisegundos(fecha) {
  const milisegundos = fecha?.toMillis?.();
  return Number.isFinite(milisegundos) ? milisegundos : null;
}

function calcularDuracion(inicio, fin) {
  return inicio !== null && fin !== null && fin >= inicio ? fin - inicio : null;
}

function formatearDuracion(milisegundos) {
  if (milisegundos === null) return "—";
  const totalSegundos = Math.round(milisegundos / 1000);
  const horas = Math.floor(totalSegundos / 3600);
  const minutos = Math.floor(totalSegundos / 60) % 60;
  const segundos = totalSegundos % 60;
  return horas + " h " + minutos + " min " + segundos + " s";
}

function formatearFechaReporte(milisegundos) {
  return milisegundos === null ? "—" : formatoFechaReporte.format(milisegundos);
}

function mostrarTablas({ total, servicios, departamentos, tecnicos, detalle }) {
  llenarTabla("tablaDepartamentos", departamentos.map(([nombre, conteos]) => {
    const subtotal = conteos.reduce((suma, conteo) => suma + conteo, 0);
    const valores = conteos.map((conteo) =>
      conteo + " (" + formatoPorcentaje.format(conteo / subtotal) + ")"
    );
    return [nombre, ...valores, subtotal, formatoPorcentaje.format(subtotal / total)];
  }));

  llenarTabla("tablaServicios", tiposServicio.map((nombre, i) =>
    [nombre, servicios[i], formatoPorcentaje.format(servicios[i] / total)]
  ));

  llenarTabla("tablaTecnicos", tecnicos.map(({ nombre, promedios }) =>
    [nombre, ...promedios.map(formatearDuracion)]
  ), 3);

  llenarTabla("tablaDetalleTecnicos", detalle.map((caso) => [
    caso.nombre, caso.incidencia.titulo || "Sin título", caso.incidencia.tipo || "Sin tipo",
    caso.incidencia.estado || "Sin estado", formatearFechaReporte(caso.reporte),
    formatearFechaReporte(caso.asignacion), formatearFechaReporte(caso.resolucion),
    formatearDuracion(caso.espera), formatearDuracion(caso.atencion)
  ]), 9);
}

function llenarTabla(id, filas, columnas) {
  const tabla = document.getElementById(id);
  tabla.replaceChildren();
  if (!filas.length) {
    const celda = tabla.insertRow().insertCell();
    celda.colSpan = columnas;
    celda.textContent = "No hay averías asignadas en este período.";
    return;
  }
  const fragmento = document.createDocumentFragment();
  filas.forEach((valores) => {
    const fila = document.createElement("tr");
    valores.forEach((valor) => {
      fila.insertCell().textContent = valor;
    });
    fragmento.appendChild(fila);
  });
  tabla.appendChild(fragmento);
}

function dibujarGraficos() {
  if (!graficosListos || !datosReportes) return;

  const { departamentos, servicios, tecnicos } = datosReportes;
  const graficoTecnicos = document.getElementById("graficoTecnicos");
  const tecnicosConPromedio = tecnicos.filter(({ promedios }) => promedios.some((valor) => valor !== null));
  const colores = ["#0d6efd", "#198754", "#6c757d"];
  const opciones = { height: 300, colors: colores, legend: { position: "top" } };
  const visualizacion = google.visualization;

  try {
    const datosDepartamentos = visualizacion.arrayToDataTable([
      ["Departamento", ...tiposServicio],
      ...departamentos.map(([nombre, conteos]) => [nombre, ...conteos])
    ]);
    new visualizacion.ColumnChart(document.getElementById("graficoDepartamentos"))
      .draw(datosDepartamentos, {
        ...opciones,
        isStacked: true,
        vAxis: { title: "Incidencias", format: "0", minValue: 0 }
      });

    graficoTecnicos.replaceChildren();
    if (tecnicosConPromedio.length) {
      const datosTecnicos = visualizacion.arrayToDataTable([
        ["Técnico", { label: "Hardware", type: "number" }, { label: "Software", type: "number" }],
        ...tecnicosConPromedio.map(({ nombre, promedios }) => [
          nombre, ...promedios.map((valor) => valor === null ? null : valor / 3600000)
        ])
      ]);
      new visualizacion.ColumnChart(graficoTecnicos).draw(datosTecnicos, {
        ...opciones,
        vAxis: { title: "Horas promedio de atención", minValue: 0 }
      });
    }

    const datosServicios = visualizacion.arrayToDataTable([
      ["Tipo", "Incidencias"],
      ...tiposServicio.map((nombre, i) => [nombre, servicios[i]])
    ]);
    new visualizacion.PieChart(document.getElementById("graficoServicios"))
      .draw(datosServicios, { ...opciones, pieSliceText: "percentage", sliceVisibilityThreshold: 0 });
    errorGraficos.classList.add("d-none");
  } catch (error) {
    console.error("Error al dibujar los gráficos:", error);
    errorGraficos.classList.remove("d-none");
  }
}
