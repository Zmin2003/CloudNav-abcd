import { LinkItem, Category } from '../types';

// Simple UUID generator fallback
const generateId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
};

export interface ImportResult {
  links: LinkItem[];
  categories: Category[];
}

export const parseBookmarks = async (file: File): Promise<ImportResult> => {
  const text = await file.text();
  const parser = new DOMParser();
  const doc = parser.parseFromString(text, 'text/html');

  const links: LinkItem[] = [];
  const categories: Category[] = [];
  const categoryMap = new Map<string, string>(); // Name -> ID

  const isValidHttpUrl = (rawUrl: string): boolean => {
    try {
      const parsed = new URL(rawUrl);
      return ['http:', 'https:'].includes(parsed.protocol);
    } catch {
      return false;
    }
  };

  // Helper to get or create category ID
  const getCategoryId = (name: string): string => {
    if (!name) return 'common';
    // Normalize: remove generic folders like "Bookmarks Bar"
    if (['Bookmarks Bar', '书签栏', 'Other Bookmarks', '其他书签'].includes(name)) {
        return 'common';
    }

    if (categoryMap.has(name)) {
      return categoryMap.get(name)!;
    }
    
    // Check existing default categories could be mapped here if we had access, 
    // but for now we create new ones.
    const newId = generateId();
    categories.push({
      id: newId,
      name: name,
      icon: 'Folder' // Default icon for imported folders
    });
    categoryMap.set(name, newId);
    return newId;
  };

  // Traverse the DL/DT structure
  // Chrome structure: <DT><H3>Folder Name</H3><DL> ...items... </DL>
  
  const traverse = (element: Element, currentCategoryName: string) => {
    const children = Array.from(element.children);
    
    for (let i = 0; i < children.length; i++) {
      const node = children[i];
      const tagName = node.tagName.toUpperCase();

      if (tagName === 'DT') {
        const dtChildren = Array.from(node.children);
        const h3 = dtChildren.find(child => child.tagName.toUpperCase() === 'H3') as HTMLElement | undefined;
        const a = dtChildren.find(child => child.tagName.toUpperCase() === 'A') as HTMLAnchorElement | undefined;
        const dl = dtChildren.find(child => child.tagName.toUpperCase() === 'DL') as HTMLElement | undefined;

        if (h3 && dl) {
            // It's a folder
            const folderName = (h3.textContent || 'Unknown').trim();
            traverse(dl, folderName);
        } else if (a) {
            // It's a link
            const title = (a.textContent || a.getAttribute('href') || 'No Title').trim();
            const url = a.getAttribute('href')?.trim();
            
            if (url && isValidHttpUrl(url)) {
                links.push({
                    id: generateId(),
                    title: title,
                    url: url,
                    categoryId: getCategoryId(currentCategoryName),
                    createdAt: Date.now(),
                    icon: a.getAttribute('icon') || undefined
                });
            }
        }
      }
    }
  };

  const rootDl = doc.querySelector('dl');
  if (rootDl) {
    traverse(rootDl, 'common');
  }

  return { links, categories };
};
