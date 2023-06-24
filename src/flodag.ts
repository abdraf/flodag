import { 
            flowDag, 
            flowStatus, 
            taskDefinitionsObject, 
            taskName, 
            taskOutput, 
            taskOutputs, 
            taskOutputStatus
        } from "./types"
import { FlowDagGraph } from "./graph";

class FlowDag {

    private flow: flowDag;
    private taskNames: taskName[];
    private taskOutputs: taskOutputs = {};
    private runningTasks = {};
    private totalTasks: number = 0;
    private flowStatus: flowStatus = flowStatus.PENDING; 
    private graph: FlowDagGraph;

    constructor(flow: flowDag) {
        this.flow = flow;
        this.totalTasks = flow?.tasks ? Object.keys(flow.tasks).length : 0;
        this.taskNames = Object.keys(flow.tasks)
        this.graph = new FlowDagGraph(flow);
    }

    private async tick() {
    
        if (this.getDagStatus() === flowStatus.PENDING) {
            this.setDagStatus(flowStatus.RUNNING);
        }

        if (this.taskCountDoneSoFar() == this.totalTasks) {
            this.setDagStatus(flowStatus.COMPLETED);
            throw "flow complete";
        } 

        // for each node
        //     check if all dependent tasks are done
        //          if yes, run the node task
        for (let i = 0; i < this.taskNames.length; i++) {
            const taskName = this.taskNames[i];
            const task = this.flow.tasks[taskName];
            const taskStatus = this.getTaskStatus(taskName);

            if (taskStatus === null) {
                throw `unknown task status for ${taskName}`        
            }
            
            if (taskStatus !== taskOutputStatus.PENDING) {
                continue;
            }

            console.log('...checking condition', task.runConditionHandler, typeof task.runConditionHandler)
            if (task.runConditionHandler && typeof task.runConditionHandler == "function") {
    
                let conditionOutput = await Promise.resolve(task.runConditionHandler({
                    flowParams: this.flow.params,
                    taskOutputs: this.taskOutputs
                }));

                if (conditionOutput !== true) {
                    console.log(`${taskName} skipped because condition false`)
                    this.setTaskOuput(taskName, taskOutputStatus.SKIPPED, null)
                    continue;
                }
            } 
    
            let prereqs = task.follows;
            if (!prereqs || prereqs.length === 0) {
                console.log(`...no prereqs found running as starting task`)
                this.runTask(taskName)
                continue;
            }
        
            let prepreqOutputs: taskOutput[] = [];    
            for (let j = 0; prereqs && j < prereqs.length; j++) {
                const prereqName = prereqs[j];
                const prereqStatus: any = this.getTaskStatus(prereqName);
                if (prereqStatus === null) {
                    // todo
                }
                const prereqOutput = this.getTaskOutput(prereqName);
                if (![taskOutputStatus.SUCCESS, taskOutputStatus.FAILED, taskOutputStatus.SKIPPED].includes(prereqStatus)) {
                    prepreqOutputs.push( this.setTaskOuput(prereqName, prereqStatus, prereqOutput, true) )
                }
            }

            const successOutputs = this.filterTaskOutputsByStatus(taskOutputStatus.SUCCESS);
            const skippedOutputs = this.filterTaskOutputsByStatus(taskOutputStatus.SKIPPED);
            const failedOutputs = this.filterTaskOutputsByStatus(taskOutputStatus.FAILED);
            
            const allDone = Object.keys(successOutputs).length === prereqs.length ? true : false;
            const somethingFailed = Object.keys(failedOutputs).length > 0;
            const somethingSkipped = Object.keys(skippedOutputs).length > 0;


            if (allDone) {
                // runTask
                this.runTask(taskName);
            } else {
                // report parent outputs
                const report = { successOutputs, failedOutputs, skippedOutputs };
                // where does this go
                // determine wether or not to run task
            }
            
        }
    }
    
    private handleTaskSuccess(output, taskName) {
        console.log('inside handleoutput`')
        this.setTaskNotRunning(taskName);
        this.setTaskOuput(taskName, taskOutputStatus.SUCCESS, output);
    }

