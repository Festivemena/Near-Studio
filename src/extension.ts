import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as https from 'https';
import { ProjectExplorerProvider } from './providers/ProjectExplorerProvider';
import { ContractManagerProvider } from './providers/ContractManagerProvider';
import { AccountManagerProvider } from './providers/AccountManagerProvider';

const execAsync = promisify(exec);

interface ContractTemplate {
    name: string;
    language: 'rust' | 'javascript' | 'typescript';
    description: string;
}

export function activate(context: vscode.ExtensionContext) {
    console.log('Near Smart Contracts extension is now active!');

    // Register webview providers
    const projectExplorerProvider = new ProjectExplorerProvider(context.extensionUri);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(
            'near-studio.projectExplorer',  // Must match package.json
            projectExplorerProvider
        )
    );

    const contractManagerProvider = new ContractManagerProvider(context.extensionUri);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(
            'near-studio.contractManager',
            contractManagerProvider
        )
    );
    
    // Register disposal
    context.subscriptions.push(contractManagerProvider);

       // Register enhanced AccountManagerProvider
    const accountManagerProvider = new AccountManagerProvider();
    context.subscriptions.push(
        vscode.window.registerTreeDataProvider(
            'near-studio.accountManager',
            accountManagerProvider
        )
    );
    context.subscriptions.push(accountManagerProvider);

    // Register wallet management commands
    context.subscriptions.push(
        // Enhanced account management commands
        vscode.commands.registerCommand('near-studio.refreshAccounts', () => {
            accountManagerProvider.refresh();
        }),
        
        vscode.commands.registerCommand('near-studio.addAccount', async () => {
            const options = [
                { label: '🚀 Create New Wallet', description: 'Create a brand new NEAR wallet' },
                { label: '📥 Import Existing Wallet', description: 'Import an existing NEAR account' }
            ];
            
            const selected = await vscode.window.showQuickPick(options, {
                placeHolder: 'Choose how to add an account'
            });
            
            if (selected?.label.includes('Create')) {
                vscode.commands.executeCommand('near-studio.createWallet');
            } else if (selected?.label.includes('Import')) {
                vscode.commands.executeCommand('near-studio.importWallet');
            }
        }),

        // New wallet management commands
        vscode.commands.registerCommand('near-studio.createWallet', async (network?: string) => {
            if (!network) {
                const networkOptions = [
                    { label: 'Testnet', description: 'Create testnet account (free test tokens)', value: 'testnet' },
                    { label: 'Mainnet', description: 'Create mainnet account (real NEAR tokens)', value: 'mainnet' },
                    { label: 'Sandbox', description: 'Create local sandbox account', value: 'sandbox' }
                ];
                
                const selected = await vscode.window.showQuickPick(networkOptions, {
                    placeHolder: 'Select network for new wallet'
                });
                
                if (!selected) return;
                network = selected.value;
            }
            
            await accountManagerProvider.createWallet(network as any);
        }),

        vscode.commands.registerCommand('near-studio.importWallet', async (network?: string) => {
            if (!network) {
                const networkOptions = [
                    { label: 'Testnet', description: 'Import testnet account', value: 'testnet' },
                    { label: 'Mainnet', description: 'Import mainnet account', value: 'mainnet' },
                    { label: 'Sandbox', description: 'Import sandbox account', value: 'sandbox' }
                ];
                
                const selected = await vscode.window.showQuickPick(networkOptions, {
                    placeHolder: 'Select network for account to import'
                });
                
                if (!selected) return;
                network = selected.value;
            }
            
            await accountManagerProvider.importWallet(network as any);
        }),

        vscode.commands.registerCommand('near-studio.switchAccount', async (accountItem?) => {
            if (accountItem && accountItem.contextValue === 'account') {
                await accountManagerProvider.switchToAccount(accountItem.label, accountItem.network);
            } else {
                // Show account switcher
                await showAccountSwitcher(accountManagerProvider);
            }
        }),

        vscode.commands.registerCommand('near-studio.disconnectAccount', async (accountItem) => {
            if (accountItem && accountItem.contextValue === 'account') {
                await accountManagerProvider.disconnectAccount(accountItem.label, accountItem.network);
            }
        }),

        vscode.commands.registerCommand('near-studio.copyAccountKey', async (accountItem) => {
            if (accountItem && accountItem.contextValue === 'account') {
                await accountManagerProvider.copyAccountKey(accountItem.label, accountItem.network);
            }
        }),

        vscode.commands.registerCommand('near-studio.switchNetwork', async (accountItem) => {
            if (accountItem && accountItem.contextValue === 'account') {
                const networkOptions = [
                    { label: 'Testnet', value: 'testnet' },
                    { label: 'Mainnet', value: 'mainnet' },
                    { label: 'Sandbox', value: 'sandbox' }
                ];
                
                const selected = await vscode.window.showQuickPick(networkOptions, {
                    placeHolder: `Switch ${accountItem.label} to different network`
                });
                
                if (selected) {
                    await accountManagerProvider.switchToAccount(accountItem.label, selected.value as any);
                }
            }
        }),

        vscode.commands.registerCommand('near-studio.fundTestnetAccount', async (accountItem) => {
            if (accountItem && accountItem.contextValue === 'account' && accountItem.network === 'testnet') {
                await vscode.window.withProgress({
                    location: vscode.ProgressLocation.Notification,
                    title: `Funding ${accountItem.label}...`,
                    cancellable: false
                }, async () => {
                    try {
                        // Request testnet tokens
                        const response = await fetch('https://helper.testnet.near.org/account', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                newAccountId: accountItem.label,
                                newAccountPublicKey: 'ed25519:placeholder'
                            })
                        });

                        if (response.ok) {
                            vscode.window.showInformationMessage(`✅ ${accountItem.label} funded with test tokens!`);
                            accountManagerProvider.refresh();
                        } else {
                            throw new Error('Funding request failed');
                        }
                    } catch (error) {
                        // Fallback to NEAR CLI funding
                        try {
                            await execAsync(`near send testnet ${accountItem.label} 10 --networkId testnet`);
                            vscode.window.showInformationMessage(`✅ ${accountItem.label} funded with test tokens!`);
                            accountManagerProvider.refresh();
                        } catch (cliError) {
                            vscode.window.showErrorMessage(`Failed to fund account: ${error}`);
                        }
                    }
                });
            }
        }),

        vscode.commands.registerCommand('near-studio.viewAccountOnExplorer', async (accountItem) => {
            if (accountItem && accountItem.contextValue === 'account') {
                const explorerUrl = accountItem.network === 'testnet' 
                    ? `https://explorer.testnet.near.org/accounts/${accountItem.label}`
                    : accountItem.network === 'mainnet'
                    ? `https://explorer.near.org/accounts/${accountItem.label}`
                    : `http://localhost:3030/accounts/${accountItem.label}`; // sandbox
                
                vscode.env.openExternal(vscode.Uri.parse(explorerUrl));
            }
        }),

        vscode.commands.registerCommand('near-studio.refreshAccountBalance', async (accountItem) => {
            if (accountItem && accountItem.contextValue === 'account') {
                await vscode.window.withProgress({
                    location: vscode.ProgressLocation.Notification,
                    title: `Refreshing balance for ${accountItem.label}...`,
                    cancellable: false
                }, async () => {
                    accountManagerProvider.refresh();
                });
            }
        }),

        // Bulk account operations
        vscode.commands.registerCommand('near-studio.exportAccounts', async () => {
            const config = vscode.workspace.getConfiguration('nearExtension');
            const accounts = config.get<any>('accounts') || {};
            
            if (Object.keys(accounts).length === 0) {
                vscode.window.showInformationMessage('No accounts to export');
                return;
            }

            // Remove sensitive data for export
            const exportData = Object.entries(accounts).reduce((acc, [id, account]: [string, any]) => {
                acc[id] = {
                    id: account.id,
                    network: account.network,
                    // Don't export private keys for security
                    publicKey: account.publicKey
                };
                return acc;
            }, {} as any);

            const exportString = JSON.stringify(exportData, null, 2);
            
            vscode.env.clipboard.writeText(exportString);
            vscode.window.showInformationMessage('Account list copied to clipboard (without private keys)');
        }),

        vscode.commands.registerCommand('near-studio.clearAllAccounts', async () => {
            const confirm = await vscode.window.showWarningMessage(
                'This will remove ALL accounts from VS Code. Are you sure?',
                { modal: true },
                'Clear All Accounts',
                'Cancel'
            );

            if (confirm === 'Clear All Accounts') {
                const config = vscode.workspace.getConfiguration('nearExtension');
                await config.update('accounts', {}, vscode.ConfigurationTarget.Global);
                await config.update('accountId', '', vscode.ConfigurationTarget.Workspace);
                
                accountManagerProvider.refresh();
                vscode.window.showInformationMessage('All accounts cleared');
            }
        })
    );


    // Register all commands
    const commands = [
        vscode.commands.registerCommand('nearExtension.createContract', createContract),
        vscode.commands.registerCommand('nearExtension.createRustContract', () => createSpecificContract('rust')),
        vscode.commands.registerCommand('nearExtension.createJSContract', () => createSpecificContract('javascript')),
        vscode.commands.registerCommand('nearExtension.createTSContract', () => createSpecificContract('typescript')),
        vscode.commands.registerCommand('nearExtension.buildContract', buildContract),
        vscode.commands.registerCommand('nearExtension.deployContract', deployContract),
        vscode.commands.registerCommand('nearExtension.testContract', testContract),
        vscode.commands.registerCommand('nearExtension.initializeProject', initializeProject),
        vscode.commands.registerCommand('nearExtension.setupRustToolchain', setupRustToolchain),
        vscode.commands.registerCommand('nearExtension.optimizeContract', optimizeContract),
        vscode.commands.registerCommand('nearExtension.generateBindings', generateBindings)
    ];

    commands.forEach(command => context.subscriptions.push(command));


    // Register task provider
    const taskProvider = vscode.tasks.registerTaskProvider('near', new NearTaskProvider());
    context.subscriptions.push(taskProvider);

    // Check for Near projects and suggest setup
    checkForNearProject();
    validateToolchains();
}

