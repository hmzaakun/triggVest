import 'dotenv/config';
import { showMainMenu } from './ui/menu';

// Main application entry point
const main = async () => {
  try {
    // Initialize the application
    console.clear();
    
    // Validate environment variables
    if (!process.env.CIRCLE_API_KEY) {
      console.error('❌ CIRCLE_API_KEY environment variable is required');
      process.exit(1);
    }
    
    if (!process.env.CIRCLE_ENTITY_SECRET) {
      console.error('❌ CIRCLE_ENTITY_SECRET environment variable is required');
      process.exit(1);
    }
    
    // Start the main menu
    await showMainMenu();
    
  } catch (error) {
    console.error('💥 Fatal error:', error);
    process.exit(1);
  }
};

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n👋 Goodbye!');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n\n👋 Goodbye!');
  process.exit(0);
});

// Unhandled promise rejection handler
process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Promise Rejection:', reason);
  process.exit(1);
});

// Uncaught exception handler
process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught Exception:', error);
  process.exit(1);
});

// Start the application
main().catch((error) => {
  console.error('💥 Application startup failed:', error);
  process.exit(1);
});
