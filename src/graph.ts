import { taskAttributes, taskName, taskDefinitionsObject, flowDag } from "./types";
import Graph from 'graphology';
import traversal from 'graphology-traversal';

export class FlowDagGraph {

    private taskDefinitions: taskDefinitionsObject = {};
    private dag: Graph;
    private rootNodes: taskName[];

    constructor(flow: flowDag) {
        this.taskDefinitions = flow.tasks;
        this.buildGraph();
        this.validateDag();
    }

    private buildGraph() {
        // let graph = new Graph();
        let seenTasks = {};
        const taskNames = Object.keys(this.taskDefinitions);
        let totalTasks = taskNames.length;
        
        for (let i = 0; i < taskNames.length; i++) {
            let taskName = taskNames[i];
            let task = this.taskDefinitions[taskName];
            if (typeof task.ref !== "function") {
                throw "task.ref needs to be a node js function"
            }
            if (seenTasks[taskName]) {
                throw "cannot have more than one task with same name"
            }
            seenTasks[taskName] = true;
            // graph.addNode(taskName)

            if (!task.follows || task.follows.length == 0) {
                this.rootNodes.push(taskName);
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
        
    }

    private validateDag() {}

    public dfsFromNode() {}

}