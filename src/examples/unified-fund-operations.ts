import 'dotenv/config';
import { smartUserFundTransfer, validateUserFundOperation } from '../services/userFunds';
import { getSavedWalletSets } from '../services/wallet';

/**
 * Exemple complet: Système unifié CCTP + Transfers directs
 * Montre tous les cas d'usage possibles
 */

async function unifiedFundOperationsExample() {
  try {
    console.log("🎯 === SYSTÈME UNIFIÉ DE GESTION DES FONDS ===\n");

    // Récupérer le wallet "newSet"
    const walletSets = getSavedWalletSets();
    const walletSet = walletSets.find(ws => ws.walletSetName === "newSet");
    
    if (!walletSet) {
      console.log('❌ Wallet set "newSet" non trouvé');
      return;
    }

    const ethWallet = walletSet.wallets.find(w => w.blockchain === "ETH-SEPOLIA");
    const maticWallet = walletSet.wallets.find(w => w.blockchain === "MATIC-AMOY");

    if (!ethWallet) {
      console.log("❌ Wallet ETH-SEPOLIA non trouvé");
      return;
    }

    console.log(`📱 Wallets disponibles:`);
    console.log(`   ETH-SEPOLIA: ${ethWallet.address}`);
    if (maticWallet) {
      console.log(`   MATIC-AMOY: ${maticWallet.address}`);
    }
    console.log("");

    // Adresses de test
    const userAddresses = {
      ethMetaMask: "0x742d35Cc6634C0532925a3b8D4061C4e8b84e8F1", // MetaMask sur Ethereum
      maticMetaMask: "0x8fa7B6C71e0Be95a3F5b6F2F5c1A8b2A5e9F8B3A" // MetaMask sur Polygon  
    };

    console.log("📋 === CAS D'USAGE DÉMONTRÉS ===\n");

    // CAS 1: Withdrawal (Transfer direct - même blockchain)
    console.log("🔸 CAS 1: WITHDRAWAL - Retrait vers wallet personnel");
    console.log("   L'utilisateur veut récupérer ses USDC sur la même blockchain");
    console.log(`   ${ethWallet.blockchain} → MetaMask ${ethWallet.blockchain}\n`);

    const withdrawalOperation = {
      type: "withdrawal" as const,
      fromWalletId: ethWallet.id,
      toAddress: userAddresses.ethMetaMask,
      amount: "50",
      sourceChain: "ETH-SEPOLIA"
    };

    const withdrawalValidation = await validateUserFundOperation(withdrawalOperation);
    console.log(`✅ Validation withdrawal:`);
    console.log(`   Méthode recommandée: ${withdrawalValidation.recommendedMethod}`);
    console.log(`   Temps estimé: ${withdrawalValidation.estimatedTime}`);
    console.log(`   Frais estimés: ${withdrawalValidation.estimatedFees}`);
    
    if (withdrawalValidation.valid) {
      console.log(`   ✅ Prêt pour withdrawal!\n`);
      
      // Exécuter le withdrawal (commenté pour demo)
      console.log("🚀 Exécution du withdrawal...");
      const withdrawalResult = await smartUserFundTransfer.withdraw(
        ethWallet.id,
        userAddresses.ethMetaMask,
        "10", // Petit montant pour test
        "ETH-SEPOLIA"
      );
      
      if (withdrawalResult.success) {
        console.log(`✅ Withdrawal réussi!`);
        console.log(`   Méthode: ${withdrawalResult.method}`);
        console.log(`   Transaction: ${withdrawalResult.transactionId}`);
        console.log(`   Temps: ${withdrawalResult.estimatedTime}\n`);
      } else {
        console.log(`❌ Withdrawal échoué: ${withdrawalResult.error}\n`);
      }
    } else {
      console.log(`❌ Validation échouée pour withdrawal\n`);
    }

    // CAS 2: Bridge cross-chain (CCTP)
    console.log("🔸 CAS 2: BRIDGE CROSS-CHAIN - Transfert vers autre blockchain");
    console.log("   L'utilisateur veut ses USDC sur une blockchain différente");
    console.log(`   ETH-SEPOLIA → MetaMask MATIC-AMOY\n`);

    const bridgeOperation = {
      type: "bridge" as const,
      fromWalletId: ethWallet.id,
      toAddress: userAddresses.maticMetaMask,
      amount: "100",
      sourceChain: "ETH-SEPOLIA",
      destinationChain: "MATIC-AMOY",
      transferType: "standard" as const
    };

    const bridgeValidation = await validateUserFundOperation(bridgeOperation);
    console.log(`✅ Validation bridge:`);
    console.log(`   Méthode recommandée: ${bridgeValidation.recommendedMethod}`);
    console.log(`   Temps estimé: ${bridgeValidation.estimatedTime}`);
    console.log(`   Frais estimés: ${bridgeValidation.estimatedFees}`);
    
    if (bridgeValidation.valid) {
      console.log(`   ✅ Prêt pour bridge!\n`);
      
      // Simulation bridge (commenté pour demo - long processus)
      console.log("🌉 Simulation bridge CCTP...");
      console.log("   (Bridge CCTP réel prendrait 13 minutes)");
      console.log("   ETH-SEPOLIA USDC → burn + attestation → mint MATIC-AMOY USDC\n");
    } else {
      console.log(`❌ Validation échouée pour bridge\n`);
    }

    // CAS 3: Auto-détection intelligente
    console.log("🔸 CAS 3: AUTO-DÉTECTION - Le système choisit automatiquement");
    console.log("   Selon les paramètres, le système utilise la meilleure méthode\n");

    // Même blockchain = Transfer direct automatique
    console.log("   Exemple A: Même blockchain (auto-détecte transfer direct)");
    const autoSame = await smartUserFundTransfer.auto(
      ethWallet.id,
      userAddresses.ethMetaMask,
      "25",
      "ETH-SEPOLIA"
      // Pas de destinationChain = même blockchain
    );
    console.log(`   Résultat: ${autoSame.method} (${autoSame.success ? 'succès' : 'échec'})`);

    // Cross-chain = CCTP automatique  
    console.log("   Exemple B: Cross-chain (auto-détecte CCTP)");
    console.log("   (Simulation seulement - CCTP réel serait long)\n");

    // CAS 4: Interface utilisateur recommandée
    console.log("🔸 CAS 4: INTERFACE UTILISATEUR RECOMMANDÉE");
    console.log("   Comment présenter les options à l'utilisateur:\n");

    const userChoices = [
      {
        label: "💸 Retirer vers mon wallet",
        description: "Récupérer mes USDC dans mon MetaMask (même blockchain)",
        method: "direct_transfer",
        time: "2-5 minutes",
        cost: "~1-5 USD gas"
      },
      {
        label: "🌉 Transférer vers autre blockchain", 
        description: "Envoyer mes USDC sur Polygon, Arbitrum, etc.",
        method: "cctp",
        time: "13 minutes (ou 22s fast)",
        cost: "Gratuit (ou 0.01 USDC fast)"
      }
    ];

    userChoices.forEach((choice, i) => {
      console.log(`   ${i+1}. ${choice.label}`);
      console.log(`      ${choice.description}`);
      console.log(`      ⚡ ${choice.time} | 💳 ${choice.cost}`);
      console.log("");
    });

    // CAS 5: Workflow complet d'une app
    console.log("🔸 CAS 5: WORKFLOW COMPLET RECOMMANDÉ");
    console.log("   Étapes pour intégrer dans votre frontend:\n");

    const workflowSteps = [
      "1. 👤 Utilisateur demande retrait/bridge",
      "2. 🎯 Interface présente les 2 options (withdrawal vs bridge)", 
      "3. 🔍 Validation automatique (solde, adresse, etc.)",
      "4. 💰 Estimation frais et temps",
      "5. ✅ Confirmation utilisateur",
      "6. 🚀 Exécution via smartUserFundTransfer",
      "7. 📱 Suivi transaction + notifications"
    ];

    workflowSteps.forEach(step => {
      console.log(`   ${step}`);
    });

    console.log("\n🎊 === AVANTAGES DU SYSTÈME UNIFIÉ ===");
    console.log("✅ Une seule API pour tous les cas");
    console.log("✅ Auto-détection intelligente");
    console.log("✅ Optimisation automatique des coûts");
    console.log("✅ Interface utilisateur simplifiée");
    console.log("✅ Support withdrawal + bridge");

  } catch (error) {
    console.error("\n💥 Erreur dans l'exemple unifié:", error);
  }
}

