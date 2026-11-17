// public/js/config.js

// 1. CREDENCIALES DE FIREBASE
const firebaseConfig = {
  apiKey: "AIzaSyDGsb4iDlpskoNx7XJiiKqcnNOfgWqMNQQ",
  authDomain: "helpdesk-utn-lab02.firebaseapp.com",
  projectId: "helpdesk-utn-lab02",
  storageBucket: "helpdesk-utn-lab02.firebasestorage.app",
  messagingSenderId: "530155586420",
  appId: "1:530155586420:web:fa0f2344e5f9a4c2af2221"
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

const auth = firebase.auth();
const db = firebase.firestore();
db.settings({ experimentalForceLongPolling: true });

// 2. CREDENCIALES DE SUPABASE
const SUPABASE_URL = "https://nrseylrppsnsvzohtmuu.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_-Fvhq6DIUfolt-WFStphtA_PeDF1mit";
const BUCKET_NAME = "archivos_lab";

let supabaseClient = null;
if (window.supabase) {
  supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

// 3. FUNCIÓN COMPARTIDA PARA SUBIR IMÁGENES
async function subirImagenIncidencia(file) {
  if (!file) return "";

  if (!supabaseClient) {
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