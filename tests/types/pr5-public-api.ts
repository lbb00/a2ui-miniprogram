import { A2UIEngine, OutboundFunctionResponseMessage, isPathBinding } from '../../miniprogram';
import { A2UIEngine as RootEngine } from '../../index';

// process may return a Promise for an async renderer handler, not only a sync value.
const asyncResponse = Promise.resolve<OutboundFunctionResponseMessage | null>(null);
const processResult: ReturnType<A2UIEngine['process']> = asyncResponse;
const rootProcessResult: ReturnType<RootEngine['process']> = asyncResponse;
const messageResult: ReturnType<A2UIEngine['processMessage']> = asyncResponse;
const agentResponse: ReturnType<A2UIEngine['processMessage']> = {
  agentFunctionResponse: { functionCallId: 'id', value: true }
};
const engine = new A2UIEngine();
engine.handleAgentFunctionResponse({ surfaceId: 's', functionCallId: 'id', value: true });
isPathBinding({ path: '/business-data' }, true);
void [processResult, rootProcessResult, messageResult, agentResponse];
