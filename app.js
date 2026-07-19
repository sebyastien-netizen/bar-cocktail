// =============================================
// BAR APP — Logique principale avec Supabase
// =============================================
 
const SUPABASE_URL  = 'https://wqsprjlocuhandhvpytx.supabase.co';
const SUPABASE_KEY  = 'sb_publishable_g4pDtkemUi-6VUG6qgVJWw_PAy5YibN';
 
const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_KEY);
 
let cave        = null;
let recettes    = [];
let currentUser = null;
let filtreRecherche = '';
let filtreCategorieActive = null;
let ongletActif = 'cave';
 
// Section recettes
let sectionRecette  = 'cocktail';
let filtreBase      = '';
let filtreGout      = '';
let filtreDiff      = '';
let filtreDisponible = false;
let recetteOuverte  = null;
 
// =============================================
// INIT & AUTH
// =============================================
 
async function init() {
  const { data: { session } } = await db.auth.getSession();
  if (session) { currentUser = session.user; afficherApp(); }
  else { afficherLogin(); }
 
  db.auth.onAuthStateChange((_event, session) => {
    if (session) { currentUser = session.user; afficherApp(); }
    else { currentUser = null; afficherLogin(); }
  });
}
 
function afficherLogin() {
  document.getElementById('screen-login').classList.remove('hidden');
  document.getElementById('screen-app').classList.add('hidden');
}
 
function afficherApp() {
  document.getElementById('screen-login').classList.add('hidden');
  document.getElementById('screen-app').classList.remove('hidden');
  chargerCave();
  chargerRecettes();
  chargerEquipements();
  chargerConcoctions();
  chargerDashboard();
}
 
// --- Login ---
document.getElementById('btn-login').addEventListener('click', async () => {
  const email    = document.getElementById('input-email').value.trim();
  const password = document.getElementById('input-password').value;
  const errorDiv = document.getElementById('login-error');
  errorDiv.classList.add('hidden');
  const { error } = await db.auth.signInWithPassword({ email, password });
  if (error) {
    errorDiv.textContent = 'Email ou mot de passe incorrect.';
    errorDiv.classList.remove('hidden');
  }
});
 
document.getElementById('btn-signup').addEventListener('click', async () => {
  const email    = document.getElementById('input-email').value.trim();
  const password = document.getElementById('input-password').value;
  const errorDiv = document.getElementById('login-error');
  errorDiv.classList.add('hidden');
  if (!email || password.length < 6) {
    errorDiv.textContent = 'Email valide et mot de passe (6 caractères min) requis.';
    errorDiv.classList.remove('hidden');
    return;
  }
  const { error } = await db.auth.signUp({ email, password });
  if (error) {
    errorDiv.textContent = error.message;
    errorDiv.classList.remove('hidden');
  } else {
    errorDiv.style.background = 'rgba(76,175,125,0.1)';
    errorDiv.style.borderColor = 'rgba(76,175,125,0.3)';
    errorDiv.style.color = '#4caf7d';
    errorDiv.textContent = 'Compte créé ! Vérifiez votre email pour confirmer.';
    errorDiv.classList.remove('hidden');
  }
});
 
document.getElementById('input-password').addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('btn-login').click();
});
 
document.getElementById('btn-logout').addEventListener('click', async () => {
  await db.auth.signOut();
});
 
// =============================================
// NAVIGATION ONGLETS
// =============================================
 
document.querySelectorAll('nav button[data-tab]').forEach(btn => {
  btn.addEventListener('click', () => {
    const tab = btn.dataset.tab;
    document.querySelectorAll('nav button').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.querySelectorAll('.tab-section').forEach(s => s.classList.add('hidden'));
    document.getElementById('section-' + tab)?.classList.remove('hidden');
    ongletActif = tab;
  });
});
 
// =============================================
// MA CAVE
// =============================================
 
async function chargerCave() {
  const [{ data: cats }, { data: items }, { data: aAcheter }] = await Promise.all([
    db.from('categories').select('*').order('ordre'),
    db.from('items').select('*, detenu'),
    db.from('a_acheter').select('*')
  ]);
 
  cave = {
    categories: (cats || []).map(cat => ({
      ...cat,
      items: (items || []).filter(i => i.category_id === cat.id)
    })),
    a_acheter: aAcheter || []
  };
 
  renderCave();
}
 
function renderCave() {
  const container = document.getElementById('cave-container');
  container.innerHTML = '';
 
  renderConservations();
 
  const navCats = document.createElement('div');
  navCats.className = 'cave-nav-cats';
  navCats.innerHTML = `
    <button class="cave-nav-btn ${!filtreCategorieActive ? 'active' : ''}" onclick="filtrerCategorie(null)">
      🍸 <span>Tout</span>
    </button>
    ${cave.categories
      .filter(cat => !cat.id.startsWith('a-acheter'))
      .map(cat => `
        <button class="cave-nav-btn ${filtreCategorieActive === cat.id ? 'active' : ''}"
          onclick="filtrerCategorie('${cat.id}')">
          ${cat.icon} <span>${cat.label}</span>
        </button>
      `).join('')}
  `;
  container.appendChild(navCats);
 
  const prixTotal = cave.categories.reduce((sum, cat) =>
    sum + cat.items.filter(i => i.detenu !== false && i.prix_estime)
                   .reduce((s, i) => s + parseFloat(i.prix_estime), 0), 0);
 
  const prixBanner = document.createElement('div');
  prixBanner.className = 'cave-prix-total';
  prixBanner.innerHTML = `
    <span class="cave-prix-label">Valeur estimée de la cave</span>
    <span class="cave-prix-val">${prixTotal.toFixed(0)} €</span>
  `;
  document.getElementById('cave-container').appendChild(prixBanner);
 
  const searchBar = document.createElement('div');
  searchBar.className = 'search-bar';
  searchBar.innerHTML = `
    <input type="text" id="search-input" placeholder="Rechercher un alcool ou ingrédient…" oninput="onSearch(this.value)" value="${filtreRecherche}">
    <button class="btn btn-outline" onclick="ouvrirModalAjout()">+ Ajouter</button>
  `;
  container.appendChild(searchBar);
 
  cave.categories.forEach(cat => {
    if (cat.id.startsWith('a-acheter')) return;
    if (filtreCategorieActive && cat.id !== filtreCategorieActive) return;
 
    const items = filtrerItems(cat.items);
    if (filtreRecherche && items.length === 0) return;
 
    const div = document.createElement('div');
    div.className = 'categorie open';
    div.id = 'cat-' + cat.id;
 
    div.innerHTML = `
      <div class="categorie-header" onclick="toggleCategorie('${cat.id}')">
        <span class="categorie-icon">${cat.icon}</span>
        <span class="categorie-label">${cat.label}</span>
        <span class="categorie-count">${items.length} / ${cat.items.length}</span>
        <span class="categorie-chevron">▼</span>
      </div>
      <div class="categorie-items">
        ${items.map(item => renderItem(item, cat.id)).join('')}
      </div>
    `;
    container.appendChild(div);
  });
}
 
function renderItem(item, catId) {
  const detenu = item.detenu !== false;
  const statutLabel = !detenu ? 'Non détenu'
    : item.statut === 'en_cours' ? 'En cours'
    : item.cl_restants !== null ? (item.cl_restants === item.cl_total ? 'Plein' : `${item.cl_restants} cl`)
    : 'En stock';
  const statutClass = !detenu ? 'statut-non-detenu'
    : item.statut === 'en_cours' ? 'statut-en-cours'
    : item.cl_restants === null ? 'statut-inconnu'
    : item.cl_restants === item.cl_total ? 'statut-plein'
    : 'statut-entame';
 
  const dotClass = !detenu ? 'non-detenu'
    : item.ouvert ? 'ouvert' : '';
 
  return `
    <div class="item-cave ${!detenu ? 'item-non-detenu' : ''}" onclick="ouvrirModalItem('${item.id}', '${catId}')">
      <div class="item-ouverture-dot ${dotClass}"></div>
      <div class="item-info">
        <div class="item-nom">${item.nom}</div>
        ${item.detail ? `<div class="item-detail">${item.detail}</div>` : ''}
      </div>
      <span class="item-statut ${statutClass}">${statutLabel}</span>
      ${detenu && item.prix_estime ? `<span class="item-prix">~${item.prix_estime}€</span>` : ''}
      <div class="item-actions">
        <button class="btn-icon" title="Infos" onclick="event.stopPropagation(); ouvrirModalInfo('${item.id}', '${catId}')">ℹ</button>
        ${detenu ? `<button class="btn-icon" title="Contenance" onclick="event.stopPropagation(); ouvrirModalContenance('${item.id}', '${catId}')">📊</button>` : ''}
        <button class="btn-icon btn-toggle-detenu" title="${detenu ? 'Marquer non détenu' : 'Marquer détenu'}"
          onclick="event.stopPropagation(); toggleDetenu('${item.id}', '${catId}')">
          ${detenu ? '✓' : '+'}
        </button>
      </div>
    </div>
  `;
}
 
