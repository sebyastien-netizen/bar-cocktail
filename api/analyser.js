// =============================================
// Vercel Function — Analyse complète d'un alcool
// vs cave de Seb
// Chemin : api/analyser.js
// =============================================

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({});

  try {
    const { nom, cave } = req.body;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        max_tokens: 1000,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: 'Tu es un bartender expert et conseiller en spiritueux. Réponds uniquement en JSON valide.'
          },
          {
            role: 'user',
            content: `Analyse cet alcool : "${nom}".
Cave actuelle du bartender : ${cave}.

Retourne ce JSON exactement :
{
  "identifie": true,
  "nom_complet": "nom commercial exact",
  "categorie": "catégorie (ex: Gin, Rhum, Whisky...)",
  "degre": 40,
  "profil_gustatif": "description courte du profil (ex: floral, épicé, agrumes)",
  "doublon_cave": "nom de l'alcool similaire déjà en cave, ou null si aucun",
  "doublon_note": "explication si doublon, ou null",
  "meilleure_version": "nom d'une meilleure expression/millésime si applicable, ou null",
  "meilleure_version_prix": "prix estimé en €, ou null",
  "variante_moins_chere": "nom d'un équivalent moins cher donnant le même résultat en cocktail, ou null",
  "variante_moins_chere_prix": "prix estimé en €, ou null",
  "complementarite": "en 1-2 phrases : ce que cet alcool apporte gustativement à la cave existante",
  "verdict": "ACHETER | PASSER | DOUBLON | MIEUX_AILLEURS",
  "verdict_raison": "explication courte du verdict en 1 phrase"
}
Si alcool non identifié : {"identifie": false}`
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
