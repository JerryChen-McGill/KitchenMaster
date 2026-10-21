
import React, { useState, useEffect, useRef } from 'react';
import { KitchenView } from './ui';
import { INGREDIENTS, RECIPES, INITIAL_MONEY, GAME_DURATION, STOVE_COUNT } from './constants';
import { IngredientId, GameState, Recipe, Order, Stove, PendingDelivery, CustomerType } from './types';

const App: React.FC = () => {
  const [state, setState] = useState<GameState>({
    money: INITIAL_MONEY,
    inventory: { tomato: 0, lettuce: 0, onion: 0, meat: 0, bread: 0, cheese: 0, potato: 0 },
    stoves: Array(STOVE_COUNT).fill(null).map((_, i) => ({ id: i, isCooking: false, dishId: null, timeRemaining: 0, progress: 0 })),
    activeOrders: [],
    pendingDeliveries: [],
    totalRevenue: 0,
    popularity: 100,
    timeLeft: GAME_DURATION,
    gameStatus: 'idle'
  });

  const [notification, setNotification] = useState<{msg: string, type: 'success' | 'error' | 'neutral'} | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [flashingIngredients, setFlashingIngredients] = useState<IngredientId[]>([]);
  const timerRef = useRef<number | null>(null);
  
  const bgmRef = useRef<HTMLAudioElement | null>(null);
  const sfxBuy = useRef<HTMLAudioElement | null>(null);
  const sfxCook = useRef<HTMLAudioElement | null>(null);
  const sfxSuccess = useRef<HTMLAudioElement | null>(null);
  const sfxFail = useRef<HTMLAudioElement | null>(null);
  const sfxClick = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    bgmRef.current = new Audio('https://assets.mixkit.co/music/preview/mixkit-serene-view-443.mp3');
    bgmRef.current.loop = true;
    bgmRef.current.volume = 0.25;

    const workSoundUrl = 'https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3';
    sfxBuy.current = new Audio(workSoundUrl);
    sfxCook.current = new Audio(workSoundUrl);
    sfxClick.current = new Audio(workSoundUrl);
    
    sfxSuccess.current = new Audio('https://assets.mixkit.co/active_storage/sfx/951/951-preview.mp3');
    sfxSuccess.current.volume = 0.6;
    
    sfxFail.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2895/2895-preview.mp3');
    sfxFail.current.volume = 0.5;

    return () => {
      bgmRef.current?.pause();
    };
  }, []);

  useEffect(() => {
    if (bgmRef.current) bgmRef.current.muted = isMuted;
  }, [isMuted]);

  const playSfx = (audio: HTMLAudioElement | null) => {
    if (isMuted || !audio) return;
    audio.currentTime = 0;
    audio.play().catch(() => {}); 
  };

  const notify = (msg: string, type: 'success' | 'error' | 'neutral' = 'neutral') => {
    setNotification({ msg, type });
    if (type === 'success') playSfx(sfxSuccess.current);
    if (type === 'error') playSfx(sfxFail.current);
    setTimeout(() => setNotification(null), 2500);
  };

  const createNewOrder = (): Order => {
    const randomRecipe = RECIPES[Math.floor(Math.random() * RECIPES.length)];
    const roll = Math.random();
    let type: CustomerType = 'normal';
    if (roll < 0.15) type = 'blogger';
    else if (roll < 0.30) type = 'grumpy';
    else if (roll < 0.45) type = 'happy';
    
    const expiry = 45 + Math.floor(Math.random() * 25);
    return {
      id: Math.random().toString(36).substr(2, 9),
      dishId: randomRecipe.id,
      expiryTime: expiry,
      maxTime: expiry,
      type
    };
  };

  const startGame = () => {
    playSfx(sfxClick.current);
    bgmRef.current?.play().catch(() => {});
    setState({
      money: INITIAL_MONEY,
      inventory: { tomato: 0, lettuce: 0, onion: 0, meat: 0, bread: 0, cheese: 0, potato: 0 },
      stoves: Array(STOVE_COUNT).fill(null).map((_, i) => ({ id: i, isCooking: false, dishId: null, timeRemaining: 0, progress: 0 })),
      activeOrders: [createNewOrder(), createNewOrder(), createNewOrder()],
      pendingDeliveries: [],
      totalRevenue: 0,
      popularity: 100,
      timeLeft: GAME_DURATION,
      gameStatus: 'playing'
    });
  };

  const buyIngredient = (id: IngredientId) => {
    const item = INGREDIENTS[id];
    const pendingCount = state.pendingDeliveries.filter(d => d.ingredientId === id).length;
    const currentTotal = state.inventory[id] + pendingCount;

    if (currentTotal >= 10) {
      return notify(`${item.name} 采购计划已满!`, 'neutral');
    }

    if (state.money >= item.price) {
      playSfx(sfxBuy.current);
      const deliveryId = Math.random().toString(36).substr(2, 5);
      setState(prev => ({
        ...prev,
        money: prev.money - item.price,
        pendingDeliveries: [...prev.pendingDeliveries, { id: deliveryId, ingredientId: id, timeLeft: item.deliveryTime }]
      }));
      notify(`已下单: ${item.name} 支出 -$${item.price}`, 'neutral');
    } else {
      notify("余额不足以启动采购!", 'error');
    }
  };

  const startCooking = (recipe: Recipe) => {
    const missing = Object.entries(recipe.ingredients)
      .filter(([ingId, count]) => state.inventory[ingId as IngredientId] < (count || 0))
      .map(([ingId]) => ingId as IngredientId);

    if (missing.length > 0) {
      setFlashingIngredients(missing);
      setTimeout(() => setFlashingIngredients([]), 1500);
      return notify("食材短缺!", 'neutral');
    }

    const freeStoveIndex = state.stoves.findIndex(s => !s.isCooking);
    if (freeStoveIndex === -1) return notify("灶台全满!", 'neutral');

    playSfx(sfxCook.current);
    const newInventory = { ...state.inventory };
    Object.entries(recipe.ingredients).forEach(([ingId, count]) => { newInventory[ingId as IngredientId] -= (count || 0); });
    const newStoves = [...state.stoves];
    newStoves[freeStoveIndex] = { ...newStoves[freeStoveIndex], isCooking: true, dishId: recipe.id, timeRemaining: recipe.cookingTime, progress: 0 };
    setState(prev => ({ ...prev, inventory: newInventory, stoves: newStoves }));
  };

  const cancelCooking = (stoveId: number) => {
    playSfx(sfxClick.current);
    const newStoves = state.stoves.map(s => {
      if (s.id === stoveId && s.isCooking) {
        return { ...s, isCooking: false, dishId: null, progress: 0, timeRemaining: 0 };
      }
      return s;
    });
    setState(prev => ({ ...prev, stoves: newStoves }));
    notify("烹饪已取消，食材已损耗", 'neutral');
  };

  useEffect(() => {
    if (state.gameStatus !== 'playing') return;
    timerRef.current = window.setInterval(() => {
      setState(prev => {
        if (prev.timeLeft <= 0 || prev.popularity <= 0 || prev.money <= 0) { 
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
              notify(`${INGREDIENTS[d.ingredientId].name} 已送达!`, 'neutral'); 
            } else {
              notify(`${INGREDIENTS[d.ingredientId].name} 仓库溢出!`, 'error');
            }
          }
          else stillPending.push({ ...d, timeLeft: d.timeLeft - 1 });
        });

        const updatedStoves = prev.stoves.map(s => {
          if (!s.isCooking) return s;
          const recipe = RECIPES.find(r => r.id === s.dishId)!;
          const newTime = Math.max(0, s.timeRemaining - 1);
          return { ...s, timeRemaining: newTime, progress: ((recipe.cookingTime - newTime) / recipe.cookingTime) * 100 };
        });

        let newRevenue = prev.totalRevenue;
        let newPopularity = prev.popularity;
        let currentMoney = prev.money;
        let currentOrders = [...prev.activeOrders];

        const finalStoves = updatedStoves.map(s => {
          if (s.isCooking && s.timeRemaining === 0) {
            const recipe = RECIPES.find(r => r.id === s.dishId)!;
            const orderIndex = currentOrders.findIndex(o => o.dishId === recipe.id);
            if (orderIndex !== -1) {
              const order = currentOrders[orderIndex];
              let popGain = 1;
              let tip = 0;
              let msgSuffix = "";
              if (order.type === 'blogger') { popGain = 15; msgSuffix = " (金牌博主推荐!)"; }
              if (order.type === 'happy') { popGain = 10; tip = 20; msgSuffix = " (厚礼小费+$20!)"; }
              newRevenue += recipe.salePrice + tip;
              currentMoney += recipe.salePrice + tip;
              newPopularity = Math.min(100, newPopularity + popGain);
              currentOrders.splice(orderIndex, 1);
              notify(`成功卖出: ${recipe.name}! +$${(recipe.salePrice + tip)}${msgSuffix}`, 'success');
            } else {
              notify(`${recipe.name} 没人下单，可惜了。`, 'neutral');
            }
            return { ...s, isCooking: false, dishId: null, progress: 0 };
          }
          return s;
        });

        const expired = currentOrders.filter(o => o.expiryTime <= 1);
        expired.forEach(o => {
          let popLoss = 5;
          let msg = "订单超时!";
          if (o.type === 'blogger') { popLoss = 30; msg = "博主发了差评视频!"; }
          if (o.type === 'grumpy') { popLoss = 20; msg = "由于等待过久，顾客怒而离席!"; }
          newPopularity = Math.max(0, newPopularity - popLoss);
          notify(`${msg} 人气-${popLoss}`, 'error');
        });

        const remainingOrders = currentOrders.map(o => ({ ...o, expiryTime: o.expiryTime - 1 })).filter(o => o.expiryTime > 0);
        if (remainingOrders.length < 5 && Math.random() < 0.12) remainingOrders.push(createNewOrder());

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
  }, [state.gameStatus]);

  return <KitchenView
    state={state}
    isMuted={isMuted}
    flashingIngredients={flashingIngredients}
    notification={notification}
    onStart={startGame}
    onBuy={buyIngredient}
    onCook={startCooking}
    onCancel={cancelCooking}
    onMute={() => { setIsMuted(!isMuted); playSfx(sfxClick.current); }}
  />;
};

export default App;
