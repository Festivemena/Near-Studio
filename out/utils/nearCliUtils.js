"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NearCliUtils = exports.execAsync = void 0;
const vscode = __importStar(require("vscode"));
const util_1 = require("util");
const exec = (0, util_1.promisify)(require('child_process').exec);
const fs = require('fs').promises;
const path = require('path');
const os = require('os');
// Export execAsync for other modules
exports.execAsync = (0, util_1.promisify)(require('child_process').exec);
class NearCliUtils {
    /**
     * Check if NEAR CLI is installed and accessible
     */
    static async checkNearCliInstalled() {
        try {
            await exec('near --version');
            return true;
        }
        catch (error) {
            return false;
        }
    }
    /**
     * Create account using near create-account command with faucet (CLI only)
     */
    static async createAccountWithFaucet(accountId, network = 'testnet') {
        try {
            // Validate account ID format
            const validation = this.validateAccountId(accountId, network);
            if (!validation.isValid) {
                return { success: false, message: validation.error || 'Invalid account ID' };
            }
            // Check if CLI is installed - required, no fallbacks
            const hasNearCli = await this.checkNearCliInstalled();
            if (!hasNearCli) {
                return {
                    success: false,
                    message: 'NEAR CLI is required. Install with: cargo install near-cli-rs'
                };
            }
            // Execute the create account command - only CLI method
            const command = network === 'testnet'
                ? `near create-account ${accountId} --useFaucet`
                : `near create-account ${accountId}`;
            const { stdout, stderr } = await exec(command, { timeout: 60000 });
            // Handle different response scenarios
            if (stderr && stderr.includes('already exists')) {
                return {
                    success: false,
                    message: `Account ${accountId} already exists`
                };
            }
            if (stderr && !stderr.includes('WARNING')) {
                return {
                    success: false,
                    message: stderr
                };
            }
            return {
                success: true,
                message: `Account ${accountId} created successfully${network === 'testnet' ? ' with test tokens' : ''}!`
            };
        }
        catch (error) {
            const errorMessage = error.message || error.toString();
            if (errorMessage.includes('timeout')) {
                return {
                    success: false,
                    message: 'Account creation timed out. Please try again.'
                };
            }
            if (errorMessage.includes('near-cli-rs') || errorMessage.includes('command not found')) {
                return {
                    success: false,
                    message: 'NEAR CLI is not installed. Install with: cargo install near-cli-rs'
                };
            }
            return {
                success: false,
                message: `Failed to create account: ${errorMessage}`
            };
        }
    }
    /**
     * Check if account exists on the network using CLI
     */
    static async checkAccountExists(accountId, network = 'testnet') {
        try {
            const command = `near state ${accountId} --networkId ${network}`;
            await exec(command);
            return true;
        }
        catch (error) {
            return false;
        }
    }
    /**
     * Verify account exists (alias for checkAccountExists)
     */
    static async verifyAccountExists(accountId, network = 'testnet') {
        return this.checkAccountExists(accountId, network);
    }
    /**
     * Get account balance using CLI
     */
    static async getAccountBalance(accountId, network = 'testnet') {
        try {
            const command = `near state ${accountId} --networkId ${network}`;
            const { stdout } = await exec(command);
            // Parse the output to extract balance
            const balanceMatch = stdout.match(/amount:\s*'(\d+)'/);
            if (balanceMatch) {
                const balanceYocto = balanceMatch[1];
                const balanceNear = (parseInt(balanceYocto) / Math.pow(10, 24)).toFixed(4);
                return `${balanceNear} NEAR`;
            }
            return null;
        }
        catch (error) {
            return null;
        }
    }
    /**
     * Generate key pair using NEAR CLI (placeholder implementation)
     */
    static async generateKeysWithNearCliRs() {
        try {
            // This is a simplified implementation
            // In reality, you might use near-cli-rs to generate keys or use crypto libraries
            const crypto = require('crypto');
            const keyPair = crypto.generateKeyPairSync('ed25519');
            return {
                publicKey: keyPair.publicKey.export({ format: 'der', type: 'spki' }).toString('hex'),
                privateKey: keyPair.privateKey.export({ format: 'der', type: 'pkcs8' }).toString('hex')
            };
        }
        catch (error) {
            throw new Error('Failed to generate keys');
        }
    }
    /**
     * Derive public key from private key (placeholder implementation)
     */
    static async derivePublicKeyFromPrivate(privateKey, accountId, network) {
        try {
            // This is a placeholder implementation
            // In a real scenario, you'd use proper cryptographic libraries
            return 'ed25519:' + privateKey.substring(0, 64);
        }
        catch (error) {
            throw new Error('Failed to derive public key');
        }
    }
    /**
     * Validate account ID format based on network
     */
    static validateAccountId(accountId, network) {
        if (!accountId) {
            return { isValid: false, error: 'Account ID is required' };
        }
        // Remove whitespace
        accountId = accountId.trim();
        if (network === 'testnet') {
            if (!accountId.endsWith('.testnet')) {
                return { isValid: false, error: 'Testnet accounts must end with .testnet' };
            }
        }
        else if (network === 'mainnet') {
            if (!accountId.endsWith('.near')) {
                return { isValid: false, error: 'Mainnet accounts must end with .near' };
            }
        }
        else if (network === 'sandbox') {
            if (!accountId.includes('.test.')) {
                return { isValid: false, error: 'Sandbox accounts must include .test.' };
            }
        }
        // Check for invalid characters
        const validPattern = /^[a-z0-9._-]+$/;
        if (!validPattern.test(accountId)) {
            return { isValid: false, error: 'Account ID contains invalid characters' };
        }
        // Check length constraints
        if (accountId.length < 2 || accountId.length > 64) {
            return { isValid: false, error: 'Account ID must be between 2 and 64 characters' };
        }
        return { isValid: true };
    }
    /**
     * Show installation instructions for NEAR CLI (required)
     */
    static async showInstallInstructions() {
        const choice = await vscode.window.showErrorMessage('NEAR CLI (near-cli-rs) is required for account creation.', 'Install Instructions', 'Install with Cargo');
        if (choice === 'Install Instructions') {
            vscode.env.openExternal(vscode.Uri.parse('https://github.com/near/near-cli-rs#installation'));
        }
        else if (choice === 'Install with Cargo') {
            const terminal = vscode.window.createTerminal('NEAR CLI Installation');
            terminal.sendText('cargo install near-cli-rs');
            terminal.show();
        }
    }
    /**
     * Format account ID with network suffix if needed
     */
    static formatAccountId(accountId, network) {
        accountId = accountId.trim();
        if (network === 'testnet' && !accountId.includes('.')) {
            return `${accountId}.testnet`;
        }
        else if (network === 'mainnet' && !accountId.includes('.')) {
            return `${accountId}.near`;
        }
        return accountId;
    }
    /**
     * Get the default credentials path for an account
     */
    static getCredentialsPath(accountId, network) {
        return path.join(os.homedir(), '.near-credentials', network, `${accountId}.json`);
    }
    /**
     * Check if account credentials exist locally
     */
    static async hasLocalCredentials(accountId, network) {
        try {
            const credPath = this.getCredentialsPath(accountId, network);
            await fs.access(credPath);
            return true;
        }
        catch (error) {
            return false;
        }
    }
    /**
     * List all local accounts for a network
     */
    static async getLocalAccounts(network) {
        try {
            const credDir = path.join(os.homedir(), '.near-credentials', network);
            const files = await fs.readdir(credDir);
            return files
                .filter((file) => file.endsWith('.json'))
                .map((file) => file.replace('.json', ''));
        }
        catch (error) {
            return [];
        }
    }
}
exports.NearCliUtils = NearCliUtils;
//# sourceMappingURL=nearCliUtils.js.map