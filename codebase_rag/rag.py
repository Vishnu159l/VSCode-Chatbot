import chromadb
from dotenv import load_dotenv
import os
import sys
from openai import OpenAI 

load_dotenv()

SUPPORTED_EXTENSIONS = {'.py', '.js', '.tsx', '.jsx', '.ipynb', '.java','.cpp', '.ts', '.go', '.rs', '.vue', '.swift', '.c', '.h'}
IGNORED_DIRS = {'node_modules', 'venv', 'env', 'dist', 'build', '.git','__pycache__', '.next', '.vscode', 'vendor'}

def get_file_content(file_path,repo_path):
    try:
        with open(file_path, 'r', encoding ='utf-8') as f:
            content = f.read()
        rel_path = os.path.relpath(file_path,repo_path)
        return {"name":rel_path,"content":content}
    except Exception as e:
        print("Error reading file")
        return None

def get_files_content(repo_path):
    files_content = []
    for root, _, files in os.walk(repo_path):
        if any(ignored_dir in root for ignored_dir in IGNORED_DIRS):
            continue

        for file in files:
            file_path = os.path.join(root,file)
            if os.path.splitext(file)[1] in SUPPORTED_EXTENSIONS:
                file_content = get_file_content(file_path,repo_path)
                if file_content:
                    files_content.append(file_content)
    return files_content

repo_path = sys.argv[1]
file_content = get_files_content(repo_path)

llm_client = OpenAI(
    base_url="http://localhost:1234/v1",
    api_key="lm-studio"
)

client = chromadb.PersistentClient(path=sys.argv[1] + "./chroma_db")
collection = client.get_or_create_collection(name="codebase")

def chunk_text(text, chunk_size=1000):
    chunks = []
    for i in range(0, len(text), chunk_size):
        chunks.append(text[i:i+chunk_size])
    return chunks

id_counter = 0

for file in file_content:
    chunks = chunk_text(file["content"])
    for chunk in chunks:
        response = llm_client.embeddings.create(
            model="text-embedding-nomic-embed-text-v1.5",
            input=chunk
        )
        embedding = response.data[0].embedding
        collection.add(
            ids=[str(id_counter)],
            embeddings=[embedding],
            documents=[chunk],
            metadatas=[{
                "name": file["name"]
            }]
        )
        id_counter += 1
print("Stored successfully!")