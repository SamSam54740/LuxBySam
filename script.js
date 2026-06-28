// ==========================================
// 1. VARIABLE GLOBALES
// ==========================================
let products = [];
let cart = [];
let currentCategory = '';
let currentSort = 'alpha';
let views = {};
let ui = {};
let suggestions = [];

// --- VARIABLES CLOUD (Vides au démarrage) ---
let adminOrders = [];
let expensesList = [];
let currentEditingOrderId = null;
let isPromoCostActive = false;

// ==========================================
// 2. INITIALISATION & CHARGEMENT FIREBASE
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
    views = {
        home: document.getElementById('view-categories'),
        products: document.getElementById('view-products'),
        cart: document.getElementById('view-cart'),
        admin: document.getElementById('view-admin'),
        confirmation: document.getElementById('view-confirmation')
    };

    ui = {
        gateModal: document.getElementById('gate-modal'),
        header: document.getElementById('main-header'),
        mainContent: document.getElementById('main-content'),
        footer: document.getElementById('main-footer'),
        searchInput: document.getElementById('search-input'),
        searchDropdown: document.getElementById('search-dropdown'),
        clearSearch: document.getElementById('clear-search'),
        searchSection: document.getElementById('search-section'),
        navAdminBtn: document.getElementById('nav-admin-btn')
    };

    // 1. Charger le catalogue et les données Cloud en premier
    await loadDataFromFirebase();
    await chargerCatalogue(); 
    
    // 2. Déverrouillage si déjà connecté
    const role = sessionStorage.getItem('luxbysam_role');
    if (role === 'user' || role === 'admin') {
        unlockSite(role);
    }
    setupEventListeners();
    updateCartUI();
});

// NOUVEAU : Fonction qui télécharge toutes les données de ton espace Admin
async function loadDataFromFirebase() {
    try {
        const orderSnap = await window.getDocs(window.collection(window.db, "orders"));
        adminOrders = orderSnap.docs.map(d => d.data());
        
        const expSnap = await window.getDocs(window.collection(window.db, "expenses"));
        expensesList = expSnap.docs.map(d => d.data());

        const sugSnap = await window.getDocs(window.collection(window.db, "suggestions"));
        suggestions = sugSnap.docs.map(d => d.data());
        
        console.log("✅ Données Cloud synchronisées !");
    } catch (e) { console.error("Erreur de chargement Firebase:", e); }
}

