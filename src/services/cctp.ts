import { CCTPResult } from '../types';
import { CCTP_CONTRACTS, CCTP_FEES, FINALITY_THRESHOLDS, CIRCLE_CONFIG } from '../config/constants';
import { createContractTransaction, waitForTransactionConfirmation } from './circle';

// Create CCTP V2 transfer
export const createCCTPV2Transfer = async (
  sourceWalletId: string,
  destinationAddress: string,
  amount: string,
  sourceChain: string,
  destinationChain: string,
  transferType: "standard" | "fast" = "standard"
): Promise<CCTPResult> => {
  try {
    console.log(`🌉 CCTP V2 ${transferType.toUpperCase()} Transfer initiated:`);
    console.log(`   📤 From: ${sourceWalletId} (${sourceChain})`);
    console.log(`   📥 To: ${destinationAddress} (${destinationChain})`);
    console.log(`   💰 Amount: ${amount} USDC`);
    console.log(`   🔄 Protocol: Circle's CCTP V2`);
    console.log(
      `   ⚡ Type: ${
        transferType === "fast"
          ? "Fast Transfer (~22s)"
          : "Standard Transfer (~13min)"
      }`
    );
    console.log(
      `   💳 Cost: ${transferType === "fast" ? "Onchain fee applies" : "Free"}`
    );

    // Get contract addresses
    const sourceContracts = CCTP_CONTRACTS[sourceChain as keyof typeof CCTP_CONTRACTS];
    const destinationContracts = CCTP_CONTRACTS[destinationChain as keyof typeof CCTP_CONTRACTS];

    if (!sourceContracts || !destinationContracts) {
      throw new Error(`Unsupported chain: ${sourceChain} or ${destinationChain}`);
    }

    // Convert amount to wei (6 decimals for USDC)
    const amountInWei = (parseFloat(amount) * 1000000).toString();
    
    // CCTP V2 parameters according to Circle documentation
    const destinationAddressBytes32 = "0x" + destinationAddress.slice(2).padStart(64, "0");
    const destinationCallerBytes32 = "0x" + "0".repeat(64); // 0x0...0 to allow anyone to call receiveMessage
    const maxFee = transferType === "fast" ? CCTP_FEES.FAST_TRANSFER.MAX_FEE_WEI : CCTP_FEES.STANDARD_TRANSFER.MAX_FEE_WEI;
    const minFinalityThreshold = transferType === "fast" ? FINALITY_THRESHOLDS.FAST_TRANSFER : FINALITY_THRESHOLDS.STANDARD_TRANSFER;

    console.log(`\n🔄 Step 1: Approving USDC spending...`);
    console.log(`   💰 Amount: ${amount} USDC (${amountInWei} wei)`);
    console.log(`   🎯 Spender: ${sourceContracts.tokenMessenger}`);
    
    // Step 1: Approve TokenMessenger contract to withdraw USDC
    const approveResponse = await createContractTransaction({
      walletId: sourceWalletId,
      contractAddress: sourceContracts.usdc,
      abiFunctionSignature: "approve(address,uint256)",
      abiParameters: [sourceContracts.tokenMessenger, amountInWei],
      feeLevel: "MEDIUM"
    });

    if (!approveResponse.data?.id) {
      throw new Error("Failed to create approval transaction");
    }

    console.log(`   ✅ Approval transaction created: ${approveResponse.data.id}`);

    // Wait for approval confirmation
    let approvalTxData;
    try {
      approvalTxData = await waitForTransactionConfirmation(approveResponse.data.id);
      console.log(`   ✅ USDC approval confirmed!`);
    } catch (error) {
      console.log(`\n💡 Approval transaction may still be processing...`);
      console.log(`   Transaction ID: ${approveResponse.data.id}`);
      console.log(`   Check transaction status later with the tracker.`);
      throw error;
    }

    console.log(`\n🔄 Step 2: Burning USDC on source chain...`);
    console.log(`   🔥 Calling depositForBurn with CCTP V2 parameters`);
    console.log(`   📍 Destination Domain: ${destinationContracts.domain}`);
    console.log(`   🎯 Destination Address: ${destinationAddress}`);
    console.log(`   ⚡ Transfer Type: ${transferType}`);
    console.log(`   💳 Max Fee: ${maxFee} wei`);
    console.log(`   ⏰ Finality Threshold: ${minFinalityThreshold}`);

    // Step 2: Burn USDC on source chain with 7 CCTP V2 parameters
    const burnResponse = await createContractTransaction({
      walletId: sourceWalletId,
      contractAddress: sourceContracts.tokenMessenger,
      abiFunctionSignature: "depositForBurn(uint256,uint32,bytes32,address,bytes32,uint256,uint32)",
      abiParameters: [
        amountInWei,                    // amount
        destinationContracts.domain,    // destinationDomain
        destinationAddressBytes32,      // mintRecipient
        sourceContracts.usdc,          // burnToken
        destinationCallerBytes32,       // destinationCaller (0x0 = anyone can call)
        maxFee,                        // maxFee
        minFinalityThreshold           // minFinalityThreshold
      ],
      feeLevel: "MEDIUM"
    });

    if (!burnResponse.data?.id) {
      throw new Error("Failed to create burn transaction");
    }

    console.log(`   ✅ Burn transaction created: ${burnResponse.data.id}`);

    // Wait for burn confirmation
    let burnTxData;
    try {
      burnTxData = await waitForTransactionConfirmation(burnResponse.data.id);
      console.log(`   ✅ USDC burn confirmed!`);
    } catch (error) {
      console.log(`\n💡 Burn transaction may still be processing...`);
      console.log(`   Transaction ID: ${burnResponse.data.id}`);
      console.log(`   Check transaction status later with the tracker.`);
      throw error;
    }

     console.log(`\n🔄 Step 3: Getting attestation from Circle...`);
     
     // Step 3: Get attestation from Circle using transaction hash
     let attestationData;
     try {
       // Use real transaction hash to get attestation
       const transactionHash = burnTxData.txHash || burnTxData.transactionHash;
       if (!transactionHash) {
         throw new Error("No transaction hash available for attestation");
       }
       
       console.log(`   🔗 Transaction Hash: ${transactionHash}`);
       console.log(`   🌐 Source Domain: ${sourceContracts.domain}`);
       
       attestationData = await getCircleAttestation(transactionHash, transferType);
       console.log(`   ✅ Attestation received from Circle!`);
       
     } catch (attestationError: any) {
       console.log(`   ⚠️  Attestation not ready yet: ${attestationError.message}`);
       console.log(`   ⏰ This is normal - attestation can take 1-20 minutes depending on transfer type`);
       
       return {
         status: "waiting_for_attestation",
         transferId: `cctp-${transferType}-${Date.now()}`,
         burnTransactionId: burnResponse.data.id,
         burnTransactionHash: burnTxData.txHash || burnTxData.transactionHash,
         sourceChain: sourceChain,
         destinationChain: destinationChain,
         destinationAddress: destinationAddress,
         amount: amount,
         transferType: transferType,
         estimatedTime: transferType === "fast" ? 22 : 780,
         message: `CCTP V2 ${transferType} transfer waiting for Circle attestation`,
         nextStep: "Get attestation and complete mint on destination chain"
       };
     }

     console.log(`\n🔄 Step 4: Completing mint on destination chain...`);
     
     // Step 4: Complete mint on destination chain
     try {
       // Find destination wallet
       const destinationWalletId = sourceWalletId; // Unified address - same wallet ID
       
       const mintResult = await completeCCTPMint(
         destinationWalletId,
         destinationChain,
         attestationData.message,
         attestationData.signature
       );
       
       console.log(`   ✅ CCTP V2 transfer completed successfully!`);
       console.log(`   📋 Mint Transaction: ${mintResult.mintTransactionId}`);
       
       return {
         status: "completed",
         transferId: `cctp-${transferType}-${Date.now()}`,
         burnTransactionId: burnResponse.data.id,
         burnTransactionHash: burnTxData.txHash || burnTxData.transactionHash,
         mintTransactionId: mintResult.mintTransactionId,
         sourceChain: sourceChain,
         destinationChain: destinationChain,
         destinationAddress: destinationAddress,
         amount: amount,
         transferType: transferType,
         estimatedTime: transferType === "fast" ? 22 : 780,
         message: `CCTP V2 ${transferType} transfer completed successfully!`
       };
       
     } catch (mintError: any) {
       console.log(`   ⚠️  Mint failed: ${mintError.message}`);
       console.log(`   💡 You can manually complete the mint later using the attestation`);
       
       return {
         status: "mint_pending",
         transferId: `cctp-${transferType}-${Date.now()}`,
         burnTransactionId: burnResponse.data.id,
         burnTransactionHash: burnTxData.txHash || burnTxData.transactionHash,
         attestation: attestationData,
         sourceChain: sourceChain,
         destinationChain: destinationChain,
         destinationAddress: destinationAddress,
         amount: amount,
         transferType: transferType,
         estimatedTime: transferType === "fast" ? 22 : 780,
         message: `CCTP V2 ${transferType} burn completed, mint pending`,
         nextStep: "Complete mint on destination chain using attestation"
       };
     }
  } catch (error: any) {
    console.error(`\n❌ CCTP V2 transfer failed:`);
    
    // Handle specific common errors
    if (error.response?.status === 400) {
      const errorData = error.response.data;
      
      if (errorData.code === 155258) {
        console.log(`\n💰 Insufficient Funds Error:`);
        console.log(`   • Error Code: ${errorData.code}`);
        console.log(`   • Message: ${errorData.message}`);
        console.log(`\n🔧 Solution:`);
        console.log(`   1. Check your current balance with 'Check balances'`);
        console.log(`   2. Get USDC testnet funds from: https://faucet.circle.com/`);
        console.log(`   3. Wait 2-5 minutes for funds to arrive`);
        console.log(`   4. Try the bridge operation again`);
        console.log(`\n💡 You need both:`);
        console.log(`   • Native tokens (ETH, AVAX, etc.) for gas fees`);
        console.log(`   • USDC tokens for the actual transfer`);
      } else {
        console.log(`   • Code: ${errorData.code}`);
        console.log(`   • Message: ${errorData.message}`);
      }
    } else if (error.message?.includes('confirmation timeout')) {
      console.log(`\n🕐 Transaction Timeout Recovery:`);
      console.log(`   • Your transaction may still be processing on the blockchain`);
      console.log(`   • Testnets can be very slow, sometimes taking 15-30 minutes`);
      console.log(`   • The transaction might complete successfully later`);
      console.log(`\n🔄 Next steps:`);
      console.log(`   1. Use the 'Transaction Tracker' to check status`);
      console.log(`   2. Wait 10-15 more minutes before retrying`);
      console.log(`   3. Consider using a different source chain`);
      console.log(`   4. Ensure you have enough gas tokens for fees`);
      console.log(`\n💡 Pro tip: ETH-SEPOLIA is usually faster than MATIC-AMOY`);
    } else {
      console.error(error);
    }
    
    return {
      status: "failed",
      error: error.message || "Unknown error",
      transferId: "",
      burnTransactionId: "",
      sourceChain: sourceChain,
      destinationChain: destinationChain,
      destinationAddress: destinationAddress,
      amount: amount,
      transferType: transferType,
      estimatedTime: 0,
      message: "CCTP V2 transfer failed"
    };
  }
};

// Get Circle attestation
export const getCircleAttestation = async (txHash: string, transferType: "standard" | "fast") => {
  const maxAttempts = transferType === "fast" ? 12 : 240; // 1 minute for fast, 20 minutes for standard
  let attempts = 0;
  
  console.log(`   🔍 Polling Circle attestation service...`);
  
  while (attempts < maxAttempts) {
    try {
      // Circle attestation API URL for testnet
      const attestationUrl = `${CIRCLE_CONFIG.ATTESTATION_API_URL}/attestations/${txHash}`;
      
      const response = await fetch(attestationUrl);
      
      if (response.ok) {
        const data = await response.json();
        if (data.attestation) {
          console.log(`   ✅ Attestation found after ${attempts + 1} attempts`);
          return data.attestation;
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
      feeLevel: "MEDIUM"
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