import { GAME_DURATION, INITIAL_MONEY, INITIAL_STOVES, INGREDIENTS, RECIPES, STOVE_COUNT, STOVE_INSTALL_COST, STOVE_INSTALL_TIME } from './constants';
import { CookingStationType, CookwareType, Ingredient, IngredientId, Recipe } from './types';

export type RestaurantId = 'western' | 'chinese';

export interface RestaurantConfig {
  id: RestaurantId;
  name: string;
  tagline: string;
  ingredients: Partial<Record<IngredientId, Ingredient>>;
  recipes: Recipe[];
  stationTypes: CookingStationType[];
  cookwareTypes: CookwareType[];
  initialCookwareIds: string[];
  initialInventory: Partial<Record<IngredientId, number>>;
  initialMoney: number;
  gameDuration: number;
  stoveCount: number;
  initialStoves: number;
  stoveInstallCost: number;
  stoveInstallTime: number;
  emptyStationVisualAsset: string;
}

const chineseIngredients: Partial<Record<IngredientId, Ingredient>> = {
  rice: { id: 'rice', name: '大米', price: 3, icon: '🍚', deliveryTime: 8 },
  pork: { id: 'pork', name: '猪肉', price: 15, icon: '🥩', deliveryTime: 18 },
  chicken: { id: 'chicken', name: '鸡肉', price: 12, icon: '🍗', deliveryTime: 16 },
  egg: { id: 'egg', name: '鸡蛋', price: 4, icon: '🥚', deliveryTime: 8 },
  tofu: { id: 'tofu', name: '豆腐', price: 6, icon: '⬜', deliveryTime: 10 },
  scallion: { id: 'scallion', name: '葱', price: 2, icon: '🌿', image: new URL('./assets/scallion.svg', import.meta.url).href, deliveryTime: 6 },
  peanut: { id: 'peanut', name: '花生', price: 3, icon: '🥜', deliveryTime: 7 },
  cabbage: { id: 'cabbage', name: '白菜', price: 4, icon: '🥬', deliveryTime: 9 },
  noodles: { id: 'noodles', name: '面条', price: 5, icon: '🍜', deliveryTime: 10 },
};

const chineseStationTypes: CookingStationType[] = [
  { id: 'wok', name: '炒制', equipmentLabel: '炒锅' },
  { id: 'boiling', name: '煮制', equipmentLabel: '煮锅' },
];

const chineseCookware: CookwareType[] = [
  { id: 'wok-pan', name: '炒锅', price: 45, description: '用于炒制菜品', compatibleStationTypes: ['wok'], visualAsset: new URL('./assets/wok-station.svg', import.meta.url).href, cookingTimeMultiplier: 1 },
  { id: 'boiling-pot', name: '煮锅', price: 30, description: '用于煮制菜品', compatibleStationTypes: ['boiling'], visualAsset: new URL('./assets/boiling-station.svg', import.meta.url).href, cookingTimeMultiplier: 1 },
  { id: 'pressure-cooker', name: '高压锅', price: 120, description: '可当煮锅使用，煮类菜烹饪时间减半', compatibleStationTypes: ['boiling'], visualAsset: new URL('./assets/pressure-cooker.svg', import.meta.url).href, cookingTimeMultiplier: 0.5 },
];

const chineseRecipes: Recipe[] = [
  { id: 'kung-pao-chicken', name: '宫保鸡丁', ingredients: { chicken: 1, peanut: 1, scallion: 1 }, cookingTime: 28, salePrice: 52, icon: '🍗🥜', image: new URL('./assets/kung-pao-chicken.png', import.meta.url).href, requiredStationType: 'wok' },
  { id: 'mapo-tofu', name: '麻婆豆腐', ingredients: { tofu: 1, pork: 1, scallion: 1 }, cookingTime: 26, salePrice: 50, icon: '⬜🌶️', image: new URL('./assets/mapo-tofu.png', import.meta.url).href, requiredStationType: 'wok' },
  { id: 'tomato-egg', name: '番茄炒蛋', ingredients: { tomato: 1, egg: 2, scallion: 1 }, cookingTime: 22, salePrice: 34, icon: '🍅🥚', image: new URL('./assets/tomato-egg.png', import.meta.url).href, requiredStationType: 'wok' },
  { id: 'chicken-noodle-soup', name: '鸡汤面', ingredients: { chicken: 1, noodles: 1, scallion: 1 }, cookingTime: 36, salePrice: 48, icon: '🍜🍗', image: new URL('./assets/chicken-noodle-soup.png', import.meta.url).href, requiredStationType: 'boiling' },
  { id: 'cabbage-tofu-soup', name: '白菜豆腐汤', ingredients: { cabbage: 1, tofu: 1, scallion: 1 }, cookingTime: 32, salePrice: 34, icon: '🥬⬜', image: new URL('./assets/cabbage-tofu-soup.png', import.meta.url).href, requiredStationType: 'boiling' },
  { id: 'chicken-congee', name: '鸡丝粥', ingredients: { rice: 2, chicken: 1, scallion: 1 }, cookingTime: 42, salePrice: 50, icon: '🍚🍗', image: new URL('./assets/chicken-congee.png', import.meta.url).href, requiredStationType: 'boiling' },
];

const sharedRules = {
  initialMoney: INITIAL_MONEY,
  gameDuration: GAME_DURATION,
  stoveCount: STOVE_COUNT,
  initialStoves: INITIAL_STOVES,
  stoveInstallCost: STOVE_INSTALL_COST,
  stoveInstallTime: STOVE_INSTALL_TIME,
};

export const RESTAURANTS: Record<RestaurantId, RestaurantConfig> = {
  western: {
    id: 'western', name: '西餐厅', tagline: '汉堡、披萨与经典西式料理', ingredients: INGREDIENTS, recipes: RECIPES,
    stationTypes: [], cookwareTypes: [], initialCookwareIds: [], emptyStationVisualAsset: new URL('./assets/empty-pan.svg', import.meta.url).href,
    initialInventory: { tomato: 2, lettuce: 2, onion: 2, meat: 2, bread: 2, cheese: 2, potato: 2 }, ...sharedRules,
  },
  chinese: {
    id: 'chinese', name: '中餐厅', tagline: '用熟悉的经典中餐招待每一位客人', ingredients: { ...chineseIngredients, tomato: INGREDIENTS.tomato }, recipes: chineseRecipes,
    stationTypes: chineseStationTypes, cookwareTypes: chineseCookware, initialCookwareIds: ['wok-pan', 'boiling-pot'], emptyStationVisualAsset: new URL('./assets/empty-pan.svg', import.meta.url).href,
    initialInventory: { rice: 3, pork: 2, chicken: 2, egg: 3, tofu: 2, scallion: 3, peanut: 2, cabbage: 2, noodles: 2, tomato: 2 }, ...sharedRules,
  },
};

export const createInitialInventory = (restaurant: RestaurantConfig): Record<IngredientId, number> => {
  const inventory = Object.fromEntries(Object.keys(restaurant.ingredients).map(id => [id, restaurant.initialInventory[id as IngredientId] ?? 0]));
  return inventory as Record<IngredientId, number>;
};

export const createInitialCookwareInventory = (restaurant: RestaurantConfig): Record<string, number> =>
  Object.fromEntries(restaurant.cookwareTypes.map(cookware => [cookware.id, 0]));
