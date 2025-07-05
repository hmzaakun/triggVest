import { TransactionData } from '../types';
import { getTransactionStatus, listRecentTransactions } from './circle';

// Quick transaction check for multiple IDs
export const quickTransactionCheck = async (transactionIds: string[]) => {
  console.log(`\n🔍 Quick Transaction Status Check`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

  for (const transactionId of transactionIds) {
    console.log(`\n🔍 Checking: ${transactionId}`);
    
    try {
      const transactionData = (await getTransactionStatus(transactionId)) as any;
      
      console.log(`   📊 Status: ${transactionData?.state || 'UNKNOWN'}`);
      console.log(`   🔗 Operation: ${transactionData?.operation || 'N/A'}`);
      console.log(`   ⏰ Created: ${transactionData?.createDate || 'N/A'}`);
      
      if (transactionData?.txHash) {
        console.log(`   🔗 Blockchain Hash: ${transactionData.txHash}`);
      }
      
      if (transactionData?.amounts && transactionData.amounts.length > 0) {
        console.log(`   💰 Amount: ${transactionData.amounts[0]}`);
      }
      
      if (transactionData?.blockchain) {
        console.log(`   🌐 Blockchain: ${transactionData.blockchain}`);
      }
      
    } catch (error) {
      console.log(`   📊 Status: UNKNOWN`);
      console.log(`   🔗 Operation: N/A`);
      console.log(`   ⏰ Created: N/A`);
      console.log(`   ❌ Error: ${error}`);
    }
  }

  console.log(`\n💡 Results interpretation:`);
  console.log(`   ✅ COMPLETE/CONFIRMED = Your approval worked! Ready for burn step`);
  console.log(`   ⏳ PENDING/SENT = Still processing, wait a bit more`);
  console.log(`   ❌ FAILED = Need to try again`);
};

// Track CCTP transaction through all stages
export const trackCCTPTransaction = async (transferId: string, burnTxId: string) => {
  console.log(`\n🔍 CCTP Transaction Tracking`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`   🆔 Transfer ID: ${transferId}`);
  console.log(`   🔥 Burn Transaction: ${burnTxId}`);
  
  try {
    const burnTxData = await getTransactionStatus(burnTxId);
    
    console.log(`\n📊 Burn Transaction Status:`);
    console.log(`   State: ${burnTxData.state}`);
    console.log(`   Created: ${burnTxData.createDate}`);
    
    if (burnTxData.txHash) {
      console.log(`   Blockchain Hash: ${burnTxData.txHash}`);
      
      if (burnTxData.state === "COMPLETE" || burnTxData.state === "CONFIRMED") {
        console.log(`\n🔄 Checking for Circle attestation...`);
        
        try {
          // Try to get attestation (this would need the actual hash)
          console.log(`   💡 Burn confirmed! Attestation should be available shortly.`);
          console.log(`   🔗 Check attestation status: Circle Developer Console`);
          console.log(`   ⏰ Estimated attestation time: 1-20 minutes`);
        } catch (attestationError) {
          console.log(`   ⚠️  Attestation not ready yet: ${attestationError}`);
        }
      }
    } else {
      console.log(`   ⏳ Transaction still pending...`);
    }
    
  } catch (error) {
    console.error(`   ❌ Error tracking transaction: ${error}`);
  }
};

// List and analyze recent transactions
export const listAndAnalyzeRecentTransactions = async (pageSize: number = 20) => {
  console.log(`\n📋 Recent Transactions Analysis`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  
  try {
    const transactions = await listRecentTransactions(pageSize);
    
    if (!transactions || transactions.length === 0) {
      console.log(`   📭 No recent transactions found.`);
      return;
    }
    
    console.log(`   📊 Found ${transactions.length} recent transactions:`);
    
    // Group transactions by status
    const statusGroups: Record<string, TransactionData[]> = {};
    
    for (const tx of transactions) {
      const status = tx.state || 'UNKNOWN';
      if (!statusGroups[status]) {
        statusGroups[status] = [];
      }
      statusGroups[status].push(tx);
    }
    
    // Display by status groups
    for (const [status, txs] of Object.entries(statusGroups)) {
      console.log(`\n   📊 ${status} (${txs.length} transactions):`);
      
      for (const tx of txs.slice(0, 5)) { // Show max 5 per status
        const date = new Date(tx.createDate).toLocaleString();
        const operation = tx.operation || 'N/A';
        const amounts = (tx as any).amounts || [];
        const amount = amounts.length > 0 ? amounts[0] : 'N/A';
        
        console.log(`      • ${tx.id}`);
        console.log(`        Operation: ${operation}`);
        console.log(`        Amount: ${amount}`);
        console.log(`        Created: ${date}`);
        
        if ((tx as any).txHash) {
          console.log(`        Hash: ${(tx as any).txHash}`);
        }
        
        console.log(``);
      }
      
      if (txs.length > 5) {
        console.log(`      ... and ${txs.length - 5} more`);
      }
    }
    
    // Transaction insights
    console.log(`\n💡 Transaction Insights:`);
    
    const completedCount = statusGroups['COMPLETE']?.length || 0;
    const pendingCount = statusGroups['PENDING']?.length || 0;
    const failedCount = statusGroups['FAILED']?.length || 0;
    const totalCount = transactions.length;
    
    if (totalCount > 0) {
      const successRate = ((completedCount / totalCount) * 100).toFixed(1);
      console.log(`   📈 Success Rate: ${successRate}% (${completedCount}/${totalCount})`);
      
      if (pendingCount > 0) {
        console.log(`   ⏳ Pending: ${pendingCount} transactions`);
        console.log(`      💡 Pending transactions may complete later (testnets are slow)`);
      }
      
      if (failedCount > 0) {
        console.log(`   ❌ Failed: ${failedCount} transactions`);
        console.log(`      💡 Check error details and retry with sufficient funds`);
      }
    }
    
  } catch (error) {
    console.error(`   ❌ Error fetching recent transactions: ${error}`);
  }
};

// Monitor transaction with polling
export const monitorTransactionProgress = async (
  transactionId: string,
  timeoutMinutes: number = 15,
  onStatusUpdate?: (status: string, txData: TransactionData) => void
) => {
  const maxAttempts = timeoutMinutes * 12; // 5 second intervals
  let attempts = 0;
  
  console.log(`\n🔄 Monitoring Transaction: ${transactionId}`);
  console.log(`   ⏰ Timeout: ${timeoutMinutes} minutes`);
  
  while (attempts < maxAttempts) {
    try {
      const txData = await getTransactionStatus(transactionId);
      
      if (attempts % 6 === 0 || txData.state !== 'PENDING') { // Log every 30 seconds or on status change
        const minutes = (attempts * 5 / 60).toFixed(1);
        console.log(`   📊 ${minutes}min - Status: ${txData.state}`);
      }
      
      // Call callback if provided
      if (onStatusUpdate) {
        onStatusUpdate(txData.state, txData);
      }
      
      // Check for completion
      if (txData.state === 'COMPLETE' || txData.state === 'CONFIRMED') {
        console.log(`   ✅ Transaction completed successfully!`);
        return { success: true, data: txData };
      }
      
      if (txData.state === 'FAILED') {
        console.log(`   ❌ Transaction failed`);
        return { success: false, data: txData, error: 'Transaction failed' };
      }
      
      await new Promise(resolve => setTimeout(resolve, 5000));
      attempts++;
    } catch (error) {
      console.error(`   ⚠️  Error checking status: ${error}`);
      attempts++;
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
  
  console.log(`   ⏰ Monitoring timeout after ${timeoutMinutes} minutes`);
  console.log(`   💡 Transaction may still complete - check later with tracker`);
  
  return { 
    success: false, 
    error: `Monitoring timeout after ${timeoutMinutes} minutes`,
    timeout: true 
  };
};

// Check if transaction ID exists
export const transactionExists = async (transactionId: string): Promise<boolean> => {
  try {
    await getTransactionStatus(transactionId);
    return true;
  } catch (error) {
    return false;
  }
};

// Get transaction summary
export const getTransactionSummary = async (transactionId: string) => {
  try {
    const txData = await getTransactionStatus(transactionId);
    
    return {
      id: txData.id,
      status: txData.state,
      operation: txData.operation,
      created: txData.createDate,
      hash: (txData as any).txHash,
      amounts: (txData as any).amounts,
      blockchain: (txData as any).blockchain,
      exists: true
    };
  } catch (error) {
    return {
      id: transactionId,
      status: 'UNKNOWN',
      operation: 'N/A',
      created: 'N/A',
      hash: null,
      amounts: null,
      blockchain: null,
      exists: false,
      error: error
    };
  }
};

// Batch check multiple transactions
export const batchCheckTransactions = async (transactionIds: string[]) => {
  const results = [];
  
  console.log(`\n🔍 Batch Transaction Check (${transactionIds.length} transactions)`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  
  for (let i = 0; i < transactionIds.length; i++) {
    const txId = transactionIds[i];
    console.log(`\n[${i + 1}/${transactionIds.length}] Checking: ${txId}`);
    
    const summary = await getTransactionSummary(txId);
    results.push(summary);
    
    if (summary.exists) {
      console.log(`   ✅ Status: ${summary.status}`);
      console.log(`   🔗 Operation: ${summary.operation}`);
      if (summary.hash) {
        console.log(`   🔗 Hash: ${summary.hash}`);
      }
    } else {
      console.log(`   ❌ Transaction not found or error occurred`);
    }
  }
  
  // Summary
  const existingTxs = results.filter(r => r.exists);
  const completedTxs = existingTxs.filter(r => r.status === 'COMPLETE' || r.status === 'CONFIRMED');
  const pendingTxs = existingTxs.filter(r => r.status === 'PENDING');
  const failedTxs = existingTxs.filter(r => r.status === 'FAILED');
  
  console.log(`\n📊 Batch Check Summary:`);
  console.log(`   📋 Total checked: ${transactionIds.length}`);
  console.log(`   ✅ Found: ${existingTxs.length}`);
  console.log(`   ✅ Completed: ${completedTxs.length}`);
  console.log(`   ⏳ Pending: ${pendingTxs.length}`);
  console.log(`   ❌ Failed: ${failedTxs.length}`);
  console.log(`   ❓ Not found: ${transactionIds.length - existingTxs.length}`);
  
  return results;
}; 