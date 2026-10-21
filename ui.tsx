import React, { useState } from 'react';
import { ChefHat, Clock3, Heart, ShoppingCart, Package, Plus, Volume2, VolumeX, Flame, X, Play, RotateCcw, ReceiptText, Star } from 'lucide-react';
import { INGREDIENTS, RECIPES } from './constants';
import { GameState, IngredientId, Recipe, PendingDelivery } from './types';
import './index.css';

const DISPLAY_INGREDIENTS: IngredientId[] = ['onion', 'lettuce', 'tomato', 'potato', 'bread', 'cheese', 'meat'];
const DISPLAY_RECIPES = ['fries', 'salad', 'burger', 'pizza', 'cheeseburger', 'steak'].map(id => RECIPES.find(recipe => recipe.id === id)!);

export function cookingAppearance(recipe: Recipe, state: Pick<GameState, 'inventory' | 'activeOrders'>) {
  const available = Object.entries(recipe.ingredients).every(([id, count]) => state.inventory[id as IngredientId] >= (count || 0));
  const ordered = state.activeOrders.some(order => order.dishId === recipe.id);
  return { available, ordered, tone: ordered ? (available ? 'ordered' : 'waiting') : (available ? 'ready' : 'unavailable') };
}

function CookButton({ recipe, state, onCook, compact = false }: { recipe: Recipe; state: GameState; onCook: (recipe: Recipe) => void; compact?: boolean }) {
  const { available, ordered, tone } = cookingAppearance(recipe, state);
  return <button type="button" className={`cook-button cook-${tone}${compact ? ' cook-compact' : ''}`} disabled={!available}
    aria-label={`烹饪${recipe.name}${available ? '' : '，食材不足'}`} title={`${ordered ? '有订单 · ' : ''}${available ? '食材齐全，开始烹饪' : '食材不足'}`}
    onClick={event => { event.stopPropagation(); onCook(recipe); }}>
    <ChefHat aria-hidden="true" /><span>烹饪</span>
  </button>;
}

function DeliveryClock({ delivery, count }: { delivery: PendingDelivery; count: number }) {
  const duration = INGREDIENTS[delivery.ingredientId].deliveryTime;
  const [elapsedAtMount] = useState(duration - delivery.timeLeft);
  return <span className="delivery-clock" role="img" aria-label={`${count} 件在途，下一件 ${delivery.timeLeft} 秒后到货`}
    title={`${count} 件在途 · 下一件 ${delivery.timeLeft} 秒后到货`}
    style={{ '--delivery-duration': `${duration}s`, '--delivery-delay': `${-elapsedAtMount}s` } as React.CSSProperties}>
    <svg viewBox="0 0 40 40" aria-hidden="true">
      <circle className="clock-track" cx="20" cy="20" r="16" />
      <circle className="clock-progress" cx="20" cy="20" r="16" pathLength="100" />
      <path className="clock-ticks" d="M20 6v3 M34 20h-3 M20 34v-3 M6 20h3" />
      <path className="clock-hand" d="M20 20V10" />
      <circle cx="20" cy="20" r="2.3" fill="currentColor" />
    </svg>
    <span className="delivery-count">×{count}</span>
  </span>;
}

export function InventoryShelf({ id, count, flashing }: { id: IngredientId; count: number; flashing: boolean }) {
  const ingredient = INGREDIENTS[id];
  return <div className={`fridge-shelf${flashing ? ' shelf-flash' : ''}`} aria-label={`${ingredient.name}库存 ${count} 件`}>
    <span className={`inventory-count${count === 0 ? ' inventory-empty' : ''}`}>×{count}</span>
    <div className="inventory-slots" aria-hidden="true">
      {Array.from({ length: 5 }, (_, slot) => {
        const quantity = slot === 4 ? Math.max(0, count - 4) : (count > slot ? 1 : 0);
        return <div key={slot} className={`inventory-slot${quantity > 1 ? ' inventory-stack' : ''}`}>
          {Array.from({ length: quantity }, (_, item) => <span key={item} className="stored-ingredient"
            style={quantity > 1 ? { '--stack-x': `${[-7, 6, -4, 8, -8, 3][item]}px`, '--stack-y': `${[3, 2, -7, -8, -17, -18][item]}px`, '--stack-angle': `${[-12, 12, -6, 16, -14, 8][item]}deg`, zIndex: item + 1 } as React.CSSProperties : undefined}>{ingredient.icon}</span>)}
        </div>;
      })}
    </div>
  </div>;
}

