import { createTransaction, getWalletTokenBalance } from './circle';
import { ethers } from 'ethers';

export interface SimpleTransferOptions {
  fromWalletId: string;
  toAddress: string;
  amount: string;
  token?: "USDC" | "ETH" | "MATIC";
  feeLevel?: "LOW" | "MEDIUM" | "HIGH";
}

export interface TransferResult {
  success: boolean;
  transactionId?: string;
  transactionHash?: string;
  error?: string;
  estimatedConfirmation?: string;
}

/**
 * Transfer simple de fonds Circle vers n'importe quelle adresse
 * Plus simple que CCTP - fonctionne sur la même blockchain
 */
export const transferToExternalWallet = async (
  options: SimpleTransferOptions
): Promise<TransferResult> => {
  try {
    console.log("\n💸 === TRANSFER VERS WALLET EXTERNE ===");
    console.log(`📤 De: ${options.fromWalletId}`);
    console.log(`📥 Vers: ${options.toAddress}`);
    console.log(`💰 Montant: ${options.amount} ${options.token || "USDC"}`);
    console.log(`⚡ Frais: ${options.feeLevel || "HIGH"}`);

    // 1. Vérifier que l'adresse de destination est valide
    if (!ethers.isAddress(options.toAddress)) {
      return {
        success: false,
        error: "Adresse de destination invalide"
      };
    }

    // 2. Vérifier le solde disponible
    const balance = await getWalletTokenBalance(options.fromWalletId, options.token || "USDC");
    
    if (!balance || parseFloat(balance.amount) < parseFloat(options.amount)) {
      return {
        success: false,
        error: `Solde insuffisant. Disponible: ${balance?.amount || "0"} ${options.token || "USDC"}`
      };
    }

    console.log(`✅ Solde vérifié: ${balance.amount} ${options.token || "USDC"} disponible`);

    // 3. Obtenir le token ID (USDC par défaut)
    let tokenId = balance.token?.id;
    
    if (!tokenId) {
      return {
        success: false,
        error: "Token ID non trouvé pour ce wallet"
      };
    }

    console.log(`🎯 Token ID: ${tokenId}`);

    // 4. Créer la transaction
    const transferResponse = await createTransaction({
      walletId: options.fromWalletId,
      tokenId: tokenId,
      destinationAddress: options.toAddress,
      amounts: [options.amount],
      feeLevel: options.feeLevel || "HIGH"
    });

    if (!transferResponse.data?.id) {
      return {
        success: false,
        error: "Impossible de créer la transaction"
      };
    }

    const transactionId = transferResponse.data.id;
    console.log(`✅ Transaction créée: ${transactionId}`);

    // 5. Attendre confirmation (optionnel - en arrière-plan)
    console.log(`🕐 Transaction en cours de traitement...`);
    console.log(`📋 ID de transaction: ${transactionId}`);

    return {
      success: true,
      transactionId: transactionId,
      estimatedConfirmation: "2-5 minutes selon le réseau"
    };

  } catch (error: any) {
    console.error("❌ Erreur lors du transfer:", error);
    
    return {
      success: false,
      error: error.message || "Erreur inconnue lors du transfer"
    };
  }
};

/**
 * Transfer rapide avec validation préalable
 */
export const quickTransferToUser = async (
  walletId: string,
  userAddress: string,
  amount: string
): Promise<TransferResult> => {
  
  console.log(`🚀 Transfer rapide: ${amount} USDC → ${userAddress}`);
  
  // Validation de base
  if (!ethers.isAddress(userAddress)) {
    return {
      success: false,
      error: "❌ Adresse utilisateur invalide"
    };
  }

  if (parseFloat(amount) <= 0) {
    return {
      success: false, 
      error: "❌ Montant doit être supérieur à 0"
    };
  }

  // Transfer avec paramètres optimisés
  return await transferToExternalWallet({
    fromWalletId: walletId,
    toAddress: userAddress,
    amount: amount,
    token: "USDC",
              feeLevel: "HIGH" // Priorisé pour testnets
  });
};

/**
 * Estimation des frais de transfer
 */
export const estimateTransferFees = async (
  walletId: string,
  amount: string,
  feeLevel: "LOW" | "MEDIUM" | "HIGH" = "HIGH"
) => {
  // Estimation approximative basée sur les niveaux Circle
  const feeEstimates = {
    "LOW": "~0.50-2.00 USD",
    "MEDIUM": "~1.00-5.00 USD", 
    "HIGH": "~2.00-10.00 USD"
  };

  const timeEstimates = {
    "LOW": "5-15 minutes",
    "MEDIUM": "2-5 minutes",
    "HIGH": "30 secondes - 2 minutes"
  };

  return {
    estimatedFee: feeEstimates[feeLevel],
    estimatedTime: timeEstimates[feeLevel],
    recommendation: parseFloat(amount) > 100 ? 
      "MEDIUM ou HIGH recommandé pour gros montants" : 
      "LOW suffisant pour petits montants"
  };
};

/**
 * Vérification pré-transfer
 */
export const validateTransfer = async (
  walletId: string,
  destinationAddress: string,
  amount: string
) => {
  const checks = {
    validAddress: ethers.isAddress(destinationAddress),
    validAmount: parseFloat(amount) > 0,
    sufficientBalance: false,
    availableBalance: "0"
  };

  try {
    const balance = await getWalletTokenBalance(walletId, "USDC");
    if (balance) {
      checks.availableBalance = balance.amount;
      checks.sufficientBalance = parseFloat(balance.amount) >= parseFloat(amount);
    }
  } catch (error) {
    console.log("⚠️ Impossible de vérifier le solde");
  }

  return {
    valid: checks.validAddress && checks.validAmount && checks.sufficientBalance,
    checks: checks,
    errors: [
      ...(!checks.validAddress ? ["Adresse de destination invalide"] : []),
      ...(!checks.validAmount ? ["Montant invalide"] : []),
      ...(!checks.sufficientBalance ? [`Solde insuffisant (disponible: ${checks.availableBalance})`] : [])
    ]
  };
};

 