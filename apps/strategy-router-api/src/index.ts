import express from 'express';
import cors from 'cors';
import axios from 'axios';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { Strategy, TweetEvent, Job, JobResponse, ApiStatus } from './types.js';
import { 
  createStrategyWithWallet, 
  getUserStrategies, 
  getActiveStrategies,
  getStrategyWallet 
} from './wallet-manager';
import { getSupportedChains, getSmartAccountInfo, createSmartAccount } from './smart-account-manager';

dotenv.config();

/**
 * =====================================
 * STRATEGY ROUTER API - TRIGGVEST
 * =====================================
 * 
 * Cette API est le cœur de TriggVest. Elle :
 * - Gère les stratégies des utilisateurs
 * - Traite les événements reçus (tweets, etc.)
 * - Détermine quelles stratégies déclencher
 * - Envoie les jobs au Circle Executor
 * - Gère les wallets et Smart Accounts
 * 
 * Port par défaut : 3002
 * 
 * Flux principal :
 * 1. Trigger API → Strategy Router (événements)
 * 2. Strategy Router → Circle Executor (jobs)
 * 3. Circle Executor → Blockchain (exécution)
 * 
 * =====================================
 */

// Configuration de l'application
const app = express();
const PORT = process.env.PORT || 3002;
const prisma = new PrismaClient();

// =====================================
// MIDDLEWARE
// =====================================

app.use(cors());
app.use(express.json());

// =====================================
// MOTEUR DE CORRESPONDANCE
// =====================================

/**
 * Vérifie si un événement correspond à un trigger
 * 
 * @param event - Événement reçu
 * @param trigger - Trigger de stratégie
 * @returns true si l'événement correspond au trigger
 */
function matchesTrigger(event: TweetEvent, trigger: any): boolean {
  // Vérifier le type d'événement
  if (event.type !== trigger.type) return false;
  
  if (trigger.type === 'twitter') {
    // Vérifier si le compte correspond
    if (trigger.account && event.account !== trigger.account) return false;
    
    // Vérifier si au moins un mot-clé est présent
    if (trigger.keywords && trigger.keywords.length > 0) {
      const content = event.content.toLowerCase();
      return trigger.keywords.some((keyword: string) => 
        content.includes(keyword.toLowerCase())
      );
    }
  }
  
  return true;
}

// =====================================
// GESTION DES DONNÉES
// =====================================

/**
 * Sauvegarde un événement en base de données
 * 
 * @param event - Événement à sauvegarder
 * @returns ID de l'événement sauvegardé
 */
async function saveEvent(event: TweetEvent): Promise<string> {
  try {
    const savedEvent = await prisma.event.create({
      data: {
        type: event.type,
        account: event.account,
        content: event.content,
        metadata: {
          timestamp: event.timestamp,
          id: event.id
        }
      }
    });
    
    console.log(`✅ [DB] Événement sauvegardé: ${savedEvent.id}`);
    return savedEvent.id;
  } catch (error) {
    console.error('❌ [DB] Erreur lors de la sauvegarde de l\'événement:', error);
    throw error;
  }
}

/**
 * Sauvegarde une exécution en base de données
 * 
 * @param strategy - Stratégie exécutée
 * @param eventId - ID de l'événement déclencheur
 * @param actionId - ID de l'action exécutée
 * @param jobResult - Résultat du job
 * @returns ID de l'exécution sauvegardée
 */
async function saveExecution(
  strategy: any, 
  eventId: string, 
  actionId: string,
  jobResult: JobResponse | null
): Promise<string> {
  try {
    const execution = await prisma.execution.create({
      data: {
        userId: strategy.userId,
        strategyId: strategy.id,
        eventId: eventId,
        actionId: actionId,
        status: jobResult ? 'completed' : 'failed',
        txHash: jobResult?.txHash || null,
        errorMessage: jobResult ? null : 'Failed to execute job'
      }
    });
    
    console.log(`✅ [DB] Exécution sauvegardée: ${execution.id}`);
    return execution.id;
  } catch (error) {
    console.error('❌ [DB] Erreur lors de la sauvegarde de l\'exécution:', error);
    throw error;
  }
}

// =====================================
// COMMUNICATION AVEC CIRCLE EXECUTOR
// =====================================

/**
 * Envoie un job au Circle Executor API
 * 
 * @param strategy - Stratégie à exécuter
 * @param event - Événement déclencheur
 * @returns Résultat du job ou null si échec
 */