async function showAccountSwitcher(accountManagerProvider: AccountManagerProvider) {
    const config = vscode.workspace.getConfiguration('nearExtension');
    const accounts = config.get<any>('accounts') || {};
    
    const accountOptions = Object.entries(accounts).map(([id, account]: [string, any]) => ({
        label: `${id} (${account.network})`,
        description: account.balance || 'Loading...',
        detail: account.isActive ? '✅ Currently active' : '',
        accountId: id,
        network: account.network
    }));

    if (accountOptions.length === 0) {
        const action = await vscode.window.showInformationMessage(
            'No accounts configured. Would you like to add one?',
            'Create Wallet',
            'Import Wallet'
        );
        
        if (action === 'Create Wallet') {
            vscode.commands.executeCommand('near-studio.createWallet');
        } else if (action === 'Import Wallet') {
            vscode.commands.executeCommand('near-studio.importWallet');
        }
        return;
    }

    const selected = await vscode.window.showQuickPick(accountOptions, {
        placeHolder: 'Select account to switch to'
    });

    if (selected) {
        await accountManagerProvider.switchToAccount(selected.accountId, selected.network);
    }
}

async function createContract() {
    const templates: ContractTemplate[] = [
        { name: 'Rust Contract', language: 'rust', description: 'High-performance contract with near-sdk-rs' },
        { name: 'JavaScript Contract', language: 'javascript', description: 'Simple contract with near-sdk-js' },
        { name: 'TypeScript Contract', language: 'typescript', description: 'Type-safe contract with near-sdk-js' }
    ];

    const selected = await vscode.window.showQuickPick(
        templates.map(t => ({ label: t.name, description: t.description, template: t })),
        { placeHolder: 'Select contract type' }
    );

    if (!selected) return;
    await createSpecificContract(selected.template.language);
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
        
        // Open the main contract file
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
    
    if (!fs.existsSync(contractDir)) {
        fs.mkdirSync(contractDir, { recursive: true });
    }

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
    // Create Cargo.toml with optimizations
    const cargoToml = `[package]
name = "${contractName.replace(/-/g, '_')}"
version = "0.1.0"
edition = "2021"
authors = ["Your Name <your.email@example.com>"]
license = "MIT OR Apache-2.0"
repository = "https://github.com/yourusername/${contractName}"

[lib]
crate-type = ["cdylib"]

[dependencies]
near-sdk = "4.1.1"
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"

[profile.release]
codegen-units = 1
opt-level = "z"
lto = true
debug = false
panic = "abort"
overflow-checks = true

[profile.release.build-override]
opt-level = 0

[workspace]
`;

    fs.writeFileSync(path.join(contractDir, 'Cargo.toml'), cargoToml);

    // Create rust-toolchain.toml
    const rustToolchain = `[toolchain]
channel = "stable"
targets = ["wasm32-unknown-unknown"]
`;

    fs.writeFileSync(path.join(contractDir, 'rust-toolchain.toml'), rustToolchain);

    // Create src directory and lib.rs
    const srcDir = path.join(contractDir, 'src');
    if (!fs.existsSync(srcDir)) {
        fs.mkdirSync(srcDir);
    }

    const libRs = `use near_sdk::borsh::{self, BorshDeserialize, BorshSerialize};
use near_sdk::collections::UnorderedMap;
use near_sdk::{env, near_bindgen, AccountId, PanicOnDefault};
use serde::{Deserialize, Serialize};

#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize)]
#[serde(crate = "near_sdk::serde")]
pub struct ContractMetadata {
    pub version: String,
    pub owner: AccountId,
    pub created_at: u64,
}

#[near_bindgen]
#[derive(BorshDeserialize, BorshSerialize, PanicOnDefault)]
pub struct ${capitalizeFirstLetter(contractName.replace(/-/g, '_'))} {
    pub owner: AccountId,
    pub metadata: ContractMetadata,
    pub data: UnorderedMap<String, String>,
}

#[near_bindgen]
impl ${capitalizeFirstLetter(contractName.replace(/-/g, '_'))} {
    #[init]
    pub fn new(owner: Option<AccountId>) -> Self {
        let owner = owner.unwrap_or_else(|| env::signer_account_id());
        
        Self {
            owner: owner.clone(),
            metadata: ContractMetadata {
                version: "1.0.0".to_string(),
                owner,
                created_at: env::block_timestamp(),
            },
            data: UnorderedMap::new(b"d"),
        }
    }

    // View methods
    pub fn get_metadata(&self) -> ContractMetadata {
        self.metadata.clone()
    }

    pub fn get_owner(&self) -> AccountId {
        self.owner.clone()
    }

    pub fn get_data(&self, key: String) -> Option<String> {
        self.data.get(&key)
    }

    pub fn hello(&self, name: String) -> String {
        format!("Hello, {}! This is {} contract.", name, stringify!(${capitalizeFirstLetter(contractName.replace(/-/g, '_'))}))
    }

    // Call methods
    pub fn set_data(&mut self, key: String, value: String) {
        self.assert_owner();
        self.data.insert(&key, &value);
        
        env::log_str(&format!(
            "DATA_SET: {{\"key\": \"{}\", \"value\": \"{}\"}}",
            key, value
        ));
    }

    #[payable]
    pub fn donate(&mut self) -> String {
        let deposit = env::attached_deposit();
        let donor = env::predecessor_account_id();
        
        env::log_str(&format!(
            "DONATION: {{\"donor\": \"{}\", \"amount\": \"{}\"}}",
            donor, deposit
        ));
        
        format!("Thank you {} for donating {} yoctoNEAR!", donor, deposit)
    }

    // Private methods
    fn assert_owner(&self) {
        assert_eq!(
            env::predecessor_account_id(),
            self.owner,
            "Only the owner can call this method"
        );
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use near_sdk::test_utils::{accounts, VMContextBuilder};
    use near_sdk::{testing_env};

    fn get_context(predecessor_account_id: AccountId) -> VMContextBuilder {
        let mut builder = VMContextBuilder::new();
        builder
            .current_account_id(accounts(0))
            .signer_account_id(predecessor_account_id.clone())
            .predecessor_account_id(predecessor_account_id);
        builder
    }

    #[test]
    fn test_new() {
        let mut context = get_context(accounts(1));
        testing_env!(context.build());
        let contract = ${capitalizeFirstLetter(contractName.replace(/-/g, '_'))}::new(None);
        assert_eq!(contract.get_owner(), accounts(1));
    }

    #[test]
    fn test_hello() {
        let mut context = get_context(accounts(1));
        testing_env!(context.build());
        let contract = ${capitalizeFirstLetter(contractName.replace(/-/g, '_'))}::new(None);
        let result = contract.hello("World".to_string());
        assert!(result.contains("Hello, World!"));
    }

    #[test]
    fn test_set_and_get_data() {
        let mut context = get_context(accounts(1));
        testing_env!(context.build());
        let mut contract = ${capitalizeFirstLetter(contractName.replace(/-/g, '_'))}::new(None);
        
        contract.set_data("test_key".to_string(), "test_value".to_string());
        let result = contract.get_data("test_key".to_string());
        assert_eq!(result, Some("test_value".to_string()));
    }
}
`;

    fs.writeFileSync(path.join(srcDir, 'lib.rs'), libRs);

    // Create build scripts
    await createBuildScripts(contractDir, 'rust', contractName);
    
    // Create .gitignore
    const gitignore = `target/
Cargo.lock
.DS_Store
*.wasm
`;
    fs.writeFileSync(path.join(contractDir, '.gitignore'), gitignore);
}

