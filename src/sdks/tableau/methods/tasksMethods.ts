import { Zodios } from '@zodios/core';

import { AxiosRequestConfig } from '../../../utils/axios.js';
import {
  parseGetFlowRunTasksResponse,
  parseListExtractRefreshTasksResponse,
  tasksApis,
} from '../apis/tasksApi.js';
import { RestApiCredentials } from '../restApi.js';
import { ExtractRefreshTask } from '../types/extractRefreshTask.js';
import { FlowRunTask } from '../types/flowRunTask.js';
import { RunFlowJob } from '../types/job.js';
import AuthenticatedMethods from './authenticatedMethods.js';

/**
 * Jobs, tasks, and schedules methods of the Tableau Server REST API
 *
 * @export
 * @class TasksMethods
 * @link https://help.tableau.com/current/api/rest_api/en-us/REST/rest_api_ref_jobs_tasks_and_schedules.htm
 */
export default class TasksMethods extends AuthenticatedMethods<typeof tasksApis> {
  constructor(baseUrl: string, creds: RestApiCredentials, axiosConfig: AxiosRequestConfig) {
    super(new Zodios(baseUrl, tasksApis, { axiosConfig }), creds);
  }

  /**
   * Returns a list of extract refresh tasks for the site.
   * Each task is for a data source or workbook extract and includes schedule information.
   *
   * Required scopes (Tableau Cloud): `tableau:tasks:read`
   *
   * @param siteId - The Tableau site ID
   * @link https://help.tableau.com/current/api/rest_api/en-us/REST/rest_api_ref_jobs_tasks_and_schedules.htm#list_extract_refresh_tasks
   */
  listExtractRefreshTasks = async ({
    siteId,
  }: {
    siteId: string;
  }): Promise<ExtractRefreshTask[]> => {
    const raw = await this._apiClient.listExtractRefreshTasks({
      params: { siteId },
      ...this.authHeader,
    });
    const response = parseListExtractRefreshTasksResponse(raw);
    return response.tasks.task.map((t) => t.extractRefresh);
  };

  /**
   * Returns the list of scheduled flow run tasks for the site.
   * Each task describes the schedule for a flow (frequency, next run time) plus
   * the flow it targets.
   *
   * Required scopes (Tableau Cloud): `tableau:flow_tasks:read`
   *
   * Permissions: non-administrators see only the scheduled flow run tasks for
   * flows they own; administrators see all flow run tasks on the site.
   *
   * @param siteId - The Tableau site ID
   * @link https://help.tableau.com/current/api/rest_api/en-us/REST/rest_api_ref_flow.htm#get_flow_run_tasks
   */
  getFlowRunTasks = async ({ siteId }: { siteId: string }): Promise<FlowRunTask[]> => {
    const raw = await this._apiClient.getFlowRunTasks({
      params: { siteId },
      ...this.authHeader,
    });
    const response = parseGetFlowRunTasksResponse(raw);
    return response.tasks.task.map((t) => t.flowRun);
  };

  /**
   * Returns a single scheduled flow run task by id ("Get Flow Run Task").
   *
   * Required scopes (Tableau Cloud): `tableau:flow_tasks:read`
   *
   * Permissions: non-administrators can only access flow run tasks for flows
   * they own.
   *
   * @param siteId - The Tableau site ID
   * @param taskId - The flow run task id
   * @link https://help.tableau.com/current/api/rest_api/en-us/REST/rest_api_ref_flow.htm#get_flow_run_task
   */
  getFlowRunTask = async ({
    siteId,
    taskId,
  }: {
    siteId: string;
    taskId: string;
  }): Promise<FlowRunTask> => {
    const raw = await this._apiClient.getFlowRunTask({
      params: { siteId, taskId },
      ...this.authHeader,
    });
    return raw.task.flowRun;
  };

  /**
   * Runs an EXISTING scheduled flow run task now ("Run Flow Task"), using the
   * task's configured output steps / parameters, and returns the async job. A
   * suspended task is resumed.
   *
   * Required scopes (Tableau Cloud): `tableau:flow_tasks:run`
   * Requires Data Management + Tableau Prep Conductor; Run Now must be enabled.
   *
   * Permissions: non-administrators can only run flow run tasks they own.
   *
   * @param siteId - The Tableau site ID
   * @param taskId - The flow run task id (from `getFlowRunTasks`)
   * @link https://help.tableau.com/current/api/rest_api/en-us/REST/rest_api_ref_flow.htm#run_flow_task
   */
  runFlowTask = async ({
    siteId,
    taskId,
  }: {
    siteId: string;
    taskId: string;
  }): Promise<RunFlowJob> => {
    const raw = await this._apiClient.runFlowTask(undefined, {
      params: { siteId, taskId },
      ...this.authHeader,
    });
    return raw.job;
  };
}