function renderConservations() {
  const ouverts = [];
  cave.categories.forEach(cat => {
    cat.items.forEach(item => {
      if (item.ouvert && item.conservation) {
        const dateOuverture = item.date_ouverture ? new Date(item.date_ouverture) : new Date();
        const joursEcoules  = Math.floor((Date.now() - dateOuverture) / 86400000);
        const joursMax      = item.conservation.duree_mois * 30;
        const joursRestants = Math.round(joursMax - joursEcoules);
        const niveau        = joursRestants > 90 ? 'vert' : joursRestants > 14 ? 'orange' : 'rouge';
        const delai         = joursRestants > 60
          ? `${Math.round(joursRestants / 30)} mois restants`
          : `${joursRestants} jours restants`;
        ouverts.push({ nom: item.nom, niveau, delai, note: item.conservation.conditions });
      }
    });
  });
 
  if (ouverts.length === 0) return;
 
  const panel = document.createElement('div');
  panel.className = 'conservations-panel';
  panel.innerHTML = `
    <button class="conservations-toggle" onclick="toggleConservations(this)">
      ⚠️ Conservations à surveiller
      <span class="badge">${ouverts.length}</span>
      <span class="chevron">▼</span>
    </button>
    <div class="conservations-body">
      ${ouverts.map(o => `
        <div class="conservation-item">
          <div class="conservation-dot dot-${o.niveau}"></div>
          <div>
            <div class="conservation-nom">${o.nom}</div>
            <div class="conservation-delai">${o.delai}</div>
            <div class="conservation-note">${o.note}</div>
          </div>
        </div>
      `).join('')}
    </div>
  `;
  document.getElementById('cave-container').appendChild(panel);
}
 
function toggleCategorie(id) { document.getElementById('cat-' + id)?.classList.toggle('open'); }
 