async function createJSContract(contractDir: string, contractName: string, isTypeScript: boolean) {
    const extension = isTypeScript ? 'ts' : 'js';
    
    // Create package.json
    const packageJson = {
        name: contractName,
        version: "1.0.0",
        description: `Near smart contract: ${contractName}`,
        main: `src/index.${extension}`,
        scripts: {
            build: "npm run build:contract",
            "build:contract": `near-sdk-js build src/index.${extension} build/${contractName}.wasm`,
            "build:debug": `near-sdk-js build src/index.${extension} build/${contractName}-debug.wasm --debug`,
            test: "npm run test:unit",
            "test:unit": "jest",
            "test:integration": "npm run build && cd integration-tests && npm test",
            deploy: `near deploy --wasmFile build/${contractName}.wasm --accountId \${NEAR_ACCOUNT}`,
            "deploy:testnet": `near deploy --wasmFile build/${contractName}.wasm --accountId \${NEAR_ACCOUNT} --networkId testnet`,
            dev: "npm run build:debug && npm run deploy:testnet"
        },
        dependencies: {
            "near-sdk-js": "^1.0.0"
        },
        devDependencies: isTypeScript ? {
            typescript: "^4.9.0",
            "@types/node": "^18.0.0",
            jest: "^29.0.0",
            "@types/jest": "^29.0.0",
            "ts-jest": "^29.0.0"
        } : {
            jest: "^29.0.0"
        }
    };

    fs.writeFileSync(path.join(contractDir, 'package.json'), JSON.stringify(packageJson, null, 2));

    // Create src directory and main file
    const srcDir = path.join(contractDir, 'src');
    if (!fs.existsSync(srcDir)) {
        fs.mkdirSync(srcDir);
    }

    const contractCode = isTypeScript ? `
import { NearBindgen, near, call, view, initialize, UnorderedMap } from 'near-sdk-js';

interface ContractMetadata {
    version: string;
    owner: string;
    createdAt: string;
}

@NearBindgen({})
export class ${capitalizeFirstLetter(contractName.replace(/-/g, '_'))} {
    owner: string = '';
    metadata: ContractMetadata = {
        version: '',
        owner: '',
        createdAt: ''
    };
    data: UnorderedMap<string> = new UnorderedMap('data');

    @initialize({})
    init({ owner }: { owner?: string }): void {
        this.owner = owner || near.signerAccountId();
        this.metadata = {
            version: '1.0.0',
            owner: this.owner,
            createdAt: near.blockTimestamp().toString()
        };
    }

    @view({})
    getMetadata(): ContractMetadata {
        return this.metadata;
    }

    @view({})
    getOwner(): string {
        return this.owner;
    }

    @view({})
    getData({ key }: { key: string }): string | null {
        return this.data.get(key);
    }

    @view({})
    hello({ name }: { name: string }): string {
        return \`Hello, \${name}! This is ${capitalizeFirstLetter(contractName.replace(/-/g, '_'))} contract.\`;
    }

    @call({})
    setData({ key, value }: { key: string; value: string }): void {
        this.assertOwner();
        this.data.set(key, value);
        
        near.log(\`DATA_SET: {"key": "\${key}", "value": "\${value}"}\`);
    }

    @call({ payableFunction: true })
    donate(): string {
        const deposit = near.attachedDeposit();
        const donor = near.predecessorAccountId();
        
        near.log(\`DONATION: {"donor": "\${donor}", "amount": "\${deposit}"}\`);
        
        return \`Thank you \${donor} for donating \${deposit} yoctoNEAR!\`;
    }

    private assertOwner(): void {
        near.assert(
            near.predecessorAccountId() === this.owner,
            'Only the owner can call this method'
        );
    }
}
` : `
import { NearBindgen, near, call, view, initialize, UnorderedMap } from 'near-sdk-js';
import * as https from 'https';

@NearBindgen({})
export class ${capitalizeFirstLetter(contractName.replace(/-/g, '_'))} {
    constructor() {
        this.owner = '';
        this.metadata = {
            version: '',
            owner: '',
            createdAt: ''
        };
        this.data = new UnorderedMap('data');
    }

    @initialize({})
    init({ owner }) {
        this.owner = owner || near.signerAccountId();
        this.metadata = {
            version: '1.0.0',
            owner: this.owner,
            createdAt: near.blockTimestamp().toString()
        };
    }

    @view({})
    getMetadata() {
        return this.metadata;
    }

    @view({})
    getOwner() {
        return this.owner;
    }

    @view({})
    getData({ key }) {
        return this.data.get(key);
    }

    @view({})
    hello({ name }) {
        return \`Hello, \${name}! This is ${capitalizeFirstLetter(contractName.replace(/-/g, '_'))} contract.\`;
    }

    @call({})
    setData({ key, value }) {
        this.assertOwner();
        this.data.set(key, value);
        
        near.log(\`DATA_SET: {"key": "\${key}", "value": "\${value}"}\`);
    }

    @call({ payableFunction: true })
    donate() {
        const deposit = near.attachedDeposit();
        const donor = near.predecessorAccountId();
        
        near.log(\`DONATION: {"donor": "\${donor}", "amount": "\${deposit}"}\`);
        
        return \`Thank you \${donor} for donating \${deposit} yoctoNEAR!\`;
    }

    assertOwner() {
        near.assert(
            near.predecessorAccountId() === this.owner,
            'Only the owner can call this method'
        );
    }
}
`;

    fs.writeFileSync(path.join(srcDir, `index.${extension}`), contractCode);

    // Create test configuration
    if (isTypeScript) {
        const jestConfig = {
            preset: 'ts-jest',
            testEnvironment: 'node',
            roots: ['<rootDir>/src'],
            testMatch: ['**/__tests__/**/*.test.ts']
        };
        fs.writeFileSync(path.join(contractDir, 'jest.config.json'), JSON.stringify(jestConfig, null, 2));

        const tsConfig = {
            compilerOptions: {
                target: 'ES2020',
                module: 'ESNext',
                moduleResolution: 'node',
                strict: true,
                esModuleInterop: true,
                skipLibCheck: true,
                forceConsistentCasingInFileNames: true,
                resolveJsonModule: true,
                declaration: true,
                outDir: './dist'
            },
            include: ['src/**/*'],
            exclude: ['node_modules', 'dist', 'build']
        };
        fs.writeFileSync(path.join(contractDir, 'tsconfig.json'), JSON.stringify(tsConfig, null, 2));
    }

    await createBuildScripts(contractDir, isTypeScript ? 'typescript' : 'javascript', contractName);
}