    private handleTaskException(exception, taskName) {
        console.log('inside handleexception')
        this.setTaskNotRunning(taskName);
        this.setTaskOuput(taskName, taskOutputStatus.FAILED, exception);
    }

    private handleTaskSkipped(taskName) {
        console.log('inside handleTaskSkipped')
        this.setTaskOuput(taskName, taskOutputStatus.FAILED, null);
    }

    private async runTask(taskName: taskName) {
        console.log("inside run task", taskName)
        const flow = this.flow;
        let task = this.flow.tasks[taskName];
        this.setTaskRunning(taskName);
        let taskParams = task.params;
        console.log(".... params type check", typeof taskParams)
        if (taskParams instanceof Function) {
            taskParams = await Promise.resolve(taskParams({
                flowparams: this.flow.params,
                taskOutputs: this.taskOutputs
            }));
            console.log('^^^ params', taskParams)
        }
        let taskHandler: any = task.ref;
        if (taskHandler.length > 1 && typeof taskParams != "object" && taskParams.length !== undefined) {
            // expect multiple arguments
            // in this case expect array arguments
            console.log(`expect arguments for ${taskName} to be an array, args: ${taskParams}`)
            return
        }
        Promise.resolve(taskHandler.length > 1 ? taskHandler(...taskParams) : taskHandler(taskParams)).then(taskOutput => {
            return this.handleTaskSuccess(taskOutput, taskName);
        }).catch(taskException => {
            return this.handleTaskException(taskException, taskName);
        })
    }

    async start() {
        this.tick();
    }

    private taskCountDoneSoFar(): number {
        return Object.keys(this.taskOutputs).length;
    }

    getTaskOutput(taskName: taskName) {
        return this.taskOutputs[taskName]
    }

    isTaskRunning(taskName: taskName) {
        return this.runningTasks[taskName] === undefined ? false : true; 
    }

    setTaskRunning(taskName: taskName) {
        this.runningTasks[taskName] = true;
    }

    setTaskNotRunning(taskName: taskName) {
        delete this.runningTasks[taskName];
    }

    setTaskOuput(taskName, status, output, dontAdd = false) {
        let outputObject: any = {};
        if (status == taskOutputStatus.FAILED) {
            outputObject = {
                success: false,
                failed: true,
                skipped: false,
                output
            }
        } else if (status == taskOutputStatus.SUCCESS) {
            outputObject = {
                success: true,
                failed: false,
                skipped: false,
                output
            }
        } else if (status == taskOutputStatus.SKIPPED) {
            outputObject = {
                success: false,
                failed: false,
                skipped: true,
                output
            }
        }
        if (!dontAdd) {
            this.taskOutputs[taskName] = outputObject as taskOutput;
        }
        return outputObject;
    }

    private getTaskStatus(taskName): taskOutputStatus | null{
        for (let i = 0 ; i < this.taskNames.length; i++) {
            const thisTaskName = this.taskNames[i];
            if (thisTaskName !== taskName) {
                continue;
            } 
            const taskOutput = this.taskOutputs[this.taskNames[i]];
            if (taskOutput.success === true) {
                return taskOutputStatus.SUCCESS;
            } else if (taskOutput.failed === true) {
                return taskOutputStatus.FAILED;
            } else if (taskOutput.skipped === true) {
                return taskOutputStatus.SKIPPED;
            } else if (this.isTaskRunning(taskName)) {
                return taskOutputStatus.RUNNING; 
            } else {
                return taskOutputStatus.PENDING; 
            }
        }
        return null;
    }

    private filterTaskOutputsByStatus(taskStatus: taskOutputStatus): taskOutputs {
        let filteredTasks: taskOutputs = {};
        const taskNames = Object.keys(this.taskOutputs);
        for (let i = 0; i < taskNames.length; i++) {
            const task = this.taskOutputs[taskNames[i]];
            if (task[taskStatus.toString().toLowerCase()] === true) {
                filteredTasks[taskNames[i]] = task;
            }
        }
        return filteredTasks;
    }

    private setDagStatus(status: flowStatus) {
        this.flowStatus = status;
    }

    public getDagStatus(): flowStatus {
        return this.flowStatus;
    }

}