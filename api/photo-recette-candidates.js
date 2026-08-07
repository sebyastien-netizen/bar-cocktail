export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Méthode non autorisée' });
  }

  const { recette_id, nom, user_id } = req.body;
  if (!recette_id || !nom || !user_id) {
    return res.status(400).json({ error: 'recette_id, nom et user_id requis' });
  }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

  try {
    // 1. Chercher 3 images libres de droit via Tavily
const tavilyResponse = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: process.env.TAVILY_API_KEY,
        query: `"${nom} cocktail" recipe drink glass garnish bar`,
        include_domains: ['pexels.com', 'pixabay.com', 'foodiesfeed.com', 'unsplash.com'],
        include_images: true,
        max_results: 5
      })
    });
    const tavilyData = await tavilyResponse.json();
    const imageUrls = (tavilyData.images || []).slice(0, 3);

    if (imageUrls.length === 0) {
      return res.status(404).json({ error: 'Aucune image trouvée pour ' + nom, candidates: [] });
    }

    // 2. Nettoyer d'éventuelles anciennes candidates pour cette recette
    const oldCandidatesRes = await fetch(
      `${SUPABASE_URL}/rest/v1/recette_photos_candidates?recette_id=eq.${recette_id}&user_id=eq.${user_id}&select=storage_path`,
      { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } }
    );
    const oldCandidates = await oldCandidatesRes.json();

    if (Array.isArray(oldCandidates) && oldCandidates.length > 0) {
      await fetch(`${SUPABASE_URL}/storage/v1/object/photos-recettes`, {
        method: 'DELETE',
        headers: {
          apikey: SERVICE_KEY,
          Authorization: `Bearer ${SERVICE_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ prefixes: oldCandidates.map(c => c.storage_path) })
      });
      await fetch(
        `${SUPABASE_URL}/rest/v1/recette_photos_candidates?recette_id=eq.${recette_id}&user_id=eq.${user_id}`,
        { method: 'DELETE', headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } }
      );
    }

    // 3. Télécharger et uploader chaque candidate
    const candidatesCreees = [];
    for (let i = 0; i < imageUrls.length; i++) {
      const imageResponse = await fetch(imageUrls[i]);
      if (!imageResponse.ok) continue;

const imageBuffer = await imageResponse.arrayBuffer();
      const contentTypeSource = imageResponse.headers.get('content-type') || '';
      const estPng = contentTypeSource.includes('png') || imageUrls[i].toLowerCase().includes('.png');
      const extension = estPng ? 'png' : 'jpg';
      const contentTypeForce = estPng ? 'image/png' : 'image/jpeg';
      const storagePath = `candidates/${recette_id}-${i + 1}.${extension}`;

      const uploadRes = await fetch(`${SUPABASE_URL}/storage/v1/object/photos-recettes/${storagePath}`, {
        method: 'POST',
        headers: {
          apikey: SERVICE_KEY,
          Authorization: `Bearer ${SERVICE_KEY}`,
          'Content-Type': contentTypeForce,
          'x-upsert': 'true'
        },
        body: Buffer.from(imageBuffer)
      });

      if (!uploadRes.ok) continue;

      const candidateId = `cand-${recette_id}-${i + 1}-${Date.now()}`;
      await fetch(`${SUPABASE_URL}/rest/v1/recette_photos_candidates`, {
        method: 'POST',
        headers: {
          apikey: SERVICE_KEY,
          Authorization: `Bearer ${SERVICE_KEY}`,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal'
        },
        body: JSON.stringify({ id: candidateId, user_id, recette_id, storage_path: storagePath, ordre: i + 1 })
      });

      const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/photos-recettes/${storagePath}`;
      candidatesCreees.push({ id: candidateId, storage_path: storagePath, url: publicUrl, ordre: i + 1 });
    }

    return res.status(200).json({ success: true, recette_id, candidates: candidatesCreees });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
