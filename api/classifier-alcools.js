// =============================================
// Vercel Function — Classification par lot des bouteilles existantes
// Chemin : api/classifier-alcools.js
//
// Traite jusqu'à N bouteilles de Ma Cave n'ayant pas encore de sous_type_alcool,
// les classe via l'IA (même vocabulaire contrôlé que api/identifier.js),
// et écrit directement le résultat en base (clé service — pas de session requise).
//
// Usage : POST { limite: 30 } (optionnel, défaut 30)
// =============================================

const SUPABASE_URL = 'https://wqsprjlocuhandhvpytx.supabase.co';
const SEB_USER_ID = 'a2da3002-2fb8-4698-838d-35185f5fbe36';

const VOCAB_SOUS_TYPE = `gin -> london-dry, old-tom, plymouth, contemporain, aromatise, genievre ;
vodka -> neutre, aromatisee ;
rhum -> blanc, ambre, brun, agricole, epice, overproof, cachaca ;
whisky -> scotch-blended, scotch-single-malt, bourbon, rye, irlandais, japonais ;
mezcal-tequila -> blanco, reposado, anejo, mezcal ;
eaux-de-vie -> cognac, armagnac, brandy, calvados, pisco ;
vermouth -> sec, rouge, bianco, sherry, porto ;
triples-secs -> orange, bleu, marasquin ;
liqueurs -> herbes-amers, fruits-creme, cafe-creme ;
bitters -> null toujours ;
bulles -> champagne, prosecco ;
sirops -> null toujours`;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    if (!process.env.SUPABASE_SERVICE_KEY) {
      return res.status(500).json({ error: 'SUPABASE_SERVICE_KEY manquante côté serveur' });
    }
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: 'OPENAI_API_KEY manquante côté serveur' });
    }

    let body = req.body;
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
    body = body || {};
    const limite = Math.min(body.limite || 30, 40); // borne haute par sécurité (temps d'exécution Vercel)

    // ---- 1. Récupérer les items sans sous_type_alcool ----
    const itemsRes = await fetch(
      `${SUPABASE_URL}/rest/v1/items?user_id=eq.${SEB_USER_ID}&sous_type_alcool=is.null&category_id=not.in.(sirops,bitters,garde-manger,ingredients-frais,ponctuels,concoctions)&select=id,nom,category_id&limit=${limite}`,
      { headers: { 'apikey': process.env.SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}` } }
    );
    if (!itemsRes.ok) {
      const t = await itemsRes.text();
      return res.status(502).json({ error: 'Lecture items échouée', detail: t });
    }
    const items = await itemsRes.json();

    if (!items.length) {
      return res.status(200).json({ resultats: [], message: 'Aucune bouteille restante à classer.' });
    }

    // ---- 2. Classification en un seul appel IA (liste complète du lot) ----
    const listeTexte = items.map(i => `- id="${i.id}" | nom="${i.nom}" | categorie="${i.category_id}"`).join('\n');

    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + process.env.OPENAI_API_KEY
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        max_tokens: 3000,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: `Tu es expert en spiritueux. Pour chaque bouteille de la liste, propose un sous_type_alcool (vocabulaire controle STRICT selon sa categorie, mets null si aucun ne correspond clairement, jamais un mot invente) et un boolean tourbe (vrai uniquement si explicitement fume/tourbe, surtout whisky Islay). Vocabulaire par categorie :\n${VOCAB_SOUS_TYPE}\nReponds UNIQUEMENT en JSON valide, format : {"resultats":[{"id":"...","sous_type_alcool":"...","tourbe":false}]}`
          },
          {
            role: 'user',
            content: `Classe ces bouteilles :\n${listeTexte}`
          }
        ]
      })
    });

    if (!openaiRes.ok) {
      const t = await openaiRes.text();
      return res.status(502).json({ error: `OpenAI erreur (${openaiRes.status})`, detail: t });
    }

    const openaiData = await openaiRes.json();
    const texte = openaiData.choices?.[0]?.message?.content || '{"resultats":[]}';
    let parsed;
    try { parsed = JSON.parse(texte); }
    catch (e) { return res.status(502).json({ error: 'Réponse IA invalide', reponse_brute: texte.slice(0, 500) }); }

    const classifications = parsed.resultats || [];

    // ---- 3. Écriture directe en base, une par une (clé service) ----
    const resultatsFinaux = [];
    for (const c of classifications) {
      const item = items.find(i => i.id === c.id);
      if (!item) continue;

      const updateRes = await fetch(
        `${SUPABASE_URL}/rest/v1/items?id=eq.${encodeURIComponent(c.id)}`,
        {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
            'apikey': process.env.SUPABASE_SERVICE_KEY,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal'
          },
          body: JSON.stringify({
            sous_type_alcool: c.sous_type_alcool || null,
            tourbe: !!c.tourbe
          })
        }
      );

      resultatsFinaux.push({
        id: c.id,
        nom: item.nom,
        categorie: item.category_id,
        sous_type_alcool: c.sous_type_alcool || null,
        tourbe: !!c.tourbe,
        statut: updateRes.ok ? 'ok' : 'erreur'
      });
    }

    return res.status(200).json({
      resultats: resultatsFinaux,
      traites: resultatsFinaux.length,
      restants_estimes: items.length === limite ? 'possiblement plus — relance la fonction' : 0
    });

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
