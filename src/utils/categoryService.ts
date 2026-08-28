import { CATEGORIES as DEFAULT_CATEGORIES } from '../types';

export interface CategoryItem {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
  groupId?: string; // empty if system default
}

const CATEGORY_STORAGE_KEY = 'budgeted_custom_categories';

export function getSystemCategories(): CategoryItem[] {
  return DEFAULT_CATEGORIES.map(name => ({
    id: name.toLowerCase().replace(/[^a-z0-9]+/g, '_'),
    name,
    isArchived: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }));
}

export function getGroupCategories(groupId?: string): CategoryItem[] {
  const systemCats = getSystemCategories();
  if (typeof window === 'undefined') return systemCats;

  try {
    const raw = localStorage.getItem(CATEGORY_STORAGE_KEY);
    if (!raw) return systemCats;
    const customCats: CategoryItem[] = JSON.parse(raw);
    const relevantCustom = customCats.filter(c => !groupId || !c.groupId || c.groupId === groupId);
    
    // Merge system and custom, with custom overriding system if id matches
    const map = new Map<string, CategoryItem>();
    systemCats.forEach(c => map.set(c.id, c));
    relevantCustom.forEach(c => map.set(c.id, c));

    return Array.from(map.values());
  } catch (e) {
    console.error('Error reading custom categories:', e);
    return systemCats;
  }
}

export function saveCategory(category: Omit<CategoryItem, 'id' | 'createdAt' | 'updatedAt' | 'isArchived'>, groupId?: string): CategoryItem | { error: string } {
  const existing = getGroupCategories(groupId);
  const normalizedName = category.name.trim();

  if (!normalizedName) {
    return { error: 'Category name cannot be empty' };
  }

  const duplicate = existing.find(c => c.name.toLowerCase() === normalizedName.toLowerCase() && !c.isArchived);
  if (duplicate) {
    return { error: 'A category with this name already exists' };
  }

  const newCat: CategoryItem = {
    id: 'cat_' + Math.random().toString(36).substring(2, 11),
    name: normalizedName,
    description: category.description || '',
    icon: category.icon || 'Tag',
    isArchived: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    groupId
  };

  try {
    const raw = localStorage.getItem(CATEGORY_STORAGE_KEY);
    const customCats: CategoryItem[] = raw ? JSON.parse(raw) : [];
    customCats.push(newCat);
    localStorage.setItem(CATEGORY_STORAGE_KEY, JSON.stringify(customCats));
    return newCat;
  } catch (e) {
    return { error: 'Failed to save custom category' };
  }
}

export function archiveCategory(categoryId: string): void {
  try {
    const raw = localStorage.getItem(CATEGORY_STORAGE_KEY);
    const customCats: CategoryItem[] = raw ? JSON.parse(raw) : [];
    const updated = customCats.map(c => c.id === categoryId ? { ...c, isArchived: true, updatedAt: new Date().toISOString() } : c);
    localStorage.setItem(CATEGORY_STORAGE_KEY, JSON.stringify(updated));
  } catch (e) {
    console.error('Error archiving category:', e);
  }
}