async function chargerCatalogue() {
    try {
        const response = await fetch('catalogue_dfs.csv');
        const data = await response.text();
        const lignes = data.split('\n');
        products = []; 

        // NOUVEAU : On récupère les prix modifiés dans l'admin
        const priceSnap = await window.getDocs(window.collection(window.db, "prices"));
        const cloudPrices = {};
        priceSnap.forEach(d => cloudPrices[d.id] = d.data().price);

        for (let i = 1; i < lignes.length; i++) {
            if (lignes[i].trim() === '') continue;
            let separateur = lignes[i].split(',').length > lignes[i].split(';').length ? ',' : ';';
            const colonnes = lignes[i].split(separateur);
            let isNewFormat = colonnes.length >= 7;

            if (colonnes.length >= 6) {
                let id = i.toString();
                let prixCoutant = parseFloat(colonnes[4].replace(/"/g, '').replace(',', '.').trim());
                
                // Si un prix existe dans Firebase, on l'utilise, sinon on prend celui du CSV
                let prixCSV = isNewFormat ? parseFloat(colonnes[5].replace(/"/g, '').replace(',', '.').trim()) : prixCoutant;
                let prixVente = cloudPrices[id] ? cloudPrices[id] : prixCSV;
                
                let photo = isNewFormat ? colonnes[6].replace(/"/g, '').trim() : colonnes[5].replace(/"/g, '').trim();
                let desc = colonnes[3].replace(/"/g, '').trim();
                let nom = colonnes[2].replace(/"/g, '').trim();
                let cat = colonnes[1].replace(/"/g, '').trim();

                if (nom && !isNaN(prixCoutant)) {
                    products.push({ id: parseInt(id), cat: cat, name: nom, desc: desc, priceCost: prixCoutant, price: prixVente, img: 'photos_produits/' + photo });
                }
            }
        }
        console.log(`✅ Catalogue chargé ! ${products.length} produits affichés.`);
    } catch (erreur) { console.error("❌ Erreur de lecture du CSV.", erreur); }
}


// ==========================================
// 3. SÉCURITÉ DU PORTAIL DISCRET
// ==========================================
document.getElementById('btn-enter').addEventListener('click', () => {
    const rawCode = document.getElementById('access-code').value.trim();
    const isAdult = document.getElementById('age-check').checked;
    
    const secretCode = btoa(rawCode); 
    
    if (isAdult && (secretCode === 'bHV4MTIz' || secretCode === 'Tnc0NXVhMjImKg==')) {
        let role = secretCode === 'Tnc0NXVhMjImKg==' ? 'admin' : 'user';
        sessionStorage.setItem('luxbysam_role', role); 
        window.unlockSite(role);
        if (role === 'admin') window.showAdminPage();
    } else {
        document.getElementById('gate-error').classList.remove('hidden');
    }
});

function unlockSite(role) {
    const gate = document.getElementById('gate-modal');
    if (gate) gate.remove(); 
    
    ui.header.classList.remove('hidden');
    ui.mainContent.classList.remove('hidden');
    ui.footer.classList.remove('hidden');
    
    if (role === 'admin') {
        ui.navAdminBtn.classList.remove('hidden');
        document.getElementById('nav-lock-btn').classList.remove('hidden');
    }
}

window.lockSite = function() {
    sessionStorage.removeItem('luxbysam_role');
    location.reload(); 
};

// ==========================================
// 4. ÉVÉNEMENTS & NAVIGATION GÉNÉRALE
// ==========================================
function setupEventListeners() {
    document.getElementById('go-home').addEventListener('click', showHome);
    document.getElementById('btn-back-cats').addEventListener('click', showHome);
    document.getElementById('btn-back-from-cart').addEventListener('click', showHome);
    document.getElementById('btn-back-home').addEventListener('click', showHome);
    ui.navAdminBtn.addEventListener('click', showAdminPage);

    document.querySelectorAll('.glass-card').forEach(block => {
        block.addEventListener('click', (e) => {
            currentCategory = e.currentTarget.dataset.cat;
            showCategory();
        });
    });

    document.getElementById('sort-select').addEventListener('change', (e) => {
        currentSort = e.target.value;
        showCategory();
    });

    ui.searchInput.addEventListener('input', handleSearchDropdown);
    ui.searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); executeSearch(ui.searchInput.value); }
    });
    ui.clearSearch.addEventListener('click', closeSearch);

    document.getElementById('open-cart').addEventListener('click', showCartPage);
    document.getElementById('checkout-form').addEventListener('submit', handleCheckout);
}

function hideAllViews() {
    Object.values(views).forEach(v => v.classList.add('hidden'));
    ui.searchSection.classList.remove('hidden'); 
    
    // NOUVEAU : Force la page à remonter tout en haut en douceur
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function showHome() { hideAllViews(); closeSearch(); views.home.classList.remove('hidden'); }
function closeSearch() { ui.searchInput.value = ''; ui.searchDropdown.classList.add('hidden'); ui.clearSearch.classList.add('hidden'); }

// ==========================================
// 5. MOTEUR DE RECHERCHE & SUGGESTIONS
// ==========================================
function handleSearchDropdown(e) {
    const query = e.target.value.toLowerCase().trim();
    if (query.length < 2) { 
        ui.searchDropdown.classList.add('hidden');
        ui.clearSearch.classList.add('hidden');
        return; 
    }
    ui.clearSearch.classList.remove('hidden');
    
    // --- NOUVELLE RECHERCHE INTELLIGENTE (Découpage par mots) ---
    const motsRecherche = query.split(/\s+/);
    const results = products.filter(p => {
        const nomProduit = p.name.toLowerCase();
        const catProduit = p.cat.toLowerCase();
        // On vérifie que chaque mot tapé se trouve soit dans le nom, soit dans la catégorie
        return motsRecherche.every(mot => nomProduit.includes(mot) || catProduit.includes(mot));
    });

    ui.searchDropdown.innerHTML = '';
    
    if (results.length === 0) {
        ui.searchDropdown.innerHTML = `<li onclick="executeSearch('${query}')"><div class="sd-info text-center" style="width:100%; color:var(--lux-red); padding:10px;"><strong>Aucun produit trouvé 😕</strong><br><span style="font-size:0.85rem; color:#666;">Proposer "${query}" à Sam</span></div></li>`;
    } else {
        results.slice(0, 5).forEach(p => {
            const li = document.createElement('li');
            li.innerHTML = `<img src="${p.img}" alt="img"><div class="sd-info"><div class="sd-name">${p.name}</div><div class="sd-cat">${p.cat}</div></div><div class="sd-price">${p.price.toFixed(2)} €</div>`;
            li.addEventListener('click', () => {
                closeSearch(); hideAllViews();
                document.getElementById('current-category-title').innerText = "Résultat : " + p.name;
                views.products.classList.remove('hidden');
                document.getElementById('products-container').innerHTML = renderProductCard(p);
            });
            ui.searchDropdown.appendChild(li);
        });
        ui.searchDropdown.insertAdjacentHTML('beforeend', `<li onclick="executeSearch('${query}')" style="background:var(--bg-light); justify-content:center;"><strong style="color:var(--lux-blue);">🔍 Voir tous les résultats (${results.length})</strong></li>`);
    }
    ui.searchDropdown.classList.remove('hidden');
}

window.executeSearch = function(query) {
    if (!query) return;
    query = query.toLowerCase().trim();
    closeSearch(); hideAllViews();
    document.getElementById('current-category-title').innerText = `Recherche : "${query}"`;
    views.products.classList.remove('hidden');

    // --- NOUVELLE RECHERCHE INTELLIGENTE (Découpage par mots) ---
    const motsRecherche = query.split(/\s+/);
    const results = products.filter(p => {
        const nomProduit = p.name.toLowerCase();
        const catProduit = p.cat.toLowerCase();
        return motsRecherche.every(mot => nomProduit.includes(mot) || catProduit.includes(mot));
    });

    const container = document.getElementById('products-container');
    container.innerHTML = '';

    if (results.length > 0) {
        results.forEach(p => container.insertAdjacentHTML('beforeend', renderProductCard(p)));
        container.insertAdjacentHTML('beforeend', `<div class="suggestion-box" style="grid-column:1/-1; margin-top:30px;"><h4>Votre déclinaison exacte n'y est pas ?</h4><form id="suggest-form" onsubmit="handleSuggestion(event)"><input type="text" id="suggest-name" value="${query}" required><button type="submit" class="btn-outline mt-10">Proposer à Sam</button></form></div>`);
    } else {
        container.innerHTML = `<div class="suggestion-box" style="grid-column:1/-1;"><div style="font-size:3rem; margin-bottom:15px;">🕵️‍♂️</div><h3>Oups, aucun produit trouvé pour "${query}"</h3><p>Demandez-le ! Sam essaiera de l'ajouter au catalogue lors de son prochain passage.</p><form id="suggest-form" onsubmit="handleSuggestion(event)"><input type="text" id="suggest-name" value="${query}" required><button type="submit" class="btn-lux-blue w-100 mt-10">Envoyer ma demande</button></form></div>`;
    }
};

window.handleSuggestion = async function(e) {
    e.preventDefault();
    const prodName = document.getElementById('suggest-name').value;
    const newSug = { name: prodName, date: new Date().toLocaleDateString('fr-FR') };
    
    // Sauvegarde la suggestion dans le Cloud
    await window.setDoc(window.doc(window.db, "suggestions", Date.now().toString()), newSug);
    suggestions.push(newSug);
    
    customAlert(`✅ Merci ! Votre demande pour "${prodName}" a bien été transmise à Sam.`);
    document.getElementById('suggest-form').reset();
};

function showCategory() {
    hideAllViews();
    document.getElementById('current-category-title').innerText = currentCategory;
    views.products.classList.remove('hidden');

    let filtered = products.filter(p => p.cat === currentCategory);
    if (currentSort === 'alpha') filtered.sort((a, b) => a.name.localeCompare(b.name));
    else if (currentSort === 'price-asc') filtered.sort((a, b) => a.price - b.price);
    else if (currentSort === 'price-desc') filtered.sort((a, b) => b.price - a.price);

    const container = document.getElementById('products-container');
    container.innerHTML = '';
    filtered.forEach(p => container.insertAdjacentHTML('beforeend', renderProductCard(p)));
}

function renderProductCard(p) {
    return `
    <div class="product-card">
        <div class="card-image-wrapper">
            <img src="${p.img}" alt="${p.name}" loading="lazy" onclick="openImageModal('${p.img}')" style="width:100%; height:130px; object-fit:contain; margin-bottom:15px; cursor:zoom-in;">
        </div>
        <h3>${p.name}</h3>
        <p class="prod-desc">${p.desc}</p>
        <div class="price-row">
            <span class="final-price">${p.price.toFixed(2)} €</span>
            <button class="btn-add" id="btn-add-${p.id}" onclick="addToCart(${p.id})">Ajouter</button>
        </div>
    </div>`;
}

// ==========================================
// 6. PANIER & COMMANDE CLOUD
// ==========================================
window.addToCart = function(id) {
    const product = products.find(p => p.id === id);
    const existing = cart.find(item => item.id === id);
    if (existing) { existing.qty++; } else { cart.push({ ...product, qty: 1 }); }
    updateCartUI();
    
    const btn = document.getElementById(`btn-add-${id}`);
    if(btn) { btn.innerText = "✓"; btn.classList.add('added'); setTimeout(() => { btn.innerText = "Ajouter"; btn.classList.remove('added'); }, 1000); }
    const cartIcon = document.getElementById('open-cart');
    cartIcon.classList.remove('cart-bounce'); void cartIcon.offsetWidth; cartIcon.classList.add('cart-bounce');
};

function showCartPage() { hideAllViews(); ui.searchSection.classList.add('hidden'); views.cart.classList.remove('hidden'); updateCartUI(); }

// --- FONCTION CODE PROMO ---
window.applyPromoCode = function() {
    const rawCode = document.getElementById('promo-input').value.toUpperCase().trim();
    const secretPromo = btoa(rawCode);

    if (secretPromo === 'UFJPTU85OA==') { 
        isPromoCostActive = true;
        updateCartUI(); 
        window.customAlert('✅ Code valide : Prix coûtants activés !');
    } else {
        window.customAlert('❌ Code promo invalide.');
    }
};

// --- FONCTION PANIER MISE À JOUR ---
function updateCartUI() {
    document.getElementById('cart-count').innerText = cart.reduce((sum, item) => sum + item.qty, 0);
    const container = document.getElementById('cart-page-items');
    const summary = document.getElementById('cart-page-summary');

    if (cart.length === 0) {
        container.innerHTML = '<div style="background:white; padding:40px; border-radius:16px; text-align:center; box-shadow:var(--shadow); color:#888;">🛒 Votre panier est vide.</div>';
        summary.classList.add('hidden'); 
        return;
    }

    summary.classList.remove('hidden'); 
    container.innerHTML = ''; 
    let total = 0;
    
    cart.forEach(item => {
        // LE SECRET EST ICI : Si promo active -> Prix Coutant, sinon -> Prix Normal
        let activePrice = isPromoCostActive ? item.priceCost : item.price;
        let itemTotal = activePrice * item.qty; 
        total += itemTotal;
        
        // Un petit badge rouge pour bien montrer que la promo est passée
        let promoBadge = isPromoCostActive ? `<br><span style="color:var(--lux-red); font-size:0.75rem; font-weight:bold;">(Prix Coûtant)</span>` : '';

        container.insertAdjacentHTML('beforeend', `
        <div class="cart-item-row">
            <img src="${item.img}" alt="img">
            <div class="ci-details">
                <strong>${item.name}</strong>
                <span class="ci-price-u">${activePrice.toFixed(2)} € / u ${promoBadge}</span>
            </div>
            <div class="ci-qty-controls">
                <button onclick="changeQty(${item.id}, -1)">-</button>
                <span>${item.qty}</span>
                <button onclick="changeQty(${item.id}, 1)">+</button>
            </div>
            <div class="ci-total">${itemTotal.toFixed(2)} €</div>
        </div>`);
    });
    
    document.getElementById('total-price-val').innerText = total.toFixed(2);
}

window.changeQty = function(id, delta) {
    const item = cart.find(i => i.id === id);
    if (!item) return; item.qty += delta;
    if (item.qty <= 0) cart = cart.filter(i => i.id !== id);
    updateCartUI();
};

// --- VALIDATION DE LA COMMANDE (AVEC PROMO) ---
window.handleCheckout = async function(e) {
    e.preventDefault();
    const name = document.getElementById('client-name').value;
    const email = document.getElementById('client-email').value;
    const phoneInput = document.getElementById('client-phone');
    const phoneVal = phoneInput ? phoneInput.value : ''; 

    const orderId = 'LBS-' + Math.floor(10000 + Math.random() * 90000);
    
    // NOUVEAU CALCUL TOTAL ET REÇU EN FONCTION DE LA PROMO
    let total = cart.reduce((sum, item) => {
        let p = isPromoCostActive ? item.priceCost : item.price;
        return sum + (p * item.qty);
    }, 0).toFixed(2);

    // NOUVEAU CALCUL RÉCAPITULATIF POUR L'E-MAIL (Avec images et couleurs officielles)
    let htmlRecap = cart.map(item => {
        let p = isPromoCostActive ? item.priceCost : item.price;
        let itemTotal = (p * item.qty).toFixed(2);
        
        // ⚠️ N'oublie pas de mettre le vrai lien de ton GitHub ici !
        let lienImageAbsolu = "https://TON_LIEN_GITHUB_ICI.com/" + item.img; 

        return `
        <tr>
            <td style="padding: 12px 0; border-bottom: 1px solid #EEEEEE; width: 55px; vertical-align: middle;">
                <img src="${lienImageAbsolu}" width="45" height="45" style="display: block; border-radius: 6px; border: 1px solid #E0E0E0; object-fit: contain; background-color: #ffffff;">
            </td>
            <td style="padding: 12px 10px; border-bottom: 1px solid #EEEEEE; vertical-align: middle;">
                <strong style="color: #1A1A1A; font-size: 14px; display: block; line-height: 1.3;">${item.name}</strong>
                <span style="color: #888888; font-size: 12px;">Quantité : ${item.qty}</span>
            </td>
            <td style="padding: 12px 0; border-bottom: 1px solid #EEEEEE; text-align: right; white-space: nowrap; font-weight: bold; color: #00A3E0; font-size: 15px; vertical-align: middle;">
                ${itemTotal} €
            </td>
        </tr>`;
    }).join('');

    const commandeData = {
        id: orderId,
        client: name,
        email: email,
        phone: phoneVal,
        total: parseFloat(total),
        date: new Date().toLocaleDateString('fr-FR'),
        timestamp: Date.now(),
        status: 'pending',
        items: cart.map(item => item.name + ' (x' + item.qty + ')').join(', ')
    };

    try {
        await window.setDoc(window.doc(window.db, "orders", orderId), commandeData);
        adminOrders.unshift(commandeData);
        console.log("✅ Commande envoyée sur le Cloud !");
        if (typeof envoyerEmailConfirmation === 'function') {
            envoyerEmailConfirmation(name, email, orderId, `<ul>${htmlRecap}</ul>`, total);
        }
    } catch (error) {
        console.error("❌ Erreur lors de l'envoi :", error);
    }

    hideAllViews(); 
    ui.searchSection.classList.add('hidden');
    document.getElementById('conf-name').innerText = name;
    document.getElementById('order-number').innerText = orderId;
    views.confirmation.classList.remove('hidden');
    
    cart = []; 
    updateCartUI(); 
    document.getElementById('checkout-form').reset();
    
    // TRÈS IMPORTANT : On désactive la promo pour le client suivant !
    isPromoCostActive = false;
    if(document.getElementById('promo-input')) document.getElementById('promo-input').value = '';
};

// ==========================================
// 7. ZOOM IMAGE (LIGHTBOX)
// ==========================================
window.openImageModal = function(imgSrc) {
    document.getElementById('large-image').src = imgSrc;
    document.getElementById('image-modal').style.display = 'flex';
};
window.closeImageModal = function() { document.getElementById('image-modal').style.display = 'none'; };
document.getElementById('image-modal').addEventListener('click', function(e) { if (e.target === this) closeImageModal(); });

// ==========================================
// 8. TABLEAU DE BORD ADMIN (100% CLOUD)
// ==========================================
function showAdminPage() {
    hideAllViews(); ui.searchSection.classList.add('hidden'); views.admin.classList.remove('hidden');
    switchAdminTab('tab-commandes'); 
}

window.switchAdminTab = function(tabId) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.admin-tab-content').forEach(tab => { tab.classList.remove('active'); tab.classList.add('hidden'); });
    event.currentTarget.classList.add('active');
    document.getElementById(tabId).classList.remove('hidden');
    document.getElementById(tabId).classList.add('active');

    if (tabId === 'tab-prix') loadAdminPrices();
    if (tabId === 'tab-commandes') loadAdminOrders();
    if (tabId === 'tab-finances') { 
        renderExpenses(); 
        window.updateDashboardStats();
    }
    if (tabId === 'tab-suggestions') renderSuggestions();
};

// --- GESTION DES PRIX CLOUD ---
window.loadAdminPrices = function() {
    let cat = document.getElementById('admin-cat-select').value;
    let tbody = document.getElementById('admin-price-list'); tbody.innerHTML = ''; 
    products.filter(p => p.cat === cat).forEach(p => {
        tbody.insertAdjacentHTML('beforeend', `<tr><td>${p.name}</td><td style="color:#dc3545; font-weight:bold;">${p.priceCost.toFixed(2)} €</td><td><input type="number" class="admin-price-input" data-id="${p.id}" value="${p.price.toFixed(2)}" step="0.50" style="width:100px; padding:5px; text-align:center;"> €</td></tr>`);
    });
};

window.applyBulkIncrease = function() {
    let increaseVal = parseFloat(document.getElementById('bulk-price-increase').value);
    if (isNaN(increaseVal)) return customAlert("Veuillez entrer un montant valide !");
    
    document.querySelectorAll('.admin-price-input').forEach(input => { 
        let newVal = parseFloat(input.value) + increaseVal;
        if(newVal < 0) newVal = 0; 
        input.value = newVal.toFixed(2); 
    });
    customAlert(`Ajustement de ${increaseVal > 0 ? '+' : ''}${increaseVal}€ appliqué à l'écran ! Cliquez sur Sauvegarder.`);
};

window.saveNewPrices = async function() {
    try {
        // 1. On récupère UNIQUEMENT les champs de prix qui sont affichés à l'écran
        const inputs = document.querySelectorAll('.admin-price-input');
        
        if (inputs.length === 0) return;

        // 2. On prépare une liste d'envois simultanés vers le Cloud
        const promises = [];

        inputs.forEach(input => {
            let prodId = parseInt(input.getAttribute('data-id'));
            let newPrice = parseFloat(input.value);
            
            // Mise à jour de la mémoire locale
            let p = products.find(prod => prod.id === prodId);
            if(p) p.price = newPrice;
            
            // On prépare l'envoi Firebase uniquement pour CE produit
            let promise = window.setDoc(window.doc(window.db, "prices", prodId.toString()), { price: newPrice });
            promises.push(promise);
        });
        
        // 3. On exécute toutes les sauvegardes en un clin d'œil !
        await Promise.all(promises);
        
        customAlert("✅ Nouveaux prix sauvegardés avec succès dans le Cloud !");
    } catch (error) {
        console.error("Erreur Firebase :", error);
        customAlert("❌ Erreur lors de la sauvegarde. Vérifiez votre connexion internet.");
    }
};

// --- RÉINITIALISER LES PRIX (RETOUR AU PRIX COÛTANT) ---
window.resetPricesToCost = function() {
    // 1. Petite sécurité pour éviter les clics accidentels
    if (!confirm("Confirmer ?")) {
        return;
    }

    // 2. On parcourt toutes les cases de prix à l'écran
    document.querySelectorAll('.admin-price-input').forEach(input => {
        let prodId = parseInt(input.getAttribute('data-id'));
        let p = products.find(prod => prod.id === prodId);
        
        // 3. On remplace la valeur par le prix d'achat d'origine
        if (p && p.priceCost) {
            input.value = p.priceCost.toFixed(2);
        }
    });

    // 4. On prévient que c'est fait (mais qu'il faut sauvegarder !)
    customAlert("💡 Prix réinitialisés à l'écran ! N'oubliez pas de cliquer sur 'Sauvegarder dans le Cloud' pour valider définitivement.");
};

// --- GESTION DES COMMANDES CLOUD ---
function loadAdminOrders() {
    const tbody = document.getElementById('admin-orders-list'); 
    tbody.innerHTML = '';
    
    // 🎯 NOUVEAU : TRI INTELLIGENT DES COMMANDES (Plus récentes en haut)
    adminOrders.sort((a, b) => {
        // 1. Si on a notre nouveau chronomètre ultra-précis (pour les nouvelles commandes)
        if (a.timestamp && b.timestamp) {
            return b.timestamp - a.timestamp;
        }
        // 2. Sinon (pour tes anciennes commandes), on lit la date classique et on l'inverse (ex: 28/06/2026 devient 20260628) pour pouvoir les classer
        let dateA = a.date ? a.date.split('/').reverse().join('') : '0'; 
        let dateB = b.date ? b.date.split('/').reverse().join('') : '0';
        return dateB.localeCompare(dateA);
    });

    // 🎯 AFFICHAGE DU TABLEAU
    adminOrders.forEach(order => {
        let badgeClass = '', statusText = '';
        if(order.status === 'pending') { badgeClass = 'badge-pending'; statusText = 'En attente'; }
        if(order.status === 'progress') { badgeClass = 'badge-progress'; statusText = 'En livraison'; }
        if(order.status === 'delivered') { badgeClass = 'badge-delivered'; statusText = 'Livrée'; }
        if(order.status === 'cancelled') { badgeClass = 'badge-cancelled'; statusText = 'Annulée'; }
        
        tbody.insertAdjacentHTML('beforeend', `<tr>
            <td><strong>${order.id}</strong></td>
            <td>${order.client}</td>
            <td>${order.date}</td>
            <td><strong>${order.total.toFixed(2)} €</strong></td>
            <td><span class="badge ${badgeClass}">${statusText}</span></td>
            <td><button class="btn-outline" onclick="openOrderModal('${order.id}')" style="padding:5px 10px; font-size:0.8rem;">Gérer</button></td>
        </tr>`);
    });
}

window.openOrderModal = function(orderId) {
    const order = adminOrders.find(o => o.id === orderId);
    if(!order) return;
    currentEditingOrderId = orderId;
    
    // --- Formatage visuel avec PHOTOS ---
    let itemsHTML = '';
    if (order.items) {
        let itemsList = order.items.split(', ');
        itemsHTML = '<ul style="list-style: none; padding: 0; margin-top: 10px; display: flex; flex-direction: column; gap: 6px;">';
        
        itemsList.forEach(itemStr => {
            let match = itemStr.match(/(.*) \(x(\d+)\)/);
            if (match) {
                let name = match[1].trim();
                let qty = match[2];
                
                // NOUVEAU : On cherche la photo du produit dans le catalogue
                let prod = products.find(p => p.name === name);
                let imgHtml = prod ? `<img src="${prod.img}" style="width: 35px; height: 35px; object-fit: contain; border-radius: 4px; margin-right: 12px; background: white; border: 1px solid #eee;">` : '';

                itemsHTML += `
                <li style="display: flex; justify-content: space-between; align-items: center; padding: 6px 10px; background: white; border: 1px solid #e0e0e0; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.02);">
                    <div style="display: flex; align-items: center;">
                        ${imgHtml}
                        <span style="font-weight: 600; color: #1a1a1a; font-size: 0.85rem; line-height: 1.1;">${name}</span>
                    </div>
                    <span style="background: var(--lux-blue); color: white; padding: 3px 10px; border-radius: 20px; font-weight: bold; font-size: 0.85rem;">x${qty}</span>
                </li>`;
            } else {
                itemsHTML += `<li style="font-size: 0.85rem;">${itemStr}</li>`;
            }
        });
        itemsHTML += '</ul>';
    }

    // NOUVEAU : Gestion du numéro de téléphone (S'il est vide, on affiche "Non renseigné")
    let phoneDisplay = order.phone ? order.phone : '<span style="color:#999; font-style:italic;">Non renseigné</span>';

    document.getElementById('om-title').innerText = `Commande ${order.id}`;
    
    // NOUVEAU : Design beaucoup plus compact (marges réduites, textes plus petits)
    document.getElementById('om-content').innerHTML = `
        <div style="font-size: 0.9rem;">
            <div class="order-detail-line" style="padding: 6px 0;"><span>Client :</span> <strong>${order.client}</strong></div>
            <div class="order-detail-line" style="padding: 6px 0;">
                <span>Contact :</span> 
                <div style="text-align:right">
                    <strong>${order.email}</strong><br>
                    <small style="font-size: 0.8rem;">${phoneDisplay}</small>
                </div>
            </div>
            <div class="order-detail-line" style="padding: 6px 0;"><span>Date :</span> <strong>${order.date}</strong></div>
            <div class="order-detail-line" style="padding: 6px 0;"><span>Total :</span> <strong style="color:var(--lux-blue); font-size:1.1rem;">${order.total.toFixed(2)} €</strong></div>
        </div>
        
        <div style="margin-top: 15px; padding: 10px; background: #f4f7f6; border-radius: 10px; border: 1px solid #eee; max-height: 220px; overflow-y: auto;">
            <strong style="color: #666; text-transform: uppercase; font-size: 0.75rem; letter-spacing: 1px;">🛒 À acheter :</strong>
            ${itemsHTML}
        </div>`;
        
    document.getElementById('om-status').value = order.status;
    document.getElementById('order-modal').classList.remove('hidden');
};

window.closeOrderModal = function() { document.getElementById('order-modal').classList.add('hidden'); };

window.saveOrderStatus = async function() {
    const order = adminOrders.find(o => o.id === currentEditingOrderId);
    if(order) { 
        const newStatus = document.getElementById('om-status').value;
        
        // --- NOUVEAUTÉ : AJOUT AUTOMATIQUE AUX DÉPENSES ---
        // Si la commande passe en "En cours" (progress) ou "Livrée" (delivered)
        // ET que la dépense n'a pas déjà été comptabilisée (sécurité anti-doublon)
        if ((newStatus === 'progress' || newStatus === 'delivered') && !order.expenseAdded) {
            
            let totalCoutant = 0;
            
            // 1. On calcule le prix d'achat total (Prix Coûtant) de la commande
            if (order.items) {
                let itemsList = order.items.split(', ');
                itemsList.forEach(itemStr => {
                    let match = itemStr.match(/(.*) \(x(\d+)\)/);
                    if (match) {
                        let name = match[1].trim();
                        let qty = parseInt(match[2]);
                        
                        // On cherche le produit dans le catalogue pour récupérer son prix coûtant
                        let prod = products.find(p => p.name === name);
                        if (prod && prod.priceCost) {
                            totalCoutant += (prod.priceCost * qty);
                        }
                    }
                });
            }

            // 2. S'il y a bien un coût d'achat, on crée la facture automatiquement
            if (totalCoutant > 0) {
                let newExp = { 
                    id: Date.now(), 
                    name: `Achat stock - Commande ${order.id}`, 
                    amount: totalCoutant, 
                    date: new Date().toLocaleDateString('fr-FR') 
                };
                
                // On sauvegarde la dépense dans Firebase
                await window.setDoc(window.doc(window.db, "expenses", newExp.id.toString()), newExp);
                expensesList.unshift(newExp);
                
                // On marque la commande avec un "tag" pour ne plus jamais l'ajouter en double
                order.expenseAdded = true;
                
                // Message de confirmation pour toi
                setTimeout(() => window.customAlert(`✅ Le prix d'achat de la commande (${totalCoutant.toFixed(2)} €) a été automatiquement déduit de vos bénéfices !`), 500);
            }
        }

        // 3. On met à jour le statut
        order.status = newStatus; 
        
        // 4. On sauvegarde la commande mise à jour dans Firebase
        await window.setDoc(window.doc(window.db, "orders", order.id), order);
        
        // 5. On rafraîchit l'affichage
        loadAdminOrders(); 
        
        // On force la mise à jour des finances en arrière-plan pour les graphiques
        if (typeof renderExpenses === 'function') {
            renderExpenses(); 
        }
        
        closeOrderModal(); 
    }
};

// --- GESTION DES FINANCES & FACTURES CLOUD ---
function renderExpenses() {
    const ul = document.getElementById('expenses-list');
    ul.innerHTML = '';
    let total = 0;
    expensesList.forEach(exp => {
        total += exp.amount;
        ul.insertAdjacentHTML('beforeend', `
            <li style="display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid #eee; font-size: 0.95rem;">
                <span><span style="color: #888; margin-right: 10px;">${exp.date}</span> <strong>${exp.name}</strong></span>
                <div style="display: flex; align-items: center; gap: 15px;">
                    <span class="text-red font-weight-bold">- ${exp.amount.toFixed(2)} €</span>
                    <span class="cursor-pointer" onclick="deleteExpense(${exp.id})" style="color: #dc3545; font-size: 1.1rem;" title="Supprimer">🗑️</span>
                </div>
            </li>`);
    });
    document.getElementById('expense-amount-total').innerText = `- ${total.toFixed(2)} €`;
    window.updateDashboardStats();
}

window.addExpense = function() {
    document.getElementById('expense-name-input').value = '';
    document.getElementById('expense-amount-input').value = '';
    document.getElementById('expense-modal').classList.remove('hidden');
};

window.validateExpense = async function() {
    let name = document.getElementById('expense-name-input').value;
    let amount = parseFloat(document.getElementById('expense-amount-input').value.replace(',', '.'));
    
    if (!name || isNaN(amount) || amount <= 0) {
        customAlert("Veuillez remplir correctement la désignation et le montant.");
        return;
    }
    
    let newExp = { id: Date.now(), name: name, amount: amount, date: new Date().toLocaleDateString('fr-FR') };
    
    // NOUVEAU : Sauvegarde la dépense dans Firebase
    await window.setDoc(window.doc(window.db, "expenses", newExp.id.toString()), newExp);
    
    expensesList.unshift(newExp);
    renderExpenses();
    document.getElementById('expense-modal').classList.add('hidden');
    customAlert("✅ Facture ajoutée au bilan !");
};

window.deleteExpense = async function(id) {
    // NOUVEAU : Supprime la dépense de Firebase
    await window.deleteDoc(window.doc(window.db, "expenses", id.toString()));
    
    expensesList = expensesList.filter(exp => exp.id !== id);
    renderExpenses();
};

function renderSuggestions() {
    const tbody = document.getElementById('admin-suggestions-list');
    tbody.innerHTML = suggestions.map(s => `<tr><td>${s.name}</td><td>${s.date}</td></tr>`).join('');
}


window.updateDashboardStats = function() {
    // 1. Calcul de l'argent qui rentre (Commandes livrées ou en cours)
    let totalCA = 0;
    adminOrders.forEach(o => {
        if (o.status === 'delivered' || o.status === 'progress') {
            totalCA += o.total;
        }
    });

    // 2. Calcul de l'argent qui sort (Factures / Dépenses)
    let totalExp = 0;
    expensesList.forEach(e => {
        totalExp += e.amount;
    });

    // 3. Calcul du bénéfice
    let profit = totalCA - totalExp;

    // 4. Affichage sur le site
    const caEl = document.getElementById('dashboard-revenue');
    const profEl = document.getElementById('dashboard-profit');
    
    if (caEl) caEl.innerText = totalCA.toFixed(2) + ' €';
    if (profEl) {
        profEl.innerText = profit.toFixed(2) + ' €';
        // Petit bonus : si le bénéfice est négatif, on le met en rouge !
        profEl.style.color = profit >= 0 ? '#d4af37' : '#dc3545';
    }
};

// ==========================================
// --- GRAPHIQUES & STATISTIQUES AVANCÉS ---
// ==========================================

let salesChartInstance = null;
let revenueChartInstance = null;

// 1. Calcul des statistiques globales et pourcentages
window.updateDashboardStats = function() {
    let totalCA = 0;
    let totalExp = 0;
    let currentMonthCA = 0;
    let lastMonthCA = 0;

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    // Analyse des commandes
    adminOrders.forEach(o => {
        if (o.status === 'delivered' || o.status === 'progress') {
            totalCA += o.total; // Total absolu

            // Découpage de la date pour les tendances
            let parts = o.date.split('/');
            if (parts.length === 3) {
                let m = parseInt(parts[1]) - 1;
                let y = parseInt(parts[2]);
                
                if (m === currentMonth && y === currentYear) {
                    currentMonthCA += o.total;
                } else if (m === (currentMonth === 0 ? 11 : currentMonth - 1) && y === (currentMonth === 0 ? currentYear - 1 : currentYear)) {
                    lastMonthCA += o.total;
                }
            }
        }
    });

    // Analyse des dépenses
    expensesList.forEach(e => totalExp += e.amount);
    let profit = totalCA - totalExp;

    // Calcul de la tendance (Flèches)
    let trendHTML = '';
    if (lastMonthCA > 0) {
        let pct = ((currentMonthCA - lastMonthCA) / lastMonthCA) * 100;
        trendHTML = pct >= 0 ? `↗ +${pct.toFixed(1)}% ce mois` : `↘ ${pct.toFixed(1)}% ce mois`;
    } else if (currentMonthCA > 0) {
        trendHTML = `↗ +100% ce mois`;
    } else {
        trendHTML = `~ 0% ce mois`;
    }

    // Affichage des chiffres
    const caEl = document.getElementById('dashboard-revenue');
    const profEl = document.getElementById('dashboard-profit');
    const trends = document.querySelectorAll('.f-trend');
    
    if (caEl) caEl.innerText = totalCA.toFixed(2) + ' €';
    if (profEl) {
        profEl.innerText = profit.toFixed(2) + ' €';
        profEl.style.color = profit >= 0 ? '#d4af37' : '#dc3545';
    }
    if (trends.length >= 2) {
        let trendClass = trendHTML.includes('↗') ? 'text-green' : (trendHTML.includes('↘') ? 'text-red' : '');
        trends[0].innerText = trendHTML;
        trends[0].className = 'f-trend ' + trendClass;
        trends[1].innerText = trendHTML;
        trends[1].className = 'f-trend ' + trendClass;
    }

    // Mise à jour des graphiques dans la foulée
    window.updateCharts();
};

// 2. Génération des graphiques (Avec Filtre de Temps et Bénéfice de la période)
window.updateCharts = function() {
    const barCanvas = document.getElementById('revenueBarChart');
    const pieCanvas = document.getElementById('salesPieChart');
    
    // SÉCURITÉ : Si l'un des graphiques a disparu du HTML, on arrête tout sans faire planter le site !
    if (!barCanvas || !pieCanvas) return; 

    const periodVal = document.getElementById('chart-period-filter') ? document.getElementById('chart-period-filter').value : '7';
    const now = new Date();
    now.setHours(0,0,0,0);

    let labels = [];
    let revData = [];

    // NOUVEAU : Variables pour calculer le bénéfice exact de la période
    let periodTotalRevenue = 0;
    let periodTotalExpenses = 0;

    // A. Préparation de l'axe des temps (Barres)
    if (periodVal !== 'all') {
        let days = parseInt(periodVal);
        for (let i = days - 1; i >= 0; i--) {
            let d = new Date(now);
            d.setDate(now.getDate() - i);
            labels.push(d.toLocaleDateString('fr-FR'));
            revData.push(0);
        }
    } else {
        // "Depuis toujours" : On regroupe toutes les dates existantes
        let uniqueDates = new Set();
        adminOrders.forEach(o => { if(o.status === 'delivered' || o.status === 'progress') uniqueDates.add(o.date); });
        labels = Array.from(uniqueDates).sort((a,b) => {
            let da = a.split('/'); let db = b.split('/');
            return new Date(da[2], da[1]-1, da[0]) - new Date(db[2], db[1]-1, db[0]);
        });
        revData = new Array(labels.length).fill(0);
    }

    let pieTotals = { 'Cigarettes': 0, 'Tabac': 0, 'Alcool': 0, 'Cigares': 0 };

    // B. Remplissage des données avec les vraies commandes
    adminOrders.forEach(o => {
        if (o.status !== 'delivered' && o.status !== 'progress') return;

        let idx = labels.indexOf(o.date);
        
        // Si la commande fait partie de la période sélectionnée
        if (idx !== -1 || periodVal === 'all') {
            if (idx !== -1) revData[idx] += o.total;
            
            // NOUVEAU : On ajoute au CA de la période
            periodTotalRevenue += o.total;

            // Analyse du Camembert
            if (o.items) {
                let itemsList = o.items.split(', ');
                itemsList.forEach(itemStr => {
                    let match = itemStr.match(/(.*) \(x(\d+)\)/);
                    if (match) {
                        let name = match[1].trim();
                        let qty = parseInt(match[2]);
                        let prod = products.find(p => p.name === name);
                        if (prod) {
                            let cat = prod.cat === 'Alcools' ? 'Alcool' : prod.cat;
                            if (pieTotals[cat] !== undefined) pieTotals[cat] += (prod.price * qty);
                        }
                    }
                });
            }
        }
    });

    // NOUVEAU : Calcul des dépenses (factures) de la même période
    expensesList.forEach(e => {
        if (periodVal === 'all' || labels.indexOf(e.date) !== -1) {
            periodTotalExpenses += e.amount;
        }
    });

    // NOUVEAU : Mise à jour de l'affichage du bénéfice de la période à l'écran
    let periodProfit = periodTotalRevenue - periodTotalExpenses;
    let profitEl = document.getElementById('period-profit-val');
    if (profitEl) {
        profitEl.innerText = periodProfit.toFixed(2) + ' €';
        profitEl.style.color = periodProfit >= 0 ? '#10b981' : '#dc3545'; // Vert si positif, rouge si négatif
    }

    // C. Affichage Barres
    const ctxBar = document.getElementById('revenueBarChart').getContext('2d');
    let displayLabels = labels.map(l => l.substring(0, 5)); // On affiche "JJ/MM"
    if (revenueChartInstance) {
        revenueChartInstance.data.labels = displayLabels;
        revenueChartInstance.data.datasets[0].data = revData;
        revenueChartInstance.update();
    } else {
        revenueChartInstance = new Chart(ctxBar, {
            type: 'bar',
            data: { labels: displayLabels, datasets: [{ label: 'Revenus (€)', data: revData, backgroundColor: '#d4af37', borderRadius: 5 }] },
            options: { responsive: true, maintainAspectRatio: false }
        });
    }

    // D. Affichage Camembert (Avec sécurité "Zéro")
    const ctxPie = document.getElementById('salesPieChart').getContext('2d');
    let pieDataArr = [pieTotals['Cigarettes'], pieTotals['Tabac'], pieTotals['Alcool'], pieTotals['Cigares']];
    let isZero = pieDataArr.every(v => v === 0);
    let bgColors = isZero ? ['#e0e0e0', '#e0e0e0', '#e0e0e0', '#e0e0e0'] : ['#0b1d3a', '#d4af37', '#10b981', '#881337'];
    let displayData = isZero ? [1, 1, 1, 1] : pieDataArr;

    if (salesChartInstance) {
        salesChartInstance.data.datasets[0].data = displayData;
        salesChartInstance.data.datasets[0].backgroundColor = bgColors;
        salesChartInstance.update();
    } else {
        salesChartInstance = new Chart(ctxPie, {
            type: 'doughnut',
            data: { labels: ['Cigarettes', 'Tabac', 'Alcools', 'Cigares'], datasets: [{ data: displayData, backgroundColor: bgColors, borderWidth: 0 }] },
            options: { 
                responsive: true, maintainAspectRatio: false,
                plugins: { tooltip: { callbacks: { label: function(c) { return isZero ? "Aucune vente" : c.label + ': ' + c.raw.toFixed(2) + ' €'; } } } }
            }
        });
    }
};

// ==========================================
// --- OUTILS ET ALERTES ---
// ==========================================

function renderSuggestions() {
    const tbody = document.getElementById('admin-suggestions-list');
    tbody.innerHTML = suggestions.map(s => `<tr><td>${s.name}</td><td>${s.date}</td></tr>`).join('');
}

window.customAlert = function(msg) {
    document.getElementById('custom-alert-text').innerText = msg;
    document.getElementById('custom-alert-modal').classList.remove('hidden');
};
window.closeCustomAlert = function() {
    document.getElementById('custom-alert-modal').classList.add('hidden');
};

// --- ENVOI D'E-MAIL (EMAILJS) ---
function envoyerEmailConfirmation(nom, email, orderId, htmlRecap, total) {
    emailjs.send('service_lrtfieb', 'template_0p0rev9', { 
        client_name: nom, 
        client_email: email, 
        order_id: orderId, 
        recap_html: htmlRecap, 
        total_commande: total 
    }).then(() => console.log('✅ Email envoyé !')).catch((err) => console.error(err));
}

// ==========================================
// --- OPTIMISATIONS MOBILE (SCROLL HOVER) ---
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    // Uniquement sur téléphone
    if (window.innerWidth <= 768) {
        const cards = document.querySelectorAll('.glass-card');
        
        window.addEventListener('scroll', () => {
            let closestCard = null;
            let minDistance = Infinity;
            // On calcule exactement le milieu de l'écran du téléphone
            const centerY = window.innerHeight / 2; 

            cards.forEach(card => {
                const rect = card.getBoundingClientRect();
                const cardCenter = rect.top + (rect.height / 2);
                const distance = Math.abs(centerY - cardCenter);

                if (distance < minDistance) {
                    minDistance = distance;
                    closestCard = card;
                }
            });

            // On allume UNIQUEMENT la carte la plus proche (si elle est à moins de 150px du centre)
            cards.forEach(card => {
                if (card === closestCard && minDistance < 150) {
                    card.classList.add('mobile-hover');
                } else {
                    card.classList.remove('mobile-hover');
                }
            });
        });
    }
});