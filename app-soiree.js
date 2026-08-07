let soireeMenuActive = null;
let soireeMenuRecettesActives = [];

async function ouvrirTableauBordSoiree(soireeMenuId) {
  const { data: menu } = await db.from('soiree_menu').select('*').eq('id', soireeMenuId).single();
  const { data: menuRecettes } = await db.from('soiree_menu_recettes').select('*').eq('soiree_menu_id', soireeMenuId).order('ordre');

  soireeMenuActive = menu;
  soireeMenuRecettesActives = menuRecettes || [];

  let modal = document.getElementById('modal-tableau-bord-soiree');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'modal-tableau-bord-soiree';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.9);z-index:9000;overflow-y:auto;padding:20px';
    document.body.appendChild(modal);
  }

  // Vérifier contenances manquantes
  const ingsSansContenance = [];
  soireeMenuRecettesActives.forEach(mr => {
    const recette = recettes.find(r => r.id === mr.recette_id);
    (recette?.ingredients || []).forEach(ing => {
      if (!ing.item_cave_id || ing.optionnel) return;
      if (ing.unite !== 'cl' && ing.unite !== 'ml') return;
      if (CATEGORIES_NON_TRACKEES.includes(categorieDeItemGlobal(ing.item_cave_id))) return;
      const item = voyageActif
        ? voyageBouteillesActives.find(b => b.item_cave_id === ing.item_cave_id)
        : cave?.categories?.flatMap(c => c.items).find(i => i.id === ing.item_cave_id);
      const clRestants = voyageActif ? item?.cl_restants_voyage : item?.cl_restants;
      if (item && (clRestants === null || clRestants === undefined) && !ingsSansContenance.some(i => i.itemId === ing.item_cave_id)) {
        ingsSansContenance.push({ itemId: ing.item_cave_id, nom: item?.nom || ing.nom });
      }
    });
  });

  if (ingsSansContenance.length > 0) {
    modal.innerHTML = `
      <div style="max-width:500px;margin:40px auto;background:var(--bg-card);border-radius:16px;padding:20px">
        <div style="font-size:1rem;font-weight:700;margin-bottom:4px">⚠️ Contenances manquantes</div>
        <div style="font-size:0.82rem;color:var(--text-secondary);margin-bottom:16px">
          Renseigne les quantités disponibles pour un suivi précis.
        </div>
        ${ingsSansContenance.map(i => `
          <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--border)">
            <span style="font-size:0.88rem;font-weight:600">${i.nom}</span>
            <div style="display:flex;align-items:center;gap:6px">
              <input type="number" id="cl-${i.itemId}" placeholder="cl" min="0" step="0.5"
                style="width:70px;padding:6px 8px;border-radius:6px;border:1px solid var(--border);background:var(--bg);color:var(--text-primary);font-size:0.9rem;text-align:right">
              <span style="font-size:0.82rem;color:var(--text-muted)">cl</span>
            </div>
          </div>
        `).join('')}
        <div style="display:flex;gap:8px;margin-top:16px">
          <button class="btn-outline" style="flex:1" onclick="renderTableauBordSoiree()">Passer</button>
          <button class="btn-primary" style="flex:1" onclick="validerContenancesManquantes(${JSON.stringify(ingsSansContenance.map(i => i.itemId))})">
            ✅ Valider et continuer
          </button>
        </div>
      </div>
    `;
    return;
  }

  await renderTableauBordSoiree();
}

async function validerContenancesManquantes(itemIds) {
  for (const itemId of itemIds) {
    const input = document.getElementById('cl-' + itemId);
    if (!input || !input.value) continue;
    const cl = parseFloat(input.value);
    if (isNaN(cl)) continue;

    if (voyageActif) {
      await db.from('mode_voyage_bouteilles')
        .update({ cl_restants_voyage: cl })
        .eq('item_cave_id', itemId)
        .eq('mode_voyage_id', voyageActif.id);
      const b = voyageBouteillesActives.find(b => b.item_cave_id === itemId);
      if (b) b.cl_restants_voyage = cl;
    } else {
      await db.from('items')
        .update({ cl_restants: cl })
        .eq('id', itemId)
        .eq('user_id', currentUser.id);
      const item = cave?.categories?.flatMap(c => c.items).find(i => i.id === itemId);
      if (item) item.cl_restants = cl;
    }
  }
  renderTableauBordSoiree();
}
function calculerConsommationAgregee() {
  // Pour chaque item_cave_id apparaissant dans au moins une recette du menu,
  // additionne la consommation projetée sur toutes les recettes qui l'utilisent.
  const conso = {};

  soireeMenuRecettesActives.forEach(mr => {
    const recette = recettes.find(r => r.id === mr.recette_id);
    if (!recette) return;
(recette.ingredients || []).forEach(ing => {
      if (!ing.item_cave_id || !ing.quantite || ing.optionnel) return;
      if (ing.unite !== 'cl' && ing.unite !== 'ml') return;
      if (/glace|glaçon/i.test(ing.nom || '')) return;
      if (CATEGORIES_NON_TRACKEES.includes(categorieDeItemGlobal(ing.item_cave_id))) return;
      const qteCl = ing.unite === 'ml' ? ing.quantite / 10 : ing.quantite;
      if (!conso[ing.item_cave_id]) conso[ing.item_cave_id] = { nom: ing.nom, totalCl: 0 };
      conso[ing.item_cave_id].totalCl += qteCl * mr.portions_prevues;
    });
  });

  return Object.entries(conso).map(([itemId, c]) => {
const item = voyageActif
  ? voyageBouteillesActives.find(b => b.item_cave_id === itemId)
  : cave?.categories?.flatMap(cat => cat.items).find(i => i.id === itemId);
const disponibleReel = voyageActif
  ? (item ? Math.max(0, parseFloat(item.cl_restants_voyage ?? 0)) : null)
  : (item ? Math.max(0, item.cl_restants - clReserveePour(itemId)) : null);
return {
      itemId,
      nomItem: item?.nom || c.nom,
      besoinCl: Math.round(c.totalCl * 10) / 10,
      disponibleReel,
      inconnu: voyageActif ? (!item || item.cl_restants_voyage === null) : (!item || item.cl_restants === null),
      suffisant: disponibleReel !== null ? disponibleReel >= c.totalCl : null
    };
  });
}

async function renderTableauBordSoiree() {
  const modal = document.getElementById('modal-tableau-bord-soiree');
  if (!modal) return;

  const estEnVoyage = voyageActif && soireeMenuActive?.voyage_id === voyageActif.id;

  // Charger les services déjà effectués
  const { data: services } = await db.from('soiree_services')
    .select('*')
    .eq('soiree_menu_id', soireeMenuActive.id);
 

  // Charger les invités
  const { data: invites } = await db.from('sessions_invites')
    .select('*')
    .eq('soiree_menu_id', soireeMenuActive.id)
    .eq('is_master', false)
    .order('created_at');
 // Créer automatiquement les lignes soiree_services pour les invités qui ont choisi via QR
  for (const inv of (invites || [])) {
    if (!inv.recette_id) continue;
    const dejaService = (services || []).some(s => 
      s.invite_id === inv.id && s.recette_id === inv.recette_id
    );
    if (!dejaService) {
      const { data: newService } = await db.from('soiree_services').insert({
        id: 'srv-qr-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
        user_id: currentUser.id,
        soiree_menu_id: soireeMenuActive.id,
        recette_id: inv.recette_id,
        portions: 1,
        item_cave_id: inv.recette_id,
        cl_servi: 0,
        statut: 'assigne',
        invite_id: inv.id
      }).select().single();
      if (newService) services.push(newService);
    }
  }
// Grouper les services par invite_id
const servicesParInvite = {};
  (services || []).forEach(s => {
    if (!s.invite_id) return;
    if (!servicesParInvite[s.invite_id]) servicesParInvite[s.invite_id] = [];
    // Fusionner assigne+servi pour la même ligne (même id)
    const existing = servicesParInvite[s.invite_id].find(x => x.id === s.id);
    if (!existing) servicesParInvite[s.invite_id].push(s);
  });
  // Calculer consommation projetée par item
const consoPrevue = {};
  soireeMenuRecettesActives.forEach(mr => {
    const recette = recettes.find(r => r.id === mr.recette_id);
    const servicesRecette = (services || []).filter(s => 
      s.recette_id === mr.recette_id && 
      s.statut === 'assigne' && 
      s.soiree_menu_id === soireeMenuActive.id
    );
    
    if (servicesRecette.length > 0) {
      // Calculer par service avec ses substitutions propres
      servicesRecette.forEach(s => {
        const subs = s.substitutions || {};
        (recette?.ingredients || []).forEach(ing => {
          if (!ing.item_cave_id || !ing.quantite || ing.optionnel) return;
          if (ing.unite !== 'cl' && ing.unite !== 'ml') return;
          if (CATEGORIES_NON_TRACKEES.includes(categorieDeItemGlobal(ing.item_cave_id))) return;
          const qteCl = ing.unite === 'ml' ? ing.quantite / 10 : ing.quantite;
          const itemId = subs[ing.item_cave_id] || ing.item_cave_id;
          if (!consoPrevue[itemId]) consoPrevue[itemId] = { nom: ing.nom, totalCl: 0 };
          consoPrevue[itemId].totalCl += qteCl;
        });
      });
    } else {
      // Pas de service assigné — utiliser portions_prevues sans substitution
      (recette?.ingredients || []).forEach(ing => {
        if (!ing.item_cave_id || !ing.quantite || ing.optionnel) return;
        if (ing.unite !== 'cl' && ing.unite !== 'ml') return;
        if (CATEGORIES_NON_TRACKEES.includes(categorieDeItemGlobal(ing.item_cave_id))) return;
        const qteCl = ing.unite === 'ml' ? ing.quantite / 10 : ing.quantite;
        if (!consoPrevue[ing.item_cave_id]) consoPrevue[ing.item_cave_id] = { nom: ing.nom, totalCl: 0 };
        consoPrevue[ing.item_cave_id].totalCl += qteCl * mr.portions_prevues;
      });
    }
  });

// Calculer consommation réelle par item depuis les services "servi"
const consoReelle = {};
  (services || []).filter(s => s.statut === 'servi' && s.soiree_menu_id === soireeMenuActive.id).forEach(s => {
    if (parseFloat(s.cl_servi || 0) > 0) {
      consoReelle[s.item_cave_id] = (consoReelle[s.item_cave_id] || 0) + parseFloat(s.cl_servi);
    } else {
      const recette = recettes.find(r => r.id === s.recette_id);
      const subs = s.substitutions || {};
      (recette?.ingredients || []).forEach(ing => {
        if (!ing.item_cave_id || !ing.quantite || ing.optionnel) return;
        if (ing.unite !== 'cl' && ing.unite !== 'ml') return;
        if (CATEGORIES_NON_TRACKEES.includes(categorieDeItemGlobal(ing.item_cave_id))) return;
        const qteCl = (ing.unite === 'ml' ? ing.quantite / 10 : ing.quantite) * (s.portions || 1);
        const itemId = subs[ing.item_cave_id] || ing.item_cave_id;
        consoReelle[itemId] = (consoReelle[itemId] || 0) + qteCl;
      });
    }
  });

  // Construire les données barres tricolores
  const barres = Object.entries(consoPrevue).map(([itemId, c]) => {
    const item = estEnVoyage
      ? voyageBouteillesActives.find(b => b.item_cave_id === itemId)
      : cave?.categories?.flatMap(cat => cat.items).find(i => i.id === itemId);
    const clTotal = estEnVoyage
      ? parseFloat(item?.cl_restants_origine ?? item?.cl_restants_voyage ?? 0)
      : parseFloat(item?.cl_restants ?? 0) + (consoReelle[itemId] || 0);
    const clConsomme = consoReelle[itemId] || 0;
    const clPrevu = c.totalCl;
    const clRestant = clTotal - clConsomme;
    const clLibre = Math.max(0, clRestant - clPrevu);
    const depasse = clConsomme + clPrevu > clTotal;

    const pctConsomme = clTotal > 0 ? Math.min(100, (clConsomme / clTotal) * 100) : 0;
    const pctPrevu = clTotal > 0 ? Math.min(100 - pctConsomme, (clPrevu / clTotal) * 100) : 0;
    const pctLibre = Math.max(0, 100 - pctConsomme - pctPrevu);

    return { itemId, nom: item?.nom || c.nom, clTotal, clConsomme, clPrevu, clRestant, clLibre, depasse, pctConsomme, pctPrevu, pctLibre };
  });

  // Alternatives pour items dépassés
  const bouteillesDispos = estEnVoyage
    ? voyageBouteillesActives
    : cave?.categories?.flatMap(cat => cat.items).filter(i => i.detenu !== false) || [];

  const recettesDispo = recettes.filter(r => {
    if (r.type !== 'cocktail') return false;
    return !soireeMenuRecettesActives.some(mr => mr.recette_id === r.id);
  });

  const ingredientsNonLies = [];
  soireeMenuRecettesActives.forEach(mr => {
    const recette = recettes.find(r => r.id === mr.recette_id);
    (recette?.ingredients || []).forEach(ing => {
      if (!ing.item_cave_id && !ing.optionnel) ingredientsNonLies.push({ nom: ing.nom, recette: recette.nom });
    });
  });

  modal.innerHTML = `
    <div style="max-width:600px;margin:0 auto;background:var(--bg-card);border-radius:16px;padding:20px">

      <!-- EN-TÊTE -->
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
        <input type="text" value="${soireeMenuActive.nom}" style="font-size:1.1rem;font-weight:700;background:none;border:none;border-bottom:1px dashed var(--border);color:inherit;flex:1"
          onblur="renommerSoireeMenu(this.value)">
        <button onclick="document.getElementById('modal-tableau-bord-soiree').remove()" style="background:none;border:none;color:var(--text-muted);font-size:1.3rem;cursor:pointer;margin-left:12px">✕</button>
      </div>

      ${ingredientsNonLies.length > 0 ? `
      <div style="background:var(--bg-danger);border-left:3px solid var(--border-danger);border-radius:0 8px 8px 0;padding:10px 12px;margin-bottom:14px;font-size:0.82rem;color:var(--text-danger)">
        🔗 ${ingredientsNonLies.length} ingrédient(s) non lié(s) — ${ingredientsNonLies.map(i => i.nom).join(', ')}
      </div>` : ''}

      <!-- COCKTAILS DU MENU -->
      <div style="margin-bottom:16px">
        <div style="font-size:0.85rem;font-weight:600;margin-bottom:8px">🍸 Cocktails du menu</div>
        ${soireeMenuRecettesActives.length === 0 ? `<div style="font-size:0.8rem;color:var(--text-muted)">Aucun cocktail ajouté.</div>` : ''}
        ${soireeMenuRecettesActives.map(mr => {
          const recette = recettes.find(r => r.id === mr.recette_id);
          const vp = estEnVoyage ? calculerVerresPossiblesVoyage(recette) : calculerVerresPossibles(recette);
          const nbServis = (services || []).filter(s => s.recette_id === mr.recette_id).reduce((acc, s) => acc + (s.portions || 1), 0);
return `
  <div style="padding:8px 0;border-bottom:1px solid var(--border)">
    <div style="display:flex;justify-content:space-between;align-items:center">
      <div>
        <span style="font-size:0.9rem;font-weight:600;cursor:pointer" onclick="ouvrirFicheRecette && ouvrirFicheRecette('${recette?.id}')">${recette?.nom || '—'}</span>
        <button style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:0.85rem;padding:0 4px" onclick="ouvrirFicheRecette && ouvrirFicheRecette('${recette?.id}')">ℹ️</button>
        ${vp ? `<span style="font-size:0.72rem;color:${vp.max <= 2 ? 'var(--text-warning)' : 'var(--text-success)'};margin-left:6px">${estEnVoyage ? '🧳' : '🍸'} ${vp.max}v</span>` : ''}
        ${nbServis > 0 ? `<span style="font-size:0.72rem;color:var(--text-danger);margin-left:6px">✓ ${nbServis} servi${nbServis > 1 ? 's' : ''}</span>` : ''}
      </div>
      <div style="display:flex;align-items:center;gap:6px">
<button class="btn-outline" style="padding:2px 8px" onclick="ajusterPortionsMenu('${mr.id}', -1); renderTableauBordSoiree()">−</button>
        <span style="min-width:20px;text-align:center;font-size:0.9rem">${mr.portions_prevues}</span>
        <button class="btn-outline" style="padding:2px 8px" onclick="ajusterPortionsMenu('${mr.id}', 1); renderTableauBordSoiree()">+</button>
        <button class="btn-icon" style="color:var(--text-danger)" onclick="retirerRecetteMenu('${mr.id}')">🗑</button>
      </div>
    </div>
  </div>`;
        }).join('')}
        <select id="select-ajout-recette" style="width:100%;margin-top:10px;padding:8px;border-radius:6px;border:1px solid var(--border);background:var(--bg);color:var(--text-primary)">
          <option value="">+ Ajouter un cocktail au menu…</option>
          ${recettesDispo.map(r => `<option value="${r.id}">${r.nom}</option>`).join('')}
        </select>
      </div>

      <!-- BARRES TRICOLORES -->
      ${barres.length > 0 ? `
      <div style="margin-bottom:16px">
        <div style="font-size:0.85rem;font-weight:600;margin-bottom:10px">📊 Ingrédients</div>
        ${barres.map(b => `
          <div style="margin-bottom:10px">
            <div style="display:flex;justify-content:space-between;font-size:0.78rem;margin-bottom:3px">
              <span style="font-weight:600;color:${b.depasse ? 'var(--text-danger)' : 'var(--text-primary)'}">${b.nom}</span>
              <span style="color:var(--text-muted)">${Math.round(b.clRestant*10)/10}cl restants · ${Math.round(b.clPrevu*10)/10}cl prévus</span>
            </div>
            <div style="height:8px;background:var(--bg);border-radius:4px;overflow:hidden;display:flex">
              <div style="height:100%;width:${b.pctConsomme}%;background:#e53e3e;flex-shrink:0"></div>
              <div style="height:100%;width:${b.pctPrevu}%;background:${b.depasse ? '#e53e3e' : '#ed8936'};flex-shrink:0"></div>
              <div style="height:100%;width:${b.pctLibre}%;background:#38a169;flex-shrink:0"></div>
            </div>
            ${b.depasse ? `
            <div style="font-size:0.72rem;color:var(--text-danger);margin-top:3px">
              ⚠️ Dépassement de ${Math.round((b.clConsomme + b.clPrevu - b.clTotal)*10)/10}cl
              ${(() => {
                const catId = categorieDeItemGlobal(b.itemId);
                const alt = bouteillesDispos.find(bt => {
                  const btId = estEnVoyage ? bt.item_cave_id : bt.id;
                  if (btId === b.itemId) return false;
                  const btCat = categorieDeItemGlobal(btId);
                  return btCat === catId;
                });
                return alt ? ` → Alternative : <strong>${alt.nom}</strong>` : '';
              })()}
            </div>` : ''}
          </div>
        `).join('')}
      </div>` : ''}

      <!-- SERVICE — INVITÉS -->
      <div style="margin-bottom:16px">
        <div style="font-size:0.85rem;font-weight:600;margin-bottom:8px">👥 Service (${(invites||[]).length} invité${(invites||[]).length > 1 ? 's' : ''})</div>
        ${(invites||[]).length === 0 ? '<div style="font-size:0.8rem;color:var(--text-muted);margin-bottom:8px">Aucun invité.</div>' : ''}
${(invites||[]).map(inv => {
  const lienQR = `${window.location.origin}/guest.html?invite=${inv.token}`;
  const cocktailsInvite = servicesParInvite[inv.id] || [];
  return `
<div style="padding:8px 10px;border:1px solid var(--border);border-radius:8px;margin-bottom:6px">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <div style="font-size:0.88rem;font-weight:600">👤 ${inv.nom_invite || 'Invité'}</div>
        <div style="display:flex;gap:6px">
          <button class="btn-outline" style="padding:4px 8px;font-size:0.75rem" title="QR défi gustatif" onclick="afficherQRInvite('${lienQR}', '${inv.nom_invite}')">📱</button>
          <button class="btn-outline" style="padding:4px 8px;font-size:0.75rem;color:var(--text-danger)" onclick="supprimerInviteService('${inv.id}')">🗑</button>
        </div>
      </div>
      ${inv.note ? `<div style="font-size:0.75rem;color:var(--text-secondary);margin-top:3px;font-style:italic">📝 ${inv.note}</div>` : ''}
      ${cocktailsInvite.length === 0 ? `<div style="font-size:0.75rem;color:var(--text-muted);margin-top:4px">Aucun cocktail assigné</div>` : ''}
${cocktailsInvite.map(s => {
  const r = recettes.find(rec => rec.id === s.recette_id);
  const couleur = s.statut === 'servi' ? 'var(--text-success)' : 'var(--text-warning)';
  const icone = s.statut === 'servi' ? '✅' : '🟡';
  return `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-top:4px">
      <span style="font-size:0.78rem;color:${couleur}">${icone} ${r?.nom || s.recette_id}</span>
${s.statut === 'assigne' ? `
        <button style="background:none;border:1px solid var(--text-success);border-radius:6px;padding:2px 8px;font-size:0.75rem;color:var(--text-success);cursor:pointer"
          onclick="marquerServi(this.dataset.sid, this.dataset.rid, parseInt(this.dataset.portions))"
          data-sid="${s.id}" data-rid="${s.recette_id}" data-portions="${s.portions || 1}">✅ Servi</button>
      ` : ''}
    </div>
  `;
}).join('')}
    </div>
  `;
}).join('')}
<div style="display:flex;gap:8px;margin-top:8px">
  <button class="btn-outline" style="flex:1;font-size:0.82rem" onclick="ajouterInviteService('liste')">👤 + Invité</button>
  <button class="btn-outline" style="flex:1;font-size:0.82rem" onclick="ouvrirAssignationInvite()">🍸 Assigner</button>
  <button class="btn-outline" style="flex:1;font-size:0.82rem" onclick="afficherQRChoixMenu()">📱 QR Choix</button>
</div>
      </div>

     <!-- SERVICES EFFECTUÉS -->
      ${(services||[]).length > 0 ? `
      <div style="margin-bottom:16px">
        <div style="font-size:0.85rem;font-weight:600;margin-bottom:8px">✅ Services effectués</div>
        ${(services||[]).map(s => {
          const r = recettes.find(rec => rec.id === s.recette_id);
          const nom = r?.nom || s.recette_id;
          const heure = new Date(s.created_at).toLocaleTimeString('fr-FR', {hour:'2-digit', minute:'2-digit'});
          return `
            <div style="display:flex;justify-content:space-between;align-items:center;font-size:0.82rem;padding:6px 0;border-bottom:1px solid var(--border)">
              <div>
                <span style="font-weight:600">${nom}</span>
                <span style="color:var(--text-muted);margin-left:6px">${s.portions} verre${s.portions > 1 ? 's' : ''} · ${heure}</span>
              </div>
              <button style="background:none;border:none;color:var(--text-danger);cursor:pointer;font-size:0.9rem" onclick="annulerService('${s.id}', '${s.recette_id}', ${s.portions})">🗑</button>
            </div>
          `;
        }).join('')}
      </div>` : ''}
      <button class="btn-outline" style="width:100%;margin-top:8px;border-color:var(--text-danger);color:var(--text-danger)" onclick="terminerSoireeService()">
        🏁 Terminer la soirée
      </button>
    </div>
`;
  document.getElementById('select-ajout-recette').onchange = async (e) => {
    if (!e.target.value) return;
    await ajouterRecetteMenu(e.target.value);
  };
}
async function ajouterInviteService(modeChoix) {
  const modal = document.createElement('div');
  modal.id = 'modal-ajout-invite';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:10500;display:flex;align-items:center;justify-content:center;padding:20px';
  
  modal.innerHTML = `
    <div style="max-width:400px;width:100%;background:var(--bg-card);border-radius:16px;padding:20px">
      <div style="font-size:1rem;font-weight:700;margin-bottom:16px">👤 Nouvel invité</div>
      
      <input type="text" id="invite-prenom" placeholder="Prénom *" 
        style="width:100%;padding:10px;border-radius:8px;border:1px solid var(--border);background:var(--bg);color:var(--text-primary);font-size:0.9rem;box-sizing:border-box;margin-bottom:8px">
      
      <textarea id="invite-note" placeholder="Note (optionnel) — goûts, allergies, préférences..."
        style="width:100%;padding:10px;border-radius:8px;border:1px solid var(--border);background:var(--bg);color:var(--text-primary);font-size:0.85rem;box-sizing:border-box;height:70px;resize:none;margin-bottom:12px"></textarea>

      ${modeChoix === 'assigne' ? `
      <div style="font-size:0.82rem;color:var(--text-secondary);margin-bottom:6px">Cocktail assigné :</div>
      <select id="invite-cocktail" style="width:100%;padding:10px;border-radius:8px;border:1px solid var(--border);background:var(--bg);color:var(--text-primary);font-size:0.85rem;margin-bottom:12px">
        <option value="">— Choisir un cocktail —</option>
        ${soireeMenuRecettesActives.map(mr => {
          const r = recettes.find(rec => rec.id === mr.recette_id);
          return `<option value="${mr.recette_id}">${r?.nom || mr.recette_id}</option>`;
        }).join('')}
      </select>` : `
      <div style="font-size:0.78rem;color:var(--text-muted);margin-bottom:12px">L'invité choisira via QR code.</div>`}

      <div style="display:flex;gap:8px">
        <button class="btn-outline" style="flex:1" onclick="document.getElementById('modal-ajout-invite').remove()">Annuler</button>
        <button class="btn-primary" style="flex:1" onclick="confirmerAjoutInvite('${modeChoix}')">✅ Ajouter</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  setTimeout(() => document.getElementById('invite-prenom')?.focus(), 100);
}

