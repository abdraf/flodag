var Graph = require('graphology')
let doneTasks = {}
let failedTasks = {};
let skippedTasks = {};
let taskCount = 0;

async function doStuffFail(arg) {
    await new Promise(resolve => {
        setTimeout(() => {
            resolve(true)
        }, 2000)
    })
    console.log("\n Timestamp " + new Date().toISOString() + ": doStuff: " + arg + "\n")
    return "Timestamp " + new Date().toISOString ()+ ": doStuff: " + arg
}

async function doStuff(arg) {
    await new Promise(resolve => {
        setTimeout(() => {
            resolve(true)
        }, 2000)
    })
    throw "task  failed"
    // console.log("\n Timestamp " + new Date().toISOString() + ": doStuff: " + arg + "\n")
    // return "Timestamp " + new Date().toISOString ()+ ": doStuff: " + arg
}


let flow = {
    name: 'Example Flow',
    params: { count: 0, task1params: "task2paramsfromflowdata" },
    tasks: {
        task0: { 
            type: 'JSFunction', 
            ref: doStuffFail, 
            params: "task0"
        },
        task1: { 
            type: 'JSFunction', 
            ref: doStuff, 
            params: ({ flowparams, taskOutputs }) => {
                // task0 output will be undefined because it runs in parallel with task 0
                return `task1 output: the output for task 0 was ${taskOutputs['task0']} and flowparams are ${flowparams}`
            }
        },
        task2: { 
            type: 'JSFunction', 
            ref: doStuff, 
            params: ({ flowparams, taskOutputs }) => {
                return `task2 from function, output of task1 is ${taskOutputs['task1']}`
            }, 
            after: [ 'task1' ] 
        },
        task3: { 
            type: 'JSFunction', 
            ref: doStuff, 
            params: "task3", 
            after: [ 'task1' ]
        },
        task4: { 
            type: 'JSFunction', 
            ref: doStuff, 
            params: "task4",
            condition: ({ flowparams, taskOutputs }) => {
                return false
            },
            after: [ 'task2', 'task3' ] 
        }
    }
}

// console.log(JSON.stringify(flow))
// return

let taskNames = Object.keys(flow.tasks)
taskCount = taskNames.length;
let tasks = flow.tasks

// validate graph
let graph = new Graph()
let seenTasks = {}

for (let i = 0; i < taskNames.length; i++) {
    let taskName = taskNames[i]
    console.log('taskName', taskName)
    if (seenTasks[taskName]) {
        throw "cannot have more than one task with same name"
    }
    seenTasks[taskName] = 1
    let task = tasks[taskName]
    flow.tasks[taskName] = { ...task, ...{ failed: null, inprogress: null, done: null, skipped: null } };
    graph.addNode(taskName, { ...task, ...{ failed: null, inprogress: null, done: null, skipped: null } })
    if (!task.after || task.after.length == 0) {
        console.log("... one of starting node")
        
    } else if (task.after && task.after.length > 0) {
        for (let j = 0; j < task.after.length; j++) {
            let followingTaskName = task.after[j]
            if (!seenTasks[followingTaskName]) {
                throw "graph task order not properly defined, dependent tasks must appear after predecessor tasks"
            }
            console.log("... follows ", followingTaskName)
            graph.addEdge(taskName, followingTaskName)
        }
    }
}

// todo: add dag checks
async function findSubtreeWithGivenRoot(root) {
    // depth first search

}

async function processFlow() {
    
    console.log("processFlow! with donetasks", doneTasks, failedTasks, skippedTasks)
    if (Object.keys(doneTasks).length + Object.keys(failedTasks).length + Object.keys(skippedTasks).length=== taskCount ) {
        // all tasks done
        console.log("flow complete")
        throw "flow complete"
        return
    } 
    // for each node
    //     check if all dependent tasks are done
    //          if yes, run the node task
    for (let i = 0; i < taskNames.length; i++) {
        let taskName = taskNames[i]
        let task = flow.tasks[taskNames[i]]

        // console.log("processFlow taskName", taskNames[i])
        if (tasks[taskName].skipped) {
            continue;
        }
        if (task.done === true || task.failed === true) {
            // task already concluded
            console.log(`skipping ${taskNames[i]} with status ${flow.tasks[taskNames[i]].done}`)
            continue;
        }
        if (task.inprogress === true) {
            console.log(`${taskName} in progress`)
            continue;
        }
        // console.log("looking at ", task)
        console.log('...checking condition', task.condition, typeof task.condition)
        if (task.condition && typeof task.condition == "function") {

            let conditionOutput = task.condition({
                flowparams: flow.params,
                taskOutputs: {...doneTasks, failedTasks}
            });
            if (typeof conditionOutput == "promise") {
                conditionOutput = await conditionOutput
            }
            if (conditionOutput !== true) {
                console.log(`${taskNames[i]} skipped because condition false`)
                skippedTasks[taskNames[i]] = true;
                flow.tasks[taskName] = {...flow.tasks[taskName] ,...{skipped: true}}
                continue;
            }
        } 
        console.log("processing task ", taskNames[i])

        let prereqs = flow.tasks[taskNames[i]].after;
        let allDone = true;
        let somethingFailed = false;
        let somethingSkipped = false;

        console.log(`...prereqs for ${taskNames[i]} are ${prereqs}`)

        if (!prereqs) {
            console.log(`...no prereqs found running as starting task`)
            runTask(taskNames[i])
            continue;
        }

        let failedPrereqs = [];
        let donePrereqs = [];
        let skippedPrereqs = [];

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
            runTask(taskNames[i])
        }
        
    }
}

async function handleTaskOutput (taskOutput, taskName) {
    console.log('inside handleoutput`')
    doneTasks[taskName] = taskOutput;
    flow.tasks[taskName] = { ...flow.tasks[taskName], ...{     
        inprogress: false,
        done: true,
        failed: false
    }}
    return taskOutput
}

async function handleTaskException (taskException, taskName) {
    console.log('inside handleexception')
    failedTasks[taskName] = taskException;
    flow.tasks[taskName] = { ...flow.tasks[taskName], ...{
        inprogress:false,
        done:false,
        failed:true
    }}
    return taskException
}

async function runTask(taskName) {
    console.log("inside run task", taskName)
    let task = flow.tasks[taskName]
    // console.log('running runTask with', taskName, task)
    if (task.type === 'JSFunction') {
        flow.tasks[taskName] = { ...flow.tasks[taskName], ...{ inprogress: true }}
        let params = task.params;
        console.log(".... params type check", typeof params)
        if (typeof params === "function") {
            console.log("**** function params", params)
            params = params({
                flowparams: flow.params,
                taskOutputs: {  ...doneTasks, ...failedTasks }
            });
            console.log('^^^ params', params)
        }
        let run = task.ref(params);
        let runPromise;
        if (typeof run !== Promise) {
            runPromise = new Promise((resolve, reject) => {
                resolve(run)
            })
        } else {
            runPromise = run;
        }
        runPromise.then(taskOutput => {
            return handleTaskOutput(taskOutput, taskName)
        }).catch(taskException => {
            return handleTaskException(taskException, taskName)
        })
    } else {
        throw "unknown task type"
    }
}

setInterval(() => {
    processFlow()
}, 3000)