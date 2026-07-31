<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Classification alcools existants</title>
<style>
  body { font-family: -apple-system, sans-serif; max-width: 650px; margin: 20px auto; padding: 0 16px; background: #111; color: #eee; }
  h1 { font-size: 1.2rem; }
  button { background: #d4a95e; color: #000; border: none; border-radius: 8px; padding: 14px 20px; font-size: 1rem; font-weight: 600; cursor: pointer; width: 100%; margin: 8px 0; }
  button:disabled { opacity: 0.5; }
  .item { padding: 8px 10px; border-bottom: 1px solid #333; font-size: 0.85rem; display: flex; justify-content: space-between; gap: 8px; }
  .ok { color: #6bcf7f; }
  .erreur { color: #ff6b6b; }
  .compteur { font-size: 0.9rem; color: #aaa; margin: 12px 0; }
</style>
</head>
<body>

<h1>🥃 Classification des bouteilles existantes</h1>
<p>Traite jusqu'à 30 bouteilles sans sous-type par clic. Relance plusieurs fois jusqu'à "Aucune bouteille restante".</p>

<button id="btn" onclick="lancerLot()">▶️ Classer un lot (30 max)</button>

<div class="compteur" id="compteur"></div>
<div id="resultat"></div>

<script>
let totalTraite = 0;

async function lancerLot() {
  const btn = document.getElementById('btn');
  const zone = document.getElementById('resultat');
  btn.disabled = true;
  btn.textContent = '⏳ Classification en cours...';

  try {
    const res = await fetch('https://bar-cocktail-smoky.vercel.app/api/classifier-alcools', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ limite: 30 })
    });
    const data = await res.json();
    btn.disabled = false;
    btn.textContent = '▶️ Classer le lot suivant';

    if (!res.ok) {
      zone.innerHTML = `<div class="erreur">❌ ${JSON.stringify(data)}</div>` + zone.innerHTML;
      return;
    }

    if (data.message) {
      document.getElementById('compteur').innerHTML = `✅ Terminé — ${totalTraite} bouteilles traitées au total.`;
      btn.disabled = true;
      btn.textContent = '✅ Tout est classé';
      return;
    }

    totalTraite += data.traites;
    document.getElementById('compteur').textContent = `${totalTraite} bouteilles traitées jusqu'ici...`;

    const bloc = data.resultats.map(r => `
      <div class="item">
        <span>${r.nom} <span style="color:#888">(${r.categorie})</span></span>
        <span class="${r.statut === 'ok' ? 'ok' : 'erreur'}">${r.sous_type_alcool || '—'}${r.tourbe ? ' 🔥' : ''}</span>
      </div>
    `).join('');
    zone.innerHTML = bloc + zone.innerHTML;

  } catch (e) {
    btn.disabled = false;
    btn.textContent = '▶️ Réessayer';
    zone.innerHTML = `<div class="erreur">❌ Erreur réseau : ${e.message}</div>` + zone.innerHTML;
  }
}
</script>

</body>
</html>
