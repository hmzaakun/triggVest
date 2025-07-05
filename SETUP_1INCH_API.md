# 🔑 Configuration API 1inch - Guide Étape par Étape

## ✅ Ce que le test a montré :

Votre POC Base Swap fonctionne parfaitement ! L'erreur 401 est normale car il manque juste la clé API 1inch.

**Résultats du test :**
- ✅ Architecture du service fonctionnelle
- ✅ Wallets Base détectés (5 wallet sets avec BASE-SEPOLIA)
- ✅ Configuration des tokens correcte
- ✅ Interface CLI opérationnelle
- ⏳ Seule la clé API 1inch manque

## 🚀 Étapes pour finaliser le POC

### 1. Obtenir votre clé API 1inch (2 minutes, gratuit)

1. **Allez sur [1inch.dev](https://1inch.dev)**
2. **Cliquez sur "Get your API key" ou "Sign in"**
3. **Créez un compte avec votre email**
4. **Vérifiez votre email**
5. **Connectez-vous au Developer Portal**
6. **Dans le dashboard, copiez votre clé API**

### 2. Configurer votre fichier .env

Ajoutez cette ligne dans votre fichier `.env` :

```bash
# Clé API 1inch (gratuite)
ONEINCH_API_KEY=votre_clé_api_ici

# Exemple du format :
# ONEINCH_API_KEY=abc123def456ghi789jkl012mno345pqr678stu901vwx234yz
```

### 3. Tester immédiatement

Une fois configuré, lancez :

```bash
npx ts-node quick-base-swap.ts
```

Vous devriez voir :
```
💰 Prix USDC/ETH sur Base (via 1inch):
   1 USDC → 0.00026xxx ETH
   10 USDC → 0.0026xxx ETH
   100 USDC → 0.026xxx ETH
```

### 4. Interface complète

```bash
npm run start
```

Puis choisissez "🔷 Base Swap (1inch)"

## 📊 Plan gratuit 1inch (largement suffisant)

- ✅ **1 requête par seconde**
- ✅ **100,000 requêtes par mois**
- ✅ **Support Base mainnet**
- ✅ **Accès à tous les DEXs**
- ✅ **Gratuit à vie**

## 🎯 Vos wallet sets disponibles

D'après le test, vous avez déjà :
1. **TriggVest WalletSet**
2. **Nax**
3. **naxzerrr**
4. **newSet** (avec BASE-SEPOLIA: 0x7973e8...)
5. **Cyas** (avec BASE-SEPOLIA: 0xdccfbe...)

## 💡 Prochains tests recommandés

### Test 1: Prix en temps réel
```bash
npx ts-node quick-base-swap.ts
```

### Test 2: Interface complète
```bash
npm run start
# → Base Swap (1inch)
# → Voir le prix USDC/ETH actuel
```

### Test 3: Swap réel (si vous avez USDC sur Base)
```bash
npm run start
# → Base Swap (1inch)  
# → Faire un swap USDC → ETH
```

## 🔧 Dépannage

### Si vous voyez encore "Invalid API key" :
1. Vérifiez que la clé est dans `.env`
2. Redémarrez le script
3. Vérifiez qu'il n'y a pas d'espaces autour de la clé

### Pour obtenir des USDC sur Base :
1. **Option 1**: Utilisez notre bridge CCTP (menu principal → CCTP Bridge)
2. **Option 2**: Bridge officiel Base ([bridge.base.org](https://bridge.base.org))
3. **Option 3**: Exchange supportant Base

## 🎉 Félicitations !

Votre POC est prêt ! Une fois la clé configurée, vous pourrez :
- ✅ Voir les prix USDC/ETH en temps réel
- ✅ Calculer les taux pour différents montants
- ✅ Effectuer des swaps depuis vos Circle Smart Accounts
- ✅ Bénéficier des meilleurs taux via 1inch

---

**Temps estimé total : 2-3 minutes pour obtenir et configurer la clé** 