async function createBuildScripts(contractDir: string, language: string, contractName: string) {
    // Create build directory
    const buildDir = path.join(contractDir, 'build');
    if (!fs.existsSync(buildDir)) {
        fs.mkdirSync(buildDir);
    }

    switch (language) {
        case 'rust':
            // Create build.sh for Rust
            const rustBuildScript = `#!/bin/bash
set -e

# Build the contract
echo "Building Rust contract..."
cargo build --target wasm32-unknown-unknown --release

# Copy to build directory
mkdir -p build
cp target/wasm32-unknown-unknown/release/${contractName.replace(/-/g, '_')}.wasm build/${contractName}.wasm

echo "Contract built successfully: build/${contractName}.wasm"
`;

            // Define optimizeScript for Rust
            const optimizeScript = `#!/bin/bash
set -e

# Build the contract with optimizations
echo "Optimizing Rust contract..."
cargo build --target wasm32-unknown-unknown --release

# Check if wasm-opt is installed
if command -v wasm-opt &> /dev/null; then
    echo "Running wasm-opt..."
    wasm-opt -Oz target/wasm32-unknown-unknown/release/${contractName.replace(/-/g, '_')}.wasm -o build/${contractName}.wasm
    echo "Optimized contract: build/${contractName}.wasm"
else
    echo "wasm-opt not found, copying unoptimized wasm."
    cp target/wasm32-unknown-unknown/release/${contractName.replace(/-/g, '_')}.wasm build/${contractName}.wasm
fi
`;

            fs.writeFileSync(path.join(contractDir, 'optimize.sh'), optimizeScript);
            fs.chmodSync(path.join(contractDir, 'optimize.sh'), 0o755);
            break;

        case 'javascript':
        case 'typescript':
            // Create build scripts for JS/TS
            const jsBuildScript = `#!/bin/bash
set -e

echo "Building ${language} contract..."
npm run build:contract

echo "Contract built successfully: build/${contractName}.wasm"
`;

            fs.writeFileSync(path.join(contractDir, 'build.sh'), jsBuildScript);
            fs.chmodSync(path.join(contractDir, 'build.sh'), 0o755);
            break;
    }

    // Create deployment script
    const deployScript = `#!/bin/bash
set -e

# Check if NEAR_ACCOUNT is set
if [ -z "\${NEAR_ACCOUNT}" ]; then
    echo "Please set NEAR_ACCOUNT environment variable"
    echo "Example: export NEAR_ACCOUNT=mycontract.testnet"
    exit 1
fi

# Set default network to testnet
NETWORK=\${NEAR_NETWORK:-testnet}

# Determine WASM file based on language
WASM_FILE=""
case "${language}" in
    "rust"|"javascript"|"typescript")
        WASM_FILE="build/${contractName}.wasm"
        ;;
esac

if [ ! -f "\$WASM_FILE" ]; then
    echo "WASM file not found: \$WASM_FILE"
    echo "Please build the contract first: ./build.sh"
    exit 1
fi

echo "Deploying contract to \$NEAR_ACCOUNT on \$NETWORK network..."
near deploy --wasmFile "\$WASM_FILE" --accountId "\$NEAR_ACCOUNT" --networkId "\$NETWORK"

echo "Contract deployed successfully!"
`;

    fs.writeFileSync(path.join(contractDir, 'deploy.sh'), deployScript);
    fs.chmodSync(path.join(contractDir, 'deploy.sh'), 0o755);

    // Create README for the contract
    const readmeContent = `# ${contractName}

A Near Protocol smart contract written in ${language}.

## Quick Start

1. Install dependencies:
   \`\`\`bash
   ${language === 'rust' ? 'cargo build' : 'npm install'}
   \`\`\`

2. Build the contract:
   \`\`\`bash
   ./build.sh
   \`\`\`

3. Deploy the contract:
   \`\`\`bash
   export NEAR_ACCOUNT=your-contract.testnet
   ./deploy.sh
   \`\`\`

## Testing

${language === 'rust' ? 
'```bash\ncargo test\n```' : 
'```bash\nnpm test\n```'
}

## Available Methods

- \`hello(name: string)\`: Returns a greeting message
- \`setData(key: string, value: string)\`: Sets data (owner only)
- \`getData(key: string)\`: Gets data by key
- \`donate()\`: Accept donations
- \`getOwner()\`: Returns contract owner
- \`getMetadata()\`: Returns contract metadata
`;

    fs.writeFileSync(path.join(contractDir, 'README.md'), readmeContent);
}