export function RecipeCard({ recipe, state, onCook }: { recipe: Recipe; state: GameState; onCook: (recipe: Recipe) => void }) {
  const [flipped, setFlipped] = useState(false);
  return <article className={`recipe-card${flipped ? ' is-flipped' : ''}`}>
    <button type="button" className="recipe-flip" onClick={() => setFlipped(value => !value)} aria-pressed={flipped}
      aria-label={`${recipe.name}，${flipped ? '查看正面' : '查看食材和烹饪时间'}`}>
      <span className="recipe-turner">
        <span className="recipe-face recipe-front" aria-hidden={flipped}>
          <span className={`dish-art${recipe.icon.length > 3 ? ' dish-art-pair' : ''}`}>{recipe.icon}</span>
          <span className="dish-name">{recipe.name}</span>
          <span className="dish-price">${recipe.salePrice}</span>
        </span>
        <span className="recipe-face recipe-back" aria-hidden={!flipped}>
          <span className="recipe-ingredients">
            {Object.entries(recipe.ingredients).map(([id, count]) => <span key={id} className={`recipe-ingredient${state.inventory[id as IngredientId] < (count || 0) ? ' ingredient-missing' : ''}`}
              title={`${INGREDIENTS[id as IngredientId].name} ×${count}`}>
              <span>{INGREDIENTS[id as IngredientId].icon}</span><small>×{count}</small>
              <span className="sr-only">{INGREDIENTS[id as IngredientId].name}</span>
            </span>)}
          </span>
          <span className="recipe-time"><Clock3 aria-hidden="true" />{recipe.cookingTime}<small>秒</small></span>
        </span>
      </span>
    </button>
    <CookButton recipe={recipe} state={state} onCook={onCook} />
  </article>;
}

interface KitchenViewProps {
  state: GameState;
  isMuted: boolean;
  flashingIngredients: IngredientId[];
  notification: { msg: string; type: 'success' | 'error' | 'neutral' } | null;
  onStart: () => void;
  onBuy: (id: IngredientId) => void;
  onCook: (recipe: Recipe) => void;
  onCancel: (id: number) => void;
  onMute: () => void;
}

