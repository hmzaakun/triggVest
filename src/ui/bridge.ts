import inquirer from 'inquirer';
import { getWalletSetByName, checkBridgeReadiness, getAvailableBlockchains } from '../services/wallet';
import { createCCTPV2Transfer, getCCTPV2Routes, estimateCCTPV2Fees, continueCCTPAfterApproval, finalizeCCTPWithAttestation, getCCTPTransferStatus, type CCTPTransferOptions, type CCTPTransferResult } from '../services/cctp';
import { CCTP_CONTRACTS } from '../config/constants';
import { executeCCTPBridgeOfficial, approveUSDCOfficial, burnUSDCOfficial, getAttestationOfficial, mintUSDCOfficial, type CCTPOfficialOptions } from '../services/cctp-official';
import { showMainMenu } from './menu';
import * as readline from 'readline';
import { getTransactionStatus } from '../services/circle';

// Show bridge interface
export const showBridgeInterface = async (walletSetName: string) => {
  const walletSet = getWalletSetByName(walletSetName);
  if (!walletSet) {
    console.log(`❌ Wallet set not found: ${walletSetName}`);
    return;
  }

  console.log(`\n🌉 CCTP V2 Bridge Interface`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`💰 Wallet Set: ${walletSet.walletSetName}`);
  console.log(`🔗 Supported Routes: ${getCCTPV2Routes().length} cross-chain combinations`);

  const availableChains = getAvailableBlockchains(walletSet);
  
  if (availableChains.length < 2) {
    console.log(`\n❌ Need at least 2 chains for bridging. Current: ${availableChains.length}`);
    console.log(`💡 Create wallets on more chains first.`);
    return;
  }

  const { action } = await inquirer.prompt([
    {
      type: "list",
      name: "action",
      message: "Bridge options:",
      choices: [
        { name: "🚀 Start new bridge transfer", value: "bridge" },
        { name: "📊 Check bridge readiness", value: "readiness" },
        { name: "💰 View fee estimates", value: "fees" },
        { name: "🗺️  View supported routes", value: "routes" },
        { name: "🔙 Back", value: "back" }
      ]
    }
  ]);

  switch (action) {
    case "bridge":
      await startBridgeTransfer(walletSetName);
      break;
    case "readiness":
      await showBridgeReadinessInterface(walletSetName);
      break;
    case "fees":
      await showFeeEstimates();
      break;
    case "routes":
      await showSupportedRoutes();
      break;
    case "back":
      return;
  }
};

