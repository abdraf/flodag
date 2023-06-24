export async function appStuff(arg) {
    await new Promise(resolve => {
        setTimeout(() => {
            resolve(true)
        }, 2000)
    });
    return `Timestamp ${new Date().toISOString ()}: appStuff args: ${arg}`;
}

export async function moreAppStuffThatFails() {
    await new Promise(resolve => {
        setTimeout(() => {
            resolve(true)
        }, 2000)
    });
    throw "Timestamp:" + new Date().toISOString () + "app stuff failed";
}