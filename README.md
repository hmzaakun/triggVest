# 🧠 TriggVest - CCTP Wallet Manager

> **Cross-Chain Transfer Protocol (CCTP) wallet management system using Circle's Developer-Controlled Wallets SDK**

TriggVest est un gestionnaire de wallets programmables basé sur Circle SDK qui permet de créer des stratégies d'investissement réactives automatisées via CCTP v2.

## 🚀 Quick Start

### Installation

```bash
# Clone the repository
git clone <your-repo>
cd triggVest

# Install dependencies
npm install

# Setup environment variables
cp .env.example .env
# Edit .env with your Circle API credentials
```

### Variables d'environnement requises

```env
# Circle API Credentials (required)
CIRCLE_API_KEY=your_circle_api_key
CIRCLE_ENTITY_SECRET=your_entity_secret_hex

# Optional: Logging level
LOG_LEVEL=info
```

### Lancement

```bash
# Development mode
npm run dev

# Production
npm run build
npm start
```

## 📁 Architecture du projet (Post-Refactoring)

```
src/
├── config/
│   └── constants.ts          # Configuration CCTP, faucets, chaînes supportées
├── services/
│   ├── circle.ts            # 🔑 Service Circle API (wallet creation, transactions)
│   ├── cctp.ts              # 🌉 Service CCTP bridging
│   ├── transaction.ts       # 📊 Gestion des transactions
│   └── wallet.ts            # 💾 Gestion locale des wallets (JSON)
├── types/
│   └── index.ts             # Types TypeScript
├── ui/
│   ├── bridge.ts            # Interface bridge CCTP
│   ├── menu.ts              # Menu principal
│   └── walletManagement.ts  # Gestion des wallet sets
├── utils/
│   └── helpers.ts           # Fonctions utilitaires
└── index.ts                 # Point d'entrée
```

## 🔑 Services principaux

### Circle Service (`src/services/circle.ts`)

Service principal pour interagir avec Circle API.

#### Créer un Wallet Set

```typescript
import { createWalletSet, createWallet } from './services/circle';
import { Blockchain } from '@circle-fin/developer-controlled-wallets';

// 1. Créer un wallet set
const walletSet = await createWalletSet("my-strategy-wallets");
console.log("Wallet Set créé:", walletSet.id);

// 2. Créer des wallets pour plusieurs blockchains
const blockchains: Blockchain[] = ["ETH-SEPOLIA", "AVAX-FUJI", "MATIC-AMOY"];
const wallets = await createWallet(walletSet.id, blockchains);

console.log(`${wallets.length} wallets créés:`, wallets);
```

#### Obtenir les balances

```typescript
import { getWalletBalance } from './services/circle';

const balances = await getWalletBalance("wallet-id-here");
console.log("Balances:", balances);
```

#### Exécuter une transaction

```typescript
import { createContractTransaction } from './services/circle';

const transaction = await createContractTransaction({
  walletId: "your-wallet-id",
  contractAddress: "0x9f3B8679c73C2Fef8b59B4f3444d4e156fb70AA5", // CCTP Token Messenger
  abiFunctionSignature: "depositForBurn(uint256,uint32,bytes32,address)",
  abiParameters: [amount, destinationDomain, mintRecipient, burnToken],
  feeLevel: "MEDIUM"
});

console.log("Transaction créée:", transaction.data?.transactionId);
```

### CCTP Service (`src/services/cctp.ts`)

Service pour les bridges cross-chain USDC.

#### Bridge Standard (13 min)

```typescript
import { bridgeUSDCStandard } from './services/cctp';

const result = await bridgeUSDCStandard({
  fromWalletId: "source-wallet-id",
  toBlockchain: "AVAX-FUJI",
  amount: "10.5", // USDC amount
  recipientAddress: "0x..." // Optional, sinon même adresse
});

if (result.success) {
  console.log("Bridge initié:", result.transactionId);
}
```

