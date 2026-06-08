let state = false;
let index = 0;
let dat = "";
let debugHTML = "";
let debugs = false;
const api_key = '7e7db55f2676816c9026716b98893308';
const vscode = acquireVsCodeApi();

window.CreateDiv = CreateDiv;
window.updateState = updateState;

document.addEventListener("keydown", (event) => {
    if(event.key === "Enter"){
        document.getElementById("button-id").click();
    }
});

function updateState(){
    const bulb = document.getElementById("bulb-id");
    state = !state;
    if(state){
        bulb.style.backgroundColor = "yellow";
    }
    else{
        bulb.style.backgroundColor = "white";
    }
}

async function CreateDiv(){
    let text = document.getElementById("Chatid").value;
    document.getElementById("Chatid").value = "";
    if(text === ""){
        alert("Enter Text");
        return;
    }

    const user_div = document.createElement("div");
    user_div.className = "user-msg";
    
    const user_img = document.createElement("img");
    user_img.src = userUri;
    user_img.className = "user-img";

    const user_text = document.createElement("div");
    user_text.className = "user-text";
    user_text.innerText = text;
    user_div.appendChild(user_text);
    user_div.appendChild(user_img);

    document.getElementById("chat-container-id").appendChild(user_div);

    const bot_div = document.createElement("div");
    bot_div.className = "bot-msg";

    const bot_img = document.createElement("img");
    bot_img.src = botUri;
    bot_img.className = "bot-img";

    const bot_text = document.createElement("div");
    bot_text.className = "bot-text";
    //const randomReply = replies[Math.floor(Math.random() * replies.length)]
    bot_text.innerText = "...Thinking";
    bot_div.appendChild(bot_img);
    bot_div.appendChild(bot_text); 

    document.getElementById("chat-container-id").appendChild(bot_div);
    await getBotResponse(text,bot_text,state);

    const chatContainer = document.getElementById("chat-container-id");

    chatContainer.scrollTop = chatContainer.scrollHeight;
}

