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
exports.CredentialsService = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const vscode = __importStar(require("vscode"));
class CredentialsService {
    async saveNearCliCredentials(accountId, network, keyPair) {
        const credentialsPath = this.getNearCliCredentialsPath(accountId, network);
        const credentialsDir = path.dirname(credentialsPath);
        if (!fs.existsSync(credentialsDir)) {
            fs.mkdirSync(credentialsDir, { recursive: true });
        }
        const credentials = {
            account_id: accountId,
            public_key: keyPair.publicKey,
            private_key: keyPair.privateKey
        };
        fs.writeFileSync(credentialsPath, JSON.stringify(credentials, null, 2));
    }
    getNearCliCredentialsPath(accountId, network) {
        const homeDir = require('os').homedir();
        return path.join(homeDir, '.near-credentials', network, `${accountId}.json`);
    }
    async saveAccount(account) {
        const config = vscode.workspace.getConfiguration('nearExtension');
        const accounts = config.get('accounts') || {};
        accounts[account.id] = account;
        await config.update('accounts', accounts, vscode.ConfigurationTarget.Global);
    }
    async loadStoredAccounts() {
        const config = vscode.workspace.getConfiguration('nearExtension');
        return config.get('accounts') || {};
    }
    async getActiveAccountInfo() {
        const config = vscode.workspace.getConfiguration('nearExtension');
        return {
            accountId: config.get('accountId'),
            network: config.get('network', 'testnet')
        };
    }
    async updateActiveAccount(accountId, network) {
        const config = vscode.workspace.getConfiguration('nearExtension');
        await config.update('accountId', accountId, vscode.ConfigurationTarget.Workspace);
        await config.update('network', network, vscode.ConfigurationTarget.Workspace);
    }
    async removeAccount(accountId) {
        const config = vscode.workspace.getConfiguration('nearExtension');
        const accounts = config.get('accounts') || {};
        delete accounts[accountId];
        await config.update('accounts', accounts, vscode.ConfigurationTarget.Global);
    }
    loadCredentialsFromFile(filePath) {
        if (fs.existsSync(filePath)) {
            const credentials = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            return {
                privateKey: credentials.private_key,
                publicKey: credentials.public_key
            };
        }
        throw new Error(`Credentials not found at: ${filePath}`);
    }
}
exports.CredentialsService = CredentialsService;
//# sourceMappingURL=CredentialsService.js.map