async function sendJobToCircleExecutor(strategy: any, event: TweetEvent): Promise<JobResponse | null> {
  console.log(`📤 [CIRCLE] Envoi du job pour la stratégie ${strategy.strategyName}`);
  
  // Récupérer la clé privée de la stratégie
  const strategyWallet = await getStrategyWallet(strategy.id);
  const privateKey = strategyWallet.wallet?.privateKey.replace('0x', '');
  
  const job: Job = {
    strategyId: strategy.id,
    userId: strategy.userId,
    strategyName: strategy.strategyName,
    triggeredBy: event,
    actions: strategy.actions,
    timestamp: new Date().toISOString(),
    strategyPrivateKey: privateKey
  };
  
  try {
    // Format attendu par Circle Executor API pour bridge_gasless
    const circleJob = {
      type: 'bridge_gasless',
      smartAccount: strategy.smartAccountAddress || strategy.generatedAddress,
      fromChain: 'arbitrum', // Source: Arbitrum Sepolia
      toChain: 'base',       // Destination: Base Sepolia
      amount: strategy.actions[0]?.parameters?.amount || '1', // Montant depuis les paramètres
      token: 'USDC'
    };

    console.log('📤 [CIRCLE] Sending bridge job:', circleJob);
    
    const response = await axios.post('http://localhost:3003/process-job', circleJob);
    console.log(`✅ [CIRCLE] Bridge job envoyé avec succès`);
    
    // Transformer la réponse au format JobResponse attendu
    return {
      jobId: `bridge_${Date.now()}`,
      status: response.data.success ? 'completed' : 'failed',
      result: response.data.result,
      timestamp: new Date().toISOString(),
      txHash: response.data.result?.mintTxHash || null
    };
  } catch (error) {
    console.error('❌ [CIRCLE] Erreur lors de l\'envoi du bridge job:', error instanceof Error ? error.message : 'Unknown error');
    return null;
  }
}

// =====================================
// MOTEUR DE TRAITEMENT D'ÉVÉNEMENTS
// =====================================

/**
 * Traite un événement reçu et déclenche les stratégies correspondantes
 * 
 * Ce processus comprend :
 * 1. Sauvegarde de l'événement
 * 2. Récupération des stratégies actives
 * 3. Vérification des correspondances
 * 4. Envoi des jobs au Circle Executor
 * 5. Sauvegarde des exécutions
 * 
 * @param event - Événement à traiter
 * @returns Résultat du traitement
 */
async function processEvent(event: TweetEvent): Promise<{ 
  matches: any[]; 
  jobResults: (JobResponse | null)[]; 
  userDetails: any[] 
}> {
  console.log(`🔄 [EVENT] Traitement de l'événement: ${event.type}`);
  console.log(`📍 [EVENT] Compte: ${event.account}`);
  console.log(`📝 [EVENT] Contenu: ${event.content}`);
  
  // Sauvegarder l'événement en base de données
  const eventId = await saveEvent(event);
  
  // Récupérer les stratégies actives depuis la base de données
  const strategies = await getActiveStrategies();
  console.log(`📊 [EVENT] ${strategies.length} stratégies actives récupérées`);
  
  const matchedStrategies: any[] = [];
  const jobResults: (JobResponse | null)[] = [];
  const userDetails: any[] = [];
  
  // Vérifier chaque stratégie
  for (const strategy of strategies) {
    console.log(`🔍 [EVENT] Vérification de la stratégie: ${strategy.strategyName}`);
    
    for (const trigger of strategy.triggers) {
      if (matchesTrigger(event, trigger)) {
        matchedStrategies.push(strategy);
        
        console.log(`✅ [EVENT] MATCH trouvé: ${strategy.strategyName}`);
        console.log(`👤 [EVENT] Utilisateur: ${strategy.userId}`);
        console.log(`🔐 [EVENT] Wallet généré: ${strategy.generatedAddress}`);
        
        // Récupérer les détails de l'utilisateur
        const userInfo = await prisma.user.findUnique({
          where: { id: strategy.userId },
          select: {
            id: true,
            walletAddress: true,
            username: true,
            email: true
          }
        });
        
        if (userInfo) {
          userDetails.push({
            userId: userInfo.id,
            walletAddress: userInfo.walletAddress,
            username: userInfo.username,
            email: userInfo.email,
            strategyId: strategy.id,
            strategyName: strategy.strategyName,
            generatedWallet: strategy.generatedAddress
          });
        }
        
        // Envoyer le job à Circle Executor
        const jobResult = await sendJobToCircleExecutor(strategy, event);
        jobResults.push(jobResult);
        
        // Sauvegarder l'exécution en base de données
        const firstAction = strategy.actions[0];
        if (firstAction) {
          // Récupérer l'ID de l'action depuis la base de données
          const actionInDb = await prisma.action.findFirst({
            where: {
              strategyId: strategy.id,
              type: firstAction.type,
              targetAsset: firstAction.targetAsset,
              targetChain: firstAction.targetChain
            }
          });
          
          if (actionInDb) {
            await saveExecution(strategy, eventId, actionInDb.id, jobResult);
          }
        }
        
        break; // Une seule fois par stratégie
      }
    }
  }
  
  if (matchedStrategies.length === 0) {
    console.log('❌ [EVENT] Aucun match trouvé pour cet événement');
  } else {
    console.log(`🎉 [EVENT] ${matchedStrategies.length} stratégie(s) déclenchée(s)`);
  }
  
  return { matches: matchedStrategies, jobResults, userDetails };
}