function filtrerCategorie(id) {
  filtreCategorieActive = id;
  renderCave();
  document.getElementById('cave-container')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
function toggleConservations(btn) {
  btn.classList.toggle('open');
  btn.nextElementSibling.classList.toggle('visible');
}
function onSearch(val) { filtreRecherche = val.toLowerCase(); renderCave(); }
function filtrerItems(items) {
  if (!filtreRecherche) return items;
  return items.filter(i =>
    i.nom.toLowerCase().includes(filtreRecherche) ||
    (i.detail && i.detail.toLowerCase().includes(filtreRecherche))
  );
}
 
// =============================================
// DISPONIBILITÉ RECETTES
// =============================================
 
function getItemsCave() {
  if (!cave) return new Set();
  const ids = new Set();
  cave.categories.forEach(cat => cat.items.forEach(item => {
    if (item.detenu !== false) ids.add(item.id);
  }));
  return ids;
}
 
function calculerDisponibilite(recette) {
  const caveIds = getItemsCave();
  const ingredientsRequis = (recette.ingredients || []).filter(i => !i.optionnel && i.item_cave_id);
  const manquants = ingredientsRequis.filter(i => !caveIds.has(i.item_cave_id));
  return manquants.length;
}
 
function badgeDisponibilite(nbManquants) {
  if (nbManquants === 0) return '<span class="badge-dispo badge-ok">✅ Réalisable</span>';
  if (nbManquants === 1) return '<span class="badge-dispo badge-1">1 manquant</span>';
  if (nbManquants === 2) return '<span class="badge-dispo badge-2">2 manquants</span>';
  return '<span class="badge-dispo badge-3">3+ manquants</span>';
}
 
// =============================================
// ONGLET RECETTES
// =============================================
 
async function chargerRecettes() {
  const [{ data: recs }, { data: ings }, { data: etapes }, { data: mats }] = await Promise.all([
    db.from('recettes').select('*, gout_sucre, gout_amer, gout_acide, gout_fruite, gout_fume, gout_floral, gout_epice, gout_cremeux, degustation_voir, degustation_sentir, degustation_gout, degustation_finish, degustation_defi, variante_alcool, variante_prestige, variante_mocktail_id, variante_notes, prix_portion, kit_portable, photo_url'),
    db.from('recette_ingredients').select('*').order('ordre'),
    db.from('recette_etapes').select('*').order('ordre'),
    db.from('recette_materiels').select('*')
  ]);
 
  recettes = (recs || []).map(r => ({
    ...r,
    ingredients: (ings || []).filter(i => i.recette_id === r.id),
    etapes:      (etapes || []).filter(e => e.recette_id === r.id),
    materiels:   (mats || []).filter(m => m.recette_id === r.id)
  }));
 
  renderRecettes();
}
 
function renderRecettes() {
  const container = document.getElementById('recettes-container');
  if (!container) return;
 
  let liste = recettes.filter(r => r.type === sectionRecette);
 
  if (filtreBase) liste = liste.filter(r => r.base_alcool === filtreBase);
  if (filtreGout) liste = liste.filter(r => r.gouts && r.gouts.includes(filtreGout));
  if (filtreDiff) liste = liste.filter(r => r.difficulte === filtreDiff);
 
  if (filtreDisponible) {
    liste = [...liste].sort((a, b) => calculerDisponibilite(a) - calculerDisponibilite(b));
  }
 
  const bases = [...new Set(recettes.filter(r => r.type === sectionRecette && r.base_alcool).map(r => r.base_alcool))].sort();
  const gouts = [...new Set(recettes.filter(r => r.type === sectionRecette).flatMap(r => r.gouts || []))].sort();
 
  container.innerHTML = `
    <div class="recettes-sections">
      <button class="section-btn ${sectionRecette === 'cocktail' ? 'active' : ''}" onclick="changerSection('cocktail')">
        🍹 Cocktails <span class="section-count">${recettes.filter(r=>r.type==='cocktail').length}</span>
      </button>
      <button class="section-btn ${sectionRecette === 'mocktail' ? 'active' : ''}" onclick="changerSection('mocktail')">
        🧃 Mocktails <span class="section-count">${recettes.filter(r=>r.type==='mocktail').length}</span>
      </button>
      <button class="section-btn ${sectionRecette === 'preparation' ? 'active' : ''}" onclick="changerSection('preparation')">
        ⚗️ Préparations <span class="section-count">${recettes.filter(r=>r.type==='preparation').length}</span>
      </button>
    </div>
 
    <div class="recettes-filtres">
      <select onchange="filtreBase=this.value; renderRecettes()">
        <option value="">Toutes les bases</option>
        ${bases.map(b => `<option value="${b}" ${filtreBase===b?'selected':''}>${b}</option>`).join('')}
      </select>
      <select onchange="filtreGout=this.value; renderRecettes()">
        <option value="">Tous les goûts</option>
        ${gouts.map(g => `<option value="${g}" ${filtreGout===g?'selected':''}>${g}</option>`).join('')}
      </select>
      <select onchange="filtreDiff=this.value; renderRecettes()">
        <option value="">Toutes difficultés</option>
        <option value="facile" ${filtreDiff==='facile'?'selected':''}>Facile</option>
        <option value="moyen" ${filtreDiff==='moyen'?'selected':''}>Moyen</option>
        <option value="avance" ${filtreDiff==='avance'?'selected':''}>Avancé</option>
      </select>
      <button class="btn-filtre-dispo ${filtreDisponible ? 'active' : ''}" onclick="filtreDisponible=!filtreDisponible; renderRecettes()">
        ✅ Réalisables en premier
      </button>
    </div>
 
    <div class="recettes-grille">
      ${liste.length === 0 ? '<div class="empty-state">Aucune recette trouvée.</div>' : ''}
      ${liste.map(r => renderCarteRecette(r)).join('')}
    </div>
  `;
}
 
// =============================================
// CARTE RECETTE — avec photo_url
// =============================================
 
function renderCarteRecette(r) {
  const nbManquants = calculerDisponibilite(r);
  const diffLabel   = { facile: 'Facile', moyen: 'Moyen', avance: 'Avancé' }[r.difficulte] || r.difficulte;
  const diffClass   = { facile: 'diff-facile', moyen: 'diff-moyen', avance: 'diff-avance' }[r.difficulte] || '';
 
  // Image ou fallback initiale
  const imgHtml = r.photo_url
    ? `<div class="carte-img-wrap">
        <img src="${r.photo_url}" alt="${r.nom}" class="carte-img" loading="lazy"
          onerror="this.parentElement.innerHTML='<span class=carte-img-initiale>${r.nom.charAt(0)}</span>'; this.parentElement.classList.add('carte-img--fallback')">
        <span class="carte-badge-dispo">${badgeDisponibilite(nbManquants)}</span>
       </div>`
    : `<div class="carte-img-wrap carte-img--fallback">
        <span class="carte-img-initiale">${r.nom.charAt(0)}</span>
        <span class="carte-badge-dispo">${badgeDisponibilite(nbManquants)}</span>
       </div>`;
 
  return `
    <div class="carte-recette" onclick="ouvrirFicheRecette('${r.id}')">
      ${imgHtml}
      <div class="carte-body">
        <div class="carte-top">
          <div class="carte-nom">${r.nom}</div>
          <span class="carte-diff ${diffClass}">${diffLabel}</span>
        </div>
        ${r.base_alcool ? `<div class="carte-base">🥃 ${r.base_alcool}</div>` : ''}
        <div class="carte-gouts">
          ${(r.gouts || []).map(g => `<span class="tag-gout">${g}</span>`).join('')}
        </div>
        <div class="carte-footer">
          ${r.prix_portion ? `<span class="carte-prix">~${r.prix_portion.toFixed(2)}€</span>` : ''}
        </div>
      </div>
    </div>
  `;
}
 
function changerSection(section) {
  sectionRecette = section;
  filtreBase = ''; filtreGout = ''; filtreDiff = '';
  renderRecettes();
}
 
// =============================================
// FICHE RECETTE — avec photo_url en en-tête
// =============================================
 
function ouvrirFicheRecette(id) {
  recetteOuverte = recettes.find(r => r.id === id);
  if (!recetteOuverte) return;
  renderFiche(1);
  afficherModal('modal-fiche-recette');
}
 
function renderFiche(portions) {
  const r = recetteOuverte;
  const nbManquants = calculerDisponibilite(r);
  const caveIds = getItemsCave();
  const diffLabel = { facile:'Facile', moyen:'Moyen', avance:'Avancé' }[r.difficulte] || r.difficulte;
 
  let conseilOrga = '';
  if (portions >= 2) {
    if (r.type === 'preparation') {
      conseilOrga = `
        <div class="conseil-orga">
          <span class="conseil-icon">⚗️</span>
          <span>Pour ${portions} fois la recette : multipliez les quantités. Les préparations se conservent — faites un batch plus grand pour en avoir d'avance.</span>
        </div>`;
    } else if (r.type === 'mocktail') {
      conseilOrga = `
        <div class="conseil-orga">
          <span class="conseil-icon">🧃</span>
          <span>Pour ${portions} verres : préparez le mélange de base en avance, ajoutez l'eau gazeuse au dernier moment pour conserver les bulles.</span>
        </div>`;
    } else {
      conseilOrga = `
        <div class="conseil-orga">
          <span class="conseil-icon">🍹</span>
          <span>Pour ${portions} verres : préparez tous les ingrédients à l'avance. Shakez en 2 fois max (shaker limité à 2 portions). Servez immédiatement.</span>
        </div>`;
    }
  }
 
  const prixHtml = r.prix_portion ? `
    <span class="tag-prix">~${(r.prix_portion * portions).toFixed(2)}€${portions > 1 ? ` (${portions} verres)` : ''}</span>
  ` : '';
 
  const kitHtml = r.kit_portable ? `<span class="tag-kit">✓ KIT</span>` : '';
 
  // Image en-tête fiche
  const ficheImgHtml = r.photo_url ? `
    <div class="fiche-img-wrap">
      <img src="${r.photo_url}" alt="${r.nom}" class="fiche-img" loading="lazy"
        onerror="this.parentElement.style.display='none'">
    </div>` : '';
 
  document.querySelector('.fiche-contenu').innerHTML = `
 
    ${ficheImgHtml}
 
    <div class="fiche-header">
      <div>
        <h2 class="fiche-titre">${r.nom}</h2>
        <div class="fiche-meta">
          ${r.base_alcool ? `<span class="tag-meta">🥃 ${r.base_alcool}</span>` : ''}
          <span class="tag-meta diff-${r.difficulte}">${diffLabel}</span>
          ${badgeDisponibilite(nbManquants)}
          ${prixHtml}
          ${kitHtml}
        </div>
        <div class="fiche-gouts">
          ${(r.gouts || []).map(g => `<span class="tag-gout">${g}</span>`).join('')}
        </div>
      </div>
    </div>
 
    <div class="fiche-portions">
      <span class="portions-label">Portions</span>
      <div class="portions-ctrl">
        <button class="portions-btn" onclick="changerPortions(${portions - 1})" ${portions <= 1 ? 'disabled' : ''}>−</button>
        <span class="portions-val">${portions}</span>
        <button class="portions-btn" onclick="changerPortions(${portions + 1})" ${portions >= 10 ? 'disabled' : ''}>+</button>
      </div>
    </div>
    ${conseilOrga}
 
    <div class="fiche-section">
      <h3>Ingrédients <span class="fiche-portion">pour ${portions} verre${portions > 1 ? 's' : ''}</span></h3>
      <ul class="fiche-ingredients">
        ${(r.ingredients || []).map(ing => {
          const enCave = ing.item_cave_id ? caveIds.has(ing.item_cave_id) : true;
          const qte = ing.quantite ? (ing.quantite * portions) : null;
          const qteStr = qte !== null
            ? `<strong>${Number.isInteger(qte) ? qte : qte.toFixed(1)} ${ing.unite || ''}</strong>`
            : '';
          return `
            <li class="ing-item ${!enCave && !ing.optionnel ? 'ing-manquant' : ''} ${ing.optionnel ? 'ing-optionnel' : ''}">
              <span class="ing-dot">${enCave ? '●' : '○'}</span>
              <span class="ing-texte">${qteStr} ${ing.nom}</span>
              ${ing.optionnel ? '<span class="ing-opt-label">optionnel</span>' : ''}
              ${!enCave && !ing.optionnel ? '<span class="ing-manquant-label">manquant</span>' : ''}
            </li>
          `;
        }).join('')}
      </ul>
    </div>
 
    ${r.materiels && r.materiels.length > 0 ? `
    <div class="fiche-section">
      <h3>Matériels</h3>
      <div class="fiche-materiels">
        ${r.materiels.map(m => `<span class="tag-materiel ${m.essentiel ? '' : 'materiel-optionnel'}">${m.nom}</span>`).join('')}
      </div>
    </div>
    ` : ''}
 
    <div class="fiche-section">
      <h3>Préparation</h3>
      <ol class="fiche-etapes">
        ${(r.etapes || []).map(e => `
          <li class="etape-item">
            <div class="etape-titre">${e.titre}</div>
            <div class="etape-desc">${e.description}</div>
          </li>
        `).join('')}
      </ol>
    </div>
 
    ${hasProfil(r) ? `
    <div class="fiche-section">
      <h3>Profil gustatif</h3>
      <div class="profil-barres">
        ${renderBarre('Sucré',   r.gout_sucre)}
        ${renderBarre('Amer',    r.gout_amer)}
        ${renderBarre('Acide',   r.gout_acide)}
        ${renderBarre('Fruité',  r.gout_fruite)}
        ${renderBarre('Fumé',    r.gout_fume)}
        ${renderBarre('Floral',  r.gout_floral)}
        ${renderBarre('Épicé',   r.gout_epice)}
        ${renderBarre('Crémeux', r.gout_cremeux)}
      </div>
    </div>
    ` : ''}
 
    ${r.degustation_voir ? `
    <div class="fiche-section">
      <h3>Guide de dégustation</h3>
      <div class="degustation-steps">
        <div class="degu-step">
          <span class="degu-icon">👁</span>
          <div><div class="degu-titre">Regardez</div><div class="degu-texte">${r.degustation_voir}</div></div>
        </div>
        <div class="degu-step">
          <span class="degu-icon">👃</span>
          <div><div class="degu-titre">Sentez</div><div class="degu-texte">${r.degustation_sentir}</div></div>
        </div>
        <div class="degu-step">
          <span class="degu-icon">👅</span>
          <div><div class="degu-titre">Goûtez</div><div class="degu-texte">${r.degustation_gout}</div></div>
        </div>
        <div class="degu-step">
          <span class="degu-icon">✨</span>
          <div><div class="degu-titre">Finish</div><div class="degu-texte">${r.degustation_finish}</div></div>
        </div>
        ${r.degustation_defi ? `
        <div class="degu-step degu-defi">
          <span class="degu-icon">🎯</span>
          <div><div class="degu-titre">Défi détection</div><div class="degu-texte">${r.degustation_defi}</div></div>
        </div>
        ` : ''}
      </div>
    </div>
    ` : ''}
 
    ${hasVariantes(r) ? `
    <div class="fiche-section">
      <h3>Variantes</h3>
      <div class="variantes-list">
        ${r.variante_alcool ? `
        <div class="variante-item">
          <span class="variante-label">🔄 Autre alcool</span>
          <p>${r.variante_alcool}</p>
        </div>` : ''}
        ${r.variante_prestige ? `
        <div class="variante-item variante-prestige">
          <span class="variante-label">⭐ Version Prestige</span>
          <p>${r.variante_prestige}</p>
        </div>` : ''}
        ${r.variante_mocktail_id ? `
        <div class="variante-item variante-mocktail">
          <span class="variante-label">🧃 Mocktail associé</span>
          <button class="btn-variante-link" onclick="fermerModal('modal-fiche-recette'); setTimeout(()=>{ changerSection('mocktail'); ouvrirFicheRecette('${r.variante_mocktail_id}'); }, 200)">
            Voir ${recettes.find(x=>x.id===r.variante_mocktail_id)?.nom || r.variante_mocktail_id} →
          </button>
        </div>` : ''}
        ${r.variante_notes ? `
        <div class="variante-item">
          <span class="variante-label">💡 Notes</span>
          <p>${r.variante_notes}</p>
        </div>` : ''}
      </div>
    </div>
    ` : ''}
 
    ${r.anecdote ? `
    <div class="fiche-section fiche-anecdote">
      <h3>📖 Histoire</h3>
      <p>${r.anecdote}</p>
    </div>
    ` : ''}
 
    <div class="fiche-action">
      <button class="btn btn-realiser" onclick="marquerRealisee(${portions})">
        ✓ Réalisée${portions > 1 ? ` (${portions} verres)` : ''} — décrémenter la cave
      </button>
    </div>
  `;
}
 
function changerPortions(n) {
  if (n < 1 || n > 10) return;
  renderFiche(n);
}
 
function hasProfil(r) {
  return r.gout_sucre || r.gout_amer || r.gout_acide || r.gout_fruite ||
         r.gout_fume  || r.gout_floral || r.gout_epice || r.gout_cremeux;
}
 
function hasVariantes(r) {
  return r.variante_alcool || r.variante_prestige || r.variante_mocktail_id || r.variante_notes;
}
 
function renderBarre(label, valeur) {
  if (!valeur) return '';
  const pct = Math.round((valeur / 10) * 100);
  const couleur = valeur >= 7 ? 'var(--accent)' : valeur >= 4 ? 'var(--accent-light)' : 'var(--text-muted)';
  return `
    <div class="barre-row">
      <span class="barre-label">${label}</span>
      <div class="barre-track">
        <div class="barre-fill" style="width:${pct}%; background:${couleur}"></div>
      </div>
      <span class="barre-val">${valeur}/10</span>
    </div>
  `;
}
 
async function marquerRealisee(portions) {
  const r = recetteOuverte;
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
 
  fermerModal('modal-fiche-recette');
 
  const feedback = document.createElement('div');
  feedback.className = 'toast-feedback';
  feedback.textContent = updates.length > 0
    ? `✓ Cave mise à jour (${updates.length} bouteille${updates.length > 1 ? 's' : ''} décrémentée${updates.length > 1 ? 's' : ''})`
    : '✓ Recette marquée comme réalisée';
  document.body.appendChild(feedback);
  setTimeout(() => feedback.classList.add('visible'), 50);
  setTimeout(() => { feedback.classList.remove('visible'); setTimeout(() => feedback.remove(), 300); }, 2500);
 
  renderCave();
}
 
// =============================================
// MODALS CAVE
// =============================================
 
function ouvrirModalItem(itemId, catId) {
  const item = trouverItem(itemId, catId);
  if (!item) return;
 
  document.getElementById('modal-ouverture-titre').textContent = item.nom;
  document.getElementById('modal-ouverture-texte').textContent = item.ouvert
    ? 'Cette bouteille est déjà marquée comme ouverte. Voulez-vous la refermer ?'
    : `Confirmer l'ouverture de ${item.nom} ?`;
 
  const conservationDiv = document.getElementById('modal-conservation-info');
  if (!item.ouvert && item.conservation) {
    conservationDiv.innerHTML = `
      <strong>⚠️ Conservation requise</strong>
      ${item.conservation.conditions}<br>
      <em>Signes d'altération : ${item.conservation.signes_alteration}</em>
    `;
    conservationDiv.style.display = 'block';
  } else {
    conservationDiv.style.display = 'none';
  }
 
  document.getElementById('btn-confirmer-ouverture').onclick = async () => {
    const nouvelEtat = !item.ouvert;
    const updates    = { ouvert: nouvelEtat, date_ouverture: nouvelEtat ? new Date().toISOString() : null };
    await db.from('items').update(updates).eq('id', itemId).eq('user_id', currentUser.id);
    item.ouvert = nouvelEtat;
    item.date_ouverture = updates.date_ouverture;
    fermerModal('modal-ouverture');
    renderCave();
  };
 
  afficherModal('modal-ouverture');
}
 
function ouvrirModalContenance(itemId, catId) {
  const item = trouverItem(itemId, catId);
  if (!item) return;
 
  document.getElementById('modal-contenance-titre').textContent = item.nom;
  const body = document.querySelector('.modal-contenance-body');
 
  body.innerHTML = `
    <div class="form-group">
      <label>Contenance totale (cl)</label>
      <div class="contenance-presets">
        ${[20, 35, 50, 70, 100].map(v => `
          <button class="preset-btn ${item.cl_total === v ? 'active' : ''}"
            onclick="setCl('cl-total', ${v})">${v}cl</button>
        `).join('')}
        <input type="number" id="input-cl-total" placeholder="autre" value="${item.cl_total ?? ''}"
          oninput="syncNiveau()">
      </div>
    </div>
 
    <div class="form-group">
      <label>Niveau actuel</label>
      <div class="niveau-btns">
        <button class="niveau-btn" onclick="setNiveau(1)">Plein</button>
        <button class="niveau-btn" onclick="setNiveau(0.75)">¾</button>
        <button class="niveau-btn" onclick="setNiveau(0.5)">½</button>
        <button class="niveau-btn" onclick="setNiveau(0.25)">¼</button>
        <button class="niveau-btn" onclick="setNiveau(0)">Vide</button>
      </div>
      <div class="form-row" style="margin-top:10px">
        <div class="form-group" style="margin:0">
          <label>ou cl restants exacts</label>
          <input type="number" id="input-cl-restants" placeholder="ex: 45"
            value="${item.cl_restants ?? ''}" oninput="syncNiveau()">
        </div>
      </div>
    </div>
  `;
 
  document.getElementById('btn-sauver-contenance').onclick = async () => {
    const cl_total    = parseInt(document.getElementById('input-cl-total')?.value)    || null;
    const cl_restants = parseFloat(document.getElementById('input-cl-restants')?.value) || null;
    const updates = { cl_total, cl_restants };
    await db.from('items').update(updates).eq('id', itemId).eq('user_id', currentUser.id);
    Object.assign(item, updates);
    fermerModal('modal-contenance');
    renderCave();
  };
 
  afficherModal('modal-contenance');
}
 
function setCl(fieldId, val) {
  const input = document.getElementById('input-' + fieldId.replace('-', '-'));
  if (input) { input.value = val; syncNiveau(); }
  document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
  event.target.classList.add('active');
}
 
function setNiveau(ratio) {
  const total = parseFloat(document.getElementById('input-cl-total')?.value);
  const inputR = document.getElementById('input-cl-restants');
  if (total && inputR) inputR.value = Math.round(total * ratio * 10) / 10;
  document.querySelectorAll('.niveau-btn').forEach(b => b.classList.remove('active'));
  event.target.classList.add('active');
}
 
function syncNiveau() {
  document.querySelectorAll('.niveau-btn').forEach(b => b.classList.remove('active'));
}
 
function ouvrirModalInfo(itemId, catId) {
  const item = trouverItem(itemId, catId);
  if (!item) return;
 
  document.getElementById('modal-info-titre').textContent = item.nom;
 
  const corps = document.getElementById('modal-info-corps');
  if (item.info_description || item.info_origine || item.info_anecdote) {
    corps.innerHTML = `
      ${item.info_description ? `
        <div class="info-bloc">
          <div class="info-bloc-titre">📋 Description</div>
          <p>${item.info_description}</p>
        </div>` : ''}
      ${item.info_origine ? `
        <div class="info-bloc">
          <div class="info-bloc-titre">🌍 Origine</div>
          <p>${item.info_origine}</p>
        </div>` : ''}
      ${item.info_anecdote ? `
        <div class="info-bloc info-bloc-anecdote">
          <div class="info-bloc-titre">💬 Anecdote</div>
          <p>${item.info_anecdote}</p>
        </div>` : ''}
    `;
  } else {
    corps.innerHTML = `<p class="info-vide">${item.detail || 'Aucune information disponible.'}</p>`;
  }
 
  afficherModal('modal-info');
}
 
function ouvrirModalAjout() {
  const modal = document.getElementById('modal-ajout');
 
  const select = document.getElementById('select-categorie-ajout');
  select.innerHTML = cave.categories
    .filter(c => !c.id.startsWith('a-acheter') && !c.id.startsWith('ingredients'))
    .map(c => `<option value="${c.id}">${c.icon} ${c.label}</option>`)
    .join('');
 
  modal.querySelector('#input-nom-ajout').value         = '';
  modal.querySelector('#input-detail-ajout').value      = '';
  modal.querySelector('#input-degre-ajout').value       = '';
  modal.querySelector('#input-prix-paye-ajout').value   = '';
  modal.querySelector('#input-cl-ajout').value          = '';
  modal.querySelector('#input-origine-ajout').value     = '';
  modal.querySelector('#input-anecdote-ajout').value    = '';
  modal.querySelector('#ajout-claude-result').innerHTML = '';
  modal.querySelector('#ajout-claude-result').classList.remove('visible');
 
  modal.querySelector('#btn-identifier-claude').onclick = async () => {
    const nom = modal.querySelector('#input-nom-ajout').value.trim();
    if (!nom) { alert("Saisissez d'abord le nom du produit."); return; }
 
    const btn = modal.querySelector('#btn-identifier-claude');
    btn.disabled = true;
    btn.textContent = '⏳ Identification…';
 
    const result = modal.querySelector('#ajout-claude-result');
    result.innerHTML = '';
 
    try {
      const response = await fetch('/api/identifier', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nom })
      });
      const info = await response.json();
 
      if (info.trop_vague) {
        result.innerHTML = '<div class="ajout-claude-warning">⚠️ Nom trop vague — précisez la marque complète.</div>';
        result.classList.add('visible');
      } else if (!info.identifie) {
        result.innerHTML = '<div class="ajout-claude-warning">❓ Produit non identifié — remplissez les champs manuellement.</div>';
        result.classList.add('visible');
      } else {
        if (info.categorie_id) select.value = info.categorie_id;
        if (info.degre) modal.querySelector('#input-degre-ajout').value = info.degre;
        if (info.description) modal.querySelector('#input-detail-ajout').value = info.description;
        if (info.origine) modal.querySelector('#input-origine-ajout').value = info.origine;
        if (info.anecdote) modal.querySelector('#input-anecdote-ajout').value = info.anecdote;
 
        result.innerHTML = `<div class="ajout-claude-success">✅ Identifié — champs pré-remplis, vérifiez et complétez.</div>`;
        result.classList.add('visible');
      }
    } catch(e) {
      result.innerHTML = "<div class='ajout-claude-warning'>Erreur d'identification. Remplissez manuellement.</div>";
      result.classList.add('visible');
    }
 
    btn.disabled = false;
    btn.textContent = '✨ Identifier avec Claude';
  };
 
  modal.querySelector('#btn-confirmer-ajout').onclick = async () => {
    const catId   = select.value;
    const nom     = modal.querySelector('#input-nom-ajout').value.trim();
    const detail  = modal.querySelector('#input-detail-ajout').value.trim();
    const degre   = parseFloat(modal.querySelector('#input-degre-ajout').value) || null;
    const prixPaye = parseFloat(modal.querySelector('#input-prix-paye-ajout').value) || null;
    const cl_total = parseInt(modal.querySelector('#input-cl-ajout').value) || null;
    const origine  = modal.querySelector('#input-origine-ajout').value.trim();
    const anecdote = modal.querySelector('#input-anecdote-ajout').value.trim();
    if (!nom) return;
 
    const newItem = {
      id:               'custom-' + Date.now(),
      user_id:          currentUser.id,
      category_id:      catId,
      nom, detail,
      degre,
      prix_estime:      prixPaye,
      cl_total,
      cl_restants:      cl_total,
      ouvert:           false,
      detenu:           true,
      conservation:     null,
      info_description: detail || null,
      info_origine:     origine || null,
      info_anecdote:    anecdote || null
    };
 
    const { data, error } = await db.from('items').insert(newItem).select().single();
    if (!error && data) {
      const cat = cave.categories.find(c => c.id === catId);
      if (cat) cat.items.push(data);
    }
 
    fermerModal('modal-ajout');
    renderCave();
  };
 
  afficherModal('modal-ajout');
}
 
