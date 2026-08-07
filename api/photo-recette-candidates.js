// Cherche 3 photos libres de droit pour une recette, les télécharge et les stocke comme candidates en attente de validation
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Méthode non autorisée' });
  }

  const { recette_id, nom, user_id } = req.body;
  if (!recette_id || !nom || !user_id) {
    return res.status(400).json({ error: 'recette_id, nom et user_id requis' });
  }

  try {
    // 1. Chercher 3 images libres de droit via Tavily
    const tavilyResponse = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: process.env.TAVILY_API_KEY,
        query: `${nom} cocktail photo`,
        include_domains: ['pexels.com', 'pixabay.com', 'foodiesfeed.com', 'unsplash.com'],
        include_images: true,
        max_results: 3
      })
    });
    const tavilyData = await tavilyResponse.json();
    const imageUrls = (tavilyData.images || []).slice(0, 3);

    if (imageUrls.length === 0) {
      return res.status(404).json({ error: 'Aucune image trouvée pour ' + nom, candidates: [] });
    }

    // 2. Nettoyer d'éventuelles anciennes candidates pour cette recette
    const { data: oldCandidates } = await supabase
      .from('recette_photos_candidates')
      .select('storage_path')
      .eq('recette_id', recette_id)
      .eq('user_id', user_id);

    if (oldCandidates?.length > 0) {
      await supabase.storage.from('photos-recettes').remove(oldCandidates.map(c => c.storage_path));
      await supabase.from('recette_photos_candidates').delete().eq('recette_id', recette_id).eq('user_id', user_id);
    }

    // 3. Télécharger et uploader chaque candidate
    const candidatesCreees = [];
    for (let i = 0; i < imageUrls.length; i++) {
      const imageResponse = await fetch(imageUrls[i]);
      if (!imageResponse.ok) continue;

      const imageBuffer = await imageResponse.arrayBuffer();
      const contentType = imageResponse.headers.get('content-type') || 'image/jpeg';
      const extension = contentType.includes('png') ? 'png' : 'jpg';
      const storagePath = `candidates/${recette_id}-${i + 1}.${extension}`;

      const { error: uploadError } = await supabase.storage
        .from('photos-recettes')
        .upload(storagePath, imageBuffer, { contentType, upsert: true });

      if (uploadError) continue;

      const candidateId = `cand-${recette_id}-${i + 1}-${Date.now()}`;
      await supabase.from('recette_photos_candidates').insert({
        id: candidateId,
        user_id,
        recette_id,
        storage_path: storagePath,
        ordre: i + 1
      });

      const { data: publicUrlData } = supabase.storage.from('photos-recettes').getPublicUrl(storagePath);
      candidatesCreees.push({ id: candidateId, storage_path: storagePath, url: publicUrlData.publicUrl, ordre: i + 1 });
    }

    return res.status(200).json({ success: true, recette_id, candidates: candidatesCreees });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