// Start bridge transfer
const startBridgeTransfer = async (walletSetName: string) => {
  const walletSet = getWalletSetByName(walletSetName);
  if (!walletSet) return;

  const availableChains = getAvailableBlockchains(walletSet);
  
  console.log(`\n🌉 Configure Bridge Transfer`);
  
  const { sourceChain, destinationChain, amount, transferType } = await inquirer.prompt([
    {
      type: "list",
      name: "sourceChain",
      message: "Select source chain:",
      choices: availableChains
    },
    {
      type: "list",
      name: "destinationChain",
      message: "Select destination chain:",
      choices: (answers: any) => availableChains.filter(chain => chain !== answers.sourceChain)
    },
    {
      type: "input",
      name: "amount",
      message: "Enter USDC amount to bridge:",
      default: "1",
      validate: (input) => {
        const num = parseFloat(input);
        return !isNaN(num) && num > 0 && num <= 1000 || "Enter amount between 0 and 1000";
      }
    },
    {
      type: "list",
      name: "transferType",
      message: "Select transfer type:",
      choices: [
        { 
          name: "🚀 Fast Transfer (~22 seconds, ~0.01 USDC fee)", 
          value: "fast" 
        },
        { 
          name: "⏰ Standard Transfer (~13 minutes, free)", 
          value: "standard" 
        }
      ]
    }
  ]);

  // Pre-bridge checks
  console.log(`\n🔍 Pre-bridge validation...`);
  const readiness = await checkBridgeReadiness(walletSetName, sourceChain, amount);
  
  if (!readiness.ready) {
    console.log(`\n❌ Bridge readiness check failed:`);
    readiness.readinessDetails.forEach(detail => console.log(`   ${detail}`));
    console.log(`\n💡 Fix the issues above and try again.`);
    return;
  }

  console.log(`✅ Bridge readiness check passed!`);

  // Show transfer summary
  const fee = estimateCCTPV2Fees(amount, transferType as "standard" | "fast");
  console.log(`\n📋 Transfer Summary:`);
  console.log(`   📤 From: ${sourceChain}`);
  console.log(`   📥 To: ${destinationChain}`);
  console.log(`   💰 Amount: ${amount} USDC`);
  console.log(`   ⚡ Type: ${fee.type}`);
  console.log(`   💳 Fee: ${fee.fee} USDC`);
  console.log(`   ⏰ Est. Time: ${fee.time}${transferType === 'fast' ? ' seconds' : ' seconds (~13 min)'}`);
  console.log(`   🔒 Security: ${fee.security}`);

  const { confirm } = await inquirer.prompt([
    {
      type: "confirm",
      name: "confirm",
      message: "Proceed with this bridge transfer?",
      default: false
    }
  ]);

  if (!confirm) {
    console.log(`\n❌ Bridge transfer cancelled.`);
    return;
  }

  // Execute bridge transfer using Circle Official method step by step
  console.log(`\n🚀 Executing Circle Official CCTP bridge transfer...`);
  console.log(`🔄 This will be done step by step to ensure each transaction completes properly`);
  
  try {
    if (!readiness.sourceWallet) {
      throw new Error("Source wallet not found");
    }

    const destinationWallet = walletSet.wallets.find(w => w.blockchain === destinationChain);
    if (!destinationWallet) {
      throw new Error("Destination wallet not found");
    }

    // Utiliser la méthode Circle officielle étape par étape
    await executeStepByStepCCTPBridge({
      fromWalletId: readiness.sourceWallet.id,
      destinationWalletId: destinationWallet.id,
      destinationAddress: destinationWallet.address,
      amount: amount,
      sourceChain: sourceChain as "ETH-SEPOLIA" | "MATIC-AMOY" | "BASE-SEPOLIA",
      destinationChain: destinationChain as "ETH-SEPOLIA" | "MATIC-AMOY" | "BASE-SEPOLIA"
    });

    // Le message de succès et la pause sont gérés dans executeStepByStepCCTPBridge

  } catch (error: any) {
    console.error(`\n❌ Bridge transfer failed: ${error.message}`);
    
    // Pause avant retour au menu
    await inquirer.prompt([{
      type: "confirm",
      name: "continue", 
      message: "Press Enter to continue..."
    }]);
    
    if (error.message.includes('timeout')) {
      console.log(`\n💡 Transaction may still complete. Use transaction tracker to monitor progress.`);
    }
  }
};

// Show bridge readiness interface
const showBridgeReadinessInterface = async (walletSetName: string) => {
  const availableChains = getAvailableBlockchains(getWalletSetByName(walletSetName)!);
  
  const { sourceChain, amount } = await inquirer.prompt([
    {
      type: "list",
      name: "sourceChain",
      message: "Check readiness for which source chain:",
      choices: availableChains
    },
    {
      type: "input",
      name: "amount",
      message: "USDC amount to check:",
      default: "1",
      validate: (input) => !isNaN(parseFloat(input)) && parseFloat(input) > 0 || "Enter valid amount"
    }
  ]);

  const readiness = await checkBridgeReadiness(walletSetName, sourceChain, amount);
  
  console.log(`\n🚀 Bridge Readiness Report:`);
  readiness.readinessDetails.forEach(detail => console.log(`   ${detail}`));
  
  if (readiness.ready) {
    console.log(`\n✅ Ready to bridge! You can proceed with the transfer.`);
  } else {
    console.log(`\n❌ Not ready to bridge. Fix the issues above first.`);
  }
};

