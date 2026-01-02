import os
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# --- 2026 MODULAR IMPORTS ---
from langchain_google_genai import GoogleGenerativeAIEmbeddings
from langchain_groq import ChatGroq
from langchain_chroma import Chroma
from langchain_community.document_loaders import PyPDFDirectoryLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_core.tools.retriever import create_retriever_tool
from langchain_community.tools.tavily_search import TavilySearchResults

# --- 2026 AGENT & HUB FIXES ---
from langchain_classic import hub as classic_hub  # <--- THE FIX FOR HUB.PULL
from langchain_classic.agents import AgentExecutor, create_react_agent  # <--- THE FIX FOR IMPORTS

load_dotenv()

app = FastAPI()

# ✅ STABLE CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- 1. INITIALIZE MODELS ---
embeddings = GoogleGenerativeAIEmbeddings(model="models/text-embedding-004")

# Llama-3.3-70b is the standard for high-speed reasoning in 2026
llm = ChatGroq(
    model="llama-3.3-70b-versatile",
    temperature=0.1,
    api_key=os.getenv("GROQ_API_KEY")
)

# --- 2. SETUP PERMANENT KNOWLEDGE BASE ---
DATA_PATH = "./data"
CHROMA_PATH = "./chroma_db"

if not os.path.exists(CHROMA_PATH):
    print("🚀 Database NOT found. Creating index...")
    if not os.path.exists(DATA_PATH): os.makedirs(DATA_PATH)
    loader = PyPDFDirectoryLoader(DATA_PATH)
    docs = loader.load()
    if docs:
        text_splitter = RecursiveCharacterTextSplitter(chunk_size=600, chunk_overlap=100)
        splits = text_splitter.split_documents(docs)
        vectorstore = Chroma.from_documents(
            documents=splits, 
            embedding=embeddings,
            persist_directory=CHROMA_PATH
        )
        print("✅ Database created!")
    else:
        print("⚠️ No PDFs found.")
        vectorstore = Chroma(embedding_function=embeddings, persist_directory=CHROMA_PATH)
else:
    print("⚡ Database found! Loading instantly...")
    vectorstore = Chroma(persist_directory=CHROMA_PATH, embedding_function=embeddings)

# --- 3. TOOLS & AGENT SETUP ---
retriever_tool = create_retriever_tool(
    vectorstore.as_retriever(search_kwargs={"k": 3}),
    "university_database",
    "Use this tool to search for ACCA, universities, fees, and admission rules from local files."
)

search_tool = TavilySearchResults(max_results=1)
tools = [retriever_tool, search_tool]

# ✅ THE FIX: Pull the prompt using the classic_hub utility
prompt = classic_hub.pull("hwchase17/react")

# ✅ THE FIX: Create the agent using the classic library paths
agent = create_react_agent(llm, tools, prompt)
agent_executor = AgentExecutor(
    agent=agent, 
    tools=tools, 
    verbose=True, 
    handle_parsing_errors=True,
    max_iterations=5
)

@app.post("/chat")
async def chat_endpoint(request: dict):
    user_query = request.get("prompt")
    
    input_text = (
        f"You are EduBuddy, an expert University Counselor. "
        f"Answer the user query: {user_query}. "
        f"If the answer is not in your database, use the search tool. "
        f"If the topic is not about education, politely refuse."
    )
    
    try:
        # Agent will now correctly use ReAct logic (Think -> Act -> Observe)
        response = agent_executor.invoke({"input": input_text})
        return {"answer": response["output"]}
    except Exception as e:
        print(f"Server Error: {e}")
        return {"answer": "I'm having a quick rest! Please try again in a moment."}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)