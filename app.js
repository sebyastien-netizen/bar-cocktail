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

  // Prix total cave
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
  const detenu = item.detenu !== false; // true par défaut si null
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
    if (item.detenu !== false) ids.add(item.id); // seuls les détenus
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
    db.from('recettes').select('*, gout_sucre, gout_amer, gout_acide, gout_fruite, gout_fume, gout_floral, gout_epice, gout_cremeux, degustation_voir, degustation_sentir, degustation_gout, degustation_finish, degustation_defi, variante_alcool, variante_prestige, variante_mocktail_id, variante_notes, prix_portion, kit_portable'),
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

  // Filtrer par section
  let liste = recettes.filter(r => r.type === sectionRecette);

  // Filtre base alcool
  if (filtreBase) liste = liste.filter(r => r.base_alcool === filtreBase);

  // Filtre goût
  if (filtreGout) liste = liste.filter(r => r.gouts && r.gouts.includes(filtreGout));

  // Filtre difficulté
  if (filtreDiff) liste = liste.filter(r => r.difficulte === filtreDiff);

  // Tri : réalisables en premier si demandé
  if (filtreDisponible) {
    liste = [...liste].sort((a, b) => calculerDisponibilite(a) - calculerDisponibilite(b));
  }

  // Bases disponibles pour les filtres
  const bases = [...new Set(recettes.filter(r => r.type === sectionRecette && r.base_alcool).map(r => r.base_alcool))].sort();
  const gouts = [...new Set(recettes.filter(r => r.type === sectionRecette).flatMap(r => r.gouts || []))].sort();

  container.innerHTML = `
    <!-- Sous-navigation sections -->
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

    <!-- Filtres -->
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

    <!-- Grille de cartes -->
    <div class="recettes-grille">
      ${liste.length === 0 ? '<div class="empty-state">Aucune recette trouvée.</div>' : ''}
      ${liste.map(r => renderCarteRecette(r)).join('')}
    </div>
  `;
}

