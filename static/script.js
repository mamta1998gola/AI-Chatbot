// Chat history management
let currentChatId = null;
let chats = [];
const chatDiv = document.getElementById("chat");
const input = document.getElementById("input");
const sidebar = document.querySelector(".sidebar");

// Helper function to generate unique chat names
function generateChatName() {
    const date = new Date();
    const formattedDate = date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
    return `Chat ${formattedDate}`;
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

// Load chats from localStorage
function loadChats() {
    const savedChats = localStorage.getItem('chats');
    chats = savedChats ? JSON.parse(savedChats) : [];
    renderChatList();
}

// Save chats to localStorage
function saveChats() {
    localStorage.setItem('chats', JSON.stringify(chats));
}

// Render chat list in sidebar
function renderChatList() {
    // Clear existing chat list except the "New chat" button
    const newChatBtn = sidebar.querySelector('.new-chat-btn');
    sidebar.innerHTML = '';
    sidebar.appendChild(newChatBtn);

    // Add chat history items
    chats.forEach(chat => {
        const chatItem = document.createElement('div');
        chatItem.className = 'chat-item';
        if (chat.id === currentChatId) {
            chatItem.classList.add('active');
        }

        // Create chat title element
        const chatTitle = document.createElement('span');
        chatTitle.textContent = chat.title || 'New Chat';
        chatTitle.className = 'chat-title';
        
        // Create delete button
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-chat-btn';
        deleteBtn.innerHTML = '<i class="fas fa-trash"></i>';
        deleteBtn.onclick = (e) => {
            e.stopPropagation();
            deleteChat(chat.id);
        };

        chatItem.appendChild(chatTitle);
        chatItem.appendChild(deleteBtn);
        
        chatItem.onclick = () => loadChat(chat.id);
        sidebar.appendChild(chatItem);
    });
}

// Delete chat
function deleteChat(chatId) {
    const confirmDelete = confirm('Are you sure you want to delete this chat?');
    if (confirmDelete) {
        // Remove chat from array
        chats = chats.filter(chat => chat.id !== chatId);
        
        // Update localStorage
        saveChats();
        
        if (currentChatId === chatId) {
            // If we're deleting the current chat
            if (chats.length > 0) {
                // If there are other chats, load the most recent one
                currentChatId = chats[0].id;
                loadChat(currentChatId);
            } else {
                // If no chats remain, initialize a new one
                currentChatId = null;
                initializeChat();
            }
        } else {
            // If we're deleting a different chat, just update the sidebar
            renderChatList();
        }
    }
}

// Load specific chat
function loadChat(chatId) {
    const chat = chats.find(c => c.id === chatId);
    if (chat) {
        currentChatId = chatId;
        chatDiv.innerHTML = '';
        
        // Render all messages in the chat
        chat.messages.forEach(msg => {
            const messageDiv = document.createElement("div");
            messageDiv.className = `message ${msg.type}`;

            const avatar = document.createElement("div");
            avatar.className = "avatar";
            avatar.innerHTML = msg.type === "user" ? '<i class="fas fa-user"></i>' : '<i class="fas fa-robot"></i>';

            const contentDiv = document.createElement("div");
            contentDiv.className = "message-content";
            contentDiv.innerHTML = msg.type === "user" ? msg.content : marked.parse(msg.content);

            messageDiv.appendChild(avatar);
            messageDiv.appendChild(contentDiv);
            chatDiv.appendChild(messageDiv);

            if (msg.type === "bot") {
                addCopyButtons(messageDiv);
            }
        });
        
        renderChatList();
        chatDiv.scrollTop = chatDiv.scrollHeight;
    }
}

// Modified initialize chat function
async function initializeChat() {
    try {
        const response = await fetch("http://127.0.0.1:8000/init_chat", {
            method: "POST"
        });
        const data = await response.json();
        currentChatId = data.chat_id;
        
        // Create new chat object with unique name
        const newChat = {
            id: currentChatId,
            title: generateChatName(),
            messages: []
        };
        chats.unshift(newChat);
        saveChats();
        
        // Clear chat area and show welcome message
        chatDiv.innerHTML = '';
        appendMessage("bot", "Hello! How can I assist you today?");
        renderChatList();
    } catch (error) {
        console.error("Error initializing chat:", error);
    }
}

// Modified appendMessage function
function appendMessage(type, text, save = true) {
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

    if (type === "bot") {
        addCopyButtons(messageDiv);
    }

    // Save message to chat history
    if (save && currentChatId) {
        const currentChat = chats.find(c => c.id === currentChatId);
        if (currentChat) {
            currentChat.messages.push({ type, content: text });
            saveChats();
            renderChatList();
        }
    }

    chatDiv.scrollTop = chatDiv.scrollHeight;
    return messageDiv;
}

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

// Insert format function
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

// Modified sendMessage function
async function sendMessage() {
    const userInput = input.value.trim();
    if (!userInput) return;

    input.value = "";
    input.style.height = "auto";

    appendMessage("user", userInput);

    try {
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
        const botMessageDiv = appendMessage("bot", "");

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value);
            botResponse += chunk;
            const formattedResponse = marked.parse(botResponse);
            botMessageDiv.querySelector('.message-content').innerHTML = formattedResponse;
            addCopyButtons(botMessageDiv);
            chatDiv.scrollTop = chatDiv.scrollHeight;
        }

        // Update the bot message in chat history with complete response
        const currentChat = chats.find(c => c.id === currentChatId);
        if (currentChat) {
            currentChat.messages[currentChat.messages.length - 1].content = botResponse;
            saveChats();
        }
    } catch (error) {
        console.error("Error:", error);
        appendMessage("bot", "Error: Could not connect to the AI assistant.");
    }
}

// Initialize when page loads
document.addEventListener("DOMContentLoaded", async () => {
    loadChats();
    if (chats.length > 0) {
        // Load the most recent chat
        currentChatId = chats[0].id;
        loadChat(currentChatId);
    } else {
        // Initialize new chat only if no saved chats exist
        await initializeChat();
    }
});

// Modified new chat button event listener
document.querySelector('.new-chat-btn').addEventListener('click', async () => {
    await initializeChat();
});