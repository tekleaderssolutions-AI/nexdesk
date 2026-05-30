"""KB Embedding Service — generates and stores MiniLM embeddings for KB articles."""
from typing import Optional
from sqlalchemy.orm import Session

from app.models.models import KnowledgeBase, KBEmbedding
from app.services.embedding_service import EmbeddingService


def _build_kb_text(kb: KnowledgeBase) -> str:
    parts = [f"Title: {kb.title or ''}"]
    if kb.description:
        parts.append(f"Description: {kb.description}")
    if kb.resolution:
        parts.append(f"Resolution: {kb.resolution}")
    if kb.tags:
        parts.append(f"Tags: {kb.tags}")
    return "\n".join(parts)


def embed_kb_article(db: Session, kb: KnowledgeBase) -> Optional[KBEmbedding]:
    """Generate (or refresh) the embedding for a single KB article."""
    text = _build_kb_text(kb)
    vector = EmbeddingService.generate_embedding(text)

    existing = db.query(KBEmbedding).filter(KBEmbedding.kb_id == kb.id).first()
    if existing:
        existing.embedding = vector.tolist()
        existing.embedding_text = text
        existing.embedding_model = EmbeddingService.MODEL_NAME
        db.commit()
        db.refresh(existing)
        return existing

    emb = KBEmbedding(
        kb_id=kb.id,
        embedding_text=text,
        embedding_model=EmbeddingService.MODEL_NAME,
        embedding=vector.tolist(),
    )
    db.add(emb)
    db.commit()
    db.refresh(emb)
    return emb


def embed_all_kb_articles(db: Session) -> dict:
    """
    Batch-embed all published KB articles that don't yet have a vector.
    Returns a summary dict.
    """
    articles = db.query(KnowledgeBase).filter(KnowledgeBase.is_published == True).all()

    already_embedded: set[str] = set()
    try:
        rows = db.query(KBEmbedding).filter(KBEmbedding.embedding.isnot(None)).all()
        already_embedded = {str(r.kb_id) for r in rows}
    except Exception:
        pass

    to_embed = [a for a in articles if str(a.id) not in already_embedded]

    if not to_embed:
        return {"total": len(articles), "newly_embedded": 0, "already_embedded": len(already_embedded)}

    texts = [_build_kb_text(a) for a in to_embed]
    vectors = EmbeddingService.generate_embeddings_batch(texts)

    count = 0
    for kb, text, vector in zip(to_embed, texts, vectors):
        try:
            emb = KBEmbedding(
                kb_id=kb.id,
                embedding_text=text,
                embedding_model=EmbeddingService.MODEL_NAME,
                embedding=vector.tolist(),
            )
            db.add(emb)
            count += 1
        except Exception as e:
            print(f"[KB_EMBED] Failed for {kb.id}: {e}")

    db.commit()
    print(f"[KB_EMBED] Embedded {count}/{len(to_embed)} articles")
    return {
        "total": len(articles),
        "newly_embedded": count,
        "already_embedded": len(already_embedded),
    }
