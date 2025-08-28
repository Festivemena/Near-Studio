// src/commands/contractCommands.ts

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export function registerContractCommands(): vscode.Disposable[] {
    return [
        vscode.commands.registerCommand('nearExtension.createContract', createContract),
        vscode.commands.registerCommand('nearExtension.createRustContract', () => createSpecificContract('rust')),
        vscode.commands.registerCommand('nearExtension.createJSContract', () => createSpecificContract('javascript')),
        vscode.commands.registerCommand('nearExtension.createTSContract', () => createSpecificContract('typescript')),
        vscode.commands.registerCommand('nearExtension.buildContract', buildContract),
        vscode.commands.registerCommand('nearExtension.deployContract', deployContract),
        vscode.commands.registerCommand('nearExtension.testContract', testContract),
        vscode.commands.registerCommand('nearExtension.optimizeContract', optimizeContract),
        vscode.commands.registerCommand('nearExtension.generateBindings', generateBindings)
    ];
}

async function createContract() {
    const templates = [
        { name: 'Rust Contract', language: 'rust', description: 'High-performance contract with near-sdk-rs' },
        { name: 'JavaScript Contract', language: 'javascript', description: 'Simple contract with near-sdk-js' },
        { name: 'TypeScript Contract', language: 'typescript', description: 'Type-safe contract with near-sdk-js' }
    ];

    const selected = await vscode.window.showQuickPick(
        templates.map(t => ({ label: t.name, description: t.description, template: t })),
        { placeHolder: 'Select contract type' }
    );
    if (!selected) return;
    await createSpecificContract(selected.template.language as 'rust' | 'javascript' | 'typescript');

}

