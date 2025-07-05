import 'dotenv/config';
import { transferToExternalWallet, quickTransferToUser, validateTransfer, estimateTransferFees } from '../services/transfer';
import { getSavedWalletSets } from '../services/wallet';

/**
 * Exemple simple: Transfer de fonds Circle vers wallet utilisateur
 * Plus simple que CCTP - fonctionne sur la même blockchain
 */

async function simpleTransferExample() {
  try {
    console.log("💸 === EXEMPLE TRANSFER SIMPLE ===\n");

    // 1. Scénario: L'utilisateur veut récupérer ses fonds
    const transferScenario = {
      userAddress: "0x30FaA798B5d332A733150bCA1556D7BeDA2CeB87", // MetaMask de l'utilisateur
      amount: "2", // 5 USDC (petit montant pour test - vous avez 10 USDC disponible)
      reason: "Withdrawal demandé par l'utilisateur"
    };

    console.log(`👤 Adresse utilisateur: ${transferScenario.userAddress}`);
    console.log(`💰 Montant à transférer: ${transferScenario.amount} USDC`);
    console.log(`📝 Raison: ${transferScenario.reason}\n`);

    // 2. Trouver le wallet source (newSet)
    const walletSets = getSavedWalletSets();
    const sourceWalletSet = walletSets.find(ws => ws.walletSetName === "newSet");
    
    if (!sourceWalletSet) {
      console.log('❌ Wallet set "newSet" non trouvé');
      return;
    }

    // Prendre le wallet Sepolia (ou le premier disponible)
    const sourceWallet = sourceWalletSet.wallets.find(w => w.blockchain === "ARB-SEPOLIA") 
                        || sourceWalletSet.wallets[0];

    if (!sourceWallet) {
      console.log("❌ Aucun wallet source trouvé");
      return;
    }

    console.log(`📱 Wallet source: ${sourceWallet.address} (${sourceWallet.blockchain})`);
    console.log(`🆔 Wallet ID: ${sourceWallet.id}\n`);

    // 3. Validation pré-transfer
    console.log("🔍 === VALIDATION PRÉ-TRANSFER ===");
    
    const validation = await validateTransfer(
      sourceWallet.id,
      transferScenario.userAddress,
      transferScenario.amount
    );

    console.log(`✅ Adresse valide: ${validation.checks.validAddress}`);
    console.log(`✅ Montant valide: ${validation.checks.validAmount}`);
    console.log(`✅ Solde suffisant: ${validation.checks.sufficientBalance}`);
    console.log(`💰 Solde disponible: ${validation.checks.availableBalance} USDC`);

    if (!validation.valid) {
      console.log("\n❌ === VALIDATION ÉCHOUÉE ===");
      validation.errors.forEach(error => {
        console.log(`   ${error}`);
      });
      return;
    }

    console.log("✅ Toutes les validations passées!\n");

    // 4. Estimation des frais
    console.log("💳 === ESTIMATION DES FRAIS ===");
    
    const feeEstimation = await estimateTransferFees(
      sourceWallet.id,
      transferScenario.amount,
      "MEDIUM"
    );

    console.log(`💵 Frais estimés: ${feeEstimation.estimatedFee}`);
    console.log(`⏰ Temps estimé: ${feeEstimation.estimatedTime}`);
    console.log(`💡 Recommandation: ${feeEstimation.recommendation}\n`);

    // 5. Demander confirmation (simulé)
    console.log("🤔 === CONFIRMATION ===");
    console.log(`❓ Transférer ${transferScenario.amount} USDC vers ${transferScenario.userAddress}?`);
    console.log(`❓ Accepter les frais estimés: ${feeEstimation.estimatedFee}?`);
    console.log(`❓ Temps d'attente acceptable: ${feeEstimation.estimatedTime}?`);
    
    // Simuler l'approbation
    const approved = true;
    
    if (!approved) {
      console.log("❌ Transfer annulé\n");
      return;
    }

    console.log("✅ Transfer approuvé!\n");

    // 6. Exécuter le transfer
    console.log("🚀 === EXÉCUTION DU TRANSFER ===");

    const result = await quickTransferToUser(
      sourceWallet.id,
      transferScenario.userAddress,
      transferScenario.amount
    );

    // 7. Afficher les résultats
    if (result.success) {
      console.log("\n🎉 === TRANSFER RÉUSSI ===");
      console.log(`✅ Transaction ID: ${result.transactionId}`);
      console.log(`⏰ Confirmation estimée: ${result.estimatedConfirmation}`);
      console.log(`🔗 Suivre la transaction dans Circle Console ou blockchain explorer`);
      
      console.log("\n📋 === INFORMATIONS UTILISATEUR ===");
      console.log(`🎊 ${transferScenario.amount} USDC envoyés vers votre wallet!`);
      console.log(`📱 Vérifiez votre solde dans MetaMask`);
      console.log(`🕐 La transaction devrait arriver dans ${result.estimatedConfirmation}`);
      console.log(`🔍 Transaction ID pour support: ${result.transactionId}`);

    } else {
      console.log("\n❌ === TRANSFER ÉCHOUÉ ===");
      console.log(`💔 Erreur: ${result.error}`);
      
      console.log("\n🛠️ === SOLUTIONS ===");
      console.log("   1. Vérifier le solde du wallet source");
      console.log("   2. Vérifier l'adresse de destination");
      console.log("   3. Réessayer avec un montant plus petit");
      console.log("   4. Contacter le support si problème persiste");
    }

  } catch (error) {
    console.error("\n💥 Erreur dans l'exemple de transfer:", error);
  }
}

