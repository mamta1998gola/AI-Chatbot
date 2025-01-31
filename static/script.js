let currentChatId = null;
const chatDiv = document.getElementById("chat");
const input = document.getElementById("input");

// Configure marked options
marked.setOptions({
    highlight: function (code, lang) {
        return hljs.highlightAuto(code).value;
    },
    breaks: true
});

// Auto-resize textarea
input.addEventListener("input", function () {
    this.style.height = "auto";
    this.style.height = (this.scrollHeight) + "px";
});

// Send message on Enter (but Shift+Enter for new line)
input.addEventListener("keydown", function (event) {
    if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        sendMessage();
    }
});

function insertFormat(prefix, suffix) {
    const start = input.selectionStart;
    const end = input.selectionEnd;
    const text = input.value;
    const before = text.substring(0, start);
    const selection = text.substring(start, end);
    const after = text.substring(end);

    input.value = before + prefix + selection + suffix + after;
    input.focus();
    input.selectionStart = start + prefix.length;
    input.selectionEnd = end + prefix.length;
}

// Add this function to initialize a new chat
async function initializeChat() {
    try {
        const response = await fetch("http://127.0.0.1:8000/init_chat", {
            method: "POST"
        });
        const data = await response.json();
        currentChatId = data.chat_id;
    } catch (error) {
        console.error("Error initializing chat:", error);
    }
}

// Modify the sendMessage function to include chat_id
async function sendMessage() {
    const userInput = input.value.trim();
    if (!userInput) return;

    input.value = "";
    input.style.height = "auto";

    // Display user message
    appendMessage("user", userInput);

    try {
        // Make sure we have a chat ID
        if (!currentChatId) {
            await initializeChat();
        }

        const response = await fetch("http://127.0.0.1:8000/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                message: userInput,
                chat_id: currentChatId
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let botResponse = "";

        // Create bot message container
        const botMessageDiv = appendMessage("bot", "");

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            // Decode and append streaming response
            const chunk = decoder.decode(value);
            botResponse += chunk;

            // Format the response with markdown and update the message
            const formattedResponse = marked.parse(botResponse);
            botMessageDiv.querySelector('.message-content').innerHTML = formattedResponse;

            // Add copy buttons to code blocks
            addCopyButtons(botMessageDiv);

            // Scroll to the bottom as new content arrives
            chatDiv.scrollTop = chatDiv.scrollHeight;
        }
    } catch (error) {
        console.error("Error:", error);
        appendMessage("bot", "Error: Could not connect to the AI assistant.");
    }
}

function appendMessage(type, text) {
    const messageDiv = document.createElement("div");
    messageDiv.className = `message ${type}`;

    const avatar = document.createElement("div");
    avatar.className = "avatar";
    avatar.innerHTML = type === "user" ? '<i class="fas fa-user"></i>' : '<i class="fas fa-robot"></i>';

    const contentDiv = document.createElement("div");
    contentDiv.className = "message-content";
    contentDiv.innerHTML = type === "user" ? text : marked.parse(text);

    messageDiv.appendChild(avatar);
    messageDiv.appendChild(contentDiv);
    chatDiv.appendChild(messageDiv);

    // Add copy buttons to code blocks if it's a bot message
    if (type === "bot") {
        addCopyButtons(messageDiv);
    }

    chatDiv.scrollTop = chatDiv.scrollHeight;
    return messageDiv;
}

// Helper function to add copy buttons to code blocks
function addCopyButtons(messageDiv) {
    const codeBlocks = messageDiv.querySelectorAll('pre code');
    codeBlocks.forEach(codeBlock => {
        const pre = codeBlock.parentNode;
        if (!pre.querySelector('.copy-button')) {
            const button = document.createElement('button');
            button.className = 'copy-button';
            button.textContent = 'Copy';
            button.addEventListener('click', async () => {
                try {
                    await navigator.clipboard.writeText(codeBlock.textContent);
                    button.textContent = 'Copied!';
                    setTimeout(() => {
                        button.textContent = 'Copy';
                    }, 2000);
                } catch (err) {
                    console.error('Failed to copy:', err);
                    button.textContent = 'Failed to copy';
                    setTimeout(() => {
                        button.textContent = 'Copy';
                    }, 2000);
                }
            });
            pre.appendChild(button);
        }
    });
}

// Initialize chat when page loads
document.addEventListener("DOMContentLoaded", async () => {
    await initializeChat();
    appendMessage("bot", "Hello! How can I assist you today?");
});

// Add event listener for new chat button
document.querySelector('.new-chat-btn').addEventListener('click', async () => {
    chatDiv.innerHTML = '';
    await initializeChat();
    appendMessage("bot", "Hello! How can I assist you today?");
});