async function createSpecificContract(language: 'rust' | 'javascript' | 'typescript') {
    const contractName = await vscode.window.showInputBox({
        prompt: `Enter ${language} contract name`,
        validateInput: (value) => {
            if (!value) return 'Contract name is required';
            if (!/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(value)) {
                return 'Contract name must start with a letter and contain only letters, numbers, underscores, and hyphens';
            }
            return null;
        }
    });
    if (!contractName) return;

    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
        vscode.window.showErrorMessage('Please open a workspace first');
        return;
    }

    try {
        await createContractFiles(workspaceFolder.uri.fsPath, contractName, language);
        vscode.window.showInformationMessage(`${language} contract "${contractName}" created successfully!`);

        const mainFile = getMainContractFile(workspaceFolder.uri.fsPath, contractName, language);
        if (mainFile) {
            const document = await vscode.workspace.openTextDocument(mainFile);
            await vscode.window.showTextDocument(document);
        }
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to create contract: ${error}`);
    }
}

function getMainContractFile(workspacePath: string, contractName: string, language: string): string | null {
    const contractDir = path.join(workspacePath, contractName);
    switch (language) {
        case 'rust':
            return path.join(contractDir, 'src', 'lib.rs');
        case 'javascript':
            return path.join(contractDir, 'src', 'index.js');
        case 'typescript':
            return path.join(contractDir, 'src', 'index.ts');
        default:
            return null;
    }
}

async function createContractFiles(workspacePath: string, contractName: string, language: string) {
    const contractDir = path.join(workspacePath, contractName);
    if (!fs.existsSync(contractDir)) fs.mkdirSync(contractDir, { recursive: true });

    switch (language) {
        case 'rust':
            await createRustContract(contractDir, contractName);
            break;
        case 'javascript':
            await createJSContract(contractDir, contractName, false);
            break;
        case 'typescript':
            await createJSContract(contractDir, contractName, true);
            break;
    }
}

async function createRustContract(contractDir: string, contractName: string) {
    // Create Cargo.toml with minimal template and optimizations
    const cargoToml = `[package]
name = "${contractName.replace(/-/g, '_')}"
version = "0.1.0"
edition = "2021"
authors = ["Your Name <your.email@example.com>"]
license = "MIT OR Apache-2.0"

[lib]
crate-type = ["cdylib"]

[dependencies]
near-sdk = "4.1.1"

[profile.release]
opt-level = "z"
lto = true
panic = "abort"
`;

    fs.writeFileSync(path.join(contractDir, 'Cargo.toml'), cargoToml);

    // Create src/lib.rs with basic contract template
    const srcDir = path.join(contractDir, 'src');
    if (!fs.existsSync(srcDir)) fs.mkdirSync(srcDir);

    const libRs = `use near_sdk::borsh::{self, BorshDeserialize, BorshSerialize};
use near_sdk::{env, near_bindgen, AccountId, PanicOnDefault};

#[near_bindgen]
#[derive(BorshDeserialize, BorshSerialize, PanicOnDefault)]
pub struct Contract {
    pub owner: AccountId,
}

#[near_bindgen]
impl Contract {
    #[init]
    pub fn new(owner: AccountId) -> Self {
        Self { owner }
    }

    pub fn hello(&self, name: String) -> String {
        format!("Hello, {}!", name)
    }
}
`;

    fs.writeFileSync(path.join(srcDir, 'lib.rs'), libRs);

    // You can create more files such as rust-toolchain.toml, build scripts, gitignore as needed
}

async function createJSContract(contractDir: string, contractName: string, isTS: boolean) {
    // Create package.json
    const packageJson = {
        name: contractName,
        version: "1.0.0",
        scripts: {
            build: "near-sdk-js build src/index." + (isTS ? "ts" : "js") + " build/" + contractName + ".wasm",
            test: "jest"
        },
        dependencies: {
            "near-sdk-js": "^1.0.0"
        },
        devDependencies: isTS ? {
            typescript: "^4.x",
            jest: "^29.x",
            "@types/jest": "^29.x",
            "ts-jest": "^29.x"
        } : {
            jest: "^29.x"
        }
    };
    fs.writeFileSync(path.join(contractDir, 'package.json'), JSON.stringify(packageJson, null, 2));

    // Create src and main contract file
    const srcDir = path.join(contractDir, 'src');
    if (!fs.existsSync(srcDir)) fs.mkdirSync(srcDir);

    const contractCode = isTS ? `
import { NearBindgen, near, call, view, initialize, UnorderedMap } from 'near-sdk-js';

@NearBindgen({})
export class Contract {
    owner: string = '';

    @initialize({})
    init({ owner }: { owner?: string }): void {
        this.owner = owner || near.signerAccountId();
    }

    @view({})
    hello({ name }: { name: string }): string {
        return \`Hello, \${name}!\`;
    }
}
` : `
const { NearBindgen, near, call, view, initialize, UnorderedMap } = require('near-sdk-js');

@NearBindgen({})
class Contract {
    constructor() {
        this.owner = '';
    }

    @initialize({})
    init({ owner }) {
        this.owner = owner || near.signerAccountId();
    }

    @view({})
    hello({ name }) {
        return \`Hello, \${name}!\`;
    }
}

module.exports = { Contract };
`;

    fs.writeFileSync(path.join(srcDir, `index.${isTS ? 'ts' : 'js'}`), contractCode);
}

async function buildContract() {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
        vscode.window.showErrorMessage('Open a workspace folder first');
        return;
    }

    const terminal = vscode.window.createTerminal('Near Build');
    // Adjust command as per detected project type - simply example here
    terminal.sendText(`./build.sh`);
    terminal.show();

    vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: 'Building contract...',
        cancellable: false
    }, async () => {
        await new Promise(resolve => setTimeout(resolve, 4000));
    });
}

async function deployContract() {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
        vscode.window.showErrorMessage('Open a workspace folder first');
        return;
    }
    const config = vscode.workspace.getConfiguration('nearExtension');
    const accountId = config.get('accountId') || await vscode.window.showInputBox({prompt: 'Enter NEAR account id for deploy'});
    if (!accountId) return;

    const terminal = vscode.window.createTerminal('Near Deploy');
    terminal.sendText(`near deploy --wasmFile build/${path.basename(workspaceFolder.uri.fsPath)}.wasm --accountId ${accountId}`);
    terminal.show();
}

async function testContract() {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
        vscode.window.showErrorMessage('Open a workspace folder first');
        return;
    }

    const terminal = vscode.window.createTerminal('Near Test');
    terminal.sendText(`npm test || cargo test`);
    terminal.show();
}

async function optimizeContract() {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
        vscode.window.showErrorMessage('Open a workspace folder first');
        return;
    }

    const optimizePath = path.join(workspaceFolder.uri.fsPath, 'optimize.sh');
    const terminal = vscode.window.createTerminal('Near Optimize');

    if (fs.existsSync(optimizePath)) {
        terminal.sendText(`./optimize.sh`);
    } else {
        terminal.sendText('cargo build --target wasm32-unknown-unknown --release');
    }

    terminal.show();
}

async function generateBindings() {
    vscode.window.showInformationMessage('Binding generation feature coming soon!');
}
