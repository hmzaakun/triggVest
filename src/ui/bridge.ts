import inquirer from 'inquirer';
import { getWalletSetByName, checkBridgeReadiness, getAvailableBlockchains } from '../services/wallet';
import { createCCTPV2Transfer, getCCTPV2Routes, estimateCCTPV2Fees } from '../services/cctp';
import { CCTP_CONTRACTS } from '../config/constants';

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

  // Execute bridge transfer
  console.log(`\n🚀 Executing CCTP V2 bridge transfer...`);
  
  try {
    if (!readiness.sourceWallet) {
      throw new Error("Source wallet not found");
    }

    const destinationWallet = walletSet.wallets.find(w => w.blockchain === destinationChain);
    if (!destinationWallet) {
      throw new Error("Destination wallet not found");
    }

    const result = await createCCTPV2Transfer(
      readiness.sourceWallet.id,
      destinationWallet.address,
      amount,
      sourceChain,
      destinationChain,
      transferType as "standard" | "fast"
    );

    console.log(`\n📊 Bridge Transfer Result:`);
    console.log(`   🎯 Status: ${result.status}`);
    console.log(`   🆔 Transfer ID: ${result.transferId}`);
    console.log(`   📋 Message: ${result.message}`);
    
    if (result.burnTransactionId) {
      console.log(`   🔥 Burn TX: ${result.burnTransactionId}`);
    }
    
    if (result.mintTransactionId) {
      console.log(`   🏭 Mint TX: ${result.mintTransactionId}`);
    }
    
    if (result.status === "completed") {
      console.log(`\n🎉 Bridge transfer completed successfully!`);
      console.log(`💰 ${amount} USDC has been transferred from ${sourceChain} to ${destinationChain}`);
    } else if (result.status === "waiting_for_attestation") {
      console.log(`\n⏳ Bridge transfer pending Circle attestation...`);
      console.log(`💡 This is normal - check back in ${Math.ceil(result.estimatedTime / 60)} minutes`);
    }

  } catch (error: any) {
    console.error(`\n❌ Bridge transfer failed: ${error.message}`);
    
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