export function KitchenView({ state, isMuted, flashingIngredients, notification, onStart, onBuy, onCook, onCancel, onMute }: KitchenViewProps) {
  const formatTime = (seconds: number) => `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
  if (state.gameStatus !== 'playing') {
    const ended = state.gameStatus === 'ended';
    const bankrupt = ended && (state.popularity <= 0 || state.money <= 0);
    return <div className="welcome-scene"><main className="welcome-card">
      <div className="welcome-emblem"><ChefHat /></div>
      <p className="eyebrow">YOUR LITTLE KITCHEN</p>
      <h1>厨房小当家</h1><p className="welcome-english">KITCHEN MASTER</p>
      {ended ? <div className="settlement">
        <h2>{bankrupt ? '本次营业结束' : '今天也辛苦啦！'}</h2>
        {bankrupt && <p>{state.popularity <= 0 ? '店铺口碑为零，顾客不再光顾，宣布破产。' : '店铺资金耗尽，无法支付货款，宣布破产。'}</p>}
        <div className="settlement-money">${state.money.toFixed(0)}</div><p>最终店铺结算金额</p>
        <div className="settlement-stats"><span>❤️ 口碑 {state.popularity}%</span><span>💰 营业额 ${state.totalRevenue.toFixed(0)}</span></div>
      </div> : <><div className="welcome-food" aria-hidden="true">🥬 🍔 🍅</div><p className="welcome-copy">备好新鲜食材，点亮灶台。<br />用一份份美味，经营你的小小厨房。</p><div className="welcome-guide"><span>01 采购食材</span><span>02 按单烹饪</span><span>03 收获好评</span></div></>}
      <button className="start-button" onClick={onStart}>{ended ? <RotateCcw /> : <Play fill="currentColor" />}{ended ? '重新开店' : '开启店长生涯'}</button>
      <p className="welcome-tip">点击菜单卡片，可翻面查看配方</p>
    </main></div>;
  }
  return <div className="kitchen-game">
    <header className="game-header">
      <div className="header-stats">
        <div className="stat-money" aria-label={`余额 ${state.money.toFixed(1)} 元`}><span className="coin" aria-hidden="true">$</span><span>${state.money.toFixed(1)}</span></div>
        <div className={`stat-popularity${state.popularity < 30 ? ' stat-critical' : ''}`} aria-label={`口碑 ${state.popularity}%`}><Heart fill="currentColor" /><span>{state.popularity}%</span></div>
      </div>
      <div className="header-brand"><ChefHat /><span>厨房小当家<small>KITCHEN MASTER</small></span></div>
      <div className="header-controls"><button className="sound-button" onClick={onMute} aria-label={isMuted ? '开启声音' : '静音'} aria-pressed={isMuted}>{isMuted ? <VolumeX /> : <Volume2 />}</button>
        <div className={`game-time${state.timeLeft < 30 ? ' stat-critical' : ''}`} aria-label={`剩余时间 ${formatTime(state.timeLeft)}`}><Clock3 /><span>{formatTime(state.timeLeft)}</span></div>
      </div>
    </header>
    <main className="kitchen-layout">
      <section className="supply-section" aria-label="进货与仓库">
        <div className="supply-headings"><h2><ShoppingCart />进货</h2><h2><Package />仓库<span>上限 10 / 类</span></h2></div>
        <div className="supply-body">
          <div className="market-paper">
            {DISPLAY_INGREDIENTS.map(id => {
              const ingredient = INGREDIENTS[id];
              const pending = state.pendingDeliveries.filter(delivery => delivery.ingredientId === id);
              const next = pending.reduce<PendingDelivery | undefined>((soonest, delivery) => !soonest || delivery.timeLeft < soonest.timeLeft ? delivery : soonest, undefined);
              const full = state.inventory[id] + pending.length >= 10;
              const lowMoney = state.money < ingredient.price;
              return <div className="market-row" key={id}>
                <span className="market-icon" aria-hidden="true">{ingredient.icon}</span>
                <div className="market-label"><span>{ingredient.name}</span><strong>${ingredient.price}</strong></div>
                <div className="market-actions">
                  {next && <DeliveryClock key={next.id} delivery={next} count={pending.length} />}
                  <button className="buy-button" onClick={() => onBuy(id)} disabled={full || lowMoney} aria-label={`购买${ingredient.name}，${ingredient.price}元`}
                    title={full ? '采购计划已满' : lowMoney ? '余额不足' : `购买${ingredient.name} · ${ingredient.deliveryTime} 秒送达`}><Plus /></button>
                </div>
              </div>;
            })}
          </div>
          <div className="fridge"><div className="fridge-glass">
            {DISPLAY_INGREDIENTS.map(id => <InventoryShelf key={id} id={id} count={state.inventory[id]} flashing={flashingIngredients.includes(id)} />)}
          </div><div className="fridge-bottom"><span className="fridge-light" /><span>FRESH & COOL</span><div className="fridge-vents"><i /><i /><i /></div></div></div>
        </div>
      </section>
      <div className="cooking-section">
        <section className="menu-section" aria-label="菜单"><h2 className="wooden-sign">菜单<span>MENU</span></h2>
          <div className="menu-frame"><div className="menu-grid">{DISPLAY_RECIPES.map(recipe => <RecipeCard key={recipe.id} recipe={recipe} state={state} onCook={onCook} />)}</div></div>
          <p className="menu-hint"><RotateCcw />点击卡片翻面查看配方</p>
        </section>
        <section className="stove-section" aria-label="操作灶台">
          {state.stoves.map((stove, index) => {
            const recipe = RECIPES.find(item => item.id === stove.dishId);
            return <div key={stove.id} className={`stove${stove.isCooking ? ' stove-active' : ''}`}>
              <div className="stove-top">
                {stove.isCooking && <><div className="steam"><i /><i /><i /></div><button className="cancel-cooking" onClick={() => onCancel(stove.id)} aria-label={`取消${recipe?.name}烹饪`} title="取消烹饪（食材不退还）"><X /></button></>}
                <div className="burner"><div className="pan"><span aria-hidden="true">{stove.isCooking ? recipe?.icon : ''}</span></div></div>
              </div>
              <div className="stove-controls"><i /><span>{stove.isCooking ? recipe?.name : `${index + 1} 号灶台`}<strong>{stove.isCooking ? `${stove.timeRemaining}s` : '空闲中'}</strong></span><i /></div>
              <div className="oven-door">{stove.isCooking ? <div className="stove-progress" role="progressbar" aria-label={`${recipe?.name}烹饪进度`} aria-valuenow={Math.round(stove.progress)} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${stove.progress}%` }} /></div> : <Flame />}</div>
            </div>;
          })}
        </section>
      </div>
      <section className="orders-section" aria-label="订单"><h2><ReceiptText />订单<span className="orders-count">{state.activeOrders.length}</span></h2>
        <div className="order-board">{state.activeOrders.map(order => {
          const recipe = RECIPES.find(item => item.id === order.dishId)!;
          return <article key={order.id} className={`order-note${order.expiryTime < 15 ? ' order-urgent' : ''}`}>
            <span className="order-pin" aria-hidden="true" />
            <div className="order-content"><span className="order-dish" aria-hidden="true">{recipe.icon}</span><div className="order-info"><h3>{recipe.name}</h3><span className="order-time"><Clock3 />{order.expiryTime}s</span></div></div>
            <div className="order-actions"><span className={`customer-tag customer-${order.type}`}>{order.type === 'blogger' ? '★ 美食博主' : order.type === 'grumpy' ? '挑剔顾客' : order.type === 'happy' ? '豪爽顾客' : '普通顾客'}</span><CookButton recipe={recipe} state={state} onCook={onCook} compact /></div>
            <div className="order-progress" role="progressbar" aria-label={`${recipe.name}订单剩余等待时间`} aria-valuenow={order.expiryTime} aria-valuemin={0} aria-valuemax={order.maxTime}><span style={{ width: `${(order.expiryTime / order.maxTime) * 100}%` }} /></div>
          </article>;
        })}{state.activeOrders.length === 0 && <div className="no-orders"><ReceiptText /><p>订单都处理好啦</p><small>等待新的客人光临</small></div>}</div>
      </section>
    </main>
    {notification && <div className={`notification notification-${notification.type}`} role="status">{notification.type === 'success' ? <Star /> : notification.type === 'error' ? <X /> : <ChefHat />}<span>{notification.msg}</span></div>}
  </div>;
}
