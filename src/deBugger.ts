import * as child_process from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as vscode from 'vscode';

import {initParser,getCodeBlock} from './Tree.js';

function getExtension(filePath: string) {
    const ext = path.extname(filePath);
    if (ext === ".py") return "python";
    return null;
}


function runFile(
    filePath: string,
    panel: vscode.WebviewPanel,
    
): Promise<{ success: boolean; err: string }> {
    const interpreter = getExtension(filePath);
    if (!interpreter) {
        return Promise.resolve({
            success: false,
            err: "Unsupported file type (only .py files are supported)"
        });
    }

    return new Promise((resolve) => {
        const child = child_process.spawn(interpreter, ['-u', filePath]);
        let er = '';

        const inpmsg = panel.webview.onDidReceiveMessage((message) => {
            if (message.command === 'stdin') {
                if (child && !child.killed) {
                    child.stdin.write(message.text + '\n');
                }
            }
        });

        child.stdout.on('data', (data) => {
            const text = data.toString();
            panel.webview.postMessage({ command: 'stdout', text });
        });

        child.stderr.on('data', (data) => {
            const text = data.toString();
            er += text;
            panel.webview.postMessage({ command: 'stderr', text });
        });

        child.on('error', (err) => {
            const errMsg = `System error: ${err.message}\n`;
            er += errMsg;
            panel.webview.postMessage({ command: 'stderr', text: errMsg });
        });

        child.on('close', (code) => {
            inpmsg.dispose();
            resolve({
                success: code === 0,
                err: er
            });
        });
    });
}

function getNumberedCode(code: string): string {
    return code
        .split('\n')
        .map((line, idx) => `${idx + 1}: ${line}`)
        .join('\n');
}

function extractCode(response: string) {
    const match = response.match(/```(?:\w+)?\n([\s\S]*?)```/);

    if (!match) {
        throw new Error("No code block found in LLM response");
    }

    return match[1].trim();
}

async function llmRequest(code: string, error: string, filepath: string) {
    const numberedCode = getNumberedCode(code);
    const fileName = path.basename(filepath);
    const ext = path.extname(filepath);
    const API_URL = "http://127.0.0.1:1234/v1/chat/completions";
    const MODEL_NAME = "google/gemma-4-e4b";
    const USER_PROMPT = `
You are an automated AST-aware code debugging system.

Your task is to fix ONLY the provided code snippet based on:
1. The provided code snippet
2. The runtime/syntax error
3. The traceback or stderr output
4. The execution transcript

IMPORTANT RULES:
- Fix ONLY the actual issue causing the error.
- Do NOT modify unrelated logic.
- Preserve formatting and structure as much as possible.
- Do NOT rewrite surrounding code that is not required.
- Return ONLY the corrected version of the provided code snippet.
- Do NOT return the entire file.
- Do NOT include explanations.
- Do NOT describe the fix.
- Do NOT include markdown explanations.
- Do NOT include comments unless they already exist.
- Output ONLY the corrected code inside ONE markdown code block.
- The code block language MUST match the file extension.

The code snippet below may represent:
- a function
- a class
- an expression
- an if statement
- a loop
- or another AST node extracted from the source file.

The snippet may NOT represent the entire file.

FILE NAME:
${fileName}

ERROR OUTPUT:
${error}

CODE SNIPPET:
${code}

Return ONLY:

\`\`\`${ext}
[corrected code snippet]
\`\`\`
`;



    const data = {
        model: MODEL_NAME,
        messages: [
            { "role": "system", "content": "You are a programming assistant that only returns code fixes." },
            { "role": "user", "content": USER_PROMPT }
        ],
        temperature: 0.2,
        stream: false
    }

    const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });

    const response_json = await response.json() as any;
    const content = response_json.choices[0]?.message.content;
    return extractCode(content);
}

export function displayDebuggingStatus(errcount: number, error: string): string {
    return `### Debugger Status
**Error** ${errcount}
\`\`\`
${error}
\`\`\``;
}

function getErrorLine(error: string) {
    const pattern = /File "(.+?)", line (\d+)/g;
    const lines = [];
    let match;

    while ((match = pattern.exec(error)) !== null) {
        lines.push(parseInt(match[2], 10));
    }

    return lines[lines.length-1];
}

