export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Méthode non autorisée' });
  const { ingredients } = req.body;
  if (!ingredients || !Array.isArray(ingredients) || ingredients.length < 2) {
    return res.status(400).json({ error: 'Au moins 2 ingrédients requis' });
  }

  try {
    const query = `"${ingredients.join('" "')}" cocktail recipe`;
    const tavilyRes = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: process.env.TAVILY_API_KEY,
        query,
        max_results: 5
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
