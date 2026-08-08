// =============================================
// Vercel Function — Analyse complète d'un alcool
// vs cave de Seb (texte ou photo)
// Chemin : api/analyser.js
// =============================================

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({});

  try {
    const { nom, cave, image_base64 } = req.body;

    const consigne = `${nom ? `Analyse cet alcool : "${nom}".` : `Identifie précisément cet alcool à partir de la photo de l'étiquette ci-jointe.`}

Cave actuelle du bartender (ce qu'il possède déjà) : ${cave}.

Ta mission :
1. Identifier précisément l'alcool${image_base64 ? ' visible sur la photo (marque, expression, millésime si lisible)' : ''}
2. Détecter si un alcool similaire est déjà en cave (même famille ET profil proche)
3. Lister 6 à 8 cocktails classiques ou modernes réalisables avec cet alcool, en variant les techniques et familles (sour, spritz, fizz, spirit-forward, long drink, digestif...) — pas plusieurs variantes très proches du même type. Pour chaque cocktail, donne la composition COMPLÈTE (tous les ingrédients avec quantité approximative en cl/ml/traits) ET les étapes de préparation numérotées, précises et exécutables.
4. Évaluer si une meilleure version existe (millésime supérieur, expression premium) avec prix réel français
5. Identifier une alternative moins chère donnant le même résultat en cocktail avec prix réel français
6. Donner un avis bartender technique et personnel sur la complémentarité avec cette cave précise
7. Ajouter une courte anecdote ou note pédagogique sur cet alcool (origine, méthode de production, histoire) — une ou deux phrases, format culture générale bar
8. Rendre un verdict tranché et justifié

Retourne ce JSON exactement, sans champ supplémentaire :
{
  "identifie": true,
  "nom_complet": "nom commercial exact et complet",
  "categorie": "catégorie précise (ex: London Dry Gin, Rhum Agricole, Single Malt Islay...)",
  "degre": 40,
  "profil_gustatif": "3-5 notes aromatiques précises séparées par des virgules",
  "doublon_cave": "nom exact de l'alcool similaire déjà en cave, ou null",
  "doublon_note": "en 1 phrase : en quoi ils se ressemblent ET en quoi ils diffèrent, ou null",
  "cocktails_possibles": [
    {
      "nom": "Negroni",
      "difficulte": "facile",
      "ingredients": [
        {"nom": "Gin", "quantite": "3", "unite": "cl"},
        {"nom": "Campari", "quantite": "3", "unite": "cl"},
        {"nom": "Vermouth rouge", "quantite": "3", "unite": "cl"}
      ],
      "etapes": [
        "Verser tous les ingrédients dans un verre à mélange avec glace.",
        "Mélanger 30 secondes.",
        "Filtrer dans un verre old fashioned sur glaçons.",
        "Garnir d'un zeste d'orange."
      ]
    }
  ],
  "meilleure_version": "nom exact d'une expression supérieure si applicable, ou null",
  "meilleure_version_prix": 45,
  "variante_moins_chere": "nom exact d'un équivalent moins cher en cocktail, ou null",
  "variante_moins_chere_prix": 18,
  "complementarite": "en 2-3 phrases techniques : ce que cet alcool apporte CONCRÈTEMENT à cette cave précise, quels profils gustatifs il ouvre ou complète",
  "anecdote_pedagogique": "1-2 phrases : origine, méthode de production ou histoire de cet alcool",
  "verdict": "ACHETER | PASSER | DOUBLON | MIEUX_AILLEURS",
  "verdict_raison": "1 phrase directe et argumentée expliquant le verdict"
}
Si alcool non identifié${image_base64 ? ' sur la photo (étiquette illisible, floue, ou hors-cadre)' : ''} : {"identifie": false}`;

    const userContent = image_base64
      ? [
          { type: 'text', text: consigne },
          { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${image_base64}` } }
        ]
      : consigne;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        max_tokens: 2500,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: `Tu es un bartender professionnel expert en spiritueux et en cocktails classiques et modernes. 
Tu donnes des avis précis, directs et techniques. Tu connais les prix du marché français. 
Réponds uniquement en JSON valide, sans texte générique ni formules creuses.`
          },
          {
            role: 'user',
            content: userContent
          }
        ]
      })
    });

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || '{"identifie":false}';
    const result = JSON.parse(text);
    return res.status(200).json(result);

  } catch (e) {
    console.error('ERREUR analyser:', e.message);
    return res.status(200).json({ identifie: false, error: e.message });
  }
}
