import Dexie from 'dexie';

export type FoodItem = {
  id?: number;
  name: string;
  category: string;
  caloriesPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
  fiberPer100g?: number;
  isCustom?: boolean;
};

export class CalorieTrackerDB extends Dexie {
  foods!: any;

  constructor() {
    super('CalorieTrackerDB');
    this.version(1).stores({
      foods: '++id, name, category, isCustom'
    });
  }
}

export const db = new CalorieTrackerDB();