// Exemples d'intégration pour votre frontend
export const createUserFundUI = () => {
  return {
    // Écran de sélection pour l'utilisateur
    getFundOperationOptions: (sourceChain: string) => [
      {
        id: "withdrawal",
        title: "💸 Retirer vers mon wallet",
        description: `Récupérer mes USDC dans MetaMask (${sourceChain})`,
        estimatedTime: "2-5 minutes",
        estimatedCost: "~1-5 USD gas",
        bestFor: "Récupérer vos fonds rapidement"
      },
      {
        id: "bridge",
        title: "🌉 Envoyer vers autre blockchain",
        description: "Transférer vers Polygon, Arbitrum, Base, etc.",
        estimatedTime: "13 minutes (ou 22s fast)",
        estimatedCost: "Gratuit (ou 0.01 USDC fast)",
        bestFor: "Utiliser vos fonds sur une autre blockchain"
      }
    ],

    // Exécution selon le choix utilisateur
    executeUserChoice: async (
      choice: "withdrawal" | "bridge",
      params: {
        walletId: string;
        userAddress: string;
        amount: string;
        sourceChain: string;
        destinationChain?: string;
      }
    ) => {
      if (choice === "withdrawal") {
        return await smartUserFundTransfer.withdraw(
          params.walletId,
          params.userAddress,
          params.amount,
          params.sourceChain
        );
      } else {
        return await smartUserFundTransfer.bridge(
          params.walletId,
          params.userAddress,
          params.amount,
          params.sourceChain,
          params.destinationChain!,
          "standard"
        );
      }
    }
  };
};

// Script principal
if (require.main === module) {
  unifiedFundOperationsExample();
}

export { unifiedFundOperationsExample }; 