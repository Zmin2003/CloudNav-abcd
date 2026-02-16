import React, { useState, useEffect } from 'react';
import { X, Save, Wrench, Box, Copy, Check, Clock, Globe } from 'lucide-react';
import { PasswordExpiryConfig, SiteConfig } from '../types';

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    passwordExpiryConfig: PasswordExpiryConfig;
    onSavePasswordExpiry: (config: PasswordExpiryConfig) => void;
    siteConfig: SiteConfig;
    onSaveSiteConfig: (config: SiteConfig) => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({
    isOpen, onClose, passwordExpiryConfig, onSavePasswordExpiry, siteConfig, onSaveSiteConfig
}) => {
    const [activeTab, setActiveTab] = useState<'tools' | 'website' | 'settings'>('tools');
    const [localPasswordExpiryConfig, setLocalPasswordExpiryConfig] = useState<PasswordExpiryConfig>(passwordExpiryConfig);
    const [localSiteConfig, setLocalSiteConfig] = useState<SiteConfig>(siteConfig);

    // Tools State
    const [password, setPassword] = useState('');
    const [domain, setDomain] = useState('');

    // Copy feedback states
    const [copiedStates, setCopiedStates] = useState<{ [key: string]: boolean }>({});

    useEffect(() => {
        if (isOpen) {
            setLocalPasswordExpiryConfig(passwordExpiryConfig);
            setLocalSiteConfig(siteConfig);
            setDomain(window.location.origin);
            const storedToken = localStorage.getItem('cloudnav_auth_token');
            if (storedToken) setPassword(storedToken);
        }
    }, [isOpen, passwordExpiryConfig, siteConfig]);

    const handlePasswordExpiryChange = (key: keyof PasswordExpiryConfig, value: string | number) => {
        setLocalPasswordExpiryConfig(prev => ({ ...prev, [key]: value }));
    };

    const handleSiteConfigChange = (key: keyof SiteConfig, value: string) => {
        setLocalSiteConfig(prev => ({ ...prev, [key]: value }));
    };

    const handleSave = () => {
        onSavePasswordExpiry(localPasswordExpiryConfig);
        onSaveSiteConfig(localSiteConfig);
        onClose();
    };

    const handleCopy = (text: string, key: string) => {
        navigator.clipboard.writeText(text);
        setCopiedStates(prev => ({ ...prev, [key]: true }));
        setTimeout(() => {
            setCopiedStates(prev => ({ ...prev, [key]: false }));
        }, 2000);
    };

    // --- Chrome Extension Code ---
    const extManifest = `{
  "manifest_version": 3,
  "name": "Zmin Nav Assistant",
  "version": "3.0",
  "permissions": ["activeTab"],
  "action": {
    "default_popup": "popup.html",
    "default_title": "保存到Zmin Nav"
  }
}`;

    const extPopupHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { width: 320px; padding: 16px; font-family: -apple-system, sans-serif; background: #f8fafc; }
    h3 { margin: 0 0 16px 0; font-size: 16px; color: #0f172a; }
    label { display: block; font-size: 12px; color: #64748b; margin-bottom: 4px; }
    input, select { width: 100%; margin-bottom: 12px; padding: 8px; border: 1px solid #cbd5e1; border-radius: 6px; box-sizing: border-box; font-size: 14px; }
    button { width: 100%; background: #3b82f6; color: white; border: none; padding: 10px; border-radius: 6px; font-weight: 500; cursor: pointer; }
    button:hover { background: #2563eb; }
    #status { margin-top: 12px; text-align: center; font-size: 12px; }
    .error { color: #ef4444; }
    .success { color: #22c55e; }
  </style>
</head>
<body>
  <h3>保存到Zmin Nav</h3>
  <label>标题</label>
  <input type="text" id="title" placeholder="网站标题">
  <label>分类</label>
  <select id="category"><option>加载中...</option></select>
  <button id="saveBtn">保存书签</button>
  <div id="status"></div>
  <script src="popup.js"></script>
</body>
</html>`;

    const extPopupJs = `const CONFIG = {
  apiBase: "${domain}",
  password: "${password}"
};

document.addEventListener('DOMContentLoaded', async () => {
  const titleInput = document.getElementById('title');
  const catSelect = document.getElementById('category');
  const saveBtn = document.getElementById('saveBtn');
  const statusDiv = document.getElementById('status');
  let currentTabUrl = '';

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab) {
    titleInput.value = tab.title || '';
    currentTabUrl = tab.url || '';
  }

  try {
    const res = await fetch(\`\${CONFIG.apiBase}/api/storage\`, {
      headers: { 'x-auth-password': CONFIG.password }
    });
    if (!res.ok) throw new Error('Auth failed');
    const data = await res.json();
    catSelect.innerHTML = '';
    data.categories.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = c.name;
      catSelect.appendChild(opt);
    });
  } catch (e) {
    statusDiv.textContent = 'Error: ' + e.message;
    statusDiv.className = 'error';
  }

  saveBtn.addEventListener('click', async () => {
    if (!currentTabUrl) return;
    saveBtn.disabled = true;
    try {
      const res = await fetch(\`\${CONFIG.apiBase}/api/link\`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-auth-password': CONFIG.password },
        body: JSON.stringify({ title: titleInput.value, url: currentTabUrl, categoryId: catSelect.value })
      });
      if (res.ok) {
        statusDiv.textContent = '保存成功！';
        statusDiv.className = 'success';
        setTimeout(() => window.close(), 1200);
      } else throw new Error(res.statusText);
    } catch (e) {
      statusDiv.textContent = '保存失败';
      statusDiv.className = 'error';
      saveBtn.disabled = false;
    }
  });
});`;

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center sm:p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-800 rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-lg overflow-hidden border border-slate-200 dark:border-slate-700 flex flex-col max-h-[90vh] safe-area-bottom">

                <div className="flex justify-between items-center p-4 border-b border-slate-200 dark:border-slate-700 shrink-0">
                    <div className="flex gap-4">
                        <button
                            onClick={() => setActiveTab('tools')}
                            className={`text-sm font-semibold flex items-center gap-2 pb-1 transition-colors ${activeTab === 'tools' ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-500' : 'text-slate-500 dark:text-slate-400'}`}
                        >
                            <Wrench size={18} /> 扩展工具
                        </button>
                        <button
                            onClick={() => setActiveTab('website')}
                            className={`text-sm font-semibold flex items-center gap-2 pb-1 transition-colors ${activeTab === 'website' ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-500' : 'text-slate-500 dark:text-slate-400'}`}
                        >
                            <Globe size={18} /> 网站设置
                        </button>
                        <button
                            onClick={() => setActiveTab('settings')}
                            className={`text-sm font-semibold flex items-center gap-2 pb-1 transition-colors ${activeTab === 'settings' ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-500' : 'text-slate-500 dark:text-slate-400'}`}
                        >
                            <Clock size={18} /> 密码设置
                        </button>
                    </div>
                    <button onClick={onClose} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors">
                        <X className="w-5 h-5 dark:text-slate-400" />
                    </button>
                </div>

                <div className="p-6 space-y-6 overflow-y-auto min-h-[300px]">
                    {activeTab === 'tools' && (
                        <div className="space-y-6">
                            <div className="space-y-3">
                                <label className="block text-xs font-medium text-slate-500 mb-1">
                                    输入您的访问密码 (用于生成扩展代码)
                                </label>
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none font-mono"
                                    placeholder="部署时设置的 PASSWORD"
                                />
                            </div>

                            <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
                                <h4 className="font-bold dark:text-white mb-2 text-sm flex items-center gap-2">
                                    <Box size={16} /> Chrome 扩展
                                </h4>
                                <p className="text-xs text-slate-500 mb-4">
                                    创建以下 3 个文件，使用"加载已解压的扩展程序"安装。
                                </p>

                                <div className="space-y-4">
                                    <div>
                                        <div className="flex justify-between items-center mb-1">
                                            <span className="text-xs font-mono font-bold text-slate-500">1. manifest.json</span>
                                            <button onClick={() => handleCopy(extManifest, 'manifest')} className="text-[10px] flex items-center gap-1 px-2 py-1 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                                                {copiedStates['manifest'] ? <Check size={12} /> : <Copy size={12} />} 复制
                                            </button>
                                        </div>
                                        <pre className="bg-slate-100 dark:bg-slate-900 p-3 rounded text-[10px] font-mono text-slate-600 dark:text-slate-300 overflow-x-auto border border-slate-200 dark:border-slate-700">{extManifest}</pre>
                                    </div>

                                    <div>
                                        <div className="flex justify-between items-center mb-1">
                                            <span className="text-xs font-mono font-bold text-slate-500">2. popup.html</span>
                                            <button onClick={() => handleCopy(extPopupHtml, 'html')} className="text-[10px] flex items-center gap-1 px-2 py-1 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                                                {copiedStates['html'] ? <Check size={12} /> : <Copy size={12} />} 复制
                                            </button>
                                        </div>
                                        <pre className="bg-slate-100 dark:bg-slate-900 p-3 rounded text-[10px] font-mono text-slate-600 dark:text-slate-300 overflow-x-auto border border-slate-200 dark:border-slate-700 max-h-32 overflow-y-auto">{extPopupHtml}</pre>
                                    </div>

                                    <div>
                                        <div className="flex justify-between items-center mb-1">
                                            <span className="text-xs font-mono font-bold text-slate-500">3. popup.js</span>
                                            <button onClick={() => handleCopy(extPopupJs, 'js')} className="text-[10px] flex items-center gap-1 px-2 py-1 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                                                {copiedStates['js'] ? <Check size={12} /> : <Copy size={12} />} 复制
                                            </button>
                                        </div>
                                        <pre className="bg-slate-100 dark:bg-slate-900 p-3 rounded text-[10px] font-mono text-slate-600 dark:text-slate-300 overflow-x-auto border border-slate-200 dark:border-slate-700 max-h-32 overflow-y-auto">{extPopupJs}</pre>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'website' && (
                        <div className="space-y-6">
                            <div>
                                <h4 className="font-bold dark:text-white mb-3 text-sm flex items-center gap-2">
                                    <Globe size={16} /> 网站自定义
                                </h4>
                                <p className="text-xs text-slate-500 mb-4">
                                    自定义网站的标题、导航栏名称和图标。
                                </p>
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-xs font-medium text-slate-500 mb-1">网站标题</label>
                                        <input
                                            type="text"
                                            value={localSiteConfig.websiteTitle || ''}
                                            onChange={(e) => handleSiteConfigChange('websiteTitle', e.target.value)}
                                            placeholder="Zmin Nav"
                                            className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                        />
                                        <p className="text-xs text-slate-400 mt-1">浏览器标签页显示的名称</p>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-slate-500 mb-1">导航栏名称</label>
                                        <input
                                            type="text"
                                            value={localSiteConfig.navigationName || ''}
                                            onChange={(e) => handleSiteConfigChange('navigationName', e.target.value)}
                                            placeholder="Zmin Nav"
                                            className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                        />
                                        <p className="text-xs text-slate-400 mt-1">页面左上角显示的名称</p>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-slate-500 mb-1">网站图标 URL</label>
                                        <input
                                            type="url"
                                            value={localSiteConfig.faviconUrl || ''}
                                            onChange={(e) => handleSiteConfigChange('faviconUrl', e.target.value)}
                                            placeholder="https://example.com/favicon.ico"
                                            className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                        />
                                        <p className="text-xs text-slate-400 mt-1">浏览器标签页显示的图标</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'settings' && (
                        <div className="space-y-6">
                            <div>
                                <h4 className="font-bold dark:text-white mb-3 text-sm flex items-center gap-2">
                                    <Clock size={16} /> 密码过期时间设置
                                </h4>
                                <p className="text-xs text-slate-500 mb-4">
                                    配置访问密码的过期时间。设置为"永久"则密码不会过期。
                                </p>
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-xs font-medium text-slate-500 mb-1">过期时间数值</label>
                                        <input
                                            type="number"
                                            min="1"
                                            value={localPasswordExpiryConfig.value}
                                            onChange={(e) => handlePasswordExpiryChange('value', parseInt(e.target.value) || 1)}
                                            className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-slate-500 mb-1">过期时间单位</label>
                                        <select
                                            value={localPasswordExpiryConfig.unit}
                                            onChange={(e) => handlePasswordExpiryChange('unit', e.target.value)}
                                            className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                        >
                                            <option value="day">天</option>
                                            <option value="week">周</option>
                                            <option value="month">月</option>
                                            <option value="year">年</option>
                                            <option value="permanent">永久</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {(activeTab === 'settings' || activeTab === 'website') && (
                    <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 flex justify-end gap-3 shrink-0">
                        <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg">取消</button>
                        <button onClick={handleSave} className="px-4 py-2 text-sm bg-blue-600 text-white hover:bg-blue-700 rounded-lg flex items-center gap-2 font-medium">
                            <Save size={16} /> 保存设置
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default SettingsModal;