async function getBotResponse(prompt,bot_text,state){
    const API_URL = "http://127.0.0.1:1234/v1/chat/completions";
    const MODEL_NAME = "google/gemma-4-e4b";
    const USER_PROMPT = prompt;
    const SYSTEM_PROMPT = `You are a helpful chatbot assistant designed to analyze and interact with a codebase. 

IMPORTANT PROTOCOLS:
1. Always use the 'codebaseRAG' tool first whenever the user asks questions about code functionality, logic, architecture, errors, or requests a summary of how the application works.
2. Always use the 'findFilePath' tool to locate a file's absolute path when the user specifies a specific filename or relative path, before executing targeted file tools like 'readfile', 'writefile', or 'debugfile'.
3. Do not guess or assume file contents or logic. Rely on 'codebaseRAG' for conceptual knowledge and the file tools for direct execution.

    `;

    const tools = [
        {
            type: "function",
            function: {
                name: "add",
                description: "Add two numbers",
                parameters: {
                    type: "object",
                    properties: {
                        x: {type: "number"},
                        y: {type: "number"},
                    },
                    required: ["x","y"],
                    additionalProperties: false,
                },
                strict: true,
            }
        },
        {
            type: "function",
            function: {
                name: "weather",
                description: "Get Weather data of a city",
                parameters: {
                    type: "object",
                    properties: {
                        lat: {type: "number"},
                        lon: {type: "number"},
                    },
                    required: ["lat","lon"],
                    additionalProperties: false,
                },
                strict: true,
            }
        },
        {
            type: "function",
            function: {
                name: "coords",
                description: "Get Coordinates of a city",
                parameters: {
                    type: "object",
                    properties: {
                        city: {type: "string"},
                    },
                    required: ["city"],
                    additionalProperties: false,
                },
                strict: true,
            }
        },
        {
            type: "function",
            function: {
                name: "readfile",
                description: "read a file with given path",
                parameters: {
                    type: "object",
                    properties: {
                        filePath: {type: "array",items:{type: "string"}},
                        description: "An array of filepath as String"
                    },
                    required: ["filePath"],
                    additionalProperties: false,
                },
                strict: true,
            }
        },
        {
            type: "function",
            function: {
                name: "writefile",
                description: "Write a file with given path",
                parameters: {
                    type: "object",
                    properties: {
                        filePath: {type: "string"},
                        content: {type: "string"},
                    },
                    required: ["filePath","content"],
                    additionalProperties: false,
                },
                strict: true,
            }
        },
        {
            type: "function",
            function: {
                name: "debugfile",
                description: "Debug a file by executing it, capturing syntax/runtime errors, prompting LLM to correct the code, and repeating until it's fully debugged.",
                parameters:{
                    type: "object",
                    properties:{
                        filePath: {type:"string"},
                    },
                    required: ["filePath"],
                    additionalProperties: false,
                },
                strict: true,
            }
        },
        {
            type: "function",
            function: {
                name: "findFilePath",
                description: "Find the file path of any given file name in the current working directory.",
                parameters: {
                    type: "object",
                    properties:{
                        fileName: {type: "string"},
                    },
                    required: ["fileName"],
                    additionalProperties: false,
                },
                strict: true,
            }
        },
        {
            type: "function",
            function: {
                name: "rag",
                description: "Use this tool to search, query, and retrieve context from the entire indexed codebase. Ideal for answering conceptual questions, explaining how functions interact, finding where specific logic is implemented, troubleshooting errors, or understanding the overall architecture of the workspace repository.",
                parameters: {
                    type: "object",
                    properties:{
                        query: {type: "string"}
                    },
                    required: ["query"],
                    additionalProperties: false,
                },
                strict: true,
            }
        }
    ]

    const data = {
        model: MODEL_NAME,
        messages: [
            {"role":"system","content":SYSTEM_PROMPT},
            {"role":"user","content":USER_PROMPT}
        ],
        tools,
        temperature : 0.2,
        stream : false
    }

    const start = performance.now();
    try{
        try{
            let dstate = false;
            const con = await fetch("http://127.0.0.1:1234/");
            while(true){
                const response = await fetch(API_URL,{
                    method: 'POST',
                    headers: {'Content-Type':'application/json'},
                    body: JSON.stringify(data)
                });

                const response_json = await response.json();
                const choice = response_json.choices[0]?.message;
                if (!choice.tool_calls || choice.tool_calls.length === 0) {
                    console.log("Model replied directly:", choice.content);
                    await displayMsg(response_json, bot_text, state, start,dstate);
                    return;
                }
                
                const toolCall = choice.tool_calls[0];

                const args = JSON.parse(toolCall.function.arguments);
                if(toolCall.function.name === "debugfile") dstate = true; 
                               
                const result = await safeCall(toolCall.function.name,args);
                console.log(result);
                data.messages.push(choice);
                data.messages.push({
                    role: "tool",
                    tool_call_id: toolCall.id,
                    content: typeof result === "string" ? result : JSON.stringify(result)
                });
            }
        }
        catch(error) {
            bot_text.innerText="";
            bot_text.innerText ="Bot Is Offline!! Try again later.";
        }
    }catch(error){
        bot_text.innerText="";
        bot_text.innerText ="There is a trouble with the Bot!! Try again later.";
    }
}

function assignCopy(response){

    const element = response.querySelectorAll('pre');

    element.forEach((pre)=>{

        const div = document.createElement("div");
        div.className = "copy-container";

        const head = document.createElement("p");
        head.style.margin = "3px 0 0 10px";
        head.innerText = "Code Snippet >";
        

        const copyButton = document.createElement("button");
        copyButton.className = "copy-button";

        const copy_img = document.createElement("img");
        copy_img.src = copyUri;
        copy_img.className = "copy-img";
        copyButton.appendChild(copy_img);

        copyButton.addEventListener("click", ()=> {
            navigator.clipboard.writeText(pre.innerText);
            copy_img.src = tickUri;
            setTimeout(() => {
                copy_img.src = copyUri;
            }, 3000);
        });

        div.appendChild(head);
        div.appendChild(copyButton);
        pre.parentNode.insertBefore(div,pre);
    });
}

function add({x,y}){
    return x+y;
}

async function getWeather({lat,lon}){
    const apiUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${api_key}`;
    const response = await fetch(apiUrl);
    const data = await response.json();
    return data;
}

async function getCoords({city}){
    const apiUrl = `https://api.openweathermap.org/geo/1.0/direct?q=${city}&appid=${api_key}`;
    const response =await fetch(apiUrl);
    const data = await response.json();
    return data;
}

async function readFile({filePath}){
    let res = {};
    for (const Path of filePath) {
        const r = await readSingleFile(Path);
        res[Path] = r;
    }
    return res;
}

