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
exports.ContractService = void 0;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const fileUtils_1 = require("../utils/fileUtils");
class ContractService {
    constructor() {
        this.contractFiles = ['Cargo.toml', 'package.json', 'asconfig.json'];
    }
    findContracts() {
        const contracts = [];
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders)
            return contracts;
        for (const folder of workspaceFolders) {
            this.scanFolderForContracts(folder.uri.fsPath, contracts);
            this.scanSubfolders(folder.uri.fsPath, contracts);
        }
        return contracts;
    }
    scanFolderForContracts(folderPath, contracts) {
        const rustPath = path.join(folderPath, 'Cargo.toml');
        if ((0, fileUtils_1.fileExists)(rustPath)) {
            try {
                const content = fs.readFileSync(rustPath, 'utf8');
                if (content.includes('near-sdk') || content.includes('wasm32')) {
                    contracts.push(this.createContract(folderPath, 'Rust'));
                }
            }
            catch {
                // ignore read errors
            }
        }
        const jsPath = path.join(folderPath, 'package.json');
        if ((0, fileUtils_1.fileExists)(jsPath)) {
            try {
                const pkg = JSON.parse(fs.readFileSync(jsPath, 'utf8'));
                if (pkg?.dependencies?.['near-sdk-js'] ||
                    pkg?.devDependencies?.['near-sdk-js'] ||
                    pkg?.scripts?.build?.includes('near') ||
                    pkg?.name?.includes('near')) {
                    contracts.push(this.createContract(folderPath, 'JavaScript/TypeScript'));
                }
            }
            catch {
                // ignore parse errors
            }
        }
        const asPath = path.join(folderPath, 'asconfig.json');
        if ((0, fileUtils_1.fileExists)(asPath)) {
            contracts.push(this.createContract(folderPath, 'AssemblyScript'));
        }
    }
    scanSubfolders(rootPath, contracts) {
        try {
            const items = fs.readdirSync(rootPath);
            for (const item of items) {
                const itemPath = path.join(rootPath, item);
                if (fs.statSync(itemPath).isDirectory() && !item.startsWith('.')) {
                    this.scanFolderForContracts(itemPath, contracts);
                }
            }
        }
        catch {
            // ignore read errors
        }
    }
    createContract(folderPath, type) {
        return {
            name: path.basename(folderPath),
            path: folderPath,
            type,
            status: this.getContractStatus(folderPath, type)
        };
    }
    getContractStatus(contractPath, type) {
        const buildDirs = {
            'Rust': path.join(contractPath, 'target', 'wasm32-unknown-unknown', 'release'),
            'JavaScript/TypeScript': path.join(contractPath, 'build'),
            'AssemblyScript': path.join(contractPath, 'build')
        };
        const buildPath = buildDirs[type];
        if (buildPath && (0, fileUtils_1.fileExists)(buildPath)) {
            const files = fs.readdirSync(buildPath);
            if (files.some(f => f.endsWith('.wasm')))
                return 'Built';
        }
        return 'Not Built';
    }
}
exports.ContractService = ContractService;
//# sourceMappingURL=ContractService.js.map