async function confirmerAjoutInvite(modeChoix) {
  const nom = document.getElementById('invite-prenom')?.value.trim();
  if (!nom) { alert('Prénom obligatoire.'); return; }
  const note = document.getElementById('invite-note')?.value.trim() || null;
  
  let recetteId = null;
  let modeChoixBDD = 'manuel';
  let statut = 'en_attente';

  if (modeChoix === 'assigne') {
    recetteId = document.getElementById('invite-cocktail')?.value || null;
    modeChoixBDD = 'manuel';
    statut = recetteId ? 'recette_choisie' : 'en_attente';
  } else if (modeChoix === 'libre') {
    modeChoixBDD = 'libre';
    statut = 'en_attente';
  } else {
    // 'liste' — juste prénom, pas de cocktail, pas de QR
    modeChoixBDD = 'manuel';
    statut = 'en_attente';
  }

  const token = Math.random().toString(36).substring(2, 10);
const { error } = await db.from('sessions_invites').insert({
    user_id: currentUser.id,
    token,
    nom_invite: nom,
    note,
    nom_session: soireeMenuActive.nom,
    soiree_menu_id: soireeMenuActive.id,
    is_master: false,
    mode_choix: modeChoixBDD,
    recette_id: recetteId,
    statut,
    recettes_disponibles: soireeMenuRecettesActives.map(mr => mr.recette_id),
    expires_at: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString()
  });
  if (error) { alert('Erreur : ' + error.message); return; }
  document.getElementById('modal-ajout-invite')?.remove();
  await renderTableauBordSoiree();
}
async function ouvrirAssignationInvite() {
  const { data: invites } = await db.from('sessions_invites')
    .select('*')
    .eq('soiree_menu_id', soireeMenuActive.id)
    .eq('is_master', false)
    .order('created_at');

  const estEnVoyage = voyageActif && soireeMenuActive?.voyage_id === voyageActif.id;
  const bouteilles = estEnVoyage
    ? voyageBouteillesActives
    : cave?.categories?.flatMap(c => c.items).filter(i => i.detenu !== false) || [];

  const modal = document.createElement('div');
  modal.id = 'modal-assignation';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:10500;display:flex;align-items:center;justify-content:center;padding:20px';
  modal.innerHTML = `
    <div style="max-width:440px;width:100%;background:var(--bg-card);border-radius:16px;padding:20px;max-height:90vh;overflow-y:auto">
      <div style="font-size:1rem;font-weight:700;margin-bottom:16px">🍸 Assigner un cocktail</div>
      ${(invites||[]).length === 0 ? '<div style="font-size:0.85rem;color:var(--text-muted)">Aucun invité dans la soirée.</div>' : `
      <div style="font-size:0.82rem;color:var(--text-secondary);margin-bottom:6px">Invité :</div>
      <select id="assign-invite" style="width:100%;padding:10px;border-radius:8px;border:1px solid var(--border);background:var(--bg);color:var(--text-primary);font-size:0.85rem;margin-bottom:12px">
        <option value="">— Choisir un invité —</option>
        ${(invites||[]).map(i => {
          const r = recettes.find(rec => rec.id === i.recette_id);
          return `<option value="${i.id}">${i.nom_invite}${r ? ' (' + r.nom + ')' : ''}</option>`;
        }).join('')}
      </select>
      <div style="font-size:0.82rem;color:var(--text-secondary);margin-bottom:6px">Cocktail :</div>
      <select id="assign-cocktail" style="width:100%;padding:10px;border-radius:8px;border:1px solid var(--border);background:var(--bg);color:var(--text-primary);font-size:0.85rem;margin-bottom:12px"
        onchange="renderIngredientsAssignation(this.value)">
        <option value="">— Choisir un cocktail —</option>
        ${soireeMenuRecettesActives.map(mr => {
          const r = recettes.find(rec => rec.id === mr.recette_id);
          return `<option value="${mr.recette_id}">${r?.nom || mr.recette_id}</option>`;
        }).join('')}
      </select>
      <div id="assign-ingredients" style="margin-bottom:12px"></div>
      `}
      <div style="display:flex;gap:8px">
        <button class="btn-outline" style="flex:1" onclick="document.getElementById('modal-assignation').remove()">Annuler</button>
        ${(invites||[]).length > 0 ? `<button class="btn-primary" style="flex:1" onclick="confirmerAssignation()">✅ Assigner</button>` : ''}
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  // Stocker les bouteilles dans window pour y accéder depuis renderIngredientsAssignation
  window._assignBouteilles = bouteilles;
  window._assignSubs = {};
}

function renderIngredientsAssignation(recetteId) {
  const container = document.getElementById('assign-ingredients');
  if (!container) return;
  if (!recetteId) { container.innerHTML = ''; return; }

  const recette = recettes.find(r => r.id === recetteId);
  const bouteilles = window._assignBouteilles || [];
  const estEnVoyage = voyageActif && soireeMenuActive?.voyage_id === voyageActif.id;

  const ingsTrackables = (recette?.ingredients || []).filter(ing =>
    ing.item_cave_id && ing.quantite &&
    (ing.unite === 'cl' || ing.unite === 'ml') &&
    !ing.optionnel &&
    !CATEGORIES_NON_TRACKEES.includes(categorieDeItemGlobal(ing.item_cave_id))
  );

  if (ingsTrackables.length === 0) { container.innerHTML = ''; return; }

  window._assignSubs = {};
  ingsTrackables.forEach(ing => { window._assignSubs[ing.item_cave_id] = ing.item_cave_id; });

  container.innerHTML = `
    <div style="font-size:0.82rem;color:var(--text-secondary);margin-bottom:6px">Bouteilles à utiliser :</div>
    ${ingsTrackables.map(ing => {
      const qteCl = ing.unite === 'ml' ? ing.quantite / 10 : ing.quantite;
      return `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid var(--border)">
          <select style="flex:1;padding:4px 6px;border-radius:6px;border:1px solid var(--border);background:var(--bg);color:var(--text-primary);font-size:0.78rem;margin-right:8px"
            onchange="window._assignSubs['${ing.item_cave_id}']=this.value">
            ${bouteilles.map(b => {
              const bId = estEnVoyage ? b.item_cave_id : b.id;
              return `<option value="${bId}" ${bId === ing.item_cave_id ? 'selected' : ''}>${b.nom}</option>`;
            }).join('')}
          </select>
          <span style="font-size:0.78rem;color:var(--text-muted);white-space:nowrap">${qteCl}cl</span>
        </div>
      `;
    }).join('')}
  `;
}

async function confirmerAssignation() {
  const inviteId = document.getElementById('assign-invite')?.value;
  const recetteId = document.getElementById('assign-cocktail')?.value;
  if (!inviteId || !recetteId) { alert('Sélectionne un invité et un cocktail.'); return; }

  const subs = window._assignSubs || {};

  await db.from('soiree_services').insert({
    id: 'srv-assign-' + Date.now(),
    user_id: currentUser.id,
    soiree_menu_id: soireeMenuActive.id,
    recette_id: recetteId,
    portions: 1,
    item_cave_id: recetteId,
    cl_servi: 0,
    statut: 'assigne',
    invite_id: inviteId,
    substitutions: Object.keys(subs).length > 0 ? subs : null
  });

  document.getElementById('modal-assignation')?.remove();
  await renderTableauBordSoiree();
}
async function marquerServi(serviceId, recetteId, portions) {
  const recette = recettes.find(r => r.id === recetteId);
  const estEnVoyage = voyageActif && soireeMenuActive?.voyage_id === voyageActif.id;

  // Charger les substitutions déjà définies à l'assignation
  const { data: serviceData } = await db.from('soiree_services')
    .select('substitutions').eq('id', serviceId).single();
  const subsPredef = serviceData?.substitutions || {};
  
  const bouteilles = estEnVoyage
    ? voyageBouteillesActives
    : cave?.categories?.flatMap(c => c.items).filter(i => i.detenu !== false) || [];

  const ingsTrackables = (recette?.ingredients || []).filter(ing =>
    ing.item_cave_id && ing.quantite &&
    (ing.unite === 'cl' || ing.unite === 'ml') &&
    !ing.optionnel &&
    !CATEGORIES_NON_TRACKEES.includes(categorieDeItemGlobal(ing.item_cave_id))
  );

  if (ingsTrackables.length === 0) {
    // Pas d'ingrédients trackables — confirmer directement
    if (!confirm('Servir ce cocktail ?')) return;
    await db.from('soiree_services').update({ statut: 'servi' }).eq('id', serviceId);
    await renderTableauBordSoiree();
    return;
  }

  // Afficher modal substitution
  const subs = {};
  ingsTrackables.forEach(ing => { 
    subs[ing.item_cave_id] = subsPredef[ing.item_cave_id] || ing.item_cave_id; 
  });
  window._marquerServiSubs = { ...subs };
  window._marquerServiId = serviceId;
  window._marquerServiRecetteId = recetteId;
  window._marquerServiPortions = portions;

  const modal = document.createElement('div');
  modal.id = 'modal-marquer-servi';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:10500;display:flex;align-items:center;justify-content:center;padding:20px';
  modal.innerHTML = `
    <div style="max-width:400px;width:100%;background:var(--bg-card);border-radius:16px;padding:20px">
      <div style="font-size:1rem;font-weight:700;margin-bottom:4px">🍸 ${recette?.nom || recetteId}</div>
      <div style="font-size:0.8rem;color:var(--text-muted);margin-bottom:14px">${portions} portion${portions > 1 ? 's' : ''} — vérifie les bouteilles</div>
      ${ingsTrackables.map(ing => {
        const qteCl = (ing.unite === 'ml' ? ing.quantite / 10 : ing.quantite) * portions;
        return `
          <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid var(--border)">
            <select style="flex:1;padding:4px 6px;border-radius:6px;border:1px solid var(--border);background:var(--bg);color:var(--text-primary);font-size:0.78rem;margin-right:8px"
              onchange="window._marquerServiSubs['${ing.item_cave_id}']=this.value">
              ${bouteilles.map(b => {
                const bId = estEnVoyage ? b.item_cave_id : b.id;
                const defaultId = subsPredef[ing.item_cave_id] || ing.item_cave_id;
                return `<option value="${bId}" ${bId === defaultId ? 'selected' : ''}>${b.nom}</option>`;
              }).join('')}
            </select>
            <span style="font-size:0.78rem;color:var(--text-muted);white-space:nowrap">${Math.round(qteCl*10)/10}cl</span>
          </div>
        `;
      }).join('')}
      <div style="display:flex;gap:8px;margin-top:16px">
        <button class="btn-outline" style="flex:1" onclick="document.getElementById('modal-marquer-servi').remove()">Annuler</button>
        <button class="btn-primary" style="flex:1" id="btn-confirmer-marquer">✅ Servir</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  document.getElementById('btn-confirmer-marquer').addEventListener('click', async () => {
    const subs = window._marquerServiSubs;
    const serviceId = window._marquerServiId;
    const recetteId = window._marquerServiRecetteId;
    const portions = window._marquerServiPortions;
    const recette = recettes.find(r => r.id === recetteId);
    const estEnVoyage = voyageActif && soireeMenuActive?.voyage_id === voyageActif.id;
    await db.from('soiree_services').update({ statut: 'servi', substitutions: subs }).eq('id', serviceId);
    for (const ing of (recette?.ingredients || [])) {
      if (!ing.item_cave_id || !ing.quantite || ing.optionnel) continue;
      if (ing.unite !== 'cl' && ing.unite !== 'ml') continue;
      if (CATEGORIES_NON_TRACKEES.includes(categorieDeItemGlobal(ing.item_cave_id))) continue;
      const qteCl = (ing.unite === 'ml' ? ing.quantite / 10 : ing.quantite) * portions;
      const itemId = subs[ing.item_cave_id] || ing.item_cave_id;
      if (estEnVoyage) {
        const b = voyageBouteillesActives.find(b => b.item_cave_id === itemId);
        if (!b) continue;
        const nouveau = Math.max(0, parseFloat(b.cl_restants_voyage ?? 0) - qteCl);
        await db.from('mode_voyage_bouteilles').update({ cl_restants_voyage: nouveau })
          .eq('item_cave_id', itemId).eq('mode_voyage_id', voyageActif.id);
        b.cl_restants_voyage = nouveau;
      } else {
        const item = cave?.categories?.flatMap(c => c.items).find(i => i.id === itemId);
        if (!item) continue;
        const nouveau = Math.max(0, (item.cl_restants ?? 0) - qteCl);
        await db.from('items').update({ cl_restants: nouveau }).eq('id', itemId).eq('user_id', currentUser.id);
        item.cl_restants = nouveau;
      }
    }
    document.getElementById('modal-marquer-servi')?.remove();
    await renderTableauBordSoiree();
  }, { once: true });
}
function afficherQRInvite(lien, nomInvite) {
  const modal = document.createElement('div');
  modal.id = 'modal-qr-invite';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:10500;display:flex;align-items:center;justify-content:center;padding:20px';
  modal.innerHTML = `
    <div style="background:var(--bg-card);border-radius:16px;padding:24px;text-align:center;max-width:300px;width:100%">
      <div style="font-size:1rem;font-weight:700;margin-bottom:4px">📱 ${nomInvite}</div>
      <div style="font-size:0.78rem;color:var(--text-muted);margin-bottom:16px">Scanne pour le défi gustatif</div>
      <div id="qr-invite-canvas" style="display:flex;justify-content:center;margin-bottom:16px"></div>
      <div style="font-size:0.72rem;color:var(--text-muted);word-break:break-all;margin:8px 0;padding:8px;background:var(--bg);border-radius:6px;text-align:left">${lien}</div>
      <button class="btn-outline" style="width:100%;margin-bottom:8px;font-size:0.8rem" onclick="navigator.clipboard.writeText('${lien}').then(()=>alert('Lien copié !'))">📋 Copier le lien</button>
      <button class="btn-outline" style="width:100%" onclick="document.getElementById('modal-qr-invite').remove()">Fermer</button>
    </div>
  `;
  document.body.appendChild(modal);
  new QRCode(document.getElementById('qr-invite-canvas'), {
    text: lien,
    width: 200,
    height: 200,
    colorDark: '#000000',
    colorLight: '#ffffff'
  });
}

function afficherQRChoixMenu() {
  const lien = `${window.location.origin}/guest.html?session=${soireeMenuActive.id}`;
  const modal = document.createElement('div');
  modal.id = 'modal-qr-choix';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:10500;display:flex;align-items:center;justify-content:center;padding:20px';
  modal.innerHTML = `
    <div style="background:var(--bg-card);border-radius:16px;padding:24px;text-align:center;max-width:300px;width:100%">
      <div style="font-size:1rem;font-weight:700;margin-bottom:4px">📱 Choisir un cocktail</div>
      <div style="font-size:0.78rem;color:var(--text-muted);margin-bottom:16px">L'invité scanne et choisit parmi le menu</div>
      <div id="qr-choix-canvas" style="display:flex;justify-content:center;margin-bottom:16px"></div>
      <div style="font-size:0.72rem;color:var(--text-muted);word-break:break-all;margin:8px 0;padding:8px;background:var(--bg);border-radius:6px;text-align:left">${lien}</div>
      <button class="btn-outline" style="width:100%;margin-bottom:8px;font-size:0.8rem" onclick="navigator.clipboard.writeText('${lien}').then(()=>alert('Lien copié !'))">📋 Copier le lien</button>
      <button class="btn-outline" style="width:100%" onclick="document.getElementById('modal-qr-choix').remove()">Fermer</button>
    </div>
  `;
  document.body.appendChild(modal);
  new QRCode(document.getElementById('qr-choix-canvas'), {
    text: lien,
    width: 200,
    height: 200,
    colorDark: '#000000',
    colorLight: '#ffffff'
  });
}
async function servirCocktail(menuRecetteId, recetteId, recetteNom, portions) {
  portions = portions || 1;
  const recette = recettes.find(r => r.id === recetteId);
  if (!recette) return;

  const estEnVoyage = voyageActif && soireeMenuActive?.voyage_id === voyageActif.id;
  const bouteilles = estEnVoyage
    ? voyageBouteillesActives
    : cave?.categories?.flatMap(c => c.items).filter(i => i.detenu !== false) || [];

  // Charger invités pour ce cocktail
const { data: tousInvites } = await db.from('sessions_invites')
    .select('*')
    .eq('soiree_menu_id', soireeMenuActive.id)
    .eq('is_master', false)
    .order('created_at');

  // Chercher les invités qui ont ce cocktail assigné dans soiree_services
  const { data: servicesAssignes } = await db.from('soiree_services')
    .select('invite_id')
    .eq('soiree_menu_id', soireeMenuActive.id)
    .eq('recette_id', recetteId)
    .eq('statut', 'assigne');

  const inviteIdsAssignes = (servicesAssignes || []).map(s => s.invite_id?.toString());
  const invitesAvecCecocktail = (tousInvites || []).filter(i =>
    inviteIdsAssignes.includes(i.id?.toString())
  );
  const invitesSansCommande = (tousInvites || []).filter(i =>
    !i.recette_id && i.statut !== 'termine'
  );

  const ingsTrackables = (recette.ingredients || []).filter(ing =>
    ing.item_cave_id && ing.quantite &&
    (ing.unite === 'cl' || ing.unite === 'ml') &&
    !ing.optionnel &&
    !CATEGORIES_NON_TRACKEES.includes(categorieDeItemGlobal(ing.item_cave_id))
  );

const subs = {};
ingsTrackables.forEach(ing => { subs[ing.item_cave_id] = ing.item_cave_id; });
window._servir_subs = { ...subs };
window._servirInviteIds = [];

  const modal = document.createElement('div');
  modal.id = 'modal-servir-cocktail';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:10000;display:flex;align-items:center;justify-content:center;padding:20px';

  modal.innerHTML = `
    <div style="max-width:440px;width:100%;background:var(--bg-card);border-radius:16px;padding:20px">
      <div style="font-size:1rem;font-weight:700;margin-bottom:4px">🍸 Servir ${recetteNom}</div>
      <div style="font-size:0.8rem;color:var(--text-muted);margin-bottom:14px">${portions} portion${portions > 1 ? 's' : ''}</div>

      <!-- ASSOCIATION INVITÉ -->
      <div style="margin-bottom:14px">
        ${invitesAvecCecocktail.length > 0 ? `
          <div style="font-size:0.82rem;color:var(--text-success);font-weight:600;margin-bottom:6px">
            ✅ ${invitesAvecCecocktail.length} invité${invitesAvecCecocktail.length > 1 ? 's' : ''} ont commandé ce cocktail :
          </div>
          ${invitesAvecCecocktail.map(i => `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 10px;border:1px solid var(--border-success);border-radius:6px;margin-bottom:4px;background:var(--bg-success)">
              <span style="font-size:0.85rem;font-weight:600">${i.nom_invite}</span>
              <label style="display:flex;align-items:center;gap:6px;font-size:0.8rem;cursor:pointer">
                <input type="checkbox" id="serv-inv-${i.id}" checked> Servir
              </label>
            </div>
          `).join('')}
        ` : ''}
        
        <div style="font-size:0.82rem;color:var(--text-secondary);margin-bottom:6px;margin-top:${invitesAvecCecocktail.length > 0 ? '10px' : '0'}">
          Autres invités :
        </div>
        <select id="serv-autre-invite" style="width:100%;padding:8px;border-radius:6px;border:1px solid var(--border);background:var(--bg);color:var(--text-primary);font-size:0.85rem">
          <option value="">— Aucun autre invité —</option>
          ${[...invitesSansCommande, ...(tousInvites||[]).filter(i => i.recette_id && i.recette_id !== recetteId && i.statut !== 'termine')].map(i =>
            `<option value="${i.id}">${i.nom_invite}${i.recette_id ? ' (a commandé autre chose)' : ''}</option>`
          ).join('')}
        </select>
      </div>

      <!-- SUBSTITUTIONS BOUTEILLES -->
      ${ingsTrackables.length > 0 ? `
      <div style="font-size:0.82rem;color:var(--text-secondary);margin-bottom:6px">Bouteilles utilisées :</div>
      ${ingsTrackables.map(ing => {
        const qteCl = (ing.unite === 'ml' ? ing.quantite / 10 : ing.quantite) * portions;
        return `
          <div style="display:flex;justify-content:space-between;align-items:center;padding:4px 0;border-bottom:1px solid var(--border)">
            <select style="flex:1;padding:4px 6px;border-radius:6px;border:1px solid var(--border);background:var(--bg);color:var(--text-primary);font-size:0.78rem;margin-right:8px"
              onchange="window._servir_subs['${ing.item_cave_id}']=this.value">
              ${bouteilles.map(b => {
                const bId = estEnVoyage ? b.item_cave_id : b.id;
                return `<option value="${bId}" ${bId === ing.item_cave_id ? 'selected' : ''}>${b.nom}</option>`;
              }).join('')}
            </select>
            <span style="font-size:0.78rem;color:var(--text-muted);white-space:nowrap">${Math.round(qteCl*10)/10}cl</span>
          </div>
        `;
      }).join('')}` : ''}

      <div style="display:flex;gap:8px;margin-top:16px">
        <button class="btn-outline" style="flex:1" onclick="document.getElementById('modal-servir-cocktail').remove()">Annuler</button>
        <button class="btn-primary" style="flex:1" id="btn-confirmer-servir">✅ Confirmer</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
 document.getElementById('btn-confirmer-servir').addEventListener('click', () => {
  confirmerServir(recetteId, portions, invitesAvecCecocktail.map(i => i.id));
});
}

async function confirmerServir(recetteId, portions, inviteIds) {
  const recette = recettes.find(r => r.id === recetteId);
  const estEnVoyage = voyageActif && soireeMenuActive?.voyage_id === voyageActif.id;
  const subs = window._servir_subs || {};

  // Marquer les invités cochés comme servis
  const invitesCochés = (inviteIds || []).filter(id => {
    const checkbox = document.getElementById('serv-inv-' + id);
    return checkbox ? checkbox.checked : true;
  });
  for (const invId of invitesCochés) {
    await db.from('sessions_invites').update({ statut: 'termine' }).eq('id', invId);
  }
  const autreInviteId = document.getElementById('serv-autre-invite')?.value;
  if (autreInviteId) {
    await db.from('sessions_invites').update({
      statut: 'degustation',
      recette_id: recetteId
    }).eq('id', autreInviteId);
  }

  // Logger UNE SEULE fois le service (pas par ingrédient)
  await db.from('soiree_services').insert({
    id: 'srv-' + Date.now(),
    user_id: currentUser.id,
    soiree_menu_id: soireeMenuActive.id,
    recette_id: recetteId,
    portions,
    item_cave_id: recetteId, // référence recette, pas ingrédient
    cl_servi: 0 // pas utilisé pour le comptage
  });

  // Décrémenter cave par ingrédient
  for (const ing of (recette?.ingredients || [])) {
    if (!ing.item_cave_id || !ing.quantite || ing.optionnel) continue;
    if (ing.unite !== 'cl' && ing.unite !== 'ml') continue;
    if (CATEGORIES_NON_TRACKEES.includes(categorieDeItemGlobal(ing.item_cave_id))) continue;
    const qteCl = (ing.unite === 'ml' ? ing.quantite / 10 : ing.quantite) * portions;
    const itemId = subs[ing.item_cave_id] || ing.item_cave_id;

    if (estEnVoyage) {
      const b = voyageBouteillesActives.find(b => b.item_cave_id === itemId);
      if (!b) continue;
      const nouveau = Math.max(0, parseFloat(b.cl_restants_voyage ?? 0) - qteCl);
      await db.from('mode_voyage_bouteilles').update({ cl_restants_voyage: nouveau })
        .eq('item_cave_id', itemId).eq('mode_voyage_id', voyageActif.id);
      b.cl_restants_voyage = nouveau;
    } else {
      const item = cave?.categories?.flatMap(c => c.items).find(i => i.id === itemId);
      if (!item) continue;
      const nouveau = Math.max(0, (item.cl_restants ?? 0) - qteCl);
      await db.from('items').update({ cl_restants: nouveau }).eq('id', itemId).eq('user_id', currentUser.id);
      item.cl_restants = nouveau;
    }
  }

  document.getElementById('modal-servir-cocktail')?.remove();
  await renderTableauBordSoiree();
}

async function terminerSoireeService() {
  if (!confirm('Terminer la soirée ?')) return;
  await db.from('soiree_menu').update({ statut: 'termine' }).eq('id', soireeMenuActive.id);
  soireeMenuActive.statut = 'termine';
  document.getElementById('modal-tableau-bord-soiree')?.remove();
  if (voyageActif) ouvrirTableauBordVoyage();
}
async function ajouterRecetteMenu(recetteId) {
  const { data } = await db.from('soiree_menu_recettes').insert({
    id: 'smr-' + Date.now(),
    soiree_menu_id: soireeMenuActive.id,
    recette_id: recetteId,
    portions_prevues: 6,
    ordre: soireeMenuRecettesActives.length
  }).select().single();
  if (data) soireeMenuRecettesActives.push(data);
  renderTableauBordSoiree();
}
 async function annulerService(serviceId, recetteId, portions) {
  if (!confirm('Annuler ce service et remettre les cl en cave ?')) return;

  const recette = recettes.find(r => r.id === recetteId);
  const estEnVoyage = voyageActif && soireeMenuActive?.voyage_id === voyageActif.id;

  // Remettre les cl en cave
  for (const ing of (recette?.ingredients || [])) {
    if (!ing.item_cave_id || !ing.quantite || ing.optionnel) continue;
    if (ing.unite !== 'cl' && ing.unite !== 'ml') continue;
    if (CATEGORIES_NON_TRACKEES.includes(categorieDeItemGlobal(ing.item_cave_id))) continue;
    const qteCl = (ing.unite === 'ml' ? ing.quantite / 10 : ing.quantite) * portions;
    const itemId = ing.item_cave_id;

    if (estEnVoyage) {
      const b = voyageBouteillesActives.find(b => b.item_cave_id === itemId);
      if (!b) continue;
      const nouveau = parseFloat(b.cl_restants_voyage ?? 0) + qteCl;
      await db.from('mode_voyage_bouteilles').update({ cl_restants_voyage: nouveau })
        .eq('item_cave_id', itemId).eq('mode_voyage_id', voyageActif.id);
      b.cl_restants_voyage = nouveau;
    } else {
      const item = cave?.categories?.flatMap(c => c.items).find(i => i.id === itemId);
      if (!item) continue;
      const nouveau = (item.cl_restants ?? 0) + qteCl;
      await db.from('items').update({ cl_restants: nouveau }).eq('id', itemId).eq('user_id', currentUser.id);
      item.cl_restants = nouveau;
    }
  }

  // Supprimer le service
  await db.from('soiree_services').delete().eq('id', serviceId);
  await renderTableauBordSoiree();
}
async function ouvrirGenerateurRecettes() {
  if (!voyageActif || voyageBouteillesActives.length === 0) {
    alert('Active le mode voyage avec des bouteilles pour générer des recettes.');
    return;
  }
  const modal = document.createElement('div');
  modal.id = 'modal-generateur';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.92);z-index:9800;overflow-y:auto;padding:20px';
  modal.innerHTML = `
    <div style="max-width:560px;margin:0 auto;background:var(--bg-card);border-radius:16px;padding:20px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
        <div style="font-size:1rem;font-weight:700">✨ Générer des recettes voyage</div>
        <button onclick="document.getElementById('modal-generateur').remove()" style="background:none;border:none;color:var(--text-muted);font-size:1.3rem;cursor:pointer">✕</button>
      </div>
      <div style="font-size:0.82rem;color:var(--text-secondary);margin-bottom:12px">
        🧳 ${voyageBouteillesActives.length} bouteilles — ${voyageBouteillesActives.map(b => b.nom).join(', ')}
      </div>
      <input type="text" id="gen-style" placeholder="Style souhaité (optionnel) — ex: fruité, sec, apéritif..."
        style="width:100%;padding:10px;border-radius:8px;border:1px solid var(--border);background:var(--bg);color:var(--text-primary);font-size:0.85rem;box-sizing:border-box;margin-bottom:12px">
      <div style="display:flex;gap:8px;margin-bottom:16px">
        <button class="btn-outline active" id="gen-nb-2" style="flex:1" onclick="window._genNb=2;['2','3','5'].forEach(n=>document.getElementById('gen-nb-'+n)?.classList.remove('active'));this.classList.add('active')">2 recettes</button>
        <button class="btn-outline" id="gen-nb-3" style="flex:1" onclick="window._genNb=3;['2','3','5'].forEach(n=>document.getElementById('gen-nb-'+n)?.classList.remove('active'));this.classList.add('active')">3 recettes</button>
        <button class="btn-outline" id="gen-nb-5" style="flex:1" onclick="window._genNb=5;['2','3','5'].forEach(n=>document.getElementById('gen-nb-'+n)?.classList.remove('active'));this.classList.add('active')">5 recettes</button>
      </div>
      <button class="btn-primary" style="width:100%;padding:12px" onclick="lancerGenerateur()">✨ Générer</button>
      <div id="gen-resultats" style="margin-top:16px"></div>
    </div>
  `;
  window._genNb = 2;
  document.body.appendChild(modal);
}

async function lancerGenerateur() {
  const style = document.getElementById('gen-style')?.value.trim() || '';
  const nb = window._genNb || 2;
  const resultats = document.getElementById('gen-resultats');
  if (!resultats) return;
  resultats.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-muted)">⏳ Génération en cours...</div>';
  const ingredients = voyageBouteillesActives
    .filter(b => parseFloat(b.cl_restants_voyage) > 0)
    .map(b => ({ nom: b.nom, cl_restants: b.cl_restants_voyage }));
  const response = await fetch('/api/generer-recette', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ingredients, style, nb_propositions: nb })
  });
  if (!response.ok) {
    resultats.innerHTML = '<div style="color:var(--text-danger)">Erreur lors de la génération.</div>';
    return;
  }
  const data = await response.json();
  const propositions = data.propositions || [];
  if (propositions.length === 0) {
    resultats.innerHTML = '<div style="color:var(--text-muted)">Aucune proposition générée.</div>';
    return;
  }
  resultats.innerHTML = propositions.map((p, idx) => `
    <div style="border:1px solid var(--border);border-radius:10px;padding:14px;margin-bottom:12px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
        <div>
          <span style="font-size:0.95rem;font-weight:700">${p.nom}</span>
          <span style="font-size:0.72rem;padding:2px 8px;border-radius:20px;margin-left:8px;${p.badge === 'classique' ? 'background:var(--bg-success);color:var(--text-success)' : 'background:var(--bg-accent);color:var(--text-accent)'}">${p.badge}</span>
        </div>
        <span style="font-size:0.75rem;color:var(--text-muted)">${p.confiance}% confiance</span>
      </div>
      <div style="font-size:0.78rem;color:var(--text-muted);margin-bottom:8px">${p.famille} · ${p.technique} · ${p.verre}</div>
      <div style="margin-bottom:8px">
        ${(p.dosages || []).map(d => `
          <div style="display:flex;justify-content:space-between;font-size:0.82rem;padding:3px 0;border-bottom:1px solid var(--border)">
            <span>${d.nom}</span>
            <span style="color:var(--text-muted)">${d.quantite} ${d.unite}</span>
          </div>
        `).join('')}
      </div>
      ${p.note_bartender ? `<div style="font-size:0.78rem;color:var(--text-accent);margin-bottom:10px">💡 ${p.note_bartender}</div>` : ''}
      ${soireeMenuActive ? `
      <button class="btn-outline" style="width:100%;font-size:0.82rem" onclick="ajouterRecetteGenereeASoiree(${idx})">
        🎉 Ajouter à "${soireeMenuActive.nom}"
      </button>` : ''}
    </div>
  `).join('');
  window._genPropositions = propositions;
}

async function ajouterRecetteGenereeASoiree(idx) {
  const p = window._genPropositions?.[idx];
  if (!p || !soireeMenuActive) return;
  const recetteId = 'gen-' + Date.now();
 const { data, error } = await db.from('recettes').insert({
    id: recetteId,
    user_id: currentUser.id,
    nom: p.nom,
    type: 'cocktail',
    base_alcool: p.dosages?.[0]?.nom || '',
    difficulte: p.difficulte || 'facile',
    verre_type: p.verre || '',
    description_courte: p.note_bartender || '',
    gout_sucre: p.profil?.gout_sucre || 0,
    gout_amer: p.profil?.gout_amer || 0,
    gout_acide: p.profil?.gout_acide || 0,
    gout_fruite: p.profil?.gout_fruite || 0,
    gout_fume: p.profil?.gout_fume || 0,
    gout_floral: p.profil?.gout_floral || 0,
    gout_epice: p.profil?.gout_epice || 0,
    gout_cremeux: p.profil?.gout_cremeux || 0
  }).select().single();
  if (error) { alert('Erreur création recette : ' + error.message); return; }
  for (const d of (p.dosages || [])) {
    await db.from('recette_ingredients').insert({
      user_id: currentUser.id,
      recette_id: recetteId,
      nom: d.nom,
      quantite: d.unite === 'cl' ? d.quantite * 10 : d.quantite,
      unite: d.unite === 'cl' ? 'ml' : d.unite,
      optionnel: false
    });
  }
  const { data: mr } = await db.from('soiree_menu_recettes').insert({
    id: 'smr-' + Date.now(),
    soiree_menu_id: soireeMenuActive.id,
    recette_id: recetteId,
    portions_prevues: 1,
    ordre: soireeMenuRecettesActives.length
  }).select().single();
  if (mr) soireeMenuRecettesActives.push(mr);
  const { data: nouvelleRecette } = await db.from('recettes')
    .select('*, ingredients:recette_ingredients(*)')
    .eq('id', recetteId).single();
  if (nouvelleRecette) recettes.push(nouvelleRecette);
  document.getElementById('modal-generateur')?.remove();
  alert(`"${p.nom}" ajouté à la soirée !`);
  await renderTableauBordSoiree();
}
async function supprimerSoireeMenu(soireeId) {
  if (!confirm('Supprimer cette soirée ?')) return;
  await db.from('soiree_menu_recettes').delete().eq('soiree_menu_id', soireeId);
  await db.from('stock_reserve').delete().eq('soiree_menu_id', soireeId);
  await db.from('soiree_menu').delete().eq('id', soireeId);
  chargerSessions();
}
async function ajusterPortionsMenu(id, delta) {
  const mr = soireeMenuRecettesActives.find(m => m.id === id);
  if (!mr) return;
  mr.portions_prevues = Math.max(0, mr.portions_prevues + delta);
  await db.from('soiree_menu_recettes').update({ portions_prevues: mr.portions_prevues }).eq('id', id);
  renderTableauBordSoiree();
}

async function retirerRecetteMenu(id) {
  await db.from('soiree_menu_recettes').delete().eq('id', id);
  soireeMenuRecettesActives = soireeMenuRecettesActives.filter(m => m.id !== id);
  renderTableauBordSoiree();
}

async function renommerSoireeMenu(nom) {
  if (!nom.trim() || nom === soireeMenuActive.nom) return;
  soireeMenuActive.nom = nom.trim();
  await db.from('soiree_menu').update({ nom: nom.trim() }).eq('id', soireeMenuActive.id);
}

async function verrouillerSoireeMenu() {
  const estVoyageOuSolo = (voyageActif && soireeMenuActive?.voyage_id === voyageActif.id) || soireeMenuActive?.mode === 'solo';

  if (estVoyageOuSolo) {
    // Verrouillage immédiat sans réservation de stock
    await db.from('soiree_menu').update({ statut: 'verrouille' }).eq('id', soireeMenuActive.id);
    soireeMenuActive.statut = 'verrouille';
    renderTableauBordSoiree();
    return;
  }

  // Mode normal avec date et réservation stock
  if (!confirm('Verrouiller ce menu ? Le stock nécessaire sera réservé jusqu\'à la date de l\'événement.')) return;
  const dateEvenement = prompt('Date de la soirée (AAAA-MM-JJ) ?', new Date().toISOString().slice(0, 10));
  if (!dateEvenement) return;

  const consommation = calculerConsommationAgregee();
  for (const c of consommation) {
    if (c.inconnu) continue;
    await db.from('stock_reserve').insert({
      id: 'reserve-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5),
      user_id: currentUser.id,
      item_id: c.itemId,
      soiree_menu_id: soireeMenuActive.id,
      cl_reserve: c.besoinCl,
      date_evenement: dateEvenement
    });
  }
  await db.from('soiree_menu').update({ statut: 'verrouille', date_evenement: dateEvenement }).eq('id', soireeMenuActive.id);
  await chargerStockReserve();
  soireeMenuActive.statut = 'verrouille';
  renderTableauBordSoiree();
}
async function chargerResumeDefiSolo() {
  const el = document.getElementById('resume-defi-solo');
  if (!el || !soireeMenuActive) return;
  const { data } = await db.from('sessions_invites').select('defi_reussi').eq('nom_session', soireeMenuActive.nom).eq('mode_choix', 'manuel');
  if (!data || data.length === 0) return;
  const nbRepondu = data.filter(i => i.defi_reussi !== null).length;
  const nbTrouve = data.filter(i => i.defi_reussi === true).length;
  el.innerHTML = `<div style="font-size:0.78rem;color:var(--text-accent);text-align:center">🎯 ${nbRepondu}/${data.length} ont relevé le défi — ${nbTrouve} ont trouvé</div>`;
}
function ouvrirAjoutInviteManuel() {
  const modal = document.createElement('div');
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.9);z-index:10000;display:flex;align-items:center;justify-content:center;padding:20px';
  modal.innerHTML = `
    <div style="background:var(--bg-card);border-radius:16px;padding:20px;max-width:380px;width:100%">
      <div style="font-size:1rem;font-weight:700;margin-bottom:12px">👤 Nouvel invité servi</div>
      <input type="text" id="invite-manuel-nom" placeholder="Prénom de l'invité" style="width:100%;padding:10px;border-radius:8px;border:1px solid var(--border);background:var(--bg);color:var(--text-primary);margin-bottom:10px">
      <select id="invite-manuel-recette" style="width:100%;padding:10px;border-radius:8px;border:1px solid var(--border);background:var(--bg);color:var(--text-primary);margin-bottom:16px">
        ${soireeMenuRecettesActives.map(mr => {
          const r = recettes.find(x => x.id === mr.recette_id);
          return `<option value="${mr.recette_id}">${r?.nom || '—'}</option>`;
        }).join('')}
      </select>
      <button class="btn-primary" style="width:100%" onclick="genererLienInviteManuel()">Générer le lien →</button>
      <div id="resultat-lien-invite" style="margin-top:12px"></div>
      <button class="btn-outline" style="width:100%;margin-top:8px" onclick="this.closest('div[style*=fixed]').remove()">Fermer</button>
    </div>
  `;
  document.body.appendChild(modal);
}

async function genererLienInviteManuel() {
  const nomInvite = document.getElementById('invite-manuel-nom').value.trim();
  const recetteId = document.getElementById('invite-manuel-recette').value;
  if (!nomInvite) { alert('Entre un prénom.'); return; }

  const { data, error } = await db.from('sessions_invites').insert({
    user_id: currentUser.id,
    nom_session: soireeMenuActive.nom,
    nom_invite: nomInvite,
    recette_id: recetteId,
    mode_choix: 'manuel',
    statut: 'recette_choisie',
    is_master: false,
    token: Math.random().toString(36).substring(2, 10),
    expires_at: new Date(Date.now() + 3 * 3600 * 1000).toISOString()
  }).select().single();

  if (error) { alert('Erreur : ' + error.message); return; }

  const lien = `https://bar-cocktail-smoky.vercel.app/guest.html?invite=${data.id}`;
  document.getElementById('resultat-lien-invite').innerHTML = `
    <div style="font-size:0.78rem;color:var(--text-muted);word-break:break-all;margin-bottom:8px">${lien}</div>
    <button class="btn-outline" style="width:100%" onclick="navigator.clipboard.writeText('${lien}');this.textContent='✅ Copié !'">📋 Copier ce lien</button>
  `;
}
async function creerSessionVoteRestreint(soireeMenuId) {
  const { data: menuRecettes } = await db.from('soiree_menu_recettes').select('*').eq('soiree_menu_id', soireeMenuId);
  const recetteIds = (menuRecettes || []).map(mr => mr.recette_id);

  const token = Math.random().toString(36).substring(2, 10);
  const expiresAt = new Date(Date.now() + 3 * 3600 * 1000).toISOString();
  let nom = prompt('Nom de la soirée ?');
  if (!nom || !nom.trim()) { alert('Une soirée doit avoir un nom.'); return; }
  nom = nom.trim();

  await db.from('sessions_invites').insert({
    user_id: currentUser.id,
    token,
    nom_session: nom,
    mode_choix: 'restreint',
    recettes_disponibles: recetteIds,
    soiree_menu_id: soireeMenuId,
    expires_at: expiresAt,
    is_master: true
  });

  chargerSessions();
}
let voyageIdPourSession = null;