// =====================================
// ROUTES API REST
// =====================================

/**
 * POST /api/create-strategy
 * 
 * Crée une nouvelle stratégie avec wallet intégré et Smart Account optionnel
 * 
 * @route POST /api/create-strategy
 * @param {string} req.body.userWalletAddress - Adresse wallet de l'utilisateur
 * @param {string} req.body.strategyName - Nom de la stratégie
 * @param {Array} req.body.triggers - Liste des triggers (max 2)
 * @param {Array} req.body.actions - Liste des actions
 * @param {string} [req.body.smartAccountChain] - Chaîne pour créer le Smart Account (optionnel)
 * 
 * @returns {Object} Stratégie créée avec détails
 * 
 * @example
 * POST /api/create-strategy
 * {
 *   "userWalletAddress": "0x1234...",
 *   "strategyName": "Bridge sur tweet Elon",
 *   "triggers": [
 *     {
 *       "type": "twitter",
 *       "account": "@elonmusk",
 *       "keywords": ["bitcoin", "moon"]
 *     }
 *   ],
 *   "actions": [
 *     {
 *       "type": "bridge_gasless",
 *       "targetAsset": "USDC",
 *       "targetChain": "Base"
 *     }
 *   ],
 *   "smartAccountChain": "base-sepolia"
 * }
 */
app.post('/api/create-strategy', async (req: express.Request, res: express.Response) => {
  try {
    const { 
      userWalletAddress, 
      strategyName, 
      triggers,
      actions,
      smartAccountChain // Optionnel: chaîne pour créer le smart account
    } = req.body;
    
    console.log(`📝 [STRATEGY] Création de stratégie: ${strategyName}`);
    console.log(`👤 [STRATEGY] Utilisateur: ${userWalletAddress}`);
    console.log(`🎯 [STRATEGY] ${triggers?.length || 0} trigger(s), ${actions?.length || 0} action(s)`);
    
    // Validation des champs requis
    if (!userWalletAddress || !strategyName || !triggers || !actions) {
      console.error('❌ [STRATEGY] Champs requis manquants');
      return res.status(400).json({
        success: false,
        error: 'Champs requis manquants',
        message: 'userWalletAddress, strategyName, triggers, actions sont requis'
      });
    }

    // Validation : max 2 triggers
    if (triggers.length > 2) {
      console.error('❌ [STRATEGY] Trop de triggers');
      return res.status(400).json({
        success: false,
        error: 'Limite de triggers dépassée',
        message: 'Maximum 2 triggers autorisés par stratégie'
      });
    }
    
    if (smartAccountChain) {
      console.log(`🔐 [STRATEGY] Smart Account sera créé sur: ${smartAccountChain}`);
    }
    
    const result = await createStrategyWithWallet({
      userWalletAddress,
      strategyName,
      triggers,
      actions,
      smartAccountChain
    });
    
    if (!result.success) {
      console.error(`❌ [STRATEGY] Échec de création: ${result.message}`);
      return res.status(500).json({
        success: false,
        error: 'Échec de création de stratégie',
        message: result.message
      });
    }
    
    console.log(`✅ [STRATEGY] Stratégie créée avec succès: ${result.strategy?.id}`);
    console.log(`🔐 [STRATEGY] Wallet généré: ${result.strategy?.generatedAddress}`);
    if (result.strategy?.smartAccount) {
      console.log(`🔐 [STRATEGY] Smart Account créé: ${result.strategy.smartAccount.address}`);
    }
    
    res.json({
      success: true,
      strategy: result.strategy,
      message: result.message
    });
    
  } catch (error) {
    console.error('❌ [STRATEGY] Erreur lors de la création:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la création de la stratégie',
      message: error instanceof Error ? error.message : 'Erreur inconnue'
    });
  }
});

/**
 * POST /api/smart-account
 * 
 * Crée un Smart Account pour une stratégie existante
 * 
 * @route POST /api/smart-account
 * @param {string} req.body.strategyId - ID de la stratégie
 * @param {string} req.body.chain - Chaîne blockchain (arbitrum, base, etc.)
 * 
 * @returns {Object} Smart Account créé
 * 
 * @example
 * POST /api/smart-account
 * {
 *   "strategyId": "cmcr4rpa50002tw6x1f4rpdew",
 *   "chain": "arbitrum"
 * }
 */
