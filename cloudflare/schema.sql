-- Una sola tabla: cada fila es un documento JSON de una colección
-- (cotizaciones, bodega, maquinaria, proveedores, config).
CREATE TABLE IF NOT EXISTS docs (
  col     TEXT NOT NULL,
  id      TEXT NOT NULL,
  data    TEXT NOT NULL,
  updated TEXT NOT NULL,
  por     TEXT,
  PRIMARY KEY (col, id)
);
