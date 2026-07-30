// =============================================
// Vercel Function — Image matériel (réutilisable, avec validation manuelle)
// Chemin : api/materiel-image.js
//
// Deux actions, distinctes exprès pour permettre une validation humaine
// avant tout téléchargement/stockage définitif :
//
// 1) Chercher des candidats (rien n'est sauvegardé) :
//    POST { action: 'chercher', items: [{id, nom, requete}, ...] }
//    → { resultats: [{id, nom, images: ['url1','url2',...]}, ...] }
//
// 2) Valider un choix précis (téléchargement + stockage + BDD) :
//    POST { action: 'valider', id, nom, image_url }
//    → { id, nom, statut: 'ok', photo_url }
// =============================================

const SUPABASE_URL = 'https://wqsprjlocuhandhvpytx.supabase.co';
const BUCKET = 'photos-materiels';

async function chercherImages(requete, n = 5) {
  const tavilyRes = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: process.env.TAVILY_API_KEY,
      query: requete,
      include_images: true,
      max_results: n
    })
  });
  const data = await tavilyRes.json();
  const images = data?.images || [];
  // Tavily renvoie soit des strings, soit des objets {url, description}
  return images
    .map(img => (typeof img === 'string' ? img : img?.url))
    .filter(Boolean)
    .slice(0, n);
}

async function rehebergerImage(imageUrl, chemin) {
  const imgRes = await fetch(imageUrl);
  if (!imgRes.ok) throw new Error(`Téléchargement image échoué (${imgRes.status})`);
  const contentType = imgRes.headers.get('content-type') || 'image/jpeg';
  const buffer = await imgRes.arrayBuffer();

  const uploadRes = await fetch(
    `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${chemin}`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
        'apikey': process.env.SUPABASE_SERVICE_KEY,
        'Content-Type': contentType,
        'x-upsert': 'true'
      },
      body: buffer
    }
  );
  if (!uploadRes.ok) {
    const errTxt = await uploadRes.text();
    throw new Error(`Upload Supabase échoué : ${errTxt}`);
  }
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${chemin}`;
}

async function associerEnBase(id, photoUrl) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/ecole_materiels?id=eq.${encodeURIComponent(id)}`,
    {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
        'apikey': process.env.SUPABASE_SERVICE_KEY,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({ photo_url: photoUrl })
    }
  );
  if (!res.ok) {
    const errTxt = await res.text();
    throw new Error(`Mise à jour ecole_materiels échouée : ${errTxt}`);
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    if (!process.env.TAVILY_API_KEY) {
      return res.status(500).json({ error: 'TAVILY_API_KEY manquante côté serveur' });
    }
    if (!process.env.SUPABASE_SERVICE_KEY) {
      return res.status(500).json({ error: 'SUPABASE_SERVICE_KEY manquante côté serveur' });
    }

    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch { body = {}; }
    }
    body = body || {};

    // ---- Action 1 : CHERCHER (candidats multiples, rien n'est sauvegardé) ----
    if (body.action === 'chercher') {
      const items = Array.isArray(body.items) ? body.items : [];
      if (!items.length) {
        return res.status(400).json({ error: 'items requis : [{id, nom, requete}]' });
      }

      const resultats = [];
      for (const item of items) {
        try {
          const q = item.requete || `${item.nom} bartending tool in use dark background`;
          const images = await chercherImages(q, 5);
          resultats.push({ id: item.id, nom: item.nom, images });
        } catch (e) {
          resultats.push({ id: item.id, nom: item.nom, images: [], erreur: e.message });
        }
      }
      return res.status(200).json({ resultats });
    }

    // ---- Action 2 : VALIDER (téléchargement + stockage + BDD, un seul item) ----
    if (body.action === 'valider') {
      const { id, nom, image_url } = body;
      if (!id || !image_url) {
        return res.status(400).json({ error: 'id et image_url requis pour valider' });
      }
      const extension = (image_url.split('.').pop() || 'jpg').split('?')[0].slice(0, 4);
      const chemin = `${id}.${extension}`;

      const photoUrlFinale = await rehebergerImage(image_url, chemin);
      await associerEnBase(id, photoUrlFinale);

      return res.status(200).json({ id, nom, statut: 'ok', photo_url: photoUrlFinale });
    }

    return res.status(400).json({ error: "action requise : 'chercher' ou 'valider'" });

  } catch (e) {
    return res.status(500).json({ error: 'Erreur interne', detail: e.message });
  }
}