app.post('/api/smart-account', async (req: express.Request, res: express.Response) => {
  try {
    const { strategyId, chain } = req.body;
    
    console.log(`🔄 [SMART_ACCOUNT] Création pour la stratégie: ${strategyId} sur ${chain}`);
    
    // Validation des champs requis
    if (!strategyId || !chain) {
      console.error('❌ [SMART_ACCOUNT] Champs requis manquants');
      return res.status(400).json({
        success: false,
        error: 'Champs requis manquants',
        message: 'strategyId, chain sont requis'
      });
    }

    // Vérifier que la stratégie existe
    const strategy = await prisma.strategy.findUnique({
      where: { id: strategyId }
    });

    if (!strategy) {
      console.error(`❌ [SMART_ACCOUNT] Stratégie ${strategyId} non trouvée`);
      return res.status(404).json({
        success: false,
        error: 'Stratégie non trouvée',
        message: `Aucune stratégie avec l'ID "${strategyId}" n'a été trouvée`
      });
    }

    // 🎯 DEMO MODE: Utiliser le Smart Account prédéfini
    const DEMO_SMART_ACCOUNT = {
      address: '0x30FaA798B5d332A733150bCA1556D7BeDA2CeB87',
      owner: '0x9c8C8a7a5F4F1e0aE8c9d5b3f2E1A7b6c3d4e5f6',
      chain: chain,
      factory: '0x0000000000000000000000000000000000000000',
      created: new Date(),
      balance: '5000000' // 5 USDC (6 decimals)
    };

    console.log(`🎯 [DEMO] Utilisation du Smart Account prédéfini: ${DEMO_SMART_ACCOUNT.address}`);

    // Vérifier si un Smart Account existe déjà
    if (strategy.smartAccountAddress) {
      console.log(`✅ [SMART_ACCOUNT] Smart Account existe déjà: ${strategy.smartAccountAddress}`);
      return res.json({
        success: true,
        message: 'Smart Account existe déjà',
        smartAccount: {
          address: strategy.smartAccountAddress,
          owner: strategy.smartAccountOwner,
          chain: strategy.smartAccountChain,
          factory: strategy.smartAccountFactory,
          created: strategy.smartAccountCreated,
          balance: strategy.smartAccountBalance.toString()
        }
      });
    }

    // Pour la démonstration, utiliser directement le Smart Account prédéfini
    await prisma.strategy.update({
      where: { id: strategyId },
      data: {
        smartAccountAddress: DEMO_SMART_ACCOUNT.address,
        smartAccountOwner: DEMO_SMART_ACCOUNT.owner,
        smartAccountChain: DEMO_SMART_ACCOUNT.chain,
        smartAccountFactory: DEMO_SMART_ACCOUNT.factory,
        smartAccountCreated: true,
        smartAccountBalance: parseFloat(DEMO_SMART_ACCOUNT.balance)
      }
    });

    console.log(`✅ [DEMO] Smart Account prédéfini assigné à la stratégie: ${strategyId}`);

    return res.json({
      success: true,
      message: 'Smart Account prédéfini assigné avec succès',
      smartAccount: DEMO_SMART_ACCOUNT
    });

    // Récupérer la clé privée de la stratégie (déchiffrée)
    const strategyWallet = await getStrategyWallet(strategyId);
    
    if (!strategyWallet.wallet) {
      console.error(`❌ [SMART_ACCOUNT] Impossible de récupérer le wallet de la stratégie ${strategyId}`);
      return res.status(500).json({
        success: false,
        error: 'Erreur wallet',
        message: 'Impossible de récupérer le wallet de la stratégie'
      });
    }

    // Créer le Smart Account avec la clé privée déchiffrée
    const smartAccountResult = await createSmartAccount({
      chain,
      ownerPrivateKey: strategyWallet.wallet.privateKey,
      strategyId
    });

    if (!smartAccountResult.success) {
      console.error(`❌ [SMART_ACCOUNT] Erreur création: ${smartAccountResult.message}`);
      return res.status(500).json({
        success: false,
        error: 'Erreur lors de la création du Smart Account',
        message: smartAccountResult.message
      });
    }

    console.log(`✅ [SMART_ACCOUNT] Smart Account créé: ${smartAccountResult.smartAccount?.address}`);

    res.json({
      success: true,
      message: 'Smart Account créé avec succès',
      smartAccount: smartAccountResult.smartAccount
    });

  } catch (error) {
    console.error('❌ [SMART_ACCOUNT] Erreur lors de la création:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la création du Smart Account',
      message: error instanceof Error ? error.message : 'Erreur inconnue'
    });
  }
});

