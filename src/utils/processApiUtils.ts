import axios from 'axios'
import type { AxiosInstance, AxiosResponse } from 'axios'

import type { Process, ProcessInputs, Job, JobStartResponse } from '@/types/processes'

const getApi = (baseURL?: string): AxiosInstance => {
  return axios.create({
    baseURL: baseURL || import.meta.env.VITE_BACKEND_PROCESSES,
  })
}

export const fetchProcesses = async (baseURL?: string): Promise<{ processes: Process[] }> => {
  const api = getApi(baseURL)
  const response = await api.get('/processes')
  return response.data
}

export const fetchJobs = async (baseURL?: string): Promise<{ jobs: Job[] }> => {
  const api = getApi(baseURL)
  const response = await api.get('/jobs')
  return response.data
}

export const startProcess = async (
  processId: string,
  inputs: ProcessInputs,
  baseURL?: string,
): Promise<JobStartResponse> => {
  const api = getApi(baseURL)
  
  // Special handling for json-build-and-simulate process - send data directly
  const requestBody = processId === 'json-build-and-simulate' 
    ? inputs 
    : { inputs }
  
  const response: AxiosResponse<JobStartResponse> = await api.post(`/processes/${processId}/execution`, requestBody)
  return response.data
}

export const cancelJob = async (jobId: string, baseURL?: string): Promise<any> => {
  const api = getApi(baseURL)
  const response = await api.delete(`/jobs/${jobId}`)
  return response.data
}

export const getJobResults = async (jobId: string, baseURL?: string, processId?: string): Promise<any> => {
  const api = getApi(baseURL)
  
  // Special handling for json-build-and-simulate process - use special endpoint
  const endpoint = processId === 'json-build-and-simulate' 
    ? `/jobs/${jobId}/results/results_heat_loads.json`
    : `/jobs/${jobId}/results`
  
  const response = await api.get(endpoint)
  return response.data
}