function onTabChange(tab) {
  if (tab === 'aacheter') chargerAAcheter();
  if (tab === 'concoctions') chargerConcoctions();
  if (tab === 'dashboard') chargerDashboard();
}
 
document.querySelectorAll('nav button[data-tab]').forEach(btn => {
  btn.addEventListener('click', () => onTabChange(btn.dataset.tab));
});
 
function onEquipToggle(details) {
  const stats = document.getElementById('equip-summary-stats');
  if (details.open && stats) {
    const chezSoi = equipements.filter(e => e.chez_soi).length;
    const kit     = equipements.filter(e => e.en_deplacement).length;
    stats.textContent = `${chezSoi} chez soi · ${kit} en kit`;
  }
}
 
async function toggleDetenu(itemId, catId) {
  const item = trouverItem(itemId, catId);
  if (!item) return;
  const detenu = item.detenu !== false;
  const nouvelEtat = !detenu;
  await db.from('items').update({ detenu: nouvelEtat }).eq('id', itemId).eq('user_id', currentUser.id);
  item.detenu = nouvelEtat;
  renderCave();
}
 
// =============================================
// UTILITAIRES
// =============================================
 
function trouverItem(itemId, catId) {
  const cat = cave.categories.find(c => c.id === catId);
  return cat?.items.find(i => i.id === itemId);
}
 
