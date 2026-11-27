
import React, { useState, useEffect, useRef } from 'react';
import { CookButton, CookwareArtwork, DeliveryClock, DishArtwork, IngredientArtwork, RecipeCard, StockShelf } from './KitchenUI';
import './kitchen.css';
import { 
  ShoppingCart, Flame, Clock, DollarSign, Package,
  RotateCcw, AlertCircle, Heart, TrendingUp, TrendingDown, 
  Truck, Star, Volume2, VolumeX, XCircle, Trash2, Skull, Trophy, User, ArrowDownWideNarrow, Check, Utensils
} from 'lucide-react';
import { getRecipeProfit } from './constants';
import { IngredientId, GameState, Recipe, Order, Stove, PendingDelivery, CustomerType } from './types';
import { createInitialCookwareInventory, createInitialInventory, RESTAURANTS, RestaurantId, RestaurantConfig } from './restaurants';

// 排行榜相关函数
interface LeaderboardEntry {
  name: string;
  score: number;
  popularity: number;
  date: string;
}

const storagePrefix = (restaurantId: RestaurantId) => restaurantId === 'western' ? 'kitchenMaster' : `kitchenMaster_${restaurantId}`;
const getLeaderboard = (restaurantId: RestaurantId): LeaderboardEntry[] => {
  const data = localStorage.getItem(`${storagePrefix(restaurantId)}_leaderboard`);
  return data ? JSON.parse(data) : [];
};

const saveToLeaderboard = (restaurantId: RestaurantId, name: string, score: number, popularity: number) => {
  const leaderboard = getLeaderboard(restaurantId);
  leaderboard.push({ name, score, popularity, date: new Date().toLocaleDateString() });
  leaderboard.sort((a, b) => b.score - a.score);
  const top6 = leaderboard.slice(0, 6);
  localStorage.setItem(`${storagePrefix(restaurantId)}_leaderboard`, JSON.stringify(top6));
};

const isLeaderboardQualified = (restaurantId: RestaurantId, score: number): boolean => {
  const leaderboard = getLeaderboard(restaurantId);
  if (leaderboard.length < 6) return true;
  return score > leaderboard[leaderboard.length - 1].score;
};

const tutorialSeenKey = 'kitchenMaster_tutorial_seen';
const tutorialSteps = [
  { target: '[data-tutorial="orders"]', title: '先看顾客订单', text: '每张订单都有指定菜品和倒计时。优先处理快到时间的订单。' },
  { target: '[data-tutorial="supplies"]', title: '缺料就去进货', text: '左边可以购买食材，等配送到货后会放进右侧仓库。' },
  { target: '[data-tutorial="recipes"]', title: '选择菜谱开始做菜', text: '查看菜谱需要的食材和时间，再点击烹饪。食材会从仓库扣除。' },
  { target: '[data-tutorial="stoves"]', title: '灶台负责烹饪', text: '菜做好后，上方对应订单会出现上菜按钮。完成订单才能赚钱。' },
  { target: '[data-tutorial="stats"]', title: '留意资金和人气', text: '订单超时会损失人气；人气或余额归零都会结束游戏。' },
  { target: '[data-tutorial="timer"]', title: '倒计时也能暂停', text: '点击右上角时间可以暂停或继续。随时点右上角问号，可以重看这份指引。' },
];

// 最高分相关函数
const getHighScore = (restaurantId: RestaurantId): number => {
  const data = localStorage.getItem(`${storagePrefix(restaurantId)}_highscore`);
  return data ? parseInt(data, 10) : 0;
};

const saveHighScore = (restaurantId: RestaurantId, score: number) => {
  const currentHigh = getHighScore(restaurantId);
  if (score > currentHigh) {
    localStorage.setItem(`${storagePrefix(restaurantId)}_highscore`, score.toString());
    return true;
  }
  return false;
};

// 创建灶台数组 - 初始只有前INITIAL_STOVES个灶台已安装
const createStoves = (restaurant: RestaurantConfig): Stove[] => {
  return Array(restaurant.stoveCount).fill(null).map((_, i) => ({
    id: i,
    cookwareId: restaurant.initialCookwareIds[i] ?? null,
    isInstalled: i < restaurant.initialStoves,
    installTimeLeft: 0,
    isCooking: false,
    isDone: false,
    dishId: null,
    orderId: null,
    timeRemaining: 0,
    cookTimeTotal: 0,
    progress: 0
  }));
};

