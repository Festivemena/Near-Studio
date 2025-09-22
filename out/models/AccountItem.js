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
exports.AccountItem = void 0;
const vscode = __importStar(require("vscode"));
class AccountItem extends vscode.TreeItem {
    constructor(label, version, collapsibleState, contextValue, network, isActive = false) {
        super(label, collapsibleState);
        this.label = label;
        this.version = version;
        this.collapsibleState = collapsibleState;
        this.contextValue = contextValue;
        this.network = network;
        this.isActive = isActive;
        this.tooltip = `${this.label} - ${this.version}`;
        this.description = this.version;
        this.setupItemAppearance();
        this.setupCommands();
    }
    setupItemAppearance() {
        if (this.contextValue === 'account') {
            if (this.isActive) {
                this.iconPath = new vscode.ThemeIcon('account', new vscode.ThemeColor('charts.green'));
                this.description = `${this.version} (Active)`;
            }
            else {
                this.iconPath = new vscode.ThemeIcon('account');
            }
        }
        else if (this.contextValue === 'create-wallet') {
            this.iconPath = new vscode.ThemeIcon('add', new vscode.ThemeColor('charts.blue'));
        }
        else if (this.contextValue === 'import-wallet') {
            this.iconPath = new vscode.ThemeIcon('folder-opened', new vscode.ThemeColor('charts.purple'));
        }
        else {
            this.iconPath = new vscode.ThemeIcon('warning');
        }
    }
    setupCommands() {
        if (this.contextValue === 'create-wallet' || this.contextValue === 'import-wallet') {
            this.command = {
                command: this.contextValue === 'create-wallet' ? 'near-studio.createWallet' : 'near-studio.importWallet',
                title: this.label,
                arguments: [this.network]
            };
        }
    }
}
exports.AccountItem = AccountItem;
//# sourceMappingURL=AccountItem.js.map