function capitalizeFirstLetter(string: string): string {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

async function buildContract() {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
        vscode.window.showErrorMessage('No workspace folder found');
        return;
    }

    const terminal = vscode.window.createTerminal('Near Build');
    const projectType = await detectProjectType(workspaceFolder.uri.fsPath);

    if (!projectType) {
        vscode.window.showErrorMessage('No Near contract found in this workspace');
        return;
    }

    const config = vscode.workspace.getConfiguration('nearExtension');
    let buildCommand = '';

    switch (projectType) {
        case 'rust':
            buildCommand = config.get('buildCommand', 'cargo build --target wasm32-unknown-unknown --release');
            break;
        case 'javascript':
        case 'typescript':
            buildCommand = config.get('jsBuildCommand', 'npm run build');
            break;
    }

    terminal.sendText(buildCommand);
    terminal.show();

    // Show build progress
    vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: `Building ${projectType} contract...`,
        cancellable: false
    }, async (progress) => {
        // Wait a moment for build to complete
        await new Promise(resolve => setTimeout(resolve, 5000));
        return Promise.resolve();
    });
}

async function detectProjectType(workspacePath: string): Promise<string | null> {
    const cargoPath = path.join(workspacePath, 'Cargo.toml');
    const packagePath = path.join(workspacePath, 'package.json');

    if (fs.existsSync(cargoPath)) {
        return 'rust';
    } else if (fs.existsSync(packagePath)) {
        // Check if it's a Near JS/TS project
        try {
            const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
            if (packageJson.dependencies && packageJson.dependencies['near-sdk-js']) {
                // Check for TypeScript
                if (packageJson.devDependencies && packageJson.devDependencies['typescript']) {
                    return 'typescript';
                }
                return 'javascript';
            }
        } catch (error) {
            console.error('Error reading package.json:', error);
        }
    }

    return null;
}