const App: React.FC = () => {
  const [restaurantId, setRestaurantId] = useState<RestaurantId>('western');
  const restaurant = RESTAURANTS[restaurantId];
  const ingredients = restaurant.ingredients;
  const recipes = restaurant.recipes;
  const [state, setState] = useState<GameState>({
    money: restaurant.initialMoney,
    inventory: createInitialInventory(restaurant),
    stoves: createStoves(restaurant),
    cookwareInventory: createInitialCookwareInventory(restaurant),
    activeOrders: [],
    pendingDeliveries: [],
    totalRevenue: 0,
    popularity: 100,
    timeLeft: restaurant.gameDuration,
    gameStatus: 'idle',
    isPaused: false
  });
  
  const [tutorialStep, setTutorialStep] = useState<number | null>(null);
  const [tutorialRect, setTutorialRect] = useState<DOMRect | null>(null);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const wasPausedBeforeExitConfirm = useRef(false);
  const [showCookwareShop, setShowCookwareShop] = useState(false);
  const [recipeSort, setRecipeSort] = useState<'cookingTime' | 'salePrice' | 'profit'>('salePrice');
  const recipeSortOptions = [
    { value: 'cookingTime', label: '制作时长' },
    { value: 'salePrice', label: '售价' },
    { value: 'profit', label: '利润' },
  ] as const;
  const recipeSortValue = (recipe: Recipe) => recipeSort === 'profit' ? getRecipeProfit(recipe, ingredients) : recipe[recipeSort];
  const sortedRecipes = [...recipes].sort((a, b) => recipeSortValue(a) - recipeSortValue(b));
  const [showHomepage, setShowHomepage] = useState(true);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [showHighScore, setShowHighScore] = useState(false);
  const [playerName, setPlayerName] = useState('');
  const [showNameEntry, setShowNameEntry] = useState(false);
  const [pendingScore, setPendingScore] = useState(0);
  const [pendingPopularity, setPendingPopularity] = useState(0);

  const [notification, setNotification] = useState<{msg: string, type: 'success' | 'error' | 'neutral'} | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [ingredientHint, setIngredientHint] = useState<{ ids: IngredientId[]; sequence: number }>({ ids: [], sequence: 0 });
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (ingredientHint.ids.length === 0) return;
    const timeout = window.setTimeout(() => setIngredientHint(hint => ({ ...hint, ids: [] })), 1000);
    return () => window.clearTimeout(timeout);
  }, [ingredientHint]);
  
  const bgmRef = useRef<HTMLAudioElement | null>(null);
  const sfxBuy = useRef<HTMLAudioElement | null>(null);
  const sfxCook = useRef<HTMLAudioElement | null>(null);
  const sfxSuccess = useRef<HTMLAudioElement | null>(null);
  const sfxFail = useRef<HTMLAudioElement | null>(null);
  const sfxClick = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    bgmRef.current = new Audio('https://assets.mixkit.co/music/preview/mixkit-serene-view-443.mp3');
    bgmRef.current.loop = true;
    bgmRef.current.volume = 0.2;

    const workSoundUrl = 'https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3';
    sfxBuy.current = new Audio(workSoundUrl);
    sfxCook.current = new Audio(workSoundUrl);
    sfxClick.current = new Audio(workSoundUrl);
    
    sfxSuccess.current = new Audio('https://assets.mixkit.co/active_storage/sfx/951/951-preview.mp3');
    sfxSuccess.current.volume = 0.5;
    
    sfxFail.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2569/2569-preview.mp3');
    sfxFail.current.volume = 0.7;

    return () => {
      bgmRef.current?.pause();
    };
  }, []);

  useEffect(() => {
    if (bgmRef.current) bgmRef.current.muted = isMuted;
  }, [isMuted]);

  // 游戏结束后检查排行榜和最高分
  useEffect(() => {
    if (state.gameStatus === 'ended' && state.money > 0) {
      // 保存最高分
      saveHighScore(restaurantId, state.money);
      
      // 检查是否进入排行榜
      if (isLeaderboardQualified(restaurantId, state.money)) {
        setPendingScore(state.money);
        setPendingPopularity(state.popularity);
        setShowNameEntry(true);
      } else {
        // 不进入排行榜则返回首页
        setShowHomepage(true);
      }
    }
  }, [state.gameStatus]);

  const playSfx = (audio: HTMLAudioElement | null) => {
    if (isMuted || !audio) return;
    audio.currentTime = 0;
    audio.play().catch(() => {}); 
  };

  const notify = (msg: string, type: 'success' | 'error' | 'neutral' = 'neutral') => {
    setNotification({ msg, type });
    if (type === 'success') playSfx(sfxSuccess.current);
    if (type === 'error') playSfx(sfxFail.current);
    setTimeout(() => setNotification(null), 2000);
  };

  const createNewOrder = (forRestaurant: RestaurantConfig = restaurant): Order => {
    const restaurantRecipes = forRestaurant.recipes;
    const randomRecipe = restaurantRecipes[Math.floor(Math.random() * restaurantRecipes.length)];
    const roll = Math.random();
    let type: CustomerType = 'normal';
    if (roll < 0.15) type = 'blogger';
    else if (roll < 0.30) type = 'grumpy';
    else if (roll < 0.45) type = 'happy';
    
    const expiry = 40 + Math.floor(Math.random() * 40); // 40-80秒
    return {
      id: Math.random().toString(36).substr(2, 9),
      dishId: randomRecipe.id,
      expiryTime: expiry,
      maxTime: 80, // 统一80秒
      type,
      isUrgent: false,
      urgentTimeLeft: 0,
      isCooking: false
    };
  };

  const startGame = (forRestaurantId: RestaurantId = restaurantId) => {
    const forRestaurant = RESTAURANTS[forRestaurantId];
    const shouldShowTutorial = localStorage.getItem(tutorialSeenKey) !== '1';
    setIngredientHint(hint => ({ ...hint, ids: [] }));
    playSfx(sfxClick.current);
    bgmRef.current?.play().catch(() => {});
    setState({
      money: forRestaurant.initialMoney,
      inventory: createInitialInventory(forRestaurant),
      stoves: createStoves(forRestaurant),
      cookwareInventory: createInitialCookwareInventory(forRestaurant),
      activeOrders: [createNewOrder(forRestaurant), createNewOrder(forRestaurant), createNewOrder(forRestaurant), createNewOrder(forRestaurant)], // 初始4个订单（100%人气）
      pendingDeliveries: [],
      totalRevenue: 0,
      popularity: 100,
      timeLeft: forRestaurant.gameDuration,
      gameStatus: 'playing',
      isPaused: shouldShowTutorial
    });
    if (shouldShowTutorial) {
      localStorage.setItem(tutorialSeenKey, '1');
      setTutorialStep(0);
    }
  };

  useEffect(() => {
    if (tutorialStep === null) { setTutorialRect(null); return; }
    const updateRect = () => {
      const target = document.querySelector(tutorialSteps[tutorialStep]?.target);
      setTutorialRect(target?.getBoundingClientRect() ?? null);
    };
    const target = document.querySelector(tutorialSteps[tutorialStep]?.target);
    target?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    updateRect();
    const scrollTimeout = window.setTimeout(updateRect, 350);
    window.addEventListener('resize', updateRect);
    window.addEventListener('scroll', updateRect, true);
    return () => { window.clearTimeout(scrollTimeout); window.removeEventListener('resize', updateRect); window.removeEventListener('scroll', updateRect, true); };
  }, [tutorialStep]);

  const closeTutorial = () => {
    setTutorialStep(null);
    if (state.gameStatus === 'playing') setState(prev => ({ ...prev, isPaused: false }));
  };

  const buyIngredient = (id: IngredientId) => {
    if (state.isPaused) return;
    if (state.money <= 0) return notify("资金不足，无法购买原材料!", 'error');
    
    const item = ingredients[id]!;
    const pendingCount = state.pendingDeliveries.filter(d => d.ingredientId === id).length;
    const currentTotal = state.inventory[id] + pendingCount;

    if (currentTotal >= 10) {
      return notify(`${item.name} 仓库已满!`, 'error');
    }

    if (state.money >= item.price) {
      playSfx(sfxBuy.current);
      const deliveryId = Math.random().toString(36).substr(2, 5);
      setState(prev => ({
        ...prev,
        money: prev.money - item.price,
        pendingDeliveries: [...prev.pendingDeliveries, { id: deliveryId, ingredientId: id, timeLeft: item.deliveryTime }]
      }));
    } else {
      notify("余额不足!", 'error');
    }
  };

  const sellIngredient = (id: IngredientId) => {
    if (state.isPaused) return;
    if (state.inventory[id] <= 0) return notify("仓库中没有该食材!", 'error');
    
    const item = ingredients[id]!;
    const sellPrice = Math.floor(item.price / 2); // 半价卖出
    
    playSfx(sfxSuccess.current);
    setState(prev => ({
      ...prev,
      money: prev.money + sellPrice,
      inventory: { ...prev.inventory, [id]: prev.inventory[id] - 1 }
    }));
    notify(`卖出 ${item.name} +$${sellPrice}`, 'success');
  };

  const highlightMissingIngredients = (recipe: Recipe): boolean => {
    if (state.isPaused) return false;
    const missing = Object.entries(recipe.ingredients)
      .filter(([ingId, count]) => state.inventory[ingId as IngredientId] < (count || 0))
      .map(([ingId]) => ingId as IngredientId);
    setIngredientHint(hint => ({ ids: missing, sequence: hint.sequence + 1 }));
    return missing.length > 0;
  };

  const stoveCanCookRecipe = (stove: Stove, recipe: Recipe): boolean => {
    if (!stove.isInstalled || stove.isCooking || stove.isDone) return false;
    if (restaurant.cookwareTypes.length === 0) return true;
    const cookware = restaurant.cookwareTypes.find(item => item.id === stove.cookwareId);
    return Boolean(cookware && (!recipe.requiredStationType || cookware.compatibleStationTypes.includes(recipe.requiredStationType)));
  };

  const hasAvailableStation = (recipe: Recipe): boolean => state.stoves.some(stove => stoveCanCookRecipe(stove, recipe));

  const startCooking = (recipe: Recipe, orderId: string | null = null) => {
    if (state.isPaused || highlightMissingIngredients(recipe)) return;

    const freeStoveIndex = state.stoves.findIndex(stove => stoveCanCookRecipe(stove, recipe));
    if (freeStoveIndex === -1) {
      const requiredStation = restaurant.stationTypes.find(type => type.id === recipe.requiredStationType);
      return notify(requiredStation ? `没有空闲灶台放置可用于${requiredStation.name}菜品的${requiredStation.equipmentLabel}` : "没有可用的灶台!", 'error');
    }

    playSfx(sfxCook.current);
    const newInventory = { ...state.inventory };
    Object.entries(recipe.ingredients).forEach(([ingId, count]) => { newInventory[ingId as IngredientId] -= (count || 0); });
    const newStoves = [...state.stoves];
    const cookware = restaurant.cookwareTypes.find(item => item.id === newStoves[freeStoveIndex].cookwareId);
    const cookTimeTotal = Math.max(1, Math.ceil(recipe.cookingTime * (cookware?.cookingTimeMultiplier ?? 1)));
    newStoves[freeStoveIndex] = { ...newStoves[freeStoveIndex], isCooking: true, dishId: recipe.id, orderId, timeRemaining: cookTimeTotal, cookTimeTotal, progress: 0 };
    setState(prev => ({
      ...prev, inventory: newInventory, stoves: newStoves,
      activeOrders: prev.activeOrders.map(order => order.id === orderId ? { ...order, isCooking: true } : order),
    }));
  };

  // 接受订单并开始烹饪
  const acceptOrder = (order: Order) => {
    if (state.isPaused || order.isCooking) return;
    
    const recipe = recipes.find(r => r.id === order.dishId);
    if (!recipe) return;

    startCooking(recipe, order.id);
  };

  const cancelCooking = (stoveId: number) => {
    if (state.isPaused) return;
    
    playSfx(sfxClick.current);
    const newStoves = state.stoves.map(s => {
      if (s.id === stoveId && s.isCooking) {
        return { ...s, isCooking: false, dishId: null, orderId: null, progress: 0, timeRemaining: 0, cookTimeTotal: 0 };
      }
      return s;
    });
    setState(prev => ({ ...prev, stoves: newStoves }));
  };

  // 丢弃已做好的菜品
  const discardDish = (stoveId: number) => {
    if (state.isPaused) return;
    
    playSfx(sfxClick.current);
    const newStoves = state.stoves.map(s => {
      if (s.id === stoveId && s.isDone) {
        return { ...s, isDone: false, dishId: null, orderId: null, progress: 0, timeRemaining: 0, cookTimeTotal: 0 };
      }
      return s;
    });
    setState(prev => ({ ...prev, stoves: newStoves }));
    notify("菜品已丢弃", 'neutral');
  };

  // 上菜 - 用灶台上的菜品完成订单
  const serveDish = (orderId: string) => {
    if (state.isPaused) return;
    
    const order = state.activeOrders.find(o => o.id === orderId);
    if (!order) return;
    
    const recipe = recipes.find(r => r.id === order.dishId);
    if (!recipe) return;
    
    // 查找灶台上是否有对应的已做好的菜品
    const stoveIndex = state.stoves.findIndex(s => s.isDone && s.dishId === order.dishId);
    if (stoveIndex === -1) {
      notify("灶台上没有对应的菜品!", 'error');
      return;
    }
    
    // 清除灶台上的菜品
    const newStoves = state.stoves.map((s, i) => {
      if (i === stoveIndex) {
        return { ...s, isDone: false, dishId: null, orderId: null, progress: 0, timeRemaining: 0, cookTimeTotal: 0 };
      }
      return s;
    });
    
    // 计算收益
    let popGain = 1;
    let tip = 0;
    if (order.type === 'blogger') { popGain = 15; }
    if (order.type === 'happy') { popGain = 10; tip = 20; }
    
    // 移除订单
    const newOrders = state.activeOrders.filter(o => o.id !== orderId);
    
    playSfx(sfxSuccess.current);
    setState(prev => ({
      ...prev,
      stoves: newStoves,
      activeOrders: newOrders,
      money: prev.money + recipe.salePrice + tip,
      totalRevenue: prev.totalRevenue + recipe.salePrice + tip,
      popularity: Math.min(100, prev.popularity + popGain)
    }));
    notify(`上菜: ${recipe.name}! +$${recipe.salePrice + tip}`, 'success');
  };

  // 建造空灶台；锅具需要另行购买和放置。
  const buildStove = (stoveId: number) => {
    if (state.isPaused) return;
    
    const stove = state.stoves[stoveId];
    if (stove.isInstalled || stove.installTimeLeft > 0) return; // 灶台已安装或正在安装
    if (state.money < restaurant.stoveInstallCost) return notify("资金不足，无法安装新灶台!", 'error');
    
    playSfx(sfxBuy.current);
    setState(prev => ({
      ...prev,
      money: prev.money - restaurant.stoveInstallCost,
      stoves: prev.stoves.map(s => {
        if (s.id === stoveId) {
          return { ...s, installTimeLeft: restaurant.stoveInstallTime };
        }
        return s;
      })
    }));
    notify(`开始建造灶台...`, 'neutral');
  };

  const buyCookware = (cookwareId: string) => {
    if (state.isPaused) return false;
    const cookware = restaurant.cookwareTypes.find(item => item.id === cookwareId);
    if (!cookware) return false;
    if (state.money < cookware.price) { notify("资金不足，无法购买锅具!", 'error'); return false; }
    setState(prev => ({
      ...prev,
      money: prev.money - cookware.price,
      cookwareInventory: { ...prev.cookwareInventory, [cookwareId]: (prev.cookwareInventory[cookwareId] ?? 0) + 1 },
    }));
    notify(`已购买${cookware.name}，可放到空灶台上`, 'success');
    return true;
  };

  const placeFirstAvailableCookware = (cookwareId: string) => {
    if (state.isPaused || (state.cookwareInventory[cookwareId] ?? 0) < 1) return;
    const emptyStove = state.stoves.find(stove => stove.isInstalled && !stove.isCooking && !stove.isDone && !stove.cookwareId);
    if (emptyStove) placeCookware(emptyStove.id, cookwareId);
  };

  const placeCookware = (stoveId: number, cookwareId: string) => {
    if (state.isPaused) return;
    const stove = state.stoves[stoveId];
    const cookware = restaurant.cookwareTypes.find(item => item.id === cookwareId);
    if (!stove?.isInstalled || stove.isCooking || stove.isDone || stove.cookwareId || !cookware) return;
    if ((state.cookwareInventory[cookwareId] ?? 0) < 1) return;
    setState(prev => ({
      ...prev,
      cookwareInventory: { ...prev.cookwareInventory, [cookwareId]: prev.cookwareInventory[cookwareId] - 1 },
      stoves: prev.stoves.map(item => item.id === stoveId ? { ...item, cookwareId } : item),
    }));
    notify(`已将${cookware.name}放到灶台上`, 'success');
  };

  const removeCookware = (stoveId: number) => {
    if (state.isPaused) return;
    const stove = state.stoves[stoveId];
    if (!stove?.cookwareId || stove.isCooking || stove.isDone) return;
    const cookwareId = stove.cookwareId;
    const cookware = restaurant.cookwareTypes.find(item => item.id === cookwareId);
    setState(prev => ({
      ...prev,
      cookwareInventory: { ...prev.cookwareInventory, [cookwareId]: (prev.cookwareInventory[cookwareId] ?? 0) + 1 },
      stoves: prev.stoves.map(item => item.id === stoveId ? { ...item, cookwareId: null } : item),
    }));
    notify(cookware ? `已撤下${cookware.name}，可重新放置` : '已撤下锅具', 'neutral');
  };

  // 根据人气值计算最大订单数
  const getMaxOrders = (popularity: number): number => {
    if (popularity >= 80) return 4;  // 80-100%: 4个订单
    if (popularity >= 60) return 3;  // 60-80%: 3个订单
    if (popularity >= 40) return 2; // 40-60%: 2个订单
    return 1;                        // 40%以下: 1个订单
  };

  const togglePause = () => {
    if (state.gameStatus !== 'playing') return;
    playSfx(sfxClick.current);
    setState(prev => ({ ...prev, isPaused: !prev.isPaused }));
  };

  useEffect(() => {
    if (state.gameStatus !== 'playing') return;
    // 如果暂停，清理定时器
    if (state.isPaused) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }
    // 如果未暂停，启动定时器
    timerRef.current = window.setInterval(() => {
      setState(prev => {
        if (prev.timeLeft <= 0 || prev.popularity <= 0) { 
          clearInterval(timerRef.current!); 
          bgmRef.current?.pause();
          return { ...prev, gameStatus: 'ended', timeLeft: Math.max(0, prev.timeLeft) }; 
        }

        const newInventory = { ...prev.inventory };
        const stillPending: PendingDelivery[] = [];

        prev.pendingDeliveries.forEach(d => {
          if (d.timeLeft <= 1) { 
            if (newInventory[d.ingredientId] < 10) {
              newInventory[d.ingredientId]++; 
            }
          }
          else stillPending.push({ ...d, timeLeft: d.timeLeft - 1 });
        });

        const updatedStoves = prev.stoves.map(s => {
          // 处理灶台安装倒计时
          if (s.installTimeLeft > 0) {
            const newInstallTime = s.installTimeLeft - 1;
            if (newInstallTime === 0) {
              // 安装完成
              return { ...s, isInstalled: true, installTimeLeft: 0 };
            }
            return { ...s, installTimeLeft: newInstallTime };
          }
          // 处理烹饪倒计时
          if (!s.isCooking) return s;
          const recipe = recipes.find(r => r.id === s.dishId)!;
          const newTime = Math.max(0, s.timeRemaining - 1);
          const cookTimeTotal = s.cookTimeTotal || recipe.cookingTime;
          return { ...s, timeRemaining: newTime, progress: ((cookTimeTotal - newTime) / cookTimeTotal) * 100 };
        });

        let newRevenue = prev.totalRevenue;
        let newPopularity = prev.popularity;
        let currentMoney = prev.money;
        let currentOrders = [...prev.activeOrders];

        const finalStoves = updatedStoves.map(s => {
          if (s.isCooking && s.timeRemaining === 0) {
            const recipe = recipes.find(r => r.id === s.dishId)!;
            
            // 如果有关联的订单ID，尝试自动完成订单
            if (s.orderId) {
              const orderIndex = currentOrders.findIndex(o => o.id === s.orderId);
              if (orderIndex !== -1) {
                // 订单还存在，自动完成
                const order = currentOrders[orderIndex];
                let popGain = 1;
                let tip = 0;
                if (order.type === 'blogger') { popGain = 15; }
                if (order.type === 'happy') { popGain = 10; tip = 20; }
                newRevenue += recipe.salePrice + tip;
                currentMoney += recipe.salePrice + tip;
                newPopularity = Math.min(100, newPopularity + popGain);
                currentOrders.splice(orderIndex, 1);
                notify(`卖出: ${recipe.name}!`, 'success');
                return { ...s, isCooking: false, dishId: null, orderId: null, progress: 0, timeRemaining: 0, cookTimeTotal: 0 };
              }
              // 订单已过期，灶台上的菜保留，需要手动上菜
            }
            
            // 从菜单直接点击制作的菜，或者关联的订单已过期，保留在灶台
            return { ...s, isCooking: false, isDone: true, progress: 100 };
          }
          return s;
        });

        // 检查订单是否到期
        const expired = currentOrders.filter(o => o.expiryTime <= 1);
        expired.forEach(o => {
          // 订单彻底过期，扣除人气值
          let popLoss = 5;
          if (o.type === 'blogger') { popLoss = 30; }
          if (o.type === 'grumpy') { popLoss = 20; }
          newPopularity = Math.max(0, newPopularity - popLoss);
          notify("订单过期!", "error");
        });

        // 更新所有订单的倒计时
        currentOrders = currentOrders.map(o => {
          return { ...o, expiryTime: o.expiryTime - 1 };
        });

        // 过滤掉已过期的订单（expiryTime <= 0）
        let remainingOrders = currentOrders.filter(o => o.expiryTime > 0);
        
        // 根据更新后的人气值计算最大订单数
        const maxOrders = getMaxOrders(newPopularity);
        
        // 确保订单数量始终保持在最大值（立即补充，不使用随机概率）
        while (remainingOrders.length < maxOrders) {
          remainingOrders.push(createNewOrder());
        }
        // 如果订单数超过最大值，移除多余的订单（从最旧的开始）
        if (remainingOrders.length > maxOrders) {
          remainingOrders.splice(0, remainingOrders.length - maxOrders);
        }

        return {
          ...prev, 
          timeLeft: prev.timeLeft - 1, 
          stoves: finalStoves, 
          money: currentMoney, 
          totalRevenue: newRevenue, 
          popularity: newPopularity, 
          activeOrders: remainingOrders,
          pendingDeliveries: stillPending, 
          inventory: newInventory
        };
      });
    }, 1000);
    return () => clearInterval(timerRef.current!);
  }, [state.gameStatus, state.isPaused]);

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

  // 主页UI
  if (showHomepage) {
    return (
      <div className="restaurant-home min-h-screen flex items-center justify-center p-5 sm:p-8">
        <div className="restaurant-home-inner w-full">
          {/* Logo区域 */}
          <div className="restaurant-home-heading text-center">
            <div className="home-brand-mark"><Flame aria-hidden="true" /></div>
            <h1 className="home-title">Kitchen <span>Master</span></h1>
          </div>

          <div className="restaurant-home-grid">
            {Object.values(RESTAURANTS).map(option => {
              const isWestern = option.id === 'western';
              return (
                <article key={option.id} className={`restaurant-choice ${isWestern ? 'restaurant-choice-western' : 'restaurant-choice-chinese'}`}>
                  <button type="button" className="restaurant-choice-main"
                    onClick={() => { setRestaurantId(option.id); setShowHomepage(false); startGame(option.id); }}>
                    <span className="restaurant-choice-scene" aria-hidden="true">
                      <span className="scene-sun" />
                      <span className={`scene-hero ${isWestern ? 'western-hero' : 'chinese-hero'}`}>{isWestern ? '🍔' : '🥢'}</span>
                      <span className="scene-table" />
                      <strong className="restaurant-choice-name">{option.name}</strong>
                    </span>
                  </button>
                  <div className="restaurant-choice-footer">
                    <div className="restaurant-record">
                      <TrendingUp aria-hidden="true" />
                      <span><small>历史最高营收</small><strong>${getHighScore(option.id)}</strong></span>
                    </div>
                    <button type="button" aria-label={`${option.name}排行榜`}
                      onClick={() => { setRestaurantId(option.id); setShowHomepage(false); setShowLeaderboard(true); }}
                      className="restaurant-ranking"><Trophy aria-hidden="true" /> 排行榜</button>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // 排行榜UI
  if (showLeaderboard) {
    const leaderboard = getLeaderboard(restaurantId);
    return (
      <div className="min-h-screen bg-gradient-to-b from-yellow-50 to-yellow-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-[2rem] shadow-2xl p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <Trophy className="w-8 h-8 text-yellow-500" />
              <h2 className="text-2xl font-black text-stone-800">{restaurant.name}排行榜</h2>
            </div>
            <button onClick={() => { setShowLeaderboard(false); setShowHomepage(true); }} className="p-2 bg-stone-100 rounded-full hover:bg-stone-200">
              <XCircle className="w-6 h-6 text-stone-500" />
            </button>
          </div>

          {leaderboard.length === 0 ? (
            <div className="text-center py-8">
              <Trophy className="w-16 h-16 text-yellow-200 mx-auto mb-4" />
              <p className="text-stone-500 font-bold">暂无记录</p>
              <p className="text-stone-400 text-sm mt-2">快来成为第一个上榜的玩家吧！</p>
            </div>
          ) : (
            <div className="space-y-2">
              {leaderboard.map((entry, index) => (
                <div key={index} className={`flex items-center p-3 rounded-xl ${index < 3 ? 'bg-yellow-50' : 'bg-stone-50'}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-sm ${index === 0 ? 'bg-yellow-400 text-white' : index === 1 ? 'bg-gray-300 text-white' : index === 2 ? 'bg-amber-600 text-white' : 'bg-stone-200 text-stone-600'}`}>
                    {index + 1}
                  </div>
                  <div className="flex-1 ml-3">
                    <div className="font-black text-stone-800">{entry.name}</div>
                    <div className="text-xs text-stone-400">{entry.date}</div>
                  </div>
                  <div className="flex flex-col items-end">
                    <div className="font-black text-orange-600 text-lg">${entry.score}</div>
                    <div className={`text-xs font-bold ${entry.popularity > 0 ? 'text-red-500' : 'text-stone-400'}`}>
                      人气: {entry.popularity}%
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // 最高分记录UI
  if (showHighScore) {
    const highScore = getHighScore(restaurantId);
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-blue-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-[2rem] shadow-2xl p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <Star className="w-8 h-8 text-blue-500" />
              <h2 className="text-2xl font-black text-stone-800">我的分数</h2>
            </div>
            <button onClick={() => { setShowHighScore(false); setShowHomepage(true); }} className="p-2 bg-stone-100 rounded-full hover:bg-stone-200">
              <XCircle className="w-6 h-6 text-stone-500" />
            </button>
          </div>

          <div className="text-center py-8">
            <div className="w-20 h-20 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-4">
              <Star className="w-10 h-10 text-blue-500 fill-current" />
            </div>
            <div className="text-5xl font-black text-blue-600 mb-2">${highScore}</div>
            <div className="text-stone-500 font-bold">历史最高分</div>
            {highScore === 0 && (
              <p className="text-stone-400 text-sm mt-4">开始游戏来创造你的最高分吧！</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // 进入排行榜的名字输入UI
  if (showNameEntry) {
    return (
      <div className="min-h-screen bg-black/50 flex items-center justify-center p-4">
        <div className="max-w-sm w-full bg-white rounded-[2rem] shadow-2xl p-6">
          <div className="text-center mb-6">
            <Trophy className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
            <h2 className="text-2xl font-black text-stone-800">恭喜上榜！</h2>
            <p className="text-stone-500 mt-2">你的分数 ${pendingScore} 进入了排行榜！</p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-stone-600 mb-2">输入你的昵称</label>
              <input
                type="text"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="请输入昵称"
                maxLength={10}
                className="w-full px-4 py-3 rounded-xl border-2 border-stone-200 font-bold text-center focus:border-orange-500 focus:outline-none"
              />
            </div>
            <button
              onClick={() => {
                if (playerName.trim()) {
                  saveToLeaderboard(restaurantId, playerName.trim(), pendingScore, pendingPopularity);
                  setShowNameEntry(false);
                  setShowLeaderboard(true);
                  setPlayerName('');
                }
              }}
              disabled={!playerName.trim()}
              className="w-full bg-orange-600 hover:bg-orange-700 disabled:bg-stone-300 text-white font-black py-3 rounded-xl text-lg disabled:cursor-not-allowed"
            >
              保存到排行榜
            </button>
            <button
              onClick={() => {
                setShowNameEntry(false);
                setShowHomepage(true);
                setPlayerName('');
              }}
              className="w-full bg-stone-200 hover:bg-stone-300 text-stone-600 font-black py-3 rounded-xl text-lg"
            >
              稍后再说
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 游戏进行中或结束 - 重定向到首页
  if (state.gameStatus === 'idle' || state.gameStatus === 'ended') {
    return <></>;
  }

  return (
    <div className={`kitchen-game flex flex-col font-sans select-none ${state.isPaused ? 'game-paused' : ''}`}>

      
      <header className="bg-white border-b-2 border-stone-200 px-4 py-1 flex items-center justify-between shrink-0 shadow-sm z-50">
        <div className="flex items-center gap-4" data-tutorial="stats">
          <button type="button" title="返回主页" onClick={() => {
              wasPausedBeforeExitConfirm.current = state.isPaused;
              setShowExitConfirm(true);
              setState(prev => ({ ...prev, isPaused: true }));
            }}
            className="rounded-lg border border-orange-300 bg-orange-50 px-2 py-1 text-xs font-black text-orange-700 hover:bg-orange-100">回到主页</button>
          <span className="hidden font-black text-stone-600 sm:inline">{restaurant.name}</span>
          <div className="flex items-center gap-1.5 bg-green-50 px-2 py-0.5 rounded-lg border border-green-100">
            <DollarSign className="w-4 h-4 text-green-600" />
            <span className="text-xl font-black text-green-700 tabular-nums">${state.money.toFixed(1)}</span>
          </div>
          <div className="flex items-center gap-1.5 bg-red-50 px-2 py-0.5 rounded-lg border border-red-100">
             <Heart className={`w-4 h-4 ${state.popularity < 30 ? 'text-red-600 animate-pulse' : 'text-red-500'}`} fill="currentColor" />
             <span className="text-lg font-black text-red-700">{state.popularity}%</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => { setTutorialStep(0); if (state.gameStatus === 'playing') setState(prev => ({ ...prev, isPaused: true })); }} className="p-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-200 z-[400] relative" title="游戏规则" aria-label="游戏规则" style={{ pointerEvents: 'auto' }}>
            <AlertCircle className="w-4 h-4" />
          </button>
          <button onClick={() => setIsMuted(!isMuted)} className="p-1.5 rounded-lg bg-stone-50 hover:bg-stone-100 text-stone-500 border border-stone-200 z-[400] relative" style={{ pointerEvents: 'auto' }}>
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
          <button data-tutorial="timer" onClick={togglePause} disabled={state.gameStatus !== 'playing'} className={`flex items-center gap-1.5 px-4 py-1 rounded-full border transition-all ${state.timeLeft < 30 ? 'bg-red-600 text-white animate-pulse border-white' : 'bg-stone-800 text-white border-stone-700'} ${state.gameStatus !== 'playing' ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:opacity-90'} z-[400] relative`} style={{ pointerEvents: 'auto' }}>
            <Clock className="w-4 h-4" />
            <span className="text-xl font-black tabular-nums">{formatTime(state.timeLeft)}</span>
            {state.isPaused && <span className="text-xs ml-1">(暂停)</span>}
          </button>
        </div>
      </header>

      <main className="kitchen-layout">
        <section className="supply-section" aria-label="进货与仓库" data-tutorial="supplies">
          <div className="supply-headings">
            <h2><ShoppingCart />进货</h2><h2><Package />仓库</h2>
          </div>
          <div className="supply-shelves" style={{ '--ingredient-count': Object.keys(ingredients).length } as React.CSSProperties}>
            {(Object.keys(ingredients) as IngredientId[]).sort((a, b) => ingredients[a]!.price - ingredients[b]!.price).map(id => {
              const ing = ingredients[id]!;
              const pending = state.pendingDeliveries.filter(d => d.ingredientId === id);
              const isFull = state.inventory[id] + pending.length >= 10;
              const cannotBuy = state.money < ing.price || isFull || state.isPaused;
              return <div key={id} className="supply-line">
                <button className="supply-buy" type="button" onClick={() => buyIngredient(id)} disabled={cannotBuy}
                  aria-label={`购买${ing.name}，${ing.price}金币`}
                  title={isFull ? '库存已满（含配送中）' : `${ing.name} · 配送 ${ing.deliveryTime} 秒`}>
                  <span className="supply-icon" aria-hidden="true"><IngredientArtwork ingredient={ing} /></span>
                  <span className="supply-label"><strong>{ing.name}</strong><b>${ing.price}</b></span>
                  <DeliveryClock deliveries={pending} duration={ing.deliveryTime} />
                  {ingredientHint.ids.includes(id) && <span key={ingredientHint.sequence}
                    className="ingredient-shortage-hint" aria-hidden="true" />}
                </button>
                <StockShelf ingredient={ing} count={state.inventory[id]} disabled={state.isPaused}
                  onSell={() => sellIngredient(id)} />
              </div>;
            })}
          </div>
          <div className="fridge-foot" aria-hidden="true"><span /><span /><span /></div>
        </section>

        {/* Menu & Kitchen Section (Center) */}
        <div className="menu-kitchen">
          {/* Menu Section */}
          <section className="menu-board" data-tutorial="recipes">
            <div className="bg-stone-700 px-2 py-1 flex items-center justify-between text-white shrink-0">
              <div className="flex items-center gap-1"><TrendingUp className="w-3 h-3 text-orange-300" /><h2 className="text-[13px] font-black uppercase tracking-wider truncate">菜单</h2></div>
              <details className="menu-sort" onBlur={event => {
                if (!event.currentTarget.contains(event.relatedTarget as Node | null)) event.currentTarget.open = false;
              }} onKeyDown={event => {
                if (event.key === 'Escape') {
                  event.currentTarget.open = false;
                  event.currentTarget.querySelector('summary')?.focus();
                }
              }}>
                <summary aria-label={`菜单排序：${recipeSortOptions.find(option => option.value === recipeSort)?.label}，从低到高`}>
                  <ArrowDownWideNarrow aria-hidden="true" />排序
                </summary>
                <div className="menu-sort-options" role="group" aria-label="排序方式">
                  <span className="menu-sort-hint">从低到高</span>
                  {recipeSortOptions.map(option => <button key={option.value} type="button"
                    aria-pressed={recipeSort === option.value} title={option.value === 'profit' ? '利润 = 售价 − 食材总成本' : undefined}
                    onClick={event => {
                      setRecipeSort(option.value);
                      const dropdown = event.currentTarget.closest('details');
                      if (dropdown) {
                        dropdown.open = false;
                        dropdown.querySelector('summary')?.focus();
                      }
                    }}>
                    {option.label}<Check aria-hidden="true" />
                  </button>)}
                </div>
              </details>
            </div>
            <div className="recipe-grid">
              {sortedRecipes.map(recipe => (
                <RecipeCard key={recipe.id} recipe={recipe} inventory={state.inventory} ingredientCatalog={ingredients}
                  hasOrder={state.activeOrders.some(order => order.dishId === recipe.id)}
                  paused={state.isPaused} stationAvailable={hasAvailableStation(recipe)}
                  stationName={restaurant.stationTypes.find(type => type.id === recipe.requiredStationType)?.equipmentLabel}
                  requiredStationName={recipe.requiredStationType ? restaurant.stationTypes.find(type => type.id === recipe.requiredStationType)?.equipmentLabel : undefined}
                  onCook={() => startCooking(recipe)}
                  onInspect={() => highlightMissingIngredients(recipe)} />
              ))}
            </div>
          </section>

          {/* Cooking Section */}
          <section className={`stove-section flex flex-col p-1 ${restaurant.cookwareTypes.length > 0 ? 'has-cookware' : ''}`} data-tutorial="stoves">
            {restaurant.cookwareTypes.length > 0 && (
              <div className="cookware-purchase-rack" aria-label="锅具仓库"
                onDragOver={event => {
                  if (!state.isPaused && event.dataTransfer.types.includes('application/x-kitchen-stove-cookware')) event.preventDefault();
                }}
                onDrop={event => {
                  const sourceId = event.dataTransfer.getData('application/x-kitchen-stove-cookware');
                  if (!sourceId || state.isPaused) return;
                  event.preventDefault();
                  removeCookware(Number(sourceId));
                }}>
                {restaurant.cookwareTypes.map(cookware => {
                  const count = state.cookwareInventory[cookware.id] ?? 0;
                  return <button key={cookware.id} type="button" className="cookware-rack-item"
                    onClick={() => placeFirstAvailableCookware(cookware.id)} disabled={state.isPaused || count < 1}
                    draggable={!state.isPaused && count > 0}
                    onDragStart={event => { event.dataTransfer.setData('application/x-kitchen-cookware', cookware.id); event.dataTransfer.effectAllowed = 'move'; }}
                    aria-label={`放置${cookware.name}，库存${count}个；拖到空灶台可指定位置`}
                    title={`${cookware.name} · 库存 ${count} · 点击放到首个空灶台，或拖动到指定空灶台`}>
                    <img src={cookware.visualAsset} alt="" aria-hidden="true" />
                    <span className="cookware-rack-name">{cookware.name}</span>
                    <span className="cookware-rack-count">×{count}</span>
                  </button>;
                })}
                <button type="button" className="cookware-add-button" onClick={() => setShowCookwareShop(true)} disabled={state.isPaused} aria-label="购买锅具" title="购买锅具">+</button>
              </div>
            )}
            <div className="station-slots flex-1 flex gap-1">
              {state.stoves.map(stove => {
                const activeRecipe = recipes.find(r => r.id === stove.dishId);
                const cookware = restaurant.cookwareTypes.find(type => type.id === stove.cookwareId);
                const isInstalling = stove.installTimeLeft > 0;
                
                return (
                  <div key={stove.id} onDragOver={event => { if (stove.isInstalled && !stove.isCooking && !stove.isDone && !stove.cookwareId && !state.isPaused) event.preventDefault(); }}
                    onDrop={event => { event.preventDefault(); const id = event.dataTransfer.getData('application/x-kitchen-cookware'); if (id) placeCookware(stove.id, id); }}
                    className={`flex-1 relative px-1 py-1 rounded-lg border flex items-center shadow-inner group overflow-hidden transition-all ${
                    stove.isInstalled && !stove.isCooking && !stove.isDone && !stove.cookwareId ? 'station-slot-drop-target' : ''
                  } ${
                    !stove.isInstalled 
                      ? 'bg-stone-100 border-dashed border-stone-300' 
                      : 'bg-stone-50/50 border-stone-100'
                  }`}>
                    {/* 未安装的灶台 - 显示+号和安装按钮 */}
                    {!stove.isInstalled ? (
                      isInstalling ? (
                        // 正在安装中
                        <div className="w-full flex flex-col items-center justify-center gap-1">
                          <div className="text-lg animate-pulse">🔧</div>
                          <div className="flex flex-col items-center gap-0.5">
                            <span className="stove-status font-black text-orange-600">安装中...</span>
                            <span className="stove-status font-black text-orange-500">{stove.installTimeLeft}s</span>
                          </div>
                          <div className="w-full bg-stone-200 h-1 rounded-full overflow-hidden">
                            <div className="bg-gradient-to-r from-orange-400 to-red-500 h-full transition-all" style={{ width: `${((restaurant.stoveInstallTime - stove.installTimeLeft) / restaurant.stoveInstallTime) * 100}%` }} />
                          </div>
                        </div>
                      ) : (
                        // 未安装 - 三行文字均匀居中
                        <button 
                          onClick={() => buildStove(stove.id)}
                          disabled={state.isPaused || state.money < restaurant.stoveInstallCost}
                          className={`w-full h-full flex flex-col items-center justify-center gap-1 transition-all ${
                            state.money >= restaurant.stoveInstallCost && !state.isPaused
                              ? 'cursor-pointer hover:bg-orange-50 active:scale-95' 
                              : 'opacity-50 cursor-not-allowed'
                          }`}
                        >
                          <span className="stove-label font-bold text-stone-400 uppercase">{restaurant.cookwareTypes.length > 0 ? '建造灶台' : '安装灶台'}</span>
                          <span className={`stove-label font-black ${state.money >= restaurant.stoveInstallCost ? 'text-green-600' : 'text-red-500'}`}>
                            ${restaurant.stoveInstallCost}
                          </span>
                          <span className="stove-status text-stone-400 font-medium">⏱{restaurant.stoveInstallTime}秒</span>
                        </button>
                      )
                    ) : stove.isCooking ? (
                      // 烹饪中 - 四行布局：图标、菜名、时间条、取消按钮
                      <div className="w-full flex flex-col items-center justify-center gap-0.5 animate-in slide-in-from-bottom-1 duration-200 h-full py-0.5">
                        {cookware && <CookwareArtwork cookware={cookware} compact />}
                        {/* 第一排：菜品图标 */}
                        <div className="text-xl shrink-0">{activeRecipe && <DishArtwork icon={activeRecipe.icon} image={activeRecipe.image} />}</div>
                        {/* 第二排：菜名 */}
                        <span className="stove-label font-black text-stone-700">{activeRecipe?.name}</span>
                        {/* 第三排：进度条和倒计时 */}
                        <div className="w-full flex items-center gap-1 px-1">
                          <div className="flex-1 bg-stone-200 h-1.5 rounded-full overflow-hidden border border-white">
                            <div className="bg-gradient-to-r from-orange-400 to-red-600 h-full" style={{ width: `${stove.progress}%` }} />
                          </div>
                          <span className="stove-status bg-orange-600 text-white px-1 rounded-sm font-black shadow-sm animate-pulse shrink-0">{stove.timeRemaining}s</span>
                        </div>
                        {/* 第四排：关闭按钮 */}
                        <button onClick={() => cancelCooking(stove.id)} disabled={state.isPaused} className={`text-red-400 hover:text-red-600 transition-colors ${state.isPaused ? 'opacity-50 cursor-not-allowed' : ''}`}>
                          <XCircle className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : stove.isDone ? (
                      // 已做好 - 显示菜品和上菜/丢弃按钮
                      <div className="w-full flex flex-col items-center justify-center gap-0.5 h-full py-0.5">
                        {cookware && <CookwareArtwork cookware={cookware} compact />}
                        {/* 菜品图标 */}
                        <div className="text-xl shrink-0 relative">
                          {activeRecipe && <DishArtwork icon={activeRecipe.icon} image={activeRecipe.image} />}
                          <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full flex items-center justify-center">
                            <span className="text-[8px]">✓</span>
                          </div>
                        </div>
                        {/* 菜名 */}
                        <span className="stove-label font-black text-green-700">{activeRecipe?.name}</span>
                        {/* 已做好标签 */}
                        <span className="stove-status font-black text-green-600 bg-green-100 px-1.5 rounded">已做好</span>
                        {/* 丢弃按钮 */}
                        <button onClick={() => discardDish(stove.id)} disabled={state.isPaused} className={`text-stone-400 hover:text-red-500 transition-colors ${state.isPaused ? 'opacity-50 cursor-not-allowed' : ''}`} title="丢弃菜品">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : cookware ? (
                      <div className="station-equipped-view" draggable={!state.isPaused}
                        onDragStart={event => {
                          event.dataTransfer.setData('application/x-kitchen-stove-cookware', String(stove.id));
                          event.dataTransfer.effectAllowed = 'move';
                        }}
                        title={`${cookware.name} · 拖到上方锅具仓库可撤下`}>
                        <CookwareArtwork cookware={cookware} />
                        <button type="button" className="station-remove-cookware" disabled={state.isPaused}
                          onClick={() => removeCookware(stove.id)} title={`撤下${cookware.name}`}>
                          <RotateCcw aria-hidden="true" /><span>撤下</span>
                        </button>
                      </div>
                    ) : restaurant.cookwareTypes.length > 0 ? (
                      <div className="station-empty-view">
                        <img className="empty-station-art" src={restaurant.emptyStationVisualAsset} alt="空灶台" />
                        <span className="station-buy-hint">从上方锅具仓库点击或拖入</span>
                      </div>
                    ) : (
                      // 西餐厅保留原有灶台显示
                      <div className="w-full text-center opacity-15 text-[17px] font-black uppercase tracking-widest flex items-center justify-center gap-1"><Flame className="w-3 h-3" />灶台</div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        {/* Orders Section (Right) */}
        <section className="orders-section flex flex-col" data-tutorial="orders">
          <div className="bg-stone-700 px-2 py-1 flex items-center justify-between text-white shrink-0">
            <div className="flex items-center gap-1"><AlertCircle className="w-3 h-3 text-red-300" /><h2 className="text-[13px] font-black uppercase tracking-wider truncate">订单</h2></div>
            <span className="bg-white/20 text-[8px] px-1.5 rounded-full font-black">{state.activeOrders.length}</span>
          </div>
            <div className="order-list">
              {state.activeOrders.map(order => {
                const recipe = recipes.find(r => r.id === order.dishId)!;
                // 最后20秒是催单区间
                const isUrgent = order.expiryTime <= 20;
                // 最左边20秒轻微区分 (expiryTime > 60)
                const isNew = order.expiryTime > 60;
                // 订单是否正在制作中
                const isCooking = order.isCooking;
                const displayTime = order.expiryTime;
                const maxTime = 80; // 统一80秒
                const progressWidth = (displayTime / maxTime) * 100;
                const canCook = Object.entries(recipe.ingredients).every(([ingId, count]) => state.inventory[ingId as IngredientId] >= (count || 0));
                const hasFreeStove = hasAvailableStation(recipe);
                const requiredStationName = restaurant.stationTypes.find(type => type.id === recipe.requiredStationType)?.name;
                const canAttemptCooking = !state.isPaused && !isCooking && (!canCook || hasFreeStove);
                // 检查灶台上是否有对应的已做好的菜品
                const hasReadyDish = state.stoves.some(s => s.isDone && s.dishId === order.dishId);
                const canServe = hasReadyDish && !state.isPaused;
                return (
                  <div key={order.id} className={`order-ticket flex flex-col p-1.5 rounded-lg border transition-all shadow-sm ${isUrgent ? 'border-red-600 bg-red-50 animate-pulse' : isNew ? 'border-blue-200 bg-blue-50/50' : 'border-stone-50'}`}>
                    <div className="flex items-center gap-1 mb-1">
                      <button type="button" className="order-dish" disabled={state.isPaused}
                        onClick={() => highlightMissingIngredients(recipe)} aria-label={`${recipe.name}：检查缺少的食材`}>
                        <div className="text-2xl shrink-0"><DishArtwork icon={recipe.icon} image={recipe.image} /></div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1 mb-0.5">
                            <span className="font-black text-stone-800 text-[9px] leading-tight truncate">{recipe.name}</span>
                            {isCooking && (
                              <span className="text-stone-500 bg-stone-100 px-1 rounded shrink-0 text-[7px] font-black">制作中</span>
                            )}
                          </div>
                          <div className="flex items-center justify-between text-[7px] font-black uppercase">
                             <span className={isUrgent ? 'text-red-600 font-bold' : isNew ? 'text-blue-500' : 'text-stone-400'}>{isUrgent ? `催单! ${displayTime}s` : `${displayTime}s`}</span>
                             <span className={order.type === 'blogger' ? 'text-purple-500' : 'text-stone-300'}>{order.type === 'blogger' ? '博主' : '普通'}</span>
                          </div>
                        </div>
                      </button>
                      {hasReadyDish ? (
                        <button type="button" disabled={!canServe}
                          onClick={() => serveDish(order.id)}
                          className="cook-button serve-button"
                          title={state.isPaused ? '游戏已暂停' : '上菜并完成订单'}
                        >
                          <Utensils aria-hidden="true" /><span>上菜</span>
                        </button>
                      ) : (
                        <CookButton hasIngredients={canCook} hasOrder={true} disabled={!canAttemptCooking}
                          onClick={() => acceptOrder(order)} label={isCooking ? '制作中' : '烹饪'}
                          title={state.isPaused ? '游戏已暂停' : isCooking ? '正在制作' : !canCook ? '食材不足，点击查看缺少的食材' : !hasFreeStove ? `没有可用的${requiredStationName ?? '灶台'}` : '接受订单并烹饪'} />
                      )}
                    </div>
                    <div className="w-full bg-stone-100 h-1 rounded-full overflow-hidden"><div className={`h-full transition-all duration-1000 ease-linear ${isUrgent ? 'bg-red-600 animate-pulse' : isNew ? 'bg-blue-400' : 'bg-orange-400'}`} style={{ width: `${progressWidth}%` }} /></div>
                  </div>
                );
              })}
            </div>
          </section>
      </main>

      {/* Center Popup Notifications */}
      {showExitConfirm && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm" role="presentation">
          <section className="w-full max-w-md rounded-3xl border-4 border-orange-200 bg-white p-6 text-center shadow-2xl" role="alertdialog" aria-modal="true" aria-labelledby="exit-confirm-title" aria-describedby="exit-confirm-description">
            <h2 id="exit-confirm-title" className="text-xl font-black text-stone-800">确认回到主页？</h2>
            <p id="exit-confirm-description" className="mt-3 text-sm font-bold leading-relaxed text-stone-600">当前这局的游戏进度不会保存。确定后将结束本局并返回餐厅选择页面。</p>
            <div className="mt-6 flex justify-center gap-3">
              <button type="button" autoFocus onClick={() => {
                  setShowExitConfirm(false);
                  setState(prev => ({ ...prev, isPaused: wasPausedBeforeExitConfirm.current }));
                }} className="rounded-xl bg-stone-200 px-5 py-2.5 font-black text-stone-700 hover:bg-stone-300">继续游戏</button>
              <button type="button" onClick={() => {
                  setShowExitConfirm(false);
                  setState(prev => ({ ...prev, gameStatus: 'idle', isPaused: true }));
                  setShowHomepage(true);
                }} className="rounded-xl bg-orange-600 px-5 py-2.5 font-black text-white hover:bg-orange-700">确认返回主页</button>
            </div>
          </section>
        </div>
      )}

      {notification && (
        <div className={`fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 px-6 py-4 rounded-3xl shadow-xl flex flex-col items-center gap-2 animate-in zoom-in fade-in duration-300 z-[200] border-4 backdrop-blur-md ${notification.type === 'success' ? 'bg-green-600/90 border-green-200 text-white' : notification.type === 'error' ? 'bg-red-700/90 border-red-300 text-white' : 'bg-stone-900/90 border-stone-600 text-white'}`}>
          <span className="font-black text-lg text-center leading-tight tracking-tight drop-shadow">{notification.msg}</span>
        </div>
      )}

      {showCookwareShop && restaurant.cookwareTypes.length > 0 && (
        <div className="cookware-shop-overlay" onClick={() => setShowCookwareShop(false)}>
          <section className="cookware-shop-dialog" role="dialog" aria-modal="true" aria-labelledby="cookware-shop-title" onClick={event => event.stopPropagation()}>
            <header><h2 id="cookware-shop-title">购买锅具</h2><button type="button" onClick={() => setShowCookwareShop(false)} aria-label="关闭">×</button></header>
            <div className="cookware-shop-grid">
              {restaurant.cookwareTypes.map(cookware => (
                <article className="cookware-shop-card" key={cookware.id}>
                  <CookwareArtwork cookware={cookware} />
                  <h3>{cookware.name}</h3><p>{cookware.description}</p>
                  <button type="button" disabled={state.isPaused || state.money < cookware.price}
                    onClick={() => { if (buyCookware(cookware.id)) setShowCookwareShop(false); }}>
                    购买 · ${cookware.price}
                  </button>
                </article>
              ))}
            </div>
          </section>
        </div>
      )}

      {tutorialStep !== null && (() => {
        const step = tutorialSteps[tutorialStep];
        const rect = tutorialRect;
        const bubbleWidth = Math.min(340, window.innerWidth - 32);
        const bubbleLeft = rect ? Math.max(16, Math.min(window.innerWidth - bubbleWidth - 16, rect.left + rect.width / 2 - bubbleWidth / 2)) : (window.innerWidth - bubbleWidth) / 2;
        const placeBelow = !!rect && rect.bottom + 210 < window.innerHeight;
        const bubbleTop = rect ? Math.max(16, Math.min(window.innerHeight - 190, placeBelow ? rect.bottom + 14 : rect.top - 194)) : Math.max(24, window.innerHeight / 2 - 100);
        const cutout = rect ? { left: Math.max(0, rect.left - 8), top: Math.max(0, rect.top - 8), width: Math.min(window.innerWidth, rect.width + 16), height: Math.min(window.innerHeight, rect.height + 16) } : null;
        return <div className="tutorial-layer" role="dialog" aria-modal="true" aria-labelledby="tutorial-title">
          {cutout && <>
            <div className="tutorial-shade" style={{ left: 0, top: 0, width: '100%', height: cutout.top }} />
            <div className="tutorial-shade" style={{ left: 0, top: cutout.top, width: cutout.left, height: cutout.height }} />
            <div className="tutorial-shade" style={{ left: cutout.left + cutout.width, top: cutout.top, right: 0, height: cutout.height }} />
            <div className="tutorial-shade" style={{ left: 0, top: cutout.top + cutout.height, width: '100%', bottom: 0 }} />
            <div className="tutorial-focus" style={{ left: cutout.left, top: cutout.top, width: cutout.width, height: cutout.height }} />
          </>}
          <section className={`tutorial-bubble ${placeBelow ? 'arrow-top' : 'arrow-bottom'}`} style={{ left: bubbleLeft, top: bubbleTop, width: bubbleWidth }}>
            <div className="tutorial-progress">新手指引 · {tutorialStep + 1}/{tutorialSteps.length}</div>
            <h2 id="tutorial-title">{step.title}</h2><p>{step.text}</p>
            <div className="tutorial-actions">
              <button type="button" className="tutorial-skip" onClick={closeTutorial}>关闭指引</button>
              <button type="button" className="tutorial-next" onClick={() => tutorialStep === tutorialSteps.length - 1 ? closeTutorial() : setTutorialStep(tutorialStep + 1)}>{tutorialStep === tutorialSteps.length - 1 ? '完成' : '下一步'}</button>
            </div>
          </section>
        </div>;
      })()}

    </div>
  );
};

export default App;
