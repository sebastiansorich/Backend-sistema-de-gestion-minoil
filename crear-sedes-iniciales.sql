-- Script para crear sedes iniciales necesarias para sincronización SAP
-- =================================================================

-- Verificar si ya existen sedes
SELECT * FROM "Sede" WHERE activo = true;

-- Si no hay sedes, crear las sedes básicas de Minoil
INSERT INTO "Sede" (nombre, direccion, telefono, email, activo, "createdAt", "updatedAt") VALUES
('Sede Central', 'Dirección Central Minoil', '+591-3-123-4567', 'central@minoil.com.bo', true, NOW(), NOW()),
('Sucursal Santa Cruz', 'Santa Cruz, Bolivia', '+591-3-123-4568', 'santacruz@minoil.com.bo', true, NOW(), NOW()),
('Sucursal La Paz', 'La Paz, Bolivia', '+591-2-123-4569', 'lapaz@minoil.com.bo', true, NOW(), NOW())
ON CONFLICT (nombre) DO NOTHING;

-- Verificar que se crearon las sedes
SELECT id, nombre, activo FROM "Sede" WHERE activo = true; 