/**
 * GET /api/user-strategies/:walletAddress
 * 
 * Récupère toutes les stratégies d'un utilisateur
 * 
 * @route GET /api/user-strategies/:walletAddress
 * @param {string} params.walletAddress - Adresse wallet de l'utilisateur
 * 
 * @returns {Object} Liste des stratégies de l'utilisateur
 * 
 * @example
 * GET /api/user-strategies/0x1234...
 */
app.get('/api/user-strategies/:walletAddress', async (req: express.Request, res: express.Response) => {
  try {
    const { walletAddress } = req.params;
    
    console.log(`🔍 [USER_STRATEGIES] Récupération pour: ${walletAddress}`);
    
    const strategies = await getUserStrategies(walletAddress);
    
    console.log(`📊 [USER_STRATEGIES] ${strategies.length} stratégie(s) trouvée(s)`);
    
    res.json({
      success: true,
      walletAddress,
      strategies,
      total: strategies.length
    });
    
  } catch (error) {
    console.error('❌ [USER_STRATEGIES] Erreur lors de la récupération:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération des stratégies',
      message: error instanceof Error ? error.message : 'Erreur inconnue'
    });
  }
});

/**
 * POST /api/process-event
 * 
 * Traite un événement reçu du Trigger CLI
 * 
 * @route POST /api/process-event
 * @param {TweetEvent} req.body - Événement à traiter
 * @param {string} req.body.type - Type d'événement (ex: 'twitter')
 * @param {string} req.body.account - Compte source (ex: '@elonmusk')
 * @param {string} req.body.content - Contenu de l'événement
 * 
 * @returns {Object} Résultat du traitement avec stratégies déclenchées
 * 
 * @example
 * POST /api/process-event
 * {
 *   "type": "twitter",
 *   "account": "@elonmusk",
 *   "content": "Bitcoin to the moon!",
 *   "timestamp": "2025-01-05T10:00:00Z",
 *   "id": "tweet_123"
 * }
 */
app.post('/api/process-event', async (req: express.Request<{}, any, TweetEvent>, res: express.Response) => {
  try {
    const event = req.body;
    
    console.log(`📨 [PROCESS_EVENT] Événement reçu du CLI`);
    console.log(`📍 [PROCESS_EVENT] ${event.account}: "${event.content}"`);
    
    // Validation basique
    if (!event.type || !event.account || !event.content) {
      console.error('❌ [PROCESS_EVENT] Champs requis manquants');
      return res.status(400).json({
        success: false,
        error: 'Champs requis manquants',
        message: 'type, account, content sont requis'
      });
    }
    
    // Traiter l'événement
    const result = await processEvent(event);
    
    console.log(`🎯 [PROCESS_EVENT] ${result.matches.length} stratégie(s) déclenchée(s)`);
    console.log(`📊 [PROCESS_EVENT] ${result.jobResults.filter(r => r !== null).length} job(s) envoyé(s)`);
    
    // Réponse détaillée avec informations utilisateur
    res.json({
      success: true,
      event,
      matchedStrategies: result.matches.length,
      strategies: result.matches.map(s => ({
        id: s.id,
        name: s.strategyName,
        userId: s.userId,
        generatedWallet: s.generatedAddress
      })),
      users: result.userDetails,
      jobResults: result.jobResults.filter(r => r !== null),
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ [PROCESS_EVENT] Erreur lors du traitement:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors du traitement de l\'événement',
      message: error instanceof Error ? error.message : 'Erreur inconnue'
    });
  }
});

/**
 * GET /api/supported-chains
 * 
 * Récupère la liste des chaînes supportées pour les Smart Accounts
 * 
 * @route GET /api/supported-chains
 * @returns {Object} Liste des chaînes supportées
 * 
 * @example
 * GET /api/supported-chains
 * {
 *   "success": true,
 *   "supportedChains": ["eth-sepolia", "base-sepolia", "arb-sepolia"],
 *   "total": 3
 * }
 */
app.get('/api/supported-chains', async (req: express.Request, res: express.Response) => {
  try {
    console.log(`🔍 [SUPPORTED_CHAINS] Récupération des chaînes supportées`);
    
    const supportedChains = getSupportedChains();
    
    console.log(`📊 [SUPPORTED_CHAINS] ${supportedChains.length} chaîne(s) supportée(s)`);
    
    res.json({
      success: true,
      supportedChains,
      total: supportedChains.length
    });
    
  } catch (error) {
    console.error('❌ [SUPPORTED_CHAINS] Erreur lors de la récupération:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération des chaînes supportées',
      message: error instanceof Error ? error.message : 'Erreur inconnue'
    });
  }
});

/**
 * GET /api/smart-account/:strategyId
 * 
 * Récupère les informations d'un Smart Account pour une stratégie
 * 
 * @route GET /api/smart-account/:strategyId
 * @param {string} params.strategyId - ID de la stratégie
 * 
 * @returns {Object} Informations du Smart Account
 * 
 * @example
 * GET /api/smart-account/strategy_123
 */
