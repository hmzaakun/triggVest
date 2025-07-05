# 🔷 Base Swap POC - 1inch + Circle Smart Accounts

Ce POC permet de swapper des tokens USDC vers ETH sur la chaîne Base en utilisant l'API 1inch et les smart accounts Circle.

## ✨ Fonctionnalités

- 🔄 Swap USDC → ETH sur Base Mainnet
- 💰 Meilleurs taux via 1inch aggregator
- 🤖 Exécution via Circle Smart Accounts
- ⚡ Gas fees payés automatiquement
- 📊 Prix en temps réel
- 🔧 Interface CLI interactive

## 🔧 Configuration

### 1. Variables d'environnement

Ajoutez ces variables dans votre fichier `.env`:

```bash
# Clé API Circle (déjà configurée)
CIRCLE_API_KEY=TEST_API_KEY:your_key_id:your_secret

# Nouvelle clé API 1inch
ONEINCH_API_KEY=your_1inch_api_key_here
```

### 2. Obtenir une clé API 1inch

1. Allez sur [1inch Developer Portal](https://1inch.dev/)
2. Créez un compte gratuit
3. Obtenez votre clé API
4. Ajoutez-la dans `.env`

## 🚀 Utilisation

### Option 1: Interface CLI complète

```bash
npm run start
```

Puis choisissez "🔷 Base Swap (1inch)"

### Option 2: Test rapide

```bash
npm run ts-node quick-base-swap.ts
```

### Option 3: Test complet

```bash
npm run ts-node test-base-swap.ts
```

## 💡 Prérequis

### Wallets requis

1. **Wallet Set avec Base**: Vous devez avoir un wallet set contenant au moins un wallet Base
2. **USDC sur Base**: Le wallet doit contenir des USDC sur Base Mainnet
3. **ETH pour gas**: Bien que Circle paie les gas fees, assurez-vous d'avoir un peu d'ETH

### Comment obtenir des USDC sur Base

1. **Option 1**: Utiliser notre bridge CCTP
   - Bridgez USDC depuis Ethereum/Polygon vers Base
   - Utilisez l'option "🔄 CCTP Bridge" dans le menu

2. **Option 2**: Bridge officiel Base
   - Utilisez [bridge.base.org](https://bridge.base.org)
   - Transférez USDC depuis Ethereum

3. **Option 3**: Acheter directement
   - Utilisez un exchange supportant Base
   - Retirez directement sur Base

## 📊 Exemple d'utilisation

```typescript
import { baseSwapService } from './src/services/oneinch';

// Obtenir un prix
const price = await baseSwapService.getUSDCToETHPrice("100");
console.log(`100 USDC = ${price.ethAmount} ETH`);

// Effectuer un swap
const result = await baseSwapService.swapUSDCToETH({
  walletId: "your-wallet-id",
  usdcAmount: "100",
  slippage: 1, // 1%
  walletAddress: "0x..."
});
```

## 🔍 Fonctionnalités détaillées

### 1. Prix en temps réel

```bash
💰 Prix USDC/ETH sur Base (via 1inch):
   1 USDC → 0.00026xxx ETH
   10 USDC → 0.0026xxx ETH
   100 USDC → 0.026xxx ETH
```

### 2. Tokens supportés

- **USDC**: USD Coin (6 decimals)
- **ETH**: Ethereum natif (18 decimals)
- **WETH**: Wrapped Ether (18 decimals)
- **cbETH**: Coinbase Wrapped Staked ETH (18 decimals)

### 3. Paramètres de swap

- **Slippage**: 0.1% à 3% (recommandé: 1%)
- **Partial fills**: Supporté
- **MEV protection**: Inclus avec 1inch

## 🔧 Configuration avancée

### Adresses des contrats (Base Mainnet)

```typescript
const BASE_CONFIG = {
  CHAIN_ID: 8453,
  USDC_ADDRESS: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  ONEINCH_ROUTER: '0x111111125421cA6dc452d289314280a0f8842A65',
  RPC_URL: 'https://base.llamarpc.com',
  EXPLORER: 'https://basescan.org'
};
```

### Processus de swap

1. **Vérification**: Balance USDC suffisante
2. **Quote**: Obtention du prix 1inch
3. **Approbation**: Approve USDC si nécessaire
4. **Swap**: Exécution via Circle Smart Account
5. **Confirmation**: Vérification de la transaction

## 📈 Avantages

### 1inch Integration
- ✅ Meilleurs taux du marché
- ✅ Liquidité agrégée de tous les DEXs
- ✅ Optimisation des gas fees
- ✅ MEV protection

### Circle Smart Accounts
- ✅ Pas besoin de seed phrases
- ✅ Gas fees payés automatiquement
- ✅ Sécurité enterprise
- ✅ API simple

### Base Chain
- ✅ Fees très bas
- ✅ Transactions rapides
- ✅ Écosystème Coinbase
- ✅ Compatible Ethereum

## 🛠️ Développement

### Structure des fichiers

```
src/
├── services/
│   ├── oneinch.ts          # Service principal 1inch
│   ├── circle.ts           # Service Circle existant
│   └── wallet.ts           # Gestion des wallets
├── ui/
│   ├── baseSwap.ts         # Interface CLI swap
│   └── menu.ts             # Menu principal
└── config/
    └── constants.ts        # Configuration Base
```

### Tests disponibles

```bash
# Test rapide (prix uniquement)
npm run ts-node quick-base-swap.ts

# Test complet avec interface
npm run ts-node test-base-swap.ts

# Interface complète
npm run start
```

## 🐛 Debugging

### Erreurs communes

1. **"Prix indisponible"**
   - Vérifiez votre clé API 1inch
   - Vérifiez votre connexion internet

2. **"Wallet set non trouvé"**
   - Créez d'abord un wallet set avec Base
   - Vérifiez que vous avez des wallets Base

3. **"Aucun USDC trouvé"**
   - Transférez USDC sur Base
   - Vérifiez l'adresse du wallet

### Logs détaillés

Le service affiche des logs détaillés pour chaque étape:

```
🔄 Initialisation du swap USDC → ETH sur Base...
💰 Montant: 100 USDC
⚡ Slippage: 1%
📊 Obtention du quote 1inch...
💰 ETH attendu: ~0.026 ETH
🔍 Vérification de l'allowance USDC...
🔄 Exécution du swap...
🎉 Swap exécuté avec succès!
```

## 📝 Notes importantes

1. **Testnet vs Mainnet**: Ce POC utilise Base Mainnet avec de vrais tokens
2. **Gas fees**: Circle paie les gas fees mais vous devez avoir des tokens pour le swap
3. **Slippage**: Plus le slippage est bas, plus le swap est précis mais risque d'échouer
4. **Montants**: Testez avec de petits montants d'abord

## 🔗 Liens utiles

- [1inch Documentation](https://docs.1inch.io/)
- [Base Documentation](https://docs.base.org/)
- [Circle Developer](https://developers.circle.com/)
- [BaseScan Explorer](https://basescan.org/)

## 🚀 Prochaines étapes

1. Support d'autres tokens (WETH, cbETH, etc.)
2. Swaps multi-étapes
3. Limit orders
4. Interface web
5. Notifications de prix 