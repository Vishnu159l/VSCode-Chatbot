import chromadb
import sys
from openai import OpenAI

repo_path = sys.argv[1]

chroma_client = chromadb.PersistentClient(path = repo_path + "./chroma_db")
collection = chroma_client.get_collection(name = "codebase")

client = OpenAI(
    base_url="http://localhost:1234/v1",
    api_key="lm-studio"
)

query = sys.argv[2]

embedding_response = client.embeddings.create(
    input = query,
    model = "text-embedding-nomic-embed-text-v1.5"
)

query_embedding = embedding_response.data[0].embedding

result = collection.query(
    query_embeddings = query_embedding,
    n_results = 5
)

documents = result["documents"][0]
metadatas = result["metadatas"][0]

context = ""

for i in range(len(documents)):
    context += f"""
FILE: {metadatas[i]["name"]}
{documents[i]}
--------------------
"""

response = client.chat.completions.create(
  model="google/gemma-4-e4b",
  messages=[
    {"role": "system", "content": "You are a codebase assistant.Answer using the provided code context."},
    {"role": "user", "content": f"""
Context:
{context}

Question:
{query}
"""
    }
  ],
  temperature=0.2,
)

print(response.choices[0].message.content)  