export async function debugFileLoop(filePath: string, onStatus?: (statusMsg: string) => void) {
    let errcount = 0;

    const panel = vscode.window.createWebviewPanel(
        'interactiveDebug',
        'Terminal',
        vscode.ViewColumn.Beside,
        {
            enableScripts: true
        }
    );

    await initParser();

    panel.webview.html = getSimpleWebviewHtml();

    while (true) {
        panel.webview.postMessage({ command: 'clear' });

        const result = await runFile(filePath, panel);

        if (result.success) {
            return {
                success: true,
                message: `successfully debugged code. ${errcount} errors detected`,
            };
        }

        errcount++;

        if (onStatus) {
            onStatus(displayDebuggingStatus(errcount, result.err));
        }

        panel.webview.postMessage({ command: 'debugger', text: `Execution Failed. Waiting for LLM to fix` });


        const errline = getErrorLine(result.err);

        let originalcode = "";
        try {
            originalcode = await fs.readFile(filePath, 'utf8');
        } catch (err) {
            return {
                success: false,
                message: `File read error ${err}`
            };
        }

        try {
            const targetNode = await getCodeBlock(originalcode,errline);
            const targetCode = originalcode.slice(targetNode.startIndex,targetNode.endIndex);
            console.log(targetNode.type);
            console.log(targetCode);
            const correctedcode = await llmRequest(targetCode, result.err, filePath);
            const updatedCode = originalcode.slice(0, targetNode.startIndex) + correctedcode + originalcode.slice(targetNode.endIndex);
            await fs.writeFile(filePath, updatedCode);
        } catch (err) {
            return {
                success: false,
                message: `LLM error ${err}`
            };
        }
    }
}

function getSimpleWebviewHtml(): string {

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Terminal</title>
    <style>
        body{
            font-family: monospace;
            background-color: #1e1e1e;
            color: #d4d4d4;
            padding: 15px;
        }
        h3{
            margin-top: 0;
            color: #fff;
        }
        #terminal{
            height: 350px;
            overflow-y: auto;
            border: 1px solid #3c3c3c;
            padding: 10px;
            background-color: #121212;
            white-space: pre-wrap;
            font-size: 13px;
        }
        #input{
            display: flex;
            flex-direction: row;
            justify-content: space-between;
        }
        .chatbox{
            flex:1;
        }
        #stdin{ 
            border: solid;
            border-width: 0.2px;
            background-color: aliceblue;
            width: 100%;
            height: 100%;
            border-radius: 10px;
            padding-left: 10px;
        }
        button{
            background: blue;
            color: white;
            border: none;
            font-size: 13px;
            margin-left: 20px;
            margin-top:5px
        }
    </style>
</head>
<body>
    <div id="terminal"></div>
    <div id="input">
        <div class="chatbox">
			<input type="text" id="stdin" placeholder="Enter Input">
		</div>
        <div class="submit-button">
			<button class ="button" onclick="CreateDiv()" id="send-btn">Enter</button>
		</div>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        const terminal = document.getElementById('terminal');
        const stdinInput = document.getElementById('stdin');
        const sendBtn = document.getElementById('send-btn');

        function appendLine(text, className) {
            const span = document.createElement('span');
            span.className = className;
            span.textContent = text;
            terminal.appendChild(span);
            terminal.scrollTop = terminal.scrollHeight;
        }

        function sendInput() {
            const val = stdinInput.value;
            if (val === '') return;
            appendLine(val + '\\n', 'stdin');
            vscode.postMessage({
                command: 'stdin',
                text: val
            });
            stdinInput.value = '';
        }

        sendBtn.addEventListener('click', sendInput);
        stdinInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                sendInput();
            }
        });

        document.addEventListener('click', () => {
            stdinInput.focus();
        });

        window.addEventListener('message', event => {
            const message = event.data;
            if(message.command === "clear"){
                terminal.innerHTML = '';
            }
            else{
                appendLine(message.command + " >> "+message.text,message.command);    
            }
        });
    </script>
</body>
</html>`;
}