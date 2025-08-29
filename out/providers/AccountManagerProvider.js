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
exports.AccountManagerProvider = void 0;
const vscode = __importStar(require("vscode"));
const models_1 = require("../models");
const services_1 = require("../services");
class AccountManagerProvider {
    constructor() {
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
        this.accounts = new Map();
        this.activeAccount = null;
        this.balanceUpdateInterval = null;
        // Service instances
        this.accountService = new services_1.AccountService();
        this.balanceService = new services_1.BalanceService();
        this.walletService = new services_1.WalletService();
        this.loadAccounts();
        this.startBalanceUpdates();
    }
    refresh() {
        this.loadAccounts();
        this._onDidChangeTreeData.fire();
    }
    getTreeItem(element) {
        return element;
    }
    getChildren(element) {
        if (!element) {
            return this.getRootLevelItems();
        }
        else if (element instanceof models_1.NetworkItem) {
            return this.getNetworkLevelItems(element);
        }
        return Promise.resolve([]);
    }
    async getRootLevelItems() {
        const networks = ['testnet', 'mainnet', 'sandbox'];
        const items = [];
        for (const network of networks) {
            const networkAccounts = this.accounts.get(network) || [];
            items.push(new models_1.NetworkItem(network, networkAccounts.length));
        }
        // Add quick action items if no active account
        if (!this.activeAccount) {
            items.push(new models_1.AccountItem('Create New Wallet', '+ Create testnet/mainnet wallet', vscode.TreeItemCollapsibleState.None, 'create-wallet', 'testnet'));
            items.push(new models_1.AccountItem('Import Existing Wallet', '+ Add existing NEAR account', vscode.TreeItemCollapsibleState.None, 'import-wallet', 'testnet'));
        }
        return items;
    }
    async getNetworkLevelItems(element) {
        const networkAccounts = this.accounts.get(element.network) || [];
        const accountItems = networkAccounts.map(account => new models_1.AccountItem(account.id, account.balance || 'Loading...', vscode.TreeItemCollapsibleState.None, 'account', account.network, account.isActive));
        // Add create/import options for each network
        accountItems.push(new models_1.AccountItem(`Create ${element.network} wallet`, `+ New ${element.network} account`, vscode.TreeItemCollapsibleState.None, 'create-wallet', element.network));
        accountItems.push(new models_1.AccountItem(`Import ${element.network} wallet`, `+ Existing ${element.network} account`, vscode.TreeItemCollapsibleState.None, 'import-wallet', element.network));
        return accountItems;
    }
    async loadAccounts() {
        try {
            const result = await this.accountService.loadAccounts();
            this.accounts = result.accounts;
            this.activeAccount = result.activeAccount;
        }
        catch (error) {
            console.error('Error loading accounts:', error);
            vscode.window.showErrorMessage(`Failed to load accounts: ${error}`);
        }
    }
    startBalanceUpdates() {
        this.balanceUpdateInterval = setInterval(async () => {
            try {
                await this.balanceService.loadBalancesForAccounts(this.accounts);
                this._onDidChangeTreeData.fire();
            }
            catch (error) {
                console.error('Error updating balances:', error);
            }
        }, 30000);
    }
    stopBalanceUpdates() {
        if (this.balanceUpdateInterval) {
            clearInterval(this.balanceUpdateInterval);
            this.balanceUpdateInterval = null;
        }
    }
    // Public API methods that delegate to services
    async createWallet(network) {
        await this.walletService.createWallet(network, this.accounts, this.refresh.bind(this));
    }
    async importWallet(network) {
        await this.walletService.importWallet(network, this.accounts, this.refresh.bind(this));
    }
    async switchToAccount(accountId, network) {
        const newActiveAccount = await this.accountService.switchToAccount(accountId, network, this.accounts);
        if (newActiveAccount) {
            this.activeAccount = newActiveAccount;
        }
        this.refresh();
    }
    async disconnectAccount(accountId, network) {
        const success = await this.accountService.disconnectAccount(accountId, network);
        if (success) {
            this.refresh();
        }
    }
    async copyAccountKey(accountId, network) {
        await this.accountService.copyAccountKey(accountId, network, this.accounts);
    }
    dispose() {
        this.stopBalanceUpdates();
    }
}
exports.AccountManagerProvider = AccountManagerProvider;
//# sourceMappingURL=AccountManagerProvider.js.map