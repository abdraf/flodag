import { appStuff } from "../../app-stff"
import { moreAppStuffThatFails } from "../../app-stff"

let flow = {
    name: 'Some Flow',
    params: "flow params :)",
    tasks: {
        task0: { 
            ref: appStuff, 
            params: "this is task 0"
        },
        task1: { 
            ref: appStuff, 
            params: ({ flowparams, taskOutputs }) => {
                // task0 output will be undefined because it runs in parallel with task 0
                return `task1 output: the output for task 0 was ${taskOutputs['task0']} and flowparams are ${flowparams}`
            }
        },
        task2: { 
            ref: appStuff, 
            params: ({ flowparams, taskOutputs }) => {
                return `task2 from function, output of task1 is ${taskOutputs['task1']}`
            }, 
            after: [ 'task0' ] 
        },
        task3: { 
            ref: appStuff, 
            params: "task3", 
            after: [ 'task1' ]
        },
        task4: { 
            ref: moreAppStuffThatFails, 
            params: "task4",
            condition: ({ flowparams, taskOutputs }) => {
                return false
            },
            after: [ 'task2', 'task3' ] 
        },
        task5: {
            ref: appStuff, 
            params: "task4",
            condition: ({ flowparams, taskOutputs }) => {
                return false
            },
            after: [ 'task4' ]            
        }
    }
}
