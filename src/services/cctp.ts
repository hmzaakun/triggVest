import { CCTPResult } from '../types';
import { CCTP_CONTRACTS, CCTP_FEES, FINALITY_THRESHOLDS, CIRCLE_CONFIG } from '../config/constants';
import { createContractTransaction, waitForTransactionConfirmation, getTransactionStatus, createCircleClient } from './circle';
import { getSavedWalletSets } from './wallet';
import { ethers } from 'ethers';

// Types pour la nouvelle approche CCTP
export interface CCTPTransferOptions {
  fromWalletId: string;
  destinationAddress: string;
  amount: string;
  sourceChain: string;
  destinationChain: string;
  fast?: boolean;
}

// Mapping simple des domaines CCTP
export const CCTP_DOMAINS: Record<string, number> = {
  "ETH-SEPOLIA": 0,
  "MATIC-AMOY": 7,
  "AVAX-FUJI": 1,
  "ARB-SEPOLIA": 3,
  "BASE-SEPOLIA": 6,
  "OP-SEPOLIA": 2
};

// Create CCTP V2 transfer
export const createCCTPV2Transfer = async (options: CCTPTransferOptions): Promise<CCTPTransferResult> => {
  try {
    console.log("\n🌉 CCTP V2 Transfer initiated:");
    console.log(`   📤 From: ${options.fromWalletId} (${options.sourceChain})`);
    console.log(`   📥 To: ${options.destinationAddress} (${options.destinationChain})`);
    console.log(`   💰 Amount: ${options.amount} USDC`);
    console.log(`   🔄 Protocol: Circle's CCTP V2`);
    console.log(`   ⚡ Type: ${options.fast ? 'Fast Transfer (~22s)' : 'Standard Transfer (~13min)'}`);
    console.log(`   💳 Cost: ${options.fast ? 'Onchain fee applies' : 'Minimal fees'}`);

    // Étape 1: Approval USDC (avec HIGH fee pour testnets)
    console.log("\n🔄 Step 1: Approving USDC spending...");
    console.log(`   💰 Amount: ${options.amount} USDC (${parseFloat(options.amount) * 1000000} wei)`);
    console.log(`   🎯 Spender: ${CCTP_CONTRACTS[options.sourceChain].tokenMessenger}`);

    const approvalResponse = await createContractTransaction({
      walletId: options.fromWalletId,
      contractAddress: CCTP_CONTRACTS[options.sourceChain].usdc,
      abiFunctionSignature: "approve(address,uint256)",
      abiParameters: [
        CCTP_CONTRACTS[options.sourceChain].tokenMessenger,
        (parseFloat(options.amount) * 1000000).toString()
      ],
      feeLevel: "HIGH" // ✅ Circle recommande HIGH pour testnets
    });

    if (!approvalResponse.data?.id) {
      throw new Error("Failed to create approval transaction");
    }

    console.log(`   ✅ Approval transaction created: ${approvalResponse.data.id}`);

    // ✅ Retourner immédiatement sans attendre la confirmation
    return {
      success: true,
      approvalTransactionId: approvalResponse.data.id,
      status: "APPROVAL_INITIATED",
      message: "CCTP transfer initiated. Approval transaction submitted.",
      nextStep: "Monitor approval transaction and then proceed with burn"
    };

  } catch (error: any) {
    console.error("❌ CCTP V2 transfer failed:", error.message);
    
    return {
      success: false,
      error: error.message || "Unknown error during CCTP transfer",
      troubleshooting: {
        commonIssues: [
          "Insufficient USDC balance",
          "No native tokens for gas fees", 
          "Network congestion on testnets",
          "Invalid destination chain"
        ],
        recommendations: [
          "Check wallet balances",
          "Ensure gas tokens available", 
          "Try different source chain",
          "Use direct transfer for same-chain operations"
        ]
      }
    };
  }
};

/**
 * Continuer le processus CCTP après confirmation d'approval
 */
