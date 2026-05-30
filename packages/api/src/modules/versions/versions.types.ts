export interface Version {
  id: string;
  label: string;
  inventory_prompt_version: string;
  pricing_prompt_version: string;
  model_id: string;
  policy: Record<string, unknown> | null;
  created_at: string;
}
