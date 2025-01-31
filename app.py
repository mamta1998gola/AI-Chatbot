from fastapi import FastAPI, Request
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
# from fastapi.responses import HTMLResponse
from fastapi.responses import FileResponse
import google.generativeai as genai
import asyncio
from typing import Dict, List
import uuid
from dotenv import load_dotenv
import os

app = FastAPI()

# Mount static files directory for CSS, JS, images
app.mount("/static", StaticFiles(directory="static"), name="static")

# Load environment variables from .env file
load_dotenv()

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure Gemini API
GOOGLE_API_KEY = os.getenv("GEMINI_API_KEY")  # Replace with your actual API key
genai.configure(api_key=GOOGLE_API_KEY)

# Initialize Gemini model
model = genai.GenerativeModel('gemini-pro')

# Route to serve HTML file
@app.get("/", response_class=FileResponse)
async def serve_html():
    return FileResponse("templates/index.html")

# Chat history storage
chat_histories: Dict[str, List[dict]] = {}

# Initialize chat function
def init_chat() -> str:
    chat_id = str(uuid.uuid4())
    chat_histories[chat_id] = []
    return chat_id

@app.post("/init_chat")
async def create_chat():
    chat_id = init_chat()
    return {"chat_id": chat_id}

@app.post("/chat")
async def chat_stream(request: Request):
    try:
        data = await request.json()
        user_input = data.get("message")
        chat_id = data.get("chat_id")
        
        # Create new chat if no chat_id provided
        if not chat_id:
            chat_id = init_chat()
        # Initialize chat history if it doesn't exist
        elif chat_id not in chat_histories:
            chat_histories[chat_id] = []
        
        if not user_input:
            return StreamingResponse(
                iter(["Error: No message provided"]),
                media_type="text/event-stream"
            )

        # Add user message to history
        chat_histories[chat_id].append({
            "role": "user",
            "content": user_input
        })

        async def generate():
            try:
                # Create chat context from history
                history = chat_histories[chat_id]
                
                # Format history for Gemini
                formatted_history = "\n".join([
                    f"{'User' if msg['role'] == 'user' else 'Assistant'}: {msg['content']}"
                    for msg in history[-5:]  # Only use last 5 messages for context
                ])
                
                # Add current context
                prompt = f"""Previous conversation:
{formatted_history}

Please provide a response to the last message while considering the conversation context above."""

                response = model.generate_content(
                    prompt,
                    stream=True
                )
                
                bot_response = ""
                for chunk in response:
                    if chunk.text:
                        bot_response += chunk.text
                        yield chunk.text
                
                # Add bot response to history after complete generation
                chat_histories[chat_id].append({
                    "role": "assistant",
                    "content": bot_response
                })
                        
            except Exception as e:
                error_message = f"Error generating response: {str(e)}"
                yield error_message
                chat_histories[chat_id].append({
                    "role": "assistant",
                    "content": error_message
                })

        return StreamingResponse(
            generate(),
            media_type="text/event-stream"
        )
        
    except Exception as e:
        return StreamingResponse(
            iter([f"Error processing request: {str(e)}"]),
            media_type="text/event-stream"
        )

@app.get("/chat_history/{chat_id}")
async def get_chat_history(chat_id: str):
    if chat_id not in chat_histories:
        return {"error": "Chat history not found"}
    return {"history": chat_histories[chat_id]}

@app.delete("/chat_history/{chat_id}")
async def delete_chat_history(chat_id: str):
    if chat_id in chat_histories:
        del chat_histories[chat_id]
    return {"message": "Chat history deleted"}

# Cleanup old chat histories periodically
async def cleanup_old_histories():
    while True:
        await asyncio.sleep(3600)  # Run every hour
        # Implement cleanup logic here if needed
        # For example, remove histories older than 24 hours

@app.on_event("startup")
async def startup_event():
    asyncio.create_task(cleanup_old_histories())

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)