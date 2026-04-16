-- Renombrar pto_extra a informe_incidencias para alinear con nomenclatura Serincosol
ALTER TABLE reuniones RENAME COLUMN pto_extra TO informe_incidencias;