async function readSingleFile(filePath){
    return new Promise((resolve) => {
        vscode.postMessage({
            command: 'readFile',
            path: filePath
        });

        const listener = event => {
            const message = event.data;
            if (message.command === 'fileData' && message.path === filePath) {
                window.removeEventListener('message', listener);
                if (message.error) {
                    resolve(`Error: ${message.error}`);
                } else {
                    resolve(message.content);
                }
            }
        };
        window.addEventListener('message', listener);
    });
}

async function writeFile({filePath,content}){
    vscode.postMessage({
        command: "writeFile",
        path: filePath,
        content: content
    });
    return("Successfully wrote the files!!");
}

async function debugFile({filePath}){
    return new Promise((resolve)=>{
        vscode.postMessage({
            command: "debugFile",
            path: filePath,
        });

        const listener = event => {
            const message = event.data;
            if (message.command === 'debugStatus' && message.path === filePath) {
                const botTexts = document.querySelectorAll(".bot-text");
                const currentBotText = botTexts[botTexts.length - 1];
                if (currentBotText) {
                    if(!debugs){
                        currentBotText.innerHTML = marked.parse(message.msg);
                        debugs = true;
                    }
                    else{
                        currentBotText.innerHTML = currentBotText.innerHTML + marked.parse(message.msg);
                    }
                }
                debugHTML = currentBotText.innerHTML;
            }
            if (message.command === 'debugresponse' && message.path === filePath) {
                window.removeEventListener('message', listener);
                if (message.error) {
                    resolve(`Error: ${message.error}`);
                } else {
                    resolve(message.msg);
                }
            }
        };
        window.addEventListener('message', listener);
    });
}

async function findFilePath({fileName}){
    return new Promise((resolve) => {
        vscode.postMessage({
            command: 'findFilePath',
            fileName: fileName
        });

        const listener = event => {
            const message = event.data;
            if (message.command === 'filePathResponse' && message.fileName === fileName) {
                window.removeEventListener('message', listener);
                if (message.error) {
                    resolve(`Error: ${message.error}`);
                } else {
                    resolve(message.filePath);
                }
            }
        };
        window.addEventListener('message', listener);
    });
}

async function RAGQuery({query}){
    return new Promise((resolve) => {
        vscode.postMessage({
            command: "Rag",
            query: query,
        });

        const listener = event => {
            const message = event.data;
            if (message.command === 'rag') {
                window.removeEventListener('message', listener);
                if (message.error) {
                    resolve(`Error: ${message.error}`);
                } else {
                    resolve(message.content);
                }
            }
        };
        window.addEventListener('message', listener);
    });
}

async function safeCall(toolName, args){
    if(toolName === "add" && typeof args.x === "number" && typeof args.y === "number"){
        return add(args);
    }
    if(toolName === "weather" && typeof args.lat === "number" && typeof args.lon === "number"){
        return await getWeather(args);
    }
    if(toolName === "coords" && typeof args.city === "string"){
        return await getCoords(args);
    }
    if(toolName === "readfile" && (typeof args.filePath === "object" || typeof args.filePath === "string")){
        return await readFile(args);
    }
    if(toolName === "writefile"){
        return await writeFile(args);
    }
    if(toolName === "debugfile"){
        return await debugFile(args);
    }
    if(toolName === "findFilePath" && typeof args.fileName === "string"){
        return await findFilePath(args);
    }
    if(toolName === "rag" && typeof args.query === "string"){
        return await RAGQuery(args);
    }
    throw new Error(`Invalid tool call: ${toolName} with args ${JSON.stringify(args)}`);
}

async function displayMsg(response_text,bot_text,state,start,dstate){
    const response_msg = response_text.choices[0].message.content;
    const reasoning_msg = response_text?.choices?.[0]?.message?.reasoning_content;
    bot_text.innerText="";
    const end = performance.now();
    const time = end-start;
    const sec = (time/1000).toFixed(2);

    let rWeb = "";

    if(state && reasoning_msg){
        rWeb = marked.parse(reasoning_msg + '\n\n<hr class="hr">\n\nResponse:\n\n' + response_msg);
    } else {
        rWeb = marked.parse(response_msg);
    }

    rWeb += `<hr class="hr"><div class="time"><p class="italic">thought for ${sec} s</p></div>`;

    bot_text.innerHTML = debugHTML + rWeb;
    debugHTML = "";
    assignCopy(bot_text);
}
