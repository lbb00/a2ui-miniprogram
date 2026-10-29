/**
 * a2ui-miniprogram TypeScript Definitions
 * High-performance native WeChat MiniProgram renderer for Google A2UI (Agent-to-User Interface) v1.0 specification.
 */

export type ErrorCode =
  | 'VALIDATION_FAILED'
  | 'UNKNOWN_COMPONENT'
  | 'EXECUTION_ERROR'
  | 'UNALLOWED_PARENT'
  | 'UNALLOWED_CHILD'
  | 'UNKNOWN_FUNCTION'
  | 'INVALID_FUNCTION_CALL'
  | 'UNKNOWN_ERROR'
  | 'TIMEOUT'
  | 'CANCELLED'
  | 'DISPOSED';

export interface ActionEvent {
  name: string;
  context?: Record<string, any>;
  userMessage?: string;
  [key: string]: any;
}

export interface ActionDefinition {
  event?: ActionEvent;
  name?: string;
  context?: Record<string, any>;
  [key: string]: any;
}

export interface ComponentDefinition {
  id: string;
  component: string;
  children?: string[] | { explicitList?: string[] };
  action?: ActionDefinition;
  value?: any;
  text?: any;
  label?: any;
  options?: any[];
  disabled?: boolean | any;
  variant?: 'multipleSelection' | 'mutuallyExclusive' | string;
  displayStyle?: 'checkbox' | 'chips' | 'picker' | string;
  mutuallyExclusive?: boolean;
  enableDate?: boolean;
  enableTime?: boolean;
  min?: number;
  max?: number;
  step?: number;
  steps?: number;
  weight?: number;
  style?: Record<string, any>;
  [key: string]: any;
}

export interface CreateSurfacePayload {
  surfaceId: string;
  catalogId?: string;
  components?: ComponentDefinition[];
  dataModel?: Record<string, any>;
  sendDataModel?: boolean;
}

export interface UpdateComponentsPayload {
  surfaceId: string;
  components: ComponentDefinition[];
}

export interface UpdateDataModelPayload {
  surfaceId: string;
  path?: string;
  value?: any;
}

export interface DeleteSurfacePayload {
  surfaceId: string;
}

export interface CallRendererFunctionPayload {
  surfaceId?: string;
  functionCallId: string;
  callFunction: {
    '@call'?: string;
    call?: string;
    name?: string;
    catalogId?: string;
    args?: Record<string, any>;
  };
}

export interface A2UIMessage {
  version?: 'v1.0';
  createSurface?: CreateSurfacePayload;
  updateComponents?: UpdateComponentsPayload;
  updateDataModel?: UpdateDataModelPayload;
  deleteSurface?: DeleteSurfacePayload | string;
  callRendererFunction?: CallRendererFunctionPayload;
  [key: string]: any;
}

export interface OutboundActionMessage {
  version: 'v1.0';
  action: {
    name: string;
    surfaceId: string;
    sourceComponentId: string;
    timestamp: string;
    context: Record<string, any>;
    userMessage?: string;
    dataModel?: Record<string, any>;
    event?: Record<string, any>;
  };
  event?: Record<string, any>;
}

export interface OutboundErrorMessage {
  version: 'v1.0';
  error: {
    code: ErrorCode;
    surfaceId: string;
    path: string;
    message: string;
  };
}

export interface OutboundFunctionResponseMessage {
  version: 'v1.0';
  rendererFunctionResponse: {
    functionCallId: string;
    value?: any;
    response?: any;
    error?: {
      code: string;
      message: string;
    };
  };
}

export type OutboundMessage =
  | OutboundActionMessage
  | OutboundErrorMessage
  | OutboundFunctionResponseMessage;

export interface RenderNode {
  id: string;
  component: string;
  children?: RenderNode[];
  text?: string;
  value?: any;
  label?: string;
  disabled?: boolean;
  options?: any[];
  displayStyle?: string;
  variant?: string;
  mutuallyExclusive?: boolean;
  dateValue?: string;
  timeValue?: string;
  timeSec?: string;
  selectedIndex?: number;
  displayLabel?: string;
  validationError?: string;
  [key: string]: any;
}

export interface TreePatches {
  [propertyPath: string]: any;
}

export interface ComputePatchesOptions {
  activeComponentId?: string;
}

export interface RendererCapabilityCatalog {
  catalogId?: string;
  inlineCatalog?: any;
}

