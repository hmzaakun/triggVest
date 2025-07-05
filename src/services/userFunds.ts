import { createCCTPV2Transfer } from './cctp';
import { transferToExternalWallet, validateTransfer } from './transfer';
import { getWalletTokenBalance } from './circle';
import { ethers } from 'ethers';

export interface UserFundOperation {
  type: "bridge" | "withdrawal";
  fromWalletId: string;
  toAddress: string;
  amount: string;
  sourceChain: string;
  destinationChain?: string; // Optionnel pour withdrawal
  transferType?: "standard" | "fast";
}

export interface FundOperationResult {
  success: boolean;
  operationType: "bridge" | "withdrawal";
  method: "cctp" | "direct_transfer";
  transactionId?: string;
  transferId?: string;
  estimatedTime?: string;
  fees?: string;
  error?: string;
  nextSteps?: string[];
}

/**
 * Service intelligent qui choisit automatiquement entre CCTP et transfer direct
 */
export const executeUserFundOperation = async (
  operation: UserFundOperation
): Promise<FundOperationResult> => {
  try {
    console.log("\n🎯 === SERVICE FONDS UTILISATEUR ===");
    console.log(`📋 Type: ${operation.type}`);
    console.log(`📤 De: ${operation.fromWalletId} (${operation.sourceChain})`);
    console.log(`📥 Vers: ${operation.toAddress}`);
    console.log(`💰 Montant: ${operation.amount} USDC`);

    // Déterminer la méthode selon le type d'opération
    const isCrossChain = operation.destinationChain && 
                        operation.destinationChain !== operation.sourceChain;
    
    if (operation.type === "bridge" && isCrossChain) {
      // Utiliser CCTP pour bridge cross-chain
      return await executeCCTPBridge(operation);
    } else if (operation.type === "withdrawal" || !isCrossChain) {
      // Utiliser transfer direct pour withdrawal ou même blockchain
      return await executeDirectTransfer(operation);
    } else {
      return {
        success: false,
        operationType: operation.type,
        method: "cctp",
        error: "Type d'opération non déterminé"
      };
    }

  } catch (error: any) {
    console.error("❌ Erreur dans executeUserFundOperation:", error);
    return {
      success: false,
      operationType: operation.type,
      method: "cctp",
      error: error.message
    };
  }
};

/**
 * Exécute un bridge CCTP cross-chain
 */
const executeCCTPBridge = async (
  operation: UserFundOperation
): Promise<FundOperationResult> => {
  console.log("🌉 Utilisation de CCTP pour bridge cross-chain");
  
  if (!operation.destinationChain) {
    return {
      success: false,
      operationType: "bridge",
      method: "cctp",
      error: "Destination chain requis pour bridge"
    };
  }

  const result = await createCCTPV2Transfer({
    fromWalletId: operation.fromWalletId,
    destinationAddress: operation.toAddress,
    amount: operation.amount,
    sourceChain: operation.sourceChain,
    destinationChain: operation.destinationChain,
    fast: operation.transferType === "fast"
  });

  const estimatedTime = operation.transferType === "fast" ? "~22 secondes" : "~13 minutes";
  const fees = operation.transferType === "fast" ? "~0.01 USDC" : "Gratuit (seulement gas)";

  if (result.success && result.status === "MINT_INITIATED") {
    return {
      success: true,
      operationType: "bridge",
      method: "cctp",
      transactionId: result.mintTransactionId,
      estimatedTime: "Terminé!",
      fees: fees,
      nextSteps: [
        "✅ Bridge CCTP terminé",
        `Fonds disponibles sur ${operation.destinationChain}`,
        "Vérifiez votre solde sur la blockchain de destination"
      ]
    };
  } else if (result.success && (result.status === "APPROVAL_INITIATED" || result.status === "BURN_INITIATED")) {
    return {
      success: true,
      operationType: "bridge", 
      method: "cctp",
      transactionId: result.approvalTransactionId || result.burnTransactionId,
      estimatedTime: estimatedTime,
      fees: fees,
      nextSteps: [
        "🕐 Bridge CCTP en cours",
        result.message || "Transaction soumise",
        `Prochaine étape: ${result.nextStep || "Attendre confirmation"}`,
        "Les fonds arriveront automatiquement"
      ]
    };
  } else {
    return {
      success: false,
      operationType: "bridge",
      method: "cctp", 
      error: result.error || "Erreur lors du bridge CCTP"
    };
  }
};