function ouvrirModalNouvelleSession(voyageId = null) {
  voyageIdPourSession = voyageId || null;
  modeSessionActif = 'libre';
  document.getElementById('session-nom').value = '';
  document.getElementById('btn-mode-libre').classList.add('active');
  document.getElementById('bloc-recettes-liste').style.display = 'none';
  document.getElementById('btn-mode-verrouille').classList.remove('active');

  quizActif = true;
  document.getElementById('btn-quiz-oui').classList.add('active');
  document.getElementById('btn-quiz-non').classList.remove('active');

  // En mode voyage : filtrer sur cave voyage, sinon comportement normal
  const realisables = selectionPourSoireeEnAttente
    ? recettes.filter(r => selectionPourSoireeEnAttente.includes(r.id))
    : voyageId
      ? recettes.filter(r => r.type === 'cocktail' && calculerVerresPossiblesVoyage(r)?.max > 0)
      : recettes.filter(r => r.type === 'cocktail' && calculerDisponibilite(r) === 0);

  const liste = document.getElementById('session-recettes-liste');
  liste.innerHTML = realisables.map(r => `
    <div class="session-recette-item" onclick="this.querySelector('input').click()">
      <input type="checkbox" value="${r.id}" ${selectionPourSoireeEnAttente ? 'checked' : ''} />
      <div>
        <div class="session-recette-item-nom">${r.nom}</div>
        <div class="session-recette-item-meta">${r.base_alcool || ''} · ${(r.gouts || []).slice(0,2).join(' · ')}</div>
      </div>
    </div>
  `).join('');
  document.getElementById('modal-nouvelle-session').classList.add('visible');
}
async function creerSession() {
  const nom = document.getElementById('session-nom').value.trim();
  if (!nom) {
    alert('Donne un nom à ta soirée avant de lancer.');
    document.getElementById('session-nom').focus();
    return;
  }

  let recettesDisponibles;
  if (modeSessionActif === 'libre') {
    recettesDisponibles = voyageIdPourSession
      ? recettes.filter(r => r.type === 'cocktail' && calculerVerresPossiblesVoyage(r)?.max > 0).map(r => r.id)
      : recettes.filter(r => r.type === 'cocktail' && calculerDisponibilite(r) === 0).map(r => r.id);
  } else {
    const checks = document.querySelectorAll('#session-recettes-liste input[type=checkbox]:checked');
    recettesDisponibles = Array.from(checks).map(c => c.value);
  }

  const token = Math.random().toString(36).substring(2, 10);
  const expiresAt = new Date(Date.now() + 3 * 3600 * 1000).toISOString();

  const payload = {
    user_id: currentUser.id,
    token,
    nom_session: nom,
    mode_choix: modeSessionActif,
    quiz_actif: quizActif,
    recettes_disponibles: recettesDisponibles,
    expires_at: expiresAt,
    is_master: true
  };
  if (voyageIdPourSession) payload.voyage_id = voyageIdPourSession;

  const { error } = await db.from('sessions_invites').insert(payload);
  if (error) { alert('Erreur création session : ' + error.message); return; }

  voyageIdPourSession = null;
  document.getElementById('modal-nouvelle-session').classList.remove('visible');
  chargerSessions();
}

async function ouvrirSession(id) {
  const { data: session } = await db.from('sessions_invites')
    .select('*')
    .eq('id', id)
    .single();

  if (!session) { alert('Session introuvable'); return; }

  sessionActive = session;
 renderSessionActive(session);
abonnerRealtimeSession(session);
document.getElementById('modal-session-active').classList.add('visible');
}

function renderSessionActive(session) {
  const invites = session.invites || [];
  const recettesSession = recettes.filter(r => session.recettes_disponibles?.includes(r.id));
  const qrUrl = `https://bar-cocktail-smoky.vercel.app/guest.html?session=${session.token}`;

  document.getElementById('session-active-contenu').innerHTML = `
    <div style="margin-bottom:1.25rem">
      <div style="font-size:1.2rem;font-weight:600;margin-bottom:4px">${session.nom_session || 'Soirée sans nom'}</div>
      <div style="font-size:0.8rem;opacity:0.5">
        ${session.mode_choix === 'verrouille' ? '🔒 Verrouillé' : '🔓 Libre'} · 
        ${recettesSession.length} recette(s) · 
        ${Math.max(0, Math.ceil((new Date(session.expires_at) - new Date()) / 3600000))}h restantes
      </div>
    </div>

    <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:10px;padding:12px;margin-bottom:1.25rem;text-align:center">
      <div style="font-size:0.75rem;opacity:0.5;margin-bottom:8px">QR CODE INVITÉS</div>
<img src="https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(qrUrl)}" width="140" height="140" style="border-radius:8px" />
      <div style="font-size:0.7rem;opacity:0.4;margin-top:6px;word-break:break-all">${qrUrl}</div>
      <button class="btn-outline" style="margin-top:8px;padding:6px 14px;font-size:0.78rem" onclick="copierLienSession('${qrUrl}', this)">📋 Copier le lien</button>
    </div>

    <div style="font-size:0.75rem;font-weight:600;opacity:0.5;margin-bottom:10px">INVITÉS CONNECTÉS</div>
    <div id="session-invites-liste">
      <div style="font-size:0.85rem;opacity:0.4;text-align:center;padding:1rem">En attente d'invités…</div>
    </div>

    <div style="font-size:0.75rem;font-weight:600;opacity:0.5;margin:1rem 0 10px">RECETTES DISPONIBLES</div>
    <div style="display:flex;flex-wrap:wrap;gap:6px">
      ${recettesSession.map(r => `
        <span style="background:var(--bg-card);border:1px solid var(--border);border-radius:20px;padding:4px 12px;font-size:0.78rem;cursor:pointer"
          onclick="allerVersRecette('${r.id}')">
          ${r.nom}
        </span>
      `).join('')}
</div>
  `;
}

async function copierLienSession(url, btn) {
  await navigator.clipboard.writeText(url);
  const texteOriginal = btn.textContent;
  btn.textContent = '✅ Copié !';
  setTimeout(() => { btn.textContent = texteOriginal; }, 1500);
}

let realtimeSession = null;

function abonnerRealtimeSession(session) {
  if (realtimeSession) realtimeSession.unsubscribe();
  realtimeSession = db.channel('session-invites-' + session.token)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'sessions_invites',
      filter: `nom_session=eq.${session.nom_session}`
    }, payload => {
      chargerInvitesSession(session);
    })
    .subscribe();
  chargerInvitesSession(session);
}

async function chargerInvitesSession(session) {
  const { data: invites } = await db.from('sessions_invites')
    .select('*')
    .eq('user_id', currentUser.id)
    .eq('is_master', false)
    .eq('nom_session', session.nom_session);

  renderInvitesListe(invites || [], session);
}
function scorerRecettesPourProfil(profil, recettesCandidates) {
  const axes = ['sucre','amer','acide','fruite','fume','floral','epice','cremeux'];
  return recettesCandidates.map(r => {
    let score = 0, total = 0;
    axes.forEach(a => {
      const rv = r[`gout_${a}`] || 0;
      const pv = profil?.[a] || 0;
      if (rv > 0 || pv > 0) { score += Math.max(0, 5 - Math.abs(rv - pv)); total += 5; }
    });
    return { ...r, matchScore: total > 0 ? Math.round((score / total) * 100) : 50 };
  }).sort((a, b) => b.matchScore - a.matchScore);
}
function ouvrirAssignationCocktail(inviteId) {
  const invite = sessionActive?.invites?.find(i => i.id === inviteId) ||
    { id: inviteId }; // fallback si non trouvé localement, on relit en base au besoin

  db.from('sessions_invites').select('*').eq('id', inviteId).single().then(({ data: inv }) => {
    if (!inv) return;

    const candidats = recettes.filter(r =>
      r.type === 'cocktail' && sessionActive?.recettes_disponibles?.includes(r.id)
    );
    const scored = scorerRecettesPourProfil(inv.profil_gustatif, candidats);

const modal = document.createElement('div');
    modal.id = 'modal-assignation-cocktail';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.9);z-index:10000;display:flex;align-items:center;justify-content:center;padding:20px';
    modal.innerHTML = `
      <div style="background:var(--bg-card);border-radius:16px;padding:20px;max-width:420px;width:100%;max-height:80vh;overflow-y:auto">
        <div style="font-size:1rem;font-weight:700;margin-bottom:4px">🎁 Choisir pour ${inv.nom_invite || 'cet invité'}</div>
        <div style="font-size:0.78rem;color:var(--text-muted);margin-bottom:14px">Classé selon son profil gustatif</div>
        ${scored.map(r => {
          const vp = calculerVerresPossibles(r);
          const stockOk = !vp || vp.max > 0;
          return `<div class="item-alias-choix" style="padding:10px 12px;border-bottom:1px solid var(--border);${!stockOk ? 'opacity:0.4' : 'cursor:pointer'}"
            ${stockOk ? `onclick="assignerCocktailInvite('${inv.id}', '${r.id}')"` : ''}>
            <div style="display:flex;justify-content:space-between;align-items:center">
              <span style="font-weight:600">${r.nom}</span>
              <span style="color:var(--text-accent);font-size:0.8rem">${r.matchScore}% match</span>
            </div>
            <div style="font-size:0.75rem;color:${stockOk ? 'var(--text-muted)' : 'var(--text-danger)'};margin-top:2px">
              ${vp ? `🍸 ${vp.max} verre${vp.max > 1 ? 's' : ''} possible${vp.max > 1 ? 's' : ''}` : 'Stock non suivi'}
            </div>
          </div>`;
        }).join('')}
        <button class="btn-outline" style="width:100%;margin-top:14px" onclick="this.closest('div[style*=fixed]').remove()">Annuler</button>
      </div>
    `;
    document.body.appendChild(modal);
  });
}

async function assignerCocktailInvite(inviteId, recetteId) {
  await db.from('sessions_invites').update({ recette_id: recetteId, statut: 'recette_choisie' }).eq('id', inviteId);

  const inviteLocal = sessionActive?.invites?.find(i => i.id === inviteId);
  if (inviteLocal) {
    inviteLocal.recette_id = recetteId;
    inviteLocal.statut = 'recette_choisie';
  }

  // Réserve immédiatement 1 portion — un décrément réel se fera au marquerRealisee
  // le jour J, mais on protège tout de suite les assignations suivantes du même sondage.
  const recette = recettes.find(r => r.id === recetteId);
  if (recette && sessionActive) {
    for (const ing of (recette.ingredients || [])) {
      if (!ing.item_cave_id || !ing.quantite || ing.optionnel) continue;
      if (ing.unite !== 'cl' && ing.unite !== 'ml') continue;
      const qteCl = ing.unite === 'ml' ? ing.quantite / 10 : ing.quantite;
await db.from('stock_reserve').insert({
        id: 'reserve-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5),
        user_id: currentUser.id,
        item_id: ing.item_cave_id,
        soiree_menu_id: null,
        cl_reserve: qteCl,
        date_evenement: new Date().toISOString().slice(0, 10)
      });
    }
    await chargerStockReserve();
  }

document.getElementById('modal-assignation-cocktail')?.remove();
  renderInvitesListe(sessionActive?.invites || [], sessionActive);
  alert(`✅ "${recette?.nom}" assigné !`);
}
function renderInvitesListe(invites, session) {
  const liste = document.getElementById('session-invites-liste');
  if (!liste) return;

  if (invites.length === 0) {
    liste.innerHTML = '<div style="font-size:0.85rem;opacity:0.4;text-align:center;padding:1rem">En attente d\'invités…</div>';
    return;
  }

  const nbRepondu = invites.filter(i => i.defi_reussi !== null && i.defi_reussi !== undefined).length;
  const nbTrouve = invites.filter(i => i.defi_reussi === true).length;
  const resume = nbRepondu > 0
    ? `<div style="font-size:0.78rem;color:var(--text-accent);margin-bottom:10px;text-align:center">🎯 ${nbRepondu}/${invites.length} ont relevé le défi — ${nbTrouve} ont trouvé</div>`
    : '';

  liste.innerHTML = resume + invites.map(inv => {
    const profil = inv.profil_gustatif || {};
    const axes = Object.entries(profil).filter(([k, v]) => v > 0).map(([k, v]) => k).join(' · ') || '—';
    const recette = inv.recette_id ? recettes.find(r => r.id === inv.recette_id)?.nom || inv.recette_id : '—';

    let badgeDefi = '';
    if (inv.defi_reussi === true) badgeDefi = `<span style="font-size:0.72rem;color:var(--text-success)">🎯 ✅ Trouvé</span>`;
    else if (inv.defi_reussi === false) badgeDefi = `<span style="font-size:0.72rem;color:var(--text-muted)">🎯 ❌ Pas trouvé</span>`;

    return `
      <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:10px;padding:14px;margin-bottom:10px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
          <div style="font-weight:600">${inv.nom_invite || 'Invité'}</div>
          <span style="font-size:0.75rem;opacity:0.5">${inv.choix_type === 'seb' ? '✨ Laisse Seb choisir' : '🍸 A choisi'}</span>
        </div>
        <div style="font-size:0.78rem;opacity:0.5;margin-bottom:8px">Profil : ${axes}</div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
          <div style="font-size:0.82rem">Cocktail : <strong>${recette}</strong></div>
          ${badgeDefi}
        </div>
        <div style="display:flex;gap:8px">
          <button class="btn-primary" style="flex:1;font-size:0.78rem" 
            onclick="lancerJeu('${inv.id}', 'degustation')">🍸 Dégustation</button>
          <button class="btn-primary" style="flex:1;font-size:0.78rem;background:transparent;border:1px solid var(--border)" 
            onclick="lancerJeu('${inv.id}', 'devine')">🔍 Devine</button>
        </div>
        ${inv.recette_id ? `
        <button style="width:100%;margin-top:8px;padding:8px;border-radius:8px;border:1px solid var(--accent);background:transparent;color:var(--accent);cursor:pointer;font-size:0.82rem"
          onclick="allerVersRecette('${inv.recette_id}')">→ Voir la recette</button>
        ` : ''}
      </div>
    `;
  }).join('');
}
async function lancerJeu(inviteId, jeu) {
  await db.from('sessions_invites')
    .update({ jeu_actif: jeu })
    .eq('id', inviteId);
}



function allerVersRecette(id) {
  document.getElementById('modal-session-active').classList.remove('visible');
  document.querySelectorAll('nav button').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-section').forEach(s => s.classList.add('hidden'));
  document.querySelector('nav button[data-tab="recettes"]').classList.add('active');
  document.getElementById('section-recettes').classList.remove('hidden');
  sectionRecette = 'cocktail';
  ouvrirFicheRecette(id);
}

let sessionActive = null;
// =============================================
// RECHARGEMENT ANECDOTE / CONSEIL
// =============================================
 
async function rechargerAnecdote() {
  const btn = document.querySelector('[onclick="rechargerAnecdote()"]');
  if (btn) btn.style.opacity = '0.4';
  const { data } = await db.from('anecdotes').select('*');
  const el = document.getElementById('dash-anecdote-texte');
  if (el && data?.length) el.textContent = data[Math.floor(Math.random() * data.length)].texte;
  if (btn) btn.style.opacity = '1';
}

async function rechargerConseil() {
  const btn = document.querySelector('[onclick="rechargerConseil()"]');
  if (btn) btn.style.opacity = '0.4';
  const { data } = await db.from('conseils').select('*');
  const el = document.getElementById('dash-conseil-texte');
  if (el && data?.length) {
    const item = data[Math.floor(Math.random() * data.length)];
    el.textContent = item.texte;
  }
  if (btn) btn.style.opacity = '1';
}
let filtreHerboFamille = '';
let filtreHerboUsage = '';
let plantesList = [];
let plantesOuverte = null;

async function chargerHerboristerie() {
  const container = document.getElementById('herboristerie-container');
  if (!container) return;
  container.innerHTML = '<div class="loading-state">Chargement…</div>';
  const { data: plantes } = await db.from('plantes').select('*').order('nom');
  if (!plantes) return;
  plantesList = plantes;
  renderHerboristerie(plantes);
}

function renderHerboristerie(plantes) {
  const container = document.getElementById('herboristerie-container');
  if (!container) return;
  const familles = [...new Set(plantes.map(p => p.famille).filter(Boolean))];
  const usages   = [...new Set(plantes.flatMap(p => p.usages_bar || []))].sort();
  let liste = plantes;
  if (filtreHerboFamille) liste = liste.filter(p => p.famille === filtreHerboFamille);
  if (filtreHerboUsage)   liste = liste.filter(p => p.usages_bar?.includes(filtreHerboUsage));
  const familleLabel = { aromatique: 'Aromatiques', fleur: 'Fleurs', epice: 'Épices', agrume: 'Agrumes', autre: 'Autres' };
  const usageLabel   = { decoration: 'Déco', infusion: 'Infusion', maceration: 'Macération', sirop: 'Sirop', muddle: 'Muddle', zeste: 'Zeste' };
  container.innerHTML = `
    <div class="herbo-filtres">
      <button class="herbo-filtre-btn ${!filtreHerboFamille && !filtreHerboUsage ? 'active' : ''}"
        onclick="filtreHerboFamille=''; filtreHerboUsage=''; renderHerboristerie(plantesList)">Toutes</button>
      ${familles.map(f => `
        <button class="herbo-filtre-btn ${filtreHerboFamille === f ? 'active' : ''}"
          onclick="filtreHerboFamille='${f}'; filtreHerboUsage=''; renderHerboristerie(plantesList)">
          ${familleLabel[f] || f}
        </button>`).join('')}
      <span class="herbo-filtre-sep">|</span>
      ${usages.map(u => `
        <button class="herbo-filtre-btn herbo-filtre-usage ${filtreHerboUsage === u ? 'active' : ''}"
          onclick="filtreHerboUsage='${u}'; filtreHerboFamille=''; renderHerboristerie(plantesList)">
          ${usageLabel[u] || u}
        </button>`).join('')}
    </div>
    <div class="herbo-grille">
      ${liste.length === 0 ? '<div class="empty-state">Aucune plante trouvée.</div>' : ''}
      ${liste.map(p => renderCartePlante(p)).join('')}
    </div>
  `;
}

function switchSousOngletConc(panel, btn) {
  document.querySelectorAll('.conc-sous-onglet').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('conc-panel-en-cours').style.display = panel === 'en-cours' ? '' : 'none';
  document.getElementById('conc-panel-grimoire').style.display = panel === 'grimoire' ? '' : 'none';
  document.getElementById('conc-panel-lexique').style.display = panel === 'lexique' ? '' : 'none';
  if (panel === 'lexique') chargerLexiqueConc();
  if (panel === 'grimoire') chargerGrimoire();
}

// =============================================
// CARTE PLANTE
// =============================================
// =============================================
// INSPIRATIONS
// =============================================

let inspirationsList = [];
let inspiSourceActive = 'manuel';
// Technique suggérée par défaut quand rien n'est visible sur le screenshot —
// même logique qu'Alexis applique ailleurs : shake si agrumes/œuf/lactés, sinon stir.
function suggererTechniqueParDefaut(ingredients) {
  const noms = (ingredients || []).map(i => (i.nom || '').toLowerCase()).join(' ');
  const aAgrumesOuTexture = /citron|lime|orange|pamplemousse|œuf|oeuf|creme|cream|lait|milk|ananas|pineapple/.test(noms);
  const aSodaOuTonic = /soda|tonic|ginger|eau gazeuse|champagne|prosecco|club soda/.test(noms);

  if (aSodaOuTonic) return 'Suggestion : construction directe dans le verre, sur glace (à vérifier — non lu sur l\'image).';
  if (aAgrumesOuTexture) return 'Suggestion : shaker avec glace 10-15 secondes, puis filtrer (à vérifier — non lu sur l\'image).';
  return 'Suggestion : mélanger au verre à mélange (stir) 30 secondes, puis filtrer (à vérifier — non lu sur l\'image).';
}
async function analyserScreenshot(input) {
  const file = input.files[0];
  if (!file) return;

  const btn = document.querySelector('[onclick*="screenshot-input"]');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Analyse…'; }

  try {
    // Compression côté client (même pattern que réalisations/concoctions)
    const blob = await new Promise((resolve) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const max = 1280;
        let w = img.width, h = img.height;
        if (w > max) { h = Math.round(h * max / w); w = max; }
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        canvas.toBlob(b => { resolve(b); URL.revokeObjectURL(url); }, 'image/jpeg', 0.85);
      };
      img.src = url;
    });

    const base64 = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = e => resolve(e.target.result.split(',')[1]);
      reader.readAsDataURL(blob);
    });

    // Upload du screenshot dans le même bucket que les autres photos d'inspiration —
    // permet de revérifier visuellement ce que l'IA a lu, en cas de doute.
    let photo_url = null;
    const path = `inspirations/${currentUser.id}/${Date.now()}.jpg`;
    const { error: uploadError } = await db.storage.from('photos-inspirations').upload(path, blob, { upsert: true, contentType: 'image/jpeg' });
    if (!uploadError) {
      const { data: urlData } = db.storage.from('photos-inspirations').getPublicUrl(path);
      photo_url = urlData.publicUrl;
    }

    const res = await fetch('/api/lire-recette', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image_base64: base64 })
    });
    const data = await res.json();

    if (data.error) { alert('Erreur : ' + data.error); return; }

    const recettesTrouvees = data.recettes || [];
    if (recettesTrouvees.length === 0) {
      alert('Aucune recette lisible sur ce screenshot.');
      return;
    }

    for (const r of recettesTrouvees) {
      await db.from('inspirations').insert({
        id: 'screenshot-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5),
        user_id: currentUser.id,
        nom: r.nom || 'Cocktail screenshot',
        source: 'photo',
        source_detail: 'Screenshot',
        photo_url,
        ingredients: r.ingredients || [],
        statut: 'en_attente',
        notes: JSON.stringify({
          type: 'cocktail',
          verre: r.verre || null,
          garniture: r.garniture || null,
          methode: (r.methode && r.methode.length) ? r.methode : suggererTechniqueParDefaut(r.ingredients),
          methode_source: (r.methode && r.methode.length) ? 'lue sur l\'image' : 'suggérée par défaut',
          complements: r.complements || null,
          base_alcool: r.base_alcool || null,
          origine: 'Importé via screenshot'
        })
      });
    }

    await chargerInspirations();
    alert(recettesTrouvees.length === 1
      ? '✅ Recette "' + (recettesTrouvees[0].nom || 'Cocktail') + '" ajoutée dans Inspirations !'
      : `✅ ${recettesTrouvees.length} recettes ajoutées dans Inspirations !`);

  } catch (e) {
    alert('Erreur réseau : ' + e.message);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '📷 Screenshot recette'; }
    input.value = '';
  }
}
async function chargerInspirations() {
  const container = document.getElementById('inspirations-container');
  if (!container) return;
  container.innerHTML = '<div class="loading-state">Chargement…</div>';
  const { data } = await db.from('inspirations').select('*').order('created_at', { ascending: false });
  inspirationsList = data || [];
  renderInspirations();
}

let inspirationsSelectionRejetees = new Set();

function renderInspirations() {
  const container = document.getElementById('inspirations-container');
  if (!container) return;

  const enAttente = inspirationsList.filter(i => i.statut === 'en_attente');
  const validees = inspirationsList.filter(i => i.statut === 'validee');
  const rejetees = inspirationsList.filter(i => i.statut === 'rejetee');

container.innerHTML = `
<div style="padding:1rem;display:flex;justify-content:flex-end;gap:8px;flex-wrap:wrap">
  <button class="btn-outline" onclick="captureRapideBartender()">📱 Dévoile ton cocktail</button>
  <button class="btn-outline" onclick="ouvrirLaTournee()">🍹 La Tournée</button>
<button class="btn-outline" onclick="ouvrirImportURL()">🔗 Importer URL</button>
  <button class="btn-outline" onclick="ouvrirRechercheIngredients()">🎯 Chercher par ingrédients</button>
  <button class="btn-outline" onclick="document.getElementById('screenshot-input').click()">📷 Screenshot recette</button>
  <input type="file" id="screenshot-input" accept="image/*" style="display:none" onchange="analyserScreenshot(this)">
  <button class="btn-primary" onclick="afficherModal('modal-ajout-inspiration')">+ Ajouter</button>
</div>

    ${enAttente.length > 0 ? `
    <div class="conc-section">
      <h3 class="conc-section-titre">⏳ En attente (${enAttente.length})</h3>
      <div class="herbo-grille">
        ${enAttente.map(i => renderCarteInspiration(i)).join('')}
      </div>
    </div>` : ''}

    ${validees.length > 0 ? `
    <div class="conc-section">
      <h3 class="conc-section-titre">✅ Validées (${validees.length})</h3>
      <div class="herbo-grille">
        ${validees.map(i => renderCarteInspiration(i)).join('')}
      </div>
    </div>` : ''}

    ${rejetees.length > 0 ? `
    <div class="conc-section">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
        <h3 class="conc-section-titre">❌ Rejetées (${rejetees.length})</h3>
        ${inspirationsSelectionRejetees.size > 0 ? `
        <button class="btn-outline" style="color:var(--text-danger);border-color:var(--border-danger)" onclick="supprimerInspirationsSelectionnees()">
          🗑 Supprimer la sélection (${inspirationsSelectionRejetees.size})
        </button>` : ''}
      </div>
      <div class="herbo-grille">
        ${rejetees.map(i => renderCarteInspiration(i, true)).join('')}
      </div>
    </div>` : ''}

    ${inspirationsList.length === 0 ? `
    <div class="empty-state">
      <div class="empty-state-icon">💡</div>
      <div>Aucune inspiration enregistrée.</div>
      <div style="font-size:0.82rem;color:var(--text-secondary);margin-top:6px">Ajoutez des recettes croisées en déplacement.</div>
    </div>` : ''}
  `;
}

