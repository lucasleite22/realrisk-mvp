// Likes e comentarios compartilhados via Supabase
// Depende de: supabase-config.js (SUPABASE_URL, SUPABASE_ANON_KEY), supabase-js (CDN)

const STORAGE_KEY_SESSION = "realrisk_session_id_v1";

let supabaseClient = null;
if (typeof window !== "undefined" && window.supabase && SUPABASE_URL && SUPABASE_ANON_KEY) {
  supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

function isSocialEnabled() {
  return supabaseClient !== null;
}

function getSessionId() {
  let id = localStorage.getItem(STORAGE_KEY_SESSION);
  if (!id) {
    id = "sess_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem(STORAGE_KEY_SESSION, id);
  }
  return id;
}

async function getLikeStatus(propertyId) {
  if (!isSocialEnabled()) return { count: 0, likedByMe: false };
  const sessionId = getSessionId();
  const { data, error } = await supabaseClient
    .from("property_likes")
    .select("session_id")
    .eq("property_id", propertyId);
  if (error) {
    console.error("Erro ao carregar likes:", error.message);
    return { count: 0, likedByMe: false };
  }
  return {
    count: data.length,
    likedByMe: data.some(row => row.session_id === sessionId)
  };
}

async function toggleLike(propertyId) {
  if (!isSocialEnabled()) return;
  const sessionId = getSessionId();
  const status = await getLikeStatus(propertyId);
  if (status.likedByMe) {
    await supabaseClient
      .from("property_likes")
      .delete()
      .eq("property_id", propertyId)
      .eq("session_id", sessionId);
  } else {
    await supabaseClient
      .from("property_likes")
      .insert({ property_id: propertyId, session_id: sessionId });
  }
}

async function getLikeCounts(propertyIds) {
  if (!isSocialEnabled() || propertyIds.length === 0) return {};
  const { data, error } = await supabaseClient
    .from("property_likes")
    .select("property_id")
    .in("property_id", propertyIds);
  if (error) {
    console.error("Erro ao carregar contagem de likes:", error.message);
    return {};
  }
  const counts = {};
  data.forEach(row => { counts[row.property_id] = (counts[row.property_id] || 0) + 1; });
  return counts;
}

async function getComments(propertyId) {
  if (!isSocialEnabled()) return [];
  const { data, error } = await supabaseClient
    .from("property_comments")
    .select("*")
    .eq("property_id", propertyId)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("Erro ao carregar comentarios:", error.message);
    return [];
  }
  return data;
}

async function addComment(propertyId, authorName, commentText) {
  if (!isSocialEnabled()) return;
  await supabaseClient.from("property_comments").insert({
    property_id: propertyId,
    author_name: authorName.trim(),
    comment_text: commentText.trim()
  });
}

function formatRelativeDate(isoString) {
  const diffMs = Date.now() - new Date(isoString).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "agora";
  if (minutes < 60) return `${minutes}min atras`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h atras`;
  const days = Math.floor(hours / 24);
  return `${days}d atras`;
}
