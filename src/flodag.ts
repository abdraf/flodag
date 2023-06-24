import Graph from 'graphology';
import traversal from 'graphology-traversal/dfs'
import { flodag, flowStatus, taskName, taskOutput, taskOutputs, taskOutputStatus } from "./types"

class FloDag {

    private flow: flodag;
    private taskNames: taskName[];
    private taskOutputs: taskOutputs = {};
    private runningTasks = {};
    private totalTasks: number = 0;
    private flowStatus: flowStatus = flowStatus.PENDING; 
    private startingTasks: taskName[];

    constructor(flow: flodag) {
        this.flow = flow;
        this.totalTasks = flow?.tasks ? Object.keys(flow.tasks).length : 0;
        this.taskNames = Object.keys(flow.tasks)
    }

    private buildAndValidateDAG() {
        // let graph = new Graph();
        let seenTasks = {};
        const taskNames = Object.keys(this.flow.tasks);
        this.totalTasks = Object.keys(this.flow.tasks).length;
        for (let i = 0; i < taskNames.length; i++) {
            let taskName = taskNames[i];
            let task = this.flow.tasks[taskName];
            if (typeof task.ref !== "function") {
                throw "task.ref needs to be a node js function"
            }
            if (seenTasks[taskName]) {
                throw "cannot have more than one task with same name"
            }
            seenTasks[taskName] = true;
            this.flow.tasks[taskName] = { ...task, ...{ failed: null, running: null, done: null, skipped: null } };
            // graph.addNode(taskName, { ...task, ...{ failed: null, running: null, done: null, skipped: null } })
            if (!task.follows || task.follows.length == 0) {
                this.startingTasks.push(taskName);
            } else if (task.follows && task.follows.length > 0) {
                for (let j = 0; j < task.follows.length; j++) {
                    let followingTaskName = task.follows[j]
                    if (!seenTasks[followingTaskName]) {
                        throw "graph task order not properly defined, dependent tasks must appear after predecessor tasks"
                    }
                    // graph.addEdge(followingTaskName,taskName)
                }
            }
        }
        // todo: test for cycles
    }

    private async tick() {
    
        if (this.taskCountDoneSoFar() == this.taskNames.length) {
            // all tasks done
            throw "flow complete";
        } 

        // for each node
        //     check if all dependent tasks are done
        //          if yes, run the node task
        for (let i = 0; i < this.taskNames.length; i++) {
            const taskName = this.taskNames[i];
            const task = this.flow.tasks[taskName];
            const taskStatus = this.getTaskStatus(taskName);

            if (taskStatus === undefined) {
                throw `unknown task status for ${taskName}`        
            }
            
            if ([taskOutputStatus.SKIPPED, taskOutputStatus.FAILED, taskOutputStatus.SUCCESS].includes(taskStatus)
            || this.isTaskRunning(taskName) ) {
                continue;
            }

            console.log('...checking condition', task.runConditionHandler, typeof task.runConditionHandler)
            if (task.runConditionHandler && typeof task.runConditionHandler == "function") {
    
                let conditionOutput = await Promise.resolve(task.runConditionHandler({
                    flowParams: this.flow.params,
                    taskOutputs: this.taskOutputs
                }));

                if (conditionOutput !== true) {
                    console.log(`${taskNames[i]} skipped because condition false`)
                    this.setTaskOuput(taskName, taskOutputStatus.SKIPPED, null)
                    continue;
                }
            } 
            console.log("processing task ", taskNames[i])
    
            let prereqs = task.follows;
            if (!prereqs || prereqs.length === 0) {
                console.log(`...no prereqs found running as starting task`)
                runTask(taskNames[i])
                continue;
            }

            let allDone = true;
            let somethingFailed = false;
            let somethingSkipped = false;
    
            console.log(`...prereqs for ${taskNames[i]} are ${prereqs}`)
    
            let failedPrereqs: taskName[] = [];
            let donePrereqs: taskName[] = [];
            let skippedPrereqs: taskName[] = [];
    
            for (let j = 0; prereqs && j < prereqs.length; j++) {
                console.log(`......prereqs for ${taskNames[i]} are ${prereqs[j]}`)
                let prereq = prereqs[j]
                if (doneTasks[prereq]) {
                    console.log(`prereq done[${prereq}]: `,!doneTasks[prereq])
                    donePrereqs.push(taskName)
                }
                if (failedTasks[prereq]) {
                    // apply fail behavior to node 
                    failedPrereqs.push(taskName)
                }
                if (skippedTasks[prereq]) {
                    // apply fail behavior to node 
                    console.log("something failed")
                    skippedPrereqs.push(taskName)
                }
            }
            
            if (donePrereqs.length < prereqs.length) {
                allDone=false
            }
            
            if (failedPrereqs.length > 0) {
                somethingFailed = true;
            }
            
            if (skippedPrereqs.length>0) {
                somethingSkipped = true;
            }
            
            if (allDone) {
                // runTask
                runTask(taskName)
            } else {
                // report parent outputs
                const report = [skippedPrereqs, failedPrereqs, donePrereqs]
                // where does this go
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
        this.buildAndValidateDAG();
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

    setTaskOuput(taskName, status, output) {
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
        this.taskOutputs[taskName] = outputObject as taskOutput;
    }

    private getTaskStatus(taskName): taskOutputStatus | undefined{
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
            } else {
                return undefined;
            }
        }
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

}