import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { Contract, ContractType, ContractStatus } from '../models/Contract';
import { fileExists } from '../utils/fileUtils';

export class ContractService {
    private readonly contractFiles = ['Cargo.toml', 'package.json', 'asconfig.json'];

    public findContracts(): Contract[] {
        const contracts: Contract[] = [];

        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) return contracts;

        for (const folder of workspaceFolders) {
            this.scanFolderForContracts(folder.uri.fsPath, contracts);
            this.scanSubfolders(folder.uri.fsPath, contracts);
        }

        return contracts;
    }

    private scanFolderForContracts(folderPath: string, contracts: Contract[]) {
        const rustPath = path.join(folderPath, 'Cargo.toml');
        if (fileExists(rustPath)) {
            try {
                const content = fs.readFileSync(rustPath, 'utf8');
                if(content.includes('near-sdk') || content.includes('wasm32')){
                    contracts.push(this.createContract(folderPath, 'Rust'));
                }
            } catch {
                // ignore read errors
            }
        }

        const jsPath = path.join(folderPath, 'package.json');
        if (fileExists(jsPath)) {
            try {
                const pkg = JSON.parse(fs.readFileSync(jsPath, 'utf8'));
                if (pkg?.dependencies?.['near-sdk-js'] ||
                    pkg?.devDependencies?.['near-sdk-js'] ||
                    pkg?.scripts?.build?.includes('near') ||
                    pkg?.name?.includes('near')) {
                    contracts.push(this.createContract(folderPath, 'JavaScript/TypeScript'));
                }
            } catch {
                // ignore parse errors
            }
        }

        const asPath = path.join(folderPath, 'asconfig.json');
        if (fileExists(asPath)) {
            contracts.push(this.createContract(folderPath, 'AssemblyScript'));
        }
    }

    private scanSubfolders(rootPath: string, contracts: Contract[]) {
        try {
            const items = fs.readdirSync(rootPath);
            for (const item of items) {
                const itemPath = path.join(rootPath, item);
                if (fs.statSync(itemPath).isDirectory() && !item.startsWith('.')) {
                    this.scanFolderForContracts(itemPath, contracts);
                }
            }
        } catch {
            // ignore read errors
        }
    }

    private createContract(folderPath: string, type: ContractType): Contract {
        return {
            name: path.basename(folderPath),
            path: folderPath,
            type,
            status: this.getContractStatus(folderPath, type)
        };
    }

    private getContractStatus(contractPath: string, type: ContractType): ContractStatus {
        const buildDirs: Record<ContractType, string> = {
            'Rust': path.join(contractPath, 'target', 'wasm32-unknown-unknown', 'release'),
            'JavaScript/TypeScript': path.join(contractPath, 'build'),
            'AssemblyScript': path.join(contractPath, 'build')
        };

        const buildPath = buildDirs[type];
        if (buildPath && fileExists(buildPath)) {
            const files = fs.readdirSync(buildPath);
            if (files.some(f => f.endsWith('.wasm'))) return 'Built';
        }
        return 'Not Built';
    }
}
