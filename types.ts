
type flowArgs = Promise<any[]> | Promise<any> | Promise<Object>
type flowData = Map<string, any>

export interface flodag {
    name: string
    schedule?: string
    args?: flowArgs
    argsFromFunction?: () => flowArgs
    data?: any,
    steps: {
        [key: string]: taskAttributes
    }
}

type taskName = string;
type taskArgs = Promise<any[]> | Promise<any> | Promise<Object>
type params = { flowArgs: flowArgs, taskOutputs, flowData: flowData }
type argsFunction = (paramsObject: params) => flowArgs
type failureHandler = (paramsObject: params) => any | undefined
type sucessHandler = (paramsObject: params) => any | undefined
type conditionFunction = (paramsObject: params) => boolean

enum failureActions { EXIT_FLOW, STOP_DEPENDENTS, CONTINUE }

interface taskAttributes {
    type: string
    ref?: string
    args?: taskArgs
    follows?: taskName[]
    condition?: conditionFunction
    failBehavior?: failureActions
    failureHandler?: failureHandler
    successHandler?: sucessHandler
} 

