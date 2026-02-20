import React, { useState, useEffect } from 'react';
import { X, Save, Clock, Globe, Bot, Flower2 } from 'lucide-react';
import { PasswordExpiryConfig, SiteConfig, AiSortConfig } from '../types';

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    passwordExpiryConfig: PasswordExpiryConfig;
    onSavePasswordExpiry: (config: PasswordExpiryConfig) => void;
    siteConfig: SiteConfig;
    onSaveSiteConfig: (config: SiteConfig) => void;
    aiSortConfig: AiSortConfig;
    onSaveAiSortConfig: (config: AiSortConfig) => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({
    isOpen, onClose, passwordExpiryConfig, onSavePasswordExpiry, siteConfig, onSaveSiteConfig, aiSortConfig, onSaveAiSortConfig
}) => {
    const [activeTab, setActiveTab] = useState<'website' | 'settings' | 'ai'>('website');
    const [localPasswordExpiryConfig, setLocalPasswordExpiryConfig] = useState<PasswordExpiryConfig>(passwordExpiryConfig);
    const [localSiteConfig, setLocalSiteConfig] = useState<SiteConfig>(siteConfig);
    const [localAiSortConfig, setLocalAiSortConfig] = useState<AiSortConfig>(aiSortConfig);

    useEffect(() => {
        if (isOpen) {
            setLocalPasswordExpiryConfig(passwordExpiryConfig);
            setLocalSiteConfig(siteConfig);
            setLocalAiSortConfig(aiSortConfig);
        }
    }, [isOpen, passwordExpiryConfig, siteConfig, aiSortConfig]);

    const handlePasswordExpiryChange = (key: keyof PasswordExpiryConfig, value: string | number) => {
        setLocalPasswordExpiryConfig(prev => ({ ...prev, [key]: value }));
    };

    const handleSiteConfigChange = (key: keyof SiteConfig, value: string) => {
        setLocalSiteConfig(prev => ({ ...prev, [key]: value }));
    };

    const handleAiConfigChange = (key: keyof AiSortConfig, value: string) => {
        setLocalAiSortConfig(prev => ({ ...prev, [key]: value }));
    };

    const handleSave = () => {
        onSavePasswordExpiry(localPasswordExpiryConfig);
        onSaveSiteConfig(localSiteConfig);
        onSaveAiSortConfig(localAiSortConfig);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center sm:p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-800 rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-lg overflow-hidden border border-slate-200 dark:border-slate-700 flex flex-col max-h-[90vh] safe-area-bottom">

                <div className="flex justify-between items-center p-4 border-b border-slate-200 dark:border-slate-700 shrink-0">
                    <div className="flex gap-3 sm:gap-4 overflow-x-auto flex-nowrap">
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
                        <button
                            onClick={() => setActiveTab('ai')}
                            className={`text-sm font-semibold flex items-center gap-2 pb-1 transition-colors ${activeTab === 'ai' ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-500' : 'text-slate-500 dark:text-slate-400'}`}
                        >
                            <Bot size={18} /> AI 排序
                        </button>
                    </div>
                    <button onClick={onClose} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors">
                        <X className="w-5 h-5 dark:text-slate-400" />
                    </button>
                </div>

                <div className="p-6 space-y-6 overflow-y-auto min-h-[300px]">
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
                                    <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <Flower2 size={16} className="text-pink-500" />
                                                <div>
                                                    <label className="block text-sm font-medium dark:text-white">樱花飘落效果</label>
                                                    <p className="text-xs text-slate-400">在页面上显示飘落的樱花花瓣动画</p>
                                                </div>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => setLocalSiteConfig(prev => ({ ...prev, sakuraEnabled: prev.sakuraEnabled !== false ? false : true }))}
                                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                                    localSiteConfig.sakuraEnabled !== false ? 'bg-pink-500' : 'bg-slate-300 dark:bg-slate-600'
                                                }`}
                                            >
                                                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                                    localSiteConfig.sakuraEnabled !== false ? 'translate-x-6' : 'translate-x-1'
                                                }`} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'ai' && (
                        <div className="space-y-6">
                            <div>
                                <h4 className="font-bold dark:text-white mb-3 text-sm flex items-center gap-2">
                                    <Bot size={16} /> AI 智能排序配置
                                </h4>
                                <p className="text-xs text-slate-500 mb-4">
                                    配置 AI API 后，可一键智能整理书签分类和排序。支持 OpenAI 兼容接口（如 OpenAI、DeepSeek、Gemini 等）。
                                </p>
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-xs font-medium text-slate-500 mb-1">API 地址</label>
                                        <input
                                            type="url"
                                            value={localAiSortConfig.apiUrl}
                                            onChange={(e) => handleAiConfigChange('apiUrl', e.target.value)}
                                            placeholder="https://api.openai.com/v1/chat/completions"
                                            className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none font-mono text-sm"
                                        />
                                        <p className="text-xs text-slate-400 mt-1">支持 OpenAI 兼容的 /v1/chat/completions 接口</p>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-slate-500 mb-1">API Key</label>
                                        <input
                                            type="password"
                                            value={localAiSortConfig.apiKey}
                                            onChange={(e) => handleAiConfigChange('apiKey', e.target.value)}
                                            placeholder="sk-..."
                                            className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none font-mono text-sm"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-slate-500 mb-1">模型</label>
                                        <input
                                            type="text"
                                            value={localAiSortConfig.model}
                                            onChange={(e) => handleAiConfigChange('model', e.target.value)}
                                            placeholder="gpt-4o-mini"
                                            className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none font-mono text-sm"
                                        />
                                        <p className="text-xs text-slate-400 mt-1">如 gpt-4o-mini、deepseek-chat、gemini-2.0-flash 等</p>
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

                <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 flex justify-end gap-3 shrink-0">
                    <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg">取消</button>
                    <button onClick={handleSave} className="px-4 py-2 text-sm bg-blue-600 text-white hover:bg-blue-700 rounded-lg flex items-center gap-2 font-medium">
                        <Save size={16} /> 保存设置
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SettingsModal;
