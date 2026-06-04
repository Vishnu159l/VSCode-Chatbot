import * as child_process from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as vscode from 'vscode';

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
        child_process.spawn('cmd.exe',['/k',interpreter,filePath],{
            detached: true,
            stdio: 'inherit'
        });
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
You are an automated code debugging system.

Your task is to fix the code based ONLY on:
1. The provided source code
2. The runtime/syntax error
3. The stack trace or stderr output
4. The execution transcript (stdout, stderr, and stdin inputs) leading to the error

IMPORTANT RULES:
- Fix ONLY the actual issue causing the error.
- Do NOT change unrelated logic.
- Preserve the original structure and formatting as much as possible.
- Return the COMPLETE corrected file.
- Do NOT include explanations.
- Do NOT include markdown explanations.
- Do NOT include comments unless they already exist.
- Do NOT describe the fix.
- Output ONLY the corrected code inside a single markdown code block.
- The code block language MUST match the file extension.

The source code below contains line numbers for debugging reference.
Those line numbers are NOT part of the actual code.
Do NOT include line numbers in your output.

FILE NAME:
${fileName}

ERROR OUTPUT:
${error}

SOURCE CODE WITH LINE NUMBERS:
${numberedCode}

Return ONLY:

\`\`\`${ext}
[complete corrected code]
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
            const correctedcode = await llmRequest(originalcode, result.err, filePath);
            await fs.writeFile(filePath, correctedcode);
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