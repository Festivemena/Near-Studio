// src/providers/VisualDesignerProvider.ts
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { NearBuildSystem, BuildConfig } from '../build-system';

interface ComponentData {
    id: string;
    type: string;
    template: ComponentTemplate;
    x: number;
    y: number;
}

interface ComponentTemplate {
    title: string;
    content: string;
    properties: { [key: string]: any };
}

interface ContractDesign {
    components: ComponentData[];
    metadata: {
        name: string;
        version: string;
        language: 'rust' | 'javascript' | 'typescript';
        createdAt: string;
        updatedAt: string;
    };
}

export class VisualDesignProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'near-studio.visualDesigner';
    private _view?: vscode.WebviewView;
    private buildSystem: NearBuildSystem;
    private currentDesign: ContractDesign | null = null;

    public postMessage(message: any): void {
        this._view?.webview.postMessage(message);
    }

    public get isViewReady(): boolean {
        return this._view !== undefined;
    }

    constructor(private readonly _extensionUri: vscode.Uri) {
        this.buildSystem = new NearBuildSystem();
    }

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri]
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        // Handle messages from the webview
        webviewView.webview.onDidReceiveMessage(
            message => this.handleMessage(message),
            undefined,
            []
        );

        // Auto-save design when components change
        this.setupAutoSave();
    }

    private async handleMessage(message: any) {
        switch (message.command) {
            case 'generateCode':
                await this.generateContractCode(message.components, message.language);
                break;
            case 'saveDesign':
                await this.saveDesign(message.design);
                break;
            case 'loadDesign':
                await this.loadDesign();
                break;
            case 'exportDesign':
                await this.exportDesign(message.design);
                break;
            case 'buildContract':
                await this.buildGeneratedContract(message.components, message.language);
                break;
            case 'deployContract':
                await this.deployGeneratedContract(message.components, message.language);
                break;
            case 'createFromTemplate':
                await this.createFromTemplate(message.templateName);
                break;
            default:
                console.log('Unknown command:', message.command);
        }
    }

    private async generateContractCode(components: ComponentData[], language: 'rust' | 'javascript' | 'typescript') {
        try {
            let code = '';
            
            switch (language) {
                case 'rust':
                    code = this.generateRustContract(components);
                    break;
                case 'javascript':
                    code = this.generateJSContract(components, false);
                    break;
                case 'typescript':
                    code = this.generateJSContract(components, true);
                    break;
            }

            // Send generated code back to webview
            this._view?.webview.postMessage({
                command: 'codeGenerated',
                language: language,
                code: code
            });

            // Optionally save to workspace
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (workspaceFolder) {
                const fileName = `generated_contract.${language === 'rust' ? 'rs' : language === 'typescript' ? 'ts' : 'js'}`;
                const filePath = path.join(workspaceFolder.uri.fsPath, 'src', fileName);
                
                // Ensure src directory exists
                const srcDir = path.dirname(filePath);
                if (!fs.existsSync(srcDir)) {
                    fs.mkdirSync(srcDir, { recursive: true });
                }

                fs.writeFileSync(filePath, code);
                
                // Open the generated file
                const document = await vscode.workspace.openTextDocument(filePath);
                await vscode.window.showTextDocument(document);

                vscode.window.showInformationMessage(`Generated ${language} contract saved to ${fileName}`);
            }

        } catch (error) {
            vscode.window.showErrorMessage(`Failed to generate contract: ${error}`);
        }
    }

    private generateRustContract(components: ComponentData[]): string {
        const stateVars: string[] = [];
        const functions: string[] = [];
        const imports = new Set([
            'use near_sdk::borsh::{self, BorshDeserialize, BorshSerialize};',
            'use near_sdk::{env, near_bindgen, AccountId, PanicOnDefault};'
        ]);

        let initBody = '';
        let structName = 'Contract';

        // Extract contract name if specified
        const nameComponent = components.find(c => c.type === 'contract-name');
        if (nameComponent) {
            structName = nameComponent.template.properties.name || 'Contract';
        }

        components.forEach(component => {
            const props = component.template.properties;
            
            switch(component.type) {
                case 'state-variable':
                    stateVars.push(`    pub ${props.name}: ${props.type},`);
                    initBody += `            ${props.name}: ${this.getDefaultValue(props.type)},\n`;
                    break;
                    
                case 'mapping':
                    imports.add('use near_sdk::collections::UnorderedMap;');
                    stateVars.push(`    pub ${props.name}: UnorderedMap<${props.keyType}, ${props.valueType}>,`);
                    initBody += `            ${props.name}: UnorderedMap::new(b"${props.name.charAt(0)}"),\n`;
                    break;
                    
                case 'collection':
                    imports.add('use near_sdk::collections::Vector;');
                    stateVars.push(`    pub ${props.name}: Vector<${props.itemType}>,`);
                    initBody += `            ${props.name}: Vector::new(b"${props.name.charAt(0)}"),\n`;
                    break;
                    
                case 'view-method':
                    functions.push(this.generateRustViewMethod(props));
                    break;
                    
                case 'call-method':
                    functions.push(this.generateRustCallMethod(props));
                    break;
                    
                case 'payable-method':
                    functions.push(this.generateRustPayableMethod(props));
                    break;
                    
                case 'owner-check':
                    functions.push(`    fn assert_owner(&self) {
        assert_eq!(
            env::predecessor_account_id(),
            self.owner,
            "Only the owner can call this method"
        );
    }`);
                    break;
                    
                case 'event-log':
                    imports.add('use serde::{Deserialize, Serialize};');
                    functions.push(this.generateRustEventLog(props));
                    break;
            }
        });

        return `${Array.from(imports).join('\n')}

#[near_bindgen]
#[derive(BorshDeserialize, BorshSerialize, PanicOnDefault)]
pub struct ${structName} {
${stateVars.join('\n')}
}

#[near_bindgen]
impl ${structName} {
    #[init]
    pub fn new(owner: Option<AccountId>) -> Self {
        let owner = owner.unwrap_or_else(|| env::signer_account_id());
        Self {
            owner,
${initBody}        }
    }

${functions.join('\n\n')}
}

#[cfg(test)]
mod tests {
    use super::*;
    use near_sdk::test_utils::{accounts, VMContextBuilder};
    use near_sdk::testing_env;

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
        let contract = ${structName}::new(None);
        // Add your tests here
    }
}`;
    }

    private generateJSContract(components: ComponentData[], isTypeScript: boolean): string {
        const stateVars: string[] = [];
        const functions: string[] = [];
        const imports = ['import { NearBindgen, near, call, view, initialize } from \'near-sdk-js\';'];

        let className = 'Contract';
        const nameComponent = components.find(c => c.type === 'contract-name');
        if (nameComponent) {
            className = nameComponent.template.properties.name || 'Contract';
        }

        components.forEach(component => {
            const props = component.template.properties;
            
            switch(component.type) {
                case 'state-variable':
                    const type = isTypeScript ? `: ${this.jsTypeMapping(props.type)}` : '';
                    stateVars.push(`    ${props.name}${type} = ${this.getJSDefaultValue(props.type)};`);
                    break;
                    
                case 'mapping':
                    imports.push('import { UnorderedMap } from \'near-sdk-js\';');
                    const mapType = isTypeScript ? `: UnorderedMap<${this.jsTypeMapping(props.valueType)}>` : '';
                    stateVars.push(`    ${props.name}${mapType} = new UnorderedMap('${props.name.charAt(0)}');`);
                    break;
                    
                case 'view-method':
                    functions.push(this.generateJSViewMethod(props, isTypeScript));
                    break;
                    
                case 'call-method':
                    functions.push(this.generateJSCallMethod(props, isTypeScript));
                    break;
                    
                case 'payable-method':
                    functions.push(this.generateJSPayableMethod(props, isTypeScript));
                    break;
            }
        });

        const typeAnnotation = isTypeScript ? ' extends Contract' : '';

        return `${Array.from(new Set(imports)).join('\n')}

@NearBindgen({})
export class ${className}${typeAnnotation} {
${stateVars.join('\n')}

    @initialize({})
    init({ owner }${isTypeScript ? ': { owner?: string }' : ''}) {
        this.owner = owner || near.signerAccountId();
        // Initialize other state variables as needed
    }

${functions.join('\n\n')}
}`;
    }

    private generateRustViewMethod(props: any): string {
        const params = props.parameters ? `, ${props.parameters}` : '';
        const returnType = props.returnType || 'String';
        
        return `    pub fn ${props.name}(&self${params}) -> ${returnType} {
        // TODO: Implement ${props.description || 'view method'}
        ${this.getDefaultValue(returnType)}
    }`;
    }

    private generateRustCallMethod(props: any): string {
        const params = props.parameters ? `, ${props.parameters}` : '';
        
        return `    pub fn ${props.name}(&mut self${params}) {
        // TODO: Implement ${props.description || 'call method'}
        ${props.ownerOnly ? 'self.assert_owner();' : ''}
    }`;
    }

    private generateRustPayableMethod(props: any): string {
        const returnType = props.returnType || 'String';
        
        return `    #[payable]
    pub fn ${props.name}(&mut self) -> ${returnType} {
        let deposit = env::attached_deposit();
        let donor = env::predecessor_account_id();
        
        env::log_str(&format!(
            "PAYMENT_RECEIVED: {{\\\"donor\\\": \\\"{}\\\", \\\"amount\\\": \\\"{}\\\"}}",
            donor, deposit
        ));
        
        // TODO: Implement ${props.description || 'payable method'}
        format!("Received {} yoctoNEAR from {}", deposit, donor)
    }`;
    }

    private generateRustEventLog(props: any): string {
        return `    fn log_event(&self, event_type: &str, data: &str) {
        env::log_str(&format!(
            "EVENT: {{\\\"type\\\": \\\"{}\\\", \\\"data\\\": {}}}",
            event_type, data
        ));
    }`;
    }

    private generateJSViewMethod(props: any, isTypeScript: boolean): string {
        const params = props.parameters || '';
        const paramType = isTypeScript && params ? `: { ${params} }` : '';
        const returnType = isTypeScript ? `: ${this.jsTypeMapping(props.returnType || 'string')}` : '';
        
        return `    @view({})
    ${props.name}(${params ? `{ ${params} }` : ''}${paramType})${returnType} {
        // TODO: Implement ${props.description || 'view method'}
        return ${this.getJSDefaultValue(props.returnType || 'string')};
    }`;
    }

    private generateJSCallMethod(props: any, isTypeScript: boolean): string {
        const params = props.parameters || '';
        const paramType = isTypeScript && params ? `: { ${params} }` : '';
        
        return `    @call({})
    ${props.name}(${params ? `{ ${params} }` : ''}${paramType}) {
        // TODO: Implement ${props.description || 'call method'}
        ${props.ownerOnly ? 'this.assertOwner();' : ''}
    }`;
    }

    private generateJSPayableMethod(props: any, isTypeScript: boolean): string {
        const returnType = isTypeScript ? ': string' : '';
        
        return `    @call({ payableFunction: true })
    ${props.name}()${returnType} {
        const deposit = near.attachedDeposit();
        const donor = near.predecessorAccountId();
        
        near.log(\`PAYMENT_RECEIVED: {"donor": "\${donor}", "amount": "\${deposit}"}\`);
        
        // TODO: Implement ${props.description || 'payable method'}
        return \`Received \${deposit} yoctoNEAR from \${donor}\`;
    }`;
    }

    private getDefaultValue(type: string): string {
        switch (type) {
            case 'String': return '"".to_string()';
            case 'AccountId': return 'env::signer_account_id()';
            case 'u64': case 'u128': return '0';
            case 'bool': return 'false';
            default: return 'todo!()';
        }
    }

    private getJSDefaultValue(type: string): string {
        switch (type) {
            case 'string': return '""';
            case 'number': return '0';
            case 'boolean': return 'false';
            default: return 'null';
        }
    }

    private jsTypeMapping(rustType: string): string {
        switch (rustType) {
            case 'String': return 'string';
            case 'AccountId': return 'string';
            case 'u64': case 'u128': return 'string'; // NEAR uses string for big numbers
            case 'bool': return 'boolean';
            default: return 'any';
        }
    }

    private async saveDesign(design: ContractDesign) {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            vscode.window.showErrorMessage('No workspace folder found');
            return;
        }

        try {
            const designPath = path.join(workspaceFolder.uri.fsPath, '.vscode', 'near-design.json');
            const designDir = path.dirname(designPath);
            
            if (!fs.existsSync(designDir)) {
                fs.mkdirSync(designDir, { recursive: true });
            }

            design.metadata.updatedAt = new Date().toISOString();
            fs.writeFileSync(designPath, JSON.stringify(design, null, 2));
            
            this.currentDesign = design;
            vscode.window.showInformationMessage('Design saved successfully');
            
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to save design: ${error}`);
        }
    }

    private async loadDesign() {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) return;

        try {
            const designPath = path.join(workspaceFolder.uri.fsPath, '.vscode', 'near-design.json');
            
            if (fs.existsSync(designPath)) {
                const designData = fs.readFileSync(designPath, 'utf8');
                const design = JSON.parse(designData) as ContractDesign;
                
                this.currentDesign = design;
                this._view?.webview.postMessage({
                    command: 'loadDesign',
                    design: design
                });
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to load design: ${error}`);
        }
    }

    private async exportDesign(design: ContractDesign) {
        try {
            const uri = await vscode.window.showSaveDialog({
                defaultUri: vscode.Uri.file(`${design.metadata.name}-design.json`),
                filters: {
                    'JSON': ['json']
                }
            });

            if (uri) {
                fs.writeFileSync(uri.fsPath, JSON.stringify(design, null, 2));
                vscode.window.showInformationMessage('Design exported successfully');
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to export design: ${error}`);
        }
    }

    private async buildGeneratedContract(components: ComponentData[], language: 'rust' | 'javascript' | 'typescript') {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            vscode.window.showErrorMessage('No workspace folder found');
            return;
        }

        // First generate the code
        await this.generateContractCode(components, language);

        // Then build using existing build system
        const contractName = this.currentDesign?.metadata.name || 'generated_contract';
        const buildConfig: BuildConfig = {
            language: language,
            projectPath: workspaceFolder.uri.fsPath,
            contractName: contractName,
            outputPath: path.join(workspaceFolder.uri.fsPath, 'build'),
            optimization: true,
            debug: false
        };

        const success = await this.buildSystem.buildContract(buildConfig);
        
        if (success) {
            vscode.window.showInformationMessage('Contract built successfully!');
        }
    }

    private async deployGeneratedContract(components: ComponentData[], language: 'rust' | 'javascript' | 'typescript') {
        const config = vscode.workspace.getConfiguration('nearExtension');
        const network = config.get('network', 'testnet');
        const accountId = config.get('accountId', '');

        if (!accountId) {
            vscode.window.showErrorMessage('Please set your account ID in settings');
            return;
        }

        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            vscode.window.showErrorMessage('No workspace folder found');
            return;
        }

        const contractName = this.currentDesign?.metadata.name || 'generated_contract';
        const buildConfig: BuildConfig = {
            language: language,
            projectPath: workspaceFolder.uri.fsPath,
            contractName: contractName,
            outputPath: path.join(workspaceFolder.uri.fsPath, 'build'),
            optimization: true,
            debug: false
        };

        const success = await this.buildSystem.deployContract(buildConfig, accountId, network);
        
        if (success) {
            vscode.window.showInformationMessage(`Contract deployed to ${accountId} on ${network}!`);
        }
    }

    private async createFromTemplate(templateName: string) {
        // Pre-built contract templates
        const templates = {
            'simple-storage': {
                components: [
                    {
                        id: 'component-1',
                        type: 'state-variable',
                        template: {
                            title: 'Owner',
                            content: 'pub owner: AccountId',
                            properties: { name: 'owner', type: 'AccountId', description: 'Contract owner' }
                        },
                        x: 100,
                        y: 100
                    },
                    {
                        id: 'component-2',
                        type: 'mapping',
                        template: {
                            title: 'Data Storage',
                            content: 'pub data: UnorderedMap<String, String>',
                            properties: { name: 'data', keyType: 'String', valueType: 'String', description: 'Data storage' }
                        },
                        x: 100,
                        y: 200
                    }
                ],
                metadata: {
                    name: 'SimpleStorage',
                    version: '1.0.0',
                    language: 'rust' as const,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                }
            }
        };

        const template = templates[templateName as keyof typeof templates];
        if (template) {
            this._view?.webview.postMessage({
                command: 'loadTemplate',
                template: template
            });
        }
    }

    private setupAutoSave() {
        // Auto-save every 30 seconds when components change
        let saveTimeout: NodeJS.Timeout;
        
        this._view?.webview.onDidReceiveMessage(message => {
            if (message.command === 'componentsChanged') {
                clearTimeout(saveTimeout);
                saveTimeout = setTimeout(() => {
                    if (message.design) {
                        this.saveDesign(message.design);
                    }
                }, 30000); // 30 seconds delay
            }
        });
    }

    // Complete _getHtmlForWebview method for your VisualDesignerProvider class

private _getHtmlForWebview(webview: vscode.Webview): string {
    // Get VS Code theme
    const theme = vscode.window.activeColorTheme.kind === vscode.ColorThemeKind.Light ? 'light' : 'dark';
    
    return `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline';">
        <title>NEAR Contract Visual Designer</title>
        <style>
            :root {
                --vscode-font-family: var(--vscode-font-family);
                --primary-color: ${theme === 'dark' ? '#00d4ff' : '#0066cc'};
                --background-color: ${theme === 'dark' ? '#1e1e1e' : '#ffffff'};
                --surface-color: ${theme === 'dark' ? '#2d2d30' : '#f3f3f3'};
                --text-color: ${theme === 'dark' ? '#cccccc' : '#333333'};
                --border-color: ${theme === 'dark' ? '#3c3c3c' : '#e0e0e0'};
                --hover-color: ${theme === 'dark' ? '#094771' : '#e6f3ff'};
            }

            * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
            }

            body {
                font-family: var(--vscode-font-family), -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                background: var(--background-color);
                color: var(--text-color);
                height: 100vh;
                overflow: hidden;
                font-size: 13px;
            }

            .designer-container {
                display: flex;
                height: 100vh;
                flex-direction: column;
            }

            .designer-header {
                background: var(--surface-color);
                padding: 12px 16px;
                border-bottom: 1px solid var(--border-color);
                display: flex;
                justify-content: space-between;
                align-items: center;
            }

            .designer-title {
                font-weight: 600;
                color: var(--primary-color);
                font-size: 14px;
            }

            .header-actions {
                display: flex;
                gap: 8px;
            }

            .btn {
                padding: 6px 12px;
                border: 1px solid var(--border-color);
                border-radius: 3px;
                background: var(--surface-color);
                color: var(--text-color);
                cursor: pointer;
                font-size: 11px;
                text-transform: uppercase;
                font-weight: 500;
                letter-spacing: 0.5px;
                transition: all 0.2s ease;
            }

            .btn:hover {
                background: var(--hover-color);
                border-color: var(--primary-color);
            }

            .btn-primary {
                background: var(--primary-color);
                color: white;
                border-color: var(--primary-color);
            }

            .btn-primary:hover {
                opacity: 0.9;
            }

            .designer-main {
                display: flex;
                flex: 1;
                overflow: hidden;
            }

            .components-sidebar {
                width: 220px;
                background: var(--surface-color);
                border-right: 1px solid var(--border-color);
                overflow-y: auto;
                display: flex;
                flex-direction: column;
            }

            .sidebar-section {
                padding: 12px;
                border-bottom: 1px solid var(--border-color);
            }

            .section-title {
                font-size: 11px;
                font-weight: 600;
                text-transform: uppercase;
                letter-spacing: 0.5px;
                margin-bottom: 8px;
                opacity: 0.8;
            }

            .component-item {
                padding: 8px;
                margin-bottom: 4px;
                background: var(--background-color);
                border: 1px solid var(--border-color);
                border-radius: 3px;
                cursor: grab;
                transition: all 0.15s ease;
                user-select: none;
            }

            .component-item:hover {
                border-color: var(--primary-color);
                background: var(--hover-color);
            }

            .component-item:active {
                cursor: grabbing;
            }

            .component-name {
                font-size: 12px;
                font-weight: 500;
                margin-bottom: 2px;
            }

            .component-desc {
                font-size: 10px;
                opacity: 0.7;
                line-height: 1.3;
            }

            .canvas-area {
                flex: 1;
                display: flex;
                flex-direction: column;
                position: relative;
                overflow: hidden;
            }

            .canvas {
                flex: 1;
                background: var(--background-color);
                position: relative;
                overflow: auto;
                background-image: 
                    radial-gradient(circle, var(--border-color) 1px, transparent 1px);
                background-size: 20px 20px;
            }

            .drop-zone {
                min-height: 100%;
                position: relative;
                padding: 20px;
            }

            .canvas-placeholder {
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                text-align: center;
                opacity: 0.5;
                pointer-events: none;
            }

            .canvas-placeholder h3 {
                font-size: 18px;
                margin-bottom: 8px;
                color: var(--primary-color);
            }

            .canvas-placeholder p {
                font-size: 12px;
            }

            .dropped-component {
                position: absolute;
                background: var(--surface-color);
                border: 2px solid var(--primary-color);
                border-radius: 6px;
                padding: 12px;
                min-width: 160px;
                cursor: move;
                box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                transition: all 0.2s ease;
                user-select: none;
            }

            .dropped-component:hover {
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            }

            .dropped-component.selected {
                border-color: #ff6b35;
                box-shadow: 0 0 0 1px #ff6b35;
            }

            .component-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 8px;
            }

            .component-title {
                font-size: 12px;
                font-weight: 600;
                color: var(--primary-color);
            }

            .delete-btn {
                width: 16px;
                height: 16px;
                border: none;
                background: transparent;
                color: #ff6b6b;
                cursor: pointer;
                border-radius: 2px;
                font-size: 12px;
                opacity: 0.7;
                transition: opacity 0.2s ease;
            }

            .delete-btn:hover {
                opacity: 1;
                background: rgba(255, 107, 107, 0.1);
            }

            .component-content {
                font-size: 10px;
                font-family: 'Courier New', monospace;
                background: var(--background-color);
                padding: 6px;
                border-radius: 3px;
                border: 1px solid var(--border-color);
                overflow-x: auto;
            }

            .properties-panel {
                width: 240px;
                background: var(--surface-color);
                border-left: 1px solid var(--border-color);
                display: flex;
                flex-direction: column;
                overflow-y: auto;
            }

            .properties-header {
                padding: 12px;
                border-bottom: 1px solid var(--border-color);
            }

            .properties-title {
                font-size: 12px;
                font-weight: 600;
            }

            .properties-content {
                padding: 12px;
                flex: 1;
            }

            .property-group {
                margin-bottom: 12px;
            }

            .property-label {
                font-size: 10px;
                font-weight: 500;
                margin-bottom: 4px;
                text-transform: uppercase;
                letter-spacing: 0.5px;
                opacity: 0.8;
            }

            .property-input {
                width: 100%;
                padding: 6px 8px;
                background: var(--background-color);
                border: 1px solid var(--border-color);
                border-radius: 3px;
                color: var(--text-color);
                font-size: 11px;
                font-family: inherit;
            }

            .property-input:focus {
                outline: none;
                border-color: var(--primary-color);
                box-shadow: 0 0 0 1px var(--primary-color);
            }

            .property-textarea {
                resize: vertical;
                min-height: 60px;
                font-family: 'Courier New', monospace;
            }

            .drag-over {
                background: var(--hover-color) !important;
            }

            .status-bar {
                background: var(--surface-color);
                border-top: 1px solid var(--border-color);
                padding: 4px 12px;
                font-size: 10px;
                display: flex;
                justify-content: space-between;
                align-items: center;
            }

            .status-item {
                display: flex;
                align-items: center;
                gap: 4px;
            }

            .modal-overlay {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.5);
                display: none;
                align-items: center;
                justify-content: center;
                z-index: 1000;
            }

            .modal {
                background: var(--surface-color);
                border: 1px solid var(--border-color);
                border-radius: 6px;
                padding: 20px;
                max-width: 80%;
                max-height: 80%;
                overflow: auto;
            }

            .modal-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 16px;
            }

            .modal-title {
                font-size: 14px;
                font-weight: 600;
            }

            .code-preview {
                background: var(--background-color);
                border: 1px solid var(--border-color);
                border-radius: 3px;
                padding: 12px;
                font-family: 'Courier New', monospace;
                font-size: 11px;
                overflow-x: auto;
                white-space: pre;
                max-height: 400px;
            }

            .language-tabs {
                display: flex;
                gap: 4px;
                margin-bottom: 12px;
            }

            .language-tab {
                padding: 6px 12px;
                background: var(--background-color);
                border: 1px solid var(--border-color);
                border-radius: 3px 3px 0 0;
                cursor: pointer;
                font-size: 11px;
            }

            .language-tab.active {
                background: var(--primary-color);
                color: white;
                border-color: var(--primary-color);
            }

            .loading {
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 40px;
                font-size: 12px;
                opacity: 0.7;
            }

            .context-menu {
                position: fixed;
                background: var(--surface-color);
                border: 1px solid var(--border-color);
                border-radius: 3px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                z-index: 1001;
                display: none;
                min-width: 120px;
            }

            .context-menu-item {
                padding: 8px 12px;
                font-size: 11px;
                cursor: pointer;
                border-bottom: 1px solid var(--border-color);
            }

            .context-menu-item:last-child {
                border-bottom: none;
            }

            .context-menu-item:hover {
                background: var(--hover-color);
            }

            .connection-line {
                position: absolute;
                pointer-events: none;
                z-index: 1;
            }

            .connection-path {
                stroke: var(--primary-color);
                stroke-width: 2;
                fill: none;
                opacity: 0.6;
                stroke-dasharray: 5,5;
                animation: dash 1s linear infinite;
            }

            @keyframes dash {
                to {
                    stroke-dashoffset: -10;
                }
            }

            /* Scrollbar styles for VS Code compatibility */
            ::-webkit-scrollbar {
                width: 10px;
                height: 10px;
            }

            ::-webkit-scrollbar-track {
                background: var(--background-color);
            }

            ::-webkit-scrollbar-thumb {
                background: var(--border-color);
                border-radius: 5px;
            }

            ::-webkit-scrollbar-thumb:hover {
                background: var(--primary-color);
            }

            /* Animation for new components */
            @keyframes componentAppear {
                from {
                    opacity: 0;
                    transform: scale(0.8);
                }
                to {
                    opacity: 1;
                    transform: scale(1);
                }
            }

            .component-appear {
                animation: componentAppear 0.3s ease-out;
            }

            /* Responsive adjustments for smaller webview sizes */
            @media (max-width: 800px) {
                .designer-main {
                    flex-direction: column;
                }

                .components-sidebar {
                    width: 100%;
                    height: 150px;
                    border-right: none;
                    border-bottom: 1px solid var(--border-color);
                    flex-direction: row;
                    overflow-x: auto;
                }

                .sidebar-section {
                    min-width: 200px;
                    border-bottom: none;
                    border-right: 1px solid var(--border-color);
                }

                .properties-panel {
                    width: 100%;
                    height: 200px;
                    border-left: none;
                    border-top: 1px solid var(--border-color);
                }
            }

            /* Custom scrollbar for sections */
            .sidebar-section::-webkit-scrollbar,
            .properties-content::-webkit-scrollbar {
                width: 6px;
            }

            /* Focus styles for accessibility */
            .btn:focus,
            .property-input:focus {
                outline: 2px solid var(--primary-color);
                outline-offset: 2px;
            }

            /* Drag preview styles */
            .dragging-preview {
                opacity: 0.8;
                transform: rotate(5deg);
                z-index: 1000;
            }
        </style>
    </head>
    <body>
        <div class="designer-container">
            <!-- Header -->
            <div class="designer-header">
                <div class="designer-title">NEAR Contract Visual Designer</div>
                <div class="header-actions">
                    <button class="btn" onclick="loadTemplate()">Templates</button>
                    <button class="btn" onclick="validateDesign()">Validate</button>
                    <button class="btn" onclick="exportDesign()">Export</button>
                    <button class="btn btn-primary" onclick="generateCode()">Generate Code</button>
                </div>
            </div>

            <!-- Main Content -->
            <div class="designer-main">
                <!-- Components Sidebar -->
                <div class="components-sidebar">
                    <div class="sidebar-section">
                        <div class="section-title">State Management</div>
                        <div class="component-item" draggable="true" data-component="state-variable">
                            <div class="component-name">State Variable</div>
                            <div class="component-desc">Store contract state</div>
                        </div>
                        <div class="component-item" draggable="true" data-component="mapping">
                            <div class="component-name">Mapping</div>
                            <div class="component-desc">Key-value storage</div>
                        </div>
                        <div class="component-item" draggable="true" data-component="collection">
                            <div class="component-name">Collection</div>
                            <div class="component-desc">Array/Vector storage</div>
                        </div>
                    </div>

                    <div class="sidebar-section">
                        <div class="section-title">Functions</div>
                        <div class="component-item" draggable="true" data-component="view-method">
                            <div class="component-name">View Method</div>
                            <div class="component-desc">Read-only function</div>
                        </div>
                        <div class="component-item" draggable="true" data-component="call-method">
                            <div class="component-name">Call Method</div>
                            <div class="component-desc">State-changing function</div>
                        </div>
                        <div class="component-item" draggable="true" data-component="payable-method">
                            <div class="component-name">Payable Method</div>
                            <div class="component-desc">Accepts token payments</div>
                        </div>
                    </div>

                    <div class="sidebar-section">
                        <div class="section-title">Access Control</div>
                        <div class="component-item" draggable="true" data-component="owner-check">
                            <div class="component-name">Owner Check</div>
                            <div class="component-desc">Restrict to owner</div>
                        </div>
                        <div class="component-item" draggable="true" data-component="role-based">
                            <div class="component-name">Role-Based Access</div>
                            <div class="component-desc">Multi-role access</div>
                        </div>
                    </div>

                    <div class="sidebar-section">
                        <div class="section-title">Events & Logging</div>
                        <div class="component-item" draggable="true" data-component="event-log">
                            <div class="component-name">Event Log</div>
                            <div class="component-desc">Emit contract events</div>
                        </div>
                    </div>
                </div>

                <!-- Canvas Area -->
                <div class="canvas-area">
                    <div class="canvas" id="canvas">
                        <div class="drop-zone" id="dropZone">
                            <div class="canvas-placeholder" id="placeholder">
                                <h3>Start Building</h3>
                                <p>Drag components from the left to begin designing your NEAR smart contract</p>
                            </div>
                        </div>
                        <svg id="connectionSvg" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none;"></svg>
                    </div>
                </div>

                <!-- Properties Panel -->
                <div class="properties-panel">
                    <div class="properties-header">
                        <div class="properties-title">Properties</div>
                    </div>
                    <div class="properties-content" id="propertiesContent">
                        <div style="text-align: center; opacity: 0.5; margin-top: 40px;">
                            <p>Select a component to edit its properties</p>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Status Bar -->
            <div class="status-bar">
                <div class="status-item">
                    <span id="componentCount">0 components</span>
                </div>
                <div class="status-item">
                    <span id="designStatus">Ready</span>
                </div>
            </div>
        </div>

        <!-- Modal for Code Generation -->
        <div class="modal-overlay" id="codeModal">
            <div class="modal">
                <div class="modal-header">
                    <div class="modal-title">Generated Contract Code</div>
                    <button class="btn" onclick="closeCodeModal()">×</button>
                </div>
                <div class="language-tabs">
                    <div class="language-tab active" onclick="switchLanguageTab('rust')">Rust</div>
                    <div class="language-tab" onclick="switchLanguageTab('javascript')">JavaScript</div>
                    <div class="language-tab" onclick="switchLanguageTab('typescript')">TypeScript</div>
                </div>
                <div class="code-preview" id="codePreview">
                    <div class="loading">Generating code...</div>
                </div>
                <div style="display: flex; gap: 8px; margin-top: 16px; justify-content: flex-end;">
                    <button class="btn" onclick="copyCode()">Copy Code</button>
                    <button class="btn" onclick="saveToFile()">Save to File</button>
                    <button class="btn btn-primary" onclick="buildContract()">Build Contract</button>
                </div>
            </div>
        </div>

        <!-- Context Menu -->
        <div class="context-menu" id="contextMenu">
            <div class="context-menu-item" onclick="duplicateComponent()">Duplicate</div>
            <div class="context-menu-item" onclick="editComponent()">Edit Properties</div>
            <div class="context-menu-item" onclick="deleteComponent()">Delete</div>
        </div>

        <script>
            // VS Code API
            const vscode = acquireVsCodeApi();
            
            // State management
            let components = [];
            let selectedComponent = null;
            let componentCounter = 0;
            let isDragging = false;
            let dragOffset = { x: 0, y: 0 };
            let currentLanguage = 'rust';
            let generatedCode = {};

            // Component templates
            const componentTemplates = {
                'state-variable': {
                    title: 'State Variable',
                    content: 'pub owner: AccountId',
                    properties: {
                        name: 'owner',
                        type: 'AccountId',
                        visibility: 'public',
                        description: 'Contract owner account ID'
                    }
                },
                'mapping': {
                    title: 'Mapping',
                    content: 'pub data: UnorderedMap<String, String>',
                    properties: {
                        name: 'data',
                        keyType: 'String',
                        valueType: 'String',
                        description: 'Key-value storage mapping'
                    }
                },
                'collection': {
                    title: 'Collection',
                    content: 'pub items: Vector<String>',
                    properties: {
                        name: 'items',
                        itemType: 'String',
                        description: 'Collection of items'
                    }
                },
                'view-method': {
                    title: 'View Method',
                    content: 'pub fn get_data(&self) -> String',
                    properties: {
                        name: 'get_data',
                        returnType: 'String',
                        parameters: '',
                        description: 'Retrieve data from contract'
                    }
                },
                'call-method': {
                    title: 'Call Method',
                    content: 'pub fn set_data(&mut self, value: String)',
                    properties: {
                        name: 'set_data',
                        parameters: 'value: String',
                        mutability: 'mutable',
                        ownerOnly: false,
                        description: 'Update contract state'
                    }
                },
                'payable-method': {
                    title: 'Payable Method',
                    content: '#[payable] pub fn donate(&mut self) -> String',
                    properties: {
                        name: 'donate',
                        returnType: 'String',
                        mutability: 'mutable',
                        description: 'Accept token payments'
                    }
                },
                'owner-check': {
                    title: 'Owner Check',
                    content: 'fn assert_owner(&self)',
                    properties: {
                        name: 'assert_owner',
                        description: 'Restrict access to contract owner'
                    }
                },
                'event-log': {
                    title: 'Event Log',
                    content: 'fn log_event(&self, event_type: &str, data: &str)',
                    properties: {
                        name: 'log_event',
                        description: 'Emit contract events'
                    }
                }
            };

            // Initialize drag and drop
            function initializeDragDrop() {
                const componentItems = document.querySelectorAll('.component-item');
                const dropZone = document.getElementById('dropZone');

                componentItems.forEach(item => {
                    item.addEventListener('dragstart', handleDragStart);
                });

                dropZone.addEventListener('dragover', handleDragOver);
                dropZone.addEventListener('drop', handleDrop);
                dropZone.addEventListener('dragenter', handleDragEnter);
                dropZone.addEventListener('dragleave', handleDragLeave);
            }

            function handleDragStart(e) {
                const componentType = e.target.closest('.component-item').dataset.component;
                e.dataTransfer.setData('text/plain', componentType);
                e.dataTransfer.effectAllowed = 'copy';
                e.target.classList.add('dragging-preview');
            }

            function handleDragOver(e) {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'copy';
            }

            function handleDragEnter(e) {
                e.preventDefault();
                e.target.closest('.drop-zone').classList.add('drag-over');
            }

            function handleDragLeave(e) {
                if (!e.target.closest('.drop-zone').contains(e.relatedTarget)) {
                    e.target.closest('.drop-zone').classList.remove('drag-over');
                }
            }

            function handleDrop(e) {
                e.preventDefault();
                const dropZone = e.target.closest('.drop-zone');
                dropZone.classList.remove('drag-over');
                
                // Remove dragging preview class
                document.querySelectorAll('.dragging-preview').forEach(el => {
                    el.classList.remove('dragging-preview');
                });

                const componentType = e.dataTransfer.getData('text/plain');
                const rect = dropZone.getBoundingClientRect();
                const x = e.clientX - rect.left - 80;
                const y = e.clientY - rect.top - 30;

                createComponent(componentType, x, y);
                updateStatus();
            }

            function createComponent(type, x, y) {
                const template = componentTemplates[type];
                if (!template) return;

                componentCounter++;
                const componentId = \`component-\${componentCounter}\`;

                const component = document.createElement('div');
                component.className = 'dropped-component component-appear';
                component.id = componentId;
                component.style.left = \`\${Math.max(0, x)}px\`;
                component.style.top = \`\${Math.max(0, y)}px\`;

                component.innerHTML = \`
                    <div class="component-header">
                        <div class="component-title">\${template.title}</div>
                        <button class="delete-btn" onclick="deleteComponent('\${componentId}')">×</button>
                    </div>
                    <div class="component-content">\${template.content}</div>
                \`;

                // Make component interactive
                component.addEventListener('mousedown', handleComponentMouseDown);
                component.addEventListener('click', (e) => {
                    e.stopPropagation();
                    selectComponent(componentId, type);
                });
                component.addEventListener('contextmenu', (e) => {
                    e.preventDefault();
                    showContextMenu(e.pageX, e.pageY, componentId);
                });

                document.getElementById('dropZone').appendChild(component);

                // Store component data
                components.push({
                    id: componentId,
                    type: type,
                    template: { ...template },
                    x: Math.max(0, x),
                    y: Math.max(0, y)
                });

                // Hide placeholder
                const placeholder = document.getElementById('placeholder');
                if (placeholder) {
                    placeholder.style.display = 'none';
                }

                // Auto-select new component
                selectComponent(componentId, type);
                
                // Save design
                saveCurrentDesign();
            }

            function selectComponent(componentId, type) {
                // Clear previous selection
                document.querySelectorAll('.dropped-component').forEach(c => {
                    c.classList.remove('selected');
                });

                // Select component
                const component = document.getElementById(componentId);
                if (component) {
                    component.classList.add('selected');
                    selectedComponent = componentId;

                    // Show properties
                    showProperties(componentId, type);
                }
            }

            function showProperties(componentId, type) {
                const componentData = components.find(c => c.id === componentId);
                if (!componentData) return;

                const template = componentData.template;
                const propertiesContent = document.getElementById('propertiesContent');
                
                let html = \`
                    <div class="property-group">
                        <div class="property-label">Component ID</div>
                        <input type="text" class="property-input" value="\${componentId}" readonly>
                    </div>
                \`;

                // Generate property inputs
                Object.entries(template.properties).forEach(([key, value]) => {
                    const inputType = typeof value === 'boolean' ? 'checkbox' : 'text';
                    const inputValue = typeof value === 'boolean' ? (value ? 'checked' : '') : value;
                    
                    html += \`
                        <div class="property-group">
                            <div class="property-label">\${key.charAt(0).toUpperCase() + key.slice(1)}</div>
                            <input type="\${inputType}" class="property-input" 
                                   value="\${inputValue}" 
                                   \${typeof value === 'boolean' ? inputValue : ''}
                                   onchange="updateComponentProperty('\${componentId}', '\${key}', this\${typeof value === 'boolean' ? '.checked' : '.value'})">
                        </div>
                    \`;
                });

                propertiesContent.innerHTML = html;
            }

            function updateComponentProperty(componentId, property, value) {
                const componentData = components.find(c => c.id === componentId);
                if (componentData) {
                    componentData.template.properties[property] = value;
                    
                    // Update visual content if name changed
                    if (property === 'name') {
                        updateComponentVisual(componentId);
                    }
                    
                    saveCurrentDesign();
                }
            }

            function updateComponentVisual(componentId) {
                const componentData = components.find(c => c.id === componentId);
                const component = document.getElementById(componentId);
                
                if (componentData && component) {
                    const props = componentData.template.properties;
                    const content = component.querySelector('.component-content');
                    
                    // Update content based on component type
                    switch (componentData.type) {
                        case 'state-variable':
                            content.textContent = \`pub \${props.name}: \${props.type}\`;
                            break;
                        case 'mapping':
                            content.textContent = \`pub \${props.name}: UnorderedMap<\${props.keyType}, \${props.valueType}>\`;
                            break;
                        case 'view-method':
                            content.textContent = \`pub fn \${props.name}(&self) -> \${props.returnType}\`;
                            break;
                        case 'call-method':
                            content.textContent = \`pub fn \${props.name}(&mut self\${props.parameters ? ', ' + props.parameters : ''})\`;
                            break;
                        case 'payable-method':
                            content.textContent = \`#[payable] pub fn \${props.name}(&mut self) -> \${props.returnType || 'String'}\`;
                            break;
                        default:
                            break;
                    }
                }
            }

            function handleComponentMouseDown(e) {
                if (e.button !== 0) return;
                
                const component = e.currentTarget;
                isDragging = true;
                selectedComponent = component.id;

                const rect = component.getBoundingClientRect();
                const dropZoneRect = document.getElementById('dropZone').getBoundingClientRect();
                
                dragOffset.x = e.clientX - rect.left;
                dragOffset.y = e.clientY - rect.top;

                document.addEventListener('mousemove', handleComponentDrag);
                document.addEventListener('mouseup', handleComponentDragEnd);
            }

            function handleComponentDrag(e) {
                if (!isDragging || !selectedComponent) return;

                const component = document.getElementById(selectedComponent);
                if (!component) return;

                const dropZoneRect = document.getElementById('dropZone').getBoundingClientRect();

                const newX = Math.max(0, e.clientX - dropZoneRect.left - dragOffset.x);
                const newY = Math.max(0, e.clientY - dropZoneRect.top - dragOffset.y);

                component.style.left = \`\${newX}px\`;
                component.style.top = \`\${newY}px\`;

                // Update component data
                const componentData = components.find(c => c.id === selectedComponent);
                if (componentData) {
                    componentData.x = newX;
                    componentData.y = newY;
                }
            }

            function handleComponentDragEnd() {
                if (isDragging) {
                    saveCurrentDesign();
                }
                
                isDragging = false;
                document.removeEventListener('mousemove', handleComponentDrag);
                document.removeEventListener('mouseup', handleComponentDragEnd);
            }

            function deleteComponent(componentId) {
                const component = document.getElementById(componentId);
                if (component) {
                    component.remove();
                    components = components.filter(c => c.id !== componentId);
                    
                    if (selectedComponent === componentId) {
                        selectedComponent = null;
                    }
                    
                    if (components.length === 0) {
                        document.getElementById('placeholder').style.display = 'block';
                    }
                    
                    clearProperties();
                    updateStatus();
                    saveCurrentDesign();
                }
            }

            function clearProperties() {
                document.getElementById('propertiesContent').innerHTML = \`
                    <div style="text-align: center; opacity: 0.5; margin-top: 40px;">
                        <p>Select a component to edit its properties</p>
                    </div>
                \`;
            }

            function updateStatus() {
                const count = components.length;
                document.getElementById('componentCount').textContent = \`\${count} component\${count !== 1 ? 's' : ''}\`;
            }

            function showContextMenu(x, y, componentId) {
                const contextMenu = document.getElementById('contextMenu');
                contextMenu.style.left = \`\${x}px\`;
                contextMenu.style.top = \`\${y}px\`;
                contextMenu.style.display = 'block';
                contextMenu.dataset.targetComponent = componentId;

                setTimeout(() => {
                    document.addEventListener('click', hideContextMenu, { once: true });
                }, 10);
            }

            function hideContextMenu() {
                document.getElementById('contextMenu').style.display = 'none';
            }

            function duplicateComponent() {
                const contextMenu = document.getElementById('contextMenu');
                const componentId = contextMenu.dataset.targetComponent;
                const componentData = components.find(c => c.id === componentId);
                
                if (componentData) {
                    createComponent(componentData.type, componentData.x + 20, componentData.y + 20);
                }
                hideContextMenu();
            }

            function editComponent() {
                const contextMenu = document.getElementById('contextMenu');
                const componentId = contextMenu.dataset.targetComponent;
                const componentData = components.find(c => c.id === componentId);
                if (componentData) {
                    selectComponent(componentId, componentData.type);
                }
                hideContextMenu();
            }

            // VS Code Integration Functions
            function generateCode() {
                if (components.length === 0) {
                    vscode.postMessage({
                        command: 'showMessage',
                        type: 'warning',
                        message: 'Please add some components first!'
                    });
                    return;
                }

                vscode.postMessage({
                    command: 'generateCode',
                    components: components,
                    language: currentLanguage
                });

                // Show modal
                document.getElementById('codeModal').style.display = 'flex';
                document.getElementById('designStatus').textContent = 'Generating code...';
            }

            function loadTemplate() {
                vscode.postMessage({
                    command: 'showTemplates'
                });
            }

            function validateDesign() {
                // Basic validation
                let errors = [];
                let warnings = [];

                if (components.length === 0) {
                    errors.push('Contract has no components');
                }

                const hasOwner = components.some(c => 
                    c.template.properties.name === 'owner' || c.type === 'owner-check'
                );
                if (!hasOwner) {
                    warnings.push('Consider adding owner access control');
                }

                const hasMethods = components.some(c => 
                    c.type.includes('method')
                );
                if (!hasMethods) {
                    warnings.push('Contract has no methods');
                }

                // Check for duplicate method names
                const methodNames = components
                    .filter(c => c.type.includes('method'))
                    .map(c => c.template.properties.name);
                const duplicates = methodNames.filter((name, index) => methodNames.indexOf(name) !== index);
                if (duplicates.length > 0) {
                    errors.push(\`Duplicate method names: \${[...new Set(duplicates)].join(', ')}\`);
                }

                let status = 'Valid';
                if (errors.length > 0) {
                    status = \`\${errors.length} error\${errors.length !== 1 ? 's' : ''}\`;
                    vscode.postMessage({
                        command: 'showMessage',
                        type: 'error',
                        message: 'Validation failed: ' + errors.join(', ')
                    });
                } else if (warnings.length > 0) {
                    status = \`\${warnings.length} warning\${warnings.length !== 1 ? 's' : ''}\`;
                    vscode.postMessage({
                        command: 'showMessage',
                        type: 'warning',
                        message: 'Validation warnings: ' + warnings.join(', ')
                    });
                } else {
                    vscode.postMessage({
                        command: 'showMessage',
                        type: 'info',
                        message: 'Design validation passed!'
                    });
                }

                document.getElementById('designStatus').textContent = status;
            }

            function exportDesign() {
                const design = {
                    components: components,
                    metadata: {
                        name: 'GeneratedContract',
                        version: '1.0.0',
                        language: currentLanguage,
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString()
                    }
                };

                vscode.postMessage({
                    command: 'exportDesign',
                    design: design
                });
            }

            function saveCurrentDesign() {
                const design = {
                    components: components,
                    metadata: {
                        name: 'GeneratedContract',
                        version: '1.0.0',
                        language: currentLanguage,
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString()
                    }
                };

                vscode.postMessage({
                    command: 'saveDesign',
                    design: design
                });

                // Notify about component changes for auto-save
                vscode.postMessage({
                    command: 'componentsChanged',
                    design: design
                });
            }

            function switchLanguageTab(language) {
                currentLanguage = language;
                
                // Update tab appearance
                document.querySelectorAll('.language-tab').forEach(tab => {
                    tab.classList.remove('active');
                });
                event.target.classList.add('active');

                // Update code preview
                if (generatedCode[language]) {
                    document.getElementById('codePreview').textContent = generatedCode[language];
                } else {
                    document.getElementById('codePreview').innerHTML = '<div class="loading">Generating code...</div>';
                    vscode.postMessage({
                        command: 'generateCode',
                        components: components,
                        language: language
                    });
                }
            }

            function closeCodeModal() {
                document.getElementById('codeModal').style.display = 'none';
            }

            function copyCode() {
                const code = generatedCode[currentLanguage];
                if (code && navigator.clipboard) {
                    navigator.clipboard.writeText(code).then(() => {
                        vscode.postMessage({
                            command: 'showMessage',
                            type: 'info',
                            message: 'Code copied to clipboard!'
                        });
                    }).catch(() => {
                        // Fallback for older browsers
                        const textArea = document.createElement('textarea');
                        textArea.value = code;
                        document.body.appendChild(textArea);
                        textArea.select();
                        document.execCommand('copy');
                        document.body.removeChild(textArea);
                        vscode.postMessage({
                            command: 'showMessage',
                            type: 'info',
                            message: 'Code copied to clipboard!'
                        });
                    });
                }
            }

            function saveToFile() {
                vscode.postMessage({
                    command: 'generateCode',
                    components: components,
                    language: currentLanguage
                });
            }

            function buildContract() {
                vscode.postMessage({
                    command: 'buildContract',
                    components: components,
                    language: currentLanguage
                });
                closeCodeModal();
            }

            // Handle messages from VS Code
            window.addEventListener('message', event => {
                const message = event.data;
                
                switch (message.command) {
                    case 'codeGenerated':
                        generatedCode[message.language] = message.code;
                        if (message.language === currentLanguage) {
                            document.getElementById('codePreview').textContent = message.code;
                        }
                        document.getElementById('designStatus').textContent = 'Code generated';
                        break;
                        
                    case 'loadDesign':
                        if (message.design) {
                            loadDesignData(message.design);
                        }
                        break;
                        
                    case 'loadTemplate':
                        if (message.template) {
                            loadTemplateData(message.template);
                        }
                        break;
                        
                    case 'importDesign':
                        if (message.design) {
                            loadDesignData(message.design);
                        }
                        break;

                    case 'showMessage':
                        // Handle messages sent from extension to webview
                        console.log('Message from extension:', message);
                        break;
                }
            });

            function loadDesignData(design) {
                // Clear existing components
                components.forEach(c => {
                    const element = document.getElementById(c.id);
                    if (element) element.remove();
                });
                
                components = [];
                componentCounter = 0;
                
                // Load new components
                if (design.components && design.components.length > 0) {
                    design.components.forEach(compData => {
                        componentCounter++;
                        const component = document.createElement('div');
                        component.className = 'dropped-component';
                        component.id = compData.id || \`component-\${componentCounter}\`;
                        component.style.left = \`\${compData.x || 50}px\`;
                        component.style.top = \`\${compData.y || 50}px\`;

                        component.innerHTML = \`
                            <div class="component-header">
                                <div class="component-title">\${compData.template.title}</div>
                                <button class="delete-btn" onclick="deleteComponent('\${component.id}')">×</button>
                            </div>
                            <div class="component-content">\${compData.template.content}</div>
                        \`;

                        // Make component interactive
                        component.addEventListener('mousedown', handleComponentMouseDown);
                        component.addEventListener('click', (e) => {
                            e.stopPropagation();
                            selectComponent(component.id, compData.type);
                        });
                        component.addEventListener('contextmenu', (e) => {
                            e.preventDefault();
                            showContextMenu(e.pageX, e.pageY, component.id);
                        });

                        document.getElementById('dropZone').appendChild(component);
                        components.push({
                            id: component.id,
                            type: compData.type,
                            template: compData.template,
                            x: compData.x || 50,
                            y: compData.y || 50
                        });
                    });
                }

                // Update UI
                if (components.length > 0) {
                    document.getElementById('placeholder').style.display = 'none';
                } else {
                    document.getElementById('placeholder').style.display = 'block';
                }
                
                updateStatus();
                clearProperties();
            }

            function loadTemplateData(template) {
                loadDesignData(template);
                vscode.postMessage({
                    command: 'showMessage',
                    type: 'info',
                    message: \`Template "\${template.metadata?.name || 'Unknown'}" loaded successfully!\`
                });
            }

            // Initialize the designer
            document.addEventListener('DOMContentLoaded', function() {
                initializeDragDrop();
                updateStatus();

                // Clear selection when clicking on canvas
                document.getElementById('dropZone').addEventListener('click', (e) => {
                    if (e.target === e.currentTarget || e.target.classList.contains('canvas-placeholder')) {
                        selectedComponent = null;
                        document.querySelectorAll('.dropped-component').forEach(c => {
                            c.classList.remove('selected');
                        });
                        clearProperties();
                    }
                });

                // Keyboard shortcuts
                document.addEventListener('keydown', (e) => {
                    if (e.key === 'Delete' && selectedComponent) {
                        deleteComponent(selectedComponent);
                    }
                    if (e.key === 'Escape') {
                        hideContextMenu();
                        closeCodeModal();
                    }
                    if (e.ctrlKey || e.metaKey) {
                        switch(e.key) {
                            case 's':
                                e.preventDefault();
                                saveCurrentDesign();
                                break;
                            case 'g':
                                e.preventDefault();
                                generateCode();
                                break;
                            case 'd':
                                e.preventDefault();
                                if (selectedComponent) {
                                    const componentData = components.find(c => c.id === selectedComponent);
                                    if (componentData) {
                                        createComponent(componentData.type, componentData.x + 20, componentData.y + 20);
                                    }
                                }
                                break;
                            case 'a':
                                e.preventDefault();
                                // Select all components
                                if (components.length > 0) {
                                    components.forEach(c => {
                                        const element = document.getElementById(c.id);
                                        if (element) element.classList.add('selected');
                                    });
                                }
                                break;
                        }
                    }
                });

                // Auto-save every 30 seconds
                setInterval(() => {
                    if (components.length > 0) {
                        saveCurrentDesign();
                    }
                }, 30000);

                // Load existing design if available
                vscode.postMessage({
                    command: 'loadDesign'
                });

                // Initial status
                document.getElementById('designStatus').textContent = 'Ready';
            });

            // Expose global functions for debugging and external access
            window.designerAPI = {
                getComponents: () => components,
                addComponent: createComponent,
                clearAll: () => {
                    components.forEach(c => {
                        const element = document.getElementById(c.id);
                        if (element) element.remove();
                    });
                    components = [];
                    componentCounter = 0;
                    selectedComponent = null;
                    updateStatus();
                    clearProperties();
                    document.getElementById('placeholder').style.display = 'block';
                    saveCurrentDesign();
                },
                exportDesign: () => ({
                    components: components,
                    metadata: {
                        name: 'GeneratedContract',
                        version: '1.0.0',
                        language: currentLanguage,
                        createdAt: new Date().toISOString()
                    }
                }),
                loadDesign: loadDesignData,
                validateDesign: validateDesign,
                generateCode: generateCode
            };

            // Log initialization
            console.log('NEAR Contract Visual Designer initialized');
        </script>
    </body>
    </html>`;
}

    public dispose(): void {
        this.buildSystem.dispose();
    }
}