function toggleSelectionInspirationRejetee(id, event) {
  event.stopPropagation();
  if (inspirationsSelectionRejetees.has(id)) inspirationsSelectionRejetees.delete(id);
  else inspirationsSelectionRejetees.add(id);
  renderInspirations();
}

async function supprimerInspirationsSelectionnees() {
  const ids = Array.from(inspirationsSelectionRejetees);
  if (!ids.length) return;
  if (!confirm(`Supprimer définitivement ${ids.length} inspiration${ids.length > 1 ? 's' : ''} rejetée${ids.length > 1 ? 's' : ''} ? Cette action est irréversible.`)) return;

  const { error } = await db.from('inspirations').delete().in('id', ids).eq('user_id', currentUser.id);
  if (error) { alert('Erreur : ' + error.message); return; }

  inspirationsList = inspirationsList.filter(x => !ids.includes(x.id));
  inspirationsSelectionRejetees.clear();
  renderInspirations();
}
async function captureRapideBartender() {
  const now = new Date();
  const nom = `Cocktail du ${now.toLocaleDateString('fr-FR')} ${now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
  const id = 'inspi-' + Date.now();

  const { data, error } = await db.from('inspirations').insert({
    id,
    user_id: currentUser.id,
    nom,
    source: 'manuel',
    source_detail: 'Capture rapide bar',
    ingredients: [],
    tags: [],
    statut: 'en_attente'
  }).select().single();

  if (error || !data) { alert('Erreur : ' + (error?.message || 'inconnue')); return; }

  inspirationsList.unshift(data);
  renderInspirations();
  ouvrirQRBartender(data.id);
}
function ouvrirLaTournee() {
  const url = window.location.origin + '/tournee.html';
  const modal = document.createElement('div');
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:10000;display:flex;align-items:center;justify-content:center;padding:24px;';
  modal.innerHTML = `
    <div style="background:var(--bg-card);border-radius:16px;padding:24px;max-width:360px;width:100%;text-align:center;">
      <div style="font-size:1.3rem;font-weight:700;margin-bottom:6px;">🍹 La Tournée</div>
      <div style="font-size:0.85rem;color:var(--text-secondary);margin-bottom:20px;">Partage ce lien ou ce QR code à tes amis pour qu'ils t'envoient leurs recettes.</div>
      <div id="qr-tournee" style="display:inline-block;border-radius:8px;overflow:hidden;margin-bottom:16px;"></div>
      <div style="font-size:0.75rem;color:var(--text-muted);word-break:break-all;margin-bottom:16px;">${url}</div>
      <div style="display:flex;gap:8px;margin-bottom:8px;">
        <button id="btn-copier-tournee" style="flex:1;padding:10px;border-radius:8px;border:1px solid var(--border);background:var(--bg);color:var(--text-primary);cursor:pointer;font-size:0.85rem;">
          📋 Copier le lien
        </button>
        <button id="btn-partager-tournee" style="flex:1;padding:10px;border-radius:8px;border:none;background:var(--accent);color:#000;cursor:pointer;font-size:0.85rem;font-weight:600;">
          📤 Partager
        </button>
      </div>
      <button id="btn-fermer-tournee" style="width:100%;padding:10px;border-radius:8px;border:1px solid var(--border);background:none;color:var(--text-muted);cursor:pointer;font-size:0.85rem;">
        Fermer
      </button>
    </div>
  `;
  document.body.appendChild(modal);

  // Events
  document.getElementById('btn-copier-tournee').onclick = () => {
    navigator.clipboard.writeText(url).then(() => alert('✅ Lien copié !'));
  };
  document.getElementById('btn-partager-tournee').onclick = () => {
    if (navigator.share) navigator.share({ title: 'La Tournée', url });
    else navigator.clipboard.writeText(url).then(() => alert('✅ Lien copié !'));
  };
  document.getElementById('btn-fermer-tournee').onclick = () => modal.remove();

  // QR Code
  if (typeof QRCode !== 'undefined') {
    new QRCode(document.getElementById('qr-tournee'), {
      text: url, width: 200, height: 200,
      colorDark: '#000000', colorLight: '#ffffff'
    });
  }
}
 // Liste toutes les bouteilles de la cave (normale ou voyage), dédoublonnées
function listeToutesLesBouteilles() {
  const bouteilles = voyageActif
    ? voyageBouteillesActives
    : cave?.categories?.flatMap(c => c.items).filter(i => i.detenu !== false) || [];
  const vues = new Set();
  return bouteilles
    .map(b => ({ id: voyageActif ? b.item_cave_id : b.id, nom: b.nom }))
    .filter(ing => { if (vues.has(ing.id)) return false; vues.add(ing.id); return true; })
    .sort((a, b) => a.nom.localeCompare(b.nom));
}

let rechercheIngredientsSelection = [];

// Ouvre le sélecteur d'ingrédients pour chercher une vraie recette en ligne
function ouvrirRechercheIngredients() {
  rechercheIngredientsSelection = [];
  const bouteilles = listeToutesLesBouteilles();
  const modal = document.createElement('div');
  modal.id = 'modal-recherche-ingredients';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:10500;display:flex;align-items:center;justify-content:center;padding:20px';
  modal.innerHTML = `
    <div style="max-width:420px;width:100%;background:var(--bg-card);border-radius:16px;padding:20px;max-height:85vh;display:flex;flex-direction:column">
      <div style="font-size:1rem;font-weight:700;margin-bottom:4px">🎯 Chercher une recette existante</div>
      <div style="font-size:0.8rem;color:var(--text-secondary);margin-bottom:12px">Choisis au moins 2 ingrédients à combiner${voyageActif ? ' (cave voyage)' : ''} — on cherche une vraie recette publiée qui les utilise ensemble.</div>
      <input type="text" placeholder="🔍 Rechercher…" oninput="filtrerListeRechercheIngredients(this.value)"
        style="width:100%;padding:10px 12px;border-radius:8px;border:1px solid var(--border);background:var(--bg);color:var(--text-primary);font-size:0.85rem;margin-bottom:10px">
      <div id="liste-recherche-ingredients" style="overflow-y:auto;flex:1;margin-bottom:14px">
        ${bouteilles.map(ing => `
          <label style="display:flex;align-items:center;gap:8px;padding:8px 4px;font-size:0.85rem;cursor:pointer" data-nom="${ing.nom.toLowerCase()}">
            <input type="checkbox" value="${ing.nom}" onchange="toggleIngredientRecherche('${ing.nom.replace(/'/g, "\\'")}')">
            ${ing.nom}
          </label>
        `).join('')}
      </div>
      <div style="display:flex;gap:8px">
        <button class="btn-outline" style="flex:1" onclick="document.getElementById('modal-recherche-ingredients').remove()">Annuler</button>
        <button class="btn-primary" style="flex:1" id="btn-lancer-recherche" disabled onclick="lancerRechercheIngredients()">🔍 Chercher</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}

function toggleIngredientRecherche(nom) {
  const index = rechercheIngredientsSelection.indexOf(nom);
  if (index === -1) rechercheIngredientsSelection.push(nom);
  else rechercheIngredientsSelection.splice(index, 1);
  document.getElementById('btn-lancer-recherche').disabled = rechercheIngredientsSelection.length < 2;
}

function filtrerListeRechercheIngredients(texte) {
  const t = texte.toLowerCase();
  document.querySelectorAll('#liste-recherche-ingredients label').forEach(el => {
    el.style.display = el.dataset.nom.includes(t) ? 'flex' : 'none';
  });
}

async function lancerRechercheIngredients() {
  const btn = document.getElementById('btn-lancer-recherche');
  btn.disabled = true; btn.textContent = '⏳ Recherche…';

  const response = await fetch('/api/chercher-url-recette', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ingredients: rechercheIngredientsSelection })
  });
  const result = await response.json();

  document.getElementById('modal-recherche-ingredients')?.remove();

  if (!result.success || result.resultats.length === 0) {
    alert('Aucune recette trouvée combinant ces ingrédients.');
    return;
  }

  afficherResultatsRechercheIngredients(result.resultats);
}

function afficherResultatsRechercheIngredients(resultats) {
  const modal = document.createElement('div');
  modal.id = 'modal-resultats-recherche';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:10500;display:flex;align-items:center;justify-content:center;padding:20px';
  modal.innerHTML = `
    <div style="max-width:480px;width:100%;background:var(--bg-card);border-radius:16px;padding:20px;max-height:85vh;overflow-y:auto">
      <div style="font-size:1rem;font-weight:700;margin-bottom:14px">Pages trouvées — choisis celle à analyser</div>
      ${resultats.map(r => `
        <div style="background:var(--bg);border:1px solid var(--border);border-radius:10px;padding:12px;margin-bottom:10px;cursor:pointer"
          onclick="importerDepuisResultatRecherche('${r.url.replace(/'/g, "\\'")}')">
          <div style="font-weight:600;font-size:0.88rem;margin-bottom:4px">${r.titre}</div>
          <div style="font-size:0.75rem;color:var(--text-muted)">${r.extrait}...</div>
        </div>
      `).join('')}
      <button class="btn-outline" style="width:100%;margin-top:8px" onclick="document.getElementById('modal-resultats-recherche').remove()">Annuler</button>
    </div>
  `;
  document.body.appendChild(modal);
}

// Réutilise le pipeline d'extraction déjà existant (api/tavily.js) sur l'URL choisie
async function importerDepuisResultatRecherche(url) {
  document.getElementById('modal-resultats-recherche')?.remove();
  const loadingModal = document.createElement('div');
  loadingModal.id = 'modal-loading-extraction';
  loadingModal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:10500;display:flex;align-items:center;justify-content:center';
  loadingModal.innerHTML = `<div style="color:var(--text-primary)">⏳ Analyse de la page…</div>`;
  document.body.appendChild(loadingModal);

  try {
    const res = await fetch('/api/tavily', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url })
    });
    const data = await res.json();
    document.getElementById('modal-loading-extraction')?.remove();

    if (data.error) { alert('Erreur : ' + data.error); return; }
    if (!data.recettes || data.recettes.length === 0) { alert('Aucune recette détectée sur cette page.'); return; }

    ouvrirModalImportRecettes(data.recettes, url, data._meta?.images || []);
  } catch (e) {
    document.getElementById('modal-loading-extraction')?.remove();
    alert('Erreur réseau : ' + e.message);
  }
}
async function ouvrirImportURL() {
  const url = prompt('Colle l\'URL de la page à scraper (ex: https://disaronno.com/fr/mix-with-style/)');
  if (!url) return;

  const btn = document.querySelector('[onclick="ouvrirImportURL()"]');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Analyse…'; }

  try {
    const res = await fetch('/api/tavily', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url })
    });
    const data = await res.json();

    if (data.error) { alert('Erreur : ' + data.error); return; }
    if (!data.recettes || data.recettes.length === 0) { alert('Aucune recette détectée sur cette page.'); return; }

    // Afficher les recettes détectées dans un modal
   ouvrirModalImportRecettes(data.recettes, url, data._meta?.images || []);

  } catch(e) {
    alert('Erreur réseau : ' + e.message);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '🔗 Importer URL'; }
  }
}

function ouvrirModalImportRecettes(recettes, urlSource, images = []) {
  const existing = document.getElementById('modal-import-recettes');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'modal-import-recettes';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:10000;display:flex;align-items:center;justify-content:center;padding:24px;overflow-y:auto;';
  modal.innerHTML = `
    <div style="background:var(--bg-card);border-radius:16px;padding:24px;max-width:520px;width:100%;max-height:80vh;overflow-y:auto;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
        <div style="font-size:1.1rem;font-weight:700">${recettes.length} recette${recettes.length > 1 ? 's' : ''} détectée${recettes.length > 1 ? 's' : ''}</div>
        <button onclick="document.getElementById('modal-import-recettes').remove()" style="background:none;border:none;color:var(--text-muted);font-size:1.2rem;cursor:pointer">✕</button>
      </div>
      <div style="font-size:0.78rem;color:var(--text-muted);margin-bottom:16px;word-break:break-all">${urlSource}</div>

      ${images.length > 0 ? `
      <div style="margin-bottom:16px">
        <div style="font-size:0.78rem;color:var(--text-secondary);margin-bottom:8px">📷 Choisis une photo pour ces recettes (optionnel) :</div>
        <div style="display:flex;gap:8px;overflow-x:auto;padding-bottom:4px">
          ${images.map((img, i) => `
            <img src="${img}" id="import-img-${i}" onclick="choisirPhotoImport('${img.replace(/'/g, "\\'")}', ${i})"
              style="width:80px;height:80px;object-fit:cover;border-radius:8px;border:2px solid var(--border);cursor:pointer;flex-shrink:0">
          `).join('')}
        </div>
      </div>` : ''}

      <div style="margin-bottom:16px">
        <div style="font-size:0.75rem;color:var(--text-muted);margin-bottom:6px">${images.length > 0 ? 'Pas la bonne photo ?' : 'Aucune photo détectée automatiquement.'} Colle une URL d'image à la place :</div>
        <input type="text" id="import-photo-manuelle" placeholder="https://..." style="width:100%;font-size:0.8rem" onchange="majPhotoManuelle(this)">
      </div>

      <div style="display:flex;flex-direction:column;gap:10px">
        ${recettes.map((r, i) => `
          <div style="background:var(--bg);border:1px solid var(--border);border-radius:10px;padding:12px;">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">
              <div style="font-weight:600;font-size:0.9rem">${r.nom}</div>
             <button onclick="importerRecette(${i}, this)" 
  style="background:var(--accent);color:#000;border:none;border-radius:6px;padding:4px 10px;font-size:0.78rem;font-weight:600;cursor:pointer;white-space:nowrap;margin-left:8px">
  + Importer
</button>
            </div>
            <div style="font-size:0.78rem;color:var(--text-secondary)">
              ${r.ingredients?.slice(0,4).map(ing => `${ing.quantite || ''}${ing.unite || ''} ${ing.nom}`).join(' · ')}${r.ingredients?.length > 4 ? ` +${r.ingredients.length - 4}` : ''}
            </div>
            ${r.verre ? `<div style="font-size:0.75rem;color:var(--text-muted);margin-top:4px">🥃 ${r.verre}</div>` : ''}
          </div>
        `).join('')}
      </div>
      <button onclick="importerToutesRecettes(${recettes.length})" 
        style="width:100%;margin-top:16px;padding:12px;border-radius:8px;border:1px solid var(--border);background:none;color:var(--text-primary);cursor:pointer;font-size:0.85rem;">
        ✅ Importer toutes les recettes
      </button>
    </div>
  `;
  document.body.appendChild(modal);

  // Stocker les recettes pour l'import
  window._recettesImport = recettes;
  window._urlImport = urlSource;
  window._photoImportChoisie = null;
}

function choisirPhotoImport(url, index) {
  window._photoImportChoisie = (window._photoImportChoisie === url) ? null : url;
  document.querySelectorAll('[id^="import-img-"]').forEach((el, i) => {
    el.style.borderColor = (window._photoImportChoisie && i === index) ? 'var(--accent)' : 'var(--border)';
  });
  const champManuel = document.getElementById('import-photo-manuelle');
  if (champManuel) champManuel.value = '';
}

function majPhotoManuelle(input) {
  window._photoImportChoisie = input.value.trim() || null;
  document.querySelectorAll('[id^="import-img-"]').forEach(el => { el.style.borderColor = 'var(--border)'; });
}

async function importerRecette(index, btn) {
  if (btn) { btn.disabled = true; btn.textContent = '⏳'; }
  await _creerInspirationDepuisImport(window._recettesImport[index]);
  if (btn) { btn.textContent = '✅'; btn.style.background = 'var(--bg-success)'; btn.style.color = 'var(--text-success)'; }
  await chargerInspirations();
}

async function importerToutesRecettes(total) {
  for (let i = 0; i < total; i++) {
    await _creerInspirationDepuisImport(window._recettesImport[i]);
  }
  document.getElementById('modal-import-recettes')?.remove();
  await chargerInspirations();
  alert(`✅ ${total} recettes importées dans Inspirations !`);
}

