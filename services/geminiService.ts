import { AIConfig } from "../types";

/**
 * Helper to call OpenAI Compatible API
 */
const callOpenAICompatible = async (config: AIConfig, systemPrompt: string, userPrompt: string): Promise<string> => {
    try {
        if (!config.apiKey) {
            console.error("AI服务错误: 缺少 API Key");
            return "请先配置 API Key";
        }
        if (!config.baseUrl) {
            console.error("AI服务错误: 缺少 Base URL");
            return "请先配置 Base URL";
        }

        let baseUrl = config.baseUrl.replace(/\/$/, '');
        // If user didn't provide full path, assume /v1/chat/completions logic or just trust them
        // Common convention: if URL ends with /v1, append /chat/completions
        if (!baseUrl.includes('/chat/completions')) {
            if (baseUrl.endsWith('/v1')) {
                baseUrl += '/chat/completions';
            } else {
                // If it's just a domain like api.openai.com, usually implies /v1/chat/completions
                // But let's assume user might input full path or standard base. 
                // To be safe, let's append /chat/completions if not present
                baseUrl += '/chat/completions';
            }
        }

        const response = await fetch(baseUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${config.apiKey}`
            },
            body: JSON.stringify({
                model: config.model,
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: userPrompt }
                ],
                temperature: 0.7
            })
        });

        if (!response.ok) {
            const err = await response.text();
            console.error("OpenAI API 错误:", response.status, err);
            return `API请求失败 (${response.status})`;
        }

        const data = await response.json();
        return data.choices?.[0]?.message?.content?.trim() || "";
    } catch (e: any) {
        console.error("OpenAI 调用失败:", e?.message || e);
        return "网络请求失败";
    }
};

/**
 * Uses configured AI to generate a description
 */
export const generateLinkDescription = async (title: string, url: string, config: AIConfig): Promise<string> => {
    if (!config.apiKey) {
        return "请在设置中配置 API Key";
    }
    if (!config.baseUrl) {
        return "请在设置中配置 Base URL";
    }

    const prompt = `
      Title: ${title}
      URL: ${url}
      Please write a very short description (max 15 words) in Chinese (Simplified) that explains what this website is for. Return ONLY the description text. No quotes.
  `;

    try {
        // OpenAI Compatible Only
        const result = await callOpenAICompatible(
            config,
            "You are a helpful assistant that summarizes website bookmarks.",
            prompt
        );
        return result || "生成描述失败";
    } catch (error: any) {
        console.error("AI generation error:", error);
        return `生成失败: ${error.message || '未知错误'}`;
    }
};

/**
 * Suggests a category
 */
export const suggestCategory = async (title: string, url: string, categories: { id: string, name: string }[], config: AIConfig): Promise<string | null> => {
    if (!config.apiKey) return null;

    const catList = categories.map(c => `${c.id}: ${c.name}`).join('\n');
    const prompt = `
        Website: "${title}" (${url})

        Available Categories:
        ${catList}

        Return ONLY the 'id' of the best matching category. If unsure, return 'common'.
    `;

    try {
        // OpenAI Compatible Only
        const result = await callOpenAICompatible(
            config,
            "You are an intelligent classification assistant. You only output the category ID.",
            prompt
        );
        return result || null;
    } catch (e) {
        console.error(e);
        return null;
    }
}