#### Bridge Rapide (22 sec, 0.01 USDC fee)

```typescript
import { bridgeUSDCFast } from './services/cctp';

const result = await bridgeUSDCFast({
  fromWalletId: "source-wallet-id", 
  toBlockchain: "ETH-SEPOLIA",
  amount: "100.0"
});

if (result.success) {
  console.log("Bridge rapide:", result.transactionId);
}
```

#### Swap ETH vers USDC (Uniswap V3)

```typescript
import { swapExactETHToUSDC } from './src/examples/eth-to-usdc-swap';

// Swap 0.001 ETH vers USDC sur Sepolia
const result = await swapExactETHToUSDC("wallet-id", "0.001");

if (result.success) {
  console.log(`Swap réussi! TX: ${result.transactionId}`);
  console.log(`USDC reçu: ~${result.expectedUSDC} USDC`);
}
```

### Wallet Service (`src/services/wallet.ts`)

Gestion locale des wallets (fichier JSON).

#### Sauvegarder un wallet set

```typescript
import { saveWalletsToFile } from './services/wallet';

await saveWalletsToFile({
  walletSetId: "768264dc-caf0-5e8f-8659-afe7272cae00",
  walletSetName: "alice-strategy-1",
  wallets: createdWallets,
  lastUpdated: new Date().toISOString()
});
```

#### Charger les wallet sets

```typescript
import { getSavedWalletSets, getWalletSetByName } from './services/wallet';

// Tous les wallet sets
const allSets = getSavedWalletSets();

// Un wallet set spécifique
const mySet = getWalletSetByName("alice-strategy-1");
if (mySet) {
  console.log("Wallets:", mySet.wallets);
}
```

## 🏗️ Patterns d'utilisation avancés

### Créer un wallet complet pour une stratégie

```typescript
import { setupEncryptedEntitySecret, createWalletSet, createWallet } from './services/circle';
import { saveWalletsToFile } from './services/wallet';

async function createStrategyWallet(strategyName: string, chains: Blockchain[]) {
  try {
    // 1. Setup entity secret (requis pour nouveau wallet set)
    console.log("🔐 Setting up encrypted entity secret...");
    await setupEncryptedEntitySecret(strategyName);
    
    // 2. Créer le wallet set
    console.log("🆕 Creating wallet set...");
    const walletSet = await createWalletSet(strategyName);
    
    // 3. Créer les wallets pour chaque chaîne
    console.log("🔨 Creating wallets...");
    const wallets = await createWallet(walletSet.id, chains);
    
    // 4. Sauvegarder localement
    await saveWalletsToFile({
      walletSetId: walletSet.id,
      walletSetName: strategyName,
      wallets: wallets,
      lastUpdated: new Date().toISOString()
    });
    
    console.log("✅ Strategy wallet created successfully!");
    return { walletSetId: walletSet.id, wallets };
    
  } catch (error) {
    console.error("❌ Error:", error);
    throw error;
  }
}

// Utilisation
const result = await createStrategyWallet("my-defi-strategy", [
  "ETH-SEPOLIA", 
  "AVAX-FUJI", 
  "BASE-SEPOLIA"
]);
```

### Bridge avec vérification des balances

```typescript
import { getWalletBalance } from './services/circle';
import { bridgeUSDCStandard } from './services/cctp';
import { formatUnits } from './utils/helpers';

async function safeBridge(walletId: string, toChain: string, amount: string) {
  // 1. Vérifier la balance USDC
  const balances = await getWalletBalance(walletId);
  const usdcBalance = balances?.find(b => 
    b.token.symbol === "USDC" && parseFloat(b.amount) >= parseFloat(amount)
  );
  
  if (!usdcBalance) {
    throw new Error(`Insufficient USDC balance. Required: ${amount}`);
  }
  
  // 2. Vérifier la balance gas
  const gasBalance = balances?.find(b => b.token.symbol === "ETH");
  if (!gasBalance || parseFloat(gasBalance.amount) < 0.001) {
    console.warn("⚠️ Low gas balance, transaction might fail");
  }
  
  // 3. Exécuter le bridge
  console.log(`🌉 Bridging ${amount} USDC to ${toChain}...`);
  return await bridgeUSDCStandard({
    fromWalletId: walletId,
    toBlockchain: toChain,
    amount: amount
  });
}
```

