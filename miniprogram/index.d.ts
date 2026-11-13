/**
 * a2ui-miniprogram TypeScript Definitions
 * High-performance native WeChat MiniProgram renderer for Google A2UI (Agent-to-User Interface) 1.0 specification.
 */

export const A2UI_VERSION: '1.0';
export const A2UI_MIME_TYPE: 'application/a2ui+json';

export type ErrorCode =
  | 'VALIDATION_FAILED'
  | 'UNKNOWN_COMPONENT'
  | 'EXECUTION_ERROR'
  | 'UNALLOWED_PARENT'
  | 'UNALLOWED_CHILD'
  | 'UNKNOWN_FUNCTION'
  | 'INVALID_FUNCTION_CALL'
  | 'UNKNOWN_ERROR'
  | 'NO_TRANSPORT'
  | 'SURFACE_DELETED'
  | 'TIMEOUT'
  | 'CANCELLED'
  | 'DISPOSED';

export const ErrorCodes: Record<ErrorCode, string>;
export const KNOWN_COMPONENTS: Set<string>;

export class A2UIError extends Error {
  code: ErrorCode | string;
  details: Record<string, any>;
  constructor(code: ErrorCode | string, message?: string | Record<string, any>, details?: Record<string, any>);
}

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
  children?: string[] | { explicitList?: string[]; path?: string; '@path'?: string; componentId?: string; '@componentId'?: string };
  child?: string;
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
  checks?: any[];
  '@checks'?: any[];
  catalogId?: string;
  '@catalogId'?: string;
  accessibility?: Record<string, any>;
  '@accessibility'?: Record<string, any>;
  metadata?: Record<string, any>;
  '@metadata'?: Record<string, any>;
  [key: string]: any;
}

export interface CreateSurfacePayload {
  surfaceId: string;
  catalogId?: string;
  '@catalogId'?: string;
  components?: ComponentDefinition[];
  dataModel?: Record<string, any>;
  sendDataModel?: boolean;
  theme?: Record<string, any>;
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
    '@catalogId'?: string;
    args?: Record<string, any>;
  };
}

export interface CallAgentFunctionPayload {
  surfaceId: string;
  functionCallId: string;
  callFunction: {
    '@call': string;
    catalogId?: string;
    '@catalogId'?: string;
    args?: Record<string, any>;
  };
}

export interface AgentFunctionResponsePayload {
  functionCallId: string;
  value?: any;
  response?: any;
  error?: {
    code?: string;
    message?: string;
  };
}

export interface A2UIMessage {
  version?: '1.0' | 'v1.0';
  createSurface?: CreateSurfacePayload;
  updateComponents?: UpdateComponentsPayload;
  updateDataModel?: UpdateDataModelPayload;
  deleteSurface?: DeleteSurfacePayload | string;
  callRendererFunction?: CallRendererFunctionPayload;
  agentFunctionResponse?: AgentFunctionResponsePayload;
  agent_to_renderer?: A2UIMessage | A2UIMessage[];
  [key: string]: any;
}

export interface OutboundActionMessage {
  version: '1.0' | 'v1.0';
  action: {
    name: string;
    surfaceId: string;
    sourceComponentId: string;
    timestamp: string;
    context: Record<string, any>;
    catalogId?: string;
    userMessage?: string;
    dataModel?: Record<string, any>;
    event?: Record<string, any>;
  };
  event?: Record<string, any>;
  renderer_to_agent?: {
    action: Record<string, any>;
  };
}

export interface OutboundErrorMessage {
  version: '1.0' | 'v1.0';
  error: {
    code: ErrorCode | string;
    surfaceId: string;
    path: string;
    message: string;
  };
  renderer_to_agent?: {
    error: Record<string, any>;
  };
}

export interface OutboundFunctionResponseMessage {
  version: '1.0' | 'v1.0';
  rendererFunctionResponse: {
    functionCallId: string;
    value?: any;
    response?: any;
    error?: {
      code: string;
      message: string;
    };
  };
  renderer_to_agent?: {
    rendererFunctionResponse: Record<string, any>;
  };
}

export interface OutboundCallAgentFunctionMessage {
  version: '1.0' | 'v1.0';
  callAgentFunction: CallAgentFunctionPayload;
  renderer_to_agent?: {
    callAgentFunction: CallAgentFunctionPayload;
  };
}

export type OutboundMessage =
  | OutboundActionMessage
  | OutboundErrorMessage
  | OutboundFunctionResponseMessage
  | OutboundCallAgentFunctionMessage;

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
  catalogId?: string;
  accessibility?: Record<string, any>;
  metadata?: Record<string, any>;
  checks?: any[];
  '@checks'?: any[];
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
  '1.0'?: {
    supportedCatalogIds: string[];
    inlineCatalogs?: any[];
  };
  'v1.0'?: {
    supportedCatalogIds: string[];
    inlineCatalogs?: any[];
  };
}