async function deployContract() {
    const config = vscode.workspace.getConfiguration('nearExtension');
    const network = config.get('network', 'testnet');
    let accountId = config.get('accountId', '');

    if (!accountId) {
        const inputAccountId = await vscode.window.showInputBox({
            prompt: 'Enter your Near account ID',
            placeHolder: 'your-contract.testnet'
        });
        
        if (!inputAccountId) return;
        accountId = inputAccountId;
        
        await config.update('accountId', accountId, vscode.ConfigurationTarget.Workspace);
    }

    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
        vscode.window.showErrorMessage('No workspace folder found');
        return;
    }

    const projectType = await detectProjectType(workspaceFolder.uri.fsPath);
    if (!projectType) {
        vscode.window.showErrorMessage('No Near contract found in this workspace');
        return;
    }

    // Determine WASM file path based on project type
    let wasmFile = '';
    const contractName = path.basename(workspaceFolder.uri.fsPath);
    
    switch (projectType) {
        case 'rust':
        case 'javascript':
        case 'typescript':
            wasmFile = `build/${contractName}.wasm`;
            break;
    }

    const terminal = vscode.window.createTerminal('Near Deploy');
    terminal.sendText(`near deploy --wasmFile ${wasmFile} --accountId ${accountId} --networkId ${network}`);
    terminal.show();

    vscode.window.showInformationMessage(`Deploying to ${network} network as ${accountId}`);
}

