export const STORE_OPEN_HOUR = 8;
export const STORE_CLOSE_HOUR = 22;
export const DAY_HOURS = 14;

export interface SkuState {
  sku_id: string;
  on_hand: number;
  price: number;
  unit_cost: number;
  shelf_life_hours: number;
  case_size: number;
  units_sold: number;
  units_wasted: number;
  units_delivered: number;
  stockout_events: number;
  missed_revenue: number;
  revenue: number;
  cost_of_goods: number;
}

export interface VendorState {
  vendor_id: string;
  lead_time_hours: number;
  next_delivery_at: string;
  delay_hours: number;
}

export interface SimState {
  skus: Record<string, SkuState>;
  vendors: Record<string, VendorState>;
  orders: OrderState[];
  current_time: string;
}

export type OrderStatus =
  | 'recommended'
  | 'placed'
  | 'in_transit'
  | 'delivered'
  | 'rejected'
  | 'late'
  | 'missed';

export interface OrderState {
  sku_id: string;
  vendor_id: string;
  quantity: number;
  status: OrderStatus;
  created_at_seq: number;
  shipped_at?: string;
}

export type OrderFSMEvent =
  | { type: 'approve' }
  | { type: 'reject' }
  | { type: 'modify'; quantity: number }
  | { type: 'ship' }
  | { type: 'deliver' }
  | { type: 'delay' }
  | { type: 'expire' };

export interface SalesSpikePayload {
  sku: string;
  multiplier: number;
}
export interface VendorDelayPayload {
  vendor: string;
  delay_hours: number;
}
export interface DamageReportPayload {
  sku: string;
  units: number;
}
export interface InvoiceCostChangePayload {
  sku: string;
  new_unit_cost: number;
}
export interface PromotionPayload {
  sku: string;
  demand_multiplier: number;
}
export interface ManagerOverridePayload {
  target: string;
  action: string;
}

export interface SimEvent {
  seq: number;
  at: string;
  type: string;
  payload:
    | SalesSpikePayload
    | VendorDelayPayload
    | DamageReportPayload
    | InvoiceCostChangePayload
    | PromotionPayload
    | ManagerOverridePayload;
}

export type DecisionAgent = 'inventory' | 'pricing';

export interface InventoryDecision {
  agent: 'inventory';
  sku_id: string;
  order_cases: number;
  summary: string;
}

export interface PricingDecision {
  agent: 'pricing';
  sku_id: string;
  new_price: number;
  summary: string;
}

export type Decision = InventoryDecision | PricingDecision;

export type DecisionResolver = (
  agent: DecisionAgent,
  context: SimState,
  event: SimEvent
) => Decision | Promise<Decision>;

export interface DecisionRecord {
  event_seq: number;
  decision: Decision;
  context_snapshot: SimState;
  source: 'stub' | 'llm' | 'override' | 'reused';
  valid: boolean;
  latency_ms: number;
}

export interface RunStep {
  seq: number;
  state_snapshot: SimState;
  order_state: OrderState[];
}

export interface Impact {
  waste_pct: number;
  waste_value: number;
  stockout_events: number;
  missed_revenue: number;
  ending_margin_pct: number;
  ending_inventory_value: number;
  metrics: Record<string, unknown> | null;
}

export interface SimulationResult {
  steps: RunStep[];
  decisions: Array<{
    event_seq: number;
    decision: Decision;
    context_snapshot: SimState;
  }>;
  impact: Impact;
}
