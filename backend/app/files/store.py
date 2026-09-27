"""Zephyra Lite — File vector store."""

import chromadb
from chromadb.config import Settings
from app.config import get_settings
from app.files.embeddings import get_embedding_function

class VectorStore:
    def __init__(self, is_test: bool = False):
        self.is_test = is_test
        if is_test:
            self.client = chromadb.Client(Settings(is_tenant_read_only=False, allow_reset=True))
        else:
            settings = get_settings()
            settings.chroma_db_path.mkdir(parents=True, exist_ok=True)
            self.client = chromadb.PersistentClient(path=str(settings.chroma_db_path))
            
        self.embedding_fn = get_embedding_function(is_test)
        self.collection = self.client.get_or_create_collection(
            name="zephyra_files",
            embedding_function=self.embedding_fn,
        )
        self.memory_collection = self.client.get_or_create_collection(
            name="zephyra_memories",
            embedding_function=self.embedding_fn,
        )
        
    def reset(self) -> None:
        if self.is_test:
            self.client.reset()
            self.collection = self.client.get_or_create_collection(
                name="zephyra_files",
                embedding_function=self.embedding_fn,
            )
            self.memory_collection = self.client.get_or_create_collection(
                name="zephyra_memories",
                embedding_function=self.embedding_fn,
            )

    def add_chunks(self, document_id: str, chunks: list[str], metadata_list: list[dict]) -> None:
        """Add parsed chunks to the vector store."""
        if not chunks:
            return
            
        ids = [f"{document_id}_{i}" for i in range(len(chunks))]
        # Ensure all metadata values are primitive types (str, int, float, bool)
        clean_metadata = []
        for m in metadata_list:
            clean_m = {"document_id": document_id}
            for k, v in m.items():
                if v is not None:
                    clean_m[k] = str(v) if not isinstance(v, (int, float, bool, str)) else v
            clean_metadata.append(clean_m)
            
        # Upsert: identical content maps to identical IDs, so re-indexing a hash
        # whose vectors already exist (e.g. left by an earlier failure) is safe.
        self.collection.upsert(
            documents=chunks,
            metadatas=clean_metadata,
            ids=ids,
        )

    def delete_document(self, document_id: str) -> None:
        """Delete all chunks for a document."""
        self.collection.delete(where={"document_id": document_id})

    def search(self, query: str, n_results: int = 5, document_id: str | None = None) -> list[dict]:
        """Search for relevant chunks."""
        where = None
        if document_id:
            where = {"document_id": document_id}
            
        results = self.collection.query(
            query_texts=[query],
            n_results=n_results,
            where=where,
        )
        
        matches = []
        matches = []
        if results and results.get("documents") and len(results["documents"]) > 0:
            docs = results["documents"][0]
            metadatas = results["metadatas"][0] if results.get("metadatas") else [{}] * len(docs)
            for doc, meta in zip(docs, metadatas):
                matches.append({
                    "text": doc,
                    "metadata": meta,
                })
                
        return matches

    def add_memory(self, memory_id: str, content: str, metadata: dict) -> None:
        """Add a memory to the vector store."""
        clean_metadata = {"memory_id": memory_id}
        for k, v in metadata.items():
            if v is not None:
                clean_metadata[k] = str(v) if not isinstance(v, (int, float, bool, str)) else v
                
        self.memory_collection.add(
            documents=[content],
            metadatas=[clean_metadata],
            ids=[memory_id],
        )

    def delete_memory(self, memory_id: str) -> None:
        """Delete a memory from the vector store."""
        self.memory_collection.delete(ids=[memory_id])

    def search_memories(self, query: str, n_results: int = 5, user_id: str | None = None) -> list[dict]:
        """Search for relevant memories."""
        where = None
        if user_id:
            where = {"user_id": user_id}
            
        results = self.memory_collection.query(
            query_texts=[query],
            n_results=n_results,
            where=where,
        )
        
        matches = []
        if results and results.get("documents") and len(results["documents"]) > 0:
            docs = results["documents"][0]
            metadatas = results["metadatas"][0] if results.get("metadatas") else [{}] * len(docs)
            distances = results["distances"][0] if results.get("distances") else [0.0] * len(docs)
            for doc, meta, dist in zip(docs, metadatas, distances):
                matches.append({
                    "text": doc,
                    "metadata": meta,
                    "distance": dist,
                })
                
        return matches

# Singleton instance
_store = None

def get_vector_store(is_test: bool = False) -> VectorStore:
    import sys
    if "pytest" in sys.modules:
        is_test = True
        
    global _store
    if _store is None or _store.is_test != is_test:
        _store = VectorStore(is_test)
    return _store
