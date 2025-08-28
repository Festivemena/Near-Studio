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
exports.AccountService = void 0;
const vscode = __importStar(require("vscode"));
const CredentialsService_1 = require("./CredentialsService");
const BalanceService_1 = require("./BalanceService");
class AccountService {
    constructor() {
        this.credentialsService = new CredentialsService_1.CredentialsService();
        this.balanceService = new BalanceService_1.BalanceService();
    }
    async loadAccounts() {
        try {
            const storedAccounts = await this.credentialsService.loadStoredAccounts();
            const { accountId: activeAccountId, network: activeNetwork } = await this.credentialsService.getActiveAccountInfo();
            const accounts = new Map();
            let activeAccount = null;
            // Initialize network maps
            accounts.set('testnet', []);
            accounts.set('mainnet', []);
            accounts.set('sandbox', []);
            // Load stored accounts
            for (const [accountId, accountData] of Object.entries(storedAccounts)) {
                const rawAccount = accountData;
                const account = {
                    id: rawAccount.id || accountId,
                    network: rawAccount.network || 'testnet',
                    balance: rawAccount.balance,
                    keyPath: rawAccount.keyPath,
                    publicKey: rawAccount.publicKey,
                    privateKey: rawAccount.privateKey,
                    isActive: false
                };
                // Set active status
                account.isActive = (accountId === activeAccountId && account.network === activeNetwork);
                if (account.isActive) {
                    activeAccount = account;
                }
                const networkAccounts = accounts.get(account.network) || [];
                networkAccounts.push(account);
                accounts.set(account.network, networkAccounts);
            }
            // Load balances for all accounts
            await this.balanceService.loadBalancesForAccounts(accounts);
            return { accounts, activeAccount };
        }
        catch (error) {
            console.error('Error loading accounts:', error);
            vscode.window.showErrorMessage(`Failed to load accounts: ${error}`);
            return { accounts: new Map(), activeAccount: null };
        }
    }
    async switchToAccount(accountId, network, accounts) {
        try {
            await this.credentialsService.updateActiveAccount(accountId, network);
            // Update internal state
            this.clearActiveFlags(accounts);
            const networkAccounts = accounts.get(network) || [];
            const account = networkAccounts.find(acc => acc.id === accountId);
            if (account) {
                account.isActive = true;
                return account;
            }
            vscode.window.showInformationMessage(`✅ Switched to ${accountId} on ${network}`);
            return account || null;
        }
        catch (error) {
            vscode.window.showErrorMessage(`Failed to switch account: ${error}`);
            return null;
        }
    }
    clearActiveFlags(accounts) {
        for (const [_, accountList] of accounts.entries()) {
            accountList.forEach(acc => acc.isActive = false);
        }
    }
    async disconnectAccount(accountId, network) {
        const confirm = await vscode.window.showWarningMessage(`Disconnect ${accountId}? This will remove it from VS Code.`, 'Disconnect', 'Cancel');
        if (confirm === 'Disconnect') {
            try {
                await this.credentialsService.removeAccount(accountId);
                // If this was the active account, clear it
                const { accountId: activeAccountId } = await this.credentialsService.getActiveAccountInfo();
                if (activeAccountId === accountId) {
                    await this.credentialsService.updateActiveAccount('', 'testnet');
                }
                vscode.window.showInformationMessage(`Disconnected ${accountId}`);
                return true;
            }
            catch (error) {
                vscode.window.showErrorMessage(`Failed to disconnect account: ${error}`);
                return false;
            }
        }
        return false;
    }
    async copyAccountKey(accountId, network, accounts) {
        const networkAccounts = accounts.get(network) || [];
        const account = networkAccounts.find(acc => acc.id === accountId);
        if (!account || !account.privateKey) {
            vscode.window.showErrorMessage('Private key not available for this account');
            return;
        }
        await vscode.env.clipboard.writeText(account.privateKey);
        vscode.window.showInformationMessage('Private key copied to clipboard');
    }
}
exports.AccountService = AccountService;
//# sourceMappingURL=AccountService.js.map