async function _creerInspirationDepuisImport(r) {
  const domaine = new URL(window._urlImport).hostname.replace('www.', '');
  await db.from('inspirations').insert({
    id: 'import-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5),
    user_id: currentUser.id,
    nom: r.nom,
    source: 'url',
    source_detail: domaine,
    photo_url: window._photoImportChoisie || null,
    ingredients: r.ingredients || [],
    statut: 'en_attente',
    notes: JSON.stringify({
      type: 'cocktail',
      verre: r.verre || null,
      garniture: r.garniture || null,
      methode: r.methode || null,
      complements: r.complements || null,
     base_alcool: r.base_alcool || null
    })
  });
}
function renderCarteInspiration(inspi, avecCheckbox = false) {
  const ings = Array.isArray(inspi.ingredients) ? inspi.ingredients : [];
  const tags = inspi.tags || [];
  const dateStr = new Date(inspi.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
  const sourceIcon = { manuel: '✍️', photo: '📷', url: '🔗', tournee: '🍻' };

  // Parser les notes La Tournée
  let notesTournee = {};
  if (inspi.source === 'tournee' && inspi.notes) {
    try { notesTournee = JSON.parse(inspi.notes); } catch(e) {}
  }

const coche = inspirationsSelectionRejetees.has(inspi.id);
  return `
    <div class="herbo-carte" style="position:relative" onclick="ouvrirFicheInspiration('${inspi.id}')">
      ${avecCheckbox ? `
      <input type="checkbox" ${coche ? 'checked' : ''} onclick="toggleSelectionInspirationRejetee('${inspi.id}', event)"
        style="position:absolute;top:8px;right:8px;width:20px;height:20px;z-index:2;cursor:pointer">
      ` : ''}
${(() => {
        if (!inspi.photo_url) return '';
        const c = inspi.photo_cadrage || { zoom: 1, x: 0, y: 0 };
        return `<div style="position:relative;width:100%;height:120px;overflow:hidden;border-radius:8px;background:#000;margin-bottom:8px">
          <img src="${inspi.photo_url}" style="position:absolute;top:50%;left:50%;width:100%;height:auto;max-width:none;
          transform:translate(calc(-50% + ${c.x}%), calc(-50% + ${c.y}%)) scale(${c.zoom});">
        </div>`;
      })()}
      <div class="herbo-carte-top">
        <span class="herbo-emoji">${sourceIcon[inspi.source] || '💡'}</span>
        <div class="herbo-carte-info">
          <div class="herbo-nom">${inspi.nom}</div>
          ${inspi.source === 'tournee' && notesTournee.prenom ? 
            `<div class="herbo-latin">🍻 De ${notesTournee.prenom}</div>` : 
            inspi.source_detail ? `<div class="herbo-latin">${inspi.source_detail}</div>` : ''}
        </div>
        <span class="herbo-saison ${inspi.statut === 'en_attente' ? 'herbo-saison--off' : inspi.statut === 'validee' ? 'herbo-saison--ok' : ''}">
          ${inspi.statut === 'en_attente' ? '⏳' : inspi.statut === 'validee' ? '✅' : '❌'}
        </span>
      </div>
      ${inspi.source === 'tournee' && notesTournee.origine ? `
      <div style="font-size:0.78rem;font-style:italic;color:var(--text-muted);margin-top:6px;line-height:1.4">
        💬 "${notesTournee.origine}"
      </div>` : ''}
      ${ings.length > 0 ? `
      <div class="herbo-profil" style="margin-top:6px">
       ${ings.slice(0, 3).map(ing => {
  if (typeof ing === 'string') return ing;
  const q = ing.quantite ? ing.quantite + (ing.unite || 'cl') + ' ' : '';
  return q + ing.nom;
}).join(' · ')}
      </div>` : ''}
      <div class="herbo-usages" style="margin-top:6px">
        ${tags.map(t => `<span class="herbo-usage-tag">${t}</span>`).join('')}
        <span class="herbo-usage-tag" style="opacity:0.5">${dateStr}</span>
      </div>
      ${inspi.analyse_result ? `
      <div style="margin-top:8px;font-size:0.75rem;padding:4px 8px;border-radius:6px;background:var(--bg-accent);color:var(--text-accent)">
       ${inspi.analyse_result.type === 'nouvelle' ? '🆕 Nouvelle recette' : inspi.analyse_result.recette_similaire ? `🔄 Variante de ${inspi.analyse_result.recette_similaire}` : '🔄 Recette similaire existante'}
      </div>` : ''}
    </div>
  `;
}

function selectInspiSource(btn) {
  document.querySelectorAll('#inspi-source-btns .config-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  inspiSourceActive = btn.dataset.source;
  document.getElementById('inspi-photo-group').style.display = inspiSourceActive === 'photo' ? '' : 'none';
  document.getElementById('inspi-url-group').style.display = inspiSourceActive === 'url' ? '' : 'none';
}

async function sauverInspiration() {
  const nom = document.getElementById('inspi-nom').value.trim();
  if (!nom) return;

  const ingsRaw = document.getElementById('inspi-ingredients').value.trim();
  const ingredients = ingsRaw ? ingsRaw.split('\n').filter(Boolean).map(l => ({ nom: l.trim() })) : [];
  const tagsRaw = document.getElementById('inspi-tags').value.trim();
  const tags = tagsRaw ? tagsRaw.split(',').map(t => t.trim()).filter(Boolean) : [];

  let photo_url = null;
  const photoInput = document.getElementById('inspi-photo-input');
  if (inspiSourceActive === 'photo' && photoInput.files[0]) {
    const file = photoInput.files[0];
    const ext = file.name.split('.').pop();
    const path = `inspirations/${currentUser.id}/${Date.now()}.${ext}`;
    const { error } = await db.storage.from('photos-inspirations').upload(path, file, { upsert: true });
    if (!error) {
      const { data } = db.storage.from('photos-inspirations').getPublicUrl(path);
      photo_url = data.publicUrl;
    }
  }

  const id = 'inspi-' + Date.now();
  const { data } = await db.from('inspirations').insert({
    id,
    user_id: currentUser.id,
    nom,
    source: inspiSourceActive,
    source_detail: document.getElementById('inspi-source-detail').value.trim() || null,
    ingredients,
    tags,
    notes: document.getElementById('inspi-notes').value.trim() || null,
    photo_url,
    statut: 'en_attente'
  }).select().single();

  if (data) {
    inspirationsList.unshift(data);
    fermerModal('modal-ajout-inspiration');
    // Reset form
    document.getElementById('inspi-nom').value = '';
    document.getElementById('inspi-ingredients').value = '';
    document.getElementById('inspi-tags').value = '';
    document.getElementById('inspi-notes').value = '';
    document.getElementById('inspi-source-detail').value = '';
    renderInspirations();
  }
}
async function associerPhotoInspiration(id) {
  const input = document.getElementById(`inspi-photo-manuelle-${id}`);
  const url = input?.value?.trim();
  if (!url) { alert('Colle une URL de photo d\'abord.'); return; }

  const { error } = await db.from('inspirations').update({ photo_url: url }).eq('id', id).eq('user_id', currentUser.id);
  if (error) { alert('Erreur : ' + error.message); return; }

  const idx = inspirationsList.findIndex(x => x.id === id);
  if (idx !== -1) inspirationsList[idx].photo_url = url;

  renderInspirations();
  await ouvrirFicheInspiration(id);
}
async function sauvegarderNomInspiration(id, nouveauNom) {
  const nom = (nouveauNom || '').trim();
  const inspi = inspirationsList.find(x => x.id === id);
  if (!inspi || !nom || nom === inspi.nom) return;
  await db.from('inspirations').update({ nom }).eq('id', id).eq('user_id', currentUser.id);
  inspi.nom = nom;
  renderInspirations();
}

function ouvrirRecadragePhoto(id) {
  const inspi = inspirationsList.find(x => x.id === id);
  if (!inspi || !inspi.photo_url) return;

  let cadrage = { ...(inspi.photo_cadrage || { zoom: 1, x: 0, y: 0 }) };
  let dragging = false, startX = 0, startY = 0, startCadrageX = 0, startCadrageY = 0;

  const modal = document.createElement('div');
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.9);z-index:10000;display:flex;align-items:center;justify-content:center;padding:20px';
  modal.innerHTML = `
    <div style="background:var(--bg-card);border-radius:16px;padding:20px;max-width:420px;width:100%">
      <div style="font-size:1rem;font-weight:700;margin-bottom:4px">🎯 Ajuster le cadrage</div>
      <div style="font-size:0.78rem;color:var(--text-muted);margin-bottom:12px">Glissez la photo pour la repositionner. Le cadre gris pointillé représente les limites visibles.</div>
      <div id="cadrage-frame" style="position:relative;width:100%;height:220px;overflow:hidden;border-radius:12px;background:#000;border:2px dashed var(--border-accent);cursor:grab;touch-action:none">
        <img id="cadrage-img" src="${inspi.photo_url}" draggable="false"
          style="position:absolute;top:50%;left:50%;width:100%;height:auto;max-width:none;user-select:none;
          transform:translate(calc(-50% + ${cadrage.x}%), calc(-50% + ${cadrage.y}%)) scale(${cadrage.zoom})">
      </div>
      <div style="display:flex;align-items:center;gap:10px;margin-top:14px">
        <span style="font-size:0.8rem;color:var(--text-secondary)">🔍−</span>
        <input type="range" id="cadrage-zoom" min="30" max="250" value="${Math.round(cadrage.zoom * 100)}" style="flex:1">
        <span style="font-size:0.8rem;color:var(--text-secondary)">🔍+</span>
      </div>
      <div style="font-size:0.72rem;color:var(--text-muted);text-align:center;margin-top:2px">Zoom : ${Math.round(cadrage.zoom * 100)}% — sous 100%, des bandes noires apparaissent</div>
      <div style="display:flex;gap:8px;margin-top:16px">
        <button id="btn-cadrage-annuler" class="btn-outline" style="flex:1">Annuler</button>
        <button id="btn-cadrage-valider" class="btn-primary" style="flex:1">✅ Enregistrer</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  const frame = document.getElementById('cadrage-frame');
  const img = document.getElementById('cadrage-img');
  const zoomInput = document.getElementById('cadrage-zoom');
  const zoomLabel = modal.querySelector('div[style*="text-align:center"]');

  function appliquer() {
    img.style.transform = `translate(calc(-50% + ${cadrage.x}%), calc(-50% + ${cadrage.y}%)) scale(${cadrage.zoom})`;
    zoomLabel.textContent = `Zoom : ${Math.round(cadrage.zoom * 100)}% — sous 100%, des bandes noires apparaissent`;
  }

  zoomInput.oninput = () => {
    cadrage.zoom = zoomInput.value / 100;
    appliquer();
  };

  function pointerDown(e) {
    dragging = true;
    frame.style.cursor = 'grabbing';
    const p = e.touches ? e.touches[0] : e;
    startX = p.clientX; startY = p.clientY;
    startCadrageX = cadrage.x; startCadrageY = cadrage.y;
  }
  function pointerMove(e) {
    if (!dragging) return;
    const p = e.touches ? e.touches[0] : e;
    const rect = frame.getBoundingClientRect();
    const dx = ((p.clientX - startX) / rect.width) * 100;
    const dy = ((p.clientY - startY) / rect.height) * 100;
    cadrage.x = startCadrageX + dx;
    cadrage.y = startCadrageY + dy;
    appliquer();
  }
  function pointerUp() { dragging = false; frame.style.cursor = 'grab'; }

  frame.addEventListener('mousedown', pointerDown);
  frame.addEventListener('mousemove', pointerMove);
  window.addEventListener('mouseup', pointerUp);
  frame.addEventListener('touchstart', pointerDown, { passive: true });
  frame.addEventListener('touchmove', pointerMove, { passive: true });
  frame.addEventListener('touchend', pointerUp);

document.getElementById('btn-cadrage-annuler').onclick = () => { window.removeEventListener('mouseup', pointerUp); modal.remove(); };
  document.getElementById('btn-cadrage-valider').onclick = async () => {
    await db.from('inspirations').update({ photo_cadrage: cadrage }).eq('id', id).eq('user_id', currentUser.id);
    inspi.photo_cadrage = cadrage;
    window.removeEventListener('mouseup', pointerUp);
    modal.remove();
    ouvrirFicheInspiration(id);
  };
}
function statutIngredientPreview(nomIng) {
  const nomLower = (nomIng || '').toLowerCase().trim();

  if (ingredientsAlias[nomLower]) {
    const item = cave?.categories?.flatMap(c => c.items).find(i => i.id === ingredientsAlias[nomLower]);
    if (item) return item.detenu !== false ? 'ok' : 'manquant';
  }

  const gLie = glossaireIngredients.find(g => g.item_cave_id && (
    g.nom_canonique.toLowerCase() === nomLower || (g.alias || []).some(a => a.toLowerCase() === nomLower)
  ));
  if (gLie) {
    const item = cave?.categories?.flatMap(c => c.items).find(i => i.id === gLie.item_cave_id);
    if (item) return item.detenu !== false ? 'ok' : 'manquant';
  }

  const autoId = trouverItemCaveCorrespondant(nomIng);
  if (autoId) {
    const item = cave?.categories?.flatMap(c => c.items).find(i => i.id === autoId);
    if (item) return item.detenu !== false ? 'ok' : 'manquant';
  }

  const gConnu = glossaireIngredients.find(g =>
    g.nom_canonique.toLowerCase() === nomLower || (g.alias || []).some(a => a.toLowerCase() === nomLower)
  );
  if (gConnu) return 'glossaire';

  return 'inconnu';
}

function badgeStatutIngredientInspiration(statut) {
  const map = {
    ok:        { icon: '✅', label: 'En cave',  color: 'var(--text-success)' },
    manquant:  { icon: '❌', label: 'Manquant', color: 'var(--text-danger)' },
    glossaire: { icon: '🧪', label: 'Connu',    color: 'var(--text-accent)' },
    inconnu:   { icon: '❓', label: 'Inconnu',  color: 'var(--text-muted)' }
  };
  const s = map[statut];
  return `<span style="font-size:0.72rem;color:${s.color};white-space:nowrap">${s.icon} ${s.label}</span>`;
}
async function ouvrirFicheInspiration(id) {
  const inspi = inspirationsList.find(x => x.id === id);
  if (!inspi) return;

  const ings = Array.isArray(inspi.ingredients) ? inspi.ingredients : [];
  const tags = inspi.tags || [];
  const dateStr = new Date(inspi.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  const sourceLabel = { manuel: 'Saisie manuelle', photo: 'Photo', url: 'URL' };

  const { data: reponsesBartender } = await db.from('bartender_reponses').select('*').eq('inspiration_id', id).order('created_at', { ascending: false });

const cadrage = inspi.photo_cadrage || { zoom: 1, x: 0, y: 0 };

  document.getElementById('inspiration-fiche-contenu').innerHTML = `
    <div class="plante-fiche-header">
      <span style="font-size:2rem">💡</span>
      <div style="flex:1">
        <input type="text" id="inspi-nom-input-${inspi.id}" value="${inspi.nom}" class="fiche-titre"
          style="font-family:inherit;background:none;border:none;border-bottom:1px dashed var(--border);color:inherit;width:100%;padding:2px 0"
          onblur="sauvegarderNomInspiration('${inspi.id}', this.value)"
          onkeydown="if(event.key==='Enter') this.blur()">
        <div class="herbo-latin">${sourceLabel[inspi.source] || ''} ${inspi.source_detail ? '· ' + inspi.source_detail : ''} · ${dateStr}</div>
      </div>
    </div>

${inspi.photo_url ? `
<div style="position:relative;width:100%;height:220px;overflow:hidden;border-radius:12px;background:#000;margin-bottom:4px">
  <img id="inspi-photo-${inspi.id}" src="${inspi.photo_url}"
    style="position:absolute;top:50%;left:50%;width:100%;height:auto;max-width:none;
    transform:translate(calc(-50% + ${cadrage.x}%), calc(-50% + ${cadrage.y}%)) scale(${cadrage.zoom});">
</div>
<button class="btn-outline" style="font-size:0.78rem;padding:6px 12px;margin-bottom:16px" onclick="ouvrirRecadragePhoto('${inspi.id}')">🎯 Ajuster le cadrage</button>
` : ''}

<div class="plante-section" style="display:flex;gap:8px;align-items:center">
  <input type="text" id="inspi-photo-manuelle-${inspi.id}" placeholder="Coller une URL de photo…" style="flex:1;font-size:0.8rem">
  <button class="btn-outline" style="white-space:nowrap;padding:8px 12px;font-size:0.78rem" onclick="associerPhotoInspiration('${inspi.id}')">${inspi.photo_url ? '🔄 Changer' : '📷 Ajouter'}</button>
</div>

    ${(reponsesBartender && reponsesBartender.length > 0) ? `
    <div class="plante-section">
      <h3>📱 Réponses bartender (${reponsesBartender.length})</h3>
      ${reponsesBartender.map(r => renderReponseBartender(r)).join('')}
    </div>` : ''}

${ings.length > 0 ? (() => {
      const statuts = ings.map(ing => statutIngredientPreview(typeof ing === 'string' ? ing : ing.nom));
      const nbOk = statuts.filter(s => s === 'ok').length;
      return `
    <div class="plante-section">
      <h3>Ingrédients</h3>
      <div style="font-size:0.78rem;color:var(--text-secondary);margin-bottom:8px">📦 ${nbOk}/${ings.length} déjà en cave</div>
      ${ings.map((ing, idx) => {
        const nomIng = typeof ing === 'string' ? ing : ing.nom;
        const uniteValide = (ing.unite && ing.unite !== 'null') ? ing.unite : '';
        const dosage = ing.quantite ? `<span style="color:var(--text-accent);font-weight:600;margin-left:8px">${ing.quantite}${uniteValide ? ' ' + uniteValide : ''}</span>` : '';
        const statut = statuts[idx];
        return `<div style="display:flex;flex-direction:column;padding:6px 0;border-bottom:1px solid var(--border);font-size:0.9rem">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <span>${nomIng}</span>
            <div style="display:flex;align-items:center;gap:8px">${dosage}${badgeStatutIngredientInspiration(statut)}</div>
          </div>
          ${statut !== 'ok' ? `<button class="btn-outline" style="align-self:flex-start;margin-top:4px;font-size:0.72rem;padding:3px 10px" onclick="ouvrirLiaisonIngredient('${nomIng.replace(/'/g, "\\'")}', null, () => ouvrirFicheInspiration('${inspi.id}'))">🔗 Préparer dans Ma Cave</button>` : ''}
        </div>`;
      }).join('')}
    </div>`;
    })() : ''}

${(() => {
  if (!inspi.notes) return '';
  let notes = inspi.notes;
  try { notes = JSON.parse(inspi.notes); } catch(e) { return `<div class="plante-section"><h3>Notes</h3><p>${inspi.notes}</p></div>`; }
  if (typeof notes !== 'object') return `<div class="plante-section"><h3>Notes</h3><p>${inspi.notes}</p></div>`;
  const lignes = [];
  if (notes.prenom) lignes.push(`<div style="font-size:0.85rem">👤 Partagé par <strong>${notes.prenom}</strong></div>`);
  if (notes.type) lignes.push(`<div style="font-size:0.85rem">📌 Type : <strong>${notes.type === 'cocktail' ? 'Cocktail' : 'Concoction/Recette'}</strong></div>`);
  if (notes.origine) lignes.push(`<div style="font-size:0.85rem;font-style:italic;color:var(--text-secondary)">💬 "${notes.origine}"</div>`);
if (notes.methode && (Array.isArray(notes.methode) ? notes.methode.length : notes.methode !== 'null')) {
  const etapesHtml = Array.isArray(notes.methode)
    ? notes.methode.map((e, i) => `<div style="margin-top:2px">${i + 1}. ${e}</div>`).join('')
    : `<div>${notes.methode}</div>`;
  lignes.push(`<div style="font-size:0.85rem">🔧 <strong>Préparation :</strong>${notes.methode_source ? ` <span style="font-size:0.72rem;color:var(--text-muted);font-style:italic">(${notes.methode_source})</span>` : ''}${etapesHtml}</div>`);
}
  if (notes.garniture && notes.garniture !== 'null') lignes.push(`<div style="font-size:0.85rem">🍋 <strong>Garniture :</strong> ${notes.garniture}</div>`);
 if (notes.complements && notes.complements !== 'null') lignes.push(`<div style="font-size:0.82rem;color:var(--text-secondary);margin-top:6px;padding-top:6px;border-top:1px solid var(--border)">💡 ${notes.complements}</div>`);
  if (notes.etapes?.length) lignes.push(`<div style="font-size:0.85rem;margin-top:4px"><strong>Étapes :</strong><br>${notes.etapes.map((e,i) => `${i+1}. ${e.description}${e.duree ? ' — ' + e.duree + ' ' + e.unite : ''}`).join('<br>')}</div>`);
  return lignes.length ? `<div class="plante-section" style="display:flex;flex-direction:column;gap:8px;background:var(--bg-accent);border-radius:10px;padding:12px;border:1px solid var(--border-accent)">${lignes.join('')}</div>` : '';
})()}

    ${tags.length > 0 ? `
    <div class="plante-section">
      <h3>Tags</h3>
      <div class="herbo-usages">${tags.map(t => `<span class="herbo-usage-tag">${t}</span>`).join('')}</div>
    </div>` : ''}

   ${inspi.analyse_result ? `
    <div class="plante-section">
      <h3>✨ Analyse Claude</h3>
      <div style="background:var(--bg-accent);border-radius:10px;padding:12px;display:flex;flex-direction:column;gap:8px">
        <div style="font-weight:600">${inspi.analyse_result.type === 'nouvelle' ? '🆕 Nouvelle recette' : `🔄 Variante de ${inspi.analyse_result.recette_similaire}`}</div>
        ${inspi.analyse_result.famille ? `<div style="font-size:0.85rem">Famille : <strong>${inspi.analyse_result.famille}</strong></div>` : ''}
        ${inspi.analyse_result.cocktails_proches?.length ? `<div style="font-size:0.85rem">Proches de : ${inspi.analyse_result.cocktails_proches.join(', ')}</div>` : ''}
        ${inspi.analyse_result.score ? `<div style="font-size:0.78rem;color:var(--text-secondary)">Similarité : ${inspi.analyse_result.score}%</div>` : ''}
        <div style="font-size:0.85rem;color:var(--text-secondary);line-height:1.5">${inspi.analyse_result.explication || ''}</div>
      </div>
    </div>` : ''}

<div class="plante-section" style="display:flex;flex-direction:column;gap:10px">
  <button class="btn-primary" onclick="analyserInspiration('${inspi.id}')">
    ✨ Analyser avec Claude
  </button>
  ${inspi.statut === 'en_attente' ? `
  ${ings.length > 0 ? `
  <button class="btn-outline" style="border-color:var(--border-success);color:var(--text-success)" onclick="validerDirectement('${inspi.id}')">
    ✅ Créer la recette avec ces ingrédients
  </button>` : ''}
  <button class="btn-outline" onclick="ouvrirCompleterDepuisFiche('${inspi.id}')">✨ Compléter et valider</button>
${inspi.source !== 'url' ? `<button class="btn-outline" onclick="ouvrirQRDepuisFiche('${inspi.id}')">📱 Dévoile ton cocktail</button>` : ''}
  <button class="btn-outline" onclick="rejeterInspiration('${inspi.id}')">❌ Rejeter</button>` : ''}
  ${inspi.statut === 'validee' ? `<div style="color:var(--text-success);font-size:0.85rem;text-align:center">✅ Déjà validée</div>` : ''}
  <button class="btn-outline" style="color:var(--text-danger);border-color:var(--border-danger);margin-top:8px" onclick="supprimerInspiration('${inspi.id}')">🗑 Supprimer cette inspiration</button>
</div>
`;
afficherModal('modal-fiche-inspiration');
}

function renderReponseBartender(r) {
  const dateStr = new Date(r.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  const statutBadge = r.statut === 'validee'
    ? `<span style="font-size:0.75rem;padding:3px 8px;border-radius:20px;background:var(--bg-success);color:var(--text-success)">✅ Validée</span>`
    : `<span style="font-size:0.75rem;padding:3px 8px;border-radius:20px;background:var(--bg-danger);color:var(--text-danger)">❌ Invalidée</span>`;

  const MOTIF_LABELS = {
    trop_sucre_amer: 'Trop sucré/amer',
    mauvaise_base: 'Mauvaise base alcool',
    dosages_a_revoir: 'Dosages à revoir',
    mauvaise_piste: 'Mauvaise piste'
  };

  let detailHtml = '';
  if (r.mode === 'precis') {
    const dosages = Array.isArray(r.dosages_precis) ? r.dosages_precis : [];
    detailHtml = dosages.map(d => `
      <div style="display:flex;justify-content:space-between;padding:4px 0;font-size:0.85rem">
        <span>${d.nom}</span><span style="color:var(--text-secondary)">${d.quantite} ${d.unite}</span>
      </div>`).join('');
  } else {
    const INTENSITE_LABEL = ['Léger', 'Moyen', 'Fort'];
    const SUCRE_LABEL = ['Peu', 'Moyen', 'Beaucoup'];
    const ACIDE_LABEL = ['Peu', 'Moyen', 'Beaucoup'];
    const AMER_LABEL = ['Absent', 'Léger', 'Présent'];
    const PETILLANT_LABEL = ['Non', 'Léger', 'Oui'];
    const VOLUME_LABEL = ['~10cl', '~15cl', '~20cl'];
    detailHtml = `
      <div style="font-size:0.82rem;color:var(--text-secondary);display:grid;grid-template-columns:1fr 1fr;gap:4px">
        <div>Alcool : ${INTENSITE_LABEL[r.intensite_alcool] ?? '—'}</div>
        <div>Sucré : ${SUCRE_LABEL[r.sucre] ?? '—'}</div>
        <div>Acide : ${ACIDE_LABEL[r.acide] ?? '—'}</div>
        <div>Amer : ${AMER_LABEL[r.amer] ?? '—'}</div>
        <div>Pétillant : ${PETILLANT_LABEL[r.petillant] ?? '—'}</div>
        <div>Volume : ${VOLUME_LABEL[r.volume] ?? '—'}</div>
      </div>`;
  }

  const boutonReprendre = r.mode === 'precis'
    ? `<button class="btn-outline" style="margin-top:8px;padding:8px 10px;font-size:0.78rem" onclick="reprendreDosagesPrecis('${r.id}','${r.inspiration_id}')">↩️ Reprendre ces dosages dans "Compléter"</button>`
    : `<button class="btn-outline" style="margin-top:8px;padding:8px 10px;font-size:0.78rem" onclick="reprendreImpressionsSecret('${r.id}','${r.inspiration_id}')">↩️ Reprendre ces impressions dans "Compléter"</button>`;

  return `
    <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:10px;padding:12px;margin-bottom:10px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <span style="font-size:0.8rem;color:var(--text-secondary)">${r.mode === 'precis' ? '🔓 Dosages précis' : '🔒 Impressions'} · ${dateStr}</span>
        ${statutBadge}
      </div>
      ${(r.famille_percue || r.verre_percu) ? `
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px">
        ${r.famille_percue ? `<span class="herbo-usage-tag">📂 ${r.famille_percue}</span>` : ''}
        ${r.verre_percu ? `<span class="herbo-usage-tag">🥃 ${r.verre_percu}</span>` : ''}
      </div>` : ''}
      ${r.ingredients_bartender ? `<div style="font-size:0.82rem;color:var(--text-secondary);margin-bottom:8px">${r.ingredients_bartender}</div>` : ''}
      ${detailHtml}
      ${r.motif_invalidation ? `<div style="font-size:0.78rem;color:var(--text-danger);margin-top:8px">Motif : ${MOTIF_LABELS[r.motif_invalidation] || r.motif_invalidation}</div>` : ''}
      ${boutonReprendre}
    </div>
  `;
}

async function reprendreDosagesPrecis(reponseId, inspirationId) {
  const { data: reponse } = await db.from('bartender_reponses').select('*').eq('id', reponseId).single();
  if (!reponse) return;
  const dosages = Array.isArray(reponse.dosages_precis) ? reponse.dosages_precis : [];
  const ingredientsFormates = dosages.map(d => `${d.nom} (${d.quantite} ${d.unite})`);

  await db.from('inspirations').update({ ingredients: ingredientsFormates }).eq('id', inspirationId);
  const idx = inspirationsList.findIndex(x => x.id === inspirationId);
  if (idx !== -1) inspirationsList[idx].ingredients = ingredientsFormates;

  fermerModal('modal-fiche-inspiration');
  ouvrirModalCompleter(inspirationId);
}

async function reprendreImpressionsSecret(reponseId, inspirationId) {
  const { data: reponse } = await db.from('bartender_reponses').select('*').eq('id', reponseId).single();
  if (!reponse) return;

  fermerModal('modal-fiche-inspiration');
  ouvrirModalCompleter(inspirationId);

  setTimeout(() => {
    completerInspirationData.sliders = {
      intensite_alcool: reponse.intensite_alcool ?? 1,
      sucre: reponse.sucre ?? 1,
      acide: reponse.acide ?? 1,
      amer: reponse.amer ?? 1,
      petillant: reponse.petillant ?? 0,
      volume: reponse.volume ?? 1
    };
    toggleGoutSliders();
    document.querySelectorAll('#sliders-gout [data-key]').forEach(btn => {
      const key = btn.dataset.key;
      const val = parseInt(btn.dataset.val);
      btn.classList.toggle('active', val === completerInspirationData.sliders[key]);
    });
  }, 50);
}
function ouvrirQRBartender(id) {
  const inspi = inspirationsList.find(x => x.id === id);
  if (!inspi) return;
  const qrUrl = `https://bar-cocktail-smoky.vercel.app/bartender.html?inspiration=${id}`;
  document.getElementById('qr-bartender-contenu').innerHTML = `
    <div style="text-align:center">
      <div style="font-size:1.2rem;font-weight:700;margin-bottom:6px">📱 Dévoile ton cocktail</div>
      <div style="font-size:0.82rem;color:var(--text-secondary);margin-bottom:4px;line-height:1.4">Dosages précis ou secret bien gardé — à toi de voir.</div>
      <div style="font-size:0.78rem;color:var(--text-accent);margin-bottom:16px">${inspi.nom}</div>
      <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:10px;padding:16px">
        <img src="https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(qrUrl)}" width="180" height="180" style="border-radius:8px" />
        <div style="font-size:0.7rem;color:var(--text-muted);margin-top:8px;word-break:break-all">${qrUrl}</div>
      </div>
      <button class="btn-outline" style="margin-top:12px" onclick="copierLienBartender('${qrUrl}')">🔗 Copier le lien</button>
      <div id="qr-bartender-copie-msg" style="font-size:0.78rem;color:var(--text-success);margin-top:6px;min-height:18px"></div>
    </div>
  `;
  afficherModal('modal-qr-bartender');
}

function copierLienBartender(url) {
  navigator.clipboard.writeText(url).then(() => {
    const el = document.getElementById('qr-bartender-copie-msg');
    if (el) {
      el.textContent = '✅ Lien copié !';
      setTimeout(() => { el.textContent = ''; }, 2000);
    }
  });
}
async function analyserInspiration(id) {
  const inspi = inspirationsList.find(x => x.id === id);
  if (!inspi) return;

  const btn = document.querySelector('#modal-fiche-inspiration .btn-primary');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Analyse en cours…'; }

  const ings = Array.isArray(inspi.ingredients) ? inspi.ingredients.map(i => typeof i === 'string' ? i : i.nom).join(', ') : '';
  const recettesNoms = recettes.slice(0, 80).map(r => `${r.nom} (${(r.recette_ingredients || []).map(i => i.nom).join(', ')})`).join('\n');

  try {
    const response = await fetch('/api/analyser', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
prompt: `Tu es un expert bartending. Analyse cette inspiration de cocktail.

Inspiration : "${inspi.nom}"
Ingrédients : ${ings || 'non précisés'}

Recettes existantes dans la cave :
${recettesNoms}

Réponds en JSON uniquement :
{
  "type": "nouvelle" ou "variante",
  "recette_similaire": "nom de la recette la plus proche si variante, null si vraiment nouvelle",
  "score": pourcentage de similarité (0-100),
  "famille": "famille bartending (Sour, Spritz, Fizz, Tiki, Spirit forward...)",
  "cocktails_proches": ["nom1", "nom2"],
  "explication": "analyse courte en français : famille, profil gustatif estimé, similitudes et différences avec les recettes existantes"
}`
      })
    });

    const result = await response.json();
    let analyse;
    try { analyse = typeof result === 'string' ? JSON.parse(result) : result; }
    catch(e) { analyse = { type: 'nouvelle', explication: 'Analyse non concluante', score: 0 }; }

    await db.from('inspirations').update({ analyse_result: analyse }).eq('id', id);
    const idx = inspirationsList.findIndex(x => x.id === id);
    if (idx !== -1) inspirationsList[idx].analyse_result = analyse;

    ouvrirFicheInspiration(id);
  } catch(e) {
    if (btn) { btn.disabled = false; btn.textContent = '✨ Analyser avec Claude'; }
  }
}


async function rejeterInspiration(id) {
  await db.from('inspirations').update({ statut: 'rejetee' }).eq('id', id);
  const idx = inspirationsList.findIndex(x => x.id === id);
  if (idx !== -1) inspirationsList[idx].statut = 'rejetee';
  fermerModal('modal-fiche-inspiration');
  renderInspirations();
}
let completerInspirationData = null;
function ouvrirCompleterDepuisFiche(id) {
  document.getElementById('modal-fiche-inspiration').classList.remove('visible');
  ouvrirModalCompleter(id);
}
async function supprimerInspiration(id) {
  if (!confirm('Supprimer définitivement cette inspiration ? Cette action est irréversible.')) return;
  const { error } = await db.from('inspirations').delete().eq('id', id).eq('user_id', currentUser.id);
  if (error) { alert('Erreur : ' + error.message); return; }
  inspirationsList = inspirationsList.filter(x => x.id !== id);
  fermerModal('modal-fiche-inspiration');
  renderInspirations();
}
// Tente de relier un nom d'ingrédient à un item réel de Ma Cave —
// 1) match direct si la marque est citée dans l'ingrédient
// 2) sinon, category_id réel de la bouteille (fiable — pas de devinette sur son nom)
// Les ingrédients frais/périssables ne sont jamais catalogués dans Ma Cave, on ne tente pas.
// Matching sûr uniquement — jamais de déduction par catégorie/mots-clés.
// Ne relie que ce qui est déjà confirmé : alias exact validé via 🔗,
// ou entrée du glossaire déjà rattachée à une bouteille de Ma Cave.
// Matching sûr uniquement — jamais de déduction par catégorie/mots-clés fourre-tout.
function trouverItemCaveCorrespondant(nomIngredient) {
  const nom = (nomIngredient || '').toLowerCase().trim();
  if (!nom) return null;

  // 1. Alias déjà confirmé par l'utilisateur (nom exact)
  if (ingredientsAlias[nom]) return ingredientsAlias[nom];

  // 2. Entrée glossaire déjà liée à une bouteille (nom canonique ou alias exact)
  const matchGlossaire = glossaireIngredients.find(g =>
    g.item_cave_id && (
      g.nom_canonique.toLowerCase() === nom ||
      (g.alias || []).some(a => a.toLowerCase() === nom)
    )
  );
  if (matchGlossaire) return matchGlossaire.item_cave_id;

  // 3. Catégories de base non-ambiguës uniquement — jamais de paniers fourre-tout
  const baseSansAmbiguite = { 'gin': 'gin', 'vodka': 'vodka', 'rhum': 'rhum', 'whisky': 'whisky' };
  const catId = baseSansAmbiguite[nom];
  if (catId) {
    const cat = (cave?.categories || []).find(c => c.id === catId);
    const possedes = (cat?.items || []).filter(i => i.detenu !== false);
    if (possedes.length === 1) return possedes[0].id;
  }

  // 4. Tequila / Mezcal : catégorie cave partagée — vérification du nom en plus du nombre
  if (nom === 'tequila' || nom === 'mezcal') {
    const cat = (cave?.categories || []).find(c => c.id === 'mezcal-tequila');
    const possedes = (cat?.items || []).filter(i => i.detenu !== false);
    const correspondants = possedes.filter(i => (i.nom || '').toLowerCase().includes(nom));
    if (correspondants.length === 1) return correspondants[0].id;
  }

  return null;
}
async function validerDirectement(id) {
  const inspi = inspirationsList.find(x => x.id === id);
  if (!inspi) return;
  const ings = Array.isArray(inspi.ingredients) ? inspi.ingredients : [];
  
  let notesTournee = {};
  try { notesTournee = JSON.parse(inspi.notes || '{}'); } catch(e) {}

  const recetteId = 'inspi-' + Date.now();
  const anecdote = [
    notesTournee.origine || null,
    notesTournee.prenom ? `Partagé par ${notesTournee.prenom} via La Tournée.` : null,
    inspi.source === 'url' ? `Source : ${inspi.source_detail}` : null
  ].filter(Boolean).join(' — ') || null;

  const complementsTexte = (notesTournee.complements && notesTournee.complements !== 'null') ? notesTournee.complements : null;

  const { data: recette, error } = await db.from('recettes').insert({
    id: recetteId,
    user_id: currentUser.id,
    type: 'cocktail',
    nom: inspi.nom,
    difficulte: 'moyen',
   base_alcool: (notesTournee.base_alcool && notesTournee.base_alcool !== 'null') ? notesTournee.base_alcool : null,
photo_url: inspi.photo_url || null,
    photo_cadrage: inspi.photo_cadrage || null,
    anecdote,
    variante_notes: complementsTexte,
    source_marque: inspi.source === 'url' ? inspi.source_detail : null
  }).select().single();

  if (error) { alert('Erreur : ' + error.message); return; }

if (recette && ings.length > 0) {
    await db.from('recette_ingredients').insert(
      ings.map((ing, i) => {
        const nomIng = typeof ing === 'string' ? ing : ing.nom;
        return {
          recette_id: recetteId,
          user_id: currentUser.id,
          nom: nomIng,
          quantite: ing.quantite || null,
          unite: ing.unite || 'cl',
          item_cave_id: trouverItemCaveCorrespondant(nomIng),
          ordre: i + 1
        };
      })
    );
  }

  const etapesMethode = Array.isArray(notesTournee.methode) ? notesTournee.methode : (notesTournee.methode && notesTournee.methode !== 'null' ? [notesTournee.methode] : []);
  if (recette && etapesMethode.length > 0) {
    await db.from('recette_etapes').insert(
      etapesMethode.map((texte, i) => ({
        recette_id: recetteId,
        user_id: currentUser.id,
        ordre: i + 1,
        titre: `Étape ${i + 1}`,
        description: texte
      }))
    );
  }

  await db.from('inspirations').update({
    statut: 'validee',
    recette_liee_id: recetteId
  }).eq('id', id);

  const idx = inspirationsList.findIndex(x => x.id === id);
  if (idx !== -1) {
    inspirationsList[idx].statut = 'validee';
    inspirationsList[idx].recette_liee_id = recetteId;
  }

  fermerModal('modal-fiche-inspiration');
  renderInspirations();
  await chargerRecettes();
  alert(`✅ "${inspi.nom}" créée dans vos recettes !`);
}
function ouvrirQRDepuisFiche(id) {
  document.getElementById('modal-fiche-inspiration').classList.remove('visible');
  ouvrirQRBartender(id);
}
async function ouvrirModalCompleter(id) {
  const inspi = inspirationsList.find(x => x.id === id);
  if (!inspi) return;
completerInspirationData = { inspi, dosages: {}, profil: {}, gouteTaste: false, sliders: { intensite_alcool: 1, sucre: 1, acide: 1, amer: 1, petillant: 0, volume: 1 } };
  document.getElementById('completer-inspiration-contenu').innerHTML = `
    <h2 style="margin-bottom:4px">${inspi.nom}</h2>
    <div class="herbo-latin" style="margin-bottom:16px">${inspi.source_detail || ''}</div>

    <div class="plante-section">
      <h3>Ingrédients détectés</h3>
      ${(Array.isArray(inspi.ingredients) ? inspi.ingredients : []).map(ing => `
        <div style="font-size:0.85rem;padding:4px 0;border-bottom:1px solid var(--border)">${typeof ing === 'string' ? ing : ing.nom}</div>
      `).join('')}
    </div>

    <div class="plante-section">
      <h3>🍸 J'ai goûté ce cocktail</h3>
<div style="display:none;flex-direction:column;gap:12px" id="sliders-gout">
${[
          { key: 'intensite_alcool', label: 'Intensité alcool', options: ['Léger', 'Moyen', 'Fort'] },
          { key: 'sucre', label: 'Sucré', options: ['Peu', 'Moyen', 'Beaucoup'] },
          { key: 'acide', label: 'Acide / Frais', options: ['Peu', 'Moyen', 'Beaucoup'] },
          { key: 'amer', label: 'Amer', options: ['Absent', 'Léger', 'Présent'] },
          { key: 'petillant', label: 'Pétillant', options: ['Non', 'Léger', 'Oui'] },
          { key: 'volume', label: 'Volume estimé', options: ['~10cl', '~15cl', '~20cl'] }
        ].map(s => `
          <div>
            <div style="font-size:0.82rem;color:var(--text-secondary);margin-bottom:6px">${s.label}</div>
            <div style="display:flex;gap:6px">
              ${s.options.map((opt, i) => `
<button class="config-btn ${i === completerInspirationData.sliders[s.key] ? 'active' : ''}"
data-key="${s.key}" data-val="${i}"
                  onclick="selectGoutSlider(this, '${s.key}', ${i})">
                  ${opt}
                </button>`).join('')}
            </div>
          </div>
        `).join('')}
      </div>
      <button class="btn-outline" style="width:100%;margin-top:8px" id="btn-gout-toggle" onclick="toggleGoutSliders()">
        🍷 J'ai goûté — ajouter mes impressions
      </button>
    </div>

    <div class="plante-section">
      <button class="btn-primary" style="width:100%" onclick="analyserEtCompleter('${inspi.id}')">
        ✨ Analyser et proposer la recette
      </button>
    </div>

    <div id="completer-resultat" style="display:none">
    </div>
  `;

  afficherModal('modal-completer-inspiration');
}

function toggleGoutSliders() {
  const sliders = document.getElementById('sliders-gout');
  const btn = document.getElementById('btn-gout-toggle');
  const visible = sliders.style.display !== 'none';
  sliders.style.display = visible ? 'none' : 'flex';
  sliders.style.flexDirection = 'column';
  sliders.style.gap = '12px';
  btn.textContent = visible ? '🍷 J\'ai goûté — ajouter mes impressions' : '✕ Masquer les impressions';
  completerInspirationData.gouteTaste = !visible;
}

function selectGoutSlider(btn, key, val) {
  document.querySelectorAll(`[data-key="${key}"]`).forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  completerInspirationData.sliders[key] = val;
}

async function analyserEtCompleter(id) {
  const inspi = inspirationsList.find(x => x.id === id);
  if (!inspi) return;

  const btn = document.querySelector('#modal-completer-inspiration .btn-primary');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Analyse en cours…'; }

  const ings = Array.isArray(inspi.ingredients) ? inspi.ingredients.map(i => typeof i === 'string' ? i : i.nom) : [];
  const s = completerInspirationData.sliders;
  const intensiteLabel = ['léger', 'moyen', 'fort'];
  const sucreLabel = ['peu sucré', 'moyennement sucré', 'très sucré'];
  const acideLabel = ['peu acide', 'moyennement acide', 'très acide/frais'];
  const amerLabel = ['sans amertume', 'légèrement amer', 'amer'];
  const petillantLabel = ['non pétillant', 'légèrement pétillant', 'très pétillant'];
  const volumeLabel = ['~10cl', '~15cl', '~20cl'];

  const goutContext = completerInspirationData.gouteTaste ? `
Impressions gustatives du dégustateur :
- Intensité alcool : ${intensiteLabel[s.intensite_alcool]}
- Sucré : ${sucreLabel[s.sucre]}
- Acide/Frais : ${acideLabel[s.acide]}
- Amer : ${amerLabel[s.amer]}
- Pétillant : ${petillantLabel[s.petillant]}
- Volume estimé : ${volumeLabel[s.volume]}` : '';

  try {
const response = await fetch('/api/inspiration', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nom: inspi.nom,
        ingredients: ings.join(', '),
        gout_context: completerInspirationData.gouteTaste ? goutContext : '',
        recettes_existantes: recettes.slice(0, 50).map(r => r.nom).join(', ')
      })
    });

