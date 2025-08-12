export interface ProcessSchema {
  type: string
  description?: string
  minItems?: number
  maxItems?: number
}

export interface ProcessInputs {
  properties: Record<string, ProcessSchema>
}

export interface Process {
  id: string
  title: string
  description: string
  inputs?: ProcessInputs
}

export type JobStatusType = 'running' | 'successful' | 'failed' | 'accepted' | 'dismissed'

export interface Job {
  jobID: string
  processID: string
  status: JobStatusType
  created: string
  finished?: string
  progress?: number
}

export interface JobStartResponse {
  jobID: string
  status?: JobStatusType
}
