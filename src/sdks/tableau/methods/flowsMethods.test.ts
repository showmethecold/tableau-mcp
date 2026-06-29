import { describe, expect, it, vi } from 'vitest';

import FlowsMethods from './flowsMethods.js';

describe('FlowsMethods', () => {
  describe('runFlowNow', () => {
    function makeMethods(apiClient: unknown): FlowsMethods {
      const flowsMethods = new FlowsMethods('http://test', { type: 'Bearer', token: 'test' }, {});
      // @ts-expect-error - Mocking private property
      flowsMethods._apiClient = apiClient;
      return flowsMethods;
    }

    it('sends flowId in both the URI params and the body, and returns the job', async () => {
      const job = {
        id: 'job-1',
        type: 'RunFlow',
        runFlowJobType: { flowRunId: 'run-1', flow: { id: 'f1', name: 'Flow One' } },
      };
      const mockApiClient = { runFlowNow: vi.fn().mockResolvedValue({ job }) };
      const flowsMethods = makeMethods(mockApiClient);

      const result = await flowsMethods.runFlowNow({ siteId: 'site-1', flowId: 'f1' });

      expect(result).toEqual(job);
      expect(mockApiClient.runFlowNow).toHaveBeenCalledWith(
        { flowRunSpec: { flowId: 'f1' } },
        expect.objectContaining({ params: { siteId: 'site-1', flowId: 'f1' } }),
      );
    });

    it('includes runMode, output steps, and parameter overrides when supplied', async () => {
      const mockApiClient = {
        runFlowNow: vi.fn().mockResolvedValue({ job: { id: 'job-2' } }),
      };
      const flowsMethods = makeMethods(mockApiClient);

      await flowsMethods.runFlowNow({
        siteId: 'site-1',
        flowId: 'f1',
        runMode: 'incremental',
        outputStepIds: ['s1', 's2'],
        parameterSpecs: [{ parameterId: 'p1', overrideValue: '2' }],
      });

      expect(mockApiClient.runFlowNow).toHaveBeenCalledWith(
        {
          flowRunSpec: {
            flowId: 'f1',
            runMode: 'incremental',
            flowParameterSpecs: { flowParameterSpec: [{ parameterId: 'p1', overrideValue: '2' }] },
            flowOutputSteps: { flowOutputStep: [{ id: 's1' }, { id: 's2' }] },
          },
        },
        expect.objectContaining({ params: { siteId: 'site-1', flowId: 'f1' } }),
      );
    });

    it('omits empty output-step and parameter wrappers', async () => {
      const mockApiClient = {
        runFlowNow: vi.fn().mockResolvedValue({ job: { id: 'job-3' } }),
      };
      const flowsMethods = makeMethods(mockApiClient);

      await flowsMethods.runFlowNow({
        siteId: 'site-1',
        flowId: 'f1',
        outputStepIds: [],
        parameterSpecs: [],
      });

      expect(mockApiClient.runFlowNow).toHaveBeenCalledWith(
        { flowRunSpec: { flowId: 'f1' } },
        expect.objectContaining({ params: { siteId: 'site-1', flowId: 'f1' } }),
      );
    });
  });
});
