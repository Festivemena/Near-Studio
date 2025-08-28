import * as https from 'https';

export function fetch(
    url: string, 
    options: { method: string; headers: any; body?: string }
): Promise<{ ok: boolean; status: number; json: () => Promise<any> }> {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        const req = https.request(
            {
                method: options.method,
                hostname: urlObj.hostname,
                path: urlObj.pathname + urlObj.search,
                headers: options.headers,
            },
            res => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    resolve({
                        ok: res.statusCode !== undefined && res.statusCode >= 200 && res.statusCode < 300,
                        status: res.statusCode || 0,
                        json: async () => JSON.parse(data || '{}'),
                    });
                });
            }
        );

        req.on('error', reject);
        if (options.body) req.write(options.body);
        req.end();
    });
}
