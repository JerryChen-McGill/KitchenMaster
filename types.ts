
export type IngredientId = 'tomato' | 'lettuce' | 'onion' | 'meat' | 'bread' | 'cheese' | 'potato'
  | 'rice' | 'pork' | 'chicken' | 'egg' | 'tofu' | 'scallion' | 'peanut' | 'cabbage' | 'noodles';

export interface Ingredient {
  id: IngredientId;
  name: string;
  price: number;
  icon: string;
  image?: string;
  deliveryTime: number; // seconds to arrive
}

export interface Recipe {
  id: string;
  name: string;
  ingredients: Partial<Record<IngredientId, number>>;
  cookingTime: number;
  salePrice: number;
  icon: string;
  requiredStationType?: string;
}

export interface CookingStationType {
  id: string;
  name: string;
  equipmentLabel: string;
}

export interface CookwareType {
  id: string;
  name: string;
  price: number;
  description: string;
  compatibleStationTypes: string[];
  visualAsset: string;
  cookingTimeMultiplier: number;
}

export interface Stove {
  id: number;
  cookwareId: string | null;
  isInstalled: boolean;
  installTimeLeft: number; // 安装剩余时间（0表示已完成安装）
  isCooking: boolean;
  isDone: boolean; // 菜品已完成但未上菜
  dishId: string | null;
  orderId: string | null; // 关联的订单ID，如果有订单则为订单ID，否则为null（从菜单直接制作）
  timeRemaining: number;
  cookTimeTotal: number;
  progress: number;
}

export type CustomerType = 'normal' | 'blogger' | 'grumpy' | 'happy';

export interface Order {
  id: string;
  dishId: string;
  expiryTime: number;
  maxTime: number; // The initial expiry time
  type: CustomerType;
  isUrgent: boolean; // Whether the order is in urgent reminder state
  urgentTimeLeft: number; // Time left in urgent state (20 seconds)
  isCooking: boolean; // Whether the order is being cooked
}

export interface PendingDelivery {
  id: string;
  ingredientId: IngredientId;
  timeLeft: number;
}

export interface GameState {
  money: number;
  inventory: Record<IngredientId, number>;
  stoves: Stove[];
  cookwareInventory: Record<string, number>;
  activeOrders: Order[];
  pendingDeliveries: PendingDelivery[];
  totalRevenue: number;
  popularity: number;
  timeLeft: number;
  gameStatus: 'idle' | 'playing' | 'ended';
  isPaused: boolean;
}
