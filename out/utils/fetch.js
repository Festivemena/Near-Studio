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
exports.fetch = void 0;
const https = __importStar(require("https"));
function fetch(url, options) {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        const req = https.request({
            method: options.method,
            hostname: urlObj.hostname,
            path: urlObj.pathname + urlObj.search,
            headers: options.headers,
        }, res => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                resolve({
                    ok: res.statusCode !== undefined && res.statusCode >= 200 && res.statusCode < 300,
                    status: res.statusCode || 0,
                    json: async () => JSON.parse(data || '{}'),
                });
            });
        });
        req.on('error', reject);
        if (options.body)
            req.write(options.body);
        req.end();
    });
}
exports.fetch = fetch;
//# sourceMappingURL=fetch.js.map