async function testContract() {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
        vscode.window.showErrorMessage('No workspace folder found');
        return;
    }

    const terminal = vscode.window.createTerminal('Near Test');
    const projectType = await detectProjectType(workspaceFolder.uri.fsPath);

    let testCommand = '';
    switch (projectType) {
        case 'rust':
            testCommand = 'cargo test';
            break;
        case 'javascript':
        case 'typescript':
            testCommand = 'npm test';
            break;
        default:
            vscode.window.showErrorMessage('No Near contract found in this workspace');
            return;
    }

    terminal.sendText(testCommand);
    terminal.show();
}

async function initializeProject() {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
        vscode.window.showErrorMessage('Please open a workspace first');
        return;
    }

    const projectTypes = [
        { label: 'Rust Project', description: 'Initialize a new Rust-based Near project', value: 'rust' },
        { label: 'JavaScript Project', description: 'Initialize a new JavaScript-based Near project', value: 'javascript' },
        { label: 'TypeScript Project', description: 'Initialize a new TypeScript-based Near project', value: 'typescript' }
    ];

    const selected = await vscode.window.showQuickPick(projectTypes, { 
        placeHolder: 'Select project type' 
    });

    if (!selected) return;

    const terminal = vscode.window.createTerminal('Near Init');
    
    switch (selected.value) {
        case 'rust':
            terminal.sendText('cargo init --lib');
            break;
        case 'javascript':
            terminal.sendText('npm init -y && npm install near-sdk-js');
            break;
        case 'typescript':
            terminal.sendText('npm init -y && npm install near-sdk-js && npm install -D typescript @types/node');
            break;
    }

    terminal.show();
    
    setTimeout(() => {
        vscode.window.showInformationMessage(`Near ${selected.value} project initialized! You can now create contracts.`);
    }, 3000);
}

async function setupRustToolchain() {
    const terminal = vscode.window.createTerminal('Rust Setup');
    
    const commands = [
        'echo "Setting up Rust toolchain for Near development..."',
        'rustup target add wasm32-unknown-unknown',
        'cargo install cargo-near',
        'echo "Rust toolchain setup complete!"'
    ];

    for (const command of commands) {
        terminal.sendText(command);
    }
    
    terminal.show();
    vscode.window.showInformationMessage('Setting up Rust toolchain for Near development...');
}

async function optimizeContract() {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
        vscode.window.showErrorMessage('No workspace folder found');
        return;
    }

    const projectType = await detectProjectType(workspaceFolder.uri.fsPath);
    if (!projectType) {
        vscode.window.showErrorMessage('No Near contract found in this workspace');
        return;
    }

    const terminal = vscode.window.createTerminal('Near Optimize');
    
    switch (projectType) {
        case 'rust':
            // Check if optimize.sh exists, otherwise use cargo build with optimizations
            const optimizeScript = path.join(workspaceFolder.uri.fsPath, 'optimize.sh');
            if (fs.existsSync(optimizeScript)) {
                terminal.sendText('./optimize.sh');
            } else {
                terminal.sendText('cargo build --target wasm32-unknown-unknown --release');
                // Try to use wasm-opt if available
                terminal.sendText('if command -v wasm-opt &> /dev/null; then wasm-opt -Oz target/wasm32-unknown-unknown/release/*.wasm --output optimized.wasm; fi');
            }
            break;
        case 'javascript':
        case 'typescript':
            terminal.sendText('npm run build');
            break;
    }

    terminal.show();
    vscode.window.showInformationMessage('Optimizing contract for production...');
}

