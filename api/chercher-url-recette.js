export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Méthode non autorisée' });
  const { ingredients } = req.body;
  if (!ingredients || !Array.isArray(ingredients) || ingredients.length < 2) {
    return res.status(400).json({ error: 'Au moins 2 ingrédients requis' });
  }

  // Filtrer les ingrédients génériques non distinctifs
  const GENERIQUES = ['eau gazeuse', 'eau', 'glaçons', 'glace', 'sirop de sucre', 'sucre',
    'jus de citron', 'jus de citron vert', 'sel', 'poivre', 'tonic', 'soda'];
  const distinctifs = ingredients
    .filter(i => !GENERIQUES.some(g => i.toLowerCase().includes(g.toLowerCase())))
    .slice(0, 4); // Max 4 ingrédients pour la query

  // Si tout filtré, prendre les 3 premiers quand même
  const ingsQuery = distinctifs.length >= 2 ? distinctifs : ingredients.slice(0, 3);

  try {
    const query = `cocktail recipe ${ingsQuery.join(' ')}`;
    const tavilyRes = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: process.env.TAVILY_API_KEY,
        query,
        max_results: 5,
        include_domains: [
          'diffordsguide.com',
          'liquor.com',
          'thespruceeats.com',
          'bonappetit.com',
          'punchdrink.com',
          'seriouseats.com'
        ]
      })
    });
    const data = await tavilyRes.json();
    const resultats = (data.results || []).slice(0, 5).map(r => ({
      titre: r.title,
      url: r.url,
      extrait: (r.content || '').slice(0, 150)
    }));
    return res.status(200).json({ success: true, resultats });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
