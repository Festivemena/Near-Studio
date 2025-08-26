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
exports.ContractAnalyzer = exports.SecurityAnalyzer = exports.GasProfiler = void 0;
// src/analysis/GasProfiler.ts
const vscode = __importStar(require("vscode"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const child_process_1 = require("child_process");
const util_1 = require("util");
const execAsync = (0, util_1.promisify)(child_process_1.exec);
class GasProfiler {
    constructor() {
        this.outputChannel = vscode.window.createOutputChannel('NEAR Gas Profiler');
        this.diagnosticCollection = vscode.languages.createDiagnosticCollection('near-gas');
    }
    async analyzeContract(filePath, language) {
        this.outputChannel.clear();
        this.outputChannel.appendLine(`Analyzing gas usage for ${path.basename(filePath)}`);
        try {
            switch (language) {
                case 'rust':
                    return await this.analyzeRustContract(filePath);
                case 'javascript':
                case 'typescript':
                    return await this.analyzeJSContract(filePath);
                default:
                    throw new Error(`Unsupported language: ${language}`);
            }
        }
        catch (error) {
            this.outputChannel.appendLine(`Gas analysis failed: ${error}`);
            return [];
        }
    }
    async analyzeRustContract(filePath) {
        const content = fs.readFileSync(filePath, 'utf8');
        const analyses = [];
        // Parse Rust contract methods
        const methodRegex = /(?:pub\s+)?fn\s+(\w+)\s*\([^)]*\)\s*(?:->[^{]*)?{([^}]*(?:{[^}]*}[^}]*)*?)}/g;
        let match;
        while ((match = methodRegex.exec(content)) !== null) {
            const methodName = match[1];
            const methodBody = match[2];
            const analysis = await this.analyzeMethod(methodName, methodBody, 'rust');
            analyses.push(analysis);
        }
        return analyses;
    }
    async analyzeJSContract(filePath) {
        const content = fs.readFileSync(filePath, 'utf8');
        const analyses = [];
        // Parse JS/TS contract methods with decorators
        const methodRegex = /@(?:call|view)\s*\([^)]*\)\s*(?:async\s+)?(\w+)\s*\([^)]*\)\s*(?::\s*[^{]+)?{([^}]*(?:{[^}]*}[^}]*)*?)}/g;
        let match;
        while ((match = methodRegex.exec(content)) !== null) {
            const methodName = match[1];
            const methodBody = match[2];
            const analysis = await this.analyzeMethod(methodName, methodBody, 'javascript');
            analyses.push(analysis);
        }
        return analyses;
    }
    async analyzeMethod(methodName, methodBody, language) {
        let estimatedGas = BigInt(2500000); // Base gas cost
        const optimizations = [];
        const warnings = [];
        // Gas cost analysis patterns
        const gasCostPatterns = [
            // Storage operations
            { pattern: /\.insert\(|\.set\(|storage_write/g, cost: BigInt(5000000), desc: 'Storage write operation' },
            { pattern: /\.get\(|\.contains_key\(|storage_read/g, cost: BigInt(750000), desc: 'Storage read operation' },
            { pattern: /\.remove\(|storage_remove/g, cost: BigInt(5000000), desc: 'Storage removal operation' },
            // Loops and iterations
            { pattern: /for\s+\w+\s+in|while\s*\(|\.iter\(\)|\.forEach\(|\.map\(/g, cost: BigInt(1000000), desc: 'Loop iteration' },
            // String operations
            { pattern: /\.to_string\(\)|String::from|format!\(|\.clone\(\)/g, cost: BigInt(500000), desc: 'String allocation' },
            // Cross-contract calls
            { pattern: /Promise\.create|ext_|near\.promiseBatchCreate/g, cost: BigInt(25000000), desc: 'Cross-contract call' },
            // Mathematical operations
            { pattern: /\.pow\(|\.sqrt\(|BigInt/g, cost: BigInt(200000), desc: 'Mathematical operation' },
            // Vector operations
            { pattern: /\.push\(|\.extend\(|vec!\[/g, cost: BigInt(300000), desc: 'Vector operation' }
        ];
        // Calculate estimated gas
        for (const pattern of gasCostPatterns) {
            const matches = methodBody.match(pattern.pattern);
            if (matches) {
                estimatedGas += pattern.cost * BigInt(matches.length);
            }
        }
        // Generate optimizations based on patterns found
        if (methodBody.includes('.clone()') && language === 'rust') {
            optimizations.push('Consider using references (&) instead of cloning values');
        }
        if (methodBody.includes('for') && methodBody.includes('.get(')) {
            optimizations.push('Consider batching storage reads outside of loops');
        }
        if (methodBody.includes('String::from') || methodBody.includes('.to_string()')) {
            optimizations.push('Use string literals (&str) when possible to avoid allocations');
        }
        if (methodBody.includes('.forEach') || methodBody.includes('.map')) {
            optimizations.push('Consider using for-loops for better gas efficiency in blockchain context');
        }
        // Generate warnings
        if (estimatedGas > BigInt(100000000)) {
            warnings.push('Method may exceed gas limit for single transaction');
        }
        if (methodBody.includes('while') && !methodBody.includes('panic') && !methodBody.includes('assert')) {
            warnings.push('Unbounded loop detected - add safety checks to prevent infinite loops');
        }
        // Determine complexity
        let complexity = 'LOW';
        if (estimatedGas > BigInt(10000000))
            complexity = 'MEDIUM';
        if (estimatedGas > BigInt(50000000))
            complexity = 'HIGH';
        if (estimatedGas > BigInt(100000000))
            complexity = 'VERY_HIGH';
        return {
            methodName,
            estimatedGas,
            complexity,
            optimizations,
            warnings
        };
    }
    showGasAnalysisResults(analyses, filePath) {
        this.outputChannel.show();
        this.outputChannel.appendLine('\n=== GAS ANALYSIS RESULTS ===');
        const diagnostics = [];
        for (const analysis of analyses) {
            this.outputChannel.appendLine(`\nMethod: ${analysis.methodName}`);
            this.outputChannel.appendLine(`Estimated Gas: ${analysis.estimatedGas.toLocaleString()}`);
            this.outputChannel.appendLine(`Complexity: ${analysis.complexity}`);
            if (analysis.optimizations.length > 0) {
                this.outputChannel.appendLine('🔧 Optimizations:');
                analysis.optimizations.forEach(opt => this.outputChannel.appendLine(`  • ${opt}`));
            }
            if (analysis.warnings.length > 0) {
                this.outputChannel.appendLine('⚠️  Warnings:');
                analysis.warnings.forEach(warning => {
                    this.outputChannel.appendLine(`  • ${warning}`);
                    // Add diagnostic for high gas usage
                    const diagnostic = new vscode.Diagnostic(new vscode.Range(0, 0, 0, 0), // You'd want to find actual line numbers
                    `High gas usage detected in ${analysis.methodName}: ${warning}`, analysis.complexity === 'VERY_HIGH' ? vscode.DiagnosticSeverity.Error : vscode.DiagnosticSeverity.Warning);
                    diagnostics.push(diagnostic);
                });
            }
        }
        this.diagnosticCollection.set(vscode.Uri.file(filePath), diagnostics);
    }
    dispose() {
        this.outputChannel.dispose();
        this.diagnosticCollection.dispose();
    }
}
exports.GasProfiler = GasProfiler;
class SecurityAnalyzer {
    constructor() {
        this.outputChannel = vscode.window.createOutputChannel('NEAR Security Analyzer');
        this.diagnosticCollection = vscode.languages.createDiagnosticCollection('near-security');
    }
    async analyzeContract(filePath, language) {
        this.outputChannel.clear();
        this.outputChannel.appendLine(`Analyzing security for ${path.basename(filePath)}`);
        const content = fs.readFileSync(filePath, 'utf8');
        const lines = content.split('\n');
        const issues = [];
        // Define security patterns
        const securityPatterns = this.getSecurityPatterns(language);
        for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
            const line = lines[lineIndex];
            for (const pattern of securityPatterns) {
                const matches = line.matchAll(pattern.regex);
                for (const match of matches) {
                    const issue = {
                        severity: pattern.severity,
                        type: pattern.type,
                        description: pattern.description,
                        file: filePath,
                        line: lineIndex + 1,
                        column: match.index || 0,
                        suggestion: pattern.suggestion,
                        cweId: pattern.cweId
                    };
                    issues.push(issue);
                }
            }
        }
        // Additional context-aware analysis
        await this.performContextAnalysis(content, issues, language);
        this.showSecurityResults(issues, filePath);
        return issues;
    }
    getSecurityPatterns(language) {
        const commonPatterns = [
            {
                regex: /env::attached_deposit\(\)|near\.attachedDeposit\(\)/g,
                severity: 'MEDIUM',
                type: 'Reentrancy Risk',
                description: 'Attached deposit used without proper validation',
                suggestion: 'Validate deposit amount and implement checks-effects-interactions pattern',
                cweId: 'CWE-841'
            },
            {
                regex: /panic!\(|unwrap\(\)|expect\(/g,
                severity: 'HIGH',
                type: 'Denial of Service',
                description: 'Panic/unwrap can cause contract to become unusable',
                suggestion: 'Use proper error handling instead of panic',
                cweId: 'CWE-754'
            },
            {
                regex: /env::predecessor_account_id\(\)|near\.predecessorAccountId\(\)/g,
                severity: 'MEDIUM',
                type: 'Access Control',
                description: 'Predecessor account used for access control',
                suggestion: 'Ensure proper validation of predecessor account ID',
                cweId: 'CWE-285'
            }
        ];
        if (language === 'rust') {
            return [
                ...commonPatterns,
                {
                    regex: /unsafe\s*{/g,
                    severity: 'CRITICAL',
                    type: 'Memory Safety',
                    description: 'Unsafe block detected',
                    suggestion: 'Avoid unsafe blocks in smart contracts when possible',
                    cweId: 'CWE-119'
                },
                {
                    regex: /\.unwrap_or_default\(\)/g,
                    severity: 'LOW',
                    type: 'Default Values',
                    description: 'Using default values might mask errors',
                    suggestion: 'Consider explicit error handling',
                    cweId: 'CWE-252'
                },
                {
                    regex: /env::signer_account_id\(\).*==.*env::current_account_id\(\)/g,
                    severity: 'HIGH',
                    type: 'Self-call Vulnerability',
                    description: 'Contract calling itself detected',
                    suggestion: 'Prevent recursive self-calls that could drain gas',
                    cweId: 'CWE-674'
                }
            ];
        }
        else {
            return [
                ...commonPatterns,
                {
                    regex: /near\.log\([^)]*private|near\.log\([^)]*key|near\.log\([^)]*password/gi,
                    severity: 'HIGH',
                    type: 'Information Disclosure',
                    description: 'Potential logging of sensitive information',
                    suggestion: 'Avoid logging sensitive data',
                    cweId: 'CWE-532'
                },
                {
                    regex: /JSON\.parse\([^)]*\)/g,
                    severity: 'MEDIUM',
                    type: 'Input Validation',
                    description: 'JSON parsing without error handling',
                    suggestion: 'Wrap JSON.parse in try-catch block',
                    cweId: 'CWE-20'
                },
                {
                    regex: /eval\(|Function\(/g,
                    severity: 'CRITICAL',
                    type: 'Code Injection',
                    description: 'Dynamic code execution detected',
                    suggestion: 'Never use eval() or Function() constructor in smart contracts',
                    cweId: 'CWE-94'
                }
            ];
        }
    }
    async performContextAnalysis(content, issues, language) {
        // Check for missing access control
        if (!content.includes('assert_owner') && !content.includes('only_owner') && !content.includes('assertOwner')) {
            issues.push({
                severity: 'MEDIUM',
                type: 'Access Control',
                description: 'No owner access control methods detected',
                file: '',
                line: 1,
                column: 0,
                suggestion: 'Implement owner-only methods for administrative functions'
            });
        }
        // Check for missing initialization
        const hasInit = language === 'rust'
            ? content.includes('#[init]')
            : content.includes('@initialize');
        if (!hasInit) {
            issues.push({
                severity: 'LOW',
                type: 'Initialization',
                description: 'No initialization method found',
                file: '',
                line: 1,
                column: 0,
                suggestion: 'Consider adding an initialization method for proper contract setup'
            });
        }
        // Check for unrestricted payable methods
        const payableRegex = language === 'rust'
            ? /#\[payable\]/g
            : /@call\s*\(\s*{\s*payableFunction\s*:\s*true/g;
        const payableMethods = content.match(payableRegex);
        if (payableMethods && payableMethods.length > 2) {
            issues.push({
                severity: 'MEDIUM',
                type: 'Financial Risk',
                description: 'Multiple payable methods detected',
                file: '',
                line: 1,
                column: 0,
                suggestion: 'Review all payable methods for proper deposit handling'
            });
        }
    }
    showSecurityResults(issues, filePath) {
        this.outputChannel.show();
        this.outputChannel.appendLine('\n=== SECURITY ANALYSIS RESULTS ===');
        const criticalCount = issues.filter(i => i.severity === 'CRITICAL').length;
        const highCount = issues.filter(i => i.severity === 'HIGH').length;
        const mediumCount = issues.filter(i => i.severity === 'MEDIUM').length;
        const lowCount = issues.filter(i => i.severity === 'LOW').length;
        this.outputChannel.appendLine(`\nSummary:`);
        this.outputChannel.appendLine(`🔴 Critical: ${criticalCount}`);
        this.outputChannel.appendLine(`🟠 High: ${highCount}`);
        this.outputChannel.appendLine(`🟡 Medium: ${mediumCount}`);
        this.outputChannel.appendLine(`🟢 Low: ${lowCount}`);
        const diagnostics = [];
        for (const issue of issues) {
            this.outputChannel.appendLine(`\n${this.getSeverityIcon(issue.severity)} [${issue.severity}] ${issue.type}`);
            this.outputChannel.appendLine(`   Line ${issue.line}: ${issue.description}`);
            this.outputChannel.appendLine(`   💡 ${issue.suggestion}`);
            if (issue.cweId) {
                this.outputChannel.appendLine(`   🔗 ${issue.cweId}: https://cwe.mitre.org/data/definitions/${issue.cweId.replace('CWE-', '')}.html`);
            }
            // Create VS Code diagnostic
            const range = new vscode.Range(Math.max(0, issue.line - 1), issue.column, Math.max(0, issue.line - 1), issue.column + 50);
            const diagnostic = new vscode.Diagnostic(range, `[${issue.type}] ${issue.description}. ${issue.suggestion}`, this.severityToDiagnosticSeverity(issue.severity));
            diagnostic.code = issue.cweId;
            diagnostic.source = 'NEAR Security Analyzer';
            diagnostics.push(diagnostic);
        }
        this.diagnosticCollection.set(vscode.Uri.file(filePath), diagnostics);
    }
    getSeverityIcon(severity) {
        switch (severity) {
            case 'CRITICAL': return '🚨';
            case 'HIGH': return '🔴';
            case 'MEDIUM': return '🟡';
            case 'LOW': return '🟢';
        }
    }
    severityToDiagnosticSeverity(severity) {
        switch (severity) {
            case 'CRITICAL':
            case 'HIGH':
                return vscode.DiagnosticSeverity.Error;
            case 'MEDIUM':
                return vscode.DiagnosticSeverity.Warning;
            case 'LOW':
                return vscode.DiagnosticSeverity.Information;
        }
    }
    dispose() {
        this.outputChannel.dispose();
        this.diagnosticCollection.dispose();
    }
}
exports.SecurityAnalyzer = SecurityAnalyzer;
// Integration class to combine both analyzers
class ContractAnalyzer {
    constructor() {
        this.gasProfiler = new GasProfiler();
        this.securityAnalyzer = new SecurityAnalyzer();
    }
    async analyzeContract(filePath, language) {
        vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Analyzing contract...',
            cancellable: false
        }, async (progress) => {
            progress.report({ increment: 0, message: 'Starting analysis...' });
            // Run gas analysis
            progress.report({ increment: 25, message: 'Analyzing gas usage...' });
            const gasAnalysis = await this.gasProfiler.analyzeContract(filePath, language);
            // Run security analysis
            progress.report({ increment: 50, message: 'Analyzing security...' });
            const securityIssues = await this.securityAnalyzer.analyzeContract(filePath, language);
            progress.report({ increment: 100, message: 'Analysis complete!' });
            // Show summary
            const criticalSecurityIssues = securityIssues.filter(i => i.severity === 'CRITICAL' || i.severity === 'HIGH').length;
            const highGasMethods = gasAnalysis.filter(g => g.complexity === 'HIGH' || g.complexity === 'VERY_HIGH').length;
            if (criticalSecurityIssues > 0 || highGasMethods > 0) {
                vscode.window.showWarningMessage(`Analysis complete: ${criticalSecurityIssues} critical security issues, ${highGasMethods} high gas methods found`, 'View Details').then(selection => {
                    if (selection === 'View Details') {
                        vscode.commands.executeCommand('workbench.panel.output.focus');
                    }
                });
            }
            else {
                vscode.window.showInformationMessage('Analysis complete: No critical issues found!');
            }
        });
    }
    dispose() {
        this.gasProfiler.dispose();
        this.securityAnalyzer.dispose();
    }
}
exports.ContractAnalyzer = ContractAnalyzer;
//# sourceMappingURL=GasProfiler.js.map