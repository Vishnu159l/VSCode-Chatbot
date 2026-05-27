let state = false;
let index = 0;

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
    //const randomReply = replies[Math.floor(Math.random() * replies.length)];
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

    const data = {
        model: MODEL_NAME,
        messages: [
            {"role":"system","content":"You are a simple Chatbot"},
            {"role":"user","content":USER_PROMPT}
        ],
        temperature : 0.2,
        stream : false
    }

    const start = performance.now();
    try{
        const response = await fetch(API_URL,{
            method: 'POST',
            headers: {'Content-Type':'application/json'},
            body: JSON.stringify(data)
        });

        const response_text = await response.json();
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

        bot_text.innerHTML = rWeb;
        assignCopy(bot_text);


    }catch(error){
        return "error";
    }
}

function assignCopy(response){

    const element = response.querySelectorAll('pre');

    element.forEach((pre)=>{

        const div = document.createElement("div");
        div.className = "copy-container";

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

        div.appendChild(copyButton);
        pre.parentNode.insertBefore(div,pre.nextSibling);
    });
}