// Show fee estimates
const showFeeEstimates = async () => {
  console.log(`\n💰 CCTP V2 Fee Estimates`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  
  const amounts = ["1", "10", "100"];
  
  for (const amount of amounts) {
    console.log(`\n💰 ${amount} USDC Transfer:`);
    
    const fastFee = estimateCCTPV2Fees(amount, "fast");
    const standardFee = estimateCCTPV2Fees(amount, "standard");
    
    console.log(`   🚀 Fast Transfer:`);
    console.log(`      Fee: ${fastFee.fee} USDC`);
    console.log(`      Time: ${fastFee.time} seconds`);
    console.log(`      Security: ${fastFee.security}`);
    
    console.log(`   ⏰ Standard Transfer:`);
    console.log(`      Fee: ${standardFee.fee} USDC`);
    console.log(`      Time: ${Math.ceil(standardFee.time / 60)} minutes`);
    console.log(`      Security: ${standardFee.security}`);
  }
  
  console.log(`\n💡 Fee Information:`);
  console.log(`   • Fast Transfer: Fixed 0.01 USDC fee for speed`);
  console.log(`   • Standard Transfer: No additional fees`);
  console.log(`   • Gas fees: Paid separately with native tokens`);
};

// Show supported routes
const showSupportedRoutes = async () => {
  console.log(`\n🗺️  CCTP V2 Supported Routes`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  
  const chains = Object.keys(CCTP_CONTRACTS);
  
  console.log(`\n📊 Supported Chains (${chains.length}):`);
  chains.forEach((chain, index) => {
    const domain = CCTP_CONTRACTS[chain as keyof typeof CCTP_CONTRACTS].domain;
    console.log(`   ${index + 1}. ${chain} (Domain: ${domain})`);
  });
  
  console.log(`\n🔄 Available Routes:`);
  console.log(`   • Any chain → Any other chain`);
  console.log(`   • Total combinations: ${chains.length * (chains.length - 1)}`);
  console.log(`   • All routes support both Fast and Standard transfers`);
  
  console.log(`\n⚡ Transfer Types:`);
  console.log(`   🚀 Fast Transfer: ~22 seconds, 0.01 USDC fee`);
  console.log(`   ⏰ Standard Transfer: ~13 minutes, free`);
  
  console.log(`\n🔒 Security:`);
  console.log(`   • Circle's native CCTP protocol`);
  console.log(`   • Real burn & mint (not wrapped tokens)`);
  console.log(`   • No third-party bridge risk`);
};

// ✅ Interface de suivi en temps réel du bridge
interface BridgeProcessOptions {
  approvalTransactionId?: string;
  burnTransactionId?: string;
  mintTransactionId?: string;
  fromWalletId: string;
  destinationWalletId: string;
  destinationAddress: string;
  amount: string;
  sourceChain: string;
  destinationChain: string;
  fast: boolean;
  status: string;
}

const continueBridgeProcess = async (options: BridgeProcessOptions) => {
  let currentStatus = options.status;
  let currentApprovalId = options.approvalTransactionId;
  let currentBurnId = options.burnTransactionId;
  let currentMintId = options.mintTransactionId;
  
  console.log(`\n🔄 Bridge Process Monitor`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`📤 From: ${options.sourceChain} → 📥 To: ${options.destinationChain}`);
  console.log(`💰 Amount: ${options.amount} USDC | ⚡ Type: ${options.fast ? 'Fast' : 'Standard'}`);
  console.log(`📋 Current Status: ${currentStatus}`);
  
  while (true) {
    const { action } = await inquirer.prompt([
      {
        type: "list",
        name: "action",
        message: "Bridge process options:",
        choices: [
          { name: "🔄 Continue to next step", value: "continue", disabled: currentStatus === "COMPLETED" },
          { name: "📊 Check current status", value: "status" },
          { name: "⏰ Wait and check again", value: "wait" },
          { name: "📋 View transaction details", value: "details" },
          { name: "🔙 Exit to main menu", value: "exit" }
        ]
      }
    ]);

    switch (action) {
      case "continue":
        try {
          if (currentStatus === "APPROVAL_INITIATED" && currentApprovalId) {
            console.log(`\n🔥 Proceeding to burn phase...`);
            const burnResult = await continueCCTPAfterApproval({
              fromWalletId: options.fromWalletId,
              destinationAddress: options.destinationAddress,
              amount: options.amount,
              sourceChain: options.sourceChain,
              destinationChain: options.destinationChain,
              fast: options.fast
            }, currentApprovalId);
            
            if (burnResult.success && burnResult.burnTransactionId) {
              currentBurnId = burnResult.burnTransactionId;
              currentStatus = "BURN_INITIATED";
              console.log(`   ✅ Burn transaction created: ${currentBurnId}`);
            } else {
              console.error(`   ❌ Burn failed: ${burnResult.error}`);
            }
          } else if (currentStatus === "BURN_INITIATED" && currentBurnId) {
            console.log(`\n📜 Proceeding to attestation and mint phase...`);
            const mintResult = await finalizeCCTPWithAttestation({
              fromWalletId: options.fromWalletId,
              destinationAddress: options.destinationAddress,
              amount: options.amount,
              sourceChain: options.sourceChain,
              destinationChain: options.destinationChain,
              fast: options.fast
            }, currentBurnId, options.destinationWalletId);
            
            if (mintResult.success && mintResult.mintTransactionId) {
              currentMintId = mintResult.mintTransactionId;
              currentStatus = "COMPLETED";
              console.log(`   ✅ Mint transaction created: ${currentMintId}`);
              console.log(`\n🎉 Bridge process completed successfully!`);
              console.log(`💰 ${options.amount} USDC bridged from ${options.sourceChain} to ${options.destinationChain}`);
            } else {
              console.error(`   ❌ Mint failed: ${mintResult.error}`);
            }
          } else {
            console.log(`\n⚠️  No next step available for status: ${currentStatus}`);
          }
        } catch (error: any) {
          console.error(`\n❌ Error continuing process: ${error.message}`);
        }
        break;

      case "status":
        console.log(`\n📊 Current Bridge Status:`);
        console.log(`   📋 Phase: ${currentStatus}`);
        if (currentApprovalId) console.log(`   ✅ Approval TX: ${currentApprovalId}`);
        if (currentBurnId) console.log(`   🔥 Burn TX: ${currentBurnId}`);
        if (currentMintId) console.log(`   🏭 Mint TX: ${currentMintId}`);
        
        // Vérifier le statut des transactions
        if (currentApprovalId) {
          try {
            const approvalStatus = await getCCTPTransferStatus(currentApprovalId);
            console.log(`   📊 Approval Status: ${approvalStatus.status}`);
          } catch (error) {
            console.log(`   ⚠️  Could not check approval status`);
          }
        }
        break;

      case "wait":
        console.log(`\n⏳ Waiting 30 seconds before checking again...`);
        await new Promise(resolve => setTimeout(resolve, 30000));
        console.log(`   ✅ Ready to continue!`);
        break;

      case "details":
        console.log(`\n📋 Bridge Transfer Details:`);
        console.log(`   📤 Source: ${options.sourceChain}`);
        console.log(`   📥 Destination: ${options.destinationChain}`);
        console.log(`   💰 Amount: ${options.amount} USDC`);
        console.log(`   ⚡ Type: ${options.fast ? 'Fast Transfer' : 'Standard Transfer'}`);
        console.log(`   🎯 Destination Address: ${options.destinationAddress}`);
        console.log(`   📋 Current Phase: ${currentStatus}`);
        break;

      case "exit":
        console.log(`\n👋 Exiting bridge monitor...`);
        console.log(`💡 Your bridge is still processing in the background.`);
        if (currentApprovalId) console.log(`📋 Approval TX: ${currentApprovalId}`);
        if (currentBurnId) console.log(`📋 Burn TX: ${currentBurnId}`);
        if (currentMintId) console.log(`📋 Mint TX: ${currentMintId}`);
        return;
    }

    if (currentStatus === "COMPLETED") {
      console.log(`\n🎉 Bridge process fully completed!`);
      await inquirer.prompt([{
        type: "confirm",
        name: "continue",
        message: "Press Enter to return to main menu..."
      }]);
      return;
    }
  }
};

export async function manageBridge(): Promise<void> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  try {
    console.log('\n🌉 CCTP Bridge Management');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    // Afficher les options de bridge
    console.log('\n📋 Choose Bridge Method:');
    console.log('1. 🚀 Circle Official CCTP (Recommended)');
    console.log('2. 🧪 Advanced CCTP V2 (Experimental)');
    console.log('3. 🔄 Continue existing bridge process');
    console.log('4. 🔙 Back to main menu');
    
    const choice = await new Promise<string>((resolve) => {
      rl.question('Enter your choice (1-4): ', resolve);
    });
    
    switch (choice) {
      case '1':
        await startOfficialCCTPBridge(rl);
        break;
      case '2':
        await startAdvancedCCTPBridge(rl);
        break;
      case '3':
        await startAdvancedCCTPBridge(rl);
        break;
      case '4':
        rl.close();
        await showMainMenu();
        return;
      default:
        console.log('❌ Invalid choice. Please try again.');
        rl.close();
        await manageBridge();
        return;
    }
    
  } catch (error) {
    console.error('❌ Bridge management error:', error);
  } finally {
    rl.close();
  }
}

/**
 * Nouvelle fonction pour le bridge officiel Circle
 */
async function startOfficialCCTPBridge(rl: any): Promise<void> {
  try {
    console.log('\n🚀 Circle Official CCTP Bridge');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    // Récupérer les informations du bridge
    const sourceChain = await new Promise<string>((resolve) => {
      rl.question('Source chain (ETH-SEPOLIA, MATIC-AMOY, BASE-SEPOLIA): ', resolve);
    });
    
    const destinationChain = await new Promise<string>((resolve) => {
      rl.question('Destination chain (ETH-SEPOLIA, MATIC-AMOY, BASE-SEPOLIA): ', resolve);
    });
    
    const amount = await new Promise<string>((resolve) => {
      rl.question('Amount to bridge (in USDC, e.g., \"1\" for 1 USDC): ', resolve);
    });
    
    const fromWalletId = await new Promise<string>((resolve) => {
      rl.question('Source wallet ID: ', resolve);
    });
    
    const destinationWalletId = await new Promise<string>((resolve) => {
      rl.question('Destination wallet ID: ', resolve);
    });
    
    const destinationAddress = await new Promise<string>((resolve) => {
      rl.question('Destination address (or press Enter to use destination wallet): ', resolve);
    });
    
    // Valider les chaînes
    const validChains = ['ETH-SEPOLIA', 'MATIC-AMOY', 'BASE-SEPOLIA'];
    if (!validChains.includes(sourceChain) || !validChains.includes(destinationChain)) {
      console.log('❌ Invalid chain selection. Please use: ETH-SEPOLIA, MATIC-AMOY, or BASE-SEPOLIA');
      return;
    }
    
    if (sourceChain === destinationChain) {
      console.log('❌ Source and destination chains must be different');
      return;
    }
    
    // Préparer les options
    const options: CCTPOfficialOptions = {
      fromWalletId,
      destinationWalletId,
      destinationAddress: destinationAddress || 'wallet', // Si vide, utiliser l'adresse du wallet
      amount,
      sourceChain: sourceChain as "ETH-SEPOLIA" | "MATIC-AMOY" | "BASE-SEPOLIA",
      destinationChain: destinationChain as "ETH-SEPOLIA" | "MATIC-AMOY" | "BASE-SEPOLIA"
    };
    
    console.log('\n📊 Bridge Summary:');
    console.log(`   💰 Amount: ${amount} USDC`);
    console.log(`   📤 From: ${sourceChain} (${fromWalletId})`);
    console.log(`   📥 To: ${destinationChain} (${destinationWalletId})`);
    console.log(`   🏠 Destination: ${destinationAddress || 'Destination wallet address'}`);
    console.log(`   🔄 Method: Circle Official CCTP`);
    
    const confirm = await new Promise<string>((resolve) => {
      rl.question('\n❓ Confirm bridge? (y/n): ', resolve);
    });
    
    if (confirm.toLowerCase() !== 'y') {
      console.log('❌ Bridge cancelled');
      return;
    }
    
    // Exécuter le bridge officiel
    await executeCCTPBridgeOfficial(options);
    
    console.log('\n🎉 Bridge process completed!');
    console.log('💡 You can verify the transactions in Circle Console: https://console.circle.com/');
    
  } catch (error) {
    console.error('❌ Official CCTP bridge error:', error);
  }
}

/**
 * Fonction existante pour le bridge avancé
 */
async function startAdvancedCCTPBridge(rl: any): Promise<void> {
  console.log('\n🧪 Advanced CCTP V2 Bridge');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('This is the existing advanced CCTP V2 implementation.');
  console.log('For now, use the Circle Official CCTP option (option 1) which is more stable.');
  console.log('\n🔙 Returning to bridge menu...');
}

// Fonction pour faire le bridge étape par étape
async function executeStepByStepCCTPBridge(options: CCTPOfficialOptions): Promise<void> {
  console.log('\n🔄 Starting step-by-step CCTP bridge...');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  try {
    // Étape 1: Approval USDC
    console.log('\n📝 STEP 1: USDC Approval');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━');
    const approvalResult = await approveUSDCOfficial(options);
    
    if (!approvalResult.success) {
      console.log(`❌ Approval failed: ${approvalResult.message}`);
      return;
    }
    
    console.log(`✅ Approval transaction created: ${approvalResult.transactionId}`);
    console.log(`⏳ Waiting for approval to complete...`);
    
    // Attendre la confirmation de l'approval
    await waitForTransactionToComplete(approvalResult.transactionId);
    
    console.log(`✅ Approval completed successfully!`);
    
    // Pause pour permettre à l'utilisateur de vérifier
    await askUserToContinue('approval', 'burn');
    
    // Étape 2: Burn USDC
    console.log('\n🔥 STEP 2: USDC Burn');
    console.log('━━━━━━━━━━━━━━━━━━━━━━');
    const burnResult = await burnUSDCOfficial(options);
    
    if (!burnResult.success) {
      console.log(`❌ Burn failed: ${burnResult.message}`);
      return;
    }
    
    console.log(`✅ Burn transaction created: ${burnResult.transactionId}`);
    console.log(`⏳ Waiting for burn to complete...`);
    
    // Attendre la confirmation du burn
    await waitForTransactionToComplete(burnResult.transactionId);
    
    console.log(`✅ Burn completed successfully!`);
    
    // Pause pour permettre à l'utilisateur de vérifier
    await askUserToContinue('burn', 'attestation');
    
    // Étape 3: Récupérer l'attestation
    console.log('\n🔍 STEP 3: Getting Attestation');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    const attestationData = await getAttestationOfficial(burnResult.transactionId);
    
    if (!attestationData) {
      console.log(`❌ Failed to get attestation`);
      return;
    }
    
    console.log(`✅ Attestation retrieved successfully!`);
    
    // Pause pour permettre à l'utilisateur de vérifier
    await askUserToContinue('attestation', 'mint');
    
    // Étape 4: Mint USDC
    console.log('\n🏭 STEP 4: USDC Mint');
    console.log('━━━━━━━━━━━━━━━━━━━━━━');
    const mintResult = await mintUSDCOfficial(options, attestationData.messageBytes, attestationData.attestation);
    
    if (!mintResult.success) {
      console.log(`❌ Mint failed: ${mintResult.message}`);
      return;
    }
    
    console.log(`✅ Mint transaction created: ${mintResult.transactionId}`);
    console.log(`⏳ Waiting for mint to complete...`);
    
    // Attendre la confirmation du mint
    await waitForTransactionToComplete(mintResult.transactionId);
    
    console.log('\n🎉 BRIDGE COMPLETED SUCCESSFULLY!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`💰 ${options.amount} USDC has been successfully bridged!`);
    console.log(`📤 From: ${options.sourceChain}`);
    console.log(`📥 To: ${options.destinationChain}`);
    console.log(`🔗 Check transactions in Circle Console: https://console.circle.com/`);
    
    // Pause avant retour au menu
    await inquirer.prompt([{
      type: "confirm",
      name: "continue",
      message: "Press Enter to continue..."
    }]);
    
  } catch (error) {
    console.error(`❌ Bridge failed:`, error);
    
    // Pause avant retour au menu même en cas d'erreur
    await inquirer.prompt([{
      type: "confirm",
      name: "continue",
      message: "Press Enter to continue..."
    }]);
    
    throw error; // Re-throw pour stopper le processus
  }
}

// Fonction pour attendre qu'une transaction soit complétée
async function waitForTransactionToComplete(transactionId: string): Promise<void> {
  const maxAttempts = 180; // 6 minutes max (comme Circle Console)
  let attempts = 0;
  
  while (attempts < maxAttempts) {
    try {
      const status = await getTransactionStatus(transactionId);
      
      // Accepter CONFIRMED ou COMPLETE (comme Circle Console)
      if (status.state === 'COMPLETE' || status.state === 'CONFIRMED') {
        return;
      }
      
      if (status.state === 'FAILED') {
        throw new Error(`Transaction failed: ${transactionId}`);
      }
      
      // Polling plus rapide comme Circle Console
      await new Promise(r => setTimeout(r, 2000)); // 2 secondes au lieu de 5
      attempts++;
      
      // Afficher un point de progression
      if (attempts % 10 === 0) { // Chaque 20 secondes
        console.log(`   ⏳ Still waiting... (${Math.floor(attempts * 2 / 60)}:${String(attempts * 2 % 60).padStart(2, '0')})`);
      }
      
    } catch (error) {
      console.error(`   ⚠️  Error checking status: ${error}`);
      await new Promise(r => setTimeout(r, 2000)); // Cohérent avec le polling rapide
      attempts++;
    }
  }
  
  throw new Error(`Transaction timeout after 6 minutes: ${transactionId}`);
}

// Fonction pour demander à l'utilisateur de continuer
async function askUserToContinue(completedStep: string, nextStep: string): Promise<void> {
  console.log(`\n✅ ${completedStep.toUpperCase()} step completed successfully!`);
  console.log(`🔄 Ready to proceed with ${nextStep.toUpperCase()} step`);
  
  const { continue: shouldContinue } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'continue',
      message: `Continue with ${nextStep}?`,
      default: true
    }
  ]);
  
  if (!shouldContinue) {
    throw new Error(`User cancelled bridge process at ${completedStep} step`);
  }
} 