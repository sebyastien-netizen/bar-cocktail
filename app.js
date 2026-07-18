// =============================================
// BAR APP — Logique principale avec Supabase
// =============================================

const SUPABASE_URL  = 'https://wqsprjlocuhandhvpytx.supabase.co';
const SUPABASE_KEY  = 'sb_publishable_g4pDtkemUi-6VUG6qgVJWw_PAy5YibN';

const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_KEY);

let cave        = null; // données en mémoire (structure = {categories: [...], a_acheter: [...]})
let currentUser = null;
let filtreRecherche = '';

// =============================================
// INIT & AUTH
// =============================================

async function init() {
  const { data: { session } } = await db.auth.getSession();
  if (session) {
    currentUser = session.user;
    afficherApp();
  } else {
    afficherLogin();
  }

  // Écoute les changements de session (login/logout)
  db.auth.onAuthStateChange((_event, session) => {
    if (session) {
      currentUser = session.user;
      afficherApp();
    } else {
      currentUser = null;
      afficherLogin();
    }
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

// --- Inscription ---
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

// Connexion via touche Entrée
document.getElementById('input-password').addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('btn-login').click();
});

// --- Logout ---
document.getElementById('btn-logout').addEventListener('click', async () => {
  await db.auth.signOut();
});

// =============================================
// CHARGEMENT CAVE DEPUIS SUPABASE
// =============================================

async function chargerCave() {
  const container = document.getElementById('cave-container');
  container.innerHTML = '<div class="loading-state">Chargement…</div>';

  const [{ data: cats }, { data: items }, { data: aAcheter }] = await Promise.all([
    db.from('categories').select('*').order('ordre'),
    db.from('items').select('*'),
    db.from('a_acheter').select('*')
  ]);

  // Reconstruction en mémoire (même structure que l'ancien cave.json)
  cave = {
    categories: (cats || []).map(cat => ({
      ...cat,
      items: (items || []).filter(i => i.category_id === cat.id)
    })),
    a_acheter: aAcheter || []
  };

  renderCave();
}

// =============================================
// RENDU MA CAVE
// =============================================

function renderCave() {
  const container = document.getElementById('cave-container');
  container.innerHTML = '';

  renderConservations();

  // Barre de recherche
  const searchBar = document.createElement('div');
  searchBar.className = 'search-bar';
  searchBar.innerHTML = `
    <input type="text" id="search-input" placeholder="Rechercher un alcool ou ingrédient…" oninput="onSearch(this.value)" value="${filtreRecherche}">
    <button class="btn btn-outline" onclick="ouvrirModalAjout()">+ Ajouter</button>
  `;
  container.appendChild(searchBar);

  // Catégories
  cave.categories.forEach(cat => {
    const items = filtrerItems(cat.items);
    if (filtreRecherche && items.length === 0) return;

    const div = document.createElement('div');
    div.className = 'categorie' + (filtreRecherche ? ' open' : '');
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

// Génère le HTML d'un item
function renderItem(item, catId) {
  const statutLabel = item.statut === 'en_cours' ? 'En cours'
    : item.cl_restants !== null ? (item.cl_restants === item.cl_total ? 'Plein' : `${item.cl_restants} cl`)
    : '?';
  const statutClass = item.statut === 'en_cours' ? 'statut-en-cours'
    : item.cl_restants === null ? 'statut-inconnu'
    : item.cl_restants === item.cl_total ? 'statut-plein'
    : 'statut-entame';

  return `
    <div class="item-cave" onclick="ouvrirModalItem('${item.id}', '${catId}')">
      <div class="item-ouverture-dot ${item.ouvert ? 'ouvert' : ''}"></div>
      <div class="item-info">
        <div class="item-nom">${item.nom}</div>
        ${item.detail ? `<div class="item-detail">${item.detail}</div>` : ''}
      </div>
      <span class="item-statut ${statutClass}">${statutLabel}</span>
      <div class="item-actions">
        <button class="btn-icon" title="Infos" onclick="event.stopPropagation(); ouvrirModalInfo('${item.id}', '${catId}')">ℹ</button>
        <button class="btn-icon" title="Contenance" onclick="event.stopPropagation(); ouvrirModalContenance('${item.id}', '${catId}')">📊</button>
      </div>
    </div>
  `;
}

// =============================================
// PANEL CONSERVATIONS
// =============================================

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

// =============================================
// INTERACTIONS UI
// =============================================

function toggleCategorie(id) {
  document.getElementById('cat-' + id)?.classList.toggle('open');
}

function toggleConservations(btn) {
  btn.classList.toggle('open');
  btn.nextElementSibling.classList.toggle('visible');
}

function onSearch(val) {
  filtreRecherche = val.toLowerCase();
  renderCave();
}

function filtrerItems(items) {
  if (!filtreRecherche) return items;
  return items.filter(i =>
    i.nom.toLowerCase().includes(filtreRecherche) ||
    (i.detail && i.detail.toLowerCase().includes(filtreRecherche))
  );
}

// =============================================
// MODAL OUVERTURE BOUTEILLE
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
    const updates    = {
      ouvert:         nouvelEtat,
      date_ouverture: nouvelEtat ? new Date().toISOString() : null
    };

    await db.from('items').update(updates).eq('id', itemId).eq('user_id', currentUser.id);

    // Mise à jour en mémoire
    item.ouvert         = nouvelEtat;
    item.date_ouverture = updates.date_ouverture;

    fermerModal('modal-ouverture');
    renderCave();
  };

  afficherModal('modal-ouverture');
}

// =============================================
// MODAL CONTENANCE
// =============================================

function ouvrirModalContenance(itemId, catId) {
  const item = trouverItem(itemId, catId);
  if (!item) return;

  document.getElementById('modal-contenance-titre').textContent = item.nom;
  document.getElementById('input-cl-total').value    = item.cl_total    ?? '';
  document.getElementById('input-cl-restants').value = item.cl_restants ?? '';

  document.getElementById('btn-sauver-contenance').onclick = async () => {
    const cl_total    = parseInt(document.getElementById('input-cl-total').value)    || null;
    const cl_restants = parseInt(document.getElementById('input-cl-restants').value) || null;

    await db.from('items').update({ cl_total, cl_restants }).eq('id', itemId).eq('user_id', currentUser.id);

    item.cl_total    = cl_total;
    item.cl_restants = cl_restants;

    fermerModal('modal-contenance');
    renderCave();
  };

  afficherModal('modal-contenance');
}

// =============================================
// MODAL INFO
// =============================================

function ouvrirModalInfo(itemId, catId) {
  const item = trouverItem(itemId, catId);
  if (!item) return;

  document.getElementById('modal-info-titre').textContent = item.nom;
  document.getElementById('modal-info-texte').textContent = item.detail || 'Aucune description disponible.';
  afficherModal('modal-info');
}

// =============================================
// MODAL AJOUT
// =============================================

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
      id:          'custom-' + Date.now(),
      user_id:     currentUser.id,
      category_id: catId,
      nom, detail,
      ouvert:      false,
      conservation: null,
      cl_total:    null,
      cl_restants: null,
      prix_estime: null
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

// =============================================
// UTILITAIRES
// =============================================

function trouverItem(itemId, catId) {
  const cat = cave.categories.find(c => c.id === catId);
  return cat?.items.find(i => i.id === itemId);
}

function afficherModal(id) {
  document.getElementById(id).classList.add('visible');
}

function fermerModal(id) {
  document.getElementById(id).classList.remove('visible');
}

// Fermer modal en cliquant l'overlay
document.addEventListener('click', e => {
  if (e.target.classList.contains('modal-overlay')) {
    e.target.classList.remove('visible');
  }
});

// =============================================
// LANCEMENT
// =============================================
init();
