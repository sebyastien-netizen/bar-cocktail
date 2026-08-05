// =============================================
// Vercel Function — Générateur de recettes depuis la cave
// Chemin : api/generer-recette.js
// =============================================

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({});

  try {
    const { ingredients, style, nb_propositions } = req.body;

    if (!ingredients || !Array.isArray(ingredients) || ingredients.length === 0) {
      return res.status(400).json({ error: 'Liste d\'ingrédients requise.' });
    }

    const nb = nb_propositions || 3;

    const listeIngredients = ingredients.map(i =>
      `${i.nom}${i.cl_restants ? ` (${i.cl_restants}cl restants)` : ''}`
    ).join(', ');

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        max_tokens: 2000,
        temperature: 0.8,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: `Tu es Alexis, bartender professionnel formé Ferrandi Paris. Tu proposes des recettes de cocktails équilibrées et réalistes uniquement à partir des ingrédients disponibles.

RÈGLES IMPÉRATIVES :
- N'utilise QUE les ingrédients listés — jamais d'ingrédient absent de la liste
- Respecte les ratios classiques par famille (Sour 2:¾:¾, Daisy 2:1:¾, Spirit forward 2:1, Fizz 2:¾:¾+eau gazeuse)
- Dosages en cl uniquement (sauf traits de bitter)
- Profil gustatif cohérent avec les ingrédients (0-5)
- Badge "classique" si c'est une recette connue, "improvisation" si c'est une création
- Sois honnête sur la confiance dans l'équilibre (score 0-100)
- Réponds uniquement en JSON valide`
          },
          {
            role: 'user',
            content: `Ingrédients disponibles : ${listeIngredients}
${style ? `Style souhaité : ${style}` : ''}

Propose exactement ${nb} recettes de cocktails réalisables avec ces ingrédients.

Retourne ce JSON exactement :
{
  "propositions": [
    {
      "nom": "nom du cocktail",
      "badge": "classique ou improvisation",
      "famille": "Sour / Fizz / Daisy / Spirit forward / Spritz / etc.",
      "technique": "Shake / Stir / Build / Throw",
      "verre": "type de verre",
      "difficulte": "facile ou moyen ou avance",
      "confiance": 85,
      "dosages": [
        {"nom": "nom exact de l'ingrédient", "quantite": 5, "unite": "cl"}
      ],
      "profil": {
        "gout_sucre": 2,
        "gout_amer": 1,
        "gout_acide": 3,
        "gout_fruite": 4,
        "gout_fume": 0,
        "gout_floral": 1,
        "gout_epice": 0,
        "gout_cremeux": 0
      },
      "note_bartender": "conseil court sur l'équilibre ou la substitution utilisée"
    }
  ]
}`
          }
        ]
      })
    });

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || '{}';
    const result = JSON.parse(text);

    return res.status(200).json(result);
  } catch(e) {
    console.error('ERREUR generer-recette:', e.message);
    return res.status(500).json({ error: e.message });
  }
}