/**
 * Exécute un transfer direct (même blockchain)
 */
const executeDirectTransfer = async (
  operation: UserFundOperation
): Promise<FundOperationResult> => {
  console.log("💸 Utilisation de transfer direct");

  const result = await transferToExternalWallet({
    fromWalletId: operation.fromWalletId,
    toAddress: operation.toAddress,
    amount: operation.amount,
    token: "USDC",
            feeLevel: "HIGH"
  });

  if (result.success) {
    return {
      success: true,
      operationType: operation.type,
      method: "direct_transfer",
      transactionId: result.transactionId,
      estimatedTime: result.estimatedConfirmation || "2-5 minutes",
      fees: "~1-5 USD (gas fees)",
      nextSteps: [
        "✅ Transfer direct réussi",
        "Transaction en cours de confirmation",
        "Vérifiez votre wallet dans quelques minutes"
      ]
    };
  } else {
    return {
      success: false,
      operationType: operation.type,
      method: "direct_transfer",
      error: result.error || "Erreur lors du transfer direct"
    };
  }
};

/**
 * Interface intelligente qui détermine automatiquement la méthode
 */
export const smartUserFundTransfer = {
  // Bridge cross-chain
  bridge: async (
    fromWalletId: string,
    toAddress: string,
    amount: string,
    sourceChain: string,
    destinationChain: string,
    transferType: "standard" | "fast" = "standard"
  ): Promise<FundOperationResult> => {
    return executeUserFundOperation({
      type: "bridge",
      fromWalletId,
      toAddress,
      amount,
      sourceChain,
      destinationChain,
      transferType
    });
  },

  // Withdrawal vers wallet personnel
  withdraw: async (
    fromWalletId: string,
    userWalletAddress: string,
    amount: string,
    blockchain: string
  ): Promise<FundOperationResult> => {
    return executeUserFundOperation({
      type: "withdrawal",
      fromWalletId,
      toAddress: userWalletAddress,
      amount,
      sourceChain: blockchain
    });
  },

  // Auto-détection selon les paramètres
  auto: async (
    fromWalletId: string,
    toAddress: string,
    amount: string,
    sourceChain: string,
    destinationChain?: string
  ): Promise<FundOperationResult> => {
    const operation: UserFundOperation = {
      type: destinationChain && destinationChain !== sourceChain ? "bridge" : "withdrawal",
      fromWalletId,
      toAddress,
      amount,
      sourceChain,
      destinationChain
    };

    return executeUserFundOperation(operation);
  }
};

/**
 * Validation préalable pour toute opération
 */
export const validateUserFundOperation = async (
  operation: UserFundOperation
) => {
  const validations = {
    validAddress: ethers.isAddress(operation.toAddress),
    validAmount: parseFloat(operation.amount) > 0,
    sufficientBalance: false,
    supportedChains: true, // À implémenter selon vos chaînes supportées
    availableBalance: "0"
  };

  // Vérifier le solde
  try {
    const balance = await getWalletTokenBalance(operation.fromWalletId, "USDC");
    if (balance) {
      validations.availableBalance = balance.amount;
      validations.sufficientBalance = parseFloat(balance.amount) >= parseFloat(operation.amount);
    }
  } catch (error) {
    console.log("⚠️ Impossible de vérifier le solde");
  }

  return {
    valid: Object.values(validations).every(v => v === true),
    validations,
    recommendedMethod: operation.destinationChain && 
                      operation.destinationChain !== operation.sourceChain ? "CCTP" : "Direct Transfer",
    estimatedTime: operation.destinationChain && 
                   operation.destinationChain !== operation.sourceChain ? "13 minutes" : "2-5 minutes",
    estimatedFees: operation.destinationChain && 
                   operation.destinationChain !== operation.sourceChain ? "Gratuit + gas" : "1-5 USD gas"
  };
};

 