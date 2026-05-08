
import React, { startTransition, useDeferredValue, useState, useEffect, useMemo, useCallback, useRef, lazy, Suspense } from 'react';
import { Search, Plus, Settings, Upload, ArrowRight, Lock, Menu, X, Trash2, FolderInput, CheckSquare, Bot, Loader2 } from 'lucide-react';
import { LinkItem, Category, DEFAULT_CATEGORIES, SearchConfig, PasswordExpiryConfig, AiSortConfig } from './types';
import { createSearchSources, STORAGE_KEYS } from './constants';
import Icon from './components/Icon';
import AuthModal from './components/AuthModal';
import ContextMenu from './components/ContextMenu';
import LinkCard from './components/LinkCard';
import { applySiteConfig } from './utils/favicon';
import LiquidBackground from './components/LiquidBackground';
import { aiSortLinks } from './services/aiSortService';
import { useAppData, safeHostname, ensureProtocol, compareByOrder } from './hooks/useAppData';
import { useSearch } from './hooks/useSearch';
import { useContextMenu } from './hooks/useContextMenu';

// 生成唯一 ID（避免 Date.now() 冲突）
let idCounter = 0;
function generateUniqueId(): string {
  return `${Date.now()}-${++idCounter}-${Math.random().toString(36).slice(2, 8)}`;
}

// Lazy-loaded modals (code-splitting: only loaded when opened)
const LinkModal = lazy(() => import('./components/LinkModal'));
const CategoryManagerModal = lazy(() => import('./components/CategoryManagerModal'));
const BackupModal = lazy(() => import('./components/BackupModal'));
const CategoryAuthModal = lazy(() => import('./components/CategoryAuthModal'));
const ImportModal = lazy(() => import('./components/ImportModal'));
const SettingsModal = lazy(() => import('./components/SettingsModal'));
const QRCodeModal = lazy(() => import('./components/QRCodeModal'));

const AUTH_KEY = STORAGE_KEYS.AUTH_TOKEN;

// Suspense fallback for lazy-loaded modals
const ModalFallback = () => null;

// Time Greeting (pure function, no need to be inside component)
function getStatusGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 5) return '夜深了，注意休息';
  if (hour < 9) return '早安，新的一天';
  if (hour < 12) return '上午好';
  if (hour < 14) return '中午好';
  if (hour < 18) return '下午好';
  if (hour < 22) return '晚上好';
  return '夜深了，早点休息';
}

export default function App() {
  return null;
}
