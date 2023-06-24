
export interface flowDag {
    name: string
    schedule?: string
    params?: params
    // onCompletion: {÷÷  }
    // flow Data
    tasks: taskDefinitionsObject
}

export type taskName = string;

export type taskOutput = { success: boolean, skipped: boolean, failed: boolean, output: any };

export type taskOutputs = { [key: taskName]: taskOutput };

export type runningTasks = { [key: taskName]: true };

export type params = any;

export type handlerParams = { flowParams: params, taskOutputs: taskOutputs }

export type paramsGeneratorFunction = (paramsObject: handlerParams) => params

export type failureHandler = (paramsObject: handlerParams) => any | undefined

export type sucessHandler = (paramsObject: handlerParams) => any | undefined

export type isFailureHandler = (paramsObject: handlerParams) => boolean

export type isSuccessHandler = (paramsObject: handlerParams) => boolean

export type conditionFunction = (paramsObject: handlerParams) => boolean

export enum failureActions { EXIT_FLOW, STOP_DEPENDENTS, CONTINUE }

export enum flowStatus { PENDING, RUNNING, COMPLETED }

export enum taskOutputStatus { FAILED, SUCCESS, PENDING, RUNNING, SKIPPED }

export interface taskAttributes {
    ref: Function
    params?: params | paramsGeneratorFunction
    follows?: taskName[]
    runConditionHandler?: conditionFunction
    failBehavior?: failureActions
    isFailHandler: isFailureHandler,
    isSuccessHandler: isSuccessHandler,
    onFail?: failureHandler
    onSuccess?: sucessHandler
} 

export type taskDefinitionsObject = { [key: taskName]: taskAttributes }