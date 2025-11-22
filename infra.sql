-- habilita extensão (execute no DB)
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS documents (
  id SERIAL PRIMARY KEY,
  content TEXT NOT NULL,
  -- ajuste a dimensão conforme o embedding (por ex 1536)
  embedding VECTOR(1536),
  created_at TIMESTAMP DEFAULT now()
);

-- exemplo de query kNN (mais próximo)
-- SELECT id, content FROM documents ORDER BY embedding <-> '[0.12, 0.34, ...]'::vector LIMIT 5;