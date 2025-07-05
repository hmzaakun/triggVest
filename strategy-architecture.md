# 🧠 TriggVest - Architecture & Data Structures

## 📊 **Base de données des stratégies (Supabase)**

```sql
-- Table des utilisateurs
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Table des stratégies  
CREATE TABLE strategies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  strategy_name TEXT NOT NULL,
  status TEXT DEFAULT 'active', -- active, paused, archived
  wallet_set_id TEXT NOT NULL, -- Circle Wallet Set ID
  triggers JSONB NOT NULL,
  actions JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Table des exécutions
CREATE TABLE executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  strategy_id UUID REFERENCES strategies(id),
  trigger_event JSONB NOT NULL,
  execution_result JSONB,
  status TEXT NOT NULL, -- pending, success, failed
  created_at TIMESTAMP DEFAULT NOW()
);
```

## 🎯 **JSON Structure - Stratégie Reactive**

```json
{
  "strategyId": "550e8400-e29b-41d4-a716-446655440000",
  "userId": "user-alice",
  "strategyName": "FED Panic Strategy",
  "status": "active",
  "walletSetId": "768264dc-caf0-5e8f-8659-afe7272cae00",
  "triggers": [
    {
      "type": "twitter",
      "config": {
        "account": "@federalreserve",
        "keywords": ["recession", "crash", "emergency"],
        "sentiment": "negative"
      }
    },
    {
      "type": "twitter", 
      "config": {
        "account": "@elonmusk",
        "keywords": ["bitcoin", "crypto", "sell"],
        "sentiment": "negative"
      }
    }
  ],
  "actions": [
    {
      "type": "convert_all",
      "config": {
        "targetAsset": "USDC",
        "targetChain": "AVAX-FUJI",
        "slippage": 0.5,
        "priority": "high"
      }
    },
    {
      "type": "notification",
      "config": {
        "discord": "webhook_url",
        "email": "alice@email.com"
      }
    }
  ],
  "metadata": {
    "createdAt": "2025-01-15T10:30:00Z",
    "lastTriggered": "2025-01-15T14:22:00Z",
    "executionCount": 3
  }
}
```

## 🔄 **JSON Structure - Action manuelle (Close Position)**

```json
{
  "actionId": "660e8400-e29b-41d4-a716-446655440001",
  "userId": "user-alice",
  "strategyId": "550e8400-e29b-41d4-a716-446655440000",
  "type": "manual_close_position",
  "action": {
    "type": "close_position",
    "config": {
      "targetAsset": "USDC",
      "targetChain": "ETH-SEPOLIA",
      "percentage": 100,
      "priority": "immediate"
    }
  },
  "timestamp": "2025-01-15T16:45:00Z"
}
```

## 🏦 **Organisation des Wallets - 1 Strategy = 1 Wallet Set**

```json
{
  "user-alice": {
    "strategies": {
      "FED-Panic-Strategy": {
        "walletSetId": "768264dc-caf0-5e8f-8659-afe7272cae00",
        "walletSetName": "alice-fed-panic",
        "wallets": [
          {
            "id": "c1782722-3d55-5747-bb5c-35ad619f81e9",
            "address": "0xab7e886c2f8ab5c22354feac4edb4be50e54858f",
            "blockchain": "ETH-SEPOLIA"
          },
          {
            "id": "a9db3a56-14bd-595e-b00d-072821caa665", 
            "address": "0xab7e886c2f8ab5c22354feac4edb4be50e54858f",
            "blockchain": "AVAX-FUJI"
          }
        ]
      },
      "Meme-Coins-Strategy": {
        "walletSetId": "999264dc-caf0-5e8f-8659-afe7272cae11", 
        "walletSetName": "alice-meme-coins",
        "wallets": [...]
      }
    }
  }
}
```

## 🔧 **Service Wallet - Création automatique**

```typescript
// services/strategy-wallet.ts
export interface CreateStrategyWalletParams {
  userId: string;
  strategyId: string;
  strategyName: string;
  supportedChains: Blockchain[];
}

export const createStrategyWallet = async (params: CreateStrategyWalletParams) => {
  // 1. Générer nom unique du wallet set
  const walletSetName = `${params.userId}-${params.strategyName}`.toLowerCase()
    .replace(/[^a-z0-9-]/g, '-');
  
  // 2. Créer le wallet set Circle
  const walletSet = await createWalletSet(walletSetName);
  
  // 3. Créer wallets pour toutes les chaînes supportées
  const wallets = await createWallet(walletSet.id, params.supportedChains);
  
  // 4. Sauvegarder en base
  await saveStrategyWallets({
    strategyId: params.strategyId,
    walletSetId: walletSet.id,
    wallets: wallets
  });
  
  return {
    walletSetId: walletSet.id,
    wallets: wallets
  };
};
```

## 📱 **Frontend - Flux utilisateur**

### 1. **Connexion Wallet** (`/`)
```typescript
// L'utilisateur connecte son EOA wallet (MetaMask, etc.)
// Ce wallet sert uniquement d'authentification
const { address, signMessage } = useAccount();
```

### 2. **Création Stratégie** (`/strategies/create`)
```typescript
const createStrategy = action(
  z.object({
    strategyName: z.string(),
    triggers: z.array(triggerSchema),
    actions: z.array(actionSchema),
    supportedChains: z.array(z.enum(SUPPORTED_CHAINS))
  }),
  async (input) => {
    // 1. Créer strategy en DB
    const strategy = await createStrategyInDB(input);
    
    // 2. Créer wallet set dédié automatiquement
    const walletSet = await createStrategyWallet({
      userId: session.userId,
      strategyId: strategy.id,
      strategyName: input.strategyName,
      supportedChains: input.supportedChains
    });
    
    return { success: true, strategyId: strategy.id };
  }
);
```

### 3. **Gestion Positions** (`/strategies/[id]`)
- Voir les positions actuelles du wallet set
- Historique des exécutions
- Modifier/Pause la stratégie

### 4. **Fermeture Position** (`/close-position`)
- Convertir tout en USDC
- Bridge vers chaîne de choix
- Action manuelle indépendante des triggers

## 🔐 **Sécurité & Recovery**

```typescript
// Backup automatique des recovery files
export const backupRecoveryFiles = async (strategyId: string) => {
  const recoveryFile = await getRecoveryFile(strategyId);
  
  // Option 1: Stockage Supabase (chiffré)
  await supabase.storage
    .from('recovery-files')
    .upload(`${strategyId}/recovery.dat.enc`, encryptedFile);
    
  // Option 2: IPFS décentralisé
  await pinFileToIPFS(recoveryFile, `strategy-${strategyId}-recovery`);
};
```

## 🎛️ **Variables d'environnement requises**

```env
# Circle API
CIRCLE_API_KEY=your_api_key
CIRCLE_ENTITY_SECRET=your_entity_secret

# Database
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_key

# External APIs
TWITTER_BEARER_TOKEN=your_twitter_token
DISCORD_WEBHOOK_URL=your_discord_webhook

# Security
ENCRYPTION_KEY=your_encryption_key_for_recovery_files
```

---

**💡 Avantages de cette architecture :**
- ✅ Isolation des fonds par stratégie
- ✅ Pas de conflit entre stratégies
- ✅ Recovery granulaire par stratégie
- ✅ Scaling horizontal facile
- ✅ Sécurité renforcée 