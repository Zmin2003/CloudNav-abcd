
import { Category, LinkItem, WebDavConfig, SearchConfig } from "../types";

// Helper to call our Cloudflare Proxy
// This solves the CORS issue by delegating the request to the backend
const callWebDavProxy = async (
    operation: 'check' | 'upload' | 'download',
    config: WebDavConfig,
    authToken?: string,
    payload?: any,
) => {
    try {
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (authToken) {
            headers['x-auth-password'] = authToken;
        }

        const response = await fetch('/api/webdav', {
            method: 'POST',
            headers,
            body: JSON.stringify({
                operation,
                config,
                payload
            })
        });

        if (!response.ok) {
            console.error(`WebDAV Proxy Error: ${response.status}`);
            return null;
        }

        return await response.json();
    } catch (e) {
        console.error("WebDAV Proxy Network Error", e);
        return null;
    }
}

export const checkWebDavConnection = async (config: WebDavConfig, authToken?: string): Promise<boolean> => {
    if (!config.url || !config.username || !config.password) return false;
    const result = await callWebDavProxy('check', config, authToken);
    return result?.success === true;
};

export const uploadBackup = async (
    config: WebDavConfig,
    data: { links: LinkItem[], categories: Category[], searchConfig?: SearchConfig },
    authToken?: string,
): Promise<boolean> => {
    const result = await callWebDavProxy('upload', config, authToken, data);
    return result?.success === true;
};

export const downloadBackup = async (
    config: WebDavConfig,
    authToken?: string,
): Promise<{ links: LinkItem[], categories: Category[], searchConfig?: SearchConfig } | null> => {
    const result = await callWebDavProxy('download', config, authToken);

    // Check if the result looks like valid backup data
    if (result && Array.isArray(result.links) && Array.isArray(result.categories)) {
        return result as { links: LinkItem[], categories: Category[], searchConfig?: SearchConfig };
    }
    return null;
};