## 🔧 Configuration

### Chaînes supportées

Le projet supporte 6 testnets configurés dans `src/config/constants.ts`:

- **ETH-SEPOLIA** (Domain: 0)
- **MATIC-AMOY** (Domain: 7) 
- **AVAX-FUJI** (Domain: 1)
- **ARB-SEPOLIA** (Domain: 3)
- **BASE-SEPOLIA** (Domain: 6)
- **OP-SEPOLIA** (Domain: 2)

### Faucets testnet

```typescript
import { FAUCET_INFO } from './config/constants';

// Obtenir les faucets pour une chaîne
const faucets = FAUCET_INFO["ETH-SEPOLIA"];
console.log("Faucets disponibles:", faucets);
```

## 📊 Fichiers de données

### `wallets.json`
Base de données locale des wallet sets créés:

```json
{
  "strategy-name": {
    "walletSetId": "768264dc-caf0-5e8f-8659-afe7272cae00",
    "walletSetName": "strategy-name",
    "wallets": [
      {
        "id": "wallet-id",
        "address": "0x...",
        "blockchain": "ETH-SEPOLIA",
        "createDate": "2025-01-15T10:45:49Z"
      }
    ],
    "lastUpdated": "2025-01-15T10:45:49.891Z"
  }
}
```

### `recovery_file_*.dat`
⚠️ **Fichiers critiques** générés par Circle contenant les clés de récupération.

**Important:** 
- Sauvegarder ces fichiers en lieu sûr
- Nécessaires pour récupérer l'accès aux wallets
- Un fichier par entity secret utilisé

## 🚨 Gestion d'erreurs

### Patterns recommandés

```typescript
import { waitForTransactionConfirmation } from './services/circle';

async function robustTransaction(transactionId: string) {
  try {
    // Attendre confirmation avec timeout
    const result = await waitForTransactionConfirmation(transactionId, 15); // 15 min max
    
    if (result.state === "COMPLETE") {
      console.log("✅ Transaction confirmed!");
      return result;
    }
    
  } catch (error) {
    if (error.message.includes("timeout")) {
      console.log("⏱️ Transaction timeout - may still be processing");
      // Utiliser transaction tracker pour vérifier plus tard
    } else {
      console.error("❌ Transaction failed:", error);
    }
    throw error;
  }
}
```

### Messages d'aide intégrés

```typescript
import { HELP_MESSAGES } from './config/constants';

// Afficher l'aide pour les requirements bridge
console.log(HELP_MESSAGES.BRIDGE_REQUIREMENTS);

// Afficher l'aide pour les timeouts
console.log(HELP_MESSAGES.TIMEOUT_RECOVERY);
```

## 🔒 **Limitations & Contrôle des wallets**

### ⚠️ **Important: Architecture MPC**

Circle utilise la technologie **MPC (Multi-Party Computation) 2-of-2**, ce qui signifie :

❌ **Pas de seed phrase BIP39 extractible**  
❌ **Pas de clé privée unique accessible**  
✅ **Sécurité renforcée via distribution des clés**  
✅ **Contrôle via API Circle uniquement**

```typescript
// ❌ IMPOSSIBLE avec Circle MPC
const privateKey = extractPrivateKey("recovery_file.dat"); // N'existe pas

// ✅ POSSIBLE via Circle API
const transaction = await createContractTransaction({
  walletId: "your-wallet-id",
  contractAddress: uniswapRouter,
  abiFunctionSignature: "exactInputSingle(...)",
  abiParameters: [swapParams]
});
```

### 🛠️ **Options pour plus de contrôle**