function afficherModal(id) { document.getElementById(id).classList.add('visible'); }
function fermerModal(id)   { document.getElementById(id).classList.remove('visible'); }
 
document.addEventListener('click', e => {
  if (e.target.classList.contains('modal-overlay')) e.target.classList.remove('visible');
});
 
// =============================================
// ÉQUIPEMENTS
// =============================================
 
let equipements = [];
 
async function chargerEquipements() {
  const { data } = await db.from('equipements').select('*').order('categorie').order('nom');
  equipements = data || [];
  renderEquipements();
}
 
function renderEquipements() {
  const container = document.getElementById('equipements-container');
  if (!container) return;
 
  const categories = {
    essentiel: { label: 'Essentiels', items: [] },
    utile:     { label: 'Utiles',     items: [] },
    folklore:  { label: 'Folklore',   items: [] }
  };
 
  equipements.forEach(e => {
    if (categories[e.categorie]) categories[e.categorie].items.push(e);
  });
 
  const chezSoiCount = equipements.filter(e => e.chez_soi).length;
  const kitCount     = equipements.filter(e => e.en_deplacement).length;
 
  container.innerHTML = `
    <div class="equip-header">
      <div class="equip-stats">
        <span class="equip-stat">🏠 ${chezSoiCount} chez soi</span>
        <span class="equip-stat">🎒 ${kitCount} en déplacement</span>
      </div>
    </div>
    ${Object.entries(categories).map(([key, cat]) => `
      <div class="equip-categorie">
        <div class="equip-cat-label">${cat.label}</div>
        <div class="equip-items">
          ${cat.items.map(e => `
            <div class="equip-item">
              <div class="equip-nom">${e.nom}</div>
              ${e.prix_estime ? `<span class="item-prix">~${e.prix_estime}€</span>` : ''}
              <div class="equip-checkboxes">
                <label class="equip-check" title="Chez soi">
                  <input type="checkbox" ${e.chez_soi ? 'checked' : ''}
                    onchange="toggleEquipement('${e.id}', 'chez_soi', this.checked)">
                  🏠
                </label>
                <label class="equip-check" title="En déplacement">
                  <input type="checkbox" ${e.en_deplacement ? 'checked' : ''}
                    onchange="toggleEquipement('${e.id}', 'en_deplacement', this.checked)">
                  🎒
                </label>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `).join('')}
  `;
}
 
async function toggleEquipement(id, champ, valeur) {
  const equip = equipements.find(e => e.id === id);
  if (!equip) return;
  await db.from('equipements').update({ [champ]: valeur }).eq('id', id).eq('user_id', currentUser.id);
  equip[champ] = valeur;
  const chezSoiCount = equipements.filter(e => e.chez_soi).length;
  const kitCount     = equipements.filter(e => e.en_deplacement).length;
  const stats = document.querySelector('.equip-stats');
  if (stats) stats.innerHTML = `
    <span class="equip-stat">🏠 ${chezSoiCount} chez soi</span>
    <span class="equip-stat">🎒 ${kitCount} en déplacement</span>
  `;
}
 
// =============================================
// CONCOCTIONS
// =============================================
 
let concoctions = [];
 
async function chargerConcoctions() {
  const container = document.getElementById('concoctions-container');
  if (!container) return;
 
  const [{ data: concs }, { data: etapes }] = await Promise.all([
    db.from('concoctions').select('*').order('date_creation', { ascending: false }),
    db.from('concoction_etapes').select('*').order('ordre')
  ]);
 
  concoctions = (concs || []).map(c => ({
    ...c,
    etapes: (etapes || []).filter(e => e.concoction_id === c.id)
  }));
 
  renderConcoctions();
}
 
function renderConcoctions() {
  const container = document.getElementById('concoctions-container');
  if (!container) return;
 
  const typeLabels = { batch: '🧊 Batch', maceration: '🌿 Macération', infusion: '☕ Infusion', liqueur: '🍯 Liqueur' };
  const statutLabels = { en_cours: 'En cours', pret: 'Prêt', termine: 'Terminé' };
  const statutClass  = { en_cours: 'statut-en-cours', pret: 'statut-plein', termine: 'statut-inconnu' };
 
  const enCours = concoctions.filter(c => c.statut === 'en_cours');
  const prets   = concoctions.filter(c => c.statut === 'pret');
 
  container.innerHTML = `
    <div class="conc-toolbar">
      <button class="btn btn-outline" onclick="ouvrirModalAjoutConcoction()">+ Ajouter</button>
    </div>
 
    ${enCours.length > 0 ? `
    <div class="conc-section">
      <h3 class="conc-section-titre">⏳ En cours (${enCours.length})</h3>
      ${enCours.map(c => renderConcoction(c, typeLabels, statutLabels, statutClass)).join('')}
    </div>` : ''}
 
    ${prets.length > 0 ? `
    <div class="conc-section">
      <h3 class="conc-section-titre">✅ Prêts</h3>
      ${prets.map(c => renderConcoction(c, typeLabels, statutLabels, statutClass)).join('')}
    </div>` : ''}
 
    ${concoctions.length === 0 ? '<div class="empty-state">Aucune concoction en cours. Commencez par le génépi !</div>' : ''}
  `;
}
 
function renderConcoction(c, typeLabels, statutLabels, statutClass) {
  const today = new Date();
  today.setHours(0,0,0,0);
 
  const prochaineEtape = c.etapes?.find(e => !e.faite);
  const etapesFaites   = c.etapes?.filter(e => e.faite).length || 0;
  const etapesTotal    = c.etapes?.length || 0;
 
  let joursEtape = null;
  if (prochaineEtape?.date_etape) {
    const d = new Date(prochaineEtape.date_etape);
    joursEtape = Math.ceil((d - today) / 86400000);
  }
 
  let joursFin = null;
  if (c.date_fin) {
    const d = new Date(c.date_fin);
    joursFin = Math.ceil((d - today) / 86400000);
  }
 
  const urgenceClass = joursEtape !== null && joursEtape <= 3 ? 'conc-urgent' : '';
 
  return `
    <div class="conc-card ${urgenceClass}">
      <div class="conc-card-header">
        <div>
          <div class="conc-nom">${c.nom}</div>
          <div class="conc-meta">
            <span class="conc-type">${typeLabels[c.type] || c.type}</span>
            ${c.contenance_cl ? `<span class="conc-vol">${c.contenance_cl}cl</span>` : ''}
            <span class="item-statut ${statutClass[c.statut]}">${statutLabels[c.statut]}</span>
          </div>
        </div>
        ${joursFin !== null ? `
        <div class="conc-countdown ${joursFin <= 7 ? 'countdown-soon' : ''}">
          ${joursFin > 0 ? `<span class="countdown-val">${joursFin}</span><span class="countdown-label">jours</span>` : '<span class="countdown-val">🎉</span>'}
        </div>` : ''}
      </div>
 
      ${c.description ? `<p class="conc-desc">${c.description}</p>` : ''}
 
      ${etapesTotal > 0 ? `
      <div class="conc-etapes">
        <div class="conc-etapes-progress">
          <div class="conc-progress-bar">
            <div class="conc-progress-fill" style="width:${Math.round((etapesFaites/etapesTotal)*100)}%"></div>
          </div>
          <span class="conc-progress-label">${etapesFaites}/${etapesTotal} étapes</span>
        </div>
        <div class="conc-etapes-list">
          ${c.etapes.map(e => `
            <div class="conc-etape ${e.faite ? 'etape-faite' : ''} ${e === prochaineEtape ? 'etape-prochaine' : ''}">
              <button class="etape-check" onclick="toggleEtapeConcoction('${c.id}', ${e.id}, ${!e.faite})">
                ${e.faite ? '✓' : '○'}
              </button>
              <div class="etape-content">
                <div class="etape-titre-conc">${e.titre}</div>
                <div class="etape-desc-conc">${e.description}</div>
                ${e.date_etape ? '<div class="etape-date">' + formatDate(e.date_etape) + (joursEtape !== null && e === prochaineEtape ? ' <span class="etape-jours' + (joursEtape <= 3 ? ' jours-urgent' : '') + '">(' + (joursEtape > 0 ? 'dans ' + joursEtape + 'j' : "aujourd'hui !") + ')</span>' : '') + '</div>' : ''}
              </div>
            </div>
          `).join('')}
        </div>
      </div>` : ''}
 
      ${c.notes ? `<div class="conc-notes">💡 ${c.notes}</div>` : ''}
 
      <div class="conc-actions">
        ${c.statut === 'en_cours' ? `<button class="btn btn-outline btn-sm" onclick="marquerPret('${c.id}')">✅ Marquer prêt</button>` : ''}
        ${c.statut === 'pret' ? `<button class="btn btn-outline btn-sm" onclick="marquerEnCours('${c.id}')">↩ Remettre en cours</button>` : ''}
        <button class="btn-icon btn-supprimer" onclick="supprimerConcoction('${c.id}')" title="Supprimer définitivement">🗑</button>
      </div>
    </div>
  `;
}
 
function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}
 
async function toggleEtapeConcoction(concId, etapeId, faite) {
  await db.from('concoction_etapes').update({ faite }).eq('id', etapeId).eq('user_id', currentUser.id);
  const conc = concoctions.find(c => c.id === concId);
  if (conc) {
    const etape = conc.etapes.find(e => e.id === etapeId);
    if (etape) etape.faite = faite;
  }
  renderConcoctions();
}
 
async function marquerPret(concId) {
  await db.from('concoctions').update({ statut: 'pret' }).eq('id', concId).eq('user_id', currentUser.id);
  const conc = concoctions.find(c => c.id === concId);
  if (conc) conc.statut = 'pret';
  renderConcoctions();
}
 
async function marquerEnCours(concId) {
  await db.from('concoctions').update({ statut: 'en_cours' }).eq('id', concId).eq('user_id', currentUser.id);
  const conc = concoctions.find(c => c.id === concId);
  if (conc) conc.statut = 'en_cours';
  renderConcoctions();
}
 
async function supprimerConcoction(concId) {
  const conc = concoctions.find(c => c.id === concId);
  if (!confirm(`Supprimer définitivement "${conc?.nom}" ? Cette action est irréversible.`)) return;
  await db.from('concoctions').delete().eq('id', concId).eq('user_id', currentUser.id);
  concoctions = concoctions.filter(c => c.id !== concId);
  renderConcoctions();
}
 
function ouvrirModalAjoutConcoction() {
  const modal = document.getElementById('modal-ajout-concoction');
  if (!modal) return;
  modal.querySelector('#input-conc-nom').value = '';
  modal.querySelector('#input-conc-type').value = 'batch';
  modal.querySelector('#input-conc-desc').value = '';
  modal.querySelector('#input-conc-date').value = new Date().toISOString().split('T')[0];
  modal.querySelector('#input-conc-notes').value = '';
 
  modal.querySelector('#btn-sauver-concoction').onclick = async () => {
    const nom   = modal.querySelector('#input-conc-nom').value.trim();
    const type  = modal.querySelector('#input-conc-type').value;
    const desc  = modal.querySelector('#input-conc-desc').value.trim();
    const date  = modal.querySelector('#input-conc-date').value;
    const notes = modal.querySelector('#input-conc-notes').value.trim();
    if (!nom) return;
 
    const id = 'custom-conc-' + Date.now();
    const { data } = await db.from('concoctions').insert({
      id, user_id: currentUser.id, nom, type, description: desc,
      date_creation: date, statut: 'en_cours', notes
    }).select().single();
 
    if (data) concoctions.unshift({ ...data, etapes: [] });
    fermerModal('modal-ajout-concoction');
    renderConcoctions();
  };
 
  afficherModal('modal-ajout-concoction');
}
 
// =============================================
// À ACHETER
// =============================================
 
async function chargerAAcheter() {
  const container = document.getElementById('aacheter-container');
  if (!container) return;
  container.innerHTML = '<div class="loading-state">Calcul en cours…</div>';
 
  const caveIds = getItemsCave();
  const { data: allItems } = await db.from('items').select('id, nom, prix_estime, detenu, category_id').eq('user_id', currentUser.id);
  const { data: aAcheter } = await db.from('a_acheter').select('*').eq('user_id', currentUser.id);
 
  const catGroupes = {
    spiritueux:    { label: '🥃 Spiritueux',       ids: ['a-acheter-spirits'] },
    liqueurs:      { label: '🍯 Liqueurs',          ids: ['a-acheter-liqueurs'] },
    vins_amers:    { label: '🍷 Vins & Amers',      ids: ['a-acheter-vins', 'a-acheter-bitters'] },
    sirops:        { label: '🍬 Sirops & Épicerie', ids: ['a-acheter-sirops', 'ingredients-frais'] }
  };
 
  const scoreMap = {};
  recettes.forEach(r => {
    const manquants = (r.ingredients || []).filter(i => i.item_cave_id && !caveIds.has(i.item_cave_id) && !i.optionnel);
    manquants.forEach(ing => {
      if (!scoreMap[ing.item_cave_id]) {
        const itemData = allItems?.find(i => i.id === ing.item_cave_id);
        scoreMap[ing.item_cave_id] = {
          id: ing.item_cave_id,
          nom: ing.nom,
          count: 0,
          prix: itemData?.prix_estime || null,
          category_id: itemData?.category_id || null,
          recettesDetail: []
        };
      }
      scoreMap[ing.item_cave_id].count++;
      scoreMap[ing.item_cave_id].recettesDetail.push(r);
    });
  });
 
  const allScored = Object.values(scoreMap).sort((a, b) => b.count - a.count);
 
  function renderGroupe(groupe, items) {
    if (items.length === 0) return '';
    return `
      <div class="aacheter-groupe">
        <h3 class="aacheter-groupe-titre">${groupe.label}</h3>
        <div class="aacheter-liste">
          ${items.map(item => `
            <div class="aacheter-item">
              <div class="aacheter-item-header">
                <div class="aacheter-nom">${item.nom}</div>
                <div class="aacheter-right">
                  ${item.prix ? `<span class="item-prix">~${item.prix}€</span>` : ''}
                  <span class="aacheter-badge">${item.count} recette${item.count > 1 ? 's' : ''}</span>
                </div>
              </div>
              <div class="aacheter-recettes-detail">
                ${item.recettesDetail.slice(0, 4).map(r => `
                  <div class="aacheter-recette-chip">
                    <span class="chip-nom">${r.nom}</span>
                    ${r.base_alcool ? `<span class="chip-base">${r.base_alcool}</span>` : ''}
                    <span class="chip-diff diff-${r.difficulte}">${{facile:'Facile',moyen:'Moyen',avance:'Avancé'}[r.difficulte]||''}</span>
                    <div class="chip-gouts">${(r.gouts||[]).slice(0,3).map(g=>`<span class="tag-gout">${g}</span>`).join('')}</div>
                  </div>
                `).join('')}
                ${item.recettesDetail.length > 4 ? `<div class="chip-more">+${item.recettesDetail.length-4} autres recettes</div>` : ''}
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }
 
  const grouped = {};
  Object.keys(catGroupes).forEach(k => grouped[k] = []);
 
  allScored.forEach(item => {
    for (const [key, groupe] of Object.entries(catGroupes)) {
      if (groupe.ids.includes(item.category_id)) {
        grouped[key].push(item);
        return;
      }
    }
    grouped['spiritueux'].push(item);
  });
 
  const prioritaires = (aAcheter || []).filter(a => !scoreMap[a.id]);
 
  container.innerHTML = `
    <div class="aacheter-header">
      <p class="aacheter-intro">Ingrédients qui débloquent des recettes supplémentaires, classés par catégorie.</p>
    </div>
 
    ${Object.entries(catGroupes).map(([key, groupe]) =>
      renderGroupe(groupe, grouped[key])
    ).join('')}
 
    ${prioritaires.length > 0 ? `
    <div class="aacheter-groupe">
      <h3 class="aacheter-groupe-titre">⭐ Prioritaires (sans recette liée)</h3>
      <div class="aacheter-liste">
        ${prioritaires.map(item => `
          <div class="aacheter-item">
            <div class="aacheter-item-header">
              <div class="aacheter-nom">${item.nom}</div>
              ${item.prix_estime ? `<span class="item-prix">~${item.prix_estime}€</span>` : ''}
            </div>
            <div class="aacheter-raison">${item.raison}</div>
          </div>
        `).join('')}
      </div>
    </div>
    ` : ''}
 
    <div class="aacheter-groupe">
      <button class="btn btn-outline btn-apport" id="btn-apport-gustatif" onclick="chargerApportGustatif()">
        ✨ Analyser l'apport gustatif (Claude)
      </button>
      <div id="apport-gustatif-result"></div>
    </div>
  `;
}
 
async function chargerApportGustatif() {
  const btn = document.getElementById('btn-apport-gustatif');
  const result = document.getElementById('apport-gustatif-result');
  btn.disabled = true;
  btn.textContent = '⏳ Analyse en cours…';
 
  const caveIds = getItemsCave();
  const { data: allItems } = await db.from('items').select('id, nom, detenu').eq('user_id', currentUser.id);
  const caveNoms = allItems?.filter(i => i.detenu !== false).map(i => i.nom).join(', ') || '';
  const scoreMap = {};
  recettes.forEach(r => {
    (r.ingredients || []).filter(i => i.item_cave_id && !caveIds.has(i.item_cave_id) && !i.optionnel).forEach(ing => {
      scoreMap[ing.nom] = (scoreMap[ing.nom] || 0) + 1;
    });
  });
  const manquantsTop = Object.entries(scoreMap).sort((a,b) => b[1]-a[1]).slice(0,8).map(([nom]) => nom).join(', ');
 
  try {
    const apportResponse = await fetch('/api/apport', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ caveNoms, manquantsTop })
    });
    const items = await apportResponse.json();
    result.innerHTML = `
      <div class="apport-liste">
        ${items.map(i => `
          <div class="apport-item">
            <div class="apport-nom">${i.nom}</div>
            <div class="apport-texte">${i.apport}</div>
          </div>
        `).join('')}
      </div>
    `;
  } catch(e) {
    result.innerHTML = '<div class="apport-error">Erreur lors de l\'analyse.</div>';
  }
 
  btn.disabled = false;
  btn.textContent = "✨ Rafraîchir l'analyse (Claude)";
}
 
// =============================================
// QR CODE
// =============================================
 
let qrGenerated = false;
 
function toggleQR() {
  const popup = document.getElementById('qr-popup');
  popup.classList.toggle('visible');
 
  if (!qrGenerated && popup.classList.contains('visible')) {
   const url = encodeURIComponent('https://bar-cocktail-smoky.vercel.app');
    const img = document.getElementById('qr-img');
    img.src = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&bgcolor=16213e&color=f0e6d3&data=${url}`;
    qrGenerated = true;
  }
}
 
document.addEventListener('click', e => {
  const popup = document.getElementById('qr-popup');
  const btn   = document.getElementById('btn-qr');
  if (popup && !popup.contains(e.target) && e.target !== btn) {
    popup.classList.remove('visible');
  }
});
 
// =============================================
// LANCEMENT
// =============================================
async function chargerDashboard() {
  const container = document.getElementById('dashboard-container');
  if (!container) return;
 
  // Recettes réalisables (cocktails uniquement)
  const realisables = recettes.filter(r => r.type === 'cocktail' && calculerDisponibilite(r) === 0);
 
  // Prix total cave
  const prixTotal = cave.categories.reduce((sum, cat) =>
    sum + cat.items.filter(i => i.detenu !== false && i.prix_estime)
                   .reduce((s, i) => s + parseFloat(i.prix_estime), 0), 0);
 
  // Conservations urgentes
  const conservations = [];
  cave.categories.forEach(cat => {
    cat.items.forEach(item => {
      if (item.ouvert && item.conservation) {
        const joursEcoules = Math.floor((Date.now() - new Date(item.date_ouverture || Date.now())) / 86400000);
        const joursMax = item.conservation.duree_mois * 30;
        const joursRestants = Math.round(joursMax - joursEcoules);
        conservations.push({ nom: item.nom, joursRestants });
      }
    });
  });
  conservations.sort((a, b) => a.joursRestants - b.joursRestants);
 
  // Concoctions en cours
  const concEnCours = concoctions.filter(c => c.statut === 'en_cours');
 
  // Anecdote + conseil aléatoires
  const [{ data: anecdote }, { data: conseil }] = await Promise.all([
    db.from('anecdotes').select('*').limit(50).then(r => ({ data: r.data?.[Math.floor(Math.random() * r.data.length)] })),
    db.from('conseils').select('*').limit(50).then(r => ({ data: r.data?.[Math.floor(Math.random() * r.data.length)] }))
  ]);
 
  renderDashboard({ realisables, prixTotal, conservations, concEnCours, anecdote, conseil });
}
 
function renderDashboard({ realisables, prixTotal, conservations, concEnCours, anecdote, conseil }) {
  const container = document.getElementById('dashboard-container');
  const categorieLabel = { technique: 'Technique', gestion: 'Gestion', service: 'Service' };
  const categorieClass = { technique: 'badge-3', gestion: 'badge-ok', service: 'badge-1' };
 
  const nbConservations = conservations.length;
  const nbConcoctions   = concEnCours.length;
  const nbRefs          = cave.categories.reduce((n, c) => n + c.items.filter(i => i.detenu !== false).length, 0);
 
  container.innerHTML = `
 
    <!-- TUILES STATISTIQUES -->
    <div class="dashboard-grid-top">
      <div class="dash-stat">
        <span class="dash-stat-label">Réalisables maintenant</span>
        <span class="dash-stat-val dash-val-accent">${realisables.length}</span>
        <span class="dash-stat-sub">sur ${recettes.filter(r => r.type === 'cocktail').length} cocktails</span>
      </div>
      <div class="dash-stat">
        <span class="dash-stat-label">Valeur cave</span>
        <span class="dash-stat-val">${prixTotal.toFixed(0)} €</span>
        <span class="dash-stat-sub">${nbRefs} références</span>
      </div>
      <div class="dash-stat">
        <span class="dash-stat-label">Concoctions</span>
        <span class="dash-stat-val ${nbConcoctions > 0 ? 'dash-val-warning' : ''}">${nbConcoctions}</span>
        <span class="dash-stat-sub">${nbConcoctions > 0
          ? concEnCours[0].nom + (concEnCours[0].date_fin
            ? ' · ' + Math.ceil((new Date(concEnCours[0].date_fin) - new Date()) / 86400000) + 'j'
            : '')
          : 'aucune en cours'}</span>
      </div>
      <div class="dash-stat">
        <span class="dash-stat-label">Conservations</span>
        <span class="dash-stat-val ${nbConservations > 0 ? 'dash-val-danger' : ''}">${nbConservations}</span>
        <span class="dash-stat-sub">${nbConservations > 0 ? 'à surveiller' : 'tout est bon'}</span>
      </div>
    </div>
 
    <!-- GRILLE PRINCIPALE -->
    <div class="dashboard-grid-main">
 
      <!-- COLONNE GAUCHE : recettes réalisables -->
      <div class="dash-card">
        <div class="dash-card-header">
          <span class="dash-card-titre">Réalisables ce soir</span>
          <button class="dash-link" onclick="
            document.querySelectorAll('nav button').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-section').forEach(s => s.classList.add('hidden'));
            document.querySelector('nav button[data-tab=recettes]').classList.add('active');
            document.getElementById('section-recettes').classList.remove('hidden');
            filtreDisponible = true;
            renderRecettes();
          ">Voir tout</button>
        </div>
        <div class="dash-recettes-liste">
          ${realisables.length === 0
            ? '<div class="dash-empty">Aucun cocktail réalisable avec la cave actuelle.</div>'
            : realisables.slice(0, 5).map(r => `
              <div class="dash-recette-item" onclick="
                document.querySelectorAll('nav button').forEach(b => b.classList.remove('active'));
                document.querySelectorAll('.tab-section').forEach(s => s.classList.add('hidden'));
                document.querySelector('nav button[data-tab=recettes]').classList.add('active');
                document.getElementById('section-recettes').classList.remove('hidden');
                sectionRecette = 'cocktail';
                ouvrirFicheRecette('${r.id}');
              ">
                ${r.photo_url
                  ? `<img src="${r.photo_url}" alt="${r.nom}" class="dash-recette-img" loading="lazy" onerror="this.style.display='none'">`
                  : `<div class="dash-recette-img dash-recette-img--fallback">${r.nom.charAt(0)}</div>`}
                <div class="dash-recette-info">
                  <div class="dash-recette-nom">${r.nom}</div>
                  <div class="dash-recette-meta">${r.base_alcool ? r.base_alcool + ' · ' : ''}${(r.gouts || []).slice(0, 2).join(' · ')}</div>
                </div>
                <span class="badge-dispo badge-ok">✓</span>
              </div>
            `).join('')}
        </div>
      </div>
 
      <!-- COLONNE DROITE -->
      <div class="dash-col-droite">
 
        ${nbConservations > 0 ? `
        <div class="dash-card">
          <div class="dash-card-titre" style="margin-bottom:10px">Conservations</div>
          ${conservations.slice(0, 4).map(c => {
            const niveau  = c.joursRestants <= 14 ? 'rouge' : c.joursRestants <= 90 ? 'orange' : 'vert';
            const couleur = niveau === 'rouge' ? 'dash-val-danger' : niveau === 'orange' ? 'dash-val-warning' : 'dash-val-ok';
            return `
              <div class="dash-conservation-item">
                <div class="conservation-dot dot-${niveau}"></div>
                <span class="dash-conservation-nom">${c.nom}</span>
                <span class="dash-conservation-delai ${couleur}">${c.joursRestants > 0 ? c.joursRestants + 'j' : 'expiré'}</span>
              </div>`;
          }).join('')}
        </div>` : ''}
 
        <!-- ANECDOTE -->
        <div class="dash-card dash-card--accent">
          <div class="dash-card-header">
            <span class="dash-card-titre">Anecdote du jour</span>
            <button class="dash-refresh-btn" onclick="rechargerAnecdote()" title="Nouvelle anecdote">↻</button>
          </div>
          <p class="dash-anecdote-texte" id="dash-anecdote-texte">${anecdote?.texte || 'Chargement…'}</p>
        </div>
 
        <!-- CONSEIL -->
        <div class="dash-card">
          <div class="dash-card-header">
            <div style="display:flex;align-items:center;gap:8px;">
              <span class="dash-card-titre">Conseil du jour</span>
              <span class="badge-dispo ${categorieClass[conseil?.categorie] || 'badge-ok'}" style="font-size:0.68rem;">${categorieLabel[conseil?.categorie] || ''}</span>
            </div>
            <button class="dash-refresh-btn" onclick="rechargerConseil()" title="Nouveau conseil">↻</button>
          </div>
          <p class="dash-conseil-texte" id="dash-conseil-texte">${conseil?.texte || 'Chargement…'}</p>
        </div>
 
      </div>
    </div>
  `;
}
 
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
let plantesList = [];
let filtreHerboFamille = '';
let filtreHerboUsage = '';
let plantesOuverte = null;
 
// =============================================
// CHARGEMENT
// =============================================
 
async function chargerHerboristerie() {
  const container = document.getElementById('herboristerie-container');
  if (!container) return;
  container.innerHTML = '<div class="loading-state">Chargement…</div>';
 
  const { data: plantes } = await db.from('plantes').select('*').order('nom');
  if (!plantes) return;
 
  plantesList = plantes;
  renderHerboristerie(plantes);
}
 
// =============================================
// RENDU LISTE
// =============================================
 
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
  `;
 
  afficherModal('modal-fiche-plante');
}
init();