function renderCarteRecette(r) {
  const nbManquants = calculerDisponibilite(r);
  const diffLabel   = { facile: 'Facile', moyen: 'Moyen', avance: 'Avancé' }[r.difficulte] || r.difficulte;
  const diffClass   = { facile: 'diff-facile', moyen: 'diff-moyen', avance: 'diff-avance' }[r.difficulte] || '';

  return `
    <div class="carte-recette" onclick="ouvrirFicheRecette('${r.id}')">
      <div class="carte-top">
        <div class="carte-nom">${r.nom}</div>
        <span class="carte-diff ${diffClass}">${diffLabel}</span>
      </div>
      ${r.base_alcool ? `<div class="carte-base">🥃 ${r.base_alcool}</div>` : ''}
      <div class="carte-gouts">
        ${(r.gouts || []).map(g => `<span class="tag-gout">${g}</span>`).join('')}
      </div>
      <div class="carte-footer">
        ${badgeDisponibilite(nbManquants)}
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
// FICHE RECETTE — Rendu complet v2
// Sélecteur portions, profil gustatif,
// dégustation, variantes, prix, bouton Réalisée
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

  // Conseil organisation si portions >= 2
  const conseilOrga = portions >= 2 ? `
    <div class="conseil-orga">
      <span class="conseil-icon">🍹</span>
      <span>Pour ${portions} verres : préparez tous les ingrédients à l'avance. Shakez en plusieurs fois (max 2 portions par shaker). Servez rapidement.</span>
    </div>
  ` : '';

  // Prix estimé
  const prixHtml = r.prix_portion ? `
    <span class="tag-prix">~${(r.prix_portion * portions).toFixed(2)}€${portions > 1 ? ` (${portions} verres)` : ''}</span>
  ` : '';

  // Badge kit portable
  const kitHtml = r.kit_portable ? `<span class="tag-kit">✓ KIT</span>` : '';

  document.querySelector('.fiche-contenu').innerHTML = `

    <!-- EN-TÊTE -->
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

    <!-- SÉLECTEUR PORTIONS -->
    <div class="fiche-portions">
      <span class="portions-label">Portions</span>
      <div class="portions-ctrl">
        <button class="portions-btn" onclick="changerPortions(${portions - 1})" ${portions <= 1 ? 'disabled' : ''}>−</button>
        <span class="portions-val">${portions}</span>
        <button class="portions-btn" onclick="changerPortions(${portions + 1})" ${portions >= 10 ? 'disabled' : ''}>+</button>
      </div>
    </div>
    ${conseilOrga}

    <!-- INGRÉDIENTS -->
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

    <!-- MATÉRIELS -->
    ${r.materiels && r.materiels.length > 0 ? `
    <div class="fiche-section">
      <h3>Matériels</h3>
      <div class="fiche-materiels">
        ${r.materiels.map(m => `<span class="tag-materiel ${m.essentiel ? '' : 'materiel-optionnel'}">${m.nom}</span>`).join('')}
      </div>
    </div>
    ` : ''}

    <!-- ÉTAPES -->
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

    <!-- PROFIL GUSTATIF -->
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

    <!-- GUIDE DÉGUSTATION -->
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

    <!-- VARIANTES -->
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

    <!-- ANECDOTE -->
    ${r.anecdote ? `
    <div class="fiche-section fiche-anecdote">
      <h3>📖 Histoire</h3>
      <p>${r.anecdote}</p>
    </div>
    ` : ''}

    <!-- BOUTON RÉALISÉE -->
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

  // Décrémenter les cl_restants pour chaque ingrédient présent en cave
  const updates = [];
  for (const ing of (r.ingredients || [])) {
    if (!ing.item_cave_id || !ing.quantite || !ing.unite) continue;
    if (!caveIds.has(ing.item_cave_id)) continue;
    if (ing.unite !== 'cl') continue; // seulement les cl

    // Trouver l'item dans la cave
    for (const cat of cave.categories) {
      const item = cat.items.find(i => i.id === ing.item_cave_id);
      if (item && item.cl_restants !== null) {
        const nouveau = Math.max(0, item.cl_restants - (ing.quantite * portions));
        updates.push({ item, nouveau });
      }
    }
  }

  // Appliquer les mises à jour
  for (const { item, nouveau } of updates) {
    await db.from('items').update({ cl_restants: nouveau }).eq('id', item.id).eq('user_id', currentUser.id);
    item.cl_restants = nouveau;
  }

  fermerModal('modal-fiche-recette');

  // Feedback visuel
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


// --- MODAL CONTENANCE ---

function ouvrirModalContenance(itemId, catId) {
  const item = trouverItem(itemId, catId);
  if (!item) return;

  document.getElementById('modal-contenance-titre').textContent = item.nom;
  const body = document.querySelector('.modal-contenance-body');

  body.innerHTML = `
    <!-- MODE RAPIDE -->
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
  // Highlight preset actif
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
  // Désactiver les boutons niveau si saisie manuelle
  document.querySelectorAll('.niveau-btn').forEach(b => b.classList.remove('active'));
}


function ouvrirModalInfo(itemId, catId) {
  const item = trouverItem(itemId, catId);
  if (!item) return;
  document.getElementById('modal-info-titre').textContent = item.nom;
  document.getElementById('modal-info-texte').textContent = item.detail || 'Aucune description disponible.';
  afficherModal('modal-info');
}

function ouvrirModalAjout() {
  const select = document.getElementById('select-categorie-ajout');
  select.innerHTML = cave.categories.map(c =>
    `<option value="${c.id}">${c.icon} ${c.label}</option>`
  ).join('');

  document.getElementById('input-nom-ajout').value    = '';
  document.getElementById('input-detail-ajout').value = '';

  document.getElementById('btn-confirmer-ajout').onclick = async () => {
    const catId  = select.value;
    const nom    = document.getElementById('input-nom-ajout').value.trim();
    const detail = document.getElementById('input-detail-ajout').value.trim();
    if (!nom) return;

    const newItem = {
      id: 'custom-' + Date.now(), user_id: currentUser.id,
      category_id: catId, nom, detail,
      ouvert: false, conservation: null, cl_total: null, cl_restants: null, prix_estime: null
    };

    const { data, error } = await db.from('items').insert(newItem).select().single();
    if (!error && data) {
      const cat = cave.categories.find(c => c.id === catId);
      cat.items.push(data);
    }

    fermerModal('modal-ajout');
    renderCave();
  };

  afficherModal('modal-ajout');
}

// --- ONGLET À ACHETER ---
function onTabChange(tab) {
  if (tab === 'aacheter') chargerAAcheter();
}

// Surcharger la navigation pour déclencher chargement
document.querySelectorAll('nav button[data-tab]').forEach(btn => {
  btn.addEventListener('click', () => onTabChange(btn.dataset.tab));
});

// --- ÉQUIPEMENTS TOGGLE ---
function onEquipToggle(details) {
  const stats = document.getElementById('equip-summary-stats');
  if (details.open && stats) {
    const chezSoi = equipements.filter(e => e.chez_soi).length;
    const kit     = equipements.filter(e => e.en_deplacement).length;
    stats.textContent = `${chezSoi} chez soi · ${kit} en kit`;
  }
}

// --- TOGGLE DÉTENU ---
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
  // Mettre à jour juste les stats sans re-render complet
  const chezSoiCount = equipements.filter(e => e.chez_soi).length;
  const kitCount     = equipements.filter(e => e.en_deplacement).length;
  const stats = document.querySelector('.equip-stats');
  if (stats) stats.innerHTML = `
    <span class="equip-stat">🏠 ${chezSoiCount} chez soi</span>
    <span class="equip-stat">🎒 ${kitCount} en déplacement</span>
  `;
}

// =============================================
// À ACHETER
// =============================================

async function chargerAAcheter() {
  const container = document.getElementById('aacheter-container');
  if (!container) return;
  container.innerHTML = '<div class="loading-state">Calcul en cours…</div>';

  // Récupérer toutes les recettes avec leurs ingrédients
  const caveIds = getItemsCave();
  const { data: allItems } = await db.from('items').select('id, nom, prix_estime, detenu').eq('user_id', currentUser.id);

  // Calculer quels ingrédients débloquent le plus de recettes
  const scoreMap = {};
  recettes.forEach(r => {
    const manquants = (r.ingredients || []).filter(i => i.item_cave_id && !caveIds.has(i.item_cave_id) && !i.optionnel);
    manquants.forEach(ing => {
      if (!scoreMap[ing.item_cave_id]) {
        const itemData = allItems?.find(i => i.id === ing.item_cave_id);
        scoreMap[ing.item_cave_id] = { nom: ing.nom, count: 0, prix: itemData?.prix_estime || null, recettes: [] };
      }
      scoreMap[ing.item_cave_id].count++;
      scoreMap[ing.item_cave_id].recettes.push(r.nom);
    });
  });

  // Trier par score
  const sorted = Object.entries(scoreMap)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 15);

  // Éléments de la liste a_acheter
  const { data: aAcheter } = await db.from('a_acheter').select('*').eq('user_id', currentUser.id);

  container.innerHTML = `
    ${sorted.length > 0 ? `
    <div class="aacheter-section">
      <h3 class="aacheter-titre">🔓 Débloquent le plus de recettes</h3>
      <div class="aacheter-liste">
        ${sorted.map(([id, item]) => `
          <div class="aacheter-item">
            <div class="aacheter-info">
              <div class="aacheter-nom">${item.nom}</div>
              <div class="aacheter-recettes">${item.recettes.slice(0,3).join(', ')}${item.recettes.length > 3 ? ` +${item.recettes.length-3}` : ''}</div>
            </div>
            <div class="aacheter-right">
              ${item.prix ? `<span class="item-prix">~${item.prix}€</span>` : ''}
              <span class="aacheter-badge">${item.count} recette${item.count > 1 ? 's' : ''}</span>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
    ` : '<div class="empty-state">🎉 Ta cave couvre toutes les recettes !</div>'}

    ${aAcheter && aAcheter.length > 0 ? `
    <div class="aacheter-section">
      <h3 class="aacheter-titre">⭐ Liste prioritaire</h3>
      <div class="aacheter-liste">
        ${aAcheter.map(item => `
          <div class="aacheter-item">
            <div class="aacheter-info">
              <div class="aacheter-nom">${item.nom}</div>
              <div class="aacheter-recettes">${item.raison}</div>
            </div>
            ${item.prix_estime ? `<span class="item-prix">~${item.prix_estime}€</span>` : ''}
          </div>
        `).join('')}
      </div>
    </div>
    ` : ''}

    <div class="aacheter-section">
      <button class="btn btn-outline btn-apport" id="btn-apport-gustatif"
        onclick="chargerApportGustatif()">
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
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1000,
        messages: [{
          role: 'user',
          content: `Tu es un expert bartender. Cave actuelle de Seb : ${caveNoms}. Ingrédients manquants qui débloquent le plus de recettes : ${manquantsTop}. Pour chaque ingrédient manquant, explique en 1-2 phrases l'apport gustatif qu'il apporterait à la cave et quels accords il ouvrirait avec les alcools déjà présents. Réponds en JSON : [{"nom": "...", "apport": "..."}]. Uniquement le JSON, sans markdown.`
        }]
      })
    });
    const data = await response.json();
    const text = data.content?.[0]?.text || '[]';
    const items = JSON.parse(text);
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
// LANCEMENT
// =============================================
init();
