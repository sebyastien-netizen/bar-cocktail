export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Méthode non autorisée' });
  }

  const { recette_id, url_choisie, user_id } = req.body;
  if (!recette_id || !url_choisie || !user_id) {
    return res.status(400).json({ error: 'recette_id, url_choisie et user_id requis' });
  }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

  try {
    // 1. Re-télécharger l'image choisie depuis son URL candidate
    const imageResponse = await fetch(url_choisie);
    if (!imageResponse.ok) {
      return res.status(502).json({ error: 'Échec du téléchargement de l\'image choisie' });
    }
    const imageBuffer = await imageResponse.arrayBuffer();
    const contentType = imageResponse.headers.get('content-type') || 'image/jpeg';
    const extension = contentType.includes('png') ? 'png' : 'jpg';
    const finalPath = `${recette_id}.${extension}`;

    // 2. Uploader vers le chemin final
    const uploadRes = await fetch(`${SUPABASE_URL}/storage/v1/object/photos-recettes/${finalPath}`, {
      method: 'POST',
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        'Content-Type': contentType,
        'x-upsert': 'true'
      },
      body: Buffer.from(imageBuffer)
    });

    if (!uploadRes.ok) {
      const errText = await uploadRes.text();
      return res.status(500).json({ error: 'Échec upload final: ' + errText });
    }

    // 3. Mettre à jour la recette avec l'URL finale
    const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/photos-recettes/${finalPath}`;

    await fetch(`${SUPABASE_URL}/rest/v1/recettes?id=eq.${recette_id}`, {
      method: 'PATCH',
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal'
      },
      body: JSON.stringify({ photo_url: publicUrl })
    });

    // 4. Nettoyer toutes les candidates
    const candidatesRes = await fetch(
      `${SUPABASE_URL}/rest/v1/recette_photos_candidates?recette_id=eq.${recette_id}&user_id=eq.${user_id}&select=storage_path`,
      { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } }
    );
    const candidates = await candidatesRes.json();

    if (Array.isArray(candidates) && candidates.length > 0) {
      await fetch(`${SUPABASE_URL}/storage/v1/object/photos-recettes`, {
        method: 'DELETE',
        headers: {
          apikey: SERVICE_KEY,
          Authorization: `Bearer ${SERVICE_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ prefixes: candidates.map(c => c.storage_path) })
      });
    }
    await fetch(
      `${SUPABASE_URL}/rest/v1/recette_photos_candidates?recette_id=eq.${recette_id}&user_id=eq.${user_id}`,
      { method: 'DELETE', headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } }
    );

    return res.status(200).json({ success: true, recette_id, photo_url: publicUrl });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