export interface RendererCapabilitiesMessage {
  'v1.0': {
    supportedCatalogIds: string[];
    inlineCatalogs?: any[];
  };
}

export class A2UIEngine {
  constructor();

  /**
   * Process a single A2UI message or an array of messages
   */
  process(
    messages: A2UIMessage | A2UIMessage[]
  ): string | string[] | OutboundFunctionResponseMessage | OutboundFunctionResponseMessage[] | null;

  /**
   * Process a single A2UI protocol message
   */
  processMessage(msg: A2UIMessage): string | OutboundFunctionResponseMessage | null;

  /**
   * Get the assembled render tree for the specified surfaceId
   */
  getRenderTree(surfaceId: string): RenderNode | null;

  /**
   * Subscribe to render tree updates
   */
  subscribe(listener: (surfaceId: string, tree: RenderNode | null) => void): () => void;

  /**
   * Subscribe to outbound messages (actions, RPC responses, errors)
   */
  onOutboundMessage(listener: (msg: OutboundMessage) => void): () => void;
  addOutboundListener(listener: (msg: OutboundMessage) => void): () => void;

  /**
   * Subscribe to protocol errors
   */
  onError(listener: (errorMsg: OutboundErrorMessage) => void): () => void;
  addErrorListener(listener: (errorMsg: OutboundErrorMessage) => void): () => void;

  /**
   * Register a custom client renderer function
   */
  registerRendererFunction(
    name: string,
    fn: (args: Record<string, any>, context: Record<string, any>) => any
  ): void;

  /**
   * Register a custom component catalog schema
   */
  registerComponent(name: string): void;
  registerCustomComponent(name: string, schema?: any): void;

  /**
   * Construct a standard A2UI Action message for a tapped component
   */
  createActionMessage(surfaceId: string, instanceId: string): OutboundActionMessage | null;

  /**
   * Construct a standard A2UI error message
   */
  createErrorMessage(
    surfaceId: string,
    code: ErrorCode,
    path: string,
    message: string
  ): OutboundErrorMessage;

  /**
   * Dispatch an outbound message to all registered listeners
   */
  dispatchOutbound(msg: OutboundMessage): void;

  /**
   * Update client dataModel value at path and notify listeners
   */
  handleInputChange(
    surfaceId: string,
    path: string,
    value: any,
    options?: { silent?: boolean }
  ): string | null;

  /**
   * Compute directional patch set between old and new render trees (avoids cursor jumps)
   */
  computeTreePatches(
    oldTree: RenderNode,
    newTree: RenderNode,
    rootPrefix?: string,
    options?: ComputePatchesOptions
  ): TreePatches;

  /**
   * Clear all surfaces and instances
   */
  clear(): void;

  /**
   * Completely destroy the engine instance and release all listeners
   */
  destroy(): void;
}

export const ErrorCodes: Record<string, ErrorCode>;
export const KNOWN_COMPONENTS: Set<string>;
export const CURRENCY_SYMBOLS: Record<string, string>;

export function getValueByPath(root: any, path: string, scope?: any): any;
export function resolveValue(val: any, dataModel: any, scope?: any): any;
export function resolveDeep(val: any, dataModel: any, scope?: any): any;
export function evaluateFunction(funcName: string, args?: Record<string, any>, dataModel?: any, scope?: any): any;
export function isSafeRegex(pattern: string): boolean;
export function executePluralize(value: number | string, forms?: Record<string, string>, locale?: string): string;
export function openUrl(url: string): { success: boolean; url?: string; action?: string; error?: string };
export function createRendererCapabilities(supportedCatalogs?: any): RendererCapabilitiesMessage;
export function getCurrencySymbol(currency?: string): string;
export function formatCurrency(value: number | string, currency?: string, decimals?: number, grouping?: boolean): string;
export function formatTR35Date(date: Date, pattern: string): string;
export function toBool(v: any): boolean;
export function hasMarkdown(text: string): boolean;
export function parseMarkdown(text: string): string;
export function parseInline(rawText: string): string;
export function escapeHtml(str: string): string;
export function sanitizeUrl(url: string): string;
export function toPropertyPath(pathOrSegs: string | string[], rootPrefix?: string): string;
export function computeTreePatches(
  oldTree: RenderNode,
  newTree: RenderNode,
  rootPrefix?: string,
  options?: ComputePatchesOptions
): TreePatches;

export const a2uiCustomBehavior: any;
