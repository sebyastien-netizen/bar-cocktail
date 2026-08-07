// Confirme la photo choisie par Seb comme photo principale de la recette, nettoie les autres candidates
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Méthode non autorisée' });
  }

  const { recette_id, storage_path_choisi, user_id } = req.body;
  if (!recette_id || !storage_path_choisi || !user_id) {
    return res.status(400).json({ error: 'recette_id, storage_path_choisi et user_id requis' });
  }

  try {
    // 1. Copier la candidate choisie vers son chemin final
    const extension = storage_path_choisi.split('.').pop();
    const finalPath = `${recette_id}.${extension}`;

    const { error: copyError } = await supabase.storage
      .from('photos-recettes')
      .copy(storage_path_choisi, finalPath);

    if (copyError) {
      return res.status(500).json({ error: 'Échec copie finale: ' + copyError.message });
    }

    // 2. Mettre à jour la recette avec l'URL finale
    const { data: publicUrlData } = supabase.storage.from('photos-recettes').getPublicUrl(finalPath);
    await supabase.from('recettes').update({ photo_url: publicUrlData.publicUrl }).eq('id', recette_id);

    // 3. Nettoyer toutes les candidates (y compris celle choisie, devenue inutile en double)
    const { data: candidates } = await supabase
      .from('recette_photos_candidates')
      .select('storage_path')
      .eq('recette_id', recette_id)
      .eq('user_id', user_id);

    if (candidates?.length > 0) {
      await supabase.storage.from('photos-recettes').remove(candidates.map(c => c.storage_path));
    }
    await supabase.from('recette_photos_candidates').delete().eq('recette_id', recette_id).eq('user_id', user_id);

    return res.status(200).json({ success: true, recette_id, photo_url: publicUrlData.publicUrl });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
