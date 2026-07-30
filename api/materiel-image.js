// =============================================
// Vercel Function — Image matériel (réutilisable)
// Recherche via Tavily, réhéberge sur Supabase Storage,
// associe le résultat à la fiche ecole_materiels.
// Chemin : api/materiel-image.js
//
// Usage :
//   POST { id: 'hawthorne', nom: 'Passoire Hawthorne', requete: '...' (optionnel) }
//   POST { ids: [{id:'hawthorne', nom:'Passoire Hawthorne'}, {...}] }  // traitement séquentiel
// =============================================

const SUPABASE_URL = 'https://wqsprjlocuhandhvpytx.supabase.co';
const BUCKET = 'photos-materiels';

async function chercherImage(requete) {
  const tavilyRes = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: process.env.TAVILY_API_KEY,
      query: requete,
      include_images: true,
      max_results: 3
    })
  });
  const data = await tavilyRes.json();
  const images = data?.images || [];
  if (!images.length) return null;
  // Tavily renvoie soit des strings, soit des objets {url, description}
  return typeof images[0] === 'string' ? images[0] : images[0].url;
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

async function traiterUnMateriel({ id, nom, requete }) {
  const q = requete || `${nom} bartending tool product photo white background`;
  const imageUrl = await chercherImage(q);
  if (!imageUrl) return { id, nom, statut: 'echec', raison: 'Aucune image trouvée' };

  const extension = (imageUrl.split('.').pop() || 'jpg').split('?')[0].slice(0, 4);
  const chemin = `${id}.${extension}`;

  const photoUrlFinale = await rehebergerImage(imageUrl, chemin);
  await associerEnBase(id, photoUrlFinale);

  return { id, nom, statut: 'ok', photo_url: photoUrlFinale, source: imageUrl };
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

    const items = Array.isArray(body.ids) ? body.ids : (body.id ? [body] : []);
    if (!items.length) {
      return res.status(400).json({ error: 'Corps de requête invalide. Attendu : {id, nom} ou {ids: [{id, nom}]}', body_recu: body });
    }

    const resultats = [];
    // Séquentiel volontairement — évite de saturer Tavily/Supabase et permet de couper à tout moment
    for (const item of items) {
      try {
        resultats.push(await traiterUnMateriel(item));
      } catch (e) {
        resultats.push({ id: item.id, nom: item.nom, statut: 'erreur', raison: e.message });
      }
    }

    return res.status(200).json({ resultats });
  } catch (e) {
    return res.status(500).json({ error: 'Erreur interne', detail: e.message });
  }
}
