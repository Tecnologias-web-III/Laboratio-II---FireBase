// public/js/config.js

// 1. CREDENCIALES DE FIREBASE
const firebaseConfig = {
  apiKey: "AIzaSyCszUq2DulNkDN8WuETBwJ4SKOdlwOE2nI",
  authDomain: "lab02-helpdesk.firebaseapp.com",
  projectId: "lab02-helpdesk",
  storageBucket: "lab02-helpdesk.firebasestorage.app",
  messagingSenderId: "214491759226",
  appId: "1:214491759226:web:217f37a83408769322b1c3"
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
const auth = firebase.auth();
const db = firebase.firestore();

// 2. CREDENCIALES DE SUPABASE
const SUPABASE_URL = "https://nrseylrppsnsvzohtmuu.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_-Fvhq6DIUfolt-WFStphtA_PeDF1mit";
const BUCKET_NAME = "archivos";

let supabaseClient = null;
if (SUPABASE_ANON_KEY && window.supabase) {
  supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

// 3. FUNCIÓN COMPARTIDA PARA SUBIR IMÁGENES A LA CARPETA incidencias/
async function subirImagenIncidencia(file) {
  if (!file) return "";

  if (!supabaseClient) {
    console.warn("Falta pegar SUPABASE_ANON_KEY en config.js. Usando URL temporal local.");
    return URL.createObjectURL(file);
  }

  try {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${fileExt}`;
    const filePath = `incidencias/${fileName}`;

    const { error } = await supabaseClient.storage
      .from(BUCKET_NAME)
      .upload(filePath, file);

    if (error) throw error;

    const { data: publicUrlData } = supabaseClient.storage
      .from(BUCKET_NAME)
      .getPublicUrl(filePath);

    return publicUrlData.publicUrl;
  } catch (error) {
    console.error("Error subiendo imagen a Supabase:", error);
    throw error;
  }
}