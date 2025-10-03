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
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.AccountItem = void 0;
const vscode = __importStar(require("vscode"));
class AccountItem extends vscode.TreeItem {
    constructor(accountId, balance, collapsibleState, itemType, network, isActive = false) {
        super(accountId, collapsibleState);
        this.accountId = accountId;
        this.balance = balance;
        this.collapsibleState = collapsibleState;
        this.itemType = itemType;
        this.network = network;
        this.isActive = isActive;
        this.tooltip = this.getTooltip();
        this.description = balance;
        this.contextValue = itemType;
        // Set icon based on type
        if (itemType === 'account') {
            this.iconPath = new vscode.ThemeIcon(isActive ? 'account' : 'circle-outline', isActive ? new vscode.ThemeColor('charts.green') : undefined);
            // Add command to switch account on click
            this.command = {
                command: 'near-studio.switchAccount',
                title: 'Switch to Account',
                arguments: [accountId, network]
            };
        }
        else if (itemType === 'create-wallet') {
            this.iconPath = new vscode.ThemeIcon('add');
            this.command = {
                command: 'near-studio.createWallet',
                title: 'Create Wallet',
                arguments: [network]
            };
        }
        else if (itemType === 'import-wallet') {
            this.iconPath = new vscode.ThemeIcon('archive');
            this.command = {
                command: 'near-studio.importWallet',
                title: 'Import Wallet',
                arguments: [network]
            };
        }
        else if (itemType === 'refresh-accounts') {
            this.iconPath = new vscode.ThemeIcon('refresh');
            this.command = {
                command: 'near-studio.refreshAccounts',
                title: 'Refresh Accounts'
            };
        }
    }
    getTooltip() {
        if (this.itemType === 'account') {
            return `${this.accountId} on ${this.network}\nBalance: ${this.balance}${this.isActive ? '\n✅ Active' : ''}`;
        }
        else if (this.itemType === 'create-wallet') {
            return `Create a new ${this.network} wallet`;
        }
        else if (this.itemType === 'import-wallet') {
            return `Import an existing ${this.network} wallet`;
        }
        else if (this.itemType === 'refresh-accounts') {
            return 'Refresh accounts and scan .near-credentials directory';
        }
        return '';
    }
}
exports.AccountItem = AccountItem;
//# sourceMappingURL=AccountItem.js.map