export const continueCCTPAfterApproval = async (
  options: CCTPTransferOptions,
  approvalTransactionId: string
): Promise<CCTPTransferResult> => {
  try {
    // Vérifier le statut de l'approval
    const approvalStatus = await getTransactionStatus(approvalTransactionId);
    
    if (approvalStatus.state !== "COMPLETE" && approvalStatus.state !== "CONFIRMED") {
      return {
        success: false,
        error: `Approval transaction not confirmed yet. Status: ${approvalStatus.state}`,
        status: "WAITING_APPROVAL"
      };
    }

    console.log("✅ Approval confirmed, proceeding with burn...");

    // Étape 2: Burn USDC (depositForBurn)
    console.log("\n🔥 Step 2: Burning USDC on source chain...");
    
    const destinationDomain = CCTP_DOMAINS[options.destinationChain];
    const encodedDestination = `0x000000000000000000000000${options.destinationAddress.slice(2)}`;

    const burnResponse = await createContractTransaction({
      walletId: options.fromWalletId,
      contractAddress: CCTP_CONTRACTS[options.sourceChain].tokenMessenger,
      abiFunctionSignature: "depositForBurn(uint256,uint32,bytes32,address,bytes32,uint256,uint32)",
      abiParameters: [
        (parseFloat(options.amount) * 1000000).toString(), // amount
        destinationDomain.toString(), // destinationDomain
        encodedDestination, // mintRecipient
        CCTP_CONTRACTS[options.sourceChain].usdc, // burnToken
        "0x0000000000000000000000000000000000000000000000000000000000000000", // destinationCaller (any)
        options.fast ? "1000000" : "0", // maxFee (1 USDC for fast, 0 for standard)
        options.fast ? "1000" : "2000" // minFinalityThreshold (1000=fast, 2000=standard)
      ],
      feeLevel: "HIGH" // ✅ Circle recommande HIGH
    });

    if (!burnResponse.data?.id) {
      throw new Error("Failed to create burn transaction");
    }

    console.log(`   ✅ Burn transaction created: ${burnResponse.data.id}`);

    return {
      success: true,
      approvalTransactionId,
      burnTransactionId: burnResponse.data.id,
      status: "BURN_INITIATED",
      message: "Burn transaction submitted. Monitor and proceed with attestation.",
      nextStep: "Wait for burn confirmation, then fetch attestation"
    };

  } catch (error: any) {
    return {
      success: false,
      error: error.message || "Error during burn phase"
    };
  }
};

/**
 * Finaliser le CCTP avec l'attestation
 */
export const finalizeCCTPWithAttestation = async (
  options: CCTPTransferOptions,
  burnTransactionId: string,
  destinationWalletId: string 
): Promise<CCTPTransferResult> => {
  try {
    // Obtenir l'attestation
    console.log("\n📜 Step 3: Fetching attestation...");
    
    // D'abord obtenir le txHash de la transaction de burn
    const burnTransaction = await getTransactionStatus(burnTransactionId);
    if (!burnTransaction.txHash) {
      throw new Error("Burn transaction not confirmed yet");
    }
    
    const attestation = await getCircleAttestation(burnTransaction.txHash, options.sourceChain, options.fast ? "fast" : "standard");
    
    if (!attestation.message || !attestation.signature) {
      throw new Error("Failed to fetch attestation from Circle CCTP V2 API");
    }

    console.log("   ✅ Attestation received");

    // Étape 3: receiveMessage sur destination
    console.log("\n💰 Step 4: Minting USDC on destination chain...");

    const mintResponse = await createContractTransaction({
      walletId: destinationWalletId,
      contractAddress: CCTP_CONTRACTS[options.destinationChain].messageTransmitter,
      abiFunctionSignature: "receiveMessage(bytes,bytes)",
      abiParameters: [
        attestation.message,
        attestation.signature
      ],
      feeLevel: "HIGH" // ✅ Important pour les testnets
    });

    if (!mintResponse.data?.id) {
      throw new Error("Failed to create mint transaction");
    }

    console.log(`   ✅ Mint transaction created: ${mintResponse.data.id}`);

    return {
      success: true,
      burnTransactionId,
      mintTransactionId: mintResponse.data.id,
      status: "MINT_INITIATED", 
      message: "CCTP transfer completed. Mint transaction submitted.",
      finalStep: "Monitor mint transaction for completion"
    };

  } catch (error: any) {
    return {
      success: false,
      error: error.message || "Error during mint phase"
    };
  }
};

/**
 * Service de monitoring CCTP non-bloquant
 */
export const getCCTPTransferStatus = async (transactionId: string) => {
  try {
    const transaction = await getTransactionStatus(transactionId);
    
    return {
      transactionId,
      status: transaction.state,
      createDate: transaction.createDate,
      txHash: transaction.txHash,
      blockchain: transaction.blockchain
    };
  } catch (error: any) {
    return {
      transactionId,
      status: "UNKNOWN",
      error: error.message
    };
  }
};

// ✅ Interface mise à jour
export interface CCTPTransferResult {
  success: boolean;
  approvalTransactionId?: string;
  burnTransactionId?: string;
  mintTransactionId?: string;
  status?: string;
  message?: string;
  nextStep?: string;
  finalStep?: string;
  error?: string;
  troubleshooting?: {
    commonIssues: string[];
    recommendations: string[];
  };
}

