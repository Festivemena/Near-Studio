"use strict";
// src/commands/contractCommands.ts - Updated to match create-near-app repo structure
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
exports.registerContractCommands = void 0;
const vscode = __importStar(require("vscode"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const util_1 = require("util");
const child_process_1 = require("child_process");
const execAsync = (0, util_1.promisify)(child_process_1.exec);
function registerContractCommands() {
    return [
        vscode.commands.registerCommand('near-studio.createContract', createContract),
        vscode.commands.registerCommand('near-studio.createRustContract', () => createSpecificContract('rs')),
        vscode.commands.registerCommand('near-studio.createJSContract', () => createSpecificContract('ts')),
        vscode.commands.registerCommand('near-studio.createTSContract', () => createSpecificContract('ts')),
        vscode.commands.registerCommand('near-studio.createPythonContract', () => createSpecificContract('py')),
        vscode.commands.registerCommand('near-studio.createFrontend', createFrontend),
        vscode.commands.registerCommand('near-studio.buildContract', buildContract),
        vscode.commands.registerCommand('near-studio.deployContract', deployContract),
        vscode.commands.registerCommand('near-studio.testContract', testContract),
        vscode.commands.registerCommand('near-studio.optimizeContract', optimizeContract),
        vscode.commands.registerCommand('near-studio.generateBindings', generateBindings)
    ];
}
exports.registerContractCommands = registerContractCommands;
// Available create-near-app templates based on the repo structure
const AVAILABLE_TEMPLATES = [
    // Contract only templates
    {
        name: 'Rust Contract Only',
        contract: 'rs',
        frontend: 'none',
        description: 'A NEAR smart contract written in Rust'
    },
    {
        name: 'TypeScript Contract Only',
        contract: 'ts',
        frontend: 'none',
        description: 'A NEAR smart contract written in TypeScript'
    },
    {
        name: 'Python Contract Only',
        contract: 'py',
        frontend: 'none',
        description: 'A NEAR smart contract written in Python'
    },
    // Frontend only templates
    {
        name: 'Next.js App Router Frontend',
        contract: 'none',
        frontend: 'next-app',
        description: 'Next.js web app with App Router (React 18+ features)'
    },
    {
        name: 'Next.js Pages Router Frontend',
        contract: 'none',
        frontend: 'next-page',
        description: 'Next.js web app with traditional Pages Router'
    },
    {
        name: 'Vite + React Frontend',
        contract: 'none',
        frontend: 'vite-react',
        description: 'Fast Vite-powered React application'
    },
    // Full-stack templates
    {
        name: 'Full-Stack: Rust + Next.js (App Router)',
        contract: 'rs',
        frontend: 'next-app',
        description: 'Complete dApp with Rust contract and Next.js frontend'
    },
    {
        name: 'Full-Stack: TypeScript + Next.js (App Router)',
        contract: 'ts',
        frontend: 'next-app',
        description: 'Complete dApp with TypeScript contract and Next.js frontend'
    },
    {
        name: 'Full-Stack: Rust + Vite React',
        contract: 'rs',
        frontend: 'vite-react',
        description: 'Complete dApp with Rust contract and Vite React frontend'
    }
];
async function createContract() {
    const contractTemplates = AVAILABLE_TEMPLATES.filter(t => t.contract !== 'none');
    const templates = contractTemplates.map(t => ({
        label: t.name,
        description: t.description,
        template: t
    }));
    const selected = await vscode.window.showQuickPick(templates, {
        placeHolder: 'Select a NEAR contract template',
        matchOnDescription: true
    });
    if (!selected)
        return;
    await createSpecificContractFromTemplate(selected.template);
}
async function createFrontend() {
    const frontendTemplates = AVAILABLE_TEMPLATES.filter(t => t.frontend !== 'none');
    const templates = frontendTemplates.map(t => ({
        label: t.name,
        description: t.description,
        template: t
    }));
    const selected = await vscode.window.showQuickPick(templates, {
        placeHolder: 'Select a frontend template',
        matchOnDescription: true
    });
    if (!selected)
        return;
    await createSpecificContractFromTemplate(selected.template);
}
async function createSpecificContract(contractType) {
    // Filter templates by contract type
    const contractTemplates = AVAILABLE_TEMPLATES.filter(t => t.contract === contractType);
    if (contractTemplates.length === 0) {
        vscode.window.showErrorMessage(`No templates available for ${contractType}`);
        return;
    }
    if (contractTemplates.length === 1) {
        await createSpecificContractFromTemplate(contractTemplates[0]);
        return;
    }
    const templates = contractTemplates.map(t => ({
        label: t.name,
        description: t.description,
        template: t
    }));
    const selected = await vscode.window.showQuickPick(templates, {
        placeHolder: `Select a ${contractType} template`,
        matchOnDescription: true
    });
    if (!selected)
        return;
    await createSpecificContractFromTemplate(selected.template);
}
async function createSpecificContractFromTemplate(template) {
    const projectName = await vscode.window.showInputBox({
        prompt: `Enter project name`,
        validateInput: (value) => {
            if (!value)
                return 'Project name is required';
            if (!/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(value)) {
                return 'Project name must start with a letter and contain only letters, numbers, underscores, and hyphens';
            }
            return null;
        }
    });
    if (!projectName)
        return;
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
        vscode.window.showErrorMessage('Please open a workspace first');
        return;
    }
    const targetPath = path.join(workspaceFolder.uri.fsPath, projectName);
    // Check if directory already exists
    if (fs.existsSync(targetPath)) {
        const overwrite = await vscode.window.showWarningMessage(`Directory "${projectName}" already exists. Overwrite?`, 'Yes', 'No');
        if (overwrite !== 'Yes')
            return;
    }
    await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: `Creating ${template.name}...`,
        cancellable: false
    }, async (progress) => {
        try {
            progress.report({ message: 'Initializing project...' });
            // Build create-near-app command based on template
            let createCommand = `npx create-near-app@latest ${projectName}`;
            // Add frontend option
            if (template.frontend !== 'none') {
                createCommand += ` --frontend ${template.frontend}`;
            }
            else {
                createCommand += ` --frontend none`;
            }
            // Add contract option
            if (template.contract !== 'none') {
                createCommand += ` --contract ${template.contract}`;
            }
            else {
                createCommand += ` --contract none`;
            }
            // Add install flag
            createCommand += ` --install`;
            progress.report({ message: 'Running create-near-app...' });
            // Run the command in the workspace directory
            // create-near-app will create the projectName folder automatically
            const { stdout, stderr } = await execAsync(createCommand, {
                cwd: workspaceFolder.uri.fsPath,
                timeout: 300000 // 5 minutes timeout
            });
            if (stderr && !stderr.includes('npm WARN')) {
                console.warn('create-near-app warnings:', stderr);
            }
            // Verify the project was created
            if (!fs.existsSync(targetPath)) {
                throw new Error(`Project directory was not created at ${targetPath}`);
            }
            progress.report({ message: 'Setting up project structure...' });
            // Post-processing: customize for VS Code extension
            await postProcessProject(targetPath, template, projectName);
            progress.report({ message: 'Opening project...' });
            // Open the main contract or frontend file
            const mainFile = getMainProjectFile(targetPath, template);
            if (mainFile && fs.existsSync(mainFile)) {
                const document = await vscode.workspace.openTextDocument(mainFile);
                await vscode.window.showTextDocument(document);
            }
            vscode.window.showInformationMessage(`${template.name} "${projectName}" created successfully!`, 'Open Folder').then(selection => {
                if (selection === 'Open Folder') {
                    vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(targetPath));
                }
            });
        }
        catch (error) {
            console.error('Error creating project:', error);
            vscode.window.showErrorMessage(`Failed to create project: ${error}`);
            // Clean up partially created directory if it exists
            if (fs.existsSync(targetPath)) {
                try {
                    fs.rmSync(targetPath, { recursive: true, force: true });
                }
                catch (cleanupError) {
                    console.warn('Failed to clean up partial project:', cleanupError);
                }
            }
        }
    });
}
async function postProcessProject(projectPath, template, projectName) {
    // Add VS Code specific configurations
    await addVSCodeConfiguration(projectPath, template);
    // Update project metadata
    await updateProjectMetadata(projectPath, projectName, template);
    // Add development scripts
    await addDevelopmentScripts(projectPath, template, projectName);
}
async function addVSCodeConfiguration(projectPath, template) {
    const vscodeDir = path.join(projectPath, '.vscode');
    if (!fs.existsSync(vscodeDir)) {
        fs.mkdirSync(vscodeDir, { recursive: true });
    }
    // Add tasks configuration
    const tasks = [];
    // Contract tasks
    if (template.contract !== 'none') {
        if (template.contract === 'rs') {
            tasks.push({
                label: "Build Rust Contract",
                type: "shell",
                command: "cargo near build",
                group: {
                    kind: "build",
                    isDefault: true
                },
                presentation: {
                    echo: true,
                    reveal: "always",
                    focus: false,
                    panel: "shared"
                },
                problemMatcher: "$rustc"
            });
            tasks.push({
                label: "Test Rust Contract",
                type: "shell",
                command: "cargo test",
                group: "test",
                presentation: {
                    echo: true,
                    reveal: "always",
                    focus: false,
                    panel: "shared"
                }
            });
        }
        else if (template.contract === 'ts') {
            tasks.push({
                label: "Build TypeScript Contract",
                type: "shell",
                command: "npm run build",
                group: {
                    kind: "build",
                    isDefault: true
                },
                presentation: {
                    echo: true,
                    reveal: "always",
                    focus: false,
                    panel: "shared"
                }
            });
            tasks.push({
                label: "Test TypeScript Contract",
                type: "shell",
                command: "npm test",
                group: "test",
                presentation: {
                    echo: true,
                    reveal: "always",
                    focus: false,
                    panel: "shared"
                }
            });
        }
        else if (template.contract === 'py') {
            tasks.push({
                label: "Build Python Contract",
                type: "shell",
                command: "uvx nearc contract.py",
                group: {
                    kind: "build",
                    isDefault: true
                },
                presentation: {
                    echo: true,
                    reveal: "always",
                    focus: false,
                    panel: "shared"
                }
            });
            tasks.push({
                label: "Test Python Contract",
                type: "shell",
                command: "uv run pytest",
                group: "test",
                presentation: {
                    echo: true,
                    reveal: "always",
                    focus: false,
                    panel: "shared"
                }
            });
        }
    }
    // Frontend tasks
    if (template.frontend !== 'none') {
        tasks.push({
            label: "Start Development Server",
            type: "shell",
            command: "npm run dev",
            group: "build",
            presentation: {
                echo: true,
                reveal: "always",
                focus: false,
                panel: "shared"
            }
        });
        tasks.push({
            label: "Build Frontend",
            type: "shell",
            command: "npm run build",
            group: "build",
            presentation: {
                echo: true,
                reveal: "always",
                focus: false,
                panel: "shared"
            }
        });
    }
    const tasksConfig = {
        version: "2.0.0",
        tasks: tasks
    };
    fs.writeFileSync(path.join(vscodeDir, 'tasks.json'), JSON.stringify(tasksConfig, null, 2));
    // Add launch configuration for debugging
    if (template.contract === 'rs') {
        const launchConfig = {
            version: "0.2.0",
            configurations: [
                {
                    type: "lldb",
                    request: "launch",
                    name: "Debug unit tests",
                    cargo: {
                        args: ["test", "--no-run", "--bin=main"],
                        filter: {
                            name: "main",
                            kind: "bin"
                        }
                    },
                    args: [],
                    cwd: "${workspaceFolder}"
                }
            ]
        };
        fs.writeFileSync(path.join(vscodeDir, 'launch.json'), JSON.stringify(launchConfig, null, 2));
    }
    // Add settings for the extension
    const settingsConfig = {
        "files.exclude": {
            "**/target": true,
            "**/node_modules": true,
            "**/.git": true,
            "**/build": true,
            "**/.next": true,
            "**/dist": true
        }
    };
    if (template.contract === 'rs') {
        settingsConfig["rust-analyzer.cargo.target"] = "wasm32-unknown-unknown";
        settingsConfig["rust-analyzer.checkOnSave.allTargets"] = false;
    }
    fs.writeFileSync(path.join(vscodeDir, 'settings.json'), JSON.stringify(settingsConfig, null, 2));
}
async function updateProjectMetadata(projectPath, projectName, template) {
    if (template.contract === 'rs') {
        // Update Cargo.toml if it exists
        const cargoPath = path.join(projectPath, 'Cargo.toml');
        if (fs.existsSync(cargoPath)) {
            let cargoContent = fs.readFileSync(cargoPath, 'utf8');
            cargoContent = cargoContent.replace(/name = ".*"/, `name = "${projectName}"`);
            fs.writeFileSync(cargoPath, cargoContent);
        }
    }
    // Update package.json files
    const packagePaths = [
        path.join(projectPath, 'package.json')
    ];
    for (const packagePath of packagePaths) {
        if (fs.existsSync(packagePath)) {
            const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
            packageJson.name = projectName;
            fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2));
            break;
        }
    }
}
async function addDevelopmentScripts(projectPath, template, projectName) {
    // Create comprehensive README
    const readmeContent = generateReadmeContent(template, projectName);
    fs.writeFileSync(path.join(projectPath, 'README.md'), readmeContent);
}
function generateReadmeContent(template, projectName) {
    let content = `# ${projectName}\n\n`;
    content += `${template.description}\n\n`;
    content += `## Getting Started\n\n`;
    if (template.contract !== 'none') {
        content += `### Smart Contract\n\n`;
        if (template.contract === 'rs') {
            content += `This project includes a Rust smart contract.\n\n`;
            content += `#### Prerequisites\n`;
            content += `- [Rust](https://rustup.rs/)\n`;
            content += `- [cargo-near](https://github.com/near/cargo-near)\n\n`;
            content += `#### Building the Contract\n`;
            content += `\`\`\`bash\ncd contract\ncargo near build\n\`\`\`\n\n`;
            content += `#### Testing the Contract\n`;
            content += `\`\`\`bash\ncargo test\n\`\`\`\n\n`;
        }
        else if (template.contract === 'ts') {
            content += `This project includes a TypeScript smart contract.\n\n`;
            content += `#### Prerequisites\n`;
            content += `- [Node.js](https://nodejs.org/) (v16+)\n\n`;
            content += `#### Building the Contract\n`;
            content += `\`\`\`bash\nnpm run build\n\`\`\`\n\n`;
            content += `#### Testing the Contract\n`;
            content += `\`\`\`bash\nnpm test\n\`\`\`\n\n`;
        }
        else if (template.contract === 'py') {
            content += `This project includes a Python smart contract.\n\n`;
            content += `#### Prerequisites\n`;
            content += `- [Python 3.13+](https://www.python.org/downloads/)\n`;
            content += `- [uv](https://astral.sh/uv/)\n`;
            content += `- [Emscripten](https://emscripten.org/)\n\n`;
            content += `#### Building the Contract\n`;
            content += `\`\`\`bash\nuvx nearc contract.py\n\`\`\`\n\n`;
            content += `#### Testing the Contract\n`;
            content += `\`\`\`bash\nuv run pytest\n\`\`\`\n\n`;
        }
    }
    if (template.frontend !== 'none') {
        content += `### Frontend\n\n`;
        if (template.frontend.includes('next')) {
            content += `This project includes a Next.js frontend.\n\n`;
        }
        else if (template.frontend === 'vite-react') {
            content += `This project includes a Vite + React frontend.\n\n`;
        }
        content += `#### Development Server\n`;
        content += `\`\`\`bash\nnpm run dev\n\`\`\`\n\n`;
        content += `#### Building for Production\n`;
        content += `\`\`\`bash\nnpm run build\n\`\`\`\n\n`;
    }
    content += `## Learn More\n\n`;
    content += `- [NEAR Documentation](https://docs.near.org)\n`;
    content += `- [NEAR Examples](https://github.com/near/near-examples)\n`;
    content += `- [NEAR Discord](https://near.chat)\n`;
    return content;
}
function getMainProjectFile(projectPath, template) {
    const possiblePaths = [];
    // Contract files
    if (template.contract === 'rs') {
        possiblePaths.push(path.join(projectPath, 'src', 'lib.rs'), path.join(projectPath, 'contract', 'src', 'lib.rs'));
    }
    else if (template.contract === 'ts') {
        possiblePaths.push(path.join(projectPath, 'src', 'contract.ts'), path.join(projectPath, 'contract', 'src', 'contract.ts'));
    }
    else if (template.contract === 'py') {
        possiblePaths.push(path.join(projectPath, 'contract.py'), path.join(projectPath, 'src', 'contract.py'));
    }
    // Frontend files
    if (template.frontend === 'next-app') {
        possiblePaths.push(path.join(projectPath, 'src', 'app', 'page.js'), path.join(projectPath, 'app', 'page.js'));
    }
    else if (template.frontend === 'next-page') {
        possiblePaths.push(path.join(projectPath, 'src', 'pages', 'index.js'), path.join(projectPath, 'pages', 'index.js'));
    }
    else if (template.frontend === 'vite-react') {
        possiblePaths.push(path.join(projectPath, 'src', 'App.jsx'), path.join(projectPath, 'src', 'main.jsx'));
    }
    for (const filePath of possiblePaths) {
        if (fs.existsSync(filePath)) {
            return filePath;
        }
    }
    return null;
}
async function buildContract() {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
        vscode.window.showErrorMessage('Open a workspace folder first');
        return;
    }
    const terminal = vscode.window.createTerminal('NEAR Build');
    // Detect project type and run appropriate build command
    if (fs.existsSync(path.join(workspaceFolder.uri.fsPath, 'Cargo.toml'))) {
        terminal.sendText('cargo near build');
    }
    else if (fs.existsSync(path.join(workspaceFolder.uri.fsPath, 'contract.py'))) {
        terminal.sendText('uvx nearc contract.py');
    }
    else if (fs.existsSync(path.join(workspaceFolder.uri.fsPath, 'package.json'))) {
        terminal.sendText('npm run build');
    }
    else {
        vscode.window.showErrorMessage('No recognized contract project found');
        return;
    }
    terminal.show();
}
async function deployContract() {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
        vscode.window.showErrorMessage('Open a workspace folder first');
        return;
    }
    const accountId = await vscode.window.showInputBox({
        prompt: 'Enter account ID for deployment',
        placeHolder: 'your-account.testnet'
    });
    if (!accountId)
        return;
    const terminal = vscode.window.createTerminal('NEAR Deploy');
    terminal.sendText(`near deploy --accountId ${accountId}`);
    terminal.show();
}
async function testContract() {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
        vscode.window.showErrorMessage('Open a workspace folder first');
        return;
    }
    const terminal = vscode.window.createTerminal('NEAR Test');
    // Detect project type and run appropriate test command
    if (fs.existsSync(path.join(workspaceFolder.uri.fsPath, 'Cargo.toml'))) {
        terminal.sendText('cargo test');
    }
    else if (fs.existsSync(path.join(workspaceFolder.uri.fsPath, 'contract.py'))) {
        terminal.sendText('uv run pytest');
    }
    else if (fs.existsSync(path.join(workspaceFolder.uri.fsPath, 'package.json'))) {
        terminal.sendText('npm test');
    }
    else {
        vscode.window.showErrorMessage('No recognized contract project found');
        return;
    }
    terminal.show();
}
async function optimizeContract() {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
        vscode.window.showErrorMessage('Open a workspace folder first');
        return;
    }
    const terminal = vscode.window.createTerminal('NEAR Optimize');
    // Detect project type and run appropriate optimize command
    if (fs.existsSync(path.join(workspaceFolder.uri.fsPath, 'Cargo.toml'))) {
        terminal.sendText('cargo near build build-reproducible-wasm');
    }
    else {
        terminal.sendText('npm run build');
    }
    terminal.show();
    vscode.window.showInformationMessage('Building optimized contract...');
}
async function generateBindings() {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
        vscode.window.showErrorMessage('Open a workspace folder first');
        return;
    }
    const outputDir = await vscode.window.showInputBox({
        prompt: 'Enter output directory for bindings',
        value: 'bindings',
        placeHolder: 'bindings'
    });
    if (!outputDir)
        return;
    const bindingsPath = path.join(workspaceFolder.uri.fsPath, outputDir);
    if (!fs.existsSync(bindingsPath)) {
        fs.mkdirSync(bindingsPath, { recursive: true });
    }
    // Generate TypeScript bindings based on contract structure
    const bindingContent = `// Generated TypeScript bindings for NEAR contract
// This file provides type-safe interaction with your deployed contract

import { Account, Contract, ConnectConfig, Near, WalletConnection } from 'near-api-js';

export interface ContractMethods {
    // View methods (read-only)
    get_greeting: () => Promise<string>;
    
    // Call methods (can modify state)
    set_greeting: (args: { greeting: string }) => Promise<void>;
    
    // Add your contract methods here based on your implementation
}

export class ContractWrapper {
    contract: Contract & ContractMethods;

    constructor(
        account: Account,
        contractId: string,
        options: {
            viewMethods: string[];
            changeMethods: string[];
        }
    ) {
        this.contract = new Contract(account, contractId, options) as Contract & ContractMethods;
    }

    // Helper methods for common operations
    async getGreeting(): Promise<string> {
        return await this.contract.get_greeting();
    }

    async setGreeting(greeting: string): Promise<void> {
        return await this.contract.set_greeting({ greeting });
    }
}

// Factory function to create contract instance
export async function createContract(
    near: Near,
    accountId: string,
    contractId: string
): Promise<ContractWrapper> {
    const account = await near.account(accountId);
    
    return new ContractWrapper(account, contractId, {
        viewMethods: ['get_greeting'], // Add your view methods
        changeMethods: ['set_greeting'] // Add your change methods
    });
}

// Example usage:
// const near = await connect(config);
// const contract = await createContract(near, 'your-account.testnet', 'contract.testnet');
// const result = await contract.getGreeting();
`;
    fs.writeFileSync(path.join(bindingsPath, 'contract-bindings.ts'), bindingContent);
    vscode.window.showInformationMessage(`Contract bindings generated in ${outputDir}/`, 'Open File').then(selection => {
        if (selection === 'Open File') {
            vscode.workspace.openTextDocument(path.join(bindingsPath, 'contract-bindings.ts'))
                .then(doc => vscode.window.showTextDocument(doc));
        }
    });
}
//# sourceMappingURL=contractCommands.js.map