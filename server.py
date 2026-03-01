from flask import Flask, request, jsonify, session
from flask_cors import CORS
from flask_session import Session
from openai import OpenAI
from dotenv import load_dotenv
import os

# ==============================
# LOAD ENV VARIABLES FIRST
# ==============================
load_dotenv()

# Read API keys from environment (support both OpenAI and Groq)
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
GROQ_API_KEY = os.getenv("GROQ_API_KEY")

# Create AI client depending on available key
if GROQ_API_KEY:
    client = OpenAI(api_key=GROQ_API_KEY, base_url="https://api.groq.com/openai/v1")
    MODEL = os.getenv("OPENAI_MODEL", "llama-3.3-70b-versatile")
elif OPENAI_API_KEY:
    client = OpenAI(api_key=OPENAI_API_KEY)
    MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
else:
    raise ValueError(
        "No API key found. Set OPENAI_API_KEY or GROQ_API_KEY in .env"
    )

# ==============================
# FLASK APP SETUP
# ==============================
# configure flask to serve the frontend as static files from the workspace root
# this lets us open http://localhost:3000/ and get index.html automatically
app = Flask(
    __name__,
    static_folder='',    # serve files from current directory
    static_url_path=''   # mount them at the web root
)

# Needed for session memory; allow overriding secret in .env
app.config["SECRET_KEY"] = os.getenv("FLASK_SECRET", "chat-secret-key")
app.config["SESSION_TYPE"] = "filesystem"

Session(app)

# Allow frontend cookies
CORS(app, supports_credentials=True)


# ==============================
# SYSTEM PROMPT
# ==============================
SYSTEM_PROMPT = """
You are Syntax Saviour, a professional coding mentor and debugging assistant.

Your goal is to provide clear, reasonable, and accurate answers to the user's question.

BEHAVIOR RULES:

Understand the user's question carefully before answering.

Answer ONLY what the user is asking.
Do not add unrelated information.

Provide logical explanations that directly solve the problem.

If the question involves code:
Explain what the problem is.
Explain why it happens.
Explain how to fix it.
Provide corrected or improved code when necessary.

Keep explanations clear, practical, and beginner-friendly.

Avoid overly long paragraphs or unnecessary theory.

If the question is unclear, ask a short clarification question instead of guessing.

If you are unsure about something, say so honestly and provide the best possible guidance.

Avoid generic responses such as:
"It depends" without explanation.
"Try debugging" without steps.

Always aim to be helpful, precise, and solution-oriented.

Tone:
Professional, supportive, and concise.
"""


# ==============================
# CHAT ROUTE
# ==============================
@app.route("/chat", methods=["POST"])
def chat():
    try:
        data = request.get_json()
        user_message = data.get("message", "").strip()

        if not user_message:
            return jsonify({"reply": "No message provided"}), 400

        # Initialize memory if session is new
        if "messages" not in session:
            session["messages"] = [
                {
                    "role": "system",
                    "content": SYSTEM_PROMPT
                }
            ]

        messages = session["messages"]

        # Add user message
        messages.append({
            "role": "user",
            "content": user_message
        })

        # Send FULL conversation history to AI
        response = client.chat.completions.create(
            model=MODEL,
            messages=messages,
            temperature=0.7
        )

        reply = response.choices[0].message.content

        # Save assistant reply
        messages.append({
            "role": "assistant",
            "content": reply
        })

        # Limit memory size (keep system + last messages)
        session["messages"] = [messages[0]] + messages[-14:]

        # IMPORTANT: mark session updated
        session.modified = True

        return jsonify({"reply": reply})

    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ==============================
# RESET CHAT MEMORY
# ==============================
@app.route("/reset", methods=["POST"])
def reset():
    session.pop("messages", None)
    return jsonify({"status": "conversation cleared"})

# ==============================
# SERVE FRONTEND
# ==============================
# A simple home route that delivers the index.html located in the project
# root. Since we configured Flask's `static_folder` to the workspace
# directory and `static_url_path` to '', any file (css/js/images) can be
# referenced relatively in the HTML and will be served automatically.
@app.route("/")
def home():
    return app.send_static_file('index.html')


# ==============================
# RUN SERVER
# ==============================
if __name__ == "__main__":
    app.run(port=3000, debug=True)