app.get('/api/smart-account/:strategyId', async (req: express.Request, res: express.Response) => {
  try {
    const { strategyId } = req.params;
    
    console.log(`🔍 [SMART_ACCOUNT] Récupération pour la stratégie: ${strategyId}`);
    
    const smartAccountInfo = await getSmartAccountInfo(strategyId);
    
    if (!smartAccountInfo) {
      console.error('❌ [SMART_ACCOUNT] Smart Account non trouvé');
      return res.status(404).json({
        success: false,
        error: 'Smart Account non trouvé',
        message: 'Smart Account non trouvé ou non créé pour cette stratégie'
      });
    }
    
    console.log(`✅ [SMART_ACCOUNT] Smart Account trouvé: ${smartAccountInfo.address}`);
    
    res.json({
      success: true,
      smartAccount: smartAccountInfo
    });
    
  } catch (error) {
    console.error('❌ [SMART_ACCOUNT] Erreur lors de la récupération:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération du Smart Account',
      message: error instanceof Error ? error.message : 'Erreur inconnue'
    });
  }
});

/**
 * GET /api/strategies
 * 
 * Récupère toutes les stratégies actives
 * 
 * @route GET /api/strategies
 * @returns {Object} Liste de toutes les stratégies actives
 * 
 * @example
 * GET /api/strategies
 */
app.get('/api/strategies', async (req: express.Request, res: express.Response) => {
  try {
    console.log(`🔍 [STRATEGIES] Récupération de toutes les stratégies actives`);
    
    const strategies = await getActiveStrategies();
    
    console.log(`📊 [STRATEGIES] ${strategies.length} stratégie(s) active(s)`);
    
    res.json({
      success: true,
      strategies,
      total: strategies.length
    });
  } catch (error) {
    console.error('❌ [STRATEGIES] Erreur lors de la récupération:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération des stratégies',
      message: error instanceof Error ? error.message : 'Erreur inconnue'
    });
  }
});

/**
 * GET /api/strategy/:id
 * 
 * Récupère une stratégie spécifique par son ID
 * 
 * @route GET /api/strategy/:id
 * @param {string} id - ID de la stratégie
 * @returns {Object} Stratégie trouvée
 * 
 * @example
 * GET /api/strategy/cmcr28ruz0002xumjlctuylsw
 */
app.get('/api/strategy/:id', async (req: express.Request, res: express.Response) => {
  try {
    const { id } = req.params;
    console.log(`🔍 [STRATEGY] Récupération de la stratégie: ${id}`);
    
    const strategy = await prisma.strategy.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            walletAddress: true,
            createdAt: true
          }
        },
        triggers: true,
        actions: true,
        executions: {
          take: 10,
          orderBy: { createdAt: 'desc' }
        }
      }
    });
    
    if (!strategy) {
      console.log(`❌ [STRATEGY] Stratégie ${id} non trouvée`);
      return res.status(404).json({
        success: false,
        error: 'Stratégie non trouvée',
        message: `Aucune stratégie avec l'ID "${id}" n'a été trouvée`
      });
    }
    
    console.log(`✅ [STRATEGY] Stratégie trouvée: ${strategy.strategyName}`);
    
    res.json({
      success: true,
      strategy: {
        id: strategy.id,
        name: strategy.strategyName,
        description: strategy.strategyName, // Utiliser le nom comme description temporaire
        status: strategy.isActive ? 'active' : 'inactive',
        userWalletAddress: strategy.user.walletAddress,
        generatedAddress: strategy.generatedAddress,
        triggers: strategy.triggers,
        actions: strategy.actions.map(action => ({
          ...action,
          amount: action.parameters && typeof action.parameters === 'object' && 
                  'amount' in action.parameters ? 
                  String(action.parameters.amount) : 
                  '0'
        })),
        executions: strategy.executions,
        createdAt: strategy.createdAt,
        updatedAt: strategy.updatedAt
      }
    });
  } catch (error) {
    console.error('❌ [STRATEGY] Erreur lors de la récupération:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération de la stratégie',
      message: error instanceof Error ? error.message : 'Erreur inconnue'
    });
  }
});

/**
 * GET /api/status
 * 
 * Récupère le statut de l'API Strategy Router
 * 
 * @route GET /api/status
 * @returns {ApiStatus} Statut de l'API
 * 
 * @example
 * GET /api/status
 * {
 *   "status": "active",
 *   "connectedToTriggerApi": true,
 *   "strategiesCount": 5,
 *   "timestamp": "2025-01-05T10:00:00Z"
 * }
 */