async function generateBindings() {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
        vscode.window.showErrorMessage('No workspace folder found');
        return;
    }

    const bindingTypes = [
        { label: 'TypeScript Bindings', description: 'Generate TypeScript interface for contract calls' },
        { label: 'JavaScript Bindings', description: 'Generate JavaScript helpers for contract interaction' },
        { label: 'Rust Bindings', description: 'Generate Rust client code for cross-contract calls' }
    ];

    const selected = await vscode.window.showQuickPick(bindingTypes, {
        placeHolder: 'Select binding type to generate'
    });

    if (!selected) return;

    vscode.window.showInformationMessage(`Generating ${selected.label}...`);
    
    // This would integrate with Near's binding generation tools
    // For now, we'll show a placeholder
    vscode.window.showInformationMessage('Binding generation feature coming soon!');
}

function checkForNearProject() {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) return;

    const projectType = detectProjectType(workspaceFolder.uri.fsPath);
    
    projectType.then(type => {
        if (type) {
            vscode.window.showInformationMessage(
                `Near ${type} project detected! Use the Near commands in the Command Palette.`,
                'Show Commands'
            ).then(selection => {
                if (selection === 'Show Commands') {
                    vscode.commands.executeCommand('workbench.action.showCommands', 'Near:');
                }
            });
        }
    });
}

async function validateToolchains() {
    const config = vscode.workspace.getConfiguration('nearExtension');
    const autoInstall = config.get('autoInstallDeps', true);

    if (!autoInstall) return;

    try {
        // Check if Near CLI is installed
        await execAsync('near --version');
    } catch (error) {
        vscode.window.showWarningMessage(
            'Near CLI not found. Install it for full functionality.',
            'Install Near CLI',
            'Ignore'
        ).then(selection => {
            if (selection === 'Install Near CLI') {
                const terminal = vscode.window.createTerminal('Install Near CLI');
                terminal.sendText('npm install -g near-cli');
                terminal.show();
            }
        });
    }

    // Check for Rust if we detect Rust projects
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (workspaceFolder) {
        const projectType = await detectProjectType(workspaceFolder.uri.fsPath);
        if (projectType === 'rust') {
            try {
                await execAsync('rustc --version');
                await execAsync('cargo --version');
            } catch (error) {
                vscode.window.showWarningMessage(
                    'Rust toolchain not found. Install it for Rust contract development.',
                    'Install Rust',
                    'Ignore'
                ).then(selection => {
                    if (selection === 'Install Rust') {
                        vscode.env.openExternal(vscode.Uri.parse('https://rustup.rs/'));
                    }
                });
            }
        }
    }
}

class NearTaskProvider implements vscode.TaskProvider {
    provideTasks(): vscode.Task[] {
        const tasks: vscode.Task[] = [];
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        
        if (!workspaceFolder) return tasks;

        detectProjectType(workspaceFolder.uri.fsPath).then(projectType => {
            if (!projectType) return;

            // Build task
            let buildCommand = '';
            switch (projectType) {
                case 'rust':
                    buildCommand = 'cargo build --target wasm32-unknown-unknown --release';
                    break;
                case 'javascript':
                case 'typescript':
                    buildCommand = 'npm run build';
                    break;
            }

            const buildTask = new vscode.Task(
                { type: 'near', command: 'build' },
                vscode.TaskScope.Workspace,
                `Build ${projectType} Contract`,
                'near',
                new vscode.ShellExecution(buildCommand)
            );
            tasks.push(buildTask);

            // Test task
            let testCommand = '';
            switch (projectType) {
                case 'rust':
                    testCommand = 'cargo test';
                    break;
                case 'javascript':
                case 'typescript':
                    testCommand = 'npm test';
                    break;
            }

            const testTask = new vscode.Task(
                { type: 'near', command: 'test' },
                vscode.TaskScope.Workspace,
                `Test ${projectType} Contract`,
                'near',
                new vscode.ShellExecution(testCommand)
            );
            tasks.push(testTask);
        });

        return tasks;
    }

    resolveTask(task: vscode.Task): vscode.Task | undefined {
        return task;
    }
}

// Polyfill for fetch using Node.js https module (for VS Code extension context)

function fetch(url: string, options: { method: string; headers: { [key: string]: string }; body: string }): Promise<{ ok: boolean; status: number; json: () => Promise<any> }> {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        const req = https.request(
            {
                method: options.method,
                hostname: urlObj.hostname,
                path: urlObj.pathname + urlObj.search,
                headers: options.headers,
            },
            (res) => {
                let data = '';
                res.on('data', (chunk) => (data += chunk));
                res.on('end', () => {
                    resolve({
                        ok: typeof res.statusCode === 'number' && res.statusCode >= 200 && res.statusCode < 300,
                        status: res.statusCode || 0,
                        json: async () => {
                            try {
                                return JSON.parse(data);
                            } catch {
                                return {};
                            }
                        },
                    });
                });
            }
        );
        req.on('error', reject);
        if (options.body) {
            req.write(options.body);
        }
        req.end();
    });
}

export function deactivate() {}


