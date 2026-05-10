export type DesignTokenCategory = "colors" | "spacing" | "typography";
export type BackendGapStatusFilter = "open" | "resolved" | "workaround";

export interface ComponentProp {
  name: string;
  type: string;
  isRequired: boolean;
  defaultValue: unknown;
}

export interface ComponentInfo {
  filePath: string;
  props: ComponentProp[];
  emits: string[];
  slots: string[];
}

export interface RouteInfo {
  path: string;
  filePath: string;
  isDynamic: boolean;
  layout: string;
}

export interface RouterConfig {
  routes: RouteInfo[];
}

export interface StoreSliceInfo {
  filePath: string;
  state: Record<string, string>;
  actions: string[];
}

export interface ApiContractInfo {
  serviceFilePath: string;
  functionName: string;
  requestTypePath: string;
  responseTypePath: string;
  queryKey: string[];
}

export interface BackendGap {
  id: string;
  description: string;
  status: string;
  workaround: string | null;
}