app.get('/api/status', async (req: express.Request, res: express.Response<ApiStatus>) => {
  try {
    console.log(`🔍 [STATUS] Vérification du statut de l'API`);
    
    const strategiesCount = await prisma.strategy.count({
      where: { isActive: true }
    });
    
    console.log(`✅ [STATUS] API active avec ${strategiesCount} stratégie(s)`);
    
    res.json({
      status: 'active',
      connectedToTriggerApi: true,
      strategiesCount,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ [STATUS] Erreur lors de la vérification:', error);
    res.status(500).json({
      status: 'error',
      connectedToTriggerApi: false,
      strategiesCount: 0,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/dashboard-stats
 * 
 * Récupère les statistiques pour le dashboard
 * 
 * @route GET /api/dashboard-stats
 * @returns {Object} Statistiques du dashboard
 * 
 * @example
 * GET /api/dashboard-stats
 * {
 *   "success": true,
 *   "stats": {
 *     "totalStrategies": 12,
 *     "activeStrategies": 8,
 *     "totalExecutions": 45,
 *     "totalUsers": 3,
 *     "totalWallets": 12,
 *     "recentExecutions": 7
 *   }
 * }
 */
app.get('/api/dashboard-stats', async (req: express.Request, res: express.Response) => {
  try {
    console.log(`🔍 [DASHBOARD_STATS] Récupération des statistiques`);
    
    // Récupération des statistiques depuis la base de données
    const totalStrategies = await prisma.strategy.count();
    const activeStrategies = await prisma.strategy.count({
      where: { isActive: true }
    });
    const totalExecutions = await prisma.execution.count();
    const totalUsers = await prisma.user.count();
    const totalWallets = await prisma.strategy.count({
      where: { generatedAddress: { not: "" } }
    });
    
    // Exécutions récentes (dernières 24h)
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);
    const recentExecutions = await prisma.execution.count({
      where: {
        createdAt: {
          gte: oneDayAgo
        }
      }
    });
    
    const stats = {
      totalStrategies,
      activeStrategies,
      totalExecutions,
      totalUsers,
      totalWallets,
      recentExecutions
    };
    
    console.log(`✅ [DASHBOARD_STATS] Statistiques récupérées:`, stats);
    
    res.json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('❌ [DASHBOARD_STATS] Erreur lors de la récupération:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération des statistiques',
      message: error instanceof Error ? error.message : 'Erreur inconnue'
    });
  }
});

/**
 * DELETE /api/strategy/:id
 * 
 * Supprime une stratégie spécifique
 * 
 * @route DELETE /api/strategy/:id
 * @param {string} id - ID de la stratégie à supprimer
 * @returns {Object} Résultat de la suppression
 * 
 * @example
 * DELETE /api/strategy/cmcr14t270008icthcbqz59d5
 * {
 *   "success": true,
 *   "message": "Stratégie supprimée avec succès",
 *   "strategyId": "cmcr14t270008icthcbqz59d5"
 * }
 */
app.delete('/api/strategy/:id', async (req: express.Request, res: express.Response) => {
  try {
    const { id } = req.params;
    console.log(`🗑️ [DELETE_STRATEGY] Suppression de la stratégie: ${id}`);
    
    // Vérifier si la stratégie existe
    const existingStrategy = await prisma.strategy.findUnique({
      where: { id }
    });
    
    if (!existingStrategy) {
      console.log(`❌ [DELETE_STRATEGY] Stratégie ${id} non trouvée`);
      return res.status(404).json({
        success: false,
        error: 'Stratégie non trouvée',
        message: `Aucune stratégie avec l'ID "${id}" n'a été trouvée`
      });
    }
    
    // Supprimer les exécutions associées
    await prisma.execution.deleteMany({
      where: { strategyId: id }
    });
    console.log(`✅ [DELETE_STRATEGY] Exécutions supprimées pour la stratégie ${id}`);
    
    // Supprimer la stratégie
    await prisma.strategy.delete({
      where: { id }
    });
    
    console.log(`✅ [DELETE_STRATEGY] Stratégie ${existingStrategy.strategyName} supprimée avec succès`);
    
    res.json({
      success: true,
      message: 'Stratégie supprimée avec succès',
      strategyId: id
    });
  } catch (error) {
    console.error('❌ [DELETE_STRATEGY] Erreur lors de la suppression:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la suppression de la stratégie',
      message: error instanceof Error ? error.message : 'Erreur inconnue'
    });
  }
});

/**
 * PATCH /api/strategy/:id
 * 
 * Modifie une stratégie existante
 * 
 * @route PATCH /api/strategy/:id
 * @param {string} id - ID de la stratégie à modifier
 * @param {Object} body - Données à modifier
 * @returns {Object} Stratégie modifiée
 * 
 * @example
 * PATCH /api/strategy/cmcr14t270008icthcbqz59d5
 * {
 *   "name": "Nouveau nom",
 *   "description": "Nouvelle description"
 * }
 */
app.patch('/api/strategy/:id', async (req: express.Request, res: express.Response) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;
    
    console.log(`✏️ [PATCH_STRATEGY] Modification de la stratégie: ${id}`);
    
    // Vérifier si la stratégie existe
    const existingStrategy = await prisma.strategy.findUnique({
      where: { id }
    });
    
    if (!existingStrategy) {
      console.log(`❌ [PATCH_STRATEGY] Stratégie ${id} non trouvée`);
      return res.status(404).json({
        success: false,
        error: 'Stratégie non trouvée',
        message: `Aucune stratégie avec l'ID "${id}" n'a été trouvée`
      });
    }
    
    // Préparer les données à modifier
    const updateData: any = {};
    if (name !== undefined) updateData.strategyName = name;
    // Note: il n'y a pas de champ description dans le schéma Prisma
    
    // Mettre à jour la stratégie
    const updatedStrategy = await prisma.strategy.update({
      where: { id },
      data: updateData,
      include: {
        user: true,
        triggers: true,
        actions: true,
        executions: true
      }
    });
    
    console.log(`✅ [PATCH_STRATEGY] Stratégie ${updatedStrategy.strategyName} modifiée avec succès`);
    
    res.json({
      success: true,
      message: 'Stratégie modifiée avec succès',
      strategy: {
        id: updatedStrategy.id,
        name: updatedStrategy.strategyName,
        description: updatedStrategy.strategyName, // Utiliser le nom comme description
        status: updatedStrategy.isActive ? 'active' : 'inactive',
        userWalletAddress: updatedStrategy.user.walletAddress,
        generatedAddress: updatedStrategy.generatedAddress,
        triggers: updatedStrategy.triggers,
        actions: updatedStrategy.actions,
        createdAt: updatedStrategy.createdAt,
        updatedAt: updatedStrategy.updatedAt
      }
    });
  } catch (error) {
    console.error('❌ [PATCH_STRATEGY] Erreur lors de la modification:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la modification de la stratégie',
      message: error instanceof Error ? error.message : 'Erreur inconnue'
    });
  }
});

// =====================================
// DÉMARRAGE DU SERVEUR
// =====================================

/**
 * Démarre le serveur Strategy Router API
 * 
 * Le serveur écoute sur le port configuré (par défaut 3002)
 * et affiche les informations de démarrage dans la console.
 */
app.listen(PORT, async () => {
  console.log(`🚀 Strategy Router API démarrée sur le port ${PORT}`);
  console.log(`🌐 API REST disponible sur http://localhost:${PORT}/api`);
  console.log(`📨 Prêt à recevoir des événements du CLI sur /api/process-event`);
  console.log(`📋 Routes disponibles:`);
  console.log(`   POST   /api/create-strategy        - Créer une nouvelle stratégie`);
  console.log(`   GET    /api/user-strategies/:addr  - Stratégies d'un utilisateur`);
  console.log(`   POST   /api/process-event          - Traiter un événement`);
  console.log(`   GET    /api/supported-chains       - Chaînes supportées`);
  console.log(`   GET    /api/smart-account/:id      - Info Smart Account`);
  console.log(`   GET    /api/strategies             - Toutes les stratégies`);
  console.log(`   GET    /api/strategy/:id           - Une stratégie spécifique`);
  console.log(`   PATCH  /api/strategy/:id           - Modifier une stratégie`);
  console.log(`   DELETE /api/strategy/:id           - Supprimer une stratégie`);
  console.log(`   GET    /api/dashboard-stats        - Statistiques du dashboard`);
  console.log(`   GET    /api/status                 - Statut de l'API`);
  console.log(`🎯 Fonctionnalités:`);
  console.log(`   ✅ Gestion des stratégies utilisateur`);
  console.log(`   ✅ Traitement des événements Twitter`);
  console.log(`   ✅ Wallets intégrés aux stratégies`);
  console.log(`   ✅ Smart Accounts optionnels`);
  console.log(`   ✅ Communication avec Circle Executor`);
  
  // Afficher le nombre de stratégies en base
  try {
    const strategiesCount = await prisma.strategy.count({ where: { isActive: true } });
    console.log(`📊 ${strategiesCount} stratégie(s) active(s) en base de données`);
  } catch (error) {
    console.error('❌ Erreur de connexion à la base de données:', error);
  }
  
  console.log(`💡 Prêt pour l'intégration avec TriggVest!`);
});

// Gérer la fermeture propre de Prisma
process.on('SIGINT', async () => {
  console.log('\n🔌 Fermeture de la connexion à la base de données...');
  await prisma.$disconnect();
  process.exit(0);
}); 