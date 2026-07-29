export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'URL manquante' });

  try {
    // Étape 1 — Scraping via Tavily
    const tavilyRes = await fetch('https://api.tavily.com/extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: process.env.TAVILY_API_KEY,
        urls: [url]
      })
    });

    const tavilyData = await tavilyRes.json();
    const contenu = tavilyData?.results?.[0]?.raw_content || '';

    if (!contenu) return res.status(400).json({ error: 'Impossible de lire la page. Essaie une autre URL.' });

    // Étape 2 — Structuration via OpenAI
    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        max_tokens: 2000,
        messages: [{
          role: 'system',
          : ``Tu es un extracteur de recettes de cocktails. Ton seul rôle est de recopier EXACTEMENT ce qui est écrit dans le texte.
RÈGLES ABSOLUES :
- Ne jamais inventer, ajouter ou compléter un ingrédient qui n'est pas explicitement mentionné dans le texte
- Ne jamais modifier les quantités — si elles ne sont pas précisées, mettre quantite: null
- Ne jamais reformuler les noms d'ingrédients — recopier mot pour mot
- Si une recette est incomplète dans le texte, la retourner incomplète plutôt qu'inventée
- Ignorer tout contenu non-recette (marketing, navigation, footer, publicité)
Réponds UNIQUEMENT en JSON valide, sans markdown, sans backticks.
Format : { "recettes": [ { "nom": "...", "ingredients": [{"nom": "...", "quantite": null ou nombre, "unite": "cl"}], "methode": "...", "verre": "...", "garniture": "..." } ] }
Si aucune recette trouvée : { "recettes": [] }`
Convertis toutes les quantités en cl. Ignore le contenu non-recette (marketing, navigation, footer).`
        }, {
          role: 'user',
          : contenu.substring(0, 8000)
        }]
      })
    });

    const openaiData = await openaiRes.json();
    const texte = openaiData.choices?.[0]?.message?. || '{"recettes":[]}';

    let result;
    try { result = JSON.parse(texte); }
    catch(e) { result = { recettes: [] }; }

    return res.status(200).json(result);

  } catch(e) {
    return res.status(500).json({ error: e.message });
  }
}
