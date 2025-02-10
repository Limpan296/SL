import { items, type Item, type InsertItem } from "@shared/schema";

type UpdateItemData = {
  completed?: boolean;
  category?: string;
  name?: string;
};

export interface IStorage {
  getItems(): Promise<Item[]>;
  createItem(item: InsertItem): Promise<Item>;
  updateItem(id: number, data: UpdateItemData): Promise<Item>;
  deleteItem(id: number): Promise<void>;
  deleteAllItems(): Promise<void>;
}

export class MemStorage implements IStorage {
  private items: Map<number, Item>;
  private currentId: number;

  constructor() {
    this.items = new Map();
    this.currentId = 1;
  }

  async getItems(): Promise<Item[]> {
    return Array.from(this.items.values());
  }

  async createItem(insertItem: InsertItem): Promise<Item> {
    const id = this.currentId++;
    const item: Item = { 
      ...insertItem, 
      id,
      completed: insertItem.completed ?? false 
    };
    this.items.set(id, item);
    return item;
  }

  async updateItem(id: number, data: UpdateItemData): Promise<Item> {
    const item = this.items.get(id);
    if (!item) {
      throw new Error("Item not found");
    }
    const updatedItem = { 
      ...item,
      ...(data.completed !== undefined && { completed: data.completed }),
      ...(data.category !== undefined && { category: data.category }),
      ...(data.name !== undefined && { name: data.name }),
    };
    this.items.set(id, updatedItem);
    return updatedItem;
  }

  async deleteItem(id: number): Promise<void> {
    if (!this.items.has(id)) {
      throw new Error("Item not found");
    }
    this.items.delete(id);
  }

  async deleteAllItems(): Promise<void> {
    this.items.clear();
  }
}

export const storage = new MemStorage();