#### Option 1: Swaps via Circle API
```typescript
// Voir: src/examples/custom-swap-example.ts
import { swapUSDCToWETH } from './src/examples/custom-swap-example';

const swap = await swapUSDCToWETH(walletId, "1000000", "500000000000000");
```

#### Option 2: Migration vers Self-Custody
```typescript
// Voir: src/examples/export-to-self-custody.ts
import { migrateToSelfCustody, createSelfCustodyWallet } from './src/examples/export-to-self-custody';

// 1. Créer wallet avec seed phrase
const selfWallet = createSelfCustodyWallet();

// 2. Migrer les fonds Circle
await migrateToSelfCustody(circleWalletId, selfWallet.address);

// 3. Contrôle total avec ethers.js
const provider = new ethers.JsonRpcProvider(rpcUrl);
const wallet = new ethers.Wallet(selfWallet.privateKey, provider);
```

#### Option 3: Setup MPC Personnel
```typescript
// Contact Circle pour héberger tes propres nœuds MPC
// Email: developers@circle.com
const mpcConfig = {
  sharedKeyManagement: true,
  keyguardService: "your-server",
  selfHostedNodes: 1 // ou 2 pour contrôle total
};
```

## 🧪 Tests et développement

### Mode debug

```typescript
// Activer les logs détaillés
process.env.LOG_LEVEL = "debug";

// Utiliser les helpers de formatting
import { formatBalance, formatTransactionStatus } from './utils/helpers';

const balance = formatBalance("1000000", 6); // "1.000000"
const status = formatTransactionStatus("COMPLETE"); // "✅ Complete"
```

### Testnet faucets

Utiliser la fonction intégrée pour obtenir des liens de faucets:

```typescript
import { FAUCET_INFO } from './config/constants';

Object.entries(FAUCET_INFO).forEach(([chain, faucets]) => {
  console.log(`\n${chain}:`);
  faucets.forEach(faucet => {
    console.log(`  - ${faucet.name}: ${faucet.url}`);
  });
});
```

### Test rapide - Swap ETH vers USDC

Pour tester rapidement un swap de 0.001 ETH vers USDC :

```bash
# 1. Assure-toi d'avoir un wallet avec ETH-SEPOLIA
npm run dev  # Créer un wallet si nécessaire

# 2. Obtenir des ETH Sepolia (faucet)
# https://sepoliafaucet.com/

# 3. Tester le swap
npm run test:swap
```

Le script va automatiquement :
- ✅ Détecter ton wallet Sepolia
- ✅ Vérifier la balance ETH
- ✅ Exécuter le swap via Uniswap V3
- ✅ Attendre la confirmation
- ✅ Afficher les résultats

## 🎯 Prochaines étapes (TriggVest complet)

Ce projet actuel sert de base pour le système TriggVest complet qui incluera:

1. **Frontend Next.js 14** avec interface de création de stratégies
2. **Base de données Supabase** pour la persistance
3. **APIs dédiées** (trigger-api, strategy-router-api, circle-executor-api)
4. **WebSocket** pour les événements en temps réel
5. **Intégration Twitter/Discord** pour les triggers

Voir `strategy-architecture.md` pour les détails de l'architecture finale.

## 📚 Ressources

- [Circle Developer Docs](https://developers.circle.com/developer-controlled-wallets)
- [CCTP Documentation](https://developers.circle.com/stablecoins/cctp-protocol-contract)
- [Supported Testnets](https://developers.circle.com/developer-controlled-wallets/docs/web3-services-supported-chains)

## 🤝 Contributing

1. Respecter l'architecture modulaire
2. Utiliser TypeScript strict
3. Tester sur testnets uniquement
4. Documenter les nouvelles fonctions
5. Sauvegarder les recovery files

---

**⚠️ Important:** Ce projet utilise les testnets Circle. Ne jamais utiliser avec de vrais fonds sur mainnet sans tests approfondis.