// Get Circle attestation - CCTP V2 API
export const getCircleAttestation = async (
  txHash: string, 
  sourceChain: string,
  transferType: "standard" | "fast"
) => {
  const maxAttempts = transferType === "fast" ? 12 : 240; // 1 minute for fast, 20 minutes for standard
  let attempts = 0;
  
  console.log(`   🔍 Polling Circle CCTP V2 attestation service...`);
  
  // Get source domain from chain
  const srcDomain = CCTP_DOMAINS[sourceChain];
  if (srcDomain === undefined) {
    throw new Error(`Unsupported source chain: ${sourceChain}`);
  }
  
  while (attempts < maxAttempts) {
    try {
      // ✅ Circle CCTP V2 attestation API URL
      const attestationUrl = `${CIRCLE_CONFIG.ATTESTATION_API_URL}/v2/messages/${srcDomain}?transactionHash=${txHash}`;
      
      const response = await fetch(attestationUrl);
      
      if (response.ok) {
        const data = await response.json();
        // ✅ CCTP V2 retourne un format différent
        if (data.messages && data.messages.length > 0) {
          const message = data.messages[0];
          if (message.status === 'complete') {
            console.log(`   ✅ Attestation found after ${attempts + 1} attempts`);
            return {
              message: message.message,
              signature: message.attestation
            };
          }
        }
      }
      
      console.log(`   ⏳ Attestation not ready yet (${attempts + 1}/${maxAttempts})`);
      await new Promise(resolve => setTimeout(resolve, transferType === "fast" ? 5000 : 30000));
      attempts++;
    } catch (error) {
      console.error(`Error getting attestation: ${error}`);
      attempts++;
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
  
  throw new Error(`Attestation timeout for transaction ${txHash}`);
};

// Complete CCTP mint on destination chain
export const completeCCTPMint = async (
  destinationWalletId: string,
  destinationChain: string,
  messageBytes: string,
  attestation: string
) => {
  try {
    const destinationContracts = CCTP_CONTRACTS[destinationChain as keyof typeof CCTP_CONTRACTS];
    
    if (!destinationContracts) {
      throw new Error(`Unsupported destination chain: ${destinationChain}`);
    }

    console.log(`\n🔄 Completing mint on ${destinationChain}...`);

    // Create mint transaction
    const mintResponse = await createContractTransaction({
      walletId: destinationWalletId,
      contractAddress: destinationContracts.messageTransmitter,
      abiFunctionSignature: "receiveMessage(bytes,bytes)",
      abiParameters: [messageBytes, attestation],
              feeLevel: "HIGH"
    });

    if (!mintResponse.data?.id) {
      throw new Error("Failed to create mint transaction");
    }

    console.log(`   ✅ Mint transaction created: ${mintResponse.data.id}`);
    console.log(`   ⏳ Waiting for mint confirmation...`);

    // Wait for mint confirmation
    await waitForTransactionConfirmation(mintResponse.data.id);

    console.log(`   ✅ CCTP transfer completed successfully!`);
    console.log(`   💰 USDC has been minted on ${destinationChain}`);

    return {
      status: "completed",
      mintTransactionId: mintResponse.data.id,
      message: "CCTP transfer completed successfully"
    };

  } catch (error) {
    console.error("Error completing CCTP mint:", error);
    throw error;
  }
};

// Get CCTP V2 routes
export const getCCTPV2Routes = () => {
  const chains = Object.keys(CCTP_CONTRACTS);
  const routes = [];
  
  for (const source of chains) {
    for (const destination of chains) {
      if (source !== destination) {
        routes.push({
          source,
          destination,
          supported: true
        });
      }
    }
  }
  
  return routes;
};

// Estimate CCTP V2 fees
export const estimateCCTPV2Fees = (
  amount: string,
  transferType: "standard" | "fast"
) => {
  const numericAmount = parseFloat(amount);
  
  if (transferType === "fast") {
    return {
      type: "Fast Transfer",
      fee: CCTP_FEES.FAST_TRANSFER.BASE_FEE,
      time: 22, // seconds
      security: "Soft finality + Circle's allowance",
      description: "Best for speed-sensitive transfers"
    };
  } else {
    return {
      type: "Standard Transfer", 
      fee: CCTP_FEES.STANDARD_TRANSFER.BASE_FEE,
      time: 780, // seconds (13 minutes)
      security: "Hard finality",
      description: "Best for non-urgent transfers"
    };
  }
}; 