const result = await response.json();

    completerInspirationData.dosages = result.dosages || [];
    completerInspirationData.profil = result.profil || {};
    completerInspirationData.result = result;

    // Afficher le résultat
    const profilLabels = { gout_sucre: 'Sucré', gout_amer: 'Amer', gout_acide: 'Acide', gout_fruite: 'Fruité', gout_fume: 'Fumé', gout_floral: 'Floral', gout_epice: 'Épicé', gout_cremeux: 'Crémeux' };

    document.getElementById('completer-resultat').style.display = 'block';
    document.getElementById('completer-resultat').innerHTML = `
      <div class="plante-section">
        <h3>✨ Proposition Claude</h3>
        <div style="font-size:0.82rem;color:var(--text-secondary);margin-bottom:12px">${result.explication || ''}</div>

        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">
          ${result.famille ? `<span class="herbo-usage-tag">📂 ${result.famille}</span>` : ''}
          ${result.base_alcool ? `<span class="herbo-usage-tag">🍶 ${result.base_alcool}</span>` : ''}
          ${result.verre ? `<span class="herbo-usage-tag">🥃 ${result.verre}</span>` : ''}
          ${result.type === 'variante' && result.recette_similaire ? `<span class="herbo-usage-tag" style="background:var(--bg-warning);color:var(--text-warning)">🔄 Proche de ${result.recette_similaire}</span>` : ''}
        </div>

        <h4 style="font-size:0.85rem;margin-bottom:8px">Dosages proposés</h4>
        ${(result.dosages || []).map(d => `
          <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid var(--border)">
            <span style="font-size:0.85rem">${d.nom}</span>
            <input type="number" value="${d.quantite}" min="0" max="200" step="5"
              style="width:70px;text-align:right;background:var(--bg-card);border:1px solid var(--border);border-radius:6px;padding:4px 8px;color:var(--text-primary)"
              onchange="completerInspirationData.dosages.find(x=>x.nom==='${d.nom}').quantite=parseInt(this.value)">
            <span style="font-size:0.82rem;color:var(--text-secondary);width:30px">${d.unite}</span>
          </div>`).join('')}

        <h4 style="font-size:0.85rem;margin:12px 0 8px">Profil gustatif estimé</h4>
        ${Object.entries(result.profil || {}).filter(([k,v]) => v > 0).map(([k,v]) => `
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
            <span style="font-size:0.78rem;width:60px;color:var(--text-secondary)">${profilLabels[k] || k}</span>
            <div style="flex:1;height:6px;background:var(--border);border-radius:3px">
              <div style="width:${v*20}%;height:100%;background:var(--accent);border-radius:3px"></div>
            </div>
            <span style="font-size:0.78rem;color:var(--text-secondary)">${v}/5</span>
          </div>`).join('')}

        <div style="display:flex;flex-direction:column;gap:8px;margin-top:16px">
          <button class="btn-primary" onclick="validerAvecDosages('${id}')">
            ✅ Valider et créer la recette
          </button>
          ${result.type === 'variante' && result.recette_similaire ? `
          <button class="btn-outline" onclick="lierRecetteExistante('${id}', '${result.recette_similaire}')">
            🔄 Lier à "${result.recette_similaire}" comme variante
          </button>` : ''}
        </div>
      </div>
    `;

    if (btn) { btn.disabled = false; btn.textContent = '✨ Analyser et proposer la recette'; }

} catch(e) {
    console.error('ERREUR analyserEtCompleter:', e);
    alert('Erreur : ' + e.message);
    if (btn) { btn.disabled = false; btn.textContent = '✨ Analyser et proposer la recette'; }
  }
}

async function validerAvecDosages(id) {
  const inspi = inspirationsList.find(x => x.id === id);
  if (!inspi) return;
  const result = completerInspirationData.result;
  const dosages = completerInspirationData.dosages;

 const recetteId = 'inspi-' + Date.now();

  // Parser les notes La Tournée
  let notesTournee = {};
  try { notesTournee = JSON.parse(inspi.notes || '{}'); } catch(e) {}

  const anecdoteFinale = [
    notesTournee.origine || null,
    notesTournee.prenom ? `Partagé par ${notesTournee.prenom} via La Tournée.` : null
  ].filter(Boolean).join(' — ') || null;

  const { data: recette } = await db.from('recettes').insert({
    id: recetteId,
    user_id: currentUser.id,
    type: 'cocktail',
    nom: inspi.nom,
    difficulte: result.difficulte || 'moyen',
    base_alcool: result.base_alcool || null,
    verre_type: result.verre || null,
    description_courte: result.explication || null,
anecdote: anecdoteFinale,
    photo_url: inspi.photo_url || null,
    photo_cadrage: inspi.photo_cadrage || null,
    ...completerInspirationData.profil
  }).select().single();

  if (recette && dosages.length > 0) {
    await db.from('recette_ingredients').insert(
      dosages.map((d, i) => ({
        recette_id: recetteId,
        user_id: currentUser.id,
        nom: d.nom,
        quantite: d.quantite,
        unite: d.unite,
        ordre: i + 1
      }))
    );
  }

  await db.from('inspirations').update({
    statut: 'validee',
    recette_liee_id: recetteId,
    analyse_result: result
  }).eq('id', id);

  const idx = inspirationsList.findIndex(x => x.id === id);
  if (idx !== -1) {
    inspirationsList[idx].statut = 'validee';
    inspirationsList[idx].recette_liee_id = recetteId;
  }

  fermerModal('modal-completer-inspiration');
  fermerModal('modal-fiche-inspiration');
  renderInspirations();
  await chargerRecettes();
  alert(`✅ "${inspi.nom}" créée avec dosages dans vos recettes !`);
}

async function lierRecetteExistante(id, nomRecette) {
  const recette = recettes.find(r => r.nom.toLowerCase() === nomRecette.toLowerCase());
  await db.from('inspirations').update({
    statut: 'validee',
    recette_liee_id: recette?.id || null,
    analyse_result: completerInspirationData.result
  }).eq('id', id);

  const idx = inspirationsList.findIndex(x => x.id === id);
  if (idx !== -1) inspirationsList[idx].statut = 'validee';

  fermerModal('modal-completer-inspiration');
  fermerModal('modal-fiche-inspiration');
  renderInspirations();
  alert(`🔄 Inspiration liée à "${nomRecette}".`);
}
let grimoireList = [];
let filtreGrimoireAlcool = null;
let filtreGrimoireCategorie = '';

async function chargerGrimoire() {
  const container = document.getElementById('grimoire-container');
  if (!container) return;
  container.innerHTML = '<div class="loading-state">Chargement…</div>';
  const { data } = await db.from('grimoire').select('*').order('nom');
  if (!data) return;
  grimoireList = data;
  renderGrimoire(data);
}

function renderGrimoire(recettes) {
  const container = document.getElementById('grimoire-container');
  if (!container) return;

  const categories = [...new Set(recettes.map(r => r.categorie).filter(Boolean))].sort();
  let liste = recettes;
  if (filtreGrimoireAlcool !== null) liste = liste.filter(r => r.avec_alcool === filtreGrimoireAlcool);
  if (filtreGrimoireCategorie) liste = liste.filter(r => r.categorie === filtreGrimoireCategorie);

  const catLabels = {
    'maceration': 'Macération', 'infusion': 'Infusion', 'liqueur': 'Liqueur',
    'creme-de': 'Crème de...', 'sirop': 'Sirop', 'cordial': 'Cordial',
    'shrub': 'Shrub', 'teinture': 'Teinture', 'oleosaccharum': 'Oléosaccharum',
    'kefir-de-fruits': 'Kéfir de fruits', 'bitter-maison': 'Bitter maison'
  };

  container.innerHTML = `
    <div class="herbo-filtres">
      <button class="herbo-filtre-btn ${filtreGrimoireAlcool === null && !filtreGrimoireCategorie ? 'active' : ''}"
        onclick="filtreGrimoireAlcool=null; filtreGrimoireCategorie=''; renderGrimoire(grimoireList)">Tout</button>
      <button class="herbo-filtre-btn ${filtreGrimoireAlcool === true ? 'active' : ''}"
        onclick="filtreGrimoireAlcool=true; filtreGrimoireCategorie=''; renderGrimoire(grimoireList)">🍶 Avec alcool</button>
      <button class="herbo-filtre-btn ${filtreGrimoireAlcool === false ? 'active' : ''}"
        onclick="filtreGrimoireAlcool=false; filtreGrimoireCategorie=''; renderGrimoire(grimoireList)">🌿 Sans alcool</button>
      <span class="herbo-filtre-sep">|</span>
      ${categories.map(c => `
        <button class="herbo-filtre-btn ${filtreGrimoireCategorie === c ? 'active' : ''}"
          onclick="filtreGrimoireCategorie='${c}'; filtreGrimoireAlcool=null; renderGrimoire(grimoireList)">
          ${catLabels[c] || c}
        </button>`).join('')}
    </div>
    <div class="herbo-grille">
      ${liste.length === 0 ? '<div class="empty-state">Aucune recette trouvée.</div>' : ''}
      ${liste.map(r => `
        <div class="herbo-carte" onclick="ouvrirFicheGrimoire('${r.id}')">
          <div class="herbo-carte-top">
            <span class="herbo-emoji">${r.avec_alcool ? '🍶' : '🌿'}</span>
            <div class="herbo-carte-info">
              <div class="herbo-nom">${r.nom}</div>
              <div class="herbo-latin">${catLabels[r.categorie] || r.categorie}</div>
            </div>
            <span class="herbo-saison ${r.avec_alcool ? 'herbo-saison--ok' : 'herbo-saison--off'}">
              ${r.avec_alcool ? '🍸 Alcool' : '🥤 Sans'}
            </span>
          </div>
          <div class="herbo-profil">${r.description ? r.description.substring(0, 80) + '…' : ''}</div>
          <div class="herbo-usages">
            ${r.duree_jours ? `<span class="herbo-usage-tag">⏱ ${r.duree_jours}j</span>` : ''}
            ${r.rendement_cl ? `<span class="herbo-usage-tag">🧪 ${r.rendement_cl}cl</span>` : ''}
            ${r.cout_estime ? `<span class="herbo-usage-tag">💶 ~${r.cout_estime}€</span>` : ''}
            ${r.saison_ideale ? `<span class="herbo-usage-tag">📅 ${r.saison_ideale.substring(0, 20)}</span>` : ''}
          </div>
          ${r.avertissement ? `<div class="plante-fuir" style="margin-top:8px;font-size:0.75rem">${r.avertissement.substring(0, 60)}…</div>` : ''}
        </div>
      `).join('')}
    </div>
  `;
}

async function ouvrirFicheGrimoire(id) {
  const r = grimoireList.find(x => x.id === id);
  if (!r) return;

  // Charger les ingrédients avec prix
  const { data: ingredients } = await db
    .from('grimoire_ingredients')
    .select('*, ingredients_prix(prix_unitaire, unite)')
    .eq('grimoire_id', id)
    .order('ordre');

  const catLabels = {
    'maceration': 'Macération', 'infusion': 'Infusion', 'liqueur': 'Liqueur',
    'creme-de': 'Crème de...', 'sirop': 'Sirop', 'cordial': 'Cordial',
    'shrub': 'Shrub', 'teinture': 'Teinture', 'oleosaccharum': 'Oléosaccharum',
    'kefir-de-fruits': 'Kéfir de fruits', 'bitter-maison': 'Bitter maison'
  };

document.querySelector('.grimoire-fiche-contenu').innerHTML = `
    <div class="plante-fiche-header">
      <span style="font-size:2.5rem">${r.avec_alcool ? '🍶' : '🌿'}</span>
      <div>
        <h2 class="fiche-titre">${r.nom}</h2>
        <div class="herbo-latin">${catLabels[r.categorie] || r.categorie} · ${r.avec_alcool ? 'Avec alcool' : 'Sans alcool'}</div>
      </div>
    </div>

    ${r.avertissement ? `
    <div class="avertissement-danger" style="margin-bottom:16px">
      ${r.avertissement}
    </div>` : ''}

    <div class="plante-section">
      <h3>Description</h3>
      <p>${r.description || '—'}</p>
    </div>

    <div class="plante-section">
      <h3>Informations pratiques</h3>
      <div class="plante-entretien-grid">
        ${r.duree_jours ? `<div class="plante-entretien-item"><span class="plante-entretien-icon">⏱</span><div><div class="plante-entretien-label">Durée</div><div class="plante-entretien-val">${r.duree_jours} jours</div></div></div>` : ''}
        ${r.rendement_cl ? `<div class="plante-entretien-item"><span class="plante-entretien-icon">🧪</span><div><div class="plante-entretien-label">Rendement</div><div class="plante-entretien-val">${r.rendement_cl}cl</div></div></div>` : ''}
        ${r.cout_estime ? `<div class="plante-entretien-item"><span class="plante-entretien-icon">💶</span><div><div class="plante-entretien-label">Coût estimé</div><div class="plante-entretien-val">~${r.cout_estime}€</div></div></div>` : ''}
        ${r.base_volume_cl ? `<div class="plante-entretien-item"><span class="plante-entretien-icon">🍾</span><div><div class="plante-entretien-label">Volume base</div><div class="plante-entretien-val">${r.base_volume_cl}cl</div></div></div>` : ''}
      </div>
    </div>

    ${r.ratio_sucre ? `
    <div class="plante-section">
      <h3>Ratio sucre</h3>
      <p>${r.ratio_sucre}</p>
    </div>` : ''}

    ${r.saison_ideale ? `
    <div class="plante-section">
      <h3>📅 Saison idéale</h3>
      <p>${r.saison_ideale}</p>
    </div>` : ''}

    ${r.conservation_duree ? `
    <div class="plante-section">
      <h3>Conservation</h3>
      <p><strong>${r.conservation_duree}</strong> — ${r.conservation_type || ''}</p>
    </div>` : ''}

    ${r.notes_bartender ? `
    <div class="plante-section">
      <h3>🍸 Notes bartender</h3>
      <p class="plante-notes-bar">${r.notes_bartender}</p>
    </div>` : ''}

${ingredients && ingredients.length > 0 ? (() => {
      const coutMaison = ingredients.reduce((total, ing) => {
        const prix = ing.ingredients_prix?.prix_unitaire || 0;
        return total + (prix * (ing.quantite || 0));
      }, 0);
      const coutCl = r.base_volume_cl ? (coutMaison / r.base_volume_cl).toFixed(2) : null;
      const economie = r.prix_marche_ref ? r.prix_marche_ref - coutMaison : null;
      return `
        <div class="plante-section">
          <h3>💶 Coût de revient</h3>
          <div style="display:flex;flex-direction:column;gap:6px;margin-bottom:12px">
            ${ingredients.map(ing => `
              <div style="display:flex;justify-content:space-between;font-size:0.82rem;">
                <span style="color:var(--text-secondary)">${ing.nom} (${ing.quantite} ${ing.unite})</span>
                <span>${ing.ingredients_prix ? (ing.ingredients_prix.prix_unitaire * ing.quantite).toFixed(2) + '€' : '—'}</span>
              </div>`).join('')}
            <div style="border-top:1px solid var(--border);padding-top:8px;display:flex;justify-content:space-between;font-weight:600;">
              <span>Total maison (${r.base_volume_cl || '?'}cl)</span>
              <span>${coutMaison.toFixed(2)}€</span>
            </div>
            ${coutCl ? `<div style="font-size:0.78rem;color:var(--text-secondary)">Soit ${coutCl}€/cl</div>` : ''}
          </div>
          ${r.prix_marche_ref ? `
          <div style="background:var(--bg-success);border-radius:8px;padding:10px 12px;">
            <div style="display:flex;justify-content:space-between;font-size:0.85rem;margin-bottom:4px;">
              <span>Version achetée (${r.prix_marche_volume_cl || '?'}cl)</span>
              <span>${r.prix_marche_ref.toFixed(2)}€</span>
            </div>
            ${economie !== null ? `
            <div style="font-weight:700;color:var(--text-success);font-size:0.95rem;">
              ${economie > 0 ? '✅ Économie : ' + economie.toFixed(2) + '€' : '⚠️ Revient plus cher de ' + Math.abs(economie).toFixed(2) + '€'}
            </div>` : ''}
          </div>` : ''}
        </div>`;
    })() : ''}
   <div class="plante-section" style="margin-top:20px">
      <button class="btn-outline" style="width:100%;margin-bottom:8px" onclick="partagerGrimoire('${r.id}', '${r.nom.replace(/'/g, "\\'")}')">🔗 Partager</button>
      <button class="btn-primary" style="width:100%" onclick="lancerConcoction('${r.id}')">
        ⚗️ Lancer cette recette → Concoctions
      </button>
    </div>
  `;

  afficherModal('modal-fiche-grimoire');
}

async function partagerGrimoire(id, nom) {
  const url = `${window.location.origin}/grimoire-recette.html?id=${id}`;
  if (navigator.share) {
    try { await navigator.share({ title: nom, url }); }
    catch (e) { /* annulé par l'utilisateur */ }
  } else {
    await navigator.clipboard.writeText(url);
    alert('Lien copié ! ' + url);
  }
}

let configGrimoireCourant = null;
let configVolume = 50;
let configSucre = 'standard';

async function lancerConcoction(grimoireId) {
  if (grimoireList.length === 0) {
    const { data } = await db.from('grimoire').select('*').order('nom');
    if (data) grimoireList = data;
  }
  const r = grimoireList.find(x => x.id === grimoireId);
  if (!r) return;
  ouvrirConfigurateur(r);
  document.getElementById('modal-fiche-grimoire').classList.remove('visible');
}

function ouvrirConfigurateur(grimoire) {
  configGrimoireCourant = grimoire;
  configVolume = grimoire.base_volume_cl || 70;
  configSucre = 'standard';

  document.getElementById('config-grimoire-titre').textContent = grimoire.nom;
  document.getElementById('config-alcool-base').value = '';
  document.getElementById('config-date-debut').value = new Date().toISOString().split('T')[0];

  // Sélectionner le bon bouton volume
  document.querySelectorAll('#config-volume-btns .config-btn').forEach(btn => {
    btn.classList.toggle('active', parseInt(btn.dataset.volume) === configVolume);
  });

  // Ajouter le volume de base si pas dans les options
  const volumes = [50, 70, 100, 150];
  if (!volumes.includes(configVolume)) {
    const btn = document.createElement('button');
    btn.className = 'config-btn active';
    btn.dataset.volume = configVolume;
    btn.textContent = configVolume + 'cl';
    btn.onclick = function() { selectConfigVolume(this); };
    document.getElementById('config-volume-btns').appendChild(btn);
  }

  mettreAJourRecap();
  afficherModal('modal-configurateur-grimoire');
}

