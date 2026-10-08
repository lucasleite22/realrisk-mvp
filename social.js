// Likes e comentarios compartilhados — guardados no banco do 4Rivers via
// /api/realrisk/social (sessao do admin; autor = usuario logado).
// Fora do 4Rivers (abrindo o index.html local) o recurso fica desligado.

const SOCIAL_API = location.pathname.startsWith("/realrisk/") ? "/api/realrisk/social" : null;

function isSocialEnabled() {
  return SOCIAL_API !== null;
}

async function socialFetch(query, body) {
  const res = await fetch(SOCIAL_API + (query || ""), body
    ? { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
    : { credentials: "same-origin" });
  if (res.status === 401 || res.status === 403) {
    window.top.location.href = "/auth/login";
    throw new Error("Sessao expirada");
  }
  if (!res.ok) throw new Error("Erro " + res.status);
  return res.json();
}

// Likes + comentarios de um imovel em uma chamada.
async function getSocial(propertyId) {
  if (!isSocialEnabled()) return { count: 0, likedByMe: false, comments: [] };
  try {
    return await socialFetch("?id=" + encodeURIComponent(propertyId));
  } catch (e) {
    console.error("Erro ao carregar curtidas/comentarios:", e.message);
    return { count: 0, likedByMe: false, comments: [] };
  }
}

async function toggleLike(propertyId) {
  if (!isSocialEnabled()) return;
  await socialFetch("", { propertyId: String(propertyId), action: "like" });
}

async function getLikeCounts(propertyIds) {
  if (!isSocialEnabled() || propertyIds.length === 0) return {};
  try {
    const data = await socialFetch("?ids=" + propertyIds.join(","));
    return data.counts;
  } catch (e) {
    console.error("Erro ao carregar contagem de likes:", e.message);
    return {};
  }
}

async function addComment(propertyId, commentText) {
  if (!isSocialEnabled()) return;
  await socialFetch("", { propertyId: String(propertyId), action: "comment", text: commentText.trim() });
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
