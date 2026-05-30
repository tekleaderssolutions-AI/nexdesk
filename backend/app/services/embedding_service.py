"""Embedding service using sentence-transformers/all-MiniLM-L6-v2."""
import numpy as np
from typing import List, Optional
from sentence_transformers import SentenceTransformer

from app.services.pii_masker import PIIMasker


class EmbeddingService:
    """Generate semantic embeddings using MiniLM model."""

    MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"
    EMBEDDING_DIMENSION = 384

    _model: Optional[SentenceTransformer] = None

    @classmethod
    def get_model(cls) -> SentenceTransformer:
        """Return the singleton model, loading it on first call."""
        if cls._model is None:
            print(f"[EMBEDDING] Loading model {cls.MODEL_NAME}...")
            cls._model = SentenceTransformer(cls.MODEL_NAME)
            print(f"[EMBEDDING] Model loaded. Dimension: {cls.EMBEDDING_DIMENSION}")
        return cls._model

    @classmethod
    def warmup(cls) -> None:
        """Load the model at application startup so the first ticket is fast."""
        cls.get_model()
        test_vec = cls.generate_embedding("warmup")
        print(f"[EMBEDDING] Warmup complete. Vector dim={len(test_vec)}")

    @classmethod
    def build_embedding_text(
        cls,
        subject: str,
        description: str,
        attachment_text: Optional[str] = None,
    ) -> str:
        """
        Build combined text for embedding from ticket fields.
        Format:
        Subject:
        {subject}

        Description:
        {description}

        Attachments:
        {attachment_text}
        """
        parts = [
            f"Subject:\n{subject or ''}",
            f"\nDescription:\n{description or ''}",
        ]
        if attachment_text:
            parts.append(f"\nAttachments:\n{attachment_text}")

        return "".join(parts)

    @classmethod
    def mask_and_build(
        cls,
        subject: str,
        description: str,
        attachment_text: Optional[str] = None,
    ) -> tuple[str, str]:
        """
        Build embedding text and apply PII masking.
        Returns (original_text, masked_text).
        """
        original_text = cls.build_embedding_text(subject, description, attachment_text)
        masked_text = PIIMasker.mask_pii(original_text)
        return original_text, masked_text

    @classmethod
    def generate_embedding(cls, text: str) -> np.ndarray:
        """
        Generate MiniLM embedding for given text.
        Returns normalized embedding vector (384 dimensions).
        """
        if not text or not text.strip():
            # Return zero vector if text is empty
            return np.zeros(cls.EMBEDDING_DIMENSION, dtype=np.float32)

        model = cls.get_model()
        embedding = model.encode(text, normalize_embeddings=True)
        return embedding.astype(np.float32)

    @classmethod
    def generate_embeddings_batch(cls, texts: List[str]) -> List[np.ndarray]:
        """Generate embeddings for multiple texts in batch."""
        if not texts:
            return []

        model = cls.get_model()
        embeddings = model.encode(texts, normalize_embeddings=True, show_progress_bar=False)
        return [emb.astype(np.float32) for emb in embeddings]

    @classmethod
    def cosine_similarity(cls, embedding1: np.ndarray, embedding2: np.ndarray) -> float:
        """
        Compute cosine similarity between two embeddings.
        Both embeddings should be normalized.
        Returns score from -1.0 to 1.0, where 1.0 is identical.
        """
        if embedding1 is None or embedding2 is None:
            return 0.0

        similarity = float(np.dot(embedding1, embedding2))
        # Clamp to [-1, 1] due to floating point rounding
        return max(-1.0, min(1.0, similarity))