export interface A2UIEngineOptions {
  legacyOutbound?: boolean;
}

export class A2UIEngine {
  constructor(options?: A2UIEngineOptions);

  surfaces: Map<string, any>;
  legacyOutbound: boolean;
  catalogs: Map<string, any>;
  pendingAgentCalls: Map<string, any>;

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
   * Register a custom component type
   */
  registerComponent(name: string): void;
  registerCustomComponent(name: string, schema?: Record<string, any>): void;

  /**
   * Register a component catalog definition with permissions
   */
  registerCatalog(
    catalogId: string,
    def?: {
      components?: string[];
      functions?: string[];
      allowedCallers?: string[];
    }
  ): void;

  /**
   * Register client function (agent calling renderer)
   */
  registerRendererFunction(
    name: string,
    handler: (args: Record<string, any>, surfaceId: string, engine: A2UIEngine) => any
  ): void;

  /**
   * Call a client renderer function directly
   */
  callRendererFunction(payload: { callRendererFunction?: CallRendererFunctionPayload } | CallRendererFunctionPayload): any;

  /**
   * Invoke an Agent function call (renderer calling agent)
   */
  callAgentFunction(
    surfaceId: string,
    callFunction: {
      '@call'?: string;
      call?: string;
      name?: string;
      '@catalogId'?: string;
      catalogId?: string;
      args?: Record<string, any>;
    },
    options?: { timeout?: number }
  ): Promise<any>;

  /**
   * Handle Agent response to previously dispatched callAgentFunction
   */
  handleAgentFunctionResponse(respData: AgentFunctionResponsePayload): { agentFunctionResponse: any } | null;

  /**
   * Outbound transport listener management
   */
  setOutboundListener(listener: ((msg: any) => void) | null): void;
  subscribeOutbound(listener: (msg: any) => void): () => void;
  dispatchOutbound(msg: any): { delivered: number; errors: any[] };

  /**
   * Create an outbound Action message
   */
  createActionMessage(surfaceId: string, instanceId: string): OutboundActionMessage | null;

  /**
   * Create a custom outbound Action message
   */
  createCustomActionMessage(
    surfaceId: string,
    componentId: string,
    actionData?: Record<string, any>
  ): OutboundActionMessage;

  /**
   * Create an outbound error message
   */
  createErrorMessage(surfaceId: string, code: ErrorCode | string, path: string, message: string): OutboundErrorMessage;

  /**
   * Emit an error message through the error and outbound listeners
   */
  emitError(surfaceId: string, code: ErrorCode | string, path: string, message: string): OutboundErrorMessage;

  /**
   * Handle user input changes
   */
  handleInputChange(surfaceId: string, path: string, value: any, options?: { silent?: boolean }): string | null;

  /**
   * Compute differential patches between two render trees
   */
  computeTreePatches(
    oldTree: RenderNode | null,
    newTree: RenderNode | null,
    rootPrefix?: string,
    options?: ComputePatchesOptions
  ): TreePatches;

  /**
   * Clear all surfaces
   */
  clear(): void;

  /**
   * Destroy the engine instance and release all listeners
   */
  destroy(): void;
}

export function isPathBinding(val: any): boolean;
export function isFunctionCall(val: any): boolean;
export function getValueByPath(dataModel: any, path: string, scope?: any): any;
export function resolveValue(val: any, dataModel: any, scope?: any): any;
export function resolveDeep(target: any, dataModel: any, scope?: any, depth?: number, seen?: WeakSet<any>): any;
export function evaluateFunction(funcName: string, args?: Record<string, any>, dataModel?: any, scope?: any): any;
export function isSafeRegex(pattern: string): boolean;
export function executePluralize(value: number, forms: Record<string, any>, locale?: string): string;
export function openUrl(url: string): { success: boolean; error?: string };
export function createRendererCapabilities(supportedCatalogs?: any): RendererCapabilitiesMessage;
export function toBool(val: any): boolean;
export function formatTR35Date(date: Date, pattern: string): string;
export const CURRENCY_SYMBOLS: Record<string, string>;
export function getCurrencySymbol(currency: string): string;
export function formatCurrency(value: any, currency?: string, decimals?: number, grouping?: boolean): string;

export function hasMarkdown(text: string): boolean;
export function parseMarkdown(text: string): string;
export function parseInline(text: string): string;
export function escapeHtml(str: string): string;
export function sanitizeUrl(url: string): string;

export function toPropertyPath(pathOrSegs: string | (string | number)[], rootPrefix?: string): string;
export function computeTreePatches(
  oldTree: RenderNode | null,
  newTree: RenderNode | null,
  rootPrefix?: string,
  options?: ComputePatchesOptions
): TreePatches;

export const a2uiCustomBehavior: any;