function selectConfigVolume(btn) {
  document.querySelectorAll('#config-volume-btns .config-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  configVolume = parseInt(btn.dataset.volume);
  mettreAJourRecap();
}

function selectConfigSucre(btn) {
  document.querySelectorAll('#config-sucre-btns .config-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  configSucre = btn.dataset.sucre;
  mettreAJourRecap();
}

function mettreAJourRecap() {
  const r = configGrimoireCourant;
  if (!r) return;

  const ratioSucreLabel = { leger: '100g/L', standard: r.ratio_sucre || '200g/L', riche: '350g/L' };
  const sucreTotal = Math.round(configVolume * parseFloat(ratioSucreLabel[configSucre]) / 100);

  document.getElementById('config-recap').innerHTML = `
    <strong>Récapitulatif</strong><br>
    Volume : ${configVolume}cl<br>
    ${r.avec_alcool ? `Alcool de base : ${document.getElementById('config-alcool-base').value || r.base_volume_cl ? configVolume + 'cl' : '—'}<br>` : ''}
    ${r.ratio_sucre ? `Sucre estimé : ~${sucreTotal}g (${ratioSucreLabel[configSucre]})<br>` : ''}
    Durée : ${r.duree_jours || '—'} jours<br>
    Rendement estimé : ~${configVolume}cl
  `;
}

async function validerConfigurateur() {
  const r = configGrimoireCourant;
  if (!r) return;
  const alcoolBase = document.getElementById('config-alcool-base').value.trim();
  const dateDebut = document.getElementById('config-date-debut').value;
  const ratioSucreLabel = { leger: '100g/L', standard: r.ratio_sucre || '200g/L', riche: '350g/L' };

  const notes = [
    r.notes_bartender || '',
    alcoolBase ? `Alcool de base choisi : ${alcoolBase}` : '',
    `Volume configuré : ${configVolume}cl`,
    `Degré sucre : ${configSucre} (${ratioSucreLabel[configSucre]})`
  ].filter(Boolean).join('\n');

  const id = 'custom-conc-' + Date.now();
  const { data, error } = await db.from('concoctions').insert({
    id,
    user_id: currentUser.id,
    nom: r.nom,
    type: r.avec_alcool ? 'maceration' : 'infusion',
    description: r.description || '',
    date_creation: dateDebut,
    statut: 'en_cours',
    notes,
    grimoire_id: r.id
  }).select().single();


  if (!data) return;

  const debut = new Date(dateDebut);
  const duree = r.duree_jours || 14;
  const fin = new Date(debut);
  fin.setDate(fin.getDate() + duree);
  const milieu = new Date(debut);
  milieu.setDate(milieu.getDate() + Math.floor(duree / 2));

  const etapesParCategorie = {
    maceration: [
      { ordre: 1, titre: 'Mise en macération', description: 'Placer les ingrédients dans le bocal hermétique avec l\'alcool. Fermer et placer à l\'abri de la lumière.', date: debut },
      { ordre: 2, titre: 'Vérification couleur et arômes', description: 'Goûter et observer la couleur. Ajuster si nécessaire.', date: milieu },
      { ordre: 3, titre: 'Filtration', description: 'Filtrer à travers une étamine fine. Presser légèrement pour extraire le maximum.', date: new Date(fin.getTime() - 2 * 86400000) },
      { ordre: 4, titre: 'Mise en bouteille', description: 'Transvaser dans une bouteille propre hermétique. Étiqueter avec la date et le contenu.', date: new Date(fin.getTime() - 86400000) },
      { ordre: 5, titre: 'Dégustation officielle', description: 'Première dégustation — noter les arômes, la couleur et l\'équilibre.', date: fin }
    ],
    liqueur: [
      { ordre: 1, titre: 'Mise en macération', description: 'Placer les ingrédients dans le bocal hermétique avec l\'alcool. Fermer et placer à l\'abri de la lumière.', date: debut },
      { ordre: 2, titre: 'Vérification couleur et arômes', description: 'Goûter et observer la couleur. Ajuster si nécessaire.', date: milieu },
      { ordre: 3, titre: 'Ajout du sucre', description: `Filtrer et ajouter le sirop simple selon le ratio : ${r.ratio_sucre || 'voir fiche Grimoire'}. Bien mélanger.`, date: new Date(fin.getTime() - 3 * 86400000) },
      { ordre: 4, titre: 'Filtration finale', description: 'Filtrer à nouveau finement. La liqueur doit être limpide.', date: new Date(fin.getTime() - 2 * 86400000) },
      { ordre: 5, titre: 'Mise en bouteille', description: 'Transvaser dans une bouteille propre hermétique. Étiqueter.', date: new Date(fin.getTime() - 86400000) },
      { ordre: 6, titre: 'Dégustation officielle', description: 'Première dégustation — noter les arômes, la couleur et l\'équilibre.', date: fin }
    ],
    'creme-de': [
      { ordre: 1, titre: 'Mise en macération', description: 'Placer les ingrédients dans le bocal hermétique avec l\'alcool.', date: debut },
      { ordre: 2, titre: 'Vérification', description: 'Goûter et observer. Ajuster si nécessaire.', date: milieu },
      { ordre: 3, titre: 'Ajout du sucre (ratio élevé)', description: `Filtrer et ajouter le sirop riche : ${r.ratio_sucre || 'minimum 400g/L'}. Bien mélanger.`, date: new Date(fin.getTime() - 2 * 86400000) },
      { ordre: 4, titre: 'Mise en bouteille', description: 'Transvaser dans une bouteille propre. Étiqueter avec date et ratio sucre.', date: new Date(fin.getTime() - 86400000) },
      { ordre: 5, titre: 'Dégustation officielle', description: 'Première dégustation.', date: fin }
    ],
    sirop: [
      { ordre: 1, titre: 'Préparation des ingrédients', description: 'Peser et préparer tous les ingrédients. Stériliser les contenants.', date: debut },
      { ordre: 2, titre: 'Infusion', description: 'Infuser les ingrédients dans l\'eau chaude selon la recette. Surveiller la durée.', date: debut },
      { ordre: 3, titre: 'Filtration', description: 'Filtrer finement à travers une étamine ou un filtre à café.', date: debut },
      { ordre: 4, titre: 'Mise en bouteille', description: 'Ajouter le sucre, mélanger jusqu\'à dissolution complète. Mettre en bouteille au frigo.', date: fin }
    ],
    shrub: [
      { ordre: 1, titre: 'Macération à froid', description: 'Mélanger les fruits avec le sucre. Laisser macérer 48h au frigo.', date: debut },
      { ordre: 2, titre: 'Ajout du vinaigre', description: 'Filtrer le jus obtenu et ajouter le vinaigre de cidre. Bien mélanger.', date: new Date(debut.getTime() + 2 * 86400000) },
      { ordre: 3, titre: 'Filtration et mise en bouteille', description: 'Filtrer finement et mettre en bouteille au frigo.', date: fin }
    ],
    teinture: [
      { ordre: 1, titre: 'Mise en macération', description: 'Placer les ingrédients dans l\'alcool fort (70°+). Fermer hermétiquement.', date: debut },
      { ordre: 2, titre: 'Vérification intensité', description: 'Goûter — très puissant. Ajuster la durée selon l\'intensité souhaitée.', date: milieu },
      { ordre: 3, titre: 'Filtration fine', description: 'Filtrer à travers étamine très fine ou filtre à café. Mettre en petite bouteille compte-gouttes.', date: fin }
    ],
    infusion: [
      { ordre: 1, titre: 'Préparation', description: 'Préparer les ingrédients. Stériliser les contenants.', date: debut },
      { ordre: 2, titre: 'Infusion', description: 'Infuser selon la recette du Grimoire. Surveiller la durée et la couleur.', date: debut },
      { ordre: 3, titre: 'Filtration et mise en bouteille', description: 'Filtrer et mettre en bouteille. Conserver au frigo.', date: fin }
    ]
  };

  const etapes = etapesParCategorie[r.categorie] || etapesParCategorie['maceration'];
  const etapesAInserer = etapes.map(e => ({
    concoction_id: data.id,
    user_id: currentUser.id,
    ordre: e.ordre,
    titre: e.titre,
    description: e.description,
    date_etape: e.date.toISOString().split('T')[0],
    faite: false
  }));

  await db.from('concoction_etapes').insert(etapesAInserer);

  document.getElementById('modal-configurateur-grimoire').classList.remove('visible');
  switchSousOngletConc('en-cours', document.querySelector('.conc-sous-onglet'));
  await chargerConcoctions();
}

async function chargerLexiqueConc() {
  const { data } = await db.from('connaissances_transversales')
    .select('*')
    .eq('type', 'lexique')
    .order('titre');
  const container = document.getElementById('conc-lexique-contenu');
  if (!container || !data) return;
  container.innerHTML = data.map(entry => `
    <div class="lexique-carte">
      <div class="lexique-titre">${entry.titre}</div>
      <div class="lexique-contenu">${entry.contenu}</div>
    </div>
  `).join('');
}
 
// =============================================
// CARTE PLANTE
// =============================================
 
function renderCartePlante(p) {
  const moisActuel = new Date().getMonth() + 1;
  const enSaison   = p.disponibilite_mois?.includes(moisActuel);
  const usageLabel = { decoration: 'Déco', infusion: 'Infusion', maceration: 'Macération', sirop: 'Sirop', muddle: 'Muddle', zeste: 'Zeste' };
 
  return `
    <div class="herbo-carte" onclick="ouvrirFichePlante('${p.id}')">
      <div class="herbo-carte-top">
        <span class="herbo-emoji">${p.emoji}</span>
        <div class="herbo-carte-info">
          <div class="herbo-nom">${p.nom}</div>
          ${p.nom_latin ? `<div class="herbo-latin">${p.nom_latin}</div>` : ''}
        </div>
        <span class="herbo-saison ${enSaison ? 'herbo-saison--ok' : 'herbo-saison--off'}">
          ${enSaison ? '● Dispo' : '○ Hors saison'}
        </span>
      </div>
      <div class="herbo-profil">${p.profil_aromatique || ''}</div>
      <div class="herbo-usages">
        ${(p.usages_bar || []).map(u => `<span class="herbo-usage-tag">${usageLabel[u] || u}</span>`).join('')}
      </div>
      ${p.cocktails_types?.length ? `
        <div class="herbo-cocktails">🍹 ${p.cocktails_types.slice(0, 3).join(' · ')}</div>
      ` : ''}
    </div>
  `;
}
 
// =============================================
// FICHE DÉTAILLÉE
// =============================================
 
function ouvrirFichePlante(id) {
  const p = plantesList.find(x => x.id === id);
  if (!p) return;
  plantesOuverte = p;
 
  const usageLabel = { decoration: 'Déco', infusion: 'Infusion', maceration: 'Macération', sirop: 'Sirop', muddle: 'Muddle', zeste: 'Zeste' };
  const moisNoms   = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc'];
  const moisActuel = new Date().getMonth() + 1;
 
  document.querySelector('.plante-fiche-contenu').innerHTML = `
 
    <div class="plante-fiche-header">
      <span style="font-size:2.5rem">${p.emoji}</span>
      <div>
        <h2 class="fiche-titre">${p.nom}</h2>
        ${p.nom_latin ? `<div class="herbo-latin" style="font-size:0.85rem;margin-top:2px">${p.nom_latin}</div>` : ''}
      </div>
    </div>
 
    <div class="plante-section">
      <h3>Profil aromatique</h3>
      <p>${p.profil_aromatique || '—'}</p>
    </div>
 
    <div class="plante-section">
      <h3>Usages au bar</h3>
      <div class="herbo-usages" style="margin-bottom:10px">
        ${(p.usages_bar || []).map(u => `<span class="herbo-usage-tag herbo-usage-tag--large">${usageLabel[u] || u}</span>`).join('')}
      </div>
      ${p.notes_bartender ? `<p class="plante-notes-bar">${p.notes_bartender}</p>` : ''}
    </div>
 
    ${p.cocktails_types?.length ? `
    <div class="plante-section">
      <h3>Cocktails associés</h3>
      <div class="plante-cocktails-liste">
        ${p.cocktails_types.map(c => `<span class="plante-cocktail-chip">🍹 ${c}</span>`).join('')}
      </div>
    </div>` : ''}
 
    ${p.conservation_bar ? `
    <div class="plante-section">
      <h3>Conservation bar</h3>
      <p>${p.conservation_bar}</p>
    </div>` : ''}
 
    ${p.arrosage && p.arrosage !== 'Non applicable' ? `
    <div class="plante-section">
      <h3>Entretien</h3>
      <div class="plante-entretien-grid">
        <div class="plante-entretien-item">
          <span class="plante-entretien-icon">💧</span>
          <div><div class="plante-entretien-label">Arrosage</div><div class="plante-entretien-val">${p.arrosage}</div></div>
        </div>
        <div class="plante-entretien-item">
          <span class="plante-entretien-icon">☀️</span>
          <div><div class="plante-entretien-label">Lumière</div><div class="plante-entretien-val">${p.lumiere}</div></div>
        </div>
        <div class="plante-entretien-item">
          <span class="plante-entretien-icon">🪴</span>
          <div><div class="plante-entretien-label">Substrat</div><div class="plante-entretien-val">${p.substrat}</div></div>
        </div>
        ${p.taille && p.taille !== 'Non applicable' ? `
        <div class="plante-entretien-item">
          <span class="plante-entretien-icon">✂️</span>
          <div><div class="plante-entretien-label">Taille</div><div class="plante-entretien-val">${p.taille}</div></div>
        </div>` : ''}
      </div>
    </div>` : ''}
 
    ${p.periode_plantation && p.periode_plantation !== 'Non applicable' ? `
    <div class="plante-section">
      <h3>Calendrier — Sud-Ouest</h3>
      <div class="plante-calendrier">
        ${moisNoms.map((m, i) => {
          const mois  = i + 1;
          const dispo = p.disponibilite_mois?.includes(mois);
          const actuel = mois === moisActuel;
          return `<div class="plante-mois ${dispo ? 'plante-mois--dispo' : ''} ${actuel ? 'plante-mois--actuel' : ''}">${m}</div>`;
        }).join('')}
      </div>
      <div class="plante-calendrier-legend">
        ${p.periode_plantation ? `🌱 Planter : ${p.periode_plantation}` : ''}
        ${p.periode_recolte ? ` · ✂️ Récolter : ${p.periode_recolte}` : ''}
      </div>
    </div>` : ''}
 
   ${p.signes_problemes?.length ? `
    <div class="plante-section">
      <h3>Signes de problème</h3>
      <ul class="plante-problemes">
        ${p.signes_problemes.map(s => `<li>${s}</li>`).join('')}
      </ul>
    </div>` : ''}

    ${p.format_achat ? `
    <div class="plante-section">
      <h3>🛒 Format d'achat recommandé</h3>
      <p>${p.format_achat}</p>
      ${p.fourchette_prix ? `<div class="plante-prix">💶 ${p.fourchette_prix}</div>` : ''}
      ${p.sites_recommandes?.length ? `
      <div class="plante-sites">
        <div class="plante-sites-titre">Où acheter :</div>
        ${p.sites_recommandes.map(s => `<span class="plante-site-tag">${s}</span>`).join('')}
      </div>` : ''}
    </div>` : ''}

    ${p.format_a_fuir ? `
    <div class="plante-section">
      <h3>⚠️ À éviter</h3>
      <p class="plante-fuir">${p.format_a_fuir}</p>
    </div>` : ''}

   ${p.categories_preparation?.length ? `
    <div class="plante-section">
      <h3>🧪 Préparations possibles</h3>
      <div class="plante-preparations">
        ${p.categories_preparation.map(cat => `<span class="plante-prep-tag">${cat}</span>`).join('')}
      </div>
<div style="margin-top:12px;">
        <button class="btn-primary" style="width:100%" 
          data-categories='${JSON.stringify(p.categories_preparation || [])}'
          onclick="voirPreparationsGrimoire(this)">
          📖 Voir les recettes dans le Grimoire
        </button>
      </div>
    </div>` : ''}
  `;

  afficherModal('modal-fiche-plante');
}
function voirPreparationsGrimoire(btn) {
  const categories = JSON.parse(btn.dataset.categories || '[]');
  fermerModal('modal-fiche-plante');
  if (categories && categories.length > 0) {
    filtreGrimoireCategorie = categories[0];
filtreGrimoireAlcool = null;
  }
  document.querySelector('nav button[data-tab="concoctions"]').click();
  const btnGrimoire = document.querySelectorAll('.conc-sous-onglet')[1];
  switchSousOngletConc('grimoire', btnGrimoire);
}

let ecoleData = { alcools: [], techniques: [], materiels: [], lexique: [] };
let ecoleSection = 'alcools';
 
// =============================================
// CHARGEMENT
// =============================================
 async function chargerEcoleData() {
  if (ecoleData.alcools.length > 0) return; // déjà chargé
  const { data } = await db.from('ecole_alcools').select('id, nom, famille').order('ordre');
  if (data) ecoleData.alcools = data;
}
async function chargerEcole() {
  const container = document.getElementById('ecole-container');
  if (!container) return;
  container.innerHTML = '<div class="loading-state">Chargement…</div>';
 
  const [{ data: alcools }, { data: techniques }, { data: materiels }, { data: lexique }] = await Promise.all([
    db.from('ecole_alcools').select('*').order('ordre'),
    db.from('ecole_techniques').select('*').order('ordre'),
    db.from('ecole_materiels').select('*').order('ordre'),
    db.from('ecole_lexique').select('*').order('ordre')
  ]);
 
  ecoleData = {
    alcools:    alcools    || [],
    techniques: techniques || [],
    materiels:  materiels  || [],
    lexique:    lexique    || []
  };
 
  renderEcole();
}
 
// =============================================
// RENDU PRINCIPAL
// =============================================
 function ouvrirFicheEcole(section, id) {
  // Naviguer vers l'onglet École
  const btnEcole = document.querySelector('nav button[data-tab="ecole"]');
  if (btnEcole) btnEcole.click();
  // Attendre le chargement puis ouvrir la fiche
  setTimeout(() => {
    ecoleSection = section;
    renderEcole();
    setTimeout(() => ouvrirFicheAlcool(id), 100);
  }, 300);
}
function renderEcole() {
  const container = document.getElementById('ecole-container');
  if (!container) return;
 
  const sections = [
    { id: 'alcools',    label: '🥃 Alcools' },
    { id: 'techniques', label: '🍹 Techniques' },
    { id: 'materiels',  label: '🔧 Matériels' },
    { id: 'lexique',    label: '📖 Lexique' }
  ];
 
  container.innerHTML = `
    <div class="ecole-nav">
      ${sections.map(s => `
        <button class="ecole-nav-btn ${ecoleSection === s.id ? 'active' : ''}"
          onclick="ecoleSection='${s.id}'; renderEcole()">
          ${s.label}
        </button>
      `).join('')}
    </div>
    <div class="ecole-content">
      ${ecoleSection === 'alcools'    ? renderAlcools()    : ''}
      ${ecoleSection === 'techniques' ? renderTechniques() : ''}
      ${ecoleSection === 'materiels'  ? renderMateriels()  : ''}
      ${ecoleSection === 'lexique'    ? renderLexique()    : ''}
    </div>
  `;
}
 
// =============================================
// ALCOOLS
// =============================================
 
function renderAlcools() {
  const caveNoms = cave?.categories?.flatMap(c =>
    c.items.filter(i => i.detenu !== false).map(i => i.nom.toLowerCase())
  ) || [];
 
  return `<div class="ecole-grille">${ecoleData.alcools.map(a => {
    const dansCave = caveNoms.some(n =>
      a.nom.toLowerCase().split(' ').some(mot => n.includes(mot) && mot.length > 3)
    );
    return `
      <div class="ecole-carte" onclick="ouvrirFicheAlcool('${a.id}')">
        <div class="ecole-carte-top">
          <span class="ecole-emoji">${a.emoji}</span>
          <div class="ecole-carte-info">
            <div class="ecole-nom">${a.nom}</div>
            <div class="ecole-sous-types">${(a.sous_types || []).slice(0, 3).join(' · ')}</div>
          </div>
          ${dansCave ? '<span class="ecole-cave-badge">✓ Cave</span>' : ''}
        </div>
        <div class="ecole-profil">${a.profil || ''}</div>
        ${a.cocktails_types?.length ? `<div class="ecole-cocktails">🍹 ${a.cocktails_types.slice(0, 3).join(' · ')}</div>` : ''}
      </div>
    `;
  }).join('')}</div>`;
}
 
// =============================================
// TECHNIQUES
// =============================================
 
function renderTechniques() {
  const diffLabel = { facile: 'Facile', moyen: 'Moyen', avance: 'Avancé' };
  const diffClass = { facile: 'diff-facile', moyen: 'diff-moyen', avance: 'diff-avance' };
 
  return `<div class="ecole-grille">${ecoleData.techniques.map(t => `
    <div class="ecole-carte" onclick="ouvrirFicheTechnique('${t.id}')">
      <div class="ecole-carte-top">
        <span class="ecole-emoji">${t.emoji}</span>
        <div class="ecole-carte-info">
          <div class="ecole-nom">${t.nom}</div>
          <div class="ecole-sous-types">${(t.materiels || []).slice(0, 2).join(' · ')}</div>
        </div>
        <span class="carte-diff ${diffClass[t.difficulte] || ''}">${diffLabel[t.difficulte] || ''}</span>
      </div>
      <div class="ecole-profil">${t.description || ''}</div>
    </div>
  `).join('')}</div>`;
}
 
// =============================================
// MATÉRIELS
// =============================================
 
function renderMateriels() {
  const groupes = {
    necessaire: '⭐ Essentiels',
    utile:      '👍 Utiles',
    folklore:   '🎭 Folklore'
  };
 
  return Object.entries(groupes).map(([cat, label]) => {
    const items = ecoleData.materiels.filter(m => m.categorie === cat);
    if (!items.length) return '';
    return `
      <div class="ecole-groupe">
        <div class="ecole-groupe-titre">${label}</div>
        ${items.map(m => `
<div class="ecole-materiel-item" onclick="ouvrirFicheMateriel('${m.id}')">
            ${m.photo_url
              ? `<img src="${m.photo_url}" alt="${m.nom}" class="ecole-materiel-thumb">`
              : `<span class="ecole-emoji" style="font-size:1.2rem">${m.emoji}</span>`
            }
            <div class="ecole-materiel-info">
              <div class="ecole-nom" style="font-size:0.88rem">${m.nom}</div>
              <div class="ecole-sous-types">${m.description || ''}</div>
            </div>
            ${m.prix_estime ? `<span class="item-prix">${m.prix_estime}</span>` : ''}
          </div>
        `).join('')}
      </div>
    `;
  }).join('');
}
 
// =============================================
// LEXIQUE
// =============================================
 
function renderLexique() {
  const groupes = {
    commander:   '🗣 Commander au bar',
    bartenders:  '🍸 Entre bartenders',
    degustation: '👅 Dégustation'
  };
 
  return Object.entries(groupes).map(([cat, label]) => {
    const items = ecoleData.lexique.filter(l => l.categorie === cat);
    if (!items.length) return '';
    return `
      <div class="ecole-groupe">
        <div class="ecole-groupe-titre">${label}</div>
        ${items.map(l => `
          <div class="ecole-lexique-item">
            <div class="ecole-terme">${l.terme}</div>
            <div class="ecole-definition">${l.definition}</div>
            ${l.exemple ? `<div class="ecole-exemple">${l.exemple}</div>` : ''}
          </div>
        `).join('')}
      </div>
    `;
  }).join('');
}
 
// =============================================
// FICHES DÉTAILLÉES
// =============================================
 
function ouvrirFicheAlcool(id) {
  const a = ecoleData.alcools.find(x => x.id === id);
  if (!a) return;
 
  document.querySelector('.ecole-fiche-contenu').innerHTML = `
    <div class="plante-fiche-header">
      <span style="font-size:2.5rem">${a.emoji}</span>
      <div><h2 class="fiche-titre">${a.nom}</h2></div>
    </div>
    ${a.sous_types?.length ? `
    <div class="plante-section">
      <h3>Types</h3>
      <div class="plante-cocktails-liste">
        ${a.sous_types.map(s => `<span class="plante-cocktail-chip">${s}</span>`).join('')}
      </div>
    </div>` : ''}
    ${a.profil ? `<div class="plante-section"><h3>Profil</h3><p>${a.profil}</p></div>` : ''}
    ${a.histoire ? `<div class="plante-section"><h3>Histoire</h3><p>${a.histoire}</p></div>` : ''}
    ${a.production ? `<div class="plante-section"><h3>Production</h3><p>${a.production}</p></div>` : ''}
    ${a.regions ? `<div class="plante-section"><h3>Régions</h3><p>${a.regions}</p></div>` : ''}
    ${a.comment_boire ? `<div class="plante-section"><h3>Comment le boire</h3><p class="plante-notes-bar">${a.comment_boire}</p></div>` : ''}
    ${a.cocktails_types?.length ? `
    <div class="plante-section">
      <h3>Cocktails associés</h3>
      <div class="plante-cocktails-liste">
        ${a.cocktails_types.map(c => `<span class="plante-cocktail-chip">🍹 ${c}</span>`).join('')}
      </div>
    </div>` : ''}
  `;
  afficherModal('modal-ecole-fiche');
}
 
function ouvrirFicheTechnique(id) {
  const t = ecoleData.techniques.find(x => x.id === id);
  if (!t) return;
  const diffLabel = { facile: 'Facile', moyen: 'Moyen', avance: 'Avancé' };
  const diffClass = { facile: 'diff-facile', moyen: 'diff-moyen', avance: 'diff-avance' };

  document.querySelector('.ecole-fiche-contenu').innerHTML = `
    <div class="plante-fiche-header">
      <span style="font-size:2.5rem">${t.emoji}</span>
      <div>
        <h2 class="fiche-titre">${t.nom}</h2>
        <span class="carte-diff ${diffClass[t.difficulte] || ''}" style="margin-top:6px;display:inline-block">
          ${diffLabel[t.difficulte] || ''}
        </span>
      </div>
    </div>
    ${t.description ? `<div class="plante-section"><h3>Description</h3><p>${t.description}</p></div>` : ''}
    ${t.quand ? `<div class="plante-section"><h3>Quand l'utiliser</h3><p>${t.quand}</p></div>` : ''}
    ${t.materiels?.length ? `
    <div class="plante-section">
      <h3>Matériels</h3>
      <div class="fiche-materiels">
        ${t.materiels.map(m => `<span class="tag-materiel">${m}</span>`).join('')}
      </div>
    </div>` : ''}
    ${t.etapes?.length ? `
    <div class="plante-section">
      <h3>Étapes</h3>
      <ol class="fiche-etapes">
        ${t.etapes.map(e => `<li class="etape-item"><div class="etape-desc">${e}</div></li>`).join('')}
      </ol>
    </div>` : ''}
    ${t.conseil_pro ? `<div class="plante-section"><h3>Conseil pro</h3><p class="plante-notes-bar">${t.conseil_pro}</p></div>` : ''}
    ${t.id === 'fat-wash' ? `
    <div class="plante-section">
      <h3>Conservation</h3>
      <p>🧊 <strong>Réfrigérateur :</strong> 2 semaines dans un bocal hermétique.<br>
         ❄️ <strong>Congélateur :</strong> 3 mois — décongeler au frigo, ne pas recongeler.<br>
         ⚠️ Signes d'altération : trouble persistant à température ambiante, odeur rance, dépôt gras visible.</p>
    </div>
    <div class="plante-section">
      <h3>Préparations associées</h3>
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        <button class="btn" style="font-size:13px;padding:8px 14px;" onclick="fermerModal('modal-ecole-fiche'); ouvrirOnglet('recettes'); setTimeout(() => ouvrirRecette('prep-fat-wash'), 300)">
          🧈 Fat Wash Beurre Noisette-Jameson
        </button>
      </div>
    </div>` : ''}
  `;
  afficherModal('modal-ecole-fiche');
}
 
function ouvrirFicheMateriel(id) {
  const m = ecoleData.materiels.find(x => x.id === id);
  if (!m) return;
 
 document.querySelector('.ecole-fiche-contenu').innerHTML = `
    <div class="plante-fiche-header">
      <span style="font-size:2.5rem">${m.emoji}</span>
      <div><h2 class="fiche-titre">${m.nom}</h2></div>
    </div>
    ${m.photo_url ? `<div class="plante-section"><img src="${m.photo_url}" alt="${m.nom}" style="width:100%;border-radius:10px;border:1px solid var(--border);"></div>` : ''}
    ${m.description ? `<div class="plante-section"><h3>Description</h3><p>${m.description}</p></div>` : ''}
    ${m.pourquoi ? `<div class="plante-section"><h3>Pourquoi c'est important</h3><p class="plante-notes-bar">${m.pourquoi}</p></div>` : ''}
    ${m.prix_estime ? `<div class="plante-section"><h3>Prix indicatif</h3><p>${m.prix_estime}</p></div>` : ''}
  `;
  afficherModal('modal-ecole-fiche');
}
function ouvrirModalRealisation(portions) {
  const r = recetteOuverte;
  document.getElementById('choix-real-nom').textContent = r.nom;
  document.getElementById('choix-real-date').value = new Date().toISOString().split('T')[0];
  document.getElementById('choix-real-portions').value = portions;
  document.getElementById('choix-confirmation').style.display = 'none';
  document.getElementById('btn-choix-decrementer').disabled = false;
  afficherModal('modal-choix-realisation');
}

function confirmerDecrementation() {
  document.getElementById('choix-confirmation').style.display = 'block';
  document.getElementById('btn-choix-decrementer').disabled = true;
}

function annulerConfirmation() {
  document.getElementById('choix-confirmation').style.display = 'none';
  document.getElementById('btn-choix-decrementer').disabled = false;
}

async function validerDecrementation() {
  const r = recetteOuverte;
  const date = document.getElementById('choix-real-date').value;
  const portions = parseInt(document.getElementById('choix-real-portions').value) || 1;
  await decrementerCave(r, portions);
  fermerModal('modal-choix-realisation');
  afficherToastRealisation(r.nom, date);
}

function lancerDepuisChoix() {
  const r = recetteOuverte;
  const date = document.getElementById('choix-real-date').value;
  const portions = parseInt(document.getElementById('choix-real-portions').value) || 1;
  fermerModal('modal-choix-realisation');
  const snapAjust = ajustementApplique ? { ...ajustementVals } : {};
  lancerDegustationAveugle(r, portions, date, snapAjust);
}


 
// =============================================
// DÉCRÉMENTER LA CAVE (extrait de marquerRealisee)
// =============================================
 
async function decrementerCave(r, portions) {
  const caveIds = getItemsCave();
  const updates = [];
 
  for (const ing of (r.ingredients || [])) {
    if (!ing.item_cave_id || !ing.quantite || !ing.unite) continue;
    if (!caveIds.has(ing.item_cave_id)) continue;
    if (ing.unite !== 'cl') continue;
 
    for (const cat of cave.categories) {
      const item = cat.items.find(i => i.id === ing.item_cave_id);
      if (item && item.cl_restants !== null) {
        const nouveau = Math.max(0, item.cl_restants - (ing.quantite * portions));
        updates.push({ item, nouveau });
      }
    }
  }
 
  for (const { item, nouveau } of updates) {
    await db.from('items').update({ cl_restants: nouveau }).eq('id', item.id).eq('user_id', currentUser.id);
    item.cl_restants = nouveau;
  }
}
 
// =============================================
// HISTORIQUE COMPLET (onglet ou page dédiée)
// =============================================
 
let realisationsCache = [];
 
async function chargerHistoriqueRealisations() {
  const { data } = await db.from('realisations')
    .select('*')
    .eq('user_id', currentUser.id)
    .order('date', { ascending: false })
    .limit(50);
  realisationsCache = data || [];
  return realisationsCache;
}
 
// =============================================
// RENDU SECTION DASHBOARD — RÉALISATIONS
// =============================================
 
function renderDashboardRealisations(realisations) {
  if (!realisations || realisations.length === 0) {
    return `
      <div class="dash-card">
        <div class="dash-card-header">
          <span class="dash-card-titre">Dernières réalisations</span>
        </div>
        <div class="dash-empty">Aucune réalisation enregistrée. Utilisez le bouton "Réalisée" dans les fiches recettes.</div>
      </div>`;
  }
const total = realisations.length;
  return `
    <div class="dash-card">
      <div class="dash-card-header">
        <span class="dash-card-titre">Dernières réalisations</span>
        <button class="dash-link" onclick="ouvrirHistoriqueComplet()">Tout voir (${total})</button>
      </div>
      <div class="dash-realisations-liste">
        ${realisations.slice(0, 5).map(real => {
          const recette = recettes.find(r => r.id === real.recette_id);
          const dateStr = new Date(real.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
          return `
            <div class="dash-real-item" onclick="sectionRecette='cocktail'; ouvrirFicheRecette('${real.recette_id}'); document.querySelectorAll('nav button').forEach(b=>b.classList.remove('active')); document.querySelectorAll('.tab-section').forEach(s=>s.classList.add('hidden')); document.querySelector('nav button[data-tab=recettes]').classList.add('active'); document.getElementById('section-recettes').classList.remove('hidden');">
              ${recette?.photo_url
                ? `<img src="${recette.photo_url}" class="dash-real-img" alt="${real.recette_nom}" loading="lazy" onerror="this.style.display='none'">`
                : `<div class="dash-real-img dash-real-img--fallback">${real.recette_nom.charAt(0)}</div>`}
              <div class="dash-real-info">
                <div class="dash-real-nom">${real.recette_nom}</div>
                <div class="dash-real-meta">${real.portions} verre${real.portions > 1 ? 's' : ''} · ${dateStr}</div>
                ${real.note ? `<div class="dash-real-note">${real.note}</div>` : ''}
              </div>
            </div>`;
        }).join('')}
      </div>
    </div>`;
}


 async function ouvrirFicheSaisonniere(planteId) {
  let plante = plantesList.find(p => p.id === planteId);
  if (!plante) {
    const { data } = await db.from('plantes').select('*').eq('id', planteId).single();
    if (!data) return;
    plante = data;
  }

  const recettesAssociees = grimoireList.filter(g =>
    g.plante_ids?.includes(plante.id) ||
    (plante.categories_preparation || []).some(cat => g.categorie === cat)
  );

  const catLabels = {
    'maceration': 'Macération', 'infusion': 'Infusion', 'liqueur': 'Liqueur',
    'creme-de': 'Crème de...', 'sirop': 'Sirop', 'cordial': 'Cordial',
    'shrub': 'Shrub', 'teinture': 'Teinture', 'oleosaccharum': 'Oléosaccharum'
  };

  const moisNoms = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc'];
  const moisActuel = new Date().getMonth() + 1;

  document.querySelector('.grimoire-fiche-contenu').innerHTML = `
    <div class="plante-fiche-header">
      <span style="font-size:2.5rem">${plante.emoji}</span>
      <div>
        <h2 class="fiche-titre">${plante.nom}</h2>
        <div class="herbo-latin">${plante.profil_aromatique || ''}</div>
      </div>
    </div>

    <div class="plante-section">
      <h3>📅 Disponibilité</h3>
      <div class="plante-calendrier">
        ${moisNoms.map((m, i) => {
          const mois = i + 1;
          const dispo = plante.disponibilite_mois?.includes(mois);
          const actuel = mois === moisActuel;
          return `<div class="plante-mois ${dispo ? 'plante-mois--dispo' : ''} ${actuel ? 'plante-mois--actuel' : ''}">${m}</div>`;
        }).join('')}
      </div>
      ${plante.periode_recolte ? `<div style="font-size:0.82rem;color:var(--text-secondary);margin-top:8px">✂️ Récolter : ${plante.periode_recolte}</div>` : ''}
    </div>

    ${plante.format_achat ? `
    <div class="plante-section">
      <h3>🛒 Format d'achat</h3>
      <p>${plante.format_achat}</p>
      ${plante.fourchette_prix ? `<div class="plante-prix">💶 ${plante.fourchette_prix}</div>` : ''}
    </div>` : ''}

    ${recettesAssociees.length > 0 ? `
    <div class="plante-section">
      <h3>📖 Recettes du Grimoire</h3>
      <div style="display:flex;flex-direction:column;gap:8px">
        ${recettesAssociees.map(r => `
          <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:10px;padding:12px;cursor:pointer"
            onclick="fermerModal('modal-fiche-grimoire'); ouvrirFicheGrimoire('${r.id}')">
            <div style="display:flex;justify-content:space-between;align-items:center">
              <div style="font-weight:600;font-size:0.9rem">${r.avec_alcool ? '🍶' : '🌿'} ${r.nom}</div>
              <span style="font-size:0.72rem;color:var(--text-secondary)">${catLabels[r.categorie] || r.categorie}</span>
            </div>
            <div style="font-size:0.78rem;color:var(--text-secondary);margin-top:4px">
              ${r.duree_jours ? `⏱ ${r.duree_jours}j` : ''} ${r.rendement_cl ? `· 🧪 ${r.rendement_cl}cl` : ''}
            </div>
          </div>
        `).join('')}
      </div>
    </div>` : '<div class="plante-section"><p style="color:var(--text-secondary);font-size:0.85rem">Aucune recette Grimoire associée pour le moment.</p></div>'}
  `;

  afficherModal('modal-fiche-grimoire');
}
// =============================================
// MODAL HISTORIQUE COMPLET
// =============================================
 
async function ouvrirHistoriqueComplet() {
  const reals = await chargerHistoriqueRealisations();
  const modal = document.getElementById('modal-historique');
 
  const corps = modal.querySelector('.historique-corps');
  if (!reals.length) {
    corps.innerHTML = '<div class="dash-empty">Aucune réalisation enregistrée.</div>';
  } else {
    // Grouper par mois
    const groupes = {};
    reals.forEach(r => {
      const mois = new Date(r.date).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
      if (!groupes[mois]) groupes[mois] = [];
      groupes[mois].push(r);
    });
 
    corps.innerHTML = Object.entries(groupes).map(([mois, items]) => `
      <div class="historique-mois">
        <div class="historique-mois-titre">${mois}</div>
        ${items.map(real => {
          const recette = recettes.find(r => r.id === real.recette_id);
          const dateStr = new Date(real.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
          return `
            <div class="historique-item">
              ${recette?.photo_url
                ? `<img src="${recette.photo_url}" class="dash-real-img" alt="${real.recette_nom}" loading="lazy" onerror="this.style.display='none'">`
                : `<div class="dash-real-img dash-real-img--fallback">${real.recette_nom.charAt(0)}</div>`}
              <div class="historique-item-info">
                <div class="dash-real-nom">${real.recette_nom}</div>
                <div class="dash-real-meta">${real.portions} verre${real.portions > 1 ? 's' : ''} · ${dateStr}</div>
                ${real.note ? `<div class="dash-real-note">"${real.note}"</div>` : ''}
              </div>
              <button class="btn-icon btn-supprimer" title="Supprimer" onclick="supprimerRealisation('${real.id}')">🗑</button>
            </div>`;
        }).join('')}
      </div>
    `).join('');
  }
 
  afficherModal('modal-historique');
}
 
async function supprimerRealisation(id) {
  if (!confirm('Supprimer cette réalisation ?')) return;
  await db.from('realisations').delete().eq('id', id).eq('user_id', currentUser.id);
  ouvrirHistoriqueComplet();
}

init();

// =============================================
// CURSEUR GUSTATIF — Panneau latéral
// =============================================

const REGLES_GUSTATIVES = {
  amer: {
    moins: [
      { seuil: -1, action: 'reduire', cible: ['campari','angostura','kahlua','bitter','amaro','fernet','kahlúa'], categorie_ids: ['bitters','a-acheter-bitters'], pct: 15, note: 'Réduire l\'amer principal' },
      { seuil: -2, action: 'sel', note: '1 pincée de sel fin — supprime la perception amère' },
      { seuil: -2, action: 'augmenter', cible: ['sirop','sucre','miel'], pct: 20, note: 'Compenser avec plus de sucrosité' },
      { seuil: -3, action: 'ai', note: 'Reformulation complète recommandée' }
    ],
    plus: [
      { seuil: 1, action: 'ajouter_fixe', ingredient: 'Angostura Aromatic', quantite: '1 dash', note: '1 dash Angostura Aromatic' },
      { seuil: 2, action: 'ajouter_fixe', ingredient: 'Angostura Aromatic', quantite: '2 dashs', note: '2 dashs Angostura Aromatic' },
      { seuil: 3, action: 'ai', note: 'Envisager Fernet ou Amaro' }
    ]
  },
  sucre: {
    moins: [
      { seuil: -1, action: 'reduire', cible: ['sirop','sucre','miel','grenadine','orgeat'], pct: 30, note: 'Réduire l\'apport sucré' },
      { seuil: -2, action: 'reduire', cible: ['cointreau','triple sec','curacao','liqueur'], pct: 15, note: 'Réduire légèrement la liqueur sucrée' },
      { seuil: -3, action: 'ai', note: 'Supprimer sirop, ajuster liqueur' }
    ],
    plus: [
      { seuil: 1, action: 'augmenter', cible: ['sirop','sucre'], pct: 30, note: 'Augmenter le sirop de sucre' },
      { seuil: 2, action: 'ajouter_fixe', ingredient: 'Sirop de sucre', quantite: '0.5cl', note: 'Ajouter 0.5cl de sirop' },
      { seuil: 3, action: 'sub', note: 'Option : sirop de miel ou agave pour plus de complexité' }
    ]
  },
  acide: {
    moins: [
      { seuil: -1, action: 'reduire', cible: ['citron','lime','jus de citron','jus de lime'], pct: 15, note: 'Réduire légèrement l\'agrume' },
      { seuil: -2, action: 'sel', note: '1 pincée de sel — atténue la perception acide' },
      { seuil: -2, action: 'augmenter', cible: ['sirop','sucre'], pct: 20, note: 'Compenser avec plus de sucre' }
    ],
    plus: [
      { seuil: 1, action: 'augmenter', cible: ['citron','lime','jus'], pct: 15, note: 'Augmenter le jus d\'agrume' },
      { seuil: 2, action: 'ajouter_fixe', ingredient: 'Jus de citron', quantite: '0.5cl', note: 'Ajouter 0.5cl de jus de citron' }
    ]
  },
  fort: {
    moins: [
      { seuil: -1, action: 'reduire',
        cible: ['vodka','gin','whisky','rhum','mezcal','tequila','cognac','armagnac','bourbon','rye','brandy','pisco','calvados'],
        categorie_ids: ['vodka','gin','whisky','rhum','mezcal-tequila','eaux-de-vie','a-acheter-spirits'],
        pct: 10, note: 'Réduire le spiritueux de 10%' },
      { seuil: -2, action: 'reduire',
        cible: ['vodka','gin','whisky','rhum','mezcal','tequila','cognac','armagnac','bourbon','rye','brandy','pisco','calvados'],
        categorie_ids: ['vodka','gin','whisky','rhum','mezcal-tequila','eaux-de-vie','a-acheter-spirits'],
        pct: 20, note: 'Réduire le spiritueux de 20%' },
      { seuil: -3, action: 'ai', note: 'Version allégée — compenser avec plus de mixer' }
    ],
    plus: [
      { seuil: 1, action: 'augmenter',
        cible: ['vodka','gin','whisky','rhum','mezcal','tequila','cognac','armagnac','bourbon','rye','brandy','pisco','calvados'],
        categorie_ids: ['vodka','gin','whisky','rhum','mezcal-tequila','eaux-de-vie','a-acheter-spirits'],
        pct: 10, note: 'Augmenter le spiritueux de 10%' },
      { seuil: 2, action: 'augmenter',
        cible: ['vodka','gin','whisky','rhum','mezcal','tequila','cognac','armagnac','bourbon','rye','brandy','pisco','calvados'],
        categorie_ids: ['vodka','gin','whisky','rhum','mezcal-tequila','eaux-de-vie','a-acheter-spirits'],
        pct: 20, note: 'Version plus corsée (+20%)' },
      { seuil: 3, action: 'ai', note: 'Option overproof ou Navy Strength' }
    ]
  },
  fruite: {
    moins: [
      { seuil: -1, action: 'reduire', cible: ['jus','framboise','fraise','mangue','ananas','grenadine'], pct: 20, note: 'Réduire l\'apport fruité' }
    ],
    plus: [
      { seuil: 1, action: 'augmenter', cible: ['jus','framboise','fraise','mangue','ananas'], pct: 20, note: 'Augmenter l\'apport fruité' },
      { seuil: 2, action: 'ajouter_fixe', ingredient: 'Jus de fruit frais', quantite: '1cl', note: 'Ajouter 1cl de jus de fruit frais' }
    ]
  },
  cremeux: {
    moins: [
      { seuil: -1, action: 'reduire', cible: ['creme','aquafaba','blanc','oeuf'], pct: 30, note: 'Réduire l\'agent crémeux' },
      { seuil: -3, action: 'supprimer', cible: ['creme','aquafaba','blanc','oeuf'], note: 'Supprimer — texture plus liquide' }
    ],
    plus: [
      { seuil: 1, action: 'augmenter', cible: ['creme','aquafaba','blanc'], pct: 30, note: 'Augmenter l\'agent crémeux' },
      { seuil: 2, action: 'sub', note: 'Blanc d\'œuf à la place de l\'aquafaba — mousse plus dense' }
    ]
  }
};

const AXES = [
  { id: 'amer',   label: 'Amer' },
  { id: 'sucre',  label: 'Sucré' },
  { id: 'acide',  label: 'Acide' },
  { id: 'fort',   label: 'Force' },
  { id: 'fruite', label: 'Fruité' },
  { id: 'cremeux',label: 'Crémeux' }
];

let ajustementVals = { amer: 0, sucre: 0, acide: 0, fort: 0, fruite: 0, cremeux: 0 };
let ajustementValsOriginaux = { amer: 0, sucre: 0, acide: 0, fort: 0, fruite: 0, cremeux: 0 };
let ajustementRecette = null;
let ajustementApplique = null;
let ajustementPortions = 1;

function ouvrirPanneauAjustement(recetteId) {
  ajustementRecette = recettes.find(r => r.id === recetteId);
  if (!ajustementRecette) return;
  // Toujours repartir des ingrédients BDD — ignorer tout ajustement précédent
  ajustementApplique = null;
  if (recetteOuverte) recetteOuverte._ajuste = null;

  // Pré-remplir les curseurs selon le profil gustatif de la recette
  // Neutre = 5/10, on ramène sur échelle -3/+3
  const r = ajustementRecette;
  const toSlider = (val) => val ? Math.round((val - 5) * 3 / 5) : 0;
  ajustementVals = {
    amer:    toSlider(r.gout_amer),
    sucre:   toSlider(r.gout_sucre),
    acide:   toSlider(r.gout_acide),
    fruite:  toSlider(r.gout_fruite),
    fort:    0,
    cremeux: toSlider(r.gout_cremeux)
  };

  // Sauvegarder les valeurs originales pour le marqueur et le reset
  ajustementValsOriginaux = { ...ajustementVals };

  // Portions
  ajustementPortions = 1;

  const panneau = document.getElementById('panneau-ajustement');
  panneau.querySelector('.panneau-titre-recette').textContent = ajustementRecette.nom;
  panneau.classList.add('visible');
  document.getElementById('panneau-overlay').classList.add('visible');

  // Mettre à jour les sliders
  AXES.forEach(ax => {
    const v = ajustementVals[ax.id] || 0;
    const slider = document.getElementById(`adj-${ax.id}`);
    if (slider) slider.value = v;
    const valEl = document.getElementById(`adj-val-${ax.id}`);
    if (valEl) {
      valEl.textContent = v > 0 ? '+' + v : v;
      valEl.style.color = v > 0 ? '#4caf7d' : v < 0 ? '#e24b4a' : 'var(--text-muted)';
    }
  });

  // Portions slider
  const portSlider = document.getElementById('adj-portions-slider');
  const portVal = document.getElementById('adj-portions-val');
  if (portSlider) portSlider.value = 1;
  if (portVal) portVal.textContent = '1';

  calculerAjustements();
  updateMarqueursOriginaux();
}

function fermerPanneauAjustement() {
  document.getElementById('panneau-ajustement').classList.remove('visible');
  document.getElementById('panneau-overlay').classList.remove('visible');
}

function onAdjSlider(axe, val) {
  ajustementVals[axe] = parseInt(val);
  const el = document.getElementById(`adj-val-${axe}`);
  if (el) {
    el.textContent = val > 0 ? '+' + val : val;
    el.style.color = val > 0 ? '#4caf7d' : val < 0 ? '#e24b4a' : 'var(--text-muted)';
  }
  calculerAjustements();
  updateMarqueursOriginaux();
}

function calculerAjustements() {
  if (!ajustementRecette) return;

  const ings = (ajustementRecette.ingredients || []).map(i => ({ ...i, cl_ajuste: i.quantite }));
  const ajustements = [];
  let needsAI = false;
  let ajoutSel = false;

  Object.entries(ajustementVals).forEach(([axe, val]) => {
    const origVal = ajustementValsOriginaux[axe] || 0;
    const delta = val - origVal; // écart par rapport à la recette originale
    if (delta === 0) return;
    const direction = delta < 0 ? 'moins' : 'plus';
    const regles = REGLES_GUSTATIVES[axe]?.[direction] || [];

    regles.forEach(regle => {
      const abs = Math.abs(delta);
      if (abs < Math.abs(regle.seuil)) return;

      if (regle.action === 'ai') { needsAI = true; return; }
      if (regle.action === 'sel') { if (!ajoutSel) { ajoutSel = true; ajustements.push({ type: 'sel', texte: regle.note }); } return; }
      if (regle.action === 'sub') { ajustements.push({ type: 'sub', texte: regle.note }); return; }
      if (regle.action === 'ajouter_fixe') { ajustements.push({ type: 'add', texte: `+ ${regle.quantite} ${regle.ingredient}` }); return; }

      if (regle.cible) {
        ings.forEach(ing => {
          const nomLower = ing.nom.toLowerCase();
          // Matching par nom ET par category_id de l'item en cave
          const itemCave = ing.item_cave_id
            ? cave?.categories?.flatMap(c => c.items).find(i => i.id === ing.item_cave_id)
            : null;
          const catId = itemCave?.category_id || '';
          const matchNom = regle.cible.some(c => nomLower.includes(c));
          const matchCat = regle.categorie_ids
            ? regle.categorie_ids.some(c => catId.includes(c))
            : false;
          const match = matchNom || matchCat;
          if (!match || !ing.quantite) return;

          if (regle.action === 'reduire') {
            ing.cl_ajuste = Math.max(0.2, ing.quantite * (1 - regle.pct / 100));
            ajustements.push({ type: 'remove', texte: `${ing.nom} : ${ing.quantite}cl → ${ing.cl_ajuste.toFixed(1)}cl` });
          } else if (regle.action === 'augmenter') {
            ing.cl_ajuste = ing.quantite * (1 + regle.pct / 100);
            ajustements.push({ type: 'add', texte: `${ing.nom} : ${ing.quantite}cl → ${ing.cl_ajuste.toFixed(1)}cl` });
          } else if (regle.action === 'supprimer') {
            ing.cl_ajuste = 0;
            ajustements.push({ type: 'remove', texte: `${ing.nom} supprimé` });
          }
        });
      }
    });
  });

  const totalModif = Object.values(ajustementVals).reduce((s, v) => s + Math.abs(v), 0);
  if (totalModif >= 8) needsAI = true;

  // Rendu recette ajustée avec portions
  const recetteDiv = document.getElementById('adj-recette');
  const p = ajustementPortions || 1;
  if (recetteDiv) {
    recetteDiv.innerHTML = ings.map(ing => {
      const modif = ing.cl_ajuste && Math.abs(ing.cl_ajuste - (ing.quantite || 0)) > 0.05;
      const qte1 = ing.cl_ajuste ? ing.cl_ajuste.toFixed(1) : (ing.quantite || '—');
      const qtep = ing.cl_ajuste ? (ing.cl_ajuste * p).toFixed(1) : (ing.quantite ? (ing.quantite * p).toFixed(1) : '—');
      const unite = ing.unite || '';
      const isVol = unite === 'cl';
      return `<div class="adj-ing-row">
        <span class="adj-ing-nom">${ing.nom}</span>
        <div style="display:flex;gap:8px;align-items:center;flex-shrink:0">
          <span class="adj-ing-qte ${modif ? 'adj-ing-qte--modif' : ''}">${isVol ? qte1 + ' cl' : (ing.quantite || '—') + (unite ? ' ' + unite : '')}</span>
          ${p > 1 && isVol ? `<span class="adj-ing-qte-portions">${qtep} cl</span>` : ''}
        </div>
      </div>`;
    }).join('');
  }

  // Rendu ajustements
  const adjDiv = document.getElementById('adj-liste');
  const typeClass = { add: 'adj-note--add', remove: 'adj-note--remove', sub: 'adj-note--sub', sel: 'adj-note--sel' };
  if (adjDiv) {
    adjDiv.innerHTML = ajustements.length
      ? ajustements.map(a => `<div class="adj-note ${typeClass[a.type] || ''}">${a.texte}</div>`).join('')
      : '<div class="adj-note-vide">Recette originale — déplacez les curseurs</div>';
  }

  // Bouton AI
  const aiBtn = document.getElementById('adj-ai-btn');
  if (aiBtn) aiBtn.style.display = needsAI ? 'block' : 'none';
}

function resetAjustements() {
  ajustementVals = { ...ajustementValsOriginaux };
  AXES.forEach(ax => {
    const v = ajustementVals[ax.id] || 0;
    const s = document.getElementById(`adj-${ax.id}`);
    if (s) s.value = v;
    const el = document.getElementById(`adj-val-${ax.id}`);
    if (el) {
      el.textContent = v > 0 ? '+' + v : v;
      el.style.color = v > 0 ? '#4caf7d' : v < 0 ? '#e24b4a' : 'var(--text-muted)';
    }
  });
  const portSlider = document.getElementById('adj-portions-slider');
  const portVal = document.getElementById('adj-portions-val');
  if (portSlider) portSlider.value = 1;
  if (portVal) portVal.textContent = '1';
  ajustementPortions = 1;
  calculerAjustements();
  updateMarqueursOriginaux();
}

function updateMarqueursOriginaux() {
  AXES.forEach(ax => {
    const marqueur = document.getElementById(`adj-marqueur-${ax.id}`);
    if (!marqueur) return;

    const origVal = ajustementValsOriginaux[ax.id] || 0;
    const currentVal = ajustementVals[ax.id] || 0;

    // Position en % sur l'échelle -3 à +3 avec compensation thumb
    const pct = ((origVal + 3) / 6) * 100;
    marqueur.style.left = `calc(${pct}% + (0.5 - ${pct / 100}) * 14px)`;

    // Toujours visible si origVal != 0 (position initiale non centrale)
    // Même si l'utilisateur n'a pas encore bougé
    marqueur.style.opacity = origVal !== 0 ? '1' : (currentVal !== origVal ? '1' : '0');
  });
}

function onAdjPortions(val) {
  ajustementPortions = parseInt(val) || 1;
  document.getElementById('adj-portions-val').textContent = val;
  calculerAjustements();
}

function appliquerAjustements() {
  if (!ajustementRecette) return;
  // Recalculer les ingrédients ajustés
  const ings = (ajustementRecette.ingredients || []).map(i => ({ ...i, cl_ajuste: i.quantite }));
  // Appliquer les règles (copie de calculerAjustements sans le rendu)
  let ajoutSel = false;
  Object.entries(ajustementVals).forEach(([axe, val]) => {
    if (val === 0) return;
    const direction = val < 0 ? 'moins' : 'plus';
    const regles = REGLES_GUSTATIVES[axe]?.[direction] || [];
    regles.forEach(regle => {
      const abs = Math.abs(val);
      if (abs < Math.abs(regle.seuil)) return;
      if (['ai','sel','sub','ajouter_fixe'].includes(regle.action)) return;
      if (regle.cible) {
        ings.forEach(ing => {
          const nomLower = ing.nom.toLowerCase();
          const itemCave = ing.item_cave_id ? cave?.categories?.flatMap(c => c.items).find(i => i.id === ing.item_cave_id) : null;
          const catId = itemCave?.category_id || '';
          const matchNom = regle.cible.some(c => nomLower.includes(c));
          const matchCat = regle.categorie_ids ? regle.categorie_ids.some(c => catId.includes(c)) : false;
          if (!(matchNom || matchCat) || !ing.quantite) return;
          if (regle.action === 'reduire') ing.cl_ajuste = Math.max(0.2, ing.quantite * (1 - regle.pct / 100));
          else if (regle.action === 'augmenter') ing.cl_ajuste = ing.quantite * (1 + regle.pct / 100);
          else if (regle.action === 'supprimer') ing.cl_ajuste = 0;
        });
      }
    });
  });

  ajustementApplique = { ings, portions: ajustementPortions };
  fermerPanneauAjustement();
  // Re-render la fiche avec la version ajustée
  renderFicheAjustee(ajustementPortions);
}

function renderFicheAjustee(portions) {
  // Re-render la fiche avec bandeau orange et dosages ajustés
  recetteOuverte._ajuste = ajustementApplique;
  renderFiche(portions);
}

function annulerAjustements() {
  ajustementApplique = null;
  recetteOuverte._ajuste = null;
  renderFiche(1);
}

async function demanderAjustementAI() {
  if (!ajustementRecette) return;
  const btn = document.getElementById('adj-ai-btn');
  btn.disabled = true;
  btn.textContent = '⏳ Analyse en cours…';

  const ingsDesc = (ajustementRecette.ingredients || []).map(i => `${i.nom} ${i.quantite || ''}${i.unite || ''}`).join(', ');
  const ajustDesc = Object.entries(ajustementVals)
    .filter(([, v]) => v !== 0)
    .map(([k, v]) => `${k}: ${v > 0 ? '+' : ''}${v}`)
    .join(', ');

  try {
    const response = await fetch('/api/apport', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        caveNoms: `Recette: ${ajustementRecette.nom}. Ingrédients: ${ingsDesc}`,
        manquantsTop: `Ajustements demandés: ${ajustDesc}. Propose une reformulation complète des dosages et substitutions si nécessaire. Réponds en JSON: [{"nom": "ingrédient", "apport": "dosage ajusté et raison"}]`
      })
    });
    const items = await response.json();
    const adjDiv = document.getElementById('adj-liste');
    if (adjDiv && items.length) {
      adjDiv.innerHTML += items.map(i =>
        `<div class="adj-note adj-note--ai"><strong>${i.nom}</strong> — ${i.apport}</div>`
      ).join('');
    }
  } catch (e) {
    console.error('Erreur AI ajustement:', e);
  }

  btn.disabled = false;
  btn.textContent = '✨ Reformulation Claude';
}

function afficherToastRealisation(nom, date) {
  const feedback = document.createElement('div');
  feedback.className = 'toast-feedback';
  feedback.textContent = `✓ ${nom} — réalisé le ${new Date(date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}`;
  document.body.appendChild(feedback);
  setTimeout(() => feedback.classList.add('visible'), 50);
  setTimeout(() => { feedback.classList.remove('visible'); setTimeout(() => feedback.remove(), 300); }, 3000);
  renderCave();
}

// =============================================
// MODE DÉGUSTATION À L'AVEUGLE
// =============================================

const DEG_ETAPES = [
  {
    titre: '👁 Visuel',
    curseur: { min: 'Clair', max: 'Foncé', key: 'visuel_intensite' },
    question: 'Quelle texture ?',
    choix: ['Limpide', 'Trouble', 'Mousseux', 'Huileux'],
    key: 'visuel_texture'
  },
  {
    titre: '👃 Nez',
    curseur: { min: 'Discret', max: 'Puissant', key: 'nez_intensite' },
    question: 'Famille dominante ?',
    choix: ['Fruité', 'Floral', 'Boisé', 'Épicé', 'Fumé', 'Herbacé'],
    key: 'nez_famille'
  },
  {
    titre: '👄 Bouche',
    curseur: { min: 'Léger', max: 'Corsé', key: 'bouche_intensite' },
    question: 'Sensation dominante ?',
    choix: ['Sucré', 'Amer', 'Acide', 'Rond', 'Sec', 'Pétillant'],
    key: 'bouche_sensation'
  },
  {
    titre: '✨ Finish',
    curseur: { min: 'Court', max: 'Long', key: 'finish_intensite' },
    question: 'Caractère ?',
    choix: ['Chaleureux', 'Fruité', 'Fumé', 'Frais', 'Amer', 'Poivré'],
    key: 'finish_caractere'
  }
];

let degustationState = {
  recette: null, portions: 0, date: null,
  verreActuel: 1, etapeActuelle: 0,
  reponses: {}, revealed: false
};

function lancerDegustationAveugle(recette, portions, date, ajustementSnapshot = {}) {
  degustationState = {
    recette, portions, date,
    ajustementSnapshot,
    verreActuel: 1, etapeActuelle: 0,
    reponses: {}, revealed: false
  };
const modal = document.getElementById('modal-degustation-aveugle');
modal.style.display = '';
modal.classList.add('visible');
  renderEtapeDegustation();
}

function fermerDegustation() {
  document.getElementById('modal-degustation-aveugle').style.display = 'none';
  afficherToastRealisation(degustationState.recette.nom, degustationState.date);
 document.getElementById('modal-degustation-aveugle').classList.remove('visible');
}

function renderEtapeDegustation() {
  const { etapeActuelle, verreActuel, portions, reponses, revealed } = degustationState;
  const label = document.getElementById('degustation-verre-label');
  label.textContent = portions > 1 ? `Verre ${verreActuel} / ${portions}` : '';
  document.querySelectorAll('.deg-prog-step').forEach((el, i) => {
    el.classList.remove('active', 'done');
    if (i < etapeActuelle) el.classList.add('done');
    else if (i === etapeActuelle) el.classList.add('active');
  });
  document.getElementById('btn-deg-precedent').style.display = etapeActuelle === 0 ? 'none' : 'block';
  const corps = document.getElementById('degustation-corps');
  const isReveal = etapeActuelle === DEG_ETAPES.length;
  document.getElementById('btn-deg-suivant').textContent = isReveal ? '✓ Terminer' : (etapeActuelle === DEG_ETAPES.length - 1 ? 'Révéler →' : 'Suivant →');
  if (isReveal) {
    corps.innerHTML = renderRevelation();
    return;
  }
  const etape = DEG_ETAPES[etapeActuelle];
  const valCurseur = reponses[etape.curseur.key] ?? 5;
  const valChoix = reponses[etape.key] ?? null;
  corps.innerHTML = `
    <div style="font-size:22px;font-weight:500;margin-bottom:20px;color:var(--text-primary);">${etape.titre}</div>
    <label style="font-size:13px;color:var(--text-secondary);">Intensité</label>
    <input type="range" min="1" max="10" value="${valCurseur}" step="1" style="width:100%;margin:8px 0 0;"
      oninput="degustationState.reponses['${etape.curseur.key}'] = parseInt(this.value)">
    <div class="deg-curseur-label"><span>${etape.curseur.min}</span><span>${etape.curseur.max}</span></div>
    <div class="deg-question">${etape.question}</div>
    <div class="deg-choix-grid">
      ${etape.choix.map(c => `
        <button class="deg-choix-btn ${valChoix === c ? 'selected' : ''}"
          onclick="selectDegChoix('${etape.key}', '${c}', this)">${c}</button>
      `).join('')}
    </div>
  `;
}

function selectDegChoix(key, valeur, btn) {
  degustationState.reponses[key] = valeur;
  btn.closest('.deg-choix-grid').querySelectorAll('.deg-choix-btn').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
}

function degustationSuivant() {
  const { etapeActuelle, verreActuel, portions, recette, date, reponses } = degustationState;
  if (etapeActuelle === DEG_ETAPES.length) {
    sauvegarderDegustation();
    return;
  }
  degustationState.etapeActuelle++;
  renderEtapeDegustation();
}

function degustationPrecedent() {
  if (degustationState.etapeActuelle > 0) {
    degustationState.etapeActuelle--;
    renderEtapeDegustation();
  }
}

async function sauvegarderDegustation() {
  const { recette, date, verreActuel, portions, reponses } = degustationState;
  const noteObj = { degustation_aveugle: reponses };
  await db.from('realisations').insert({
    user_id: currentUser.id,
    recette_id: recette.id,
    recette_nom: recette.nom,
    date,
    portions: 1,
    note: JSON.stringify(noteObj),
    photo_url: null
  });
  if (verreActuel < portions) {
    degustationState.verreActuel++;
    degustationState.etapeActuelle = 0;
    degustationState.reponses = {};
    renderEtapeDegustation();
  } else {
    fermerDegustation();
  }
}

function renderRevelation() {
  const r = degustationState.recette;
  const ajust = degustationState.ajustementSnapshot || {};
  const reponses = degustationState.reponses;

  // Profil de référence — ajusté si actif, brut sinon
  const profil = {
    sucre:  (r.gout_sucre  || 0) + (ajust.sucre  || 0),
    amer:   (r.gout_amer   || 0) + (ajust.amer   || 0),
    acide:  (r.gout_acide  || 0) + (ajust.acide  || 0),
    fruite: (r.gout_fruite || 0) + (ajust.fruite || 0),
    fume:   (r.gout_fume   || 0),
    floral: (r.gout_floral || 0),
    epice:  (r.gout_epice  || 0),
    cremeux:(r.gout_cremeux|| 0) + (ajust.cremeux|| 0),
  };

  // Famille dominante par étape (nez, bouche, finish)
  const famillesToAxe = {
    'Fruité': 'fruite', 'Floral': 'floral', 'Boisé': 'epice',
    'Épicé': 'epice', 'Fumé': 'fume', 'Herbacé': 'floral',
    'Sucré': 'sucre', 'Amer': 'amer', 'Acide': 'acide',
    'Rond': 'cremeux', 'Sec': 'amer', 'Pétillant': 'fruite',
    'Chaleureux': 'epice', 'Fruité': 'fruite', 'Frais': 'acide',
    'Poivré': 'epice'
  };

  // Axe dominant réel
  const axeDominant = Object.entries(profil).sort((a,b) => b[1]-a[1])[0];

  // SCORE
  let score = 0;

  // Nez famille (15 pts)
  const nezChoix = reponses['nez_famille'];
  const nezAxe = famillesToAxe[nezChoix];
  if (nezAxe && profil[nezAxe] >= 2) score += 15;
  else if (nezAxe && profil[nezAxe] >= 0) score += 7;

  // Bouche famille (15 pts)
  const boucheChoix = reponses['bouche_sensation'];
  const boucheAxe = famillesToAxe[boucheChoix];
  if (boucheAxe && profil[boucheAxe] >= 2) score += 15;
  else if (boucheAxe && profil[boucheAxe] >= 0) score += 7;

  // Finish famille (15 pts)
  const finishChoix = reponses['finish_caractere'];
  const finishAxe = famillesToAxe[finishChoix];
  if (finishAxe && profil[finishAxe] >= 1) score += 15;
  else if (finishAxe && profil[finishAxe] >= 0) score += 7;

  // Visuel texture (15 pts — approximatif)
  const visuelChoix = reponses['visuel_texture'];
  if (visuelChoix) score += 10; // toujours partiellement valide

  // Curseurs intensité (10 pts × 4)
  const intensiteRef = Math.round(
    (Math.abs(profil.sucre) + Math.abs(profil.amer) + Math.abs(profil.acide) + Math.abs(profil.fruite)) / 4
    * 10 / 3
  );
  const checkCurseur = (key) => {
    const val = reponses[key] ?? 5;
    const diff = Math.abs(val - intensiteRef);
    if (diff <= 2) return 10;
    if (diff <= 3) return 5;
    return 0;
  };
  score += checkCurseur('visuel_intensite');
  score += checkCurseur('nez_intensite');
  score += checkCurseur('bouche_intensite');
  score += checkCurseur('finish_intensite');
  score = Math.min(100, score);

  // Mention
  const mention = score >= 91 ? 'Nez de maître 🏆'
    : score >= 71 ? 'Palais affûté 🎯'
    : score >= 41 ? 'Bon détecteur 👃'
    : 'Palais en formation 🌱';

  // Ingrédients
  const ings = (r.ingredients || []).map(i => `${i.quantite || ''} ${i.unite || ''} ${i.nom}`.trim()).join('<br>');

  // Profil HTML avec comparaison
  const profilKeys = ['sucre','amer','acide','fruite','fume','floral','epice','cremeux'];
  const profilLabels = ['Sucré','Amer','Acide','Fruité','Fumé','Floral','Épicé','Crémeux'];
  const profilHTML = profilKeys.map((k, i) => {
    const val = profil[k] || 0;
    if (!val) return '';
    const pct = ((val + 3) / 6 * 100).toFixed(0);
    const ajuste = ajust[k] && ajust[k] !== 0;
    return `<div class="deg-profil-barre">
      <span style="width:60px;font-size:12px;color:var(--text-secondary);">${profilLabels[i]}${ajuste ? ' ✦' : ''}</span>
      <div class="deg-profil-track"><div class="deg-profil-fill" style="width:${pct}%"></div></div>
      <span style="font-size:12px;color:var(--text-muted);">${val > 0 ? '+' : ''}${val}</span>
    </div>`;
  }).join('');

  // Comparaison détectée
  const comparaisonHTML = `
    <div style="font-size:11px;font-weight:500;color:var(--text-muted);margin-bottom:8px;">CE QUE TU AS DÉTECTÉ</div>
    ${[
      {label:'👁 Visuel', choix: visuelChoix, intensite: reponses['visuel_intensite']},
      {label:'👃 Nez', choix: nezChoix, intensite: reponses['nez_intensite']},
      {label:'👄 Bouche', choix: boucheChoix, intensite: reponses['bouche_intensite']},
      {label:'✨ Finish', choix: finishChoix, intensite: reponses['finish_intensite']},
    ].map(e => `
      <div style="display:flex;justify-content:space-between;font-size:13px;padding:4px 0;border-bottom:0.5px solid var(--border);">
        <span style="color:var(--text-secondary);">${e.label}</span>
        <span style="color:var(--text-primary);">${e.choix || '—'} · ${e.intensite ?? 5}/10</span>
      </div>
    `).join('')}
  `;

  return `
    <div class="deg-revelation" style="text-align:center;margin-bottom:12px;">
      <div style="font-size:42px;font-weight:500;color:#c9a84c;">${score}</div>
      <div style="font-size:13px;color:var(--text-secondary);">/ 100</div>
      <div style="font-size:15px;font-weight:500;margin-top:4px;color:var(--text-primary);">${mention}</div>
      ${ajust && Object.values(ajust).some(v=>v!==0) ? '<div style="font-size:11px;color:var(--text-muted);margin-top:4px;">✦ profil ajusté pris en compte</div>' : ''}
    </div>
    <div class="deg-revelation">
      <h3>${r.nom}</h3>
      <div style="font-size:11px;font-weight:500;color:var(--text-muted);margin-bottom:6px;">INGRÉDIENTS</div>
      <div class="deg-ing-list">${ings || 'Non disponible'}</div>
    </div>
    <div class="deg-revelation">
      ${comparaisonHTML}
    </div>
    <div class="deg-revelation">
      <div style="font-size:11px;font-weight:500;color:var(--text-muted);margin-bottom:10px;">PROFIL RÉEL${ajust && Object.values(ajust).some(v=>v!==0) ? ' (ajusté)' : ''}</div>
      ${profilHTML || '<span style="font-size:13px;color:var(--text-muted);">Profil non renseigné</span>'}
    </div>
  `;
}
async function annulerService(serviceId, recetteId, portions) {
  if (!confirm('Annuler ce service et remettre les cl en cave ?')) return;

  const recette = recettes.find(r => r.id === recetteId);
  const estEnVoyage = voyageActif && soireeMenuActive?.voyage_id === voyageActif.id;

  for (const ing of (recette?.ingredients || [])) {
    if (!ing.item_cave_id || !ing.quantite || ing.optionnel) continue;
    if (ing.unite !== 'cl' && ing.unite !== 'ml') continue;
    if (CATEGORIES_NON_TRACKEES.includes(categorieDeItemGlobal(ing.item_cave_id))) continue;
    const qteCl = (ing.unite === 'ml' ? ing.quantite / 10 : ing.quantite) * portions;
    const itemId = ing.item_cave_id;

    if (estEnVoyage) {
      const b = voyageBouteillesActives.find(b => b.item_cave_id === itemId);
      if (!b) continue;
      const nouveau = parseFloat(b.cl_restants_voyage ?? 0) + qteCl;
      await db.from('mode_voyage_bouteilles').update({ cl_restants_voyage: nouveau })
        .eq('item_cave_id', itemId).eq('mode_voyage_id', voyageActif.id);
      b.cl_restants_voyage = nouveau;
    } else {
      const item = cave?.categories?.flatMap(c => c.items).find(i => i.id === itemId);
      if (!item) continue;
      const nouveau = (item.cl_restants ?? 0) + qteCl;
      await db.from('items').update({ cl_restants: nouveau }).eq('id', itemId).eq('user_id', currentUser.id);
      item.cl_restants = nouveau;
    }
  }

  await db.from('soiree_services').delete().eq('id', serviceId);
  await renderTableauBordSoiree();
}
