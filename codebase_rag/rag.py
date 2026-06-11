import chromadb
from dotenv import load_dotenv
import os
import sys
from openai import OpenAI 
import tree_sitter_python as pythonts
import tree_sitter_javascript as jsts
from tree_sitter import Language, Parser

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

def code_chunks(code,e):
    
    if(e == ".py"):
        lang = Language(pythonts.language())
        targetNode = ["function_definition","class_definition"]
    elif(e == ".js"):
        lang = Language(jsts.language())
        targetNode = ["function_declaration","class_declaration"]
    
    parser = Parser(lang)
    tree = parser.parse(bytes(code,"utf8"))

    root = tree.root_node
    chunks = []
    def next(node):
        if node.type in targetNode:
            chunk = code[node.start_byte:node.end_byte]
            chunks.append(chunk)

        for child in node.children:
            next(child)
    next(root)
    return chunks

repo_path = sys.argv[1]

file_content = get_files_content(repo_path)


clientlm = OpenAI(
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
    
    ext = os.path.splitext(file["name"])[1]
    
    if ext == ".py":
        chunks = code_chunks(file["content"],".py")
        for chunk in chunks:
            print(f"chunk: {chunk}")
    elif ext == ".js":
        print(ext)
        chunks = code_chunks(file["content"],".js")
        for chunk in chunks:
            print(f"chunk: {chunk}")
    else:
        chunks = chunk_text(file["content"])

    #chunks = chunk_text(file["content"])
    for chunk in chunks:
        response = clientlm.embeddings.create(
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