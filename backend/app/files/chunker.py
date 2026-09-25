"""Zephyra Lite — File chunker."""

from app.files.parser import ParsedSection

def chunk_text(text: str, max_chars: int = 1500, overlap: int = 200) -> list[str]:
    """
    Split text into overlapping chunks of roughly `max_chars` length.
    Attempts to break on paragraphs (\n\n) or sentences (. ) when possible.
    """
    if not text:
        return []
        
    paragraphs = text.split("\n\n")
    chunks = []
    current_chunk = ""
    
    for para in paragraphs:
        para = para.strip()
        if not para:
            continue
            
        if len(current_chunk) + len(para) + 2 <= max_chars:
            current_chunk += ("\n\n" + para) if current_chunk else para
        else:
            if current_chunk:
                chunks.append(current_chunk)
                # Overlap: take the last `overlap` characters of current_chunk
                current_chunk = current_chunk[-overlap:] + "\n\n" + para if overlap > 0 else para
            else:
                # A single paragraph is larger than max_chars.
                # Just take the paragraph as a single chunk for simplicity, or split it.
                chunks.append(para[:max_chars])
                current_chunk = para[max_chars:]
                
    if current_chunk:
        chunks.append(current_chunk.strip())
        
    return chunks

def chunk_document(sections: list[ParsedSection], max_chars: int = 1500, overlap: int = 200) -> list[ParsedSection]:
    """Chunk a parsed document while preserving metadata."""
    chunked_sections = []
    
    for section in sections:
        chunks = chunk_text(section.text, max_chars, overlap)
        for chunk in chunks:
            if chunk.strip():
                chunked_sections.append(ParsedSection(text=chunk.strip(), metadata=section.metadata.copy()))
                
    return chunked_sections