// Fonction utilitaire pour les développeurs
export const createUserWithdrawalService = () => {
  return {
    // Étape 1: Validation
    validateWithdrawal: validateTransfer,
    
    // Étape 2: Estimation
    estimateCosts: estimateTransferFees,
    
    // Étape 3: Exécution
    executeWithdrawal: transferToExternalWallet,
    
    // Fonction rapide tout-en-un
    quickWithdrawal: quickTransferToUser
  };
};

// Interface UI pour frontend
export interface WithdrawalRequest {
  userId: string;
  destinationAddress: string;
  amount: string;
  reason?: string;
}

export interface WithdrawalFlow {
  step: "validation" | "estimation" | "confirmation" | "execution" | "completed";
  data: any;
  error?: string;
}

// Exemple d'intégration pour votre app
export const processUserWithdrawal = async (
  request: WithdrawalRequest
): Promise<WithdrawalFlow[]> => {
  const steps: WithdrawalFlow[] = [];
  
  try {
    // Étape 1: Validation
    steps.push({
      step: "validation",
      data: { message: "Validation de la demande..." }
    });
    
    // Trouver le wallet de l'utilisateur
    const walletSets = getSavedWalletSets();
    const userWalletSet = walletSets.find(ws => ws.walletSetName === request.userId);
    
    if (!userWalletSet?.wallets[0]) {
      steps.push({
        step: "validation",
        data: { message: "Wallet non trouvé" },
        error: "Aucun wallet trouvé pour cet utilisateur"
      });
      return steps;
    }

    const validation = await validateTransfer(
      userWalletSet.wallets[0].id,
      request.destinationAddress,
      request.amount
    );

    if (!validation.valid) {
      steps.push({
        step: "validation",
        data: validation,
        error: validation.errors.join(", ")
      });
      return steps;
    }

    // Étape 2: Estimation
    steps.push({
      step: "estimation",
      data: await estimateTransferFees(userWalletSet.wallets[0].id, request.amount)
    });

    // Étape 3: Exécution (si tout va bien)
    steps.push({
      step: "execution",
      data: { message: "Exécution du transfer..." }
    });

    const result = await quickTransferToUser(
      userWalletSet.wallets[0].id,
      request.destinationAddress,
      request.amount
    );

    if (result.success) {
      steps.push({
        step: "completed",
        data: {
          transactionId: result.transactionId,
          message: "Transfer réussi!"
        }
      });
    } else {
      steps.push({
        step: "execution",
        data: result,
        error: result.error
      });
    }

  } catch (error: any) {
    steps.push({
      step: "validation",
      data: {},
      error: error.message
    });
  }

  return steps;
};

// Exécuter l'exemple si appelé directement
if (require.main === module) {
  simpleTransferExample